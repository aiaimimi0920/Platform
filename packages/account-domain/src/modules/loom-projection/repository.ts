import { createHash } from "node:crypto";
import type Redis from "ioredis";
import type { LoomProjectionEndpoint, LoomProjectionRecord } from "@neuro/contracts";
import type { LoomDeviceAuthorization } from "../loom-account/service";
import { LoomProjectionError, MAX_RECORDS, PRESENCE_TTL_MS } from "./model";

export interface StoredProjection { raw: string; record: LoomProjectionRecord }
type Fence = LoomDeviceAuthorization["fence"];

// Optimistic record CAS and account session fences share one Redis transaction.
// Tombstones retain their slot until source-session expiry; quotas cannot be
// bypassed by creating and immediately unlinking invitations.
const COMMIT = `
for i = 3, #KEYS do
  local session = redis.call('GET', KEYS[i])
  local revoked = i == 3 and 'caller_revoked' or 'peer_revoked'
  if session ~= ARGV[i + 3] then return revoked end
  if cjson.decode(session).expiresAtMs <= tonumber(ARGV[3]) then return revoked end
end
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 'retry' end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[3])
if ARGV[1] == '' and redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[5]) then return 'limit' end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[4])
redis.call('ZADD', KEYS[2], ARGV[4], KEYS[1])
local last = redis.call('ZRANGE', KEYS[2], -1, -1, 'WITHSCORES')
redis.call('PEXPIREAT', KEYS[2], last[2])
return 'ok'
`;
const LIST = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local keys = redis.call('ZRANGE', KEYS[1], 0, ${MAX_RECORDS - 1})
local values = {}
for _, key in ipairs(keys) do
  local value = redis.call('GET', key)
  if value then table.insert(values, value) end
end
return values
`;
const PRESENCE = `
local session = redis.call('GET', KEYS[2])
if session ~= ARGV[1] then return 'revoked' end
if cjson.decode(session).expiresAtMs <= tonumber(ARGV[4]) then return 'revoked' end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[3])
return 'ok'
`;
const PRESENCES = `
local values = {}
for _, key in ipairs(KEYS) do table.insert(values, redis.call('GET', key) or '') end
return values
`;

export class LoomProjectionRepository {
  constructor(private readonly redis: Pick<Redis, "get" | "eval">) {}

  private key(kind: string, accountId: string, id = ""): string {
    const hash = createHash("sha256").update(JSON.stringify([accountId, id])).digest("hex");
    return `neuro:loom-projection:v2:${kind}:${hash}`;
  }

  async get(accountId: string, id: string): Promise<StoredProjection | null> {
    const raw = await this.redis.get(this.key("record", accountId, id));
    return raw ? { raw, record: JSON.parse(raw) as LoomProjectionRecord } : null;
  }

  async commit(accountId: string, expected: string | null, record: LoomProjectionRecord, fences: Fence[], now: number): Promise<boolean> {
    const result = await this.redis.eval(COMMIT, 2 + fences.length,
      this.key("record", accountId, record.envelope.projectionId), this.key("index", accountId),
      ...fences.map((fence) => fence.key), expected ?? "", JSON.stringify(record), now,
      record.expiresAtMs, MAX_RECORDS, ...fences.map((fence) => fence.value));
    if (result === "retry") return false;
    if (result === "peer_revoked") throw new LoomProjectionError(409, "projection_peer_unavailable");
    if (result !== "ok") throw new LoomProjectionError(result === "limit" ? 429 : 401,
      result === "limit" ? "projection_limit_reached" : "device_session_unavailable");
    return true;
  }

  async list(accountId: string, now: number): Promise<LoomProjectionRecord[]> {
    const values = await this.redis.eval(LIST, 1, this.key("index", accountId), now) as string[];
    return values.map((raw) => JSON.parse(raw) as LoomProjectionRecord);
  }

  async setPresence(device: LoomDeviceAuthorization, endpoint: LoomProjectionEndpoint, now: number): Promise<void> {
    const expiresAtMs = Math.min(now + PRESENCE_TTL_MS, device.session.expiresAtMs);
    const result = await this.redis.eval(PRESENCE, 2,
      this.key("presence", device.session.accountId, device.session.deviceId), device.fence.key,
      device.fence.value, JSON.stringify({ endpoint, expiresAtMs }), expiresAtMs, now);
    if (result !== "ok") throw new LoomProjectionError(401, "device_session_unavailable");
  }

  async presences(accountId: string, deviceIds: string[], now: number): Promise<Map<string, LoomProjectionEndpoint>> {
    if (!deviceIds.length) return new Map();
    const values = await this.redis.eval(PRESENCES, deviceIds.length,
      ...deviceIds.map((id) => this.key("presence", accountId, id))) as string[];
    const result = new Map<string, LoomProjectionEndpoint>();
    values.forEach((raw, index) => {
      if (!raw) return;
      const presence = JSON.parse(raw) as { endpoint: LoomProjectionEndpoint; expiresAtMs: number };
      if (presence.expiresAtMs > now) result.set(deviceIds[index], presence.endpoint);
    });
    return result;
  }
}
