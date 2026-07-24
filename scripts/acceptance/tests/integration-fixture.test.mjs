import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertRequiredIntegrationFixtureEnvironment,
  assertOwnedFixturePath,
  discoverRequiredIntegrationWorkspaces,
  removeOwnedFixturePath,
  runRequiredIntegrationFixture,
} from "../integration-fixture.mjs";

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function createWorkspace(root, relativePath, payload) {
  await writeJson(path.join(root, relativePath, "package.json"), payload);
}

test("integration fixture rejects missing required scripts and --if-present skip bridges", async () => {
  const platformRoot = await mkdtemp(path.join(os.tmpdir(), "platform-integration-discovery-"));
  await writeJson(path.join(platformRoot, "package.json"), {
    name: "integration-root",
    workspaces: ["packages/one", "packages/two"],
  });
  await createWorkspace(platformRoot, "packages/one", {
    name: "@neuro/one",
    scripts: {
      "test:integration:required": "node -e \"console.log('one')\"",
    },
  });
  await createWorkspace(platformRoot, "packages/two", {
    name: "@neuro/two",
    scripts: {},
  });

  assert.throws(
    () => discoverRequiredIntegrationWorkspaces({ platformRoot }),
    /test:integration:required/i,
  );

  await createWorkspace(platformRoot, "packages/two", {
    name: "@neuro/two",
    scripts: {
      "test:integration:required": "npm run test:integration --if-present",
    },
  });
  assert.throws(
    () => discoverRequiredIntegrationWorkspaces({ platformRoot }),
    /if-present/i,
  );

  await createWorkspace(platformRoot, "packages/two", {
    name: "@neuro/two",
    scripts: {
      "test:integration:required": "node -e \"console.log('two')\"",
    },
  });

  const discovered = discoverRequiredIntegrationWorkspaces({ platformRoot });
  assert.deepEqual(
    discovered.map((workspace) => workspace.name),
    ["@neuro/one", "@neuro/two"],
  );
});

test("integration fixture prepares postgres/valkey/s3 readiness before executing every workspace and cleans up afterward", async () => {
  const calls = [];
  const summary = await runRequiredIntegrationFixture({
    runId: "platform-fixture-order-test",
    platformRoot: "C:/platform",
    discoverWorkspaces: () => [
      {
        name: "@neuro/one",
        directory: "C:/platform/packages/one",
        packagePath: "C:/platform/packages/one/package.json",
        script: "node -e \"console.log('one')\"",
      },
      {
        name: "@neuro/two",
        directory: "C:/platform/packages/two",
        packagePath: "C:/platform/packages/two/package.json",
        script: "node -e \"console.log('two')\"",
      },
    ],
    prepareFixture: async () => {
      calls.push("prepare");
      return {
        env: {
          DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/platform_test",
          ACCOUNT_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/platform_test",
          REDIS_URL: "redis://127.0.0.1:6380",
          ACCOUNT_REDIS_URL: "redis://127.0.0.1:6380",
          OBJECT_STORAGE_DRIVER: "s3-compatible",
          OBJECT_STORAGE_BUCKET: "platform-integration",
          OBJECT_STORAGE_REGION: "us-east-1",
          OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:19000",
          OBJECT_STORAGE_ACCESS_KEY_ID: "fixture-access-key",
          OBJECT_STORAGE_SECRET_ACCESS_KEY: "fixture-secret-key",
          S3_PUBLIC_BASE_URL: "http://127.0.0.1:19000/platform-integration/",
        },
        ownedPath: "C:/platform/.runtime/acceptance/integration-fixture/platform-fixture-order-test",
        readiness: {
          postgres: true,
          valkey: true,
          s3: true,
        },
      };
    },
    runWorkspaceCommand: async ({ workspace, fixture }) => {
      calls.push(`run:${workspace.name}`);
      assert.equal(fixture.readiness.postgres, true);
      assert.equal(fixture.readiness.valkey, true);
      assert.equal(fixture.readiness.s3, true);
      return {
        workspaceName: workspace.name,
        exitCode: workspace.name === "@neuro/two" ? 7 : 0,
      };
    },
    cleanupFixture: async () => {
      calls.push("cleanup");
    },
  });

  assert.deepEqual(calls, ["prepare", "run:@neuro/one", "run:@neuro/two", "cleanup"]);
  assert.equal(summary.discovered, 2);
  assert.equal(summary.executed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.exitCode, 1);
});

test("integration fixture readiness requires postgres, valkey, and s3 coordinates", () => {
  assert.doesNotThrow(() =>
    assertRequiredIntegrationFixtureEnvironment({
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/platform_test",
      ACCOUNT_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/platform_test",
      REDIS_URL: "redis://127.0.0.1:6380",
      ACCOUNT_REDIS_URL: "redis://127.0.0.1:6380",
      OBJECT_STORAGE_DRIVER: "s3-compatible",
      OBJECT_STORAGE_BUCKET: "platform-integration",
      OBJECT_STORAGE_REGION: "us-east-1",
      OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:19000",
      OBJECT_STORAGE_ACCESS_KEY_ID: "fixture-access-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "fixture-secret-key",
      S3_PUBLIC_BASE_URL: "http://127.0.0.1:19000/platform-integration/",
    }),
  );
  assert.throws(
    () =>
      assertRequiredIntegrationFixtureEnvironment({
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/platform_test",
        ACCOUNT_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/platform_test",
        REDIS_URL: "redis://127.0.0.1:6380",
        ACCOUNT_REDIS_URL: "redis://127.0.0.1:6380",
        OBJECT_STORAGE_DRIVER: "s3-compatible",
        OBJECT_STORAGE_BUCKET: "platform-integration",
        OBJECT_STORAGE_REGION: "us-east-1",
        OBJECT_STORAGE_ACCESS_KEY_ID: "fixture-access-key",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "fixture-secret-key",
      }),
    /OBJECT_STORAGE_ENDPOINT|S3_PUBLIC_BASE_URL/i,
  );
});

test("integration fixture cleanup only removes owned runtime paths", async () => {
  const ownerRoot = await mkdtemp(path.join(os.tmpdir(), "platform-integration-owned-root-"));
  const ownedPath = path.join(ownerRoot, "owned");
  const foreignRoot = await mkdtemp(path.join(os.tmpdir(), "platform-integration-foreign-root-"));
  const foreignPath = path.join(foreignRoot, "foreign");
  await mkdir(ownedPath, { recursive: true });
  await mkdir(foreignPath, { recursive: true });
  await writeFile(path.join(ownedPath, "owned.txt"), "owned", "utf8");
  await writeFile(path.join(foreignPath, "foreign.txt"), "foreign", "utf8");

  assert.doesNotThrow(() => assertOwnedFixturePath(ownerRoot, ownedPath));
  assert.throws(() => assertOwnedFixturePath(ownerRoot, foreignPath), /outside the owned integration fixture root/i);

  await removeOwnedFixturePath(ownerRoot, ownedPath);
  await assert.rejects(access(ownedPath));
  await assert.rejects(
    () => removeOwnedFixturePath(ownerRoot, foreignPath),
    /outside the owned integration fixture root/i,
  );
  assert.equal(await readFile(path.join(foreignPath, "foreign.txt"), "utf8"), "foreign");

  await Promise.all([
    rm(ownerRoot, { recursive: true, force: true }),
    rm(foreignRoot, { recursive: true, force: true }),
  ]);
});
