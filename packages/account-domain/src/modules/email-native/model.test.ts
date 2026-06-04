import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEmailNativeTaskInput,
  extractEmailNativeRoute,
  parseEmailNativeStructuredContent,
} from "./model";

test("extractEmailNativeRoute parses agent and task routes on the ingress domain", () => {
  assert.deepEqual(extractEmailNativeRoute("agent+agent_123@neuro.local", "neuro.local"), {
    kind: "agent_execution",
    agentId: "agent_123",
    rawLocalPart: "agent+agent_123",
  });

  assert.deepEqual(extractEmailNativeRoute("task+ops@neuro.local", "neuro.local"), {
    kind: "task_create",
    rawLocalPart: "task+ops",
  });

  assert.equal(extractEmailNativeRoute("task@other.local", "neuro.local"), null);
  assert.equal(extractEmailNativeRoute("agent+@neuro.local", "neuro.local"), null);
});

test("parseEmailNativeStructuredContent reads top metadata block and message content", () => {
  const parsed = parseEmailNativeStructuredContent([
    "title: 发起一个整理任务",
    "rewardCurrency: mira",
    "rewardAmount: 88",
    "---",
    "把最近收到的设计稿整理成可交付包。",
  ].join("\n"));

  assert.deepEqual(parsed.metadata, {
    title: "发起一个整理任务",
    rewardCurrency: "mira",
    rewardAmount: "88",
  });
  assert.equal(parsed.content, "把最近收到的设计稿整理成可交付包。");
});

test("buildEmailNativeTaskInput honors parsed metadata and falls back to defaults", () => {
  const task = buildEmailNativeTaskInput({
    subject: "邮件任务",
    textBody: [
      "title: 邮件接入任务",
      "rewardCurrency: mira",
      "rewardAmount: 64",
      "pricingMode: token_metered",
      "preferredCapabilityCodes: summarize,translate",
      "",
      "请把附件转换成双语摘要。",
    ].join("\n"),
    defaults: {
      rewardCurrency: "obsidian",
      rewardAmount: 20,
      requiredBondAmount: 5,
      pricingMode: "flat_task",
      operationMode: "manual",
    },
  });

  assert.equal(task.title, "邮件接入任务");
  assert.equal(task.description, "请把附件转换成双语摘要。");
  assert.equal(task.rewardCurrency, "mira");
  assert.equal(task.rewardAmount, 64);
  assert.equal(task.requiredBondAmount, 5);
  assert.equal(task.pricingMode, "token_metered");
  assert.deepEqual(task.preferredCapabilityCodes, ["summarize", "translate"]);
  assert.equal(task.operationMode, "manual");
});
