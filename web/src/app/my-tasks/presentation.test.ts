import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { TaskView } from "@neuro/contracts";

import {
  countOpenCreatedTasks,
  getTaskRewardLabel,
  getTaskStatusLabel,
} from "./presentation";

function task(status: TaskView["status"], rewardAmount = 10): TaskView {
  return {
    id: `${status}-1`,
    title: "Launch checklist",
    description: "Prepare the release.",
    preferredCapabilityCodes: [],
    pricingMode: "flat_task",
    billingUnit: null,
    meterKey: null,
    meterQuantity: null,
    operationMode: "manual",
    rewardCurrency: "obsidian",
    rewardAmount,
    requiredBondAmount: 0,
    status,
    creatorUserId: "owner-a",
    assignedUserId: null,
    arbitrationCaseCount: 0,
    applicationCount: 0,
    createdAt: "2026-07-20T08:00:00.000Z",
  };
}

test("P2-05: task draft presentation is truthful and excluded from open-task counts", () => {
  const draft = task("draft", 0);
  const open = task("open", 15);
  const applying = task("applying", 20);

  assert.equal(getTaskStatusLabel(draft.status), "草稿");
  assert.equal(getTaskRewardLabel(draft), "待设置奖励");
  assert.equal(getTaskRewardLabel(open), "15 obsidian");
  assert.equal(countOpenCreatedTasks([draft, open, applying]), 2);
});

test("P2-05 RED: task deep links clear the sticky navigation and highlight their target", () => {
  const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  const globalStyles = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

  assert.match(pageSource, /app-task-deep-link-target/);
  assert.match(
    globalStyles,
    /\.app-task-deep-link-target\s*\{[^}]*scroll-margin-block-start:\s*\d+px;[^}]*\}/s,
  );
  assert.match(globalStyles, /\.app-task-deep-link-target:target/);
  const offsets = [...globalStyles.matchAll(
    /\.app-task-deep-link-target\s*\{[^}]*scroll-margin-block-start:\s*(\d+)px;[^}]*\}/gs,
  )].map((match) => Number(match[1]));
  assert.ok(offsets.length > 0 && offsets.every((offset) => offset >= 150));
});

test("P2-05: long task titles wrap before the status and reward column", () => {
  const themeStyles = readFileSync(new URL("../theme.css", import.meta.url), "utf8");

  assert.match(
    themeStyles,
    /\.mg-terminal-list__meta\s*\{[^}]*min-width:\s*0;[^}]*\}/s,
  );
  assert.match(
    themeStyles,
    /\.mg-terminal-list__title\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*\}/s,
  );
});
