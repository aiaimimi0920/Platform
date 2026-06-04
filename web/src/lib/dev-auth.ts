import type { LinuxDoUpsertInput } from "@neuro/contracts";

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function parseTrustLevel(value: string | undefined): number | null {
  if (!value) return 4;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.floor(parsed);
}

export function isDevAuthBypassEnabled(): boolean {
  return isEnabled(process.env.DEV_AUTH_BYPASS_ENABLED);
}

export function getDevAuthBypassProfile(): LinuxDoUpsertInput {
  return {
    id: process.env.DEV_AUTH_BYPASS_PROVIDER_USER_ID || "local-dev-account",
    username: process.env.DEV_AUTH_BYPASS_USERNAME || "local-dev",
    name: process.env.DEV_AUTH_BYPASS_NAME || "Local Dev",
    email: process.env.DEV_AUTH_BYPASS_EMAIL || "local-dev@example.test",
    avatar_url: null,
    trust_level: parseTrustLevel(process.env.DEV_AUTH_BYPASS_TRUST_LEVEL),
  };
}

export function getDevAuthBypassLabel(): string {
  return process.env.DEV_AUTH_BYPASS_NAME || "Local Dev";
}
