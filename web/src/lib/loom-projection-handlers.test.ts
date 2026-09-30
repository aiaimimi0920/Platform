import assert from "node:assert/strict";
import { test } from "node:test";
import { handleLoomProjectionRequest } from "./loom-projection-handlers";

const request = (body: BodyInit, headers: HeadersInit = {}) => new Request("https://platform.example/api/loom/projections", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body,
});

test("projection BFF rejects oversized bytes, malformed UTF-8, JSON and foreign origins", async () => {
  let calls = 0;
  const send = async () => { calls++; return {}; };
  assert.equal((await handleLoomProjectionRequest(request(" ".repeat(16 * 1024 + 1)), send)).status, 413);
  assert.equal((await handleLoomProjectionRequest(request('"' + "汉".repeat(6000) + '"'), send)).status, 413);
  assert.equal((await handleLoomProjectionRequest(request(new Uint8Array([0xff])), send)).status, 400);
  assert.equal((await handleLoomProjectionRequest(request("{"), send)).status, 400);
  assert.equal((await handleLoomProjectionRequest(request("{}", { origin: "https://other.example" }), send)).status, 403);
  assert.equal((await handleLoomProjectionRequest(request("{}", { "content-type": "text/plain" }), send)).status, 415);
  assert.equal(calls, 0);
});

test("projection BFF preserves the exact signed payload string, limits streamed bodies, and strips identity headers", async () => {
  const body = { payload: '{ "kind": "configuration" }', deviceId: "fixture" };
  const response = await handleLoomProjectionRequest(request(JSON.stringify(body), {
    cookie: "fixture-session", authorization: "fixture-authorization", "x-neuro-user-id": "attacker", "x-internal-api-token": "fake",
  }), async (path, options) => {
    assert.equal(path, "/internal/loom-projections");
    assert.deepEqual(options, { method: "POST", body });
    return { kind: "configuration" };
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(4096)); },
    cancel() { canceled = true; },
  });
  const streamed = new Request("https://platform.example/api/loom/projections", {
    method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half",
  } as RequestInit);
  assert.equal((await handleLoomProjectionRequest(streamed, async () => assert.fail("oversized stream forwarded"))).status, 413);
  assert.equal(canceled, true);
});

test("projection BFF retains client recovery codes and redacts internal errors", async () => {
  for (const [status, code] of [[401, "device_session_unavailable"], [409, "projection_revision_conflict"],
    [403, "projection_access_denied"], [404, "projection_not_found"], [429, "projection_limit_reached"],
    [409, "projection_peer_unavailable"]] as const) {
    const response = await handleLoomProjectionRequest(request("{}"), async () => {
      throw Object.assign(new Error("private internal detail"), { status, code });
    });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: { code } });
  }
  const response = await handleLoomProjectionRequest(request("{}"), async () => { throw new Error("secret"); });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: "projection_request_failed" } });
});
