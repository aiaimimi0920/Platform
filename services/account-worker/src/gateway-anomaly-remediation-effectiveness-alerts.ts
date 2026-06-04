import { createMailboxMessage } from "@neuro/account-domain";
import type { GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView } from "@neuro/contracts";

import { env } from "./env";
import {
  buildGatewayRemediationEffectivenessAnomalyMailboxRouteConfig,
  gatewayRemediationEffectivenessAnomalyMailboxRouteName,
} from "./gateway-anomaly-remediation-effectiveness-alert-routing";
import {
  buildGatewayRemediationEffectivenessAnomalyAlertPayload,
  buildGatewayRemediationEffectivenessAnomalyMailboxBody,
} from "./gateway-anomaly-remediation-effectiveness-alert-payload";
import { sendNotificationWebhook } from "./notification-webhook";
import {
  markNotificationWebhookRouteDelivered,
  shouldSendNotificationWebhookRoute,
} from "./notification-webhook-state";

export async function dispatchGatewayRemediationEffectivenessAnomalyAlerts(args: {
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;
  operatorUserIds: string[];
}) {
  let deliveredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const anomaly of args.snapshot.report.anomalies) {
    try {
      const recipients = Array.from(new Set(args.operatorUserIds.filter(Boolean)));
      let mailboxRecipientCount = 0;
      const referenceTime = new Date();
      const alertLevel = anomaly.severity === "critical" ? 3 : 2;
      const mailboxType = alertLevel >= 3 ? "compensation" : "system";
      const mailboxTitle =
        alertLevel >= 3
          ? "AI Gateway 治理效果异常需要紧急处理"
          : "AI Gateway 治理效果异常进入观察态";
      const mailboxBody = buildGatewayRemediationEffectivenessAnomalyMailboxBody({
        snapshot: args.snapshot,
        anomaly,
      });
      const webhookPayload = buildGatewayRemediationEffectivenessAnomalyAlertPayload({
        snapshot: args.snapshot,
        anomaly,
      });
      const incidentKey = [
        "gateway-remediation-effectiveness-anomaly",
        webhookPayload.alertLevel,
        webhookPayload.reasonCategory ?? "none",
        webhookPayload.profileKey ?? "none",
        webhookPayload.routePolicyId ?? "global",
        webhookPayload.snapshotId ?? "none",
        webhookPayload.reasonDisposition ?? "none",
      ].join(":");
      const mailboxRoute = buildGatewayRemediationEffectivenessAnomalyMailboxRouteConfig({
        cooldownMinutes: env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotMailboxCooldownMinutes,
        maxDeliveriesPerIncident:
          env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotMailboxMaxDeliveriesPerIncident,
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
            routeName: gatewayRemediationEffectivenessAnomalyMailboxRouteName,
            deliveredAt: referenceTime,
            format: mailboxRoute.format,
          });
        }
      }

      const webhookResult = await sendNotificationWebhook(
        "aiGateway.remediationEffectivenessAnomalyAlerted",
        webhookPayload,
      );
      const delivered = mailboxRecipientCount > 0 || webhookResult.sent;

      if (delivered) {
        deliveredCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      errorCount += 1;
      console.error(
        `[account-worker] gateway remediation effectiveness anomaly alert dispatch failed for snapshot ${args.snapshot.snapshotId}`,
        error,
      );
    }
  }

  return {
    attemptedCount: args.snapshot.report.anomalies.length,
    deliveredCount,
    skippedCount,
    errorCount,
  };
}
