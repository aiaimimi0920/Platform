import assert from "node:assert/strict";
import test from "node:test";

import type { HonorProjectPanelView, UserSummary } from "@neuro/contracts";

import { createDependencyResult } from "@/lib/dependency-result";

import {
  combineProjectCenterDependencies,
  createProjectDependencyFailure,
} from "./model";

const emptyProjectPanel: HonorProjectPanelView = {
  investmentProjectCatalog: [],
  memberships: [],
  projectCatalog: [],
};

const user = { id: "user-1", username: "owner-1" } as UserSummary;

test("project center keeps a successful empty directory empty", () => {
  const result = combineProjectCenterDependencies({
    currentUser: createDependencyResult({ state: "ready", data: user }),
    projectPanel: createDependencyResult({ state: "ready", data: emptyProjectPanel }),
  });

  assert.equal(result.state, "empty");
  assert.equal(result.data, null);
  assert.deepEqual(result.failures, []);
});

test("project center keeps the primary project directory unavailable instead of showing a fake empty catalog", () => {
  const result = combineProjectCenterDependencies({
    currentUser: createDependencyResult({ state: "ready", data: user }),
    projectPanel: createDependencyResult({
      state: "unavailable",
      failures: [{ source: "honor-projects", message: "项目目录暂不可用。" }],
      retry: { retryable: true, retryAfterMs: null },
    }),
  });

  assert.equal(result.state, "unavailable");
  assert.equal(result.data, null);
  assert.equal(result.failures[0]?.source, "honor-projects");
});

test("project center keeps a primary authorization failure distinct from a ready account source", () => {
  const result = combineProjectCenterDependencies({
    currentUser: createDependencyResult({ state: "ready", data: user }),
    projectPanel: createDependencyResult({
      state: "unauthorized",
      failures: [{ source: "honor-projects", message: "当前账户无权访问项目目录。" }],
      retry: { retryable: false, retryAfterMs: null },
    }),
  });

  assert.equal(result.state, "unauthorized");
  assert.equal(result.data, null);
});

test("project center keeps primary authorization non-retryable when an auxiliary source times out", () => {
  const result = combineProjectCenterDependencies({
    currentUser: createDependencyResult({
      state: "unavailable",
      failures: [{ source: "account-user", message: "账户信息暂不可用。" }],
      retry: { retryable: true, retryAfterMs: null },
    }),
    projectPanel: createDependencyResult({
      state: "unauthorized",
      failures: [{ source: "honor-projects", message: "当前账户无权访问项目目录。" }],
      retry: { retryable: false, retryAfterMs: null },
    }),
  });

  assert.equal(result.state, "unauthorized");
  assert.deepEqual(result.retry, { retryable: false, retryAfterMs: null });
  assert.equal(result.failures.length, 2);
});

test("project center keeps an unauthorized dependency distinct when every source is unauthorized", () => {
  const result = combineProjectCenterDependencies({
    currentUser: createDependencyResult({
      state: "unauthorized",
      failures: [{ source: "account-user", message: "当前账户无权访问。" }],
      retry: { retryable: false, retryAfterMs: null },
    }),
    projectPanel: createDependencyResult({
      state: "unauthorized",
      failures: [{ source: "honor-projects", message: "当前账户无权访问。" }],
      retry: { retryable: false, retryAfterMs: null },
    }),
  });

  assert.equal(result.state, "unauthorized");
  assert.equal(result.data, null);
  assert.equal(result.failures.length, 2);
});

test("project center classifies 401 separately from retryable timeout and 5xx failures", () => {
  const unauthorized = createProjectDependencyFailure<HonorProjectPanelView>({
    error: Object.assign(new Error("token=private-token"), { statusCode: 401 }),
    message: "项目目录暂不可用。",
    source: "honor-projects",
    unauthorizedMessage: "当前账户无权访问项目目录。",
  });
  const timeout = createProjectDependencyFailure<HonorProjectPanelView>({
    error: Object.assign(new Error("request timed out"), { code: "INTERNAL_REQUEST_TIMEOUT" }),
    message: "项目目录暂不可用。",
    source: "honor-projects",
  });
  const serverError = createProjectDependencyFailure<HonorProjectPanelView>({
    error: Object.assign(new Error("database password=secret"), { code: "INTERNAL_SERVER_ERROR" }),
    message: "项目目录暂不可用。",
    source: "honor-projects",
  });

  assert.equal(unauthorized.state, "unauthorized");
  assert.equal(unauthorized.failures[0]?.message, "当前账户无权访问项目目录。");
  assert.deepEqual(unauthorized.retry, { retryable: false, retryAfterMs: null });
  assert.doesNotMatch(unauthorized.failures[0]?.diagnostics ?? "", /private-token/);
  assert.equal(timeout.state, "unavailable");
  assert.deepEqual(timeout.retry, { retryable: true, retryAfterMs: null });
  assert.equal(serverError.state, "unavailable");
  assert.deepEqual(serverError.retry, { retryable: true, retryAfterMs: null });
  assert.doesNotMatch(serverError.failures[0]?.diagnostics ?? "", /password=secret/);
});
