import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

function collectMarkdownFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".next", ".runtime", "node_modules", "output", "release"].includes(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(path);
    }
  }
  return results;
}

describe("independent Platform repository", () => {
  it("keeps the complete Platform workspace boundary", () => {
    const packageMetadata = JSON.parse(read("package.json"));
    assert.deepStrictEqual(packageMetadata.workspaces, [
      "packages/contracts",
      "packages/backend-foundation",
      "packages/ai-gateway-domain",
      "packages/account-domain",
      "services/account-api",
      "services/account-worker",
      "core",
      "executor",
      "worker",
      "web",
    ]);

    for (const requiredPath of [
      "AGENTS.md",
      "README.md",
      "package-lock.json",
      "deploy/docker-compose.local.yml",
      "deploy/acceptance/docker-compose.acceptance.yml",
      "infra/tofu/README.md",
      "docs/40-engineering/platform-release-artifact-standard.md",
      "docs/40-engineering/PostgreSQL迁移并发与事务基线.md",
      "docs/40-engineering/arbitration-metric-query-baseline.md",
      "docs/40-engineering/heavy-chat-read-query-baseline.md",
      "docs/40-engineering/OpenTofu环境契约基线.md",
    ]) {
      assert(statSync(join(rootDir, requiredPath)).isFile(), `Missing repository path: ${requiredPath}`);
    }
    assert(!existsSync(join(rootDir, "gateway")), "Platform must not vendor the Gateway source tree");
  });

  it("declares public repository metadata and policies", () => {
    const packageMetadata = JSON.parse(read("package.json"));
    assert.strictEqual(
      packageMetadata.repository?.url,
      "git+https://github.com/aiaimimi0920/Platform.git",
    );
    assert.strictEqual(packageMetadata.private, true);
    assert.strictEqual(packageMetadata.license, "ISC");
    assert(statSync(join(rootDir, "LICENSE")).isFile());
    assert(statSync(join(rootDir, "SECURITY.md")).isFile());
    assert(statSync(join(rootDir, "CONTRIBUTING.md")).isFile());
  });

  it("keeps root dependencies scoped to repository-level tooling", () => {
    const packageMetadata = JSON.parse(read("package.json"));
    const corePackageMetadata = JSON.parse(read("core/package.json"));

    assert.strictEqual(packageMetadata.dependencies, undefined);
    assert.strictEqual(packageMetadata.main, undefined);
    assert.deepStrictEqual(Object.keys(packageMetadata.devDependencies).sort(), ["pg", "tsc-alias", "tsx"]);
    assert.strictEqual(typeof corePackageMetadata.devDependencies?.["embedded-postgres"], "string");
  });

  it("owns quick CI and Windows release contracts", () => {
    const packageMetadata = JSON.parse(read("package.json"));
    const workflow = read(".github/workflows/ci.yml");
    assert(workflow.includes("name: Platform CI"));
    assert(workflow.includes("actions/checkout@v5"));
    assert(workflow.includes("node --test scripts/repository-contract.mjs"));
    assert(workflow.includes("npm run prepare:workspaces"));
    assert(workflow.includes("npm run typecheck:workspaces"));
    assert(workflow.includes("npm run audit:prod"));
    assert(workflow.includes("npm run test:vitest"));
    assert(workflow.includes("opentofu/setup-opentofu@v2"));
    assert(workflow.includes("tofu_version_file: .opentofu-version"));
    assert(workflow.includes("npm run infra:tofu:validate"));
    assert(packageMetadata.scripts.ci.includes("npm run infra:tofu:validate"));
    assert(workflow.includes("docker compose -f deploy/docker-compose.local.yml config --quiet"));
    assert(workflow.includes("test-build-platform-web-release-contract.ps1 -DryRunOnly"));
    assert(workflow.includes("test-verify-platform-web-release-package-contract.ps1"));
    assert(workflow.includes("test-smoke-platform-web-release-package-contract.ps1"));
  });

  it("serializes every schema migration runner and preserves cleanup boundaries", () => {
    const sharedMigrationRunner = read("packages/backend-foundation/src/db/postgres-migrations.ts");
    assert(sharedMigrationRunner.includes("pg_advisory_lock"));
    assert(sharedMigrationRunner.includes("pg_advisory_unlock"));
    assert(sharedMigrationRunner.includes("current_database()"));
    assert(sharedMigrationRunner.includes("rollbackPreservingPrimaryError"));
    assert(sharedMigrationRunner.includes("await pool.end()"));

    for (const [relativePath, lockName, tableName] of [
      ["core/src/scripts/migrate.ts", "neuro-core-schema-migrations", "schema_migrations"],
      ["packages/account-domain/src/scripts/migrate.ts", "neuro-account-schema-migrations", "account_schema_migrations"],
      ["packages/ai-gateway-domain/src/scripts/migrate.ts", "neuro-gateway-schema-migrations", "gateway_schema_migrations"],
    ]) {
      const migrationRunner = read(relativePath);
      assert(migrationRunner.includes("runPostgresMigrations"));
      assert(migrationRunner.includes(lockName));
      assert(migrationRunner.includes(tableName));
    }
  });

  it("keeps Arbitration summary and workload on compact metric projections", () => {
    const service = read("core/src/modules/arbitration/service.ts");
    const summaryBlock = service
      .split("export async function getVisibleArbitrationCaseSummary")[1]
      ?.split("export async function getArbitrationCaseWorkload")[0] ?? "";
    const workloadBlock = service
      .split("export async function getArbitrationCaseWorkload")[1]
      ?.split("export async function createArbitrationCase")[0] ?? "";
    assert(summaryBlock.includes("listArbitrationCaseMetricRowsVisibleToUser"));
    assert(summaryBlock.includes("listTaskParticipantRowsByIds"));
    assert(summaryBlock.includes("listArbitrationEvidenceMetricsByCaseIds"));
    assert(summaryBlock.includes("getArbitrationAttachmentMetricsByCaseIds"));
    assert(!summaryBlock.includes("listVisibleArbitrationCases"));
    assert(workloadBlock.includes("listArbitrationCaseMetricRowsVisibleToUser"));
    assert(workloadBlock.includes("listArbitrationEvidenceMetricsByCaseIds"));
    assert(workloadBlock.includes("listArbitrationReviewRoundMetricRowsByCaseIds"));
    assert(workloadBlock.includes("buildArbitrationCaseWorkload"));
    assert(!workloadBlock.includes("listVisibleArbitrationCases"));

    const repository = read("core/src/modules/arbitration/repository.ts");
    assert(repository.includes("arbitrationCaseMetricSelection"));
    assert(repository.includes("count(*) filter"));
    assert(repository.includes("count(*)::int"));
    const corePackage = JSON.parse(read("core/package.json"));
    assert(corePackage.scripts.test.includes("src/modules/arbitration/workload-analysis.test.ts"));
  });

  it("keeps Heavy Chat snapshot and Gateway history on purpose-built read queries", () => {
    const service = read("core/src/modules/heavy-chat/service.ts");
    const snapshotBlock = service
      .split("async getSnapshot(ownerUserId: string)")[1]
      ?.split("async listSlots(ownerUserId: string)")[0] ?? "";
    assert(snapshotBlock.includes("repository.listAgentBindingsForSlots"));
    assert(snapshotBlock.includes("repository.listProjectBindingsForSlots"));
    assert(snapshotBlock.includes("repository.listRecentMessagePages"));
    assert(snapshotBlock.includes("messagePages:"));
    assert(!snapshotBlock.includes("repository.listMessagesByThreadIds"));
    assert(!snapshotBlock.includes("mapWithConcurrency"));
    assert(service.includes("repository.listGatewayHistoryMessages"));
    assert(!service.includes("function buildGatewayHistory"));

    const repository = read("core/src/modules/heavy-chat/repository.ts");
    const historyQueryBlock = repository
      .split("async listGatewayHistoryMessages(ownerUserId: string, threadId: string, beforeSequence: number)")[1]
      ?.split("async maxMessageAttemptNumber")[0] ?? "";
    assert(historyQueryBlock.includes("role: heavyChatMessages.role"));
    assert(historyQueryBlock.includes("content: heavyChatMessages.content"));
    assert(historyQueryBlock.includes("lt(heavyChatMessages.sequence, beforeSequence)"));
    assert(historyQueryBlock.includes('eq(heavyChatMessages.status, "complete")'));
    assert(repository.includes("inArray(heavyChatSlotAgents.slotId, slotIds)"));
    assert(repository.includes("inArray(heavyChatSlotProjects.slotId, slotIds)"));
    assert(repository.includes("inArray(heavyChatMessages.threadId, threadIds)"));
    const recentPageQueryBlock = repository
      .split("async listRecentMessagePages(ownerUserId: string, threadIds: string[], pageSize: number)")[1]
      ?.split("async listMessagePage(")[0] ?? "";
    assert(recentPageQueryBlock.includes("innerJoinLateral"));
    assert(recentPageQueryBlock.includes("requested_heavy_chat_threads"));
    assert(!recentPageQueryBlock.includes("row_number() over"));
    assert(recentPageQueryBlock.includes("pageSize + 1"));
    const messagePageQueryBlock = repository
      .split("async listMessagePage(")[1]
      ?.split("async listGatewayHistoryMessages")[0] ?? "";
    assert(messagePageQueryBlock.includes("lt(heavyChatMessages.sequence, beforeSequence)"));
    assert(messagePageQueryBlock.includes(".limit(pageSize + 1)"));

    const router = read("core/src/modules/heavy-chat/router.ts");
    assert(router.includes('"/v1/me/heavy-chat/threads/:threadId/messages"'));
    assert(router.includes("getMessagePage(userId, request.params.threadId"));
    const webAdapter = read("web/src/features/account-heavy-agent-chat/adapter.ts");
    assert(webAdapter.includes("mergeHeavyChatWorkspaceSnapshot"));
    assert(webAdapter.includes("mergeHeavyChatMessagePage"));
    const webThreadState = read("web/src/features/account-heavy-agent-chat/use-heavy-chat-thread-state.ts");
    assert(webThreadState.includes("beforeSequence=${thread.nextBeforeSequence}&limit=50"));
    assert(webThreadState.includes("mergeHeavyChatMessagePage(current, page)"));
    const webWorkspace = read("web/src/features/account-heavy-agent-chat/chat-workspace.tsx");
    assert(webWorkspace.includes("currentViewport.scrollHeight - previousScrollHeight"));
  });

  it("builds all Platform-owned images without publishing pull requests", () => {
    const workflow = read(".github/workflows/container-images.yml");
    const dockerignore = read(".dockerignore");
    assert(workflow.includes("packages: write"));
    assert(workflow.includes("github.event_name != 'pull_request'"));
    assert(
      workflow.includes("github.event.pull_request.head.repo.fork == false"),
      "Fork pull requests must not attempt to export a writable GitHub Actions cache",
    );
    assert(workflow.includes("ghcr.io/${{ github.repository_owner }}/neuro-platform-${{ matrix.image }}"));
    assert(workflow.includes("id: build"));
    assert(workflow.includes("steps.build.outputs.digest"));
    assert(workflow.includes("container-image-lock.mjs entry"));
    assert(workflow.includes("platform-image-lock-entry-${{ matrix.image }}-${{ github.run_id }}-${{ github.run_attempt }}"));
    assert(workflow.includes("needs: publish"));
    assert(workflow.includes("container-image-lock.mjs aggregate"));
    assert(workflow.includes("platform-container-image-lock-${{ github.run_id }}-${{ github.run_attempt }}"));
    assert(workflow.includes("retention-days: 90"));
    const imageLockScript = read("scripts/container-image-lock.mjs");
    assert(imageLockScript.includes("sha256:[0-9a-f]{64}"));
    assert(imageLockScript.includes("Expected ${PLATFORM_CONTAINER_IMAGES.length} image lock entries"));
    assert(imageLockScript.includes("Image lock entry files must be exactly"));
    assert(imageLockScript.includes('run?.event === "push"'));
    assert(imageLockScript.includes("run.head_sha"));
    assert(imageLockScript.includes(".github/workflows/container-images.yml@${refName}"));
    assert(imageLockScript.includes("Multiple Container Images workflow runs match"));
    for (const dockerfile of [
      "core.Dockerfile",
      "account-api.Dockerfile",
      "account-worker.Dockerfile",
      "worker.Dockerfile",
      "executor.Dockerfile",
      "web.Dockerfile",
    ]) {
      assert.strictEqual(
        workflow
          .split(/\r?\n/)
          .filter((line) => line.trim() === `dockerfile: deploy/docker/${dockerfile}`).length,
        2,
        `Container build and publish matrices must both include ${dockerfile}`,
      );
      const dockerfileText = read(`deploy/docker/${dockerfile}`);
      assert.match(
        dockerfileText,
        /ARG NODE_IMAGE=node:22-bookworm-slim@sha256:[0-9a-f]{64}/,
        `${dockerfile} must pin the Node base image by digest`,
      );
      assert(dockerfileText.includes("FROM ${NODE_IMAGE} AS build"), `${dockerfile} must use the pinned build image`);
      assert(dockerfileText.includes("FROM ${NODE_IMAGE} AS runtime"), `${dockerfile} must use the pinned runtime image`);
      assert(dockerfileText.includes("HEALTHCHECK --interval=30s"), `${dockerfile} must expose standalone readiness`);
      assert(dockerfileText.includes("type=cache,target=/root/.npm"), `${dockerfile} must use the shared npm BuildKit cache`);
      assert(dockerfileText.includes("npm ci --no-audit --no-fund"), `${dockerfile} must avoid duplicate install audits`);
      assert(dockerfileText.includes("npm prune --omit=dev --no-audit --no-fund"), `${dockerfile} must avoid duplicate prune audits`);
    }
    for (const generatedPath of [".runtime", "output", "release", ".npmrc", "*.pem", "*.key", "tmp", "reports"]) {
      assert(dockerignore.split(/\r?\n/).includes(generatedPath), `Docker context does not exclude ${generatedPath}`);
    }
  });

  it("publishes only a verified, runtime-smoked tagged Web package", () => {
    const workflow = read(".github/workflows/release-platform-tag.yml");
    assert(workflow.includes('"V*.*.*"'));
    assert(workflow.includes("Tag/package version mismatch"));
    assert(workflow.includes("SOURCE_REVISION=$tagRevision"));
    assert(workflow.includes("git checkout --detach $tagRevision"));
    assert(workflow.includes("Release tag moved during the workflow"));
    assert(workflow.includes("build-platform-web-release.ps1"));
    assert(workflow.includes("verify-platform-web-release-package.ps1"));
    assert(workflow.includes("smoke-platform-web-release-package.ps1"));
    assert(workflow.includes("npm run test:integration:required"));
    assert(workflow.includes("softprops/action-gh-release@v3"));
    assert(workflow.includes("container-image-lock.mjs resolve-run"));
    assert(workflow.includes("container-image-lock.mjs validate"));
    assert(workflow.includes("steps.image-lock-run.outputs.runId"));
    assert(workflow.includes("steps.image-lock-run.outputs.runAttempt"));
    assert(workflow.includes("github-token: ${{ secrets.GITHUB_TOKEN }}"));
    assert(workflow.includes("target_commitish: ${{ env.SOURCE_REVISION }}"));
    assert(workflow.includes("container-images.json"));
    assert(workflow.includes("container-images.json.sha256"));
    assert(workflow.includes(".zip.sha256"));
    assert(workflow.includes("checksums.sha256"));
    assert.match(workflow, /permissions:\s+contents: read/);
    assert.match(workflow, /jobs:\s+release:\s+name:[^\n]+\s+permissions:\s+actions: read\s+contents: write/);
    assert(workflow.includes("opentofu/setup-opentofu@v2"));
    assert(workflow.includes("tofu_version_file: .opentofu-version"));
  });

  it("does not contain Google API-key-shaped literals in documentation", () => {
    const findings = [];
    for (const markdownPath of collectMarkdownFiles(rootDir)) {
      if (/AIza[0-9A-Za-z_-]{30,}/.test(readFileSync(markdownPath, "utf8"))) {
        findings.push(relative(rootDir, markdownPath).replaceAll("\\", "/"));
      }
    }
    assert.deepStrictEqual(findings, []);
  });
});
