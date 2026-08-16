import type { GatewayAnalysisAnomalyAlertDeliverySeverity } from "@neuro/contracts";

export function normalizeGatewayAnalysisAnomalyAlertDeliverySeverity(
  value: GatewayAnalysisAnomalyAlertDeliverySeverity | string | null | undefined,
): GatewayAnalysisAnomalyAlertDeliverySeverity | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "info" || normalized === "warning" || normalized === "danger") {
    return normalized;
  }
  return null;
}
