import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const featureDir = new URL("./", import.meta.url);
const centerSource = readFileSync(new URL("./account-honor-center.tsx", featureDir), "utf8");
const panelSource = readFileSync(new URL("./account-honor-panel.tsx", featureDir), "utf8");
const ownerIndexSource = readFileSync(new URL("./owner/index.ts", featureDir), "utf8");
const taglineEditorUrl = new URL("./owner/tagline-editor.tsx", featureDir);
const agentShowcaseConfigUrl = new URL("./owner/agent-showcase-config.tsx", featureDir);

test("account honor tagline editing lives in the owner layer instead of the center shell", () => {
  assert.equal(existsSync(taglineEditorUrl), true);

  const taglineEditorSource = readFileSync(taglineEditorUrl, "utf8");

  assert.match(centerSource, /from\s+["']\.\/owner\/tagline-editor["']/);
  assert.doesNotMatch(centerSource, /fetch\(["']\/api\/account-honor\/profile["']/);
  assert.doesNotMatch(centerSource, /setEditingTagline|setSavingTagline|setTaglineError/);

  assert.match(taglineEditorSource, /export function AccountHonorTaglineEditor/);
  assert.match(taglineEditorSource, /fetch\(["']\/api\/account-honor\/profile["']/);
  assert.match(ownerIndexSource, /AccountHonorTaglineEditor/);
});

test("account honor agent showcase editing state lives in the owner layer", () => {
  assert.equal(existsSync(agentShowcaseConfigUrl), true);

  const agentShowcaseConfigSource = readFileSync(agentShowcaseConfigUrl, "utf8");

  assert.match(panelSource, /from\s+["']\.\/owner\/agent-showcase-config["']/);
  assert.doesNotMatch(panelSource, /setAgentConfigOpen|setAgentDraftIds|savingAgentShowcase|agentShowcaseError/);
  assert.doesNotMatch(panelSource, /honorShowcasedAgentIds/);
  assert.doesNotMatch(panelSource, /function selectShowcasedAgents/);

  assert.match(agentShowcaseConfigSource, /export function useAgentShowcaseConfig/);
  assert.match(agentShowcaseConfigSource, /honorShowcasedAgentIds/);
  assert.match(ownerIndexSource, /useAgentShowcaseConfig/);
});
