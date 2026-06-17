import type {
  GatewayCustomHttpProviderPayload,
  GatewayGrokCompatibleProviderPayload,
  GatewayKeepaliveConfig,
  GatewayKiroCompatibleProviderPayload,
  GatewayLinkupCompatibleProviderPayload,
  GatewayOpenAiCompatibleProviderPayload,
  GatewayProducerCompatibleProviderPayload,
  GatewayProviderAccountPayload,
  GatewaySessionBackedProviderRuntime,
  GatewayUdioCompatibleProviderPayload,
} from "@neuro/contracts";

function maskSecretValue(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return raw || null;
  }
  if (raw.length <= 8) {
    return `${raw.slice(0, 2)}***`;
  }
  return `${raw.slice(0, 4)}***${raw.slice(-2)}`;
}

function maskSecretHeaders(headers: Record<string, string> | null | undefined) {
  if (!headers) {
    return headers ?? null;
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const normalizedKey = key.trim().toLowerCase();
      if (
        normalizedKey.includes("authorization") ||
        normalizedKey.includes("token") ||
        normalizedKey.includes("secret") ||
        normalizedKey.includes("cookie") ||
        normalizedKey.includes("key")
      ) {
        return [key, maskSecretValue(value) ?? "***"];
      }
      return [key, value];
    }),
  );
}

function maskKeepaliveConfig(config: GatewayKeepaliveConfig | null | undefined) {
  if (!config) {
    return config ?? null;
  }
  return {
    ...config,
    authToken: maskSecretValue(config.authToken),
  } satisfies GatewayKeepaliveConfig;
}

function maskSessionBackedProviderRuntime<T extends GatewaySessionBackedProviderRuntime>(payload: T): T {
  return {
    ...payload,
    sessionAuth: payload.sessionAuth ? { ...payload.sessionAuth } : payload.sessionAuth ?? null,
    keepalive: maskKeepaliveConfig(payload.keepalive),
  };
}

function maskCommonProviderSecretFields<T extends GatewayProviderAccountPayload>(payload: T): T {
  const masked = { ...payload } as T & Record<string, unknown>;
  for (const field of [
    "apiKey",
    "api_key",
    "authToken",
    "auth_token",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "sessionToken",
    "session_token",
    "codexHomeBundleObjectKey",
    "codex_home_bundle_object_key",
    "claudeHomeBundleObjectKey",
    "claude_home_bundle_object_key",
  ]) {
    const value = masked[field];
    if (typeof value === "string") {
      masked[field] = maskSecretValue(value) ?? "***";
    }
  }

  for (const field of ["apiKeys", "api_keys", "keys"]) {
    const value = masked[field];
    if (Array.isArray(value)) {
      masked[field] = value.map((entry) =>
        typeof entry === "string" ? maskSecretValue(entry) ?? "***" : entry,
      );
    }
  }

  const headers = masked.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    masked.headers = maskSecretHeaders(headers as Record<string, string>);
  }

  const keepalive = masked.keepalive;
  if (keepalive && typeof keepalive === "object" && !Array.isArray(keepalive)) {
    const maskedKeepalive = { ...keepalive } as Record<string, unknown>;
    for (const field of ["authToken", "auth_token"]) {
      const value = maskedKeepalive[field];
      if (typeof value === "string") {
        maskedKeepalive[field] = maskSecretValue(value);
      }
    }
    masked.keepalive = maskedKeepalive;
  }

  return masked;
}

function isGatewaySearchProviderPayload(
  payload: GatewayProviderAccountPayload,
): payload is GatewayLinkupCompatibleProviderPayload {
  return payload.adapter === "linkup_compatible" || payload.adapter === "search_api_compatible";
}

/**
 * Masks operator-facing provider payload secrets without removing Gateway
 * runtime routing fields needed to diagnose browser/session-backed providers.
 */
export function maskGatewayProviderPayload(
  payload: GatewayProviderAccountPayload,
): GatewayProviderAccountPayload {
  let masked: GatewayProviderAccountPayload;
  if (payload.adapter === "openai_compatible") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      apiKeys: (payload.apiKeys ?? []).map((value) => maskSecretValue(value) ?? "***"),
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayOpenAiCompatibleProviderPayload);
  } else if (payload.adapter === "anthropic_compatible") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      headers: maskSecretHeaders(payload.headers ?? null),
    });
  } else if (payload.adapter === "grok_compatible") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayGrokCompatibleProviderPayload);
  } else if (payload.adapter === "kiro_compatible") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayKiroCompatibleProviderPayload);
  } else if (isGatewaySearchProviderPayload(payload)) {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayLinkupCompatibleProviderPayload);
  } else if (payload.adapter === "producer_compatible") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayProducerCompatibleProviderPayload);
  } else if (payload.adapter === "udio_compatible") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      apiKey: maskSecretValue(payload.apiKey) ?? "***",
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayUdioCompatibleProviderPayload);
  } else if (payload.adapter === "codex_cli") {
    masked = {
      ...payload,
      codexHomeBundleObjectKey: maskSecretValue(payload.codexHomeBundleObjectKey) ?? "***",
    };
  } else if (payload.adapter === "claude_code") {
    masked = {
      ...payload,
      claudeHomeBundleObjectKey: maskSecretValue(payload.claudeHomeBundleObjectKey) ?? "***",
    };
  } else if (payload.adapter === "custom_http") {
    masked = maskSessionBackedProviderRuntime({
      ...payload,
      authToken: maskSecretValue(payload.authToken),
      headers: maskSecretHeaders(payload.headers ?? null),
    } satisfies GatewayCustomHttpProviderPayload);
  } else if ("authToken" in payload || "headers" in payload) {
    masked = {
      ...payload,
      authToken: "authToken" in payload ? maskSecretValue(payload.authToken) : undefined,
      headers: "headers" in payload ? maskSecretHeaders(payload.headers ?? null) : undefined,
    } as GatewayProviderAccountPayload;
  } else {
    masked = payload;
  }
  return maskCommonProviderSecretFields(masked);
}
