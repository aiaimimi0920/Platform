import { isIP } from "node:net";
import type { LoomAccountSession, LoomProjectionEndpoint, LoomProjectionPolicy } from "@neuro/contracts";
import { AUTHORIZATION_LEASE_MS, LoomProjectionError, MAX_RECORDS, PRESENCE_TTL_MS, PROJECTION_PROTOCOL } from "./model";

function origin(value: string): string {
  const url = new URL(value);
  const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname);
  if (value.length > 256 || !/^[\x21-\x7e]+$/.test(value) || value !== url.origin
      || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
    throw new Error("invalid_projection_origin");
  }
  return url.origin;
}

export function projectionPolicy(serverOrigin: string, relayUrls: string[]): LoomProjectionPolicy {
  try {
    const normalized = origin(serverOrigin);
    if (relayUrls.length > 4 || new Set(relayUrls).size !== relayUrls.length) throw new Error("relay_limit");
    for (const relay of relayUrls) {
      const url = new URL(relay);
      if (relay !== `${origin(url.origin)}/` || (url.protocol !== "https:" && !normalized.startsWith("http:"))) {
        throw new Error("invalid_relay_origin");
      }
    }
    return { protocol: PROJECTION_PROTOCOL, serverOrigin: normalized, relayUrls: [...relayUrls],
      syncIntervalMs: 15_000, authorizationLeaseMs: AUTHORIZATION_LEASE_MS,
      presenceTtlMs: PRESENCE_TTL_MS, maxRecords: MAX_RECORDS };
  } catch { throw new LoomProjectionError(503, "projection_not_configured"); }
}

// Read only deployment policy. QR data and caller headers never configure an origin.
export function configuredProjectionPolicy(): LoomProjectionPolicy {
  const relayUrls: unknown = (() => {
    try { return JSON.parse(process.env.LOOM_PROJECTION_RELAY_URLS ?? "[]") as unknown; }
    catch { return null; }
  })();
  if (!Array.isArray(relayUrls) || !relayUrls.every((url): url is string => typeof url === "string")) {
    throw new LoomProjectionError(503, "projection_not_configured");
  }
  return projectionPolicy(process.env.LOOM_PROJECTION_PUBLIC_ORIGIN ?? "", relayUrls);
}

export function validateEndpoint(endpoint: LoomProjectionEndpoint, session: LoomAccountSession, policy: LoomProjectionPolicy): void {
  if (endpoint.endpointId !== Buffer.from(session.publicKey, "base64").toString("hex")
      || (endpoint.relayUrl !== null && !policy.relayUrls.includes(endpoint.relayUrl))) {
    throw new LoomProjectionError(400, "projection_invalid_endpoint");
  }
  for (const { ip } of endpoint.addresses) {
    const family = isIP(ip);
    const normalized = family === 6 && !ip.includes("%") ? new URL(`http://[${ip}]`).hostname.slice(1, -1) : ip;
    const loopback = normalized.startsWith("127.") || normalized === "::1";
    const invalid = !family || ip.includes("%") || normalized === "::" || /^0\./.test(ip)
      || (family === 4 && Number(ip.split(".")[0]) >= 224)
      || (family === 6 && (/^ff/i.test(normalized) || /^::ffff:/i.test(normalized)));
    if (invalid || (loopback && !policy.serverOrigin.startsWith("http:"))) {
      throw new LoomProjectionError(400, "projection_invalid_endpoint");
    }
  }
}
