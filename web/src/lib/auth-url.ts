function normalizeAuthUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function ensureAuthUrlEnvironment(): string | null {
  const explicitAuthUrl = normalizeAuthUrl(process.env.AUTH_URL);
  if (explicitAuthUrl) {
    return explicitAuthUrl;
  }

  const fallbackAuthUrl = normalizeAuthUrl(process.env.NEXTAUTH_URL) ?? normalizeAuthUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!fallbackAuthUrl) {
    return null;
  }

  process.env.AUTH_URL = fallbackAuthUrl;
  return fallbackAuthUrl;
}
