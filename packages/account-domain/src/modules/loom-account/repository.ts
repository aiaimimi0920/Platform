import { createHash } from "node:crypto";
import type Redis from "ioredis";
import type { LoomAccountGrant, LoomAccountSession } from "@neuro/contracts";
import { LoomAccountError, SESSION_TTL_MS } from "./model";

export interface ApprovedGrant {
  grant: LoomAccountGrant;
  accountId: string;
  username: string;
  deviceId?: string;
}

// All transitions run in Redis atomically; retries cannot bind a second device.
const APPROVE = `
local old = redis.call('GET', KEYS[1])
if old then
  local previous, proposed = cjson.decode(old), cjson.decode(ARGV[1])
  if previous.accountId ~= proposed.accountId then return 'conflict' end
  for key, value in pairs(proposed.grant) do
    if previous.grant[key] ~= value then return 'conflict' end
  end
  return 'ok'
end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[2])
if redis.call('ZCARD', KEYS[2]) >= 8 then return 'limit' end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[4], KEYS[1])
redis.call('PEXPIRE', KEYS[2], 600000)
return 'ok'
`;

const EXCHANGE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'expired' end
if raw ~= ARGV[1] then return 'retry' end
local grant = cjson.decode(raw)
if grant.deviceId then return 'retry' end
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[3])
if redis.call('ZCARD', KEYS[3]) >= 16 then return 'limit' end
grant.deviceId = ARGV[4]
redis.call('SET', KEYS[1], cjson.encode(grant), 'KEEPTTL')
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[5])
redis.call('ZADD', KEYS[3], ARGV[6], ARGV[4])
redis.call('PEXPIRE', KEYS[3], ARGV[5])
return 'ok'
`;

const PROOF = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'revoked' end
local count = redis.call('INCR', KEYS[4])
if count == 1 then redis.call('PEXPIRE', KEYS[4], 120000) end
if count > tonumber(ARGV[4]) then return 'limit' end
if not redis.call('SET', KEYS[2], '1', 'PX', 121000, 'NX') then return 'replay' end
if ARGV[2] == 'revoke' then
  redis.call('DEL', KEYS[1])
  redis.call('ZREM', KEYS[3], ARGV[3])
end
return 'ok'
`;

export class LoomAccountRepository {
  constructor(private readonly redis: Pick<Redis, "get" | "eval">) {}

  private key(kind: string, id: string): string {
    return `neuro:loom-account:v1:${kind}:${createHash("sha256").update(id).digest("hex")}`;
  }

  async approve(record: ApprovedGrant, now: number): Promise<void> {
    const result = await this.redis.eval(APPROVE, 2,
      this.key("grant", record.grant.requestId), this.key("grants", record.accountId),
      JSON.stringify(record), now, record.grant.expiresAtMs - now, record.grant.expiresAtMs);
    if (result !== "ok") {
      throw new LoomAccountError(result === "limit" ? 429 : 409, "authorization_unavailable");
    }
  }

  async grant(requestId: string): Promise<{ raw: string; record: ApprovedGrant } | null> {
    const raw = await this.redis.get(this.key("grant", requestId));
    return raw ? { raw, record: JSON.parse(raw) as ApprovedGrant } : null;
  }

  async session(deviceId: string): Promise<{ raw: string; session: LoomAccountSession } | null> {
    const raw = await this.redis.get(this.key("session", deviceId));
    return raw ? { raw, session: JSON.parse(raw) as LoomAccountSession } : null;
  }

  sessionFence(deviceId: string, raw: string): { key: string; value: string } {
    return { key: this.key("session", deviceId), value: raw };
  }

  async exchange(raw: string, record: ApprovedGrant, session: LoomAccountSession, now: number) {
    return this.redis.eval(EXCHANGE, 3,
      this.key("grant", record.grant.requestId), this.key("session", session.deviceId),
      this.key("sessions", record.accountId), raw, JSON.stringify(session), now,
      session.deviceId, SESSION_TTL_MS, session.expiresAtMs);
  }

  async prove(raw: string, session: LoomAccountSession, nonce: string, action: "status" | "revoke" | "projection", now: number) {
    const result = await this.redis.eval(PROOF, 4,
      this.key("session", session.deviceId), this.key("nonce", `${session.deviceId}:${nonce}`),
      this.key("sessions", session.accountId),
      this.key(action === "projection" ? "projection-rate" : "rate", `${session.deviceId}:${Math.floor(now / 60_000)}`),
      raw, action, session.deviceId, action === "projection" ? 240 : 60);
    if (result !== "ok") {
      throw new LoomAccountError(result === "limit" ? 429 : 401,
        result === "replay" ? "device_proof_replayed" : "device_session_unavailable");
    }
  }
}
