import type {
  GatewayRateLimitHotspotAnomalyCode,
  GatewayRateLimitHotspotAutoRemediationActionKey,
  GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile,
} from "@neuro/contracts";
import {
  gatewayRateLimitHotspotAnomalyCodes,
  gatewayRateLimitHotspotAutoRemediationActionKeys,
} from "@neuro/contracts";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

export type GatewayRoutePolicyRateLimitHotspotAutoRemediationProfileInput = {
  enabled?: boolean | null;
  intervalMinutes?: number | null;
  dryRunFirst?: boolean | null;
  requireAlertBeforeApply?: boolean | null;
  freezeOnProviderHealthDegrade?: boolean | null;
  maxApplyRunsPerIncident?: number | null;
  actionByCode?: Record<string, GatewayRateLimitHotspotAutoRemediationActionKey | null> | null;
};

const hotspotActionSet = new Set<string>(gatewayRateLimitHotspotAutoRemediationActionKeys);
const hotspotCodeSet = new Set<string>(gatewayRateLimitHotspotAnomalyCodes);

function normalizePositiveIntField(
  label: string,
  value: number | null | undefined,
  fallback: number | null,
  maxValue: number,
) {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ConflictError(`${label} 必须是正整数。`);
  }
  if (value > maxValue) {
    throw new ConflictError(`${label} 不能超过 ${maxValue}。`);
  }
  return value;
}

function defaultActionByCode(): Record<
  GatewayRateLimitHotspotAnomalyCode,
  GatewayRateLimitHotspotAutoRemediationActionKey | null
> {
  return {
    rate_limit_request_spike: "tighten-project-rate-limit",
    rate_limit_code_concentration: "tighten-project-rate-limit",
    rate_limit_project_hotspot: "tighten-project-rate-limit",
    rate_limit_api_key_hotspot: "tighten-api-key-rate-limit",
    rate_limit_model_hotspot: "tighten-model-rate-limit",
    rate_limit_endpoint_hotspot: "tighten-endpoint-rate-limit",
  };
}

function normalizeActionByCode(
  value: Record<string, GatewayRateLimitHotspotAutoRemediationActionKey | null> | null | undefined,
  fallback:
    | Partial<Record<GatewayRateLimitHotspotAnomalyCode, GatewayRateLimitHotspotAutoRemediationActionKey | null>>
    | null
    | undefined,
) {
  const base = {
    ...defaultActionByCode(),
    ...(fallback ?? {}),
  } as Partial<Record<GatewayRateLimitHotspotAnomalyCode, GatewayRateLimitHotspotAutoRemediationActionKey | null>>;

  if (!value || Object.keys(value).length === 0) {
    return base;
  }

  for (const [rawCode, rawAction] of Object.entries(value)) {
    const code = rawCode.trim();
    if (!hotspotCodeSet.has(code)) {
      throw new ConflictError(`rateLimitHotspotAutoRemediation.actionByCode.${rawCode} 不是支持的 hotspot code。`);
    }
    if (rawAction == null) {
      base[code as GatewayRateLimitHotspotAnomalyCode] = null;
      continue;
    }
    if (!hotspotActionSet.has(rawAction)) {
      throw new ConflictError(
        `rateLimitHotspotAutoRemediation.actionByCode.${rawCode} 不是支持的 remediation action。`,
      );
    }
    base[code as GatewayRateLimitHotspotAnomalyCode] = rawAction;
  }

  return base;
}

export function normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile(
  value: GatewayRoutePolicyRateLimitHotspotAutoRemediationProfileInput | null | undefined,
  fallback: GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile | null,
) {
  if (value == null) {
    return fallback;
  }

  return {
    enabled: value.enabled !== false,
    intervalMinutes: normalizePositiveIntField(
      "rateLimitHotspotAutoRemediation.intervalMinutes",
      value.intervalMinutes ?? null,
      fallback?.intervalMinutes ?? 180,
      10_080,
    ),
    dryRunFirst: value.dryRunFirst !== false,
    requireAlertBeforeApply: value.requireAlertBeforeApply !== false,
    freezeOnProviderHealthDegrade: value.freezeOnProviderHealthDegrade !== false,
    maxApplyRunsPerIncident: normalizePositiveIntField(
      "rateLimitHotspotAutoRemediation.maxApplyRunsPerIncident",
      value.maxApplyRunsPerIncident ?? null,
      fallback?.maxApplyRunsPerIncident ?? 1,
      100,
    ),
    actionByCode: normalizeActionByCode(value.actionByCode ?? null, fallback?.actionByCode ?? null),
  } satisfies GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile;
}

export function resolveRoutePolicyRateLimitHotspotAutoRemediationActionKeys(
  profile: GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile | null | undefined,
  code: GatewayRateLimitHotspotAnomalyCode | string | null | undefined,
) {
  if (!profile) {
    return [] as GatewayRateLimitHotspotAutoRemediationActionKey[];
  }
  const normalizedCode = code?.trim() ?? "";
  if (!hotspotCodeSet.has(normalizedCode)) {
    return [] as GatewayRateLimitHotspotAutoRemediationActionKey[];
  }
  const actionKey = profile.actionByCode?.[normalizedCode as GatewayRateLimitHotspotAnomalyCode] ?? null;
  return actionKey ? [actionKey] : ([] as GatewayRateLimitHotspotAutoRemediationActionKey[]);
}
