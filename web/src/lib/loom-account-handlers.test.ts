import assert from "node:assert/strict";
import { test } from "node:test";
import { handleLoomAccountRequest } from "./loom-account-handlers";
import { loomAuthorizationPath, parseLoomAccountAuthorization } from "./loom-account-authorization";

const request = (body: string, headers: HeadersInit = {}) => new Request("https://platform.example/api/loom/account/exchange", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body,
});

test("native BFF rejects oversized, cross-origin, malformed and approval requests before forwarding", async () => {
  let calls = 0;
  const send = async () => { calls++; return {}; };
  assert.equal((await handleLoomAccountRequest(request("x".repeat(4097)), "exchange", send)).status, 413);
  assert.equal((await handleLoomAccountRequest(request("{}", { origin: "https://other.example" }), "exchange", send)).status, 403);
  assert.equal((await handleLoomAccountRequest(request("{"), "exchange", send)).status, 400);
  assert.equal((await handleLoomAccountRequest(request("{}"), "approve", send)).status, 404);
  assert.equal(calls, 0);
});

test("native BFF forwards only body and fixed route, never caller identity headers or cookies", async () => {
  const response = await handleLoomAccountRequest(request('{"requestId":"test"}', {
    cookie: "session=fake", "x-neuro-user-id": "attacker", "x-internal-api-token": "fake",
  }), "exchange", async (path, options) => {
    assert.equal(path, "/internal/loom-account/exchange");
    assert.deepEqual(options, { method: "POST", body: { requestId: "test" } });
    return { status: "pending" };
  });
  assert.deepEqual(await response.json(), { status: "pending" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("native BFF keeps revocation distinguishable and does not expose internal failure detail", async () => {
  const revoked = await handleLoomAccountRequest(request("{}"), "status", async () => {
    throw Object.assign(new Error("private backend detail"), { status: 401, code: "device_session_unavailable" });
  });
  assert.deepEqual(await revoked.json(), { error: { code: "device_session_unavailable" } });
  const failed = await handleLoomAccountRequest(request("{}"), "status", async () => { throw new Error("private detail"); });
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("private"), false);
});

test("authorization metadata roundtrips without allowing callback URLs, arrays or control characters", () => {
  const params = { requestId: "a".repeat(64), codeChallenge: "b".repeat(43), publicKey: "A".repeat(43) + "=",
    deviceName: "我的电脑", expiresAtMs: "1800000000000" };
  const grant = parseLoomAccountAuthorization(params);
  assert.ok(grant);
  const url = new URL(loomAuthorizationPath(grant), "https://platform.example");
  assert.equal(url.pathname, "/loom/authorize");
  assert.deepEqual(parseLoomAccountAuthorization(Object.fromEntries(url.searchParams)), grant);
  assert.equal(url.searchParams.has("codeVerifier"), false);
  assert.equal(parseLoomAccountAuthorization({ ...params, requestId: [params.requestId] }), null);
  assert.equal(parseLoomAccountAuthorization({ ...params, deviceName: "a\nb" }), null);
});
