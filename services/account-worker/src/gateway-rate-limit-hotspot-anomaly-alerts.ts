import { createMailboxMessage } from "@neuro/account-domain";
import type {
  GatewayAnalysisAnomalyAlertDeliverySeverity,
  GatewayRateLimitHotspotAnomalyCode,
  GatewayRateLimitHotspotAnomalySnapshotView,
} from "@neuro/contracts";

import { env } from "./env";
import {
  buildGatewayRateLimitHotspotAnomalyMailboxRouteConfig,
  gatewayRateLimitHotspotAnomalyMailboxRouteName,
} from "./gateway-rate-limit-hotspot-anomaly-alert-routing";
import {
  buildGatewayRateLimitHotspotAnomalyAlertPayload,
  buildGatewayRateLimitHotspotAnomalyMailboxBody,
} from "./gateway-rate-limit-hotspot-anomaly-alert-payload";
import { sendNotificationWebhook } from "./notification-webhook";
import {
  markNotificationWebhookRouteDelivered,
  shouldSendNotificationWebhookRoute,
} from "./notification-webhook-state";

export async function dispatchGatewayRateLimitHotspotAnomalyAlerts(args: {
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView;
  operatorUserIds: string[];
}) {
  let deliveredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const results: Array<{
    code: GatewayRateLimitHotspotAnomalyCode;
    delivered: boolean;
    skipped: boolean;
    error: boolean;
    alertLevel: number;
    alertSeverity: GatewayAnalysisAnomalyAlertDeliverySeverity;
  }> = [];

  for (const anomaly of args.snapshot.report.anomalies) {
    const alertPayload = buildGatewayRateLimitHotspotAnomalyAlertPayload({
      snapshot: args.snapshot,
      anomaly,
    });
    const alertLevel = Number(alertPayload.alertLevel ?? 0);
    const alertSeverity = (alertPayload.severity ?? "warning") as GatewayAnalysisAnomalyAlertDeliverySeverity;
    try {
      const recipients = Array.from(new Set(args.operatorUserIds.filter(Boolean)));
      let mailboxRecipientCount = 0;
      const referenceTime = new Date();
      const mailboxType = alertLevel >= 3 ? "compensation" : "system";
      const mailboxTitle =
        alertLevel >= 3
          ? "AI Gateway 限流热点异常需要紧急处理"
          : "AI Gateway 限流热点异常进入观察态";
      const mailboxBody = buildGatewayRateLimitHotspotAnomalyMailboxBody({
        snapshot: args.snapshot,
        anomaly,
      });
      const incidentKey = [
        "gateway-rate-limit-hotspot-anomaly",
        alertPayload.alertLevel,
        alertPayload.reasonCategory ?? "none",
        alertPayload.profileKey ?? "none",
        alertPayload.routePolicyId ?? "global",
        alertPayload.projectId ?? "global",
        alertPayload.snapshotId ?? "none",
      ].join(":");
      const mailboxRoute = buildGatewayRateLimitHotspotAnomalyMailboxRouteConfig({
        cooldownMinutes: env.gatewayRateLimitHotspotAnomalySnapshotMailboxCooldownMinutes,
        maxDeliveriesPerIncident: env.gatewayRateLimitHotspotAnomalySnapshotMailboxMaxDeliveriesPerIncident,
      });
      const mailboxPolicy = await shouldSendNotificationWebhookRoute({
        incidentKey,
        route: mailboxRoute,
        referenceTime,
      });

      if (mailboxPolicy.allowed) {
        for (const operatorUserId of recipients) {
          await createMailboxMessage({
            userId: operatorUserId,
            title: mailboxTitle,
            body: mailboxBody,
            type: mailboxType,
            sourceLabel: "AI Gateway Governance",
          });
          mailboxRecipientCount += 1;
        }
        if (mailboxRecipientCount > 0) {
          await markNotificationWebhookRouteDelivered({
            incidentKey,
            routeName: gatewayRateLimitHotspotAnomalyMailboxRouteName,
            deliveredAt: referenceTime,
            format: mailboxRoute.format,
          });
        }
      }

      const webhookResult = await sendNotificationWebhook(
        "aiGateway.rateLimitHotspotAnomalyAlerted",
        alertPayload,
      );
      const delivered = mailboxRecipientCount > 0 || webhookResult.sent;

      if (delivered) {
        deliveredCount += 1;
        results.push({
          code: anomaly.code,
          delivered: true,
          skipped: false,
          error: false,
          alertLevel,
          alertSeverity,
        });
      } else {
        skippedCount += 1;
        results.push({
          code: anomaly.code,
          delivered: false,
          skipped: true,
          error: false,
          alertLevel,
          alertSeverity,
        });
      }
    } catch (error) {
      errorCount += 1;
      results.push({
        code: anomaly.code,
        delivered: false,
        skipped: false,
        error: true,
        alertLevel,
        alertSeverity,
      });
      console.error(
        `[account-worker] gateway rate-limit hotspot anomaly alert dispatch failed for snapshot ${args.snapshot.snapshotId}`,
        error,
      );
    }
  }

  return {
    attemptedCount: args.snapshot.report.anomalies.length,
    deliveredCount,
    skippedCount,
    errorCount,
    results,
  };
}
