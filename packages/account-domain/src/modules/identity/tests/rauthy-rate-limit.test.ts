import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { UserSummary } from "@neuro/contracts";
import Fastify from "fastify";

import { createRauthyIdentityRouter } from "../rauthy-http";
import { RauthyRateLimitFixture } from "./rauthy-rate-limit-fixture";

const issuer = "https://identity.example.test/auth/v1/";
const totalRateLimitKey = "neuro:rauthy-upsert:v1:total";
function identityRateLimitKey(subject: string) {
  const digest = createHash("sha256").update(JSON.stringify([issuer, subject])).digest("hex");
  return `neuro:rauthy-upsert:v1:POST/internal/identity/rauthy-upsert-identity:${digest}`;
}
process.env.AUTH_PROVIDER = "rauthy";
process.env.RAUTHY_ISSUER_URL = issuer;
process.env.DATABASE_URL ||= "postgresql://fixture:fixture@127.0.0.1:1/unused";
process.env.REDIS_URL ||= "redis://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN = "synthetic-rate-limit-test";

async function createApp(fixture: RauthyRateLimitFixture, ready = async () => undefined) {
  const { withInternalRequest } = await import("../../../platform/internal-auth");
  const calls = { feature: 0, upsert: 0 };
  const app = Fastify();
  await app.register(createRauthyIdentityRouter({
    authenticate: withInternalRequest,
    redis: fixture.redis,
    ready,
    requireIdentityEnabled: async () => { calls.feature++; },
    upsert: async () => { calls.upsert++; return { id: "synthetic-user" } as UserSummary; },
  }));
  const post = (subject = "subject-a", token = process.env.INTERNAL_API_TOKEN!, extra = {}) => app.inject({
    method: "POST", url: "/internal/identity/rauthy-upsert",
    headers: { "x-internal-api-token": token }, payload: { issuer, subject, ...extra },
  });
  return { app, calls, post };
}

test("Rauthy official plugin HTTP hooks and bounded failure paths", async (t) => {
  await t.test("auth and claims reject before connection, budget or database work", async (t) => {
    const fixture = new RauthyRateLimitFixture();
    let connections = 0;
    const ctx = await createApp(fixture, async () => { connections++; });
    t.after(() => ctx.app.close());
    assert.equal((await ctx.post("a", "invalid")).statusCode, 401);
    assert.equal((await ctx.post("", undefined)).statusCode, 400);
    process.env.AUTH_PROVIDER = "linuxdo";
    assert.equal((await ctx.post()).statusCode, 503);
    process.env.AUTH_PROVIDER = "rauthy";
    assert.equal((await ctx.post("a", undefined, { issuer: "https://other.test/" })).statusCode, 400);
    assert.equal(connections, 0);
    assert.equal(fixture.calls.length, 0);
    assert.deepEqual(ctx.calls, { feature: 0, upsert: 0 });
  });

  await t.test("31st identity request is rejected; separate app instance shares its budget", async (t) => {
    const fixture = new RauthyRateLimitFixture();
    const a = await createApp(fixture), b = await createApp(fixture);
    t.after(async () => { await a.app.close(); await b.app.close(); });
    for (let n = 0; n < 30; n++) assert.equal((await (n % 2 ? a : b).post()).statusCode, 200);
    const blocked = await a.post();
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.headers["retry-after"], "60");
    assert.equal(a.calls.upsert + b.calls.upsert, 30);
    assert.equal(a.calls.feature + b.calls.feature, 30);
    assert.equal((await b.post("other-subject")).statusCode, 200);
    assert.deepEqual([...fixture.entries.keys()].sort(), [
      totalRateLimitKey, identityRateLimitKey("subject-a"), identityRateLimitKey("other-subject"),
    ].sort());
    fixture.now = 20_000;
    assert.equal((await a.post()).headers["retry-after"], "40");
    fixture.now = 60_001;
    assert.equal((await a.post()).statusCode, 200);
  });

  await t.test("241st deployment request rejects before creating an identity key", async (t) => {
    const fixture = new RauthyRateLimitFixture();
    const ctx = await createApp(fixture);
    t.after(() => ctx.app.close());
    const responses = await Promise.all(Array.from({ length: 241 }, (_, n) => ctx.post(`distinct-${n}`)));
    assert.equal(responses.filter((response) => response.statusCode === 200).length, 240);
    assert.equal(responses.filter((response) => response.statusCode === 429).length, 1);
    assert.deepEqual(ctx.calls, { feature: 240, upsert: 240 });
    assert.equal(fixture.entries.size, 241, "One total key plus 240 accepted identity keys");
  });

  await t.test("Redis connection and command errors fail closed before feature/upsert", async (t) => {
    const fixture = new RauthyRateLimitFixture();
    const ctx = await createApp(fixture);
    t.after(() => ctx.app.close());
    fixture.failure = new Error("synthetic Redis outage");
    assert.equal((await ctx.post()).statusCode, 500);
    assert.deepEqual(ctx.calls, { feature: 0, upsert: 0 });
    const disconnected = await createApp(new RauthyRateLimitFixture(), async () => { throw new Error("connection failed"); });
    t.after(() => disconnected.app.close());
    assert.equal((await disconnected.post()).statusCode, 500);
    assert.deepEqual(disconnected.calls, { feature: 0, upsert: 0 });
  });
});
