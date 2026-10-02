import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import { Pool } from "pg";

const issuer = "https://identity.example.test/auth/v1/";
const databaseUrl = process.env.ACCOUNT_DATABASE_URL;

test("Rauthy fresh accounts, concurrency, rollback, summaries and internal boundary", { timeout: 120_000 }, async (t) => {
  assert.ok(databaseUrl, "Isolated PostgreSQL harness must set ACCOUNT_DATABASE_URL");
  process.env.AUTH_PROVIDER = "rauthy";
  process.env.RAUTHY_ISSUER_URL = issuer;
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());
  const { pgPool } = await import("../../../db/client");
  t.after(() => pgPool.end());
  const { redis } = await import("../../../db/redis");
  t.after(() => redis.disconnect());
  const { pgPool: foundationPool, redis: foundationRedis } = await import("@neuro/backend-foundation");
  t.after(async () => { foundationRedis.disconnect(); await foundationPool.end(); });
  assert.equal(await foundationRedis.ping(), "PONG", "Redis fixture INFO must be a complete RESP bulk reply");
  const { identityRouter } = await import("../router");
  const { upsertRauthyUser } = await import("../rauthy-service");
  const { getPublicUserProfile, getUserSummary, updateUserProfile } = await import("../service");
  const { setFeatureModuleEnabled } = await import("../../../platform/feature-modules/service");
  const app = Fastify();
  t.after(() => app.close());
  await app.register(identityRouter);
  const login = (subject: string, extra = {}) => upsertRauthyUser({ issuer, subject, emailVerified: false, ...extra });
  const count = async (table: string) => Number((await pool.query(`select count(*) as count from ${table}`)).rows[0].count);
  const post = (payload: unknown, token: string | undefined = process.env.INTERNAL_API_TOKEN) => app.inject({
    method: "POST", url: "/internal/identity/rauthy-upsert",
    headers: token ? { "x-internal-api-token": token } : {}, payload: payload as object,
  });

  await t.test("optional email, stable ID, rename, truthful metadata and no email-native rights", async () => {
    const initial = await login("fresh-no-email");
    assert.equal(initial.provider, "rauthy");
    assert.equal(initial.providerIssuer, issuer);
    assert.equal(initial.providerUserId, "fresh-no-email");
    assert.equal(initial.email, null);
    const renamed = await login("fresh-no-email", { username: "New Name", email: "shared@example.test", emailVerified: true });
    assert.equal(renamed.id, initial.id);
    assert.equal(renamed.username, initial.username);
    assert.equal(renamed.username, `rauthy_${initial.id}`);
    assert.equal(renamed.displayName, "New Name");
    assert.equal((await getUserSummary(initial.id))?.id, initial.id);
    assert.equal((await updateUserProfile(initial.id, { profileTagline: "Fresh account" }))?.provider, "rauthy");
    assert.equal((await getUserSummary(initial.id))?.profileTagline, "Fresh account");
    const rows = await pool.query("select * from oidc_identities where user_id = $1", [initial.id]);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].email_verified, true);
    assert.equal((await pool.query("select * from auth_identities where user_id = $1", [initial.id])).rowCount, 0);
    await login("fresh-no-email");
    const cleared = await pool.query("select email, email_verified from oidc_identities where user_id = $1", [initial.id]);
    assert.deepEqual(cleared.rows[0], { email: null, email_verified: false });
    assert.equal((await getUserSummary(initial.id))?.email, null);
  });

  await t.test("same email/username never links subjects or legacy accounts", async () => {
    await pool.query(`insert into users (id, username, email, created_at, updated_at, last_login_at)
      values ('legacy-rauthy-fixture', '张三 😀', 'shared@example.test', now(), now(), now())`);
    await pool.query(`insert into auth_identities (id, user_id, provider, provider_user_id, email, created_at, updated_at)
      values ('legacy-identity-fixture', 'legacy-rauthy-fixture', 'linuxdo', 'legacy-sub', 'shared@example.test', now(), now())`);
    const legacyBefore = (await pool.query("select * from auth_identities order by id")).rows;
    const a = await login("email-sub-a", { username: "张三 😀", email: "shared@example.test", emailVerified: true });
    const b = await login("email-sub-b", { username: "张三 😀", email: "shared@example.test", emailVerified: true });
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.username, b.username);
    assert.notEqual(a.username, "张三 😀");
    assert.equal(a.displayName, b.displayName);
    assert.notEqual(a.id, "legacy-rauthy-fixture");
    await updateUserProfile(a.id, { profileTagline: "Public profile A" });
    await updateUserProfile(b.id, { profileTagline: "Public profile B" });
    assert.equal((await getPublicUserProfile(a.username))?.profileTagline, "Public profile A");
    assert.equal((await getPublicUserProfile(b.username))?.profileTagline, "Public profile B");
    const renamed = await login("email-sub-a", { username: "李四 🚀" });
    assert.equal(renamed.id, a.id);
    assert.equal(renamed.username, a.username);
    assert.equal(renamed.displayName, "李四 🚀");
    assert.equal((await getPublicUserProfile(a.username))?.profileTagline, "Public profile A");
    assert.equal((await getPublicUserProfile(b.username))?.profileTagline, "Public profile B");
    assert.equal((await getUserSummary(b.id))?.displayName, "张三 😀");
    assert.deepEqual((await pool.query("select * from auth_identities order by id")).rows, legacyBefore);
    const legacy = await getUserSummary("legacy-rauthy-fixture");
    assert.equal(legacy?.provider, "linuxdo");
    assert.equal(legacy?.providerUserId, "legacy-sub");
    assert.equal(legacy?.providerIssuer, undefined);
    assert.equal(await getUserSummary("missing-user"), null);
  });

  await t.test("same subject under a different configured issuer creates a separate account", async () => {
    const original = await login("issuer-scoped-subject");
    const alternateIssuer = "https://other-identity.example.test/auth/v1/";
    process.env.RAUTHY_ISSUER_URL = alternateIssuer;
    try {
      const alternate = await upsertRauthyUser({ issuer: alternateIssuer, subject: "issuer-scoped-subject", emailVerified: false });
      assert.notEqual(alternate.id, original.id);
      assert.equal(alternate.providerIssuer, alternateIssuer);
    } finally {
      process.env.RAUTHY_ISSUER_URL = issuer;
    }
    assert.equal((await login("issuer-scoped-subject")).id, original.id);
  });

  await t.test("OIDC subject cannot silently inherit a legacy operator allowlist entry", async () => {
    const user = await login("operator-1");
    assert.notEqual(user.id, "operator-1");
    assert.equal(user.providerUserId, "operator-1");
    const { listOperatorBenefitGrants } = await import("../../benefits/service");
    // Web forwards the internal ID only for Rauthy, never the bare OIDC subject
    // in the legacy x-neuro-provider-user-id authorization header.
    await assert.rejects(listOperatorBenefitGrants(user.id), { statusCode: 401 });
  });

  await t.test("parallel first login creates one user, identity and registration event", async () => {
    const before = { users: await count("users"), identities: await count("oidc_identities"), events: await count("outbox_events") };
    const results = await Promise.all(Array.from({ length: 16 }, () => login("concurrent-first")));
    const userId = results[0].id;
    assert.equal(new Set(results.map((user) => user.id)).size, 1);
    assert.equal(await count("users"), before.users + 1);
    assert.equal(await count("oidc_identities"), before.identities + 1);
    assert.equal(await count("outbox_events"), before.events + 1);
    const events = await pool.query("select * from outbox_events where payload->>'userId' = $1", [userId]);
    assert.equal(events.rows[0].event_name, "user.registered");
    assert.equal(events.rows[0].consumer_service, "account");
    assert.equal(events.rows[0].payload.provider, "rauthy");
    assert.equal((await login("concurrent-first")).id, userId);
    assert.equal(await count("outbox_events"), before.events + 1);
    assert.equal((await pool.query("select * from ledger_accounts where user_id = $1", [userId])).rowCount, 0);
  });

  await t.test("outbox failure rolls back both user and identity and permits retry", async () => {
    const before = { users: await count("users"), identities: await count("oidc_identities"), events: await count("outbox_events") };
    await pool.query(`create function fail_rauthy_outbox_fixture() returns trigger language plpgsql as $$
      begin if NEW.event_name = 'user.registered' and NEW.payload->>'provider' = 'rauthy' then
        raise exception 'synthetic outbox failure'; end if; return NEW; end $$;
      create trigger fail_rauthy_outbox_fixture before insert on outbox_events
      for each row execute function fail_rauthy_outbox_fixture()`);
    try {
      await assert.rejects(login("rollback-first"), (error: unknown) => {
        assert.match(String(error), /insert into "outbox_events"/);
        return true;
      });
    } finally {
      await pool.query("drop trigger fail_rauthy_outbox_fixture on outbox_events; drop function fail_rauthy_outbox_fixture()");
    }
    assert.equal(await count("users"), before.users);
    assert.equal(await count("oidc_identities"), before.identities);
    assert.equal(await count("outbox_events"), before.events);
    assert.ok((await login("rollback-first")).id);
  });

  await t.test("route rejects missing/wrong internal auth, provider/config/issuer/claims, and disabled identity", async () => {
    const payload = { issuer, subject: "route-user", emailVerified: false };
    const before = { users: await count("users"), identities: await count("oidc_identities"), events: await count("outbox_events") };
    assert.equal((await post(payload, "")).statusCode, 401);
    assert.equal((await post(payload, "wrong-token")).statusCode, 401);
    for (const AUTH_PROVIDER of ["linuxdo", "unknown", ""]) {
      process.env.AUTH_PROVIDER = AUTH_PROVIDER;
      assert.equal((await post(payload)).statusCode, 503);
    }
    process.env.AUTH_PROVIDER = "rauthy";
    process.env.RAUTHY_ISSUER_URL = "http://identity.example.test/auth/v1/";
    assert.equal((await post(payload)).statusCode, 503);
    process.env.RAUTHY_ISSUER_URL = issuer;
    assert.equal((await post({ ...payload, issuer: issuer.slice(0, -1) })).statusCode, 400);
    assert.equal((await post({ ...payload, subject: "" })).statusCode, 400);
    assert.equal((await post({ ...payload, emailVerified: "true" })).statusCode, 400);
    assert.equal((await post({ ...payload, unexpected: "x".repeat(9000) })).statusCode, 413);
    await setFeatureModuleEnabled("identity", false, "fixture");
    assert.equal((await post(payload)).statusCode, 503);
    assert.equal(await count("users"), before.users);
    assert.equal(await count("oidc_identities"), before.identities);
    assert.equal(await count("outbox_events"), before.events);
    await setFeatureModuleEnabled("identity", true, null);
    const response = await post({ issuer, subject: "route-user" });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().user.provider, "rauthy");
    assert.equal(response.json().user.providerIssuer, issuer);
    assert.equal((await post(payload)).json().user.id, response.json().user.id);
  });

  await t.test("database enforces issuer/subject uniqueness, user FK and honest verification", async () => {
    const row = (await pool.query("select * from oidc_identities limit 1")).rows[0];
    await assert.rejects(pool.query(`insert into oidc_identities
      (id, user_id, issuer, subject, created_at, updated_at, last_login_at)
      values ('duplicate-fixture', $1, $2, $3, now(), now(), now())`, [row.user_id, row.issuer, row.subject]), { code: "23505" });
    await assert.rejects(pool.query(`insert into oidc_identities
      (id, user_id, issuer, subject, created_at, updated_at, last_login_at)
      values ('orphan-fixture', 'nonexistent-user', $1, 'orphan', now(), now(), now())`, [issuer]), { code: "23503" });
    await assert.rejects(pool.query("update oidc_identities set email = null, email_verified = true where id = $1", [row.id]), { code: "23514" });
  });

});
