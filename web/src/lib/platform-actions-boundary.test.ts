import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const libDir = join(process.cwd(), "src", "lib");

const commerceActionNames = [
  "submitOrderAction",
  "upsertOperatorProductAction",
  "deleteOperatorProductAction",
  "upsertOperatorDiscountCodeAction",
  "applyOperatorDiscountCodeBatchAction",
  "importOperatorDiscountCodesCsvAction",
  "previewOperatorDiscountCodesCsvAction",
  "createListingAction",
  "purchaseListingAction",
] as const;

const opinionActionNames = [
  "createOpinionTopicAction",
  "supportOpinionTopicAction",
  "opposeOpinionTopicAction",
  "archiveOpinionTopicAction",
  "adoptOpinionTopicAction",
  "createOpinionTopicCommentAction",
  "updateOpinionHubSettingsAction",
  "moderateOpinionTopicAction",
  "runOpinionMonthlyLeaderSettlementAction",
  "updateOpinionMonthlySettlementItemDecisionAction",
  "batchExcludeOpinionMonthlySettlementItemsAction",
  "batchRestoreOpinionMonthlySettlementItemsAction",
] as const;

const taskActionNames = [
  "createTaskAction",
  "applyTaskAction",
  "dispatchTaskAction",
  "createTaskAgentProposalAction",
  "acceptTaskAgentProposalAction",
  "rejectTaskAgentProposalAction",
  "updateDevelopmentQueueStatusAction",
  "taskLifecycleAction",
] as const;

const accountEconomyActionNames = [
  "redeemCodeAction",
  "claimMailboxAttachmentAction",
  "claimMissionAction",
  "exchangeObsidianToMiraAction",
] as const;

const fulfillmentActionNames = [
  "reportItemUnitIssueAction",
  "reconcileItemAction",
  "resolveItemManualReviewAction",
  "claimItemManualReviewAction",
  "releaseItemManualReviewAction",
  "triggerManualReviewAutoRebalanceAction",
  "triggerManualReviewAutoAssignSlaAction",
  "releaseStaleItemManualReviewsAction",
  "claimNextManualReviewAction",
  "escalateFulfillmentAnomaliesAction",
  "assignBalancedManualReviewAction",
  "rebalanceManualReviewQueueAction",
  "assignManualReviewAction",
] as const;

const outboxActionNames = [
  "retryOutboxEventAction",
  "retryOutboxEventsBatchAction",
  "emitOutboxAlertsAction",
] as const;

const agentMarketplaceActionNames = [
  "upsertAgentMarketplaceListingAction",
  "updateAgentMarketplaceListingStatusAction",
  "runAgentMarketplaceAutoProposalSweepAction",
  "invokeAgentMarketplaceListingAction",
  "invokeAgentMarketplaceListingBatchAction",
] as const;

const agentCallbackActionNames = [
  "updateAgentCallbackRemediationPolicyAction",
  "rotateAgentCallbackSecretAction",
  "updateAgentCallbackProtocolVersionAction",
] as const;

const ownerReliefActionNames = [
  "saveAgentExecutionOwnerReliefHandoffDefaultAction",
  "clearAgentExecutionOwnerReliefHandoffDefaultAction",
  "openAgentExecutionOwnerReliefRunHandoffAction",
  "resolveAgentExecutionOwnerReliefHandoffAction",
] as const;

function assertServerActionBoundary(args: {
  platformActions: string;
  domainActions: string;
  domainModule: string;
  actionNames: readonly string[];
}) {
  assert.match(args.domainActions, /^"use server";/);

  for (const actionName of args.actionNames) {
    const implementationName = `${actionName}Impl`;
    assert.match(
      args.domainActions,
      new RegExp(`export async function ${actionName}\\(`),
      `${actionName} should be implemented in ${args.domainModule}`,
    );
    assert.match(
      args.platformActions,
      new RegExp(`${actionName} as ${implementationName}`),
      `${actionName} should be imported as a compatibility wrapper implementation`,
    );
    assert.match(
      args.platformActions,
      new RegExp(`export async function ${actionName}\\(formData: FormData\\) \\{\\s+return ${implementationName}\\(formData\\);\\s+\\}`),
      `${actionName} should only delegate from the platform-actions compatibility layer`,
    );
  }

  assert.match(args.platformActions, new RegExp(`from "@\\/lib\\/${args.domainModule.replace(".ts", "")}"`));
}

describe("platform action module boundaries", () => {
  it("keeps commerce/product/discount actions in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const commerceActions = readFileSync(join(libDir, "platform-commerce-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: commerceActions,
      domainModule: "platform-commerce-actions.ts",
      actionNames: commerceActionNames,
    });
  });

  it("keeps opinion actions in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const opinionActions = readFileSync(join(libDir, "platform-opinion-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: opinionActions,
      domainModule: "platform-opinion-actions.ts",
      actionNames: opinionActionNames,
    });
  });

  it("keeps task and development queue actions in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const taskActions = readFileSync(join(libDir, "platform-task-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: taskActions,
      domainModule: "platform-task-actions.ts",
      actionNames: taskActionNames,
    });
  });

  it("keeps account economy actions in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const accountEconomyActions = readFileSync(join(libDir, "platform-account-economy-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: accountEconomyActions,
      domainModule: "platform-account-economy-actions.ts",
      actionNames: accountEconomyActionNames,
    });
  });

  it("keeps fulfillment and manual review actions in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const fulfillmentActions = readFileSync(join(libDir, "platform-fulfillment-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: fulfillmentActions,
      domainModule: "platform-fulfillment-actions.ts",
      actionNames: fulfillmentActionNames,
    });
  });

  it("keeps outbox operations in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const outboxActions = readFileSync(join(libDir, "platform-outbox-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: outboxActions,
      domainModule: "platform-outbox-actions.ts",
      actionNames: outboxActionNames,
    });
  });

  it("keeps agent marketplace operations in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const agentMarketplaceActions = readFileSync(join(libDir, "platform-agent-marketplace-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: agentMarketplaceActions,
      domainModule: "platform-agent-marketplace-actions.ts",
      actionNames: agentMarketplaceActionNames,
    });
  });

  it("keeps agent callback settings operations in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const agentCallbackActions = readFileSync(join(libDir, "platform-agent-callback-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: agentCallbackActions,
      domainModule: "platform-agent-callback-actions.ts",
      actionNames: agentCallbackActionNames,
    });
  });

  it("keeps owner relief handoff operations in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const ownerReliefActions = readFileSync(join(libDir, "platform-owner-relief-actions.ts"), "utf8");

    assertServerActionBoundary({
      platformActions,
      domainActions: ownerReliefActions,
      domainModule: "platform-owner-relief-actions.ts",
      actionNames: ownerReliefActionNames,
    });
  });
});
