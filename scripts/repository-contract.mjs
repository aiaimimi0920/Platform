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
      "docs/40-engineering/platform-release-artifact-standard.md",
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
    const workflow = read(".github/workflows/ci.yml");
    assert(workflow.includes("name: Platform CI"));
    assert(workflow.includes("actions/checkout@v5"));
    assert(workflow.includes("node --test scripts/repository-contract.mjs"));
    assert(workflow.includes("npm run prepare:workspaces"));
    assert(workflow.includes("npm run typecheck:workspaces"));
    assert(workflow.includes("npm run audit:prod"));
    assert(workflow.includes("npm run test:vitest"));
    assert(workflow.includes("docker compose -f deploy/docker-compose.local.yml config --quiet"));
    assert(workflow.includes("test-build-platform-web-release-contract.ps1 -DryRunOnly"));
    assert(workflow.includes("test-verify-platform-web-release-package-contract.ps1"));
    assert(workflow.includes("test-smoke-platform-web-release-package-contract.ps1"));
  });

  it("serializes Core schema migrations across concurrent deploy processes", () => {
    const migrationRunner = read("core/src/scripts/migrate.ts");
    assert(migrationRunner.includes("pg_advisory_lock"));
    assert(migrationRunner.includes("pg_advisory_unlock"));
    assert(migrationRunner.includes("neuro-core-schema-migrations"));
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
    assert(workflow.includes("build-platform-web-release.ps1"));
    assert(workflow.includes("verify-platform-web-release-package.ps1"));
    assert(workflow.includes("smoke-platform-web-release-package.ps1"));
    assert(workflow.includes("npm run test:integration:required"));
    assert(workflow.includes("softprops/action-gh-release@v3"));
    assert(workflow.includes(".zip.sha256"));
    assert(workflow.includes("checksums.sha256"));
    assert.match(workflow, /permissions:\s+contents: read/);
    assert.match(workflow, /jobs:\s+release:\s+name:[^\n]+\s+permissions:\s+contents: write/);
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
