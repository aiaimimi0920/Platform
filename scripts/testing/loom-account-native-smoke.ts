// Workspace-only interoperability check: real Loom processes, BFF, account service and Redis.
// The approving Web account is a fixture; this does not exercise Linux.do OAuth.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import Redis from "ioredis";
import { ProjectionRuntime, object } from "../../../Loom/scripts/qr-projection-smoke/runtime.ts";
import { LoomAccountRepository } from "../../packages/account-domain/src/modules/loom-account/repository.ts";
import { LoomAccountService } from "../../packages/account-domain/src/modules/loom-account/service.ts";
import { LoomAccountError } from "../../packages/account-domain/src/modules/loom-account/model.ts";
import { parseLoomAccountAuthorization } from "../../web/src/lib/loom-account-authorization.ts";
import { handleLoomAccountRequest } from "../../web/src/lib/loom-account-handlers.ts";
import { LoomProjectionRepository } from "../../packages/account-domain/src/modules/loom-projection/repository.ts";
import { LoomProjectionService } from "../../packages/account-domain/src/modules/loom-projection/service.ts";
import { LoomProjectionError } from "../../packages/account-domain/src/modules/loom-projection/model.ts";
import { projectionPolicy } from "../../packages/account-domain/src/modules/loom-projection/policy.ts";
import { handleLoomProjectionRequest } from "../../web/src/lib/loom-projection-handlers.ts";
import { nativeProjectionLifecycle } from "./loom-projection-native-smoke.ts";
import { RemoteProjectionRuntime } from "./loom-remote-projection-runtime.ts";

test("Loom native login interoperates with Platform and isolates two devices", async () => {
  assert.equal(process.platform, "win32", "DPAPI smoke requires Windows");
  const executable = process.env.LOOM_ACCOUNT_TEST_DAEMON;
  const redisUrl = process.env.LOOM_ACCOUNT_TEST_REDIS_URL;
  assert.ok(executable && existsSync(executable), "candidate daemon required");
  assert.ok(redisUrl && redisUrl.startsWith("redis://127.0.0.1:"), "isolated Redis required");
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const repository = new LoomAccountRepository(redis);
  const service = new LoomAccountService(repository);
  const projection = process.env.LOOM_PROJECTION_TEST === "1";
  const remote = Boolean(process.env.LOOM_TEST_SSH_CONFIG);
  assert.ok(!remote || projection, "remote runtime requires projection validation");
  const deadline = AbortSignal.timeout(remote ? 240_000 : projection ? 150_000 : 90_000);
  const remoteSource = remote && process.env.LOOM_TEST_REMOTE_SOURCE === "1";
  const a = remoteSource ? new RemoteProjectionRuntime(executable, deadline) : new ProjectionRuntime(executable, deadline);
  const b = remote && !remoteSource ? new RemoteProjectionRuntime(executable, deadline) : new ProjectionRuntime(executable, deadline);
  const checks: string[] = [];
  let origin = "";
  let loseExchange = false;
  let lostDeviceId: string | undefined;
  let unavailable = false;
  const observedEndpoints = new Map<string, string>();
  const projections = new LoomProjectionService(new LoomProjectionRepository(redis), service, () => projectionPolicy(origin, []));
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > (request.url === "/api/loom/projections" ? 16 * 1024 : 4096)) throw new Error("fixture body budget");
        chunks.push(chunk);
      }
      const webRequest = new Request(origin + request.url, {
        method: "POST", headers: { "content-type": "application/json" }, body: Buffer.concat(chunks),
      });
      const action = request.url?.split("/").at(-1) || "";
      if (action === "projections") {
        const result = await handleLoomProjectionRequest(webRequest, async (_path, { body }) => {
          if (unavailable) throw new Error("fixture unavailable");
          assert.ok(!String(object(body).payload).includes("imageBase64"), "central must not receive PNGs");
          if (remote) {
            const operation = object(JSON.parse(String(object(body).payload)));
            if (operation.kind === "sync") {
              const endpoint = JSON.stringify(object(operation.endpoint).addresses);
              const device = String(object(body).deviceId);
              if (observedEndpoints.get(device) !== endpoint) console.log("Remote smoke endpoint addresses:", endpoint);
              observedEndpoints.set(device, endpoint);
            }
          }
          try {
            const result = await projections.execute(body);
            if (remote && result.kind === "sync" && result.views.some((view) => view.record.status === "stopped")) {
              console.log("Central sync delivered stopped view", String(object(body).deviceId));
            }
            return result;
          }
          catch (error) {
            if (error instanceof LoomAccountError || error instanceof LoomProjectionError) throw { status: error.statusCode, code: error.code };
            throw error;
          }
        });
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(await result.text());
        return;
      }
      const result = await handleLoomAccountRequest(webRequest, action, async (_path, { body }) => {
        if (unavailable) throw new Error("fixture unavailable");
        try {
          if (action === "exchange") return await service.exchange(body);
          assert.ok(action === "status" || action === "revoke");
          return await service.prove(action, body);
        } catch (error) {
          if (error instanceof LoomAccountError) throw { status: error.statusCode, code: error.code };
          throw error;
        }
      });
      if (action === "exchange" && loseExchange) {
        const value: unknown = await result.clone().json();
        const parsed = object(value);
        if (parsed.status === "signed_in") {
          lostDeviceId = String(object(parsed.session).deviceId);
          loseExchange = false;
          response.destroy();
          return;
        }
      }
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    } catch {
      response.writeHead(500);
      response.end('{"error":{"code":"fixture_failed"}}');
    }
  });
  const local = async (runtime: ProjectionRuntime, action: string, body: unknown = {}) =>
    runtime.request(`/v1/account/${action}`, body, { Authorization: `Bearer ${runtime.adminToken}` });
  const approve = async (view: Record<string, unknown>) => {
    const url = new URL(String(view.authorizationUrl));
    const grant = parseLoomAccountAuthorization(Object.fromEntries(url.searchParams));
    assert.ok(grant, "native authorization query matches Web contract");
    await service.approve(grant, { userId: "native-smoke-account", username: "Native fixture" });
  };
  try {
    await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    origin = `http://127.0.0.1:${address.port}`;
    if (a instanceof RemoteProjectionRuntime) await a.prepare(origin);
    if (b instanceof RemoteProjectionRuntime) await b.prepare(origin);
    await a.start();
    await b.start();
    const pendingA = (await local(a, "start", { origin, deviceName: "Smoke A" })).body;
    const pendingB = (await local(b, "start", { origin, deviceName: "Smoke B" })).body;
    assert.equal(pendingA.status, "pending");
    assert.notEqual(pendingA.requestId, pendingB.requestId);
    assert.equal((await local(a, "poll", { requestId: pendingA.requestId })).body.status, "pending");
    checks.push("approval_required");
    await approve(pendingA);
    await approve(pendingB);
    await delay(5_100, undefined, { signal: deadline });
    loseExchange = true;
    assert.equal((await local(a, "poll", { requestId: pendingA.requestId })).status, 503);
    const signedB = (await local(b, "poll", { requestId: pendingB.requestId })).body;
    assert.equal(signedB.status, "signed_in");
    await a.stop();
    await a.start();
    await delay(5_100, undefined, { signal: deadline });
    const signedA = (await local(a, "poll", { requestId: pendingA.requestId })).body;
    assert.equal(signedA.status, "signed_in");
    const sessionA = object(signedA.session);
    const sessionB = object(signedB.session);
    assert.equal(sessionA.deviceId, lostDeviceId);
    assert.equal(sessionA.accountId, sessionB.accountId);
    assert.notEqual(sessionA.deviceId, sessionB.deviceId);
    assert.notEqual(sessionA.publicKey, sessionB.publicKey);
    checks.push("lost_response_and_restart_recover_same_identity", "same_account_distinct_devices");
    await a.stop();
    await a.start();
    assert.equal(object((await local(a, "refresh")).body.session).deviceId, sessionA.deviceId);
    checks.push("signed_session_restored_after_restart");
    if (projection) checks.push(...await nativeProjectionLifecycle(a, b));
    unavailable = true;
    assert.equal((await local(a, "refresh")).status, 502);
    assert.equal((await local(a, "status")).body.status, "signed_in");
    unavailable = false;
    assert.equal((await local(a, "refresh")).body.status, "signed_in");
    checks.push("temporary_server_failure_preserves_key");
    assert.equal((await local(a, "logout")).body.remoteRevoked, true);
    assert.equal(await repository.session(String(sessionA.deviceId)), null);
    assert.equal((await local(b, "refresh")).body.status, "signed_in");
    checks.push("logout_revokes_only_own_device");
    unavailable = true;
    const offline = (await local(b, "logout")).body;
    assert.equal(offline.status, "signed_out");
    assert.equal(offline.remoteRevoked, false);
    assert.equal((await local(b, "status")).body.status, "signed_out");
    assert.ok(await repository.session(String(sessionB.deviceId)));
    checks.push("offline_logout_clears_local_state_and_reports_pending_revoke");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    redis.disconnect();
    const cleanup = await Promise.allSettled([a.dispose(), b.dispose()]);
    assert.ok(cleanup.every((item) => item.status === "fulfilled"), "owned daemon cleanup failed");
  }
  assert.ok(!existsSync(a.root) && !existsSync(b.root));
  const evidenceRoot = resolve("output/loom-account");
  mkdirSync(evidenceRoot, { recursive: true });
  const evidence = resolve(evidenceRoot, `native-${Date.now()}.json`);
  writeFileSync(evidence, JSON.stringify({
    status: "passed", scope: projection ? "native-daemon-iroh-bff-redis" : "native-daemon-bff-account-service-redis", checks,
    daemonSha256: createHash("sha256").update(readFileSync(executable)).digest("hex"),
    daemonPids: [...a.pids, ...b.pids], temporaryRootsRemoved: true,
    realOAuthTested: false, crossMachineNetworkingTested: remote, encryptedRelayTested: false,
    remote: a instanceof RemoteProjectionRuntime ? { ...a.evidence, role: "source" } :
      b instanceof RemoteProjectionRuntime ? { ...b.evidence, role: "receiver" } : null,
  }, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  console.log(`Native account smoke passed: ${evidence}`);
});
