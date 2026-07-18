import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HOST_PORT_VARIABLES,
  cleanupAcceptanceProject,
  createAcceptanceEnvironment,
} from "../compose.mjs";

const platformRoot = path.resolve(".");
const acceptanceComposeFile = path.join(
  platformRoot,
  "deploy",
  "acceptance",
  "docker-compose.acceptance.yml",
);

function parseEnvFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function serializeEnvFile(values) {
  return `${Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")}\n`;
}

async function createTempRoot(t, prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(root, { force: true, recursive: true }));
  return root;
}

async function startDoubleServer(t, server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

test("createAcceptanceEnvironment rejects empty and unsafe run ids", async () => {
  const evidenceDir = path.join(os.tmpdir(), "platform-invalid-run-id");
  for (const runId of ["", "../foreign", "Uppercase", "contains spaces", "a".repeat(64)]) {
    await assert.rejects(
      createAcceptanceEnvironment({ runId, evidenceDir, platformRoot }),
      /run.?id/i,
    );
  }
});

test("createAcceptanceEnvironment creates run-owned resources, secrets, ports, and owner metadata", async (t) => {
  const tempRoot = await createTempRoot(t, "platform-compose-env-");
  const evidenceDir = path.join(tempRoot, "run-owned");
  const allocatedPorts = Array.from({ length: HOST_PORT_VARIABLES.length }, (_, index) => 31000 + index);
  const environment = await createAcceptanceEnvironment({
    runId: "platform-acceptance-owned",
    evidenceDir,
    platformRoot,
    allocatePorts: async (count) => {
      assert.equal(count, HOST_PORT_VARIABLES.length);
      return allocatedPorts;
    },
  });

  assert.equal(environment.projectName, "platform-acceptance-owned");
  assert.equal(environment.paths.evidenceDir, path.resolve(evidenceDir));
  assert.equal(environment.paths.resourcesDir, path.join(path.resolve(evidenceDir), "resources"));
  assert.equal(environment.paths.credentialsRoot, path.join(path.resolve(evidenceDir), "resources", "credentials"));
  assert.equal(environment.paths.composeFile, acceptanceComposeFile);
  assert.equal(new Set(Object.values(environment.ports)).size, HOST_PORT_VARIABLES.length);
  assert.deepEqual(Object.values(environment.ports), allocatedPorts);

  const envValues = parseEnvFile(await readFile(environment.paths.envFile, "utf8"));
  assert.equal(envValues.PLATFORM_ACCEPTANCE_RUN_ID, environment.runId);
  assert.equal(envValues.COMPOSE_PROJECT_NAME, environment.projectName);
  assert.equal(envValues.ACCEPTANCE_CREDENTIAL_ROOT, environment.paths.credentialsRoot.replaceAll("\\", "/"));
  for (const variable of HOST_PORT_VARIABLES) {
    assert.equal(envValues[variable], String(environment.ports[variable]));
  }
  for (const secretName of [
    "POSTGRES_PASSWORD",
    "MINIO_ROOT_PASSWORD",
    "INTERNAL_API_TOKEN",
    "NEXTAUTH_SECRET",
    "OAUTH_CLIENT_SECRET",
    "BENEFIT_SERVICE_API_KEY_SECRET",
    "GATEWAY_PROJECT_TOKEN",
    "TEA_AUTH_TOKEN",
    "LOOM_AUTH_TOKEN",
  ]) {
    assert.match(envValues[secretName], /^[a-f0-9]{48,}$/);
    assert.doesNotMatch(envValues[secretName], /local|secret|replace-me/i);
  }

  const owner = JSON.parse(await readFile(environment.paths.ownerFile, "utf8"));
  assert.equal(owner.runId, environment.runId);
  assert.equal(owner.projectName, environment.projectName);
  assert.equal(owner.platformRoot, platformRoot);
  assert.equal(owner.composeFile, acceptanceComposeFile);
  assert.equal(owner.resourcesDir, environment.paths.resourcesDir);
  assert.deepEqual(owner.volumeNames, environment.volumeNames);
});

test("two acceptance environments use different secrets and run-owned volume names", async (t) => {
  const tempRoot = await createTempRoot(t, "platform-compose-unique-");
  const first = await createAcceptanceEnvironment({
    runId: "platform-acceptance-first",
    evidenceDir: path.join(tempRoot, "first"),
    platformRoot,
    allocatePorts: async (count) => Array.from({ length: count }, (_, index) => 32000 + index),
  });
  const second = await createAcceptanceEnvironment({
    runId: "platform-acceptance-second",
    evidenceDir: path.join(tempRoot, "second"),
    platformRoot,
    allocatePorts: async (count) => Array.from({ length: count }, (_, index) => 32100 + index),
  });
  const firstEnv = parseEnvFile(await readFile(first.paths.envFile, "utf8"));
  const secondEnv = parseEnvFile(await readFile(second.paths.envFile, "utf8"));

  assert.notEqual(firstEnv.INTERNAL_API_TOKEN, secondEnv.INTERNAL_API_TOKEN);
  assert.notDeepEqual(first.volumeNames, second.volumeNames);
  for (const volumeName of Object.values(first.volumeNames)) {
    assert.match(volumeName, /^platform-acceptance-first-/);
  }
});

test("cleanup rejects a foreign project before invoking Docker", async (t) => {
  const tempRoot = await createTempRoot(t, "platform-compose-foreign-");
  const environment = await createAcceptanceEnvironment({
    runId: "platform-acceptance-owner",
    evidenceDir: path.join(tempRoot, "owner"),
    platformRoot,
    allocatePorts: async (count) => Array.from({ length: count }, (_, index) => 32200 + index),
  });
  let commandInvoked = false;

  await assert.rejects(
    cleanupAcceptanceProject({
      runId: environment.runId,
      evidenceDir: environment.paths.evidenceDir,
      projectName: "platform-acceptance-foreign",
      platformRoot,
      executeCommand: async () => {
        commandInvoked = true;
        return { exitCode: 0 };
      },
    }),
    /foreign|owner|project/i,
  );

  assert.equal(commandInvoked, false);
  await access(environment.paths.ownerFile);
});

test("cleanup rejects tampered owner resource metadata before invoking Docker", async (t) => {
  const tempRoot = await createTempRoot(t, "platform-compose-owner-metadata-");
  const cases = [
    ["credentials", (owner) => ({ ...owner, credentialsRoot: path.join(tempRoot, "foreign-credentials") })],
    ["network", (owner) => ({ ...owner, networkName: "platform-acceptance-foreign-network" })],
    [
      "volumes",
      (owner) => ({
        ...owner,
        volumeNames: { ...owner.volumeNames, postgres: "platform-acceptance-foreign-postgres" },
      }),
    ],
    [
      "ports",
      (owner) => ({
        ...owner,
        ports: { ...owner.ports, WEB_HOST_PORT: owner.ports.CORE_HOST_PORT },
      }),
    ],
  ];

  for (const [caseIndex, [caseName, mutateOwner]] of cases.entries()) {
    const environment = await createAcceptanceEnvironment({
      runId: `platform-owner-${caseName}`,
      evidenceDir: path.join(tempRoot, caseName),
      platformRoot,
      allocatePorts: async (count) =>
        Array.from({ length: count }, (_, index) => 32400 + caseIndex * 20 + index),
    });
    const owner = JSON.parse(await readFile(environment.paths.ownerFile, "utf8"));
    await writeFile(environment.paths.ownerFile, `${JSON.stringify(mutateOwner(owner), null, 2)}\n`, "utf8");
    let commandInvoked = false;

    await assert.rejects(
      cleanupAcceptanceProject({
        runId: environment.runId,
        evidenceDir: environment.paths.evidenceDir,
        platformRoot,
        executeCommand: async () => {
          commandInvoked = true;
          return { exitCode: 0 };
        },
      }),
      /foreign|owner|credential|network|volume|port/i,
    );
    assert.equal(commandInvoked, false, `${caseName} owner mismatch invoked Docker`);
    await access(environment.paths.resourcesDir);
  }
});

test("cleanup rejects environment resource metadata that differs from its owner before invoking Docker", async (t) => {
  const tempRoot = await createTempRoot(t, "platform-compose-env-metadata-");
  const cases = [
    ["credentials", "ACCEPTANCE_CREDENTIAL_ROOT", path.join(tempRoot, "foreign-credentials")],
    ["network", "ACCEPTANCE_NETWORK_NAME", "platform-acceptance-foreign-network"],
    ["volumes", "POSTGRES_VOLUME_NAME", "platform-acceptance-foreign-postgres"],
    ["ports", "WEB_HOST_PORT", "65535"],
  ];

  for (const [caseIndex, [caseName, variable, foreignValue]] of cases.entries()) {
    const environment = await createAcceptanceEnvironment({
      runId: `platform-env-${caseName}`,
      evidenceDir: path.join(tempRoot, caseName),
      platformRoot,
      allocatePorts: async (count) => Array.from({ length: count }, (_, index) => 32500 + caseIndex * 20 + index),
    });
    const envValues = parseEnvFile(await readFile(environment.paths.envFile, "utf8"));
    envValues[variable] = foreignValue;
    await writeFile(environment.paths.envFile, serializeEnvFile(envValues), "utf8");
    let commandInvoked = false;

    await assert.rejects(
      cleanupAcceptanceProject({
        runId: environment.runId,
        evidenceDir: environment.paths.evidenceDir,
        platformRoot,
        executeCommand: async () => {
          commandInvoked = true;
          return { exitCode: 0 };
        },
      }),
      /foreign|owner|environment|credential|network|volume|port/i,
    );
    assert.equal(commandInvoked, false, `${caseName} environment mismatch invoked Docker`);
    await access(environment.paths.resourcesDir);
  }
});

test("cleanup removes only owned resources and preserves evidence", async (t) => {
  const tempRoot = await createTempRoot(t, "platform-compose-cleanup-");
  const evidenceDir = path.join(tempRoot, "owned-run");
  const foreignEvidenceDir = path.join(tempRoot, "foreign-run");
  const environment = await createAcceptanceEnvironment({
    runId: "platform-acceptance-cleanup",
    evidenceDir,
    platformRoot,
    allocatePorts: async (count) => Array.from({ length: count }, (_, index) => 32300 + index),
  });
  await writeFile(path.join(evidenceDir, "acceptance-manifest.json"), "{}\n", "utf8");
  await writeFile(path.join(tempRoot, "foreign-sentinel.txt"), "keep\n", "utf8");
  await writeFile(path.join(evidenceDir, "suite-evidence.json"), "{}\n", "utf8");
  await writeFile(path.join(tempRoot, "outside-evidence.txt"), "keep\n", "utf8");

  let invocation;
  const result = await cleanupAcceptanceProject({
    runId: environment.runId,
    evidenceDir,
    platformRoot,
    executeCommand: async (input) => {
      invocation = input;
      return { exitCode: 0 };
    },
  });

  assert.equal(result.cleaned, true);
  assert.equal(invocation.command, "docker");
  assert.deepEqual(invocation.args.slice(0, 8), [
    "compose",
    "-p",
    environment.projectName,
    "--env-file",
    environment.paths.envFile,
    "-f",
    acceptanceComposeFile,
    "down",
  ]);
  assert.deepEqual(invocation.args.slice(8), ["--volumes", "--remove-orphans"]);
  await assert.rejects(access(environment.paths.resourcesDir));
  await access(path.join(evidenceDir, "acceptance-manifest.json"));
  await access(path.join(evidenceDir, "suite-evidence.json"));
  await access(path.join(tempRoot, "foreign-sentinel.txt"));
  await access(path.join(tempRoot, "outside-evidence.txt"));
  assert.equal(foreignEvidenceDir.startsWith(tempRoot), true);
});

test("acceptance Compose uses only Platform contexts, loopback ports, run-owned volumes, and no host credentials", async () => {
  const contents = await readFile(acceptanceComposeFile, "utf8");
  assert.doesNotMatch(contents, /\.\.\/\.\.\/(?:Gateway|Loom|Tea|Hook)/i);
  assert.doesNotMatch(contents, /USERPROFILE|[\\/]\.neuro/i);
  assert.match(contents, /context:\s+\.\.\/\.\./);
  for (const doubleName of ["gateway", "loom", "tea"]) {
    assert.match(contents, new RegExp(`context:\\s+\\./${doubleName}-double`));
  }
  for (const variable of HOST_PORT_VARIABLES) {
    assert.match(contents, new RegExp(`127\\.0\\.0\\.1:\\$\\{${variable}[^}]*\\}:`));
  }
  for (const variable of [
    "POSTGRES_VOLUME_NAME",
    "VALKEY_VOLUME_NAME",
    "MINIO_VOLUME_NAME",
    "TEA_VOLUME_NAME",
  ]) {
    assert.match(contents, new RegExp(`name:\\s+["']?\\$\\{${variable}`));
  }
  assert.match(contents, /com\.neuro\.platform\.acceptance\.run-id/);
});

test("local Compose parameterizes every published port and binds it to loopback", async () => {
  const contents = await readFile(path.join(platformRoot, "deploy", "docker-compose.local.yml"), "utf8");
  for (const variable of HOST_PORT_VARIABLES) {
    assert.match(contents, new RegExp(`127\\.0\\.0\\.1:\\$\\{${variable}[^}]*\\}:`));
  }
});

test("Gateway double proves management to project token to chat runtime boundary", async (t) => {
  const { createGatewayDoubleServer } = await import(
    "../../../deploy/acceptance/gateway-double/server.mjs"
  );
  const baseUrl = await startDoubleServer(
    t,
    createGatewayDoubleServer({
      managementToken: "management-token",
      projectToken: "project-token",
      timeoutMs: 120,
    }),
  );

  const health = await fetch(`${baseUrl}/healthz`, {
    headers: { "x-request-id": "gateway-health-request" },
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-request-id"), "gateway-health-request");
  assert.equal((await responseJson(health)).fixture, true);

  const unauthorized = await fetch(`${baseUrl}/v1/internal/gateway/projects/project-1/api-access`);
  assert.equal(unauthorized.status, 401);
  assert.equal((await responseJson(unauthorized)).fixture, true);

  const ensured = await fetch(`${baseUrl}/v1/internal/gateway/benefit-projects/ensure`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": "management-token",
      "x-request-id": "gateway-management-request",
    },
    body: JSON.stringify({ serviceId: "service-1", userId: "user-1", serviceTitle: "Fixture Service" }),
  });
  const ensuredBody = await responseJson(ensured);
  assert.equal(ensured.status, 200);
  assert.equal(ensuredBody.fixture, true);
  assert.equal(ensuredBody.project.id, "benefit-service-1-user-1");
  assert.equal(ensured.headers.get("x-request-id"), "gateway-management-request");

  const access = await fetch(
    `${baseUrl}/v1/internal/gateway/projects/${encodeURIComponent(ensuredBody.project.id)}/api-access`,
    { headers: { "x-internal-api-key": "management-token" } },
  );
  const accessBody = await responseJson(access);
  assert.equal(access.status, 200);
  assert.equal(accessBody.fixture, true);
  assert.equal(accessBody.project.id, ensuredBody.project.id);
  assert.equal(accessBody.token, "project-token");

  const completion = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: "Bearer project-token",
      "content-type": "application/json",
      "x-request-id": "gateway-runtime-request",
    },
    body: JSON.stringify({ model: "fixture-chat", messages: [{ role: "user", content: "hello" }] }),
  });
  const completionBody = await responseJson(completion);
  assert.equal(completion.status, 200);
  assert.equal(completion.headers.get("x-request-id"), "gateway-runtime-request");
  assert.equal(completionBody.fixture, true);
  assert.equal(completionBody.choices[0].message.content, "Gateway fixture response");

  const stream = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { authorization: "Bearer project-token", "content-type": "application/json" },
    body: JSON.stringify({ model: "fixture-chat", messages: [], stream: true }),
  });
  const streamText = await stream.text();
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
  assert.equal(stream.headers.get("x-platform-fixture"), "true");
  assert.match(streamText, /Gateway fixture response/);
  assert.match(streamText, /data: \[DONE\]/);

  const rejected = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: "Bearer project-token",
      "content-type": "application/json",
      "x-platform-fixture": "reject",
    },
    body: JSON.stringify({ model: "fixture-chat", messages: [] }),
  });
  assert.equal(rejected.status, 429);
  assert.equal((await responseJson(rejected)).fixture, true);

  await assert.rejects(
    fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: "Bearer project-token",
        "content-type": "application/json",
        "x-platform-fixture": "timeout",
      },
      body: JSON.stringify({ model: "fixture-chat", messages: [] }),
      signal: AbortSignal.timeout(25),
    }),
    /abort|timeout/i,
  );
});

test("Tea double supports authenticated status, configuration, and ticket fixtures", async (t) => {
  const { createTeaDoubleServer } = await import(
    "../../../deploy/acceptance/tea-double/server.mjs"
  );
  const baseUrl = await startDoubleServer(
    t,
    createTeaDoubleServer({ authToken: "tea-token", loomBaseUrl: "http://loom:8765", timeoutMs: 120 }),
  );

  const health = await fetch(`${baseUrl}/ready`, { headers: { "x-request-id": "tea-ready-request" } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-request-id"), "tea-ready-request");
  assert.equal((await responseJson(health)).fixture, true);

  const unauthorized = await fetch(`${baseUrl}/v1/status`);
  assert.equal(unauthorized.status, 401);

  const authHeaders = { authorization: "Bearer tea-token", "content-type": "application/json" };
  const status = await fetch(`${baseUrl}/v1/status`, { headers: authHeaders });
  const statusBody = await responseJson(status);
  assert.equal(statusBody.fixture, true);
  assert.equal(statusBody.configuration_source, "loom-managed");
  assert.equal(statusBody.configuration.loom_base_url, "http://loom:8765");

  const configuration = await fetch(`${baseUrl}/v1/configuration`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      notifications_enabled: false,
      human_ticket_default_approval_policy: "manual",
      hook_ticket_default_approval_policy: "manual",
    }),
  });
  assert.equal((await responseJson(configuration)).config.notifications_enabled, false);

  const created = await fetch(`${baseUrl}/v1/tickets`, {
    method: "POST",
    headers: { ...authHeaders, "x-request-id": "tea-create-request" },
    body: JSON.stringify({ title: "Fixture ticket", description: "Acceptance boundary" }),
  });
  const ticket = await responseJson(created);
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("x-request-id"), "tea-create-request");
  assert.equal(ticket.fixture, true);
  assert.equal(ticket.id, "ticket-1");
  assert.equal(ticket.status, "open");

  const listed = await fetch(`${baseUrl}/v1/tickets?status=open`, { headers: authHeaders });
  const tickets = await responseJson(listed);
  assert.equal(listed.headers.get("x-platform-fixture"), "true");
  assert.equal(Array.isArray(tickets), true);
  assert.equal(tickets[0].id, ticket.id);

  const commentResponse = await fetch(`${baseUrl}/v1/tickets/${ticket.id}/comments`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ body: "Fixture comment" }),
  });
  assert.equal((await responseJson(commentResponse)).body, "Fixture comment");

  const runResponse = await fetch(`${baseUrl}/v1/tickets/${ticket.id}/run`, {
    method: "POST",
    headers: authHeaders,
  });
  const run = await responseJson(runResponse);
  assert.equal(run.fixture, true);
  assert.equal(run.ticket_id, ticket.id);
  assert.equal(run.status, "completed");

  const markdown = await fetch(`${baseUrl}/v1/tickets/${ticket.id}/export/markdown`, {
    headers: authHeaders,
  });
  assert.equal(markdown.status, 200);
  assert.equal(markdown.headers.get("x-platform-fixture"), "true");
  assert.match(markdown.headers.get("content-type") ?? "", /text\/markdown/);
  assert.match(await markdown.text(), /Fixture ticket/);

  const rejected = await fetch(`${baseUrl}/__fixture__/error`, {
    headers: { authorization: "Bearer tea-token" },
  });
  assert.equal(rejected.status, 503);
  assert.equal((await responseJson(rejected)).fixture, true);
});

test("Loom double exposes authenticated deterministic boundary fixtures", async (t) => {
  const { createLoomDoubleServer } = await import(
    "../../../deploy/acceptance/loom-double/server.mjs"
  );
  const baseUrl = await startDoubleServer(
    t,
    createLoomDoubleServer({ authToken: "loom-token", timeoutMs: 120 }),
  );

  const health = await fetch(`${baseUrl}/health`, { headers: { "x-request-id": "loom-health-request" } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-request-id"), "loom-health-request");
  assert.equal(health.headers.get("x-platform-fixture"), "true");
  assert.equal((await responseJson(health)).fixture, true);

  const unauthorized = await fetch(`${baseUrl}/__fixture__/success`);
  assert.equal(unauthorized.status, 401);

  const success = await fetch(`${baseUrl}/__fixture__/success`, {
    headers: { authorization: "Bearer loom-token", "x-request-id": "loom-fixture-request" },
  });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("x-request-id"), "loom-fixture-request");
  assert.equal((await responseJson(success)).fixture, true);

  const unknown = await fetch(`${baseUrl}/unsupported`, {
    headers: { authorization: "Bearer loom-token", "x-request-id": "loom-unknown-request" },
  });
  const unknownBody = await responseJson(unknown);
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("x-request-id"), "loom-unknown-request");
  assert.equal(unknownBody.fixture, true);
  assert.equal(unknownBody.error.code, "FIXTURE_NOT_FOUND");

  const error = await fetch(`${baseUrl}/__fixture__/error`, {
    headers: { authorization: "Bearer loom-token" },
  });
  assert.equal(error.status, 503);
  assert.equal((await responseJson(error)).fixture, true);

  await assert.rejects(
    fetch(`${baseUrl}/__fixture__/timeout`, {
      headers: { authorization: "Bearer loom-token" },
      signal: AbortSignal.timeout(25),
    }),
    /abort|timeout/i,
  );
});

test("acceptance Compose command runner times out and settles once", async () => {
  const { runAcceptanceComposeCommand } = await import("../compose.mjs");
  assert.equal(typeof runAcceptanceComposeCommand, "function");
  const startedAt = Date.now();
  const result = await runAcceptanceComposeCommand({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 1000)"],
    cwd: process.cwd(),
    env: process.env,
    timeoutMs: 25,
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.timedOut, true);
  assert.match(result.error, /timed out/i);
  assert.equal(Date.now() - startedAt < 500, true);
});
