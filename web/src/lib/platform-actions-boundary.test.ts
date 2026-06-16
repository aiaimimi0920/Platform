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
});
