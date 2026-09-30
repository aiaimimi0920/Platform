import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgres://account-worker-test";
process.env.REDIS_URL ??= "redis://account-worker-test";

describe("account outbox completion ownership", () => {
  for (const rowCount of [0, 1]) {
    for (const outcome of ["processed", "retry", "dead_letter"] as const) {
      it(`${outcome} reports whether attempt 3 still owns the event (${rowCount} updated)`, async (t) => {
        const { pgPool } = await import("./db");
        const { markEventFailed, markEventProcessed } = await import("./outbox");
        const calls: Array<{ sql: string; params: unknown[] }> = [];
        t.mock.method(pgPool, "query", async (sql: string, params: unknown[]) => {
          calls.push({ sql, params });
          return { rowCount, rows: [] };
        });

        const updated = outcome === "processed"
          ? await markEventProcessed("event-1", 3)
          : await markEventFailed("event-1", 3, outcome === "retry" ? 5 : 3, "handler failed");

        assert.equal(updated, rowCount === 1);
        assert.equal(calls.length, 1);
        const { sql, params } = calls[0]!;
        const where = sql.slice(sql.indexOf("where"));
        assert.match(where, /id = \$1/);
        assert.match(where, /consumer_service = 'account'/);
        assert.match(where, /status = 'processing'/);
        const attemptParameter = /attempts = \$(\d+)/.exec(where);
        assert.ok(attemptParameter, "completion must compare the claimed attempt atomically");
        assert.equal(params[Number(attemptParameter[1]) - 1], 3);
        assert.equal(params[0], "event-1");
        if (outcome === "retry") assert.deepEqual(params, ["event-1", 20, "handler failed", 3]);
        if (outcome === "dead_letter") assert.deepEqual(params, ["event-1", "handler failed", 3]);
      });
    }
  }
});
