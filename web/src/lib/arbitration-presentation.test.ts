import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArbitrationsRedirect,
  formatArbitrationStatus,
  formatBucketList,
  formatCleanupRequestState,
  formatEvidenceKind,
  formatRemoteConfigState,
  formatReviewRoundStatus,
  formatTaskResolutionAction,
  readArbitrationsFollowUp,
  toLocaleDateTime,
} from "./arbitration-presentation";

test("buildArbitrationsRedirect defaults to the operator arbitrations route", () => {
  const href = buildArbitrationsRedirect({ status: "success", message: "done" });
  assert.equal(href.startsWith("/ops/account/arbitrations?"), true);
  const params = new URLSearchParams(href.split("?")[1]);
  assert.equal(params.get("status"), "success");
  assert.equal(params.get("message"), "done");
  assert.equal(params.get("caseId"), null);
});

test("buildArbitrationsRedirect only honors the owner route and keeps follow-up filters", () => {
  const ownerHref = buildArbitrationsRedirect({
    status: "error",
    message: "失败",
    caseId: "case-1",
    caseStatus: "under_review",
    assignment: "mine",
    routePath: "/my-arbitrations",
  });
  assert.equal(ownerHref.startsWith("/my-arbitrations?"), true);
  const ownerParams = new URLSearchParams(ownerHref.split("?")[1]);
  assert.equal(ownerParams.get("caseId"), "case-1");
  assert.equal(ownerParams.get("caseStatus"), "under_review");
  assert.equal(ownerParams.get("assignment"), "mine");

  const forgedHref = buildArbitrationsRedirect({
    status: "success",
    message: "ok",
    routePath: "/evil-route",
  });
  assert.equal(forgedHref.startsWith("/ops/account/arbitrations?"), true);
});

test("readArbitrationsFollowUp falls back from followUpCaseId to caseId and trims empties to null", () => {
  const formData = new FormData();
  formData.set("caseId", "case-9");
  formData.set("followUpCaseStatus", "  resolved  ");
  formData.set("followUpImpact", "   ");
  const followUp = readArbitrationsFollowUp(formData);
  assert.equal(followUp.caseId, "case-9");
  assert.equal(followUp.caseStatus, "resolved");
  assert.equal(followUp.impact, null);
  assert.equal(followUp.routePath, null);

  formData.set("followUpCaseId", "case-override");
  assert.equal(readArbitrationsFollowUp(formData).caseId, "case-override");
});

test("formatBucketList joins buckets with the key formatter and falls back on empty", () => {
  assert.equal(formatBucketList([]), "暂无");
  assert.equal(
    formatBucketList(
      [
        { key: "open", count: 2 },
        { key: "resolved", count: 1 },
      ],
      formatArbitrationStatus,
    ),
    "待受理 (2) / 已裁决 (1)",
  );
});

test("formatters return custom fallbacks for unknown enum values", () => {
  assert.equal(formatArbitrationStatus("open"), "待受理");
  assert.equal(formatArbitrationStatus("mystery"), "自定义状态");
  assert.equal(formatTaskResolutionAction("accept"), "裁定验收通过并放款");
  assert.equal(formatTaskResolutionAction("mystery"), "自定义裁定动作");
  assert.equal(formatEvidenceKind("text_note"), "文字说明");
  assert.equal(formatEvidenceKind("mystery"), "自定义证据类型");
  assert.equal(formatReviewRoundStatus("completed"), "已完成");
  assert.equal(formatReviewRoundStatus("mystery"), "自定义轮次状态");
});

test("nullable state formatters keep the read-only fallbacks", () => {
  assert.equal(toLocaleDateTime(null), "暂无");
  assert.equal(toLocaleDateTime(undefined), "暂无");
  assert.equal(formatCleanupRequestState(null), "继续保留");
  assert.equal(formatCleanupRequestState("2026-01-01T00:00:00Z"), "已请求清理");
  assert.equal(formatRemoteConfigState(true, "启用", "停用"), "启用");
  assert.equal(formatRemoteConfigState(false, "启用", "停用"), "停用");
});
