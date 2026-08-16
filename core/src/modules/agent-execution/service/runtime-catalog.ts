import type {
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimePressureAlertSummaryView,
  AgentExecutionRuntimeProfileKey,
} from "@neuro/contracts";

import { env } from "@/env";
import { buildRuntimeProfileUtilizationView } from "@/modules/agent-execution/runtime-scheduling";
import {
  buildRuntimePressureAlertBuckets,
  buildRuntimePressureAlerts,
} from "@/modules/agent-execution/operator-runtime-analysis";

import { buildSummaryBucketsFromValues } from "./callback-audit";
import {
  getRuntimeProfileUtilizationMap,
  toAgentExecutionPricingPolicyView,
  toAgentExecutionRevenueContractView,
  toRuntimeProfileView,
} from "./pricing";
import { RuntimePressureAlertSummaryQuery } from "./shared";

export async function getAgentExecutionRuntimeCatalog(): Promise<AgentExecutionRuntimeCatalogView> {
  const { runningCountByProfile, queuedCountByProfile, runningCountByProfileOwner, queuedCandidatesByProfile } =
    await getRuntimeProfileUtilizationMap();
  const runtimeProfiles = (Object.keys(env.agentExecutionRuntimeProfiles) as AgentExecutionRuntimeProfileKey[])
    .map((key) =>
      toRuntimeProfileView({
        runtimeProfileKey: key,
        targetArtifactCount: env.agentExecutionRuntimeProfiles[key].targetArtifactCount,
        maxAutoRecoveryCount: env.agentExecutionRuntimeProfiles[key].maxAutoRecoveryCount,
      }),
    )
    .sort((left, right) => left.key.localeCompare(right.key));
  const pricingPolicies = Object.entries(env.agentExecutionPricingPolicies)
    .map(([key, policy]) => toAgentExecutionPricingPolicyView(key, policy))
    .sort((left, right) => left.key.localeCompare(right.key));
  const revenueContracts = Object.entries(env.agentExecutionRevenueContracts)
    .map(([key, contract]) => toAgentExecutionRevenueContractView(key, contract))
    .sort((left, right) => left.key.localeCompare(right.key));
  const utilization = (Object.keys(env.agentExecutionRuntimeProfiles) as AgentExecutionRuntimeProfileKey[])
    .map((key) => {
      const maxConcurrentExecutions = env.agentExecutionRuntimeProfiles[key].maxConcurrentExecutions;
      const runningExecutionCount = runningCountByProfile.get(key) ?? 0;
      const queuedExecutionCount = queuedCountByProfile.get(key) ?? 0;
      const ownerRunningCounts = [...runningCountByProfileOwner.entries()]
        .filter(([compositeKey]) => compositeKey.startsWith(`${key}:`))
        .map(([compositeKey, count]) => ({
          ownerUserId: compositeKey.slice(key.length + 1),
          runningExecutionCount: count,
        }));
      return buildRuntimeProfileUtilizationView({
        key,
        maxConcurrentExecutions,
        maxConcurrentExecutionsPerOwner: env.agentExecutionRuntimeProfiles[key].maxConcurrentExecutionsPerOwner,
        runningExecutionCount,
        queuedExecutionCount,
        ownerRunningCounts,
        queuedCandidates: queuedCandidatesByProfile.get(key) ?? [],
      });
    })
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    runtimeProfiles,
    pricingPolicies,
    revenueContracts,
    utilization,
  };
}

export function filterRuntimeUtilizationForAlerts(
  utilization: AgentExecutionRuntimeCatalogView["utilization"],
  args?: RuntimePressureAlertSummaryQuery,
) {
  return utilization.filter((entry) => {
    if (args?.pressureLevel && entry.pressureLevel !== args.pressureLevel) {
      return false;
    }
    if (args?.schedulingDecisionClass && entry.schedulingDecisionClass !== args.schedulingDecisionClass) {
      return false;
    }
    return true;
  });
}

export async function getRuntimePressureAlertSummaryForOperator(
  args?: RuntimePressureAlertSummaryQuery,
): Promise<AgentExecutionRuntimePressureAlertSummaryView> {
  const runtimeCatalog = await getAgentExecutionRuntimeCatalog();
  const utilization = filterRuntimeUtilizationForAlerts(runtimeCatalog.utilization, args);
  const alerts = buildRuntimePressureAlerts(utilization);

  return {
    profileCount: utilization.length,
    queuedExecutionCount: utilization.reduce((sum, entry) => sum + entry.queuedExecutionCount, 0),
    claimableQueuedExecutionCount: utilization.reduce((sum, entry) => sum + entry.claimableQueuedExecutionCount, 0),
    blockedQueuedExecutionCount: utilization.reduce((sum, entry) => sum + entry.blockedQueuedExecutionCount, 0),
    blockedByProfileCount: utilization.reduce((sum, entry) => sum + entry.blockedByProfileCount, 0),
    blockedByOwnerCount: utilization.reduce((sum, entry) => sum + entry.blockedByOwnerCount, 0),
    blockedOwnerCount: utilization.reduce((sum, entry) => sum + entry.blockedOwnerCount, 0),
    criticalProfileCount: utilization.filter((entry) => entry.pressureLevel === "critical").length,
    watchProfileCount: utilization.filter((entry) => entry.pressureLevel === "watch").length,
    saturatedOwnerCount: utilization.reduce((sum, entry) => sum + entry.saturatedOwnerCount, 0),
    byPressureLevel: buildSummaryBucketsFromValues(utilization.map((entry) => entry.pressureLevel)),
    bySchedulingDecisionClass: buildSummaryBucketsFromValues(
      utilization.map((entry) => entry.schedulingDecisionClass),
    ),
    byAlertLevel: buildRuntimePressureAlertBuckets(utilization),
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    alerts,
  };
}
