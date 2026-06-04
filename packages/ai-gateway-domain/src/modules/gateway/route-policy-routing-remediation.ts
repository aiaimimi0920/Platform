import type {
  GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile,
  GatewayRoutingAnomalyAutoRemediationActionKey,
  GatewayRoutingAnomalyAutoRemediationCode,
} from "@neuro/contracts";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

export type GatewayRoutePolicyRoutingAnomalyAutoRemediationProfileInput = {
  enabled?: boolean | null;
  intervalMinutes?: number | null;
  dryRunFirst?: boolean | null;
  requireAlertBeforeApply?: boolean | null;
  freezeOnProviderHealthDegrade?: boolean | null;
  maxApplyRunsPerIncident?: number | null;
  actionKeysByCode?: Record<string, GatewayRoutingAnomalyAutoRemediationActionKey[] | null> | null;
};

const routingActionKeys = [
  "disable-prestream-fallback",
  "reduce-provider-concurrency",
  "provider-isolation",
] as const satisfies readonly GatewayRoutingAnomalyAutoRemediationActionKey[];

const routingCodes = [
  "failure_rate_spike",
  "completion_rate_drop",
  "provider_routing_score_drop",
  "degraded_provider_route_spike",
  "saturated_provider_route_spike",
  "breaker_open_provider_route_detected",
] as const satisfies readonly GatewayRoutingAnomalyAutoRemediationCode[];

const routingActionSet = new Set<string>(routingActionKeys);
const routingCodeSet = new Set<string>(routingCodes);

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

function normalizeActionList(
  label: string,
  value: GatewayRoutingAnomalyAutoRemediationActionKey[] | null | undefined,
) {
  if (value == null) {
    return null;
  }
  const normalized = Array.from(
    new Set(
      value
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  );
  for (const actionKey of normalized) {
    if (!routingActionSet.has(actionKey)) {
      throw new ConflictError(`${label}.${actionKey} 不是支持的 routing remediation action。`);
    }
  }
  return normalized.length > 0 ? (normalized as GatewayRoutingAnomalyAutoRemediationActionKey[]) : null;
}

function defaultActionKeysByCode(): Record<
  GatewayRoutingAnomalyAutoRemediationCode,
  GatewayRoutingAnomalyAutoRemediationActionKey[] | null
> {
  return {
    failure_rate_spike: [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ],
    completion_rate_drop: [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ],
    provider_routing_score_drop: [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ],
    degraded_provider_route_spike: [
      "reduce-provider-concurrency",
      "provider-isolation",
      "disable-prestream-fallback",
    ],
    saturated_provider_route_spike: ["reduce-provider-concurrency"],
    breaker_open_provider_route_detected: [
      "provider-isolation",
      "disable-prestream-fallback",
    ],
  };
}

function normalizeActionKeysByCode(
  value: Record<string, GatewayRoutingAnomalyAutoRemediationActionKey[] | null> | null | undefined,
  fallback:
    | Partial<Record<GatewayRoutingAnomalyAutoRemediationCode, GatewayRoutingAnomalyAutoRemediationActionKey[] | null>>
    | null
    | undefined,
) {
  const base = {
    ...defaultActionKeysByCode(),
    ...(fallback ?? {}),
  } as Partial<Record<GatewayRoutingAnomalyAutoRemediationCode, GatewayRoutingAnomalyAutoRemediationActionKey[] | null>>;

  if (!value || Object.keys(value).length === 0) {
    return base;
  }

  for (const [rawCode, rawActionKeys] of Object.entries(value)) {
    const code = rawCode.trim();
    if (!routingCodeSet.has(code)) {
      throw new ConflictError(`routingAnomalyAutoRemediation.actionKeysByCode.${rawCode} 不是支持的 routing anomaly code。`);
    }
    base[code as GatewayRoutingAnomalyAutoRemediationCode] = normalizeActionList(
      `routingAnomalyAutoRemediation.actionKeysByCode.${code}`,
      rawActionKeys,
    );
  }

  return base;
}

export function normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile(
  value: GatewayRoutePolicyRoutingAnomalyAutoRemediationProfileInput | null | undefined,
  fallback: GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile | null,
) {
  if (value == null) {
    return fallback;
  }

  return {
    enabled: value.enabled !== false,
    intervalMinutes: normalizePositiveIntField(
      "routingAnomalyAutoRemediation.intervalMinutes",
      value.intervalMinutes ?? null,
      fallback?.intervalMinutes ?? 180,
      10_080,
    ),
    dryRunFirst: value.dryRunFirst !== false,
    requireAlertBeforeApply: value.requireAlertBeforeApply !== false,
    freezeOnProviderHealthDegrade: value.freezeOnProviderHealthDegrade !== false,
    maxApplyRunsPerIncident: normalizePositiveIntField(
      "routingAnomalyAutoRemediation.maxApplyRunsPerIncident",
      value.maxApplyRunsPerIncident ?? null,
      fallback?.maxApplyRunsPerIncident ?? 1,
      100,
    ),
    actionKeysByCode: normalizeActionKeysByCode(value.actionKeysByCode ?? null, fallback?.actionKeysByCode ?? null),
  } satisfies GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile;
}

export function resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys(
  profile: GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile | null | undefined,
  code: GatewayRoutingAnomalyAutoRemediationCode | string | null | undefined,
) {
  if (!profile) {
    return [] as GatewayRoutingAnomalyAutoRemediationActionKey[];
  }
  const normalizedCode = code?.trim() ?? "";
  if (!routingCodeSet.has(normalizedCode)) {
    return [] as GatewayRoutingAnomalyAutoRemediationActionKey[];
  }
  return (
    profile.actionKeysByCode?.[normalizedCode as GatewayRoutingAnomalyAutoRemediationCode] ?? []
  ) as GatewayRoutingAnomalyAutoRemediationActionKey[];
}
