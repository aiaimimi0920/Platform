import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";
import { customFetch } from "next-auth";
import type { OIDCConfig } from "next-auth/providers";
import type { RauthyUpsertInput } from "@neuro/contracts";
import type { RauthyConfiguration } from "./identity-provider";

export function normalizeRauthyProfile(profile: Record<string, unknown>, issuer: string): RauthyUpsertInput {
  if (profile.iss !== issuer || typeof profile.sub !== "string" || !profile.sub
      || profile.sub.length > 255 || /[\x00-\x1f\x7f]/.test(profile.sub)) {
    throw new Error("Invalid Rauthy issuer or subject");
  }
  if (profile.email !== undefined && profile.email !== null
      && (typeof profile.email !== "string" || profile.email.length > 254)) {
    throw new Error("Invalid Rauthy email claim");
  }
  if (profile.email_verified !== undefined && typeof profile.email_verified !== "boolean") {
    throw new Error("Invalid Rauthy email verification claim");
  }
  const username = (typeof profile.preferred_username === "string" ? profile.preferred_username.trim() : "")
    || (typeof profile.name === "string" ? profile.name.trim() : "") || undefined;
  if (username !== undefined && (username.length > 128 || /[\x00-\x1f\x7f]/.test(username))) {
    throw new Error("Invalid Rauthy display name");
  }
  return {
    issuer, subject: profile.sub, username,
    email: typeof profile.email === "string" ? profile.email : null,
    emailVerified: typeof profile.email === "string" && profile.email_verified === true,
  };
}

export async function verifyRauthyIdToken(
  idToken: string | undefined, config: RauthyConfiguration, keys: JWTVerifyGetKey,
): Promise<JWTPayload> {
  if (!idToken) throw new Error("Rauthy ID token is required");
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: config.issuer, audience: config.clientId,
    algorithms: ["RS256", "ES256", "EdDSA"],
    requiredClaims: ["iss", "sub", "aud", "exp", "iat"],
  });
  if ((payload.azp !== undefined && payload.azp !== config.clientId)
      || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) {
    throw new Error("Invalid Rauthy authorized party");
  }
  normalizeRauthyProfile(payload, config.issuer);
  return payload;
}

export async function fetchRauthyEndpoint(config: RauthyConfiguration, input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.origin !== new URL(config.issuer).origin || url.username || url.password) {
    throw new Error("Rauthy endpoint must use the configured issuer origin");
  }
  const timeout = AbortSignal.timeout(10_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal, redirect: "error" });
}

export function createRauthyIdTokenVerifier(config: RauthyConfiguration) {
  const keys = createRemoteJWKSet(config.jwksUrl, { timeoutDuration: 5000 });
  return (idToken: string | undefined) => verifyRauthyIdToken(idToken, config, keys);
}

export function createRauthyProvider(config: RauthyConfiguration): OIDCConfig<Record<string, unknown>> {
  return {
    id: "rauthy", name: "Rauthy", type: "oidc", issuer: config.issuer,
    clientId: config.clientId, clientSecret: config.clientSecret,
    authorization: { params: { scope: "openid profile email" } },
    checks: ["pkce", "state", "nonce"],
    [customFetch]: (input, init) => fetchRauthyEndpoint(config, input, init),
    allowDangerousEmailAccountLinking: false,
    client: { token_endpoint_auth_method: "client_secret_basic" },
    profile(profile) {
      // The signIn callback verifies the signature before allowing this identity to persist.
      const claims = normalizeRauthyProfile(profile, config.issuer);
      return {
        id: claims.subject, name: claims.username || null, email: claims.email,
        image: null, identityExpiresAt: profile.exp,
      };
    },
  };
}
