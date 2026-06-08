import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("dashboard renders a real account terminal body instead of an empty shell", () => {
  assert.match(dashboardPageSource, /AccountCenterFrame/);
  assert.match(dashboardPageSource, /title="账户终端"/);
  assert.match(dashboardPageSource, /app-dashboard-stage/);
  assert.match(dashboardPageSource, /常用入口/);
});
