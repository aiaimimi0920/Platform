import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const featureDir = new URL("./", import.meta.url);
const centerSource = readFileSync(new URL("./account-honor-center.tsx", featureDir), "utf8");
const panelSource = readFileSync(new URL("./account-honor-panel.tsx", featureDir), "utf8");
const ownerIndexSource = readFileSync(new URL("./owner/index.ts", featureDir), "utf8");
const taglineEditorUrl = new URL("./owner/tagline-editor.tsx", featureDir);
const agentShowcaseConfigUrl = new URL("./owner/agent-showcase-config.tsx", featureDir);
const archiveShowcaseConfigUrl = new URL("./owner/archive-showcase-config.tsx", featureDir);

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

test("account honor archive showcase editing state lives in the owner layer", () => {
  assert.equal(existsSync(archiveShowcaseConfigUrl), true);

  const archiveShowcaseConfigSource = readFileSync(archiveShowcaseConfigUrl, "utf8");

  assert.match(panelSource, /from\s+["']\.\/owner\/archive-showcase-config["']/);
  assert.doesNotMatch(
    panelSource,
    /set(Project|Investment|Issue|InvestmentIssue)ConfigOpen|set(Project|Investment|Issue|InvestmentIssue)DraftIds|saving(Project|Investment|Issue|InvestmentIssue)Showcase/,
  );
  assert.doesNotMatch(
    panelSource,
    /honorShowcased(ProjectIds|IssueIds|InvestmentProjectIds|InvestmentIssueIds)/,
  );

  assert.match(archiveShowcaseConfigSource, /export function useArchiveShowcaseConfig/);
  assert.match(archiveShowcaseConfigSource, /honorShowcasedProjectIds/);
  assert.match(archiveShowcaseConfigSource, /honorShowcasedIssueIds/);
  assert.match(archiveShowcaseConfigSource, /honorShowcasedInvestmentProjectIds/);
  assert.match(archiveShowcaseConfigSource, /honorShowcasedInvestmentIssueIds/);
  assert.match(ownerIndexSource, /useArchiveShowcaseConfig/);
});

test("account honor owner saves reject stale responses and unmount updates", () => {
  const taglineEditorSource = readFileSync(taglineEditorUrl, "utf8");
  const agentShowcaseConfigSource = readFileSync(agentShowcaseConfigUrl, "utf8");
  const archiveShowcaseConfigSource = readFileSync(archiveShowcaseConfigUrl, "utf8");

  for (const source of [taglineEditorSource, agentShowcaseConfigSource, archiveShowcaseConfigSource]) {
    assert.match(source, /const mountedRef = useRef\(false\);/);
    assert.match(source, /const saveRequestIdRef = useRef\(0\);/);
    assert.match(source, /mountedRef\.current = false;\s*saveRequestIdRef\.current \+= 1;/);
  }

  assert.equal(
    taglineEditorSource.match(/!mountedRef\.current \|\| saveRequestIdRef\.current !== requestId/g)?.length,
    2,
  );
  assert.equal(
    agentShowcaseConfigSource.match(/!mountedRef\.current \|\| saveRequestIdRef\.current !== requestId/g)?.length,
    2,
  );
  assert.match(archiveShowcaseConfigSource, /function invalidateSaveRequests\(\)/);
  assert.equal(
    archiveShowcaseConfigSource.match(/!mountedRef\.current \|\| saveRequestIdRef\.current !== requestId/g)
      ?.length,
    8,
  );
  assert.equal(
    archiveShowcaseConfigSource.match(/mountedRef\.current && saveRequestIdRef\.current === requestId/g)
      ?.length,
    4,
  );
});
