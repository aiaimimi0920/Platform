import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { tsImport } from "tsx/esm/api";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(moduleDir, "../..");
const SCHEMA_VERSION = 1;
export const DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS = 1_000;
export const DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS = 2_000;

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!value) throw new TypeError("External probe base URL is required");
  return value;
}

function normalizeTimeout(value, fallback = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS) {
  const timeoutMs = Number(value ?? fallback);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("External probe timeout must be a positive number");
  }
  return timeoutMs;
}

function normalizeHeaders(input) {
  return new Headers(input ?? {});
}

function redactText(value, secrets = []) {
  let output = String(value ?? "");
  for (const secret of secrets) {
    const normalized = String(secret ?? "");
    if (normalized) output = output.split(normalized).join("[REDACTED]");
  }
  return output
    .replace(/Bearer\s+[^\s,;)}]+/gi, "Bearer [REDACTED]")
    .replace(/(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|secret)\s*[=:]\s*[^\s,;}]+/gi, "credential=[REDACTED]");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractErrorMessage(body, statusCode) {
  if (isRecord(body)) {
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (isRecord(body.error) && typeof body.error.message === "string" && body.error.message.trim()) {
      return body.error.message;
    }
    if (typeof body.message === "string" && body.message.trim()) return body.message;
  }
  if (typeof body === "string" && body.trim()) return body;
  return `External request failed with status ${statusCode}`;
}

async function parseResponseBody(response) {
  const raw = await response.text();
  if (!raw.trim()) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function responseRequestId(response, body, fallback) {
  if (response?.headers) {
    const headerId = response.headers.get("x-request-id") || response.headers.get("x-correlation-id");
    if (headerId?.trim()) return headerId.trim();
  }
  if (isRecord(body) && typeof body.requestId === "string" && body.requestId.trim()) return body.requestId;
  if (isRecord(body) && isRecord(body.error) && typeof body.error.requestId === "string") return body.error.requestId;
  return fallback;
}

function isTimeoutError(error) {
  const name = error && typeof error === "object" ? error.name : "";
  const code = error && typeof error === "object" ? error.code : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    code === "ABORT_ERR" ||
    code === "UND_ERR_ABORTED" ||
    /(?:timed?\s*out|timeout)/i.test(message)
  );
}

function classifyThrownError(error) {
  return isTimeoutError(error) ? "timeout" : "unavailable";
}

async function fetchWithTimeout(fetchFn, input, init, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(normalizeTimeout(timeoutMs));
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetchFn(input, { ...init, signal });
}

async function requestJson({ fetchFn, url, method, headers, body, timeoutMs, requestId }) {
  const response = await fetchWithTimeout(
    fetchFn,
    url,
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    timeoutMs,
  );
  const responseBody = await parseResponseBody(response);
  const observedRequestId = responseRequestId(response, responseBody, null);
  return {
    statusCode: response.status,
    requestId: observedRequestId || requestId,
    responseRequestId: observedRequestId,
    body: responseBody,
    error: response.ok ? null : extractErrorMessage(responseBody, response.status),
  };
}

function requestHeaders({ requestId, authKind, token, fixtureMode, contentType = true }) {
  const headers = {
    accept: "application/json",
    "x-request-id": requestId,
    "x-correlation-id": requestId,
  };
  if (contentType) headers["content-type"] = "application/json";
  if (authKind === "management") headers["x-internal-api-key"] = token;
  if (authKind === "bearer") headers.authorization = `Bearer ${token}`;
  if (fixtureMode) headers["x-platform-fixture"] = fixtureMode;
  return headers;
}

export function createGatewayContractClient({
  baseUrl,
  managementToken,
  projectToken,
  fetchFn = fetch,
  requestTimeoutMs = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const timeoutMs = normalizeTimeout(requestTimeoutMs);
  if (!String(managementToken ?? "").trim()) throw new TypeError("Gateway management token is required");
  if (!String(projectToken ?? "").trim()) throw new TypeError("Gateway project token is required");

  const request = ({ path: requestPath, method, body, authKind, fixtureMode, requestId, fetchOverride }) =>
    requestJson({
      fetchFn: fetchOverride ?? fetchFn,
      url: `${normalizedBaseUrl}${requestPath}`,
      method,
      headers: requestHeaders({
        requestId,
        authKind,
        token: authKind === "management" ? managementToken : projectToken,
        fixtureMode,
      }),
      body,
      timeoutMs,
      requestId,
    });

  return {
    ensureProject: ({ serviceId, userId, serviceTitle, requestId, fixtureMode, fetchFn: fetchOverride } = {}) =>
      request({
        path: "/v1/internal/gateway/benefit-projects/ensure",
        method: "POST",
        authKind: "management",
        fixtureMode,
        requestId,
        fetchOverride,
        body: { serviceId, userId, ...(serviceTitle ? { serviceTitle } : {}) },
      }),
    complete: ({ model = "fixture", messages = [{ role: "user", content: "probe" }], stream, requestId, fixtureMode, fetchFn: fetchOverride } = {}) =>
      request({
        path: "/v1/chat/completions",
        method: "POST",
        authKind: "bearer",
        fixtureMode,
        requestId,
        fetchOverride,
        body: { model, messages, ...(stream === undefined ? {} : { stream }) },
      }),
  };
}

export function createLoomContractClient({
  baseUrl,
  authToken,
  fetchFn = fetch,
  requestTimeoutMs = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const timeoutMs = normalizeTimeout(requestTimeoutMs);
  if (!String(authToken ?? "").trim()) throw new TypeError("Loom auth token is required");

  return {
    getStatus: ({ requestId, fixtureMode, fetchFn: fetchOverride } = {}) =>
      requestJson({
        fetchFn: fetchOverride ?? fetchFn,
        url: `${normalizedBaseUrl}/v1/status`,
        method: "GET",
        headers: requestHeaders({ requestId, authKind: "bearer", token: authToken, fixtureMode, contentType: false }),
        timeoutMs,
        requestId,
      }),
  };
}

let coreTeaClientPromise;

async function loadCoreTeaClientFactory() {
  coreTeaClientPromise ??= tsImport(
    pathToFileURL(path.join(platformRoot, "core/src/modules/tea/client.ts")).href,
    import.meta.url,
  ).then((module) => module.createTeaClient);
  return coreTeaClientPromise;
}

async function invokeTeaCreateTicket({
  createTeaClient,
  baseUrl,
  authToken,
  fetchFn,
  requestTimeoutMs,
  requestId,
  fixtureMode,
}) {
  let capturedResponse = null;
  const wrappedFetch = async (input, init = {}) => {
    const headers = normalizeHeaders(init.headers);
    headers.set("x-request-id", requestId);
    headers.set("x-correlation-id", requestId);
    if (fixtureMode) headers.set("x-platform-fixture", fixtureMode);
    capturedResponse = await fetchWithTimeout(
      fetchFn,
      input,
      { ...init, headers },
      requestTimeoutMs,
    );
    return capturedResponse;
  };
  const client = createTeaClient({ baseUrl, authToken, fetchFn: wrappedFetch });
  try {
    const body = await client.createTicket({ title: "Platform acceptance probe", description: "Contract harness" });
    const observedRequestId = responseRequestId(capturedResponse, body, null);
    return {
      statusCode: capturedResponse?.status ?? 200,
      requestId: observedRequestId || requestId,
      responseRequestId: observedRequestId,
      body,
      error: null,
    };
  } catch (error) {
    const responseBody = error && typeof error === "object" && "responseBody" in error ? error.responseBody : null;
    const statusCode = error && typeof error === "object" && Number.isInteger(error.statusCode)
      ? error.statusCode
      : capturedResponse?.status ?? null;
    if (statusCode === null) throw error;
    const observedRequestId = responseRequestId(capturedResponse, responseBody, null);
    return {
      statusCode,
      requestId: observedRequestId || requestId,
      responseRequestId: observedRequestId,
      body: responseBody,
      error,
    };
  }
}

async function runOperation({
  id,
  method,
  path: operationPath,
  requestId,
  expectedOutcome,
  invoke,
  secrets,
}) {
  try {
    const result = await invoke();
    const statusCode = Number.isInteger(result?.statusCode) ? result.statusCode : null;
    const outcome = statusCode !== null && statusCode >= 200 && statusCode < 300 ? "success" : "reject";
    const errorMessage = result?.error instanceof Error ? result.error.message : result?.error;
    const responseId = result?.responseRequestId ?? null;
    return {
      id,
      method,
      path: operationPath,
      requestId: result?.requestId || requestId,
      sentRequestId: requestId,
      responseRequestId: responseId,
      requestIdMatched: statusCode === null ? null : responseId === requestId,
      statusCode,
      outcome,
      expectedOutcome,
      redactedError: outcome === "success" ? null : redactText(errorMessage || extractErrorMessage(result?.body, statusCode), secrets),
    };
  } catch (error) {
    const outcome = classifyThrownError(error);
    return {
      id,
      method,
      path: operationPath,
      requestId,
      sentRequestId: requestId,
      responseRequestId: null,
      requestIdMatched: null,
      statusCode: null,
      outcome,
      expectedOutcome,
      redactedError: redactText(error instanceof Error ? error.message : String(error), secrets),
    };
  }
}

function createEvidence(targetCategory, correlationId, operations, recordedAt = new Date().toISOString()) {
  const operationsMatch = operations.every((operation) => {
    const outcomeMatches = operation.outcome === operation.expectedOutcome;
    const requestIdMatches = operation.statusCode === null
      ? operation.requestIdMatched === null
      : operation.requestIdMatched === true;
    return outcomeMatches && requestIdMatches;
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    targetCategory,
    recordedAt,
    correlationId,
    status: operationsMatch ? "passed" : "failed",
    operations,
  };
}

function operationRequestId(correlationId, id) {
  return `${correlationId}:${id}`;
}

export async function runGatewayContractProbe({
  baseUrl,
  managementToken,
  projectToken,
  fetchFn = fetch,
  unavailableFetchFn = async () => {
    throw new TypeError("Gateway boundary unavailable");
  },
  requestTimeoutMs = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
  correlationId = `acceptance-gateway-${randomUUID()}`,
  recordedAt,
} = {}) {
  const client = createGatewayContractClient({ baseUrl, managementToken, projectToken, fetchFn, requestTimeoutMs });
  const secrets = [managementToken, projectToken];
  const specs = [
    {
      id: "ensure-project",
      method: "POST",
      path: "/v1/internal/gateway/benefit-projects/ensure",
      expectedOutcome: "success",
      invoke: (requestId) => client.ensureProject({ serviceId: "probe-service", userId: "probe-user", requestId }),
    },
    {
      id: "completion-success",
      method: "POST",
      path: "/v1/chat/completions",
      expectedOutcome: "success",
      invoke: (requestId) => client.complete({ requestId }),
    },
    {
      id: "completion-reject",
      method: "POST",
      path: "/v1/chat/completions",
      expectedOutcome: "reject",
      invoke: (requestId) => client.complete({ requestId, fixtureMode: "reject" }),
    },
    {
      id: "completion-timeout",
      method: "POST",
      path: "/v1/chat/completions",
      expectedOutcome: "timeout",
      invoke: (requestId) => client.complete({ requestId, fixtureMode: "timeout" }),
    },
    {
      id: "completion-unavailable",
      method: "POST",
      path: "/v1/chat/completions",
      expectedOutcome: "unavailable",
      invoke: (requestId) => client.complete({ requestId, fetchFn: unavailableFetchFn }),
    },
  ];
  const operations = [];
  for (const spec of specs) {
    operations.push(
      await runOperation({
        ...spec,
        requestId: operationRequestId(correlationId, spec.id),
        invoke: () => spec.invoke(operationRequestId(correlationId, spec.id)),
        secrets,
      }),
    );
  }
  return createEvidence("gateway", correlationId, operations, recordedAt);
}

export async function runLoomContractProbe({
  baseUrl,
  authToken,
  fetchFn = fetch,
  unavailableFetchFn = async () => {
    throw new TypeError("Loom boundary unavailable");
  },
  requestTimeoutMs = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
  correlationId = `acceptance-loom-${randomUUID()}`,
  recordedAt,
} = {}) {
  const client = createLoomContractClient({ baseUrl, authToken, fetchFn, requestTimeoutMs });
  const secrets = [authToken];
  const specs = [
    { id: "status-success", fixtureMode: undefined, expectedOutcome: "success", fetchOverride: undefined },
    { id: "status-reject", fixtureMode: "reject", expectedOutcome: "reject", fetchOverride: undefined },
    { id: "status-timeout", fixtureMode: "timeout", expectedOutcome: "timeout", fetchOverride: undefined },
    { id: "status-unavailable", fixtureMode: undefined, expectedOutcome: "unavailable", fetchOverride: unavailableFetchFn },
  ];
  const operations = [];
  for (const spec of specs) {
    const requestId = operationRequestId(correlationId, spec.id);
    operations.push(
      await runOperation({
        id: spec.id,
        method: "GET",
        path: "/v1/status",
        requestId,
        expectedOutcome: spec.expectedOutcome,
        secrets,
        invoke: () => client.getStatus({ requestId, fixtureMode: spec.fixtureMode, fetchFn: spec.fetchOverride }),
      }),
    );
  }
  return createEvidence("loom", correlationId, operations, recordedAt);
}

export async function runTeaContractProbe({
  baseUrl,
  authToken,
  fetchFn = fetch,
  unavailableFetchFn = async () => {
    throw new TypeError("Tea boundary unavailable");
  },
  requestTimeoutMs = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
  correlationId = `acceptance-tea-${randomUUID()}`,
  recordedAt,
  teaClientFactory,
} = {}) {
  const createTeaClient = teaClientFactory ?? (await loadCoreTeaClientFactory());
  const secrets = [authToken];
  const specs = [
    { id: "create-ticket-success", fixtureMode: undefined, expectedOutcome: "success", fetchOverride: fetchFn },
    { id: "create-ticket-reject", fixtureMode: "reject", expectedOutcome: "reject", fetchOverride: fetchFn },
    { id: "create-ticket-timeout", fixtureMode: "timeout", expectedOutcome: "timeout", fetchOverride: fetchFn },
    { id: "create-ticket-unavailable", fixtureMode: undefined, expectedOutcome: "unavailable", fetchOverride: unavailableFetchFn },
  ];
  const operations = [];
  for (const spec of specs) {
    const requestId = operationRequestId(correlationId, spec.id);
    operations.push(
      await runOperation({
        id: spec.id,
        method: "POST",
        path: "/v1/tickets",
        requestId,
        expectedOutcome: spec.expectedOutcome,
        secrets,
        invoke: () =>
          invokeTeaCreateTicket({
            createTeaClient,
            baseUrl,
            authToken,
            fetchFn: spec.fetchOverride,
            requestTimeoutMs,
            requestId,
            fixtureMode: spec.fixtureMode,
          }),
      }),
    );
  }
  return createEvidence("tea", correlationId, operations, recordedAt);
}

async function startServer(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("External probe fixture did not expose a port");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export async function runExternalProbe({
  target,
  requestTimeoutMs = DEFAULT_EXTERNAL_PROBE_REQUEST_TIMEOUT_MS,
  fixtureTimeoutMs = DEFAULT_EXTERNAL_PROBE_FIXTURE_TIMEOUT_MS,
  correlationId,
  recordedAt,
} = {}) {
  const targetName = String(target ?? "").trim().toLowerCase();
  if (!["gateway", "loom", "tea"].includes(targetName)) {
    throw new Error("Unknown external probe target; expected gateway, loom, or tea");
  }

  let server;
  let baseUrl;
  if (targetName === "gateway") {
    const managementToken = "probe-management-token";
    const projectToken = "probe-project-token";
    server = (await import(new URL("../../deploy/acceptance/gateway-double/server.mjs", import.meta.url).href)).createGatewayDoubleServer({
      managementToken,
      projectToken,
      timeoutMs: fixtureTimeoutMs,
    });
    baseUrl = await startServer(server);
    try {
      return await runGatewayContractProbe({
        baseUrl,
        managementToken,
        projectToken,
        requestTimeoutMs,
        correlationId: correlationId ?? `acceptance-gateway-${randomUUID()}`,
        recordedAt,
      });
    } finally {
      await closeServer(server);
    }
  }

  const authToken = targetName === "loom" ? "probe-loom-token" : "probe-tea-token";
  if (targetName === "loom") {
    server = (await import(new URL("../../deploy/acceptance/loom-double/server.mjs", import.meta.url).href)).createLoomDoubleServer({
      authToken,
      timeoutMs: fixtureTimeoutMs,
    });
    baseUrl = await startServer(server);
    try {
      return await runLoomContractProbe({
        baseUrl,
        authToken,
        requestTimeoutMs,
        correlationId: correlationId ?? `acceptance-loom-${randomUUID()}`,
        recordedAt,
      });
    } finally {
      await closeServer(server);
    }
  }

  server = (await import(new URL("../../deploy/acceptance/tea-double/server.mjs", import.meta.url).href)).createTeaDoubleServer({
    authToken,
    timeoutMs: fixtureTimeoutMs,
  });
  baseUrl = await startServer(server);
  try {
    return await runTeaContractProbe({
      baseUrl,
      authToken,
      requestTimeoutMs,
      correlationId: correlationId ?? `acceptance-tea-${randomUUID()}`,
      recordedAt,
    });
  } finally {
    await closeServer(server);
  }
}

function parseTarget(argv) {
  const index = argv.indexOf("--target");
  return index >= 0 ? argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = parseTarget(process.argv.slice(2));
  if (!target) {
    console.error("Usage: node scripts/acceptance/external-probe.mjs --target gateway|loom|tea");
    process.exitCode = 2;
  } else {
    try {
      const evidence = await runExternalProbe({ target });
      console.log(JSON.stringify(evidence, null, 2));
      process.exitCode = evidence.status === "passed" ? 0 : 1;
    } catch (error) {
      console.error(redactText(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  }
}
