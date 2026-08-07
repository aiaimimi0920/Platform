import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function findPlatformRoot(startDir: string) {
  let current = resolve(startDir);
  for (;;) {
    if (
      existsSync(resolve(current, "package.json")) &&
      existsSync(resolve(current, "web", "package.json"))
    ) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) {
      throw new Error(`Unable to locate Platform repo root from ${startDir}`);
    }
    current = parent;
  }
}

const platformRoot = findPlatformRoot(process.cwd());
const settingsPagePath = resolve(platformRoot, "web", "src", "app", "tea", "settings", "page.tsx");
const settingsPageExists = existsSync(settingsPagePath);
const settingsPageSource = settingsPageExists ? readFileSync(settingsPagePath, "utf8") : "";

test("Tea settings page exposes all v1 local configuration fields as editable controls", () => {
  assert.equal(settingsPageExists, true, "expected Platform Web Tea settings page to exist");
  assert.match(settingsPageSource, /name="notifications_enabled"/);
  assert.match(settingsPageSource, /name="human_ticket_default_approval_policy"/);
  assert.match(settingsPageSource, /name="hook_ticket_default_approval_policy"/);
  assert.doesNotMatch(settingsPageSource, /name="human_ticket_default_approval_policy"\s+type="hidden"/s);
  assert.doesNotMatch(settingsPageSource, /name="hook_ticket_default_approval_policy"\s+type="hidden"/s);
  assert.match(settingsPageSource, /id="human_ticket_default_approval_policy"/);
  assert.match(settingsPageSource, /id="hook_ticket_default_approval_policy"/);
});

test("Tea settings page keeps Loom-managed configuration read-only with a Loom jump target", () => {
  assert.equal(settingsPageExists, true, "expected Platform Web Tea settings page to exist");
  assert.match(settingsPageSource, /source === "loom-managed"/);
  assert.match(settingsPageSource, /在 Loom 中配置 Tea/);
  assert.match(settingsPageSource, /updateTeaConfigurationAction/);
});
