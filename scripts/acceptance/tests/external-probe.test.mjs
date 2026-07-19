import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import test from "node:test";

import { createGatewayDoubleServer } from "../../../deploy/acceptance/gateway-double/server.mjs";
import { createLoomDoubleServer } from "../../../deploy/acceptance/loom-double/server.mjs";
import { createTeaDoubleServer } from "../../../deploy/acceptance/tea-double/server.mjs";
import {
  DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS,
  DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
  createGatewayContractClient,
  createLoomContractClient,
  runExternalProbe,
  runGatewayContractProbe,
  runLoomContractProbe,
  runTeaContractProbe,
} from "../external-probe.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function response(body, status = 200, requestId = "fixture-request") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}

function assertEvidenceShape(evidence, target, secrets) {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.targetCategory, target);
  assert.match(evidence.recordedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(evidence.correlationId, new RegExp(`^acceptance-${target}-`));
  assert.ok(Array.isArray(evidence.operations));
  assert.deepEqual(
    new Set(evidence.operations.map((operation) => operation.outcome)),
    new Set(["success", "reject", "timeout", "unavailable"]),
  );
  for (const operation of evidence.operations) {
    assert.equal(typeof operation.method, "string");
    assert.equal(operation.path.startsWith("/"), true);
    assert.equal(typeof operation.requestId, "string");
    assert.equal(typeof operation.sentRequestId, "string");
    assert.ok(operation.responseRequestId === null || typeof operation.responseRequestId === "string");
    assert.ok(operation.statusCode === null || Number.isInteger(operation.statusCode));
    if (operation.statusCode === null) {
      assert.equal(operation.requestIdMatched, null);
    } else {
      assert.equal(operation.responseRequestId, operation.sentRequestId);
      assert.equal(operation.requestIdMatched, true);
    }
    assert.ok(operation.redactedError === null || typeof operation.redactedError === "string");
  }
  const serialized = JSON.stringify(evidence);
  for (const secret of secrets) assert.equal(serialized.includes(secret), false);
}

test("Gateway contract client uses the management and project auth contracts on canonical paths", async () => {
  const calls = [];
  const client = createGatewayContractClient({
    baseUrl: "http://gateway.test/",
    managementToken: "gateway-management-secret",
    projectToken: "gateway-project-secret",
    fetchFn: async (input, init) => {
      calls.push({ url: input.toString(), init });
      const url = new URL(input);
      if (url.pathname.includes("benefit-projects/ensure")) {
        return response({ project: { id: "project-1" } }, 200, "gateway-ensure");
      }
      return response({ id: "completion-1" }, 200, "gateway-completion");
    },
  });

  await client.ensureProject({ serviceId: "service-1", userId: "user-1", requestId: "corr-ensure" });
  await client.complete({ model: "fixture", messages: [], requestId: "corr-complete" });

  assert.deepEqual(
    calls.map((call) => [new URL(call.url).pathname, call.init.method]),
    [
      ["/v1/internal/gateway/benefit-projects/ensure", "POST"],
      ["/v1/chat/completions", "POST"],
    ],
  );
  const ensureHeaders = Object.fromEntries(new Headers(calls[0].init.headers));
  const completionHeaders = Object.fromEntries(new Headers(calls[1].init.headers));
  assert.equal(ensureHeaders["x-internal-api-key"], "gateway-management-secret");
  assert.equal(completionHeaders.authorization, "Bearer gateway-project-secret");
  assert.equal(ensureHeaders["x-request-id"], "corr-ensure");
  assert.equal(completionHeaders["x-request-id"], "corr-complete");
});

test("Loom contract client uses the bearer auth contract and canonical status path", async () => {
  const calls = [];
  const client = createLoomContractClient({
    baseUrl: "http://loom.test/",
    authToken: "loom-secret",
    fetchFn: async (input, init) => {
      calls.push({ url: input.toString(), init });
      return response({ ok: true }, 200, "loom-status");
    },
  });

  await client.getStatus({ requestId: "corr-loom" });

  assert.equal(new URL(calls[0].url).pathname, "/v1/status");
  assert.equal(calls[0].init.method, "GET");
  const headers = Object.fromEntries(new Headers(calls[0].init.headers));
  assert.equal(headers.authorization, "Bearer loom-secret");
  assert.equal(headers["x-request-id"], "corr-loom");
});

test("Gateway external probe records all contract outcomes and redacts credentials", async () => {
  const managementToken = "gateway-management-secret";
  const projectToken = "gateway-project-secret";
  const server = createGatewayDoubleServer({
    managementToken,
    projectToken,
    timeoutMs: DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS,
  });
  const baseUrl = await listen(server);
  try {
    const evidence = await runGatewayContractProbe({
      baseUrl,
      managementToken,
      projectToken,
      requestTimeoutMs: DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
      correlationId: "acceptance-gateway-test",
      unavailableFetchFn: async () => {
        throw new Error(`gateway unavailable with ${projectToken}`);
      },
    });
    assertEvidenceShape(evidence, "gateway", [managementToken, projectToken]);
    assert.equal(evidence.status, "passed");
    assert.equal(
      evidence.operations.find((operation) => operation.id === "ensure-project").path,
      "/v1/internal/gateway/benefit-projects/ensure",
    );
  } finally {
    await close(server);
  }
});

test("external probe default timeout budget tolerates modest healthy-response latency", async () => {
  const previousFetch = globalThis.fetch;
  const delayMs = 150;
  globalThis.fetch = (async (input, init = {}) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      const signal = init.signal;
      if (!signal) return;
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted", "AbortError"));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
    return previousFetch(input, init);
  });

  try {
    const evidence = await runExternalProbe({
      target: "gateway",
      correlationId: "acceptance-gateway-timeout-budget",
    });
    assert.equal(evidence.status, "passed");
    assert.equal(
      evidence.operations.find((operation) => operation.id === "ensure-project")?.outcome,
      "success",
    );
    assert.equal(
      evidence.operations.find((operation) => operation.id === "completion-timeout")?.outcome,
      "timeout",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("external probe fails when a response request id mismatches the emitted request id", async () => {
  const managementToken = "gateway-management-secret";
  const projectToken = "gateway-project-secret";
  const server = createGatewayDoubleServer({
    managementToken,
    projectToken,
    timeoutMs: DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS,
  });
  const baseUrl = await listen(server);
  const mismatchFetch = async (input, init) => {
    const response = await fetch(input, init);
    const headers = new Headers(response.headers);
    headers.set("x-request-id", "mismatched-response-id");
    return new Response(await response.text(), {
      status: response.status,
      headers,
    });
  };

  try {
    const evidence = await runGatewayContractProbe({
      baseUrl,
      managementToken,
      projectToken,
      fetchFn: mismatchFetch,
      requestTimeoutMs: DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
      correlationId: "acceptance-gateway-request-id-mismatch",
    });
    const ensure = evidence.operations.find((operation) => operation.id === "ensure-project");
    assert.equal(ensure?.requestIdMatched, false);
    assert.equal(evidence.status, "failed");
  } finally {
    await close(server);
  }
});

test("Loom external probe records all contract outcomes and redacts credentials", async () => {
  const authToken = "loom-secret";
  const server = createLoomDoubleServer({
    authToken,
    timeoutMs: DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS,
  });
  const baseUrl = await listen(server);
  try {
    const evidence = await runLoomContractProbe({
      baseUrl,
      authToken,
      requestTimeoutMs: DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
      correlationId: "acceptance-loom-test",
      unavailableFetchFn: async () => {
        throw new Error(`loom unavailable with ${authToken}`);
      },
    });
    assertEvidenceShape(evidence, "loom", [authToken]);
    assert.equal(evidence.status, "passed");
    assert.equal(evidence.operations.find((operation) => operation.id === "status-success").path, "/v1/status");
  } finally {
    await close(server);
  }
});

test("Tea external probe uses the Core createTeaClient path for success and errors", async () => {
  const authToken = "tea-secret";
  const server = createTeaDoubleServer({
    authToken,
    timeoutMs: DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS,
  });
  const baseUrl = await listen(server);
  try {
    const evidence = await runTeaContractProbe({
      baseUrl,
      authToken,
      requestTimeoutMs: DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
      correlationId: "acceptance-tea-test",
      unavailableFetchFn: async () => {
        throw new Error(`tea unavailable with ${authToken}`);
      },
    });
    assertEvidenceShape(evidence, "tea", [authToken]);
    assert.equal(evidence.status, "passed");
    assert.equal(evidence.operations.find((operation) => operation.id === "create-ticket-success").method, "POST");
    assert.equal(evidence.operations.find((operation) => operation.id === "create-ticket-success").path, "/v1/tickets");
  } finally {
    await close(server);
  }
});

test("external probe CLI emits structured evidence without fixture tokens", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/acceptance/external-probe.mjs", "--target", "gateway"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assertEvidenceShape(evidence, "gateway", ["probe-management-token", "probe-project-token"]);
  assert.equal(result.stdout.includes("probe-management-token"), false);
  assert.equal(result.stdout.includes("probe-project-token"), false);
});
