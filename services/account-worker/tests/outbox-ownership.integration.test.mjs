import assert from "node:assert/strict";
import test from "node:test";

test("account outbox fencing against stale workers on PostgreSQL", { timeout: 30_000 }, async (t) => {
  assert.equal(process.env.PLATFORM_ACCEPTANCE_MODE, "required", "Use an isolated integration fixture");
  assert.ok(process.env.ACCOUNT_DATABASE_URL, "ACCOUNT_DATABASE_URL is required");
  const { pgPool } = await import("../src/db.ts");
  const { markEventFailed, markEventProcessed, pollPendingEvents, requeueStaleProcessingEvents } =
    await import("../src/outbox.ts");
  t.after(() => pgPool.end());

  // 同一连接上的临时表遮蔽正式 outbox；测试不读取或清空 fixture 的持久化业务表。
  pgPool.options.max = 1;
  await pgPool.query("set search_path to pg_temp");
  await pgPool.query(`create temporary table outbox_events (
    id text primary key, event_name text not null, payload jsonb not null,
    consumer_service text not null, status text not null, attempts integer not null,
    max_attempts integer not null, available_at timestamptz not null,
    processed_at timestamptz, created_at timestamptz not null,
    updated_at timestamptz not null, last_error text
  )`);

  async function insertEvent(id, maxAttempts = 5, consumer = "account") {
    await pgPool.query(`insert into outbox_events values (
      $1, 'agentExecution.callbackRemediationAlerted', '{}', $2, 'pending', 0,
      $3, now(), null, now(), now(), null
    )`, [id, consumer, maxAttempts]);
  }
  async function readEvent(id) {
    return (await pgPool.query("select * from outbox_events where id = $1", [id])).rows[0];
  }
  async function expireClaim(id) {
    await pgPool.query("update outbox_events set updated_at = now() - interval '1 hour' where id = $1", [id]);
    return requeueStaleProcessingEvents(5_000);
  }
  async function assertUnchanged(id, operation) {
    const before = await readEvent(id);
    await operation();
    assert.deepEqual(await readEvent(id), before, "stale completion must not modify any event field");
  }

  await t.test("recovery revokes completion before the next claim", async () => {
    await insertEvent("handoff");
    const [first] = await pollPendingEvents();
    assert.equal(first.attempts, 1);
    assert.deepEqual(await expireClaim(first.id), { requeuedCount: 1, deadLetterCount: 0 });
    await assertUnchanged(first.id, () => markEventProcessed(first.id, first.attempts));
    await assertUnchanged(first.id, () => markEventFailed(first.id, first.attempts, 5, "late failure"));
    const [replacement] = await pollPendingEvents();
    assert.equal(await markEventProcessed(replacement.id, replacement.attempts), true);
  });

  await t.test("a new claimant rejects all previous-attempt writebacks", async () => {
    await insertEvent("reclaimed");
    const [first] = await pollPendingEvents();
    await expireClaim(first.id);
    const [second] = await pollPendingEvents();
    assert.equal(second.attempts, 2);
    await assertUnchanged(second.id, () => markEventProcessed(second.id, 1));
    await assertUnchanged(second.id, () => markEventFailed(second.id, 1, 5, "old retry"));
    await assertUnchanged(second.id, () => markEventFailed(second.id, 1, 1, "old dead letter"));
    assert.equal(await markEventProcessed(second.id, second.attempts), true);
    const row = await readEvent(second.id);
    assert.equal(row.status, "processed");
    assert.ok(row.processed_at instanceof Date);
    await assertUnchanged(second.id, () => markEventFailed(second.id, second.attempts, 5, "late duplicate"));
    assert.equal(await markEventProcessed(second.id, second.attempts), false);
  });

  await t.test("current-owner retry backoff and final dead letter remain intact", async () => {
    await insertEvent("retry", 2);
    const [first] = await pollPendingEvents();
    assert.equal(await markEventFailed(first.id, first.attempts, first.maxAttempts, "retry me"), true);
    const row = await readEvent(first.id);
    assert.equal(row.status, "pending");
    assert.equal(row.last_error, "retry me");
    assert.equal(row.available_at.getTime() - row.updated_at.getTime(), 5_000);
    await pgPool.query("update outbox_events set available_at = now() where id = $1", [first.id]);
    const [second] = await pollPendingEvents();
    assert.equal(second.attempts, 2);
    assert.equal(await markEventFailed(second.id, second.attempts, second.maxAttempts, "exhausted"), true);
    assert.equal((await readEvent(second.id)).status, "dead_letter");
    await assertUnchanged(second.id, () => markEventProcessed(second.id, second.attempts));
  });

  await t.test("exhausted recovery cannot be overwritten by its old owner", async () => {
    await insertEvent("expired", 1);
    const [claim] = await pollPendingEvents();
    assert.deepEqual(await expireClaim(claim.id), { requeuedCount: 0, deadLetterCount: 1 });
    await assertUnchanged(claim.id, () => markEventProcessed(claim.id, claim.attempts));
    await assertUnchanged(claim.id, () => markEventFailed(claim.id, claim.attempts, 1, "late error"));
  });

  await t.test("matching attempt numbers do not authorize another consumer's event", async () => {
    await insertEvent("platform-event", 5, "platform");
    await pgPool.query("update outbox_events set status = 'processing', attempts = 1 where id = 'platform-event'");
    await assertUnchanged("platform-event", () => markEventProcessed("platform-event", 1));
    await assertUnchanged("platform-event", () => markEventFailed("platform-event", 1, 5, "retry"));
    await assertUnchanged("platform-event", () => markEventFailed("platform-event", 1, 1, "exhausted"));
  });
});
