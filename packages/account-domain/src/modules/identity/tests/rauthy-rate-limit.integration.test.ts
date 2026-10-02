import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import type { UserSummary } from "@neuro/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import Redis from "ioredis";

import { createRauthyIdentityRouter } from "../rauthy-http";
import { createRauthyRateLimitConnection } from "../rauthy-rate-limit";

const issuer = "https://identity.example.test/auth/v1/";
const url = process.env.LOOM_ACCOUNT_TEST_REDIS_URL;
const prefix = "neuro:rauthy-upsert:v1:*";

test("real Redis: Rauthy official plugin budgets, ordering, expiry and lifecycle", { skip: !url, timeout: 30_000 }, async (t) => {
  assert.equal(new URL(url!).hostname, "127.0.0.1", "Use only the owned disposable Redis harness");
  process.env.AUTH_PROVIDER = "rauthy";
  process.env.RAUTHY_ISSUER_URL = issuer;
  process.env.INTERNAL_API_TOKEN = "synthetic-rauthy-rate-limit";
  process.env.DATABASE_URL ||= "postgresql://fixture:fixture@127.0.0.1:1/unused";
  process.env.REDIS_URL ||= url;
  const { withInternalRequest } = await import("../../../platform/internal-auth");
  const admin = new Redis(url!, { maxRetriesPerRequest: 0, connectTimeout: 1000, commandTimeout: 1000 });
  const base = new Redis(url!, { lazyConnect: true });
  const apps: FastifyInstance[] = [];
  const keys = () => admin.keys(prefix);
  const resetOwnedBudget = async () => { const owned = await keys(); if (owned.length) await admin.del(...owned); };
  t.after(async () => {
    try {
      await Promise.all(apps.map((app) => app.close()));
      await resetOwnedBudget();
    } finally {
      admin.disconnect();
      base.disconnect();
    }
  });
  const makeApp = async () => {
    const connection = createRauthyRateLimitConnection(base);
    const app = Fastify();
    apps.push(app);
    const calls = { feature: 0, upsert: 0 };
    app.addHook("onClose", async () => connection.close());
    await app.register(createRauthyIdentityRouter({
      authenticate: withInternalRequest, redis: connection.redis, ready: () => connection.ready(),
      requireIdentityEnabled: async () => { calls.feature++; },
      upsert: async () => { calls.upsert++; return { id: "synthetic-user" } as UserSummary; },
    }));
    const post = (subject = "subject-a", token = process.env.INTERNAL_API_TOKEN!) => app.inject({
      method: "POST", url: "/internal/identity/rauthy-upsert",
      headers: { "x-internal-api-token": token }, payload: { issuer, subject },
    });
    return { app, post, calls, connection };
  };
  const a = await makeApp(), b = await makeApp();

  await t.test("unauthenticated, disabled and malformed requests never connect or consume budget", async () => {
    await resetOwnedBudget();
    assert.equal(a.connection.redis.status, "wait");
    assert.equal((await a.post("subject-a", "invalid")).statusCode, 401);
    assert.equal((await a.post("")).statusCode, 400);
    process.env.AUTH_PROVIDER = "linuxdo";
    assert.equal((await a.post()).statusCode, 503);
    process.env.AUTH_PROVIDER = "rauthy";
    assert.equal(a.connection.redis.status, "wait");
    assert.deepEqual(await keys(), []);
    assert.deepEqual(a.calls, { feature: 0, upsert: 0 });
    assert.equal((await a.post()).statusCode, 200, "First valid request awaits lazy connection readiness");
    assert.equal(a.connection.redis.status, "ready");
    assert.equal(base.status, "wait", "Only the owned duplicate connects");
  });

  await t.test("concurrent app instances admit exactly 30 per identity and isolate other subjects", async () => {
    await resetOwnedBudget();
    const before = a.calls.upsert + b.calls.upsert;
    const responses = await Promise.all(Array.from({ length: 45 }, (_, n) => (n % 2 ? a : b).post()));
    assert.equal(responses.filter((r) => r.statusCode === 200).length, 30);
    assert.equal(responses.filter((r) => r.statusCode === 429).length, 15);
    const blocked = responses.find((r) => r.statusCode === 429)!;
    assert.ok(Number(blocked.headers["retry-after"]) >= 1 && Number(blocked.headers["retry-after"]) <= 60);
    assert.equal(a.calls.upsert + b.calls.upsert, before + 30);
    assert.equal((await b.post("subject-b")).statusCode, 200);
    const owned = await keys();
    assert.equal(owned.length, 3);
    assert.ok(owned.every((key) => !key.includes(issuer) && !key.includes("subject-a")));
  });

  await t.test("rejections preserve expiry and expired windows recover", async () => {
    const owned = await keys();
    const before = await Promise.all(owned.map((key) => admin.pttl(key)));
    await delay(40);
    assert.equal((await a.post()).statusCode, 429);
    const after = await Promise.all(owned.map((key) => admin.pttl(key)));
    assert.ok(after.every((ttl, index) => ttl < before[index]), "Rejected traffic must not renew TTL");
    // Shorten only this test's owned keys to exercise real Redis expiry quickly.
    await Promise.all(owned.map((key) => admin.pexpire(key, 30)));
    await delay(60);
    assert.equal((await a.post()).statusCode, 200);
  });

  await t.test("241st distinct identity is rejected globally before allocating its identity key", async () => {
    await resetOwnedBudget();
    const before = a.calls.upsert + b.calls.upsert;
    const responses = await Promise.all(Array.from({ length: 241 }, (_, n) => (n % 2 ? a : b).post(`distinct-${n}`)));
    assert.equal(responses.filter((r) => r.statusCode === 200).length, 240);
    assert.equal(responses.filter((r) => r.statusCode === 429).length, 1);
    assert.equal(a.calls.upsert + b.calls.upsert, before + 240);
    assert.equal((await keys()).length, 241);
  });

  await t.test("real Redis command failures at either budget fail closed before feature/upsert", async () => {
    await resetOwnedBudget();
    assert.equal((await a.post()).statusCode, 200);
    const owned = await keys();
    for (const key of owned) {
      const before = { ...a.calls };
      const value = await admin.get(key);
      await admin.set(key, "not-an-integer", "PX", 60_000);
      assert.equal((await a.post()).statusCode, 500);
      assert.deepEqual(a.calls, before);
      await admin.set(key, value!, "PX", 60_000);
    }
  });

  await t.test("closing apps closes only their duplicate connection", async () => {
    await a.app.close();
    await delay(0);
    assert.equal(a.connection.redis.status, "end");
    await assert.rejects(a.connection.ready(), { statusCode: 503 });
    assert.equal(await admin.ping(), "PONG");
    assert.equal(b.connection.redis.status, "ready");
  });
});
