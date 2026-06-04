// ---------------------------------------------------------------------------
// Gateway Auth Adapter – pluggable authentication layer for the AI gateway.
// The default adapter uses the gateway's own API key system, but it can be
// swapped for external auth backends or a simple static key map.
// ---------------------------------------------------------------------------

import { parseGatewayProjectApiKey, verifyGatewayProjectApiKey } from "./api-key";

// ---- Types ----------------------------------------------------------------

export type GatewayAuthResult =
  | {
      authenticated: true;
      projectId: string;
      tenantId: string;
      userId: string | null;
      credentialRef: string | null;
      scopes: string[];
      metadata: Record<string, unknown>;
    }
  | {
      authenticated: false;
      error: string;
      statusCode: number;
    };

export type GatewayAuthRequest = {
  authorization?: string;
  apiKey?: string;
  path: string;
  method: string;
  model?: string;
  projectSlug?: string;
};

export type GatewayAuthAdapter = {
  name: string;
  authenticate: (request: GatewayAuthRequest) => Promise<GatewayAuthResult>;
  healthCheck?: () => Promise<boolean>;
};

// ---- Helpers --------------------------------------------------------------

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  return null;
}

function extractRawToken(request: GatewayAuthRequest): string | null {
  return extractBearerToken(request.authorization) ?? request.apiKey?.trim() ?? null;
}

// ---- Gateway API Key Adapter ----------------------------------------------

export type GatewayApiKeyLookup = (apiKeyId: string) => Promise<{
  apiKeyId: string;
  projectId: string;
  tenantId: string;
  status: string;
} | null>;

export function createGatewayApiKeyAuthAdapter(args: {
  lookupApiKey: GatewayApiKeyLookup;
  secret?: string;
}): GatewayAuthAdapter {
  const { lookupApiKey, secret } = args;

  return {
    name: "gateway-api-key",

    async authenticate(request: GatewayAuthRequest): Promise<GatewayAuthResult> {
      const rawToken = extractRawToken(request);
      if (!rawToken) {
        return {
          authenticated: false,
          error: "Missing authentication credentials.",
          statusCode: 401,
        };
      }

      const parsed = parseGatewayProjectApiKey(rawToken);
      if (!parsed) {
        return {
          authenticated: false,
          error: "Invalid API key format.",
          statusCode: 401,
        };
      }

      const record = await lookupApiKey(parsed.apiKeyId);
      if (!record || record.status !== "active") {
        return {
          authenticated: false,
          error: "API key not found or inactive.",
          statusCode: 401,
        };
      }

      const verified = verifyGatewayProjectApiKey(rawToken, {
        apiKeyId: record.apiKeyId,
        projectId: record.projectId,
        tenantId: record.tenantId,
        secret,
      });

      if (!verified) {
        return {
          authenticated: false,
          error: "API key signature verification failed.",
          statusCode: 401,
        };
      }

      return {
        authenticated: true,
        projectId: record.projectId,
        tenantId: record.tenantId,
        userId: null,
        credentialRef: parsed.apiKeyId,
        scopes: ["relay"],
        metadata: { adapter: "gateway-api-key", apiKeyId: parsed.apiKeyId },
      };
    },

    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

// ---- External Auth Adapter ------------------------------------------------

export function createGatewayExternalAuthAdapter(args: {
  verifyEndpoint: string;
  timeoutMs?: number;
}): GatewayAuthAdapter {
  const { verifyEndpoint, timeoutMs = 5000 } = args;

  return {
    name: "gateway-external",

    async authenticate(request: GatewayAuthRequest): Promise<GatewayAuthResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(verifyEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          return {
            authenticated: false,
            error: `External auth endpoint returned status ${response.status}.`,
            statusCode: response.status >= 400 && response.status < 500 ? response.status : 502,
          };
        }

        const body = (await response.json()) as GatewayAuthResult;
        return body;
      } catch (err: unknown) {
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? `External auth endpoint timed out after ${timeoutMs}ms.`
            : `External auth endpoint unreachable: ${err instanceof Error ? err.message : String(err)}`;

        return {
          authenticated: false,
          error: message,
          statusCode: 502,
        };
      } finally {
        clearTimeout(timer);
      }
    },

    async healthCheck(): Promise<boolean> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(verifyEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "/__health__", method: "GET" }),
          signal: controller.signal,
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ---- Static Key Adapter ---------------------------------------------------

export function createGatewayStaticKeyAuthAdapter(args: {
  keys: Map<string, { projectId: string; tenantId: string; scopes: string[] }>;
}): GatewayAuthAdapter {
  const { keys } = args;

  return {
    name: "gateway-static-key",

    async authenticate(request: GatewayAuthRequest): Promise<GatewayAuthResult> {
      const rawToken = extractRawToken(request);
      if (!rawToken) {
        return {
          authenticated: false,
          error: "Missing authentication credentials.",
          statusCode: 401,
        };
      }

      const entry = keys.get(rawToken);
      if (!entry) {
        return {
          authenticated: false,
          error: "Unknown API key.",
          statusCode: 401,
        };
      }

      return {
        authenticated: true,
        projectId: entry.projectId,
        tenantId: entry.tenantId,
        userId: null,
        credentialRef: null,
        scopes: entry.scopes,
        metadata: { adapter: "gateway-static-key" },
      };
    },

    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

// ---- Adapter Chain --------------------------------------------------------

export async function resolveGatewayAuth(
  request: GatewayAuthRequest,
  adapters: GatewayAuthAdapter[],
): Promise<GatewayAuthResult> {
  if (adapters.length === 0) {
    return {
      authenticated: false,
      error: "No auth adapters configured.",
      statusCode: 500,
    };
  }

  let lastFailure: GatewayAuthResult = {
    authenticated: false,
    error: "No auth adapters configured.",
    statusCode: 500,
  };

  for (const adapter of adapters) {
    const result = await adapter.authenticate(request);
    if (result.authenticated) {
      return result;
    }
    lastFailure = result;
  }

  return lastFailure;
}

// ---- Request Extraction ---------------------------------------------------

export function extractGatewayAuthRequest(
  headers: Record<string, string | string[] | undefined>,
  path: string,
  method: string,
): GatewayAuthRequest {
  const normalize = (value: string | string[] | undefined): string | undefined => {
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    authorization: normalize(headers["authorization"] ?? headers["Authorization"]),
    apiKey: normalize(headers["x-api-key"] ?? headers["X-Api-Key"]),
    path,
    method: method.toUpperCase(),
  };
}
