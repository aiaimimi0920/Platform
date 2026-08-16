import type {
  AgentExecutionCallbackRemediationAlertDispatchResult,
  AgentExecutionCallbackRemediationAlertView,
  AgentExecutionCallbackType,
  AgentExecutionRuntimePressureAlertDispatchResult,
  AgentExecutionRuntimePressureAlertView,
} from "@neuro/contracts";
import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { env } from "@/env";
import { agents } from "@/modules/agent-registry/schema";
import { outboxEvents } from "@/platform/outbox/schema";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { getCallbackRemediationSummaryForOperator } from "./remediation";
import { getRuntimePressureAlertSummaryForOperator } from "./runtime-catalog";
import {
  CallbackRemediationAlertEmitQuery,
  RuntimePressureAlertEmitQuery,
  callbackRemediationAlertEventName,
  now,
  runtimePressureAlertEventName,
} from "./shared";

export function toCallbackRemediationAlertScopeValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "";
}

export async function hasRecentCallbackRemediationAlertEvent(args: {
  alert: AgentExecutionCallbackRemediationAlertView;
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  cooldownThreshold: Date;
}) {
  const [row] = await db
    .select({
      id: outboxEvents.id,
    })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventName, callbackRemediationAlertEventName),
        gte(outboxEvents.createdAt, args.cooldownThreshold),
        sql`coalesce(${outboxEvents.payload}->>'reasonCategory', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.reasonCategory,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'reasonDisposition', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.reasonDisposition,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'policyKey', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.policyKey,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'scopeAgentId', '') = ${toCallbackRemediationAlertScopeValue(
          args.agentId,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'scopeCallbackType', '') = ${toCallbackRemediationAlertScopeValue(
          args.callbackType,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'alertLevel', '') = ${String(args.alert.alertLevel)}`,
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function emitCallbackRemediationAlerts(
  args?: CallbackRemediationAlertEmitQuery,
): Promise<AgentExecutionCallbackRemediationAlertDispatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 20));
  const minimumAlertLevel = Math.max(
    1,
    Math.min(3, Math.floor(args?.minimumAlertLevel ?? env.agentExecutionCallbackAlertMinLevel)),
  );
  const summary = await getCallbackRemediationSummaryForOperator({
    agentId: args?.agentId,
    callbackType: args?.callbackType,
    remediationPolicyKey: args?.remediationPolicyKey,
    autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
    autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    replayPayloadCompatibility: args?.replayPayloadCompatibility,
    replayPayloadReplayable: args?.replayPayloadReplayable,
    decisionClass: args?.decisionClass,
    replayFailureClass: args?.replayFailureClass,
    runtimeDecisionClass: args?.runtimeDecisionClass,
    runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
    runtimePressureLevel: args?.runtimePressureLevel,
    runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
  });
  const alerts = summary.alerts.filter((alert) => alert.alertLevel >= minimumAlertLevel).slice(0, limit);
  const scopedAgent =
    args?.agentId && args.agentId.trim().length > 0
      ? await db.query.agents.findFirst({
          where: eq(agents.id, args.agentId.trim()),
          columns: {
            id: true,
            ownerUserId: true,
            name: true,
          },
        })
      : null;
  const cooldownThreshold = new Date(
    now().getTime() - env.agentExecutionCallbackAlertCooldownMinutes * 60 * 1000,
  );
  const dispatchedAlerts: AgentExecutionCallbackRemediationAlertDispatchResult["alerts"] = [];
  let dispatchedCount = 0;
  let skippedCount = 0;

  for (const alert of alerts) {
    const isDuplicate = await hasRecentCallbackRemediationAlertEvent({
      alert,
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      cooldownThreshold,
    });

    if (isDuplicate) {
      skippedCount += 1;
      dispatchedAlerts.push({
        ...alert,
        dispatched: false,
        skippedReason: "recent_duplicate",
      });
      continue;
    }

    await enqueueOutboxEvent(
      callbackRemediationAlertEventName,
      {
        alertLevel: alert.alertLevel,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        actionLabel: alert.actionLabel,
        reasonCategory: alert.reasonCategory,
        reasonDisposition: alert.reasonDisposition,
        policyKey: alert.policyKey,
        count: alert.count,
        candidateCount: summary.candidateCount,
        maxAlertLevel: summary.maxAlertLevel,
        agentOwnerUserId: scopedAgent?.ownerUserId ?? null,
        agentName: scopedAgent?.name ?? null,
        scopeAgentId: args?.agentId ?? null,
        scopeCallbackType: args?.callbackType ?? null,
      },
      db,
      "account",
    );
    dispatchedCount += 1;
    dispatchedAlerts.push({
      ...alert,
      dispatched: true,
      skippedReason: null,
    });
  }

  return {
    dispatchedCount,
    skippedCount,
    minimumAlertLevel,
    alerts: dispatchedAlerts,
  };
}

export async function hasRecentRuntimePressureAlertEvent(args: {
  alert: AgentExecutionRuntimePressureAlertView;
  cooldownThreshold: Date;
}) {
  const [row] = await db
    .select({
      id: outboxEvents.id,
    })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventName, runtimePressureAlertEventName),
        gte(outboxEvents.createdAt, args.cooldownThreshold),
        sql`coalesce(${outboxEvents.payload}->>'profileKey', '') = ${args.alert.profileKey}`,
        sql`coalesce(${outboxEvents.payload}->>'pressureLevel', '') = ${args.alert.pressureLevel}`,
        sql`coalesce(${outboxEvents.payload}->>'schedulingDecisionClass', '') = ${args.alert.schedulingDecisionClass}`,
        sql`coalesce(${outboxEvents.payload}->>'ownerUserId', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.busiestOwnerUserId,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'alertLevel', '') = ${String(args.alert.alertLevel)}`,
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function emitRuntimePressureAlerts(
  args?: RuntimePressureAlertEmitQuery,
): Promise<AgentExecutionRuntimePressureAlertDispatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 20));
  const minimumAlertLevel = Math.max(
    1,
    Math.min(3, Math.floor(args?.minimumAlertLevel ?? env.agentExecutionRuntimeAlertMinLevel)),
  );
  const summary = await getRuntimePressureAlertSummaryForOperator({
    pressureLevel: args?.pressureLevel,
    schedulingDecisionClass: args?.schedulingDecisionClass,
  });
  const alerts = summary.alerts.filter((alert) => alert.alertLevel >= minimumAlertLevel).slice(0, limit);
  const cooldownThreshold = new Date(
    now().getTime() - env.agentExecutionRuntimeAlertCooldownMinutes * 60 * 1000,
  );
  const dispatchedAlerts: AgentExecutionRuntimePressureAlertDispatchResult["alerts"] = [];
  let dispatchedCount = 0;
  let skippedCount = 0;

  for (const alert of alerts) {
    const isDuplicate = await hasRecentRuntimePressureAlertEvent({
      alert,
      cooldownThreshold,
    });

    if (isDuplicate) {
      skippedCount += 1;
      dispatchedAlerts.push({
        ...alert,
        dispatched: false,
        skippedReason: "recent_duplicate",
      });
      continue;
    }

    await enqueueOutboxEvent(
      runtimePressureAlertEventName,
      {
        alertLevel: alert.alertLevel,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        actionLabel: alert.actionLabel,
        profileKey: alert.profileKey,
        pressureLevel: alert.pressureLevel,
        schedulingDecisionClass: alert.schedulingDecisionClass,
        runningExecutionCount: alert.runningExecutionCount,
        queuedExecutionCount: alert.queuedExecutionCount,
        claimableQueuedExecutionCount: alert.claimableQueuedExecutionCount,
        blockedQueuedExecutionCount: alert.blockedQueuedExecutionCount,
        blockedByProfileCount: alert.blockedByProfileCount,
        blockedByOwnerCount: alert.blockedByOwnerCount,
        blockedOwnerCount: alert.blockedOwnerCount,
        availableExecutionSlots: alert.availableExecutionSlots,
        maxConcurrentExecutions: alert.maxConcurrentExecutions,
        maxConcurrentExecutionsPerOwner: alert.maxConcurrentExecutionsPerOwner,
        ownerUserId: alert.busiestOwnerUserId,
        busiestOwnerRunningCount: alert.busiestOwnerRunningCount,
        busiestBlockedOwnerUserId: alert.busiestBlockedOwnerUserId,
        busiestBlockedOwnerQueuedCount: alert.busiestBlockedOwnerQueuedCount,
        saturatedOwnerCount: alert.saturatedOwnerCount,
        profileCount: summary.profileCount,
        criticalProfileCount: summary.criticalProfileCount,
        watchProfileCount: summary.watchProfileCount,
        totalQueuedExecutionCount: summary.queuedExecutionCount,
        claimableQueuedExecutionCountTotal: summary.claimableQueuedExecutionCount,
        blockedQueuedExecutionCountTotal: summary.blockedQueuedExecutionCount,
        blockedByProfileCountTotal: summary.blockedByProfileCount,
        blockedByOwnerCountTotal: summary.blockedByOwnerCount,
        maxAlertLevel: summary.maxAlertLevel,
      },
      db,
      "account",
    );
    dispatchedCount += 1;
    dispatchedAlerts.push({
      ...alert,
      dispatched: true,
      skippedReason: null,
    });
  }

  return {
    dispatchedCount,
    skippedCount,
    minimumAlertLevel,
    alerts: dispatchedAlerts,
  };
}
