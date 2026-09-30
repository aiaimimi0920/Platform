import type { LoomAccountGrant } from "@neuro/contracts";

// Query parameters contain public authorization metadata only, never the PKCE verifier.
export function parseLoomAccountAuthorization(params: Record<string, string | string[] | undefined>): LoomAccountGrant | null {
  const { requestId, codeChallenge, publicKey, deviceName, expiresAtMs } = params;
  if (typeof requestId !== "string" || !/^[a-f0-9]{64}$/.test(requestId)
      || typeof codeChallenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)
      || typeof publicKey !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(publicKey)
      || typeof deviceName !== "string" || deviceName.length < 1 || deviceName.length > 80
      || /[\x00-\x1f\x7f]/.test(deviceName)
      || typeof expiresAtMs !== "string" || !/^\d{13}$/.test(expiresAtMs)) return null;
  return { protocol: "neuro.loom-account.v1", requestId, codeChallenge, publicKey, deviceName, expiresAtMs: Number(expiresAtMs) };
}

export function loomAuthorizationPath(grant: LoomAccountGrant): string {
  return `/loom/authorize?${new URLSearchParams({
    requestId: grant.requestId, codeChallenge: grant.codeChallenge, publicKey: grant.publicKey,
    deviceName: grant.deviceName, expiresAtMs: String(grant.expiresAtMs),
  })}`;
}
