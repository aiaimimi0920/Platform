import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(process.cwd(), "..");
const harnessPath = resolve(repoRoot, "scripts", "smoke-platform-web-tea-ui-real.ps1");
const nextConfigPath = resolve(repoRoot, "Platform", "web", "next.config.ts");
const harnessExists = existsSync(harnessPath);
const harnessSource = harnessExists ? readFileSync(harnessPath, "utf8") : "";
const nextConfigSource = existsSync(nextConfigPath) ? readFileSync(nextConfigPath, "utf8") : "";

test("Platform Web Tea UI real smoke harness exists and uses isolated product services", () => {
  assert.equal(harnessExists, true, "expected root smoke-platform-web-tea-ui-real.ps1 to exist");
  assert.match(harnessSource, /platform-web-tea-ui-real-\$runId/);
  assert.match(harnessSource, /\[guid\]::NewGuid\(\)/);
  assert.match(harnessSource, /tea-daemon\.stdout\.log/);
  assert.match(harnessSource, /platform-core-tea-server\.mjs/);
  assert.match(harnessSource, /next-dev\.stdout\.log/);
  assert.match(harnessSource, /ui-smoke\.mjs/);
  assert.match(harnessSource, /summary\.json/);
});

test("Platform Web Tea UI real smoke drives the actual Next UI with local dev auth", () => {
  assert.match(harnessSource, /DEV_AUTH_BYPASS_ENABLED/);
  assert.match(harnessSource, /NEXTAUTH_SECRET/);
  assert.match(harnessSource, /使用 Local Dev 登录/);
  assert.match(harnessSource, /AI 工单控制台/);
  assert.match(harnessSource, /提交 AI 工单/);
  assert.match(harnessSource, /查看详情 \/ 审阅证据/);
  assert.match(harnessSource, /人工评论/);
  assert.match(harnessSource, /提交评论/);
});

test("Platform Web Tea UI real smoke verifies lifecycle, downloads, and credential boundary evidence", () => {
  assert.match(harnessSource, /审批/);
  assert.match(harnessSource, /执行/);
  assert.match(harnessSource, /停止最新执行/);
  assert.match(harnessSource, /重试最新执行/);
  assert.match(harnessSource, /downloadMarkdown/);
  assert.match(harnessSource, /downloadJson/);
  assert.match(harnessSource, /webToCoreAuthorizationAbsent/);
  assert.match(harnessSource, /coreToTeaBearerPresent/);
  assert.match(harnessSource, /markdownDownloadContainsRun/);
  assert.match(harnessSource, /jsonDownloadContainsRun/);
  assert.match(harnessSource, /markdown_download_contains_comment/);
  assert.match(harnessSource, /json_download_contains_comment/);
});

test("Platform Web Tea UI real smoke records cleanup and refuses unsafe port collisions", () => {
  assert.match(harnessSource, /Assert-NoPreexistingPortListeners/);
  assert.match(harnessSource, /blocked_preexisting_listener/);
  assert.match(harnessSource, /cleanup_phase/);
  assert.match(harnessSource, /validated_pending_cleanup/);
  assert.match(harnessSource, /tea_daemon_stopped/);
  assert.match(harnessSource, /core_server_stopped/);
  assert.match(harnessSource, /next_server_stopped/);
  assert.match(harnessSource, /port_listener_count_after_stop/);
});

test("Platform Web Tea UI real smoke isolates Next dev artifacts from shared .next lock", () => {
  assert.match(nextConfigSource, /NEXT_DIST_DIR/);
  assert.match(nextConfigSource, /distDir/);
  assert.match(harnessSource, /\.next-tea-ui-smoke-\$runId/);
  assert.match(harnessSource, /NEXT_DIST_DIR/);
  assert.match(harnessSource, /next_dist_dir/);
  assert.doesNotMatch(harnessSource, /web\\\.next\\dev\\lock/);
});

test("Platform Web Tea UI real smoke restores tsconfig after isolated Next distDir writes", () => {
  assert.match(harnessSource, /webTsconfigPath/);
  assert.match(harnessSource, /ReadAllBytes/);
  assert.match(harnessSource, /WriteAllBytes/);
  assert.match(harnessSource, /web_tsconfig_restored/);
});
