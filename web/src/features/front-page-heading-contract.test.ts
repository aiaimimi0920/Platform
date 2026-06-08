import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const agentCenterSource = readFileSync(new URL("./account-agent-center/agent-center-page.tsx", import.meta.url), "utf8");
const opinionCenterSource = readFileSync(new URL("./account-opinion-center/opinion-center-page.tsx", import.meta.url), "utf8");

test("agent center exposes its visible page title as an h1", () => {
  assert.match(agentCenterSource, /<h1\b[^>]*>智能体<\/h1>/);
});

test("opinion center exposes its visible page title as an h1", () => {
  assert.match(opinionCenterSource, /<h1\b[^>]*>议题<\/h1>/);
});
