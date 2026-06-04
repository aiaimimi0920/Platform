// ---------------------------------------------------------------------------
// Provider Key Health Checker — monitors multi-key health and auto-removes
// failed keys to solve the pain point: "多密钥轮换时，某个 key 失效了但网关还在用"
// ---------------------------------------------------------------------------

import { getProviderCredential, updateProviderCredential } from "./provider-credential-manager";
import type {
  GatewayOpenAiCompatibleProviderPayload,
  GatewayProviderAccountPayload,
} from "@neuro/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeyHealthStatus = "healthy" | "rate_limited" | "invalid" | "expired" | "unknown";

export type KeyHealthEntry = {
  keyId: string;
  keyPreview: string;
  status: KeyHealthStatus;
  lastCheckedAt: string;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

export type KeyHealthReport = {
  providerAccountId: string;
  credentialKind: string;
  totalKeys: number;
  healthyKeys: number;
  unhealthyKeys: number;
  keys: KeyHealthEntry[];
  recommendation: string;
};

export type CheckKeyHealthInput = {
  providerAccountId: string;
  testEndpoint?: string;
  removeUnhealthy?: boolean;
};

export type CheckKeyHealthResult = {
  success: true;
  checked: number;
  healthy: number;
  removed: number;
  message: string;
};

// ---------------------------------------------------------------------------
// Key Health Checking
// ---------------------------------------------------------------------------

/**
 * Checks the health of all keys in a multi-key provider credential.
 * Optionally removes unhealthy keys automatically.
 */
export async function checkProviderKeyHealth(
  input: CheckKeyHealthInput,
): Promise<CheckKeyHealthResult> {
  const { providerAccountId, testEndpoint, removeUnhealthy = false } = input;

  // Get current credential
  const result = await getProviderCredential(providerAccountId, { maskSecrets: false });
  const credential = result.credential;

  // Verify this is a multi-key credential
  if (!isMultiKeyOpenAiCredential(credential)) {
    throw new Error("Provider credential is not an OpenAI-compatible multi-key payload");
  }

  const apiKeys = credential.apiKeys
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (apiKeys.length === 0) {
    throw new Error("Provider credential has no keys to check");
  }

  // Test each key
  const healthResults = await Promise.all(
    apiKeys.map(async (key, index) => {
      try {
        await testProviderKey(key, testEndpoint, credential);
        return { key, index, status: "healthy" as KeyHealthStatus, error: null };
      } catch (error) {
        const status = classifyKeyError(error);
        return {
          key,
          index,
          status,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const healthyKeys = healthResults.filter((r) => r.status === "healthy");
  const unhealthyKeys = healthResults.filter((r) => r.status !== "healthy");

  // Auto-remove unhealthy keys if requested
  let removed = 0;
  if (removeUnhealthy && unhealthyKeys.length > 0) {
    // Keep only healthy keys
    const newKeys = healthyKeys.map((r) => r.key);

    // Ensure we don't remove all keys
    if (newKeys.length === 0) {
      throw new Error(
        "Cannot remove all keys - at least one key must remain. All keys are unhealthy.",
      );
    }

    // Update credential with only healthy keys
    const updatedCredential = {
      ...credential,
      apiKeys: newKeys,
    };

    await updateProviderCredential({
      providerAccountId,
      credential: updatedCredential as GatewayProviderAccountPayload,
      preWarm: true,
    });

    removed = unhealthyKeys.length;
  }

  return {
    success: true,
    checked: apiKeys.length,
    healthy: healthyKeys.length,
    removed,
    message: removeUnhealthy
      ? `已检查 ${apiKeys.length} 个密钥，移除 ${removed} 个失效密钥`
      : `已检查 ${apiKeys.length} 个密钥，发现 ${unhealthyKeys.length} 个失效密钥`,
  };
}

/**
 * Gets a detailed health report for a multi-key provider credential.
 */
export async function getProviderKeyHealthReport(
  providerAccountId: string,
): Promise<KeyHealthReport> {
  // Get current credential
  const result = await getProviderCredential(providerAccountId, { maskSecrets: false });
  const credential = result.credential;

  // Verify this is a multi-key credential
  if (!isMultiKeyOpenAiCredential(credential)) {
    throw new Error("Provider credential is not an OpenAI-compatible multi-key payload");
  }

  const apiKeys = credential.apiKeys
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (apiKeys.length === 0) {
    return {
      providerAccountId,
      credentialKind: "openai_compatible_multi_key",
      totalKeys: 0,
      healthyKeys: 0,
      unhealthyKeys: 0,
      keys: [],
      recommendation: "当前没有密钥需要检查",
    };
  }

  // Test each key
  const healthResults = await Promise.all(
    apiKeys.map(async (key, index) => {
      const keyId = `key-${index}`;
      const keyPreview = maskKeyValue(key);
      const now = new Date().toISOString();

      try {
        await testProviderKey(key, undefined, credential);
        return {
          keyId,
          keyPreview,
          status: "healthy" as KeyHealthStatus,
          lastCheckedAt: now,
          lastErrorAt: null,
          lastError: null,
          consecutiveFailures: 0,
        };
      } catch (error) {
        const status = classifyKeyError(error);
        return {
          keyId,
          keyPreview,
          status,
          lastCheckedAt: now,
          lastErrorAt: now,
          lastError: error instanceof Error ? error.message : String(error),
          consecutiveFailures: 1,
        };
      }
    }),
  );

  const healthyKeys = healthResults.filter((r) => r.status === "healthy");
  const unhealthyKeys = healthResults.filter((r) => r.status !== "healthy");

  let recommendation = "";
  if (unhealthyKeys.length === 0) {
    recommendation = "所有密钥健康";
  } else if (unhealthyKeys.length === apiKeys.length) {
    recommendation = "所有密钥失效，请立即更新凭证";
  } else {
    recommendation = `移除 ${unhealthyKeys.length} 个失效密钥`;
  }

  return {
    providerAccountId,
    credentialKind: "openai_compatible_multi_key",
    totalKeys: apiKeys.length,
    healthyKeys: healthyKeys.length,
    unhealthyKeys: unhealthyKeys.length,
    keys: healthResults,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Tests a single provider key by making a lightweight API call.
 */
async function testProviderKey(
  key: string,
  testEndpoint: string | undefined,
  credential: GatewayOpenAiCompatibleProviderPayload,
): Promise<void> {
  const baseUrl = credential.baseUrl.replace(/\/+$/, "");
  const modelsPath = (credential.modelsPath ?? "/models").replace(/^\/+/, "");
  const testUrl = testEndpoint?.trim() ? testEndpoint.trim() : `${baseUrl}/${modelsPath}`;
  const headers: Record<string, string> = {
    ...(credential.headers ?? {}),
    "Content-Type": "application/json",
  };

  if (credential.authMode === "x-api-key") {
    headers["x-api-key"] = key;
  } else {
    headers.Authorization = `Bearer ${key}`;
  }

  const response = await fetch(testUrl, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(5000), // 5 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  // If we get here, the key is healthy
}

/**
 * Classifies an error from a key test into a health status.
 */
function classifyKeyError(error: unknown): KeyHealthStatus {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("401") || lowerMessage.includes("unauthorized")) {
    return "invalid";
  }
  if (lowerMessage.includes("403") || lowerMessage.includes("forbidden")) {
    return "expired";
  }
  if (lowerMessage.includes("429") || lowerMessage.includes("rate limit")) {
    return "rate_limited";
  }

  return "unknown";
}

function isMultiKeyOpenAiCredential(
  credential: GatewayProviderAccountPayload,
): credential is GatewayOpenAiCompatibleProviderPayload & { apiKeys: string[] } {
  return credential.adapter === "openai_compatible" && Array.isArray(credential.apiKeys);
}

/**
 * Masks a key value for safe display.
 */
function maskKeyValue(key: string): string {
  if (key.length <= 8) {
    return "***";
  }
  return `${key.slice(0, 3)}***${key.slice(-3)}`;
}
