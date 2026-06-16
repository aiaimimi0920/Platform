import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgres://account-worker-test";
process.env.REDIS_URL ??= "redis://account-worker-test";

type QueryCall = {
  sql: string;
  params?: unknown[];
};

describe("account worker outbox processing recovery", () => {
  let restoreConnect: (() => void) | null = null;

  afterEach(() => {
    restoreConnect?.();
    restoreConnect = null;
  });

  it("requeues account processing events while attempts remain and dead-letters exhausted events", async () => {
    const { pgPool } = await import("./db");
    const { requeueStaleProcessingEvents } = await import("./outbox");
    const calls: QueryCall[] = [];
    let released = false;

    const fakeClient = {
      async query(sql: string, params?: unknown[]) {
        calls.push({ sql, params });
        if (sql.includes("select id, attempts, max_attempts, last_error")) {
          return {
            rowCount: 2,
            rows: [
              {
                id: "evt-retry",
                attempts: 2,
                max_attempts: 3,
                last_error: "handler deferred processing",
              },
              {
                id: "evt-dead",
                attempts: 3,
                max_attempts: 3,
                last_error: null,
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      },
      release() {
        released = true;
      },
    };

    const originalConnect = pgPool.connect.bind(pgPool);
    pgPool.connect = async () => fakeClient as never;
    restoreConnect = () => {
      pgPool.connect = originalConnect;
    };

    const result = await requeueStaleProcessingEvents(300_000, 25);

    assert.deepEqual(result, { requeuedCount: 1, deadLetterCount: 1 });
    assert.equal(released, true);

    const selectCall = calls.find((call) => call.sql.includes("from outbox_events"));
    assert.ok(selectCall);
    assert.match(selectCall.sql, /status = 'processing'/);
    assert.match(selectCall.sql, /consumer_service = 'account'/);
    assert.match(selectCall.sql, /for update skip locked/);
    assert.deepEqual(selectCall.params, [300_000, 25]);

    const requeueCall = calls.find(
      (call) => call.sql.includes("status = 'pending'") && call.params?.[0] === "evt-retry",
    );
    assert.ok(requeueCall);
    assert.match(String(requeueCall.params?.[1]), /handler deferred processing/);
    assert.match(String(requeueCall.params?.[1]), /requeued for retry/);

    const deadLetterCall = calls.find(
      (call) => call.sql.includes("status = 'dead_letter'") && call.params?.[0] === "evt-dead",
    );
    assert.ok(deadLetterCall);
    assert.match(String(deadLetterCall.params?.[1]), /moved to dead_letter/);
  });
});
