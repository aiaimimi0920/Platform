import type {
  GatewayAnalysisAnomalyAlertDeliverySeverity,
  GatewayAnalysisExportAnomalySeverity,
} from "@neuro/contracts";

export const defaultGatewayAnalysisAnomalyAlertIntervalMinutes = 180;

export function resolveGatewayAnalysisAnomalyIncidentAlertSchedule(args: {
  status: string;
  escalationStatus: string;
  alertingEnabled: boolean;
  alertIntervalMinutes: number | null;
  lastAlertAttemptAt: string | null;
  now?: Date;
}) {
  if (
    !args.alertingEnabled ||
    args.escalationStatus !== "escalated" ||
    (args.status !== "open" && args.status !== "acknowledged")
  ) {
    return {
      nextAlertDueAt: null,
      alertDue: false,
    };
  }

  const intervalMinutes = args.alertIntervalMinutes ?? defaultGatewayAnalysisAnomalyAlertIntervalMinutes;
  const referenceTime = args.lastAlertAttemptAt ? new Date(args.lastAlertAttemptAt) : null;
  if (referenceTime && Number.isFinite(referenceTime.getTime())) {
    const nextAlertDueAtDate = new Date(referenceTime.getTime() + intervalMinutes * 60_000);
    const now = args.now ?? new Date();
    return {
      nextAlertDueAt: nextAlertDueAtDate.toISOString(),
      alertDue: nextAlertDueAtDate.getTime() <= now.getTime(),
    };
  }

  return {
    nextAlertDueAt: null,
    alertDue: true,
  };
}

export function resolveGatewayAnalysisAnomalyAlertDeliveryProfile(
  severity: GatewayAnalysisExportAnomalySeverity,
): {
  alertLevel: number;
  webhookSeverity: GatewayAnalysisAnomalyAlertDeliverySeverity;
} {
  if (severity === "critical") {
    return {
      alertLevel: 3,
      webhookSeverity: "danger",
    };
  }

  return {
    alertLevel: 2,
    webhookSeverity: "warning",
  };
}
