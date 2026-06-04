import { createMailboxMessage } from "@neuro/account-domain";
import {
  listGatewayAnalysisAnomalyIncidentAlertQueueForOperator,
  recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator,
} from "@neuro/ai-gateway-domain";

import { buildGatewayAnomalyIncidentAlertPayload, buildGatewayAnomalyIncidentMailboxBody } from "./gateway-anomaly-alert-payload";
import { sendNotificationWebhook } from "./notification-webhook";

export async function dispatchGatewayAnomalyIncidentAlerts(args: {
  actorUserId: string;
  operatorUserIds: string[];
  limit: number;
}) {
  const queue = await listGatewayAnalysisAnomalyIncidentAlertQueueForOperator(args.actorUserId, null, {
    dueOnly: true,
    limit: args.limit,
  });

  let deliveredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of queue.items) {
    const alertTimestamp = new Date();
    try {
      const operatorRecipients = item.notifyOperators ? Array.from(new Set(args.operatorUserIds.filter(Boolean))) : [];
      let mailboxRecipientCount = 0;
      const mailboxType = item.alertLevel >= 3 ? "compensation" : "system";
      const operatorTitle = item.alertLevel >= 3 ? "AI Gateway 异常需要紧急处理" : "AI Gateway 异常进入观察态";
      const mailboxBody = buildGatewayAnomalyIncidentMailboxBody(item);

      for (const operatorUserId of operatorRecipients) {
        await createMailboxMessage({
          userId: operatorUserId,
          title: operatorTitle,
          body: mailboxBody,
          type: mailboxType,
          sourceLabel: "AI Gateway Governance",
        });
        mailboxRecipientCount += 1;
      }

      if (
        item.notifyOwner &&
        item.incident.ownerUserId &&
        !operatorRecipients.includes(item.incident.ownerUserId)
      ) {
        await createMailboxMessage({
          userId: item.incident.ownerUserId,
          title: "你的 AI Gateway 项目需要关注",
          body: mailboxBody,
          type: "system",
          sourceLabel: "AI Gateway Governance",
        });
        mailboxRecipientCount += 1;
      }

      const webhookPayload = buildGatewayAnomalyIncidentAlertPayload(item);
      const webhookResult = await sendNotificationWebhook("aiGateway.anomalyIncidentAlerted", webhookPayload);
      const delivered = mailboxRecipientCount > 0 || webhookResult.sent;

      await recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator(
        args.actorUserId,
        null,
        item.incident.id,
        {
          alertedAt: alertTimestamp,
          alertSeverity: item.webhookSeverity,
          alertLevel: item.alertLevel,
          note: delivered
            ? "Gateway anomaly alert dispatched."
            : "Gateway anomaly alert attempted but no delivery channel accepted it.",
          mailboxRecipientCount,
          webhookDispatched: webhookResult.sent,
          webhookSkippedReason: webhookResult.skippedReason,
          remediationActionKeys: item.remediationActionKeys,
        },
      );

      if (delivered) {
        deliveredCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      errorCount += 1;
      console.error(`[account-worker] gateway anomaly alert dispatch failed for incident ${item.incident.id}`, error);
    }
  }

  return {
    queueGeneratedAt: queue.generatedAt,
    attemptedCount: queue.items.length,
    deliveredCount,
    skippedCount,
    errorCount,
  };
}
