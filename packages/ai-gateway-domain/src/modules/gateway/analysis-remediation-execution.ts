import type {
  ExecuteGatewayAnalysisAnomalyIncidentRemediationInput,
  GatewayAnalysisAnomalyIncidentRemediationActionView,
  GatewayRateLimitDefinition,
  GatewayRoutePolicyConfig,
  GatewayRoutePolicyView,
} from "@neuro/contracts";
import { normalizeRoutePolicyRateLimitDefinition } from "./route-policy-rate-limits";

function normalizeProviderAccountIds(values: string[] | null | undefined) {
  const normalized = Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
  return normalized.length > 0 ? normalized : null;
}

function buildRoutePolicyPatchResult(args: {
  nextConfig: GatewayRoutePolicyConfig;
  changedFields: string[];
  summary: string;
}) {
  return {
    nextConfig: args.nextConfig,
    changedFields: args.changedFields,
    summary: args.summary,
  };
}

function normalizeScopedKey(label: string, value: string | null | undefined, options?: { lowerCase?: boolean }) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error(`${label} 不能为空。`);
  }
  return options?.lowerCase ? normalized.toLowerCase() : normalized;
}

function ensureTightenedRateLimit(
  label: string,
  current: GatewayRateLimitDefinition | null | undefined,
  next: GatewayRateLimitDefinition,
) {
  if (!next.windowSeconds || !next.maxRequests) {
    throw new Error(`${label} 需要同时提供 windowSeconds 和 maxRequests。`);
  }
  if (!current?.windowSeconds || !current.maxRequests) {
    return;
  }
  if (next.maxRequests > current.maxRequests) {
    throw new Error(`${label} 当前 remediation 只允许下调 maxRequests，不允许上调。`);
  }
  if (next.windowSeconds < current.windowSeconds) {
    throw new Error(`${label} 当前 remediation 只允许保持或放大 windowSeconds，不允许缩短窗口。`);
  }
}

export function resolveGatewayAnalysisAnomalyRoutePolicyPatch(args: {
  action: GatewayAnalysisAnomalyIncidentRemediationActionView;
  routePolicy: GatewayRoutePolicyView;
  input: ExecuteGatewayAnalysisAnomalyIncidentRemediationInput;
}) {
  const { action, routePolicy, input } = args;
  const patchInput = input.routePolicyPatch ?? null;
  const currentConfig = routePolicy.config;

  switch (action.actionKey) {
    case "disable-prestream-fallback": {
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        preStreamFallbackEnabled: false,
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields: currentConfig.preStreamFallbackEnabled ? ["preStreamFallbackEnabled"] : [],
        summary: "Set preStreamFallbackEnabled=false for the linked route policy.",
      });
    }

    case "reduce-provider-concurrency": {
      const currentValue = currentConfig.providerMaxConcurrentRequests;
      const targetValue =
        patchInput?.providerMaxConcurrentRequests ??
        (currentValue != null ? Math.max(1, currentValue - 1) : 1);
      if (!Number.isFinite(targetValue) || targetValue < 1) {
        throw new Error("providerMaxConcurrentRequests 必须是大于等于 1 的整数。");
      }
      if (currentValue != null && targetValue > currentValue) {
        throw new Error("当前 remediation 只允许下调 providerMaxConcurrentRequests，不允许上调。");
      }
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        providerMaxConcurrentRequests: Math.floor(targetValue),
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields:
          currentValue === nextConfig.providerMaxConcurrentRequests ? [] : ["providerMaxConcurrentRequests"],
        summary: `Set providerMaxConcurrentRequests=${nextConfig.providerMaxConcurrentRequests}.`,
      });
    }

    case "provider-isolation": {
      const nextProviderIds = normalizeProviderAccountIds(patchInput?.allowedProviderAccountIds);
      if (!nextProviderIds?.length) {
        throw new Error("provider-isolation remediation 需要显式提供 allowedProviderAccountIds。");
      }
      const currentAllowlist = normalizeProviderAccountIds(currentConfig.allowedProviderAccountIds);
      if (currentAllowlist && nextProviderIds.some((value) => !currentAllowlist.includes(value))) {
        throw new Error("provider-isolation 只能收窄当前 allowlist，不允许引入新的 providerAccountId。");
      }
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        allowedProviderAccountIds: nextProviderIds,
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields:
          JSON.stringify(currentAllowlist ?? []) === JSON.stringify(nextProviderIds) ? [] : ["allowedProviderAccountIds"],
        summary: `Narrow allowedProviderAccountIds to ${nextProviderIds.join(", ")}.`,
      });
    }

    case "tighten-project-rate-limit": {
      const currentDefinition =
        currentConfig.rateLimitWindowSeconds && currentConfig.rateLimitMaxRequests
          ? {
              windowSeconds: currentConfig.rateLimitWindowSeconds,
              maxRequests: currentConfig.rateLimitMaxRequests,
            }
          : null;
      const nextDefinition = normalizeRoutePolicyRateLimitDefinition(
        "routePolicyPatch.projectRateLimit",
        patchInput?.projectRateLimit ?? null,
        currentDefinition,
      );
      if (!nextDefinition) {
        throw new Error("tighten-project-rate-limit 需要显式提供 projectRateLimit。");
      }
      ensureTightenedRateLimit("projectRateLimit", currentDefinition, nextDefinition);
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        rateLimitWindowSeconds: nextDefinition.windowSeconds,
        rateLimitMaxRequests: nextDefinition.maxRequests,
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields:
          currentConfig.rateLimitWindowSeconds === nextDefinition.windowSeconds &&
          currentConfig.rateLimitMaxRequests === nextDefinition.maxRequests
            ? []
            : ["rateLimitWindowSeconds", "rateLimitMaxRequests"],
        summary: `Set project rate limit to ${nextDefinition.maxRequests}/${nextDefinition.windowSeconds}s.`,
      });
    }

    case "tighten-api-key-rate-limit": {
      const nextDefinition = normalizeRoutePolicyRateLimitDefinition(
        "routePolicyPatch.apiKeyRateLimit",
        patchInput?.apiKeyRateLimit ?? null,
        currentConfig.apiKeyRateLimit ?? null,
      );
      if (!nextDefinition) {
        throw new Error("tighten-api-key-rate-limit 需要显式提供 apiKeyRateLimit。");
      }
      ensureTightenedRateLimit("apiKeyRateLimit", currentConfig.apiKeyRateLimit, nextDefinition);
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        apiKeyRateLimit: nextDefinition,
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields:
          JSON.stringify(currentConfig.apiKeyRateLimit ?? null) === JSON.stringify(nextDefinition)
            ? []
            : ["apiKeyRateLimit"],
        summary: `Set apiKeyRateLimit to ${nextDefinition.maxRequests}/${nextDefinition.windowSeconds}s.`,
      });
    }

    case "tighten-model-rate-limit": {
      const key = normalizeScopedKey("routePolicyPatch.modelRateLimitKey", patchInput?.modelRateLimitKey ?? null);
      const currentDefinition = currentConfig.modelRateLimits?.[key] ?? null;
      const nextDefinition = normalizeRoutePolicyRateLimitDefinition(
        `routePolicyPatch.modelRateLimit.${key}`,
        patchInput?.modelRateLimit ?? null,
        currentDefinition,
      );
      if (!nextDefinition) {
        throw new Error("tighten-model-rate-limit 需要显式提供 modelRateLimit。");
      }
      ensureTightenedRateLimit(`modelRateLimit.${key}`, currentDefinition, nextDefinition);
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        modelRateLimits: {
          ...(currentConfig.modelRateLimits ?? {}),
          [key]: nextDefinition,
        },
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields:
          JSON.stringify(currentConfig.modelRateLimits?.[key] ?? null) === JSON.stringify(nextDefinition)
            ? []
            : ["modelRateLimits"],
        summary: `Set modelRateLimits[${key}] to ${nextDefinition.maxRequests}/${nextDefinition.windowSeconds}s.`,
      });
    }

    case "tighten-endpoint-rate-limit": {
      const key = normalizeScopedKey("routePolicyPatch.endpointRateLimitKey", patchInput?.endpointRateLimitKey ?? null, {
        lowerCase: true,
      });
      const currentDefinition = currentConfig.endpointRateLimits?.[key] ?? null;
      const nextDefinition = normalizeRoutePolicyRateLimitDefinition(
        `routePolicyPatch.endpointRateLimit.${key}`,
        patchInput?.endpointRateLimit ?? null,
        currentDefinition,
      );
      if (!nextDefinition) {
        throw new Error("tighten-endpoint-rate-limit 需要显式提供 endpointRateLimit。");
      }
      ensureTightenedRateLimit(`endpointRateLimit.${key}`, currentDefinition, nextDefinition);
      const nextConfig: GatewayRoutePolicyConfig = {
        ...currentConfig,
        endpointRateLimits: {
          ...(currentConfig.endpointRateLimits ?? {}),
          [key]: nextDefinition,
        },
      };
      return buildRoutePolicyPatchResult({
        nextConfig,
        changedFields:
          JSON.stringify(currentConfig.endpointRateLimits?.[key] ?? null) === JSON.stringify(nextDefinition)
            ? []
            : ["endpointRateLimits"],
        summary: `Set endpointRateLimits[${key}] to ${nextDefinition.maxRequests}/${nextDefinition.windowSeconds}s.`,
      });
    }

    default:
      throw new Error(`当前 remediation actionKey=${action.actionKey} 不支持 route policy 自动执行。`);
  }
}
