import assert from "node:assert/strict";
import test from "node:test";

test("P3-03: owner arbitration actor labels never expose unrelated raw user ids", async () => {
  const presentation = await import("./presentation");
  const formatActor = (presentation as unknown as {
    formatOwnerSafeArbitrationActor?: (userId: string, args: {
      currentUserId: string;
      requesterUserId: string;
      respondentUserId: string;
    }) => string;
  }).formatOwnerSafeArbitrationActor;

  assert.equal(typeof formatActor, "function");
  if (!formatActor) return;

  const context = {
    currentUserId: "viewer",
    requesterUserId: "requester",
    respondentUserId: "respondent",
  };
  assert.equal(formatActor("viewer", context), "当前用户");
  assert.equal(formatActor("requester", context), "申请人");
  assert.equal(formatActor("respondent", context), "被申请人");
  assert.equal(formatActor("operator-42", context), "仲裁处理方");
});

test("P3-03: owner arbitration timeline titles never expose internal enum suffixes", async () => {
  const presentation = await import("./presentation");
  const formatTitle = (presentation as unknown as {
    formatOwnerSafeArbitrationTimelineTitle?: (kind: string) => string;
  }).formatOwnerSafeArbitrationTimelineTitle;

  assert.equal(typeof formatTitle, "function");
  if (!formatTitle) return;

  assert.equal(formatTitle("created"), "案件已创建");
  assert.equal(formatTitle("evidence"), "证据已补充");
  assert.equal(formatTitle("under_review"), "案件进入审理");
  assert.equal(formatTitle("effects_applied"), "裁决结果已生效");
  assert.equal(formatTitle("unknown_internal_value"), "案件状态已更新");
});
