import { describe, it } from "node:test";
import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectMarkdownFiles(baseDir) {
  const files = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          "dist",
          "build",
          "target",
          ".next",
          ".runtime",
          "50-history",
        ].includes(entry.name)
      ) {
        continue;
      }
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("monorepo structure", () => {
  it("keeps core module directories", () => {
    const modulesPath = join(rootDir, "core/src/modules");
    const entries = readdirSync(modulesPath);
    const expected = [
      "agent-execution",
      "agent-registry",
      "arbitration",
      "daily-rewards",
      "development-queue",
      "identity",
      "opinion-hub",
      "product-order-item",
      "redemption-mailbox-marketplace",
      "reputation",
      "task-hub",
      "wallet-ledger",
    ];
    for (const moduleName of expected) {
      assert(entries.includes(moduleName), `${moduleName} missing from core modules`);
    }
  });

  it("exposes the contract feature list", () => {
    const contractPath = join(rootDir, "packages/contracts/src/index.ts");
    const contents = readFileSync(contractPath, "utf8");
    assert(
      contents.includes("export const featureModuleKeys"),
      "contracts index is missing featureModuleKeys definition",
    );
  });

  it("holds the key Platform docs", () => {
    const docPath = join(rootDir, "docs/10-platform/NeuroLoom平台总基线.md");
    const migrationPath = join(rootDir, "MIGRATION_NOTES.md");
    const stats = statSync(docPath);
    const migrationStats = statSync(migrationPath);
    assert(stats.isFile(), "Platform baseline doc not present");
    assert(migrationStats.isFile(), "Platform migration notes not present");
  });

  it("documents Neuro/Platform as the active Platform workspace", () => {
    const currentMainRepoPath = join(rootDir, "CURRENT_MAIN_REPO.md");
    const contents = readFileSync(currentMainRepoPath, "utf8");
    assert(
      contents.includes("C:\\Users\\Public\\nas_home\\AI\\GameEditor\\Neuro\\Platform"),
      "CURRENT_MAIN_REPO.md must point Platform work at the migrated Neuro/Platform workspace",
    );
    assert(
      !contents.includes("正式继续开发的主仓目录**重新固定为：\n\n- `C:\\Users\\Public\\nas_home\\AI\\GameEditor\\NeuroPlatform`"),
      "CURRENT_MAIN_REPO.md must not keep the pre-migration NeuroPlatform directory as the active Platform workspace",
    );
  });

  it("renders the web entry page", () => {
    const appPath = join(rootDir, "web/src/app/page.tsx");
    const stats = statSync(appPath);
    assert(stats.isFile(), "web app page missing");
  });

  it("keeps sanitized workspace environment examples", () => {
    const envExamplePaths = [
      "core/.env.example",
      "executor/.env.example",
      "web/.env.example",
      "worker/.env.example",
    ];

    for (const envExamplePath of envExamplePaths) {
      const stats = statSync(join(rootDir, envExamplePath));
      assert(stats.isFile(), `${envExamplePath} missing from Platform workspace`);
    }
  });

  it("keeps Platform-local operational helper entrypoints", () => {
    const helperPaths = [
      "deploy/claim-heavy-task.ps1",
      "deploy/release-heavy-task.ps1",
      "deploy/show-heavy-task-status.ps1",
      "deploy/invoke-heavy-task.ps1",
      "deploy/wait-heavy-task-available.ps1",
      "deploy/heavy-task-common.ps1",
      "deploy/bootstrap-local-gateway-fake-provider.ps1",
      "deploy/bootstrap-local-gateway-provider.ps1",
      "deploy/bootstrap-local-gateway-freebuff-provider.ps1",
      "deploy/bootstrap-local-gateway-kiro-provider.ps1",
      "deploy/write-qwen-official-credential-files.ps1",
    ];

    for (const helperPath of helperPaths) {
      const stats = statSync(join(rootDir, helperPath));
      assert(stats.isFile(), `${helperPath} missing from Platform deploy helpers`);
    }
  });

  it("does not document Gateway release helpers as Platform-local deploy scripts", () => {
    const agentsPath = join(rootDir, "AGENTS.md");
    const contents = readFileSync(agentsPath, "utf8");
    const stalePlatformLocalReferencePatterns = [
      /-\s+`deploy\/build-images\.sh`\s+与\s+`deploy\/push-images\.sh`/,
      /-\s+`deploy\/docker\/gateway\.Dockerfile`/,
      /-\s+`deploy\/build-gateway-binary\.sh`/,
      /-\s+`deploy\/reload-gateway-splitter\.sh`/,
      /-\s+`deploy\/release-gateway\.sh`/,
      /`deploy\/build-images\.sh`、`deploy\/push-images\.sh`、`deploy\/rollout-gateway\.sh`/,
    ];

    for (const stalePattern of stalePlatformLocalReferencePatterns) {
      assert(
        !stalePattern.test(contents),
        `${stalePattern} should be documented as Gateway-owned, not Platform-local`,
      );
    }
  });

  it("has root GitHub Actions validation for Platform", () => {
    const workflowPath = join(rootDir, "../.github/workflows/package-platform.yml");
    const contents = readFileSync(workflowPath, "utf8");
    assert(contents.includes("name: Package Platform"), "Platform workflow has wrong name");
    assert(contents.includes("Platform/**"), "Platform workflow does not watch Platform paths");
    assert(contents.includes("npm run smoke"), "Platform workflow does not run the smoke suite");
    assert(
      contents.includes("docker compose -f deploy/docker-compose.local.yml config --quiet"),
      "Platform workflow does not validate the local compose topology",
    );
  });

  it("keeps locally referenced docs and rules available", () => {
    const referenceFiles = [
      "AGENTS.md",
      "README.md",
      "docs/README.md",
      "docs/20-ai-gateway/README.md",
    ];

    const missingReferences = [];
    for (const referenceFile of referenceFiles) {
      const contents = readFileSync(join(rootDir, referenceFile), "utf8");
      const matches = contents.matchAll(/`((?:docs|rules)\/[^`]+?\.md)`/g);
      for (const match of matches) {
        const referencedPath = decodeURIComponent(match[1]);
        try {
          const stats = statSync(join(rootDir, referencedPath));
          if (!stats.isFile()) {
            missingReferences.push(`${referenceFile} -> ${referencedPath}`);
          }
        } catch {
          missingReferences.push(`${referenceFile} -> ${referencedPath}`);
        }
      }
    }

    assert.deepStrictEqual(missingReferences, []);
  });

  it("keeps non-history markdown docs self-contained for local docs/rules references", () => {
    const missingReferences = [];
    for (const markdownPath of collectMarkdownFiles(rootDir)) {
      const referenceFile = markdownPath.slice(rootDir.length + 1).replaceAll("\\", "/");
      const contents = readFileSync(markdownPath, "utf8");
      const matches = contents.matchAll(/`((?:docs|rules)\/[^`]+?\.md)`/g);
      for (const match of matches) {
        const referencedPath = decodeURIComponent(match[1]);
        try {
          const stats = statSync(join(rootDir, referencedPath));
          if (!stats.isFile()) {
            missingReferences.push(`${referenceFile} -> ${referencedPath}`);
          }
        } catch {
          missingReferences.push(`${referenceFile} -> ${referencedPath}`);
        }
      }
    }

    assert.deepStrictEqual(missingReferences, []);
  });
});
