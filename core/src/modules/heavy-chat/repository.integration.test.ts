import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PoolClient } from "pg";

import * as schema from "@/db/schema";
import { createHeavyChatRepository } from "@/modules/heavy-chat/repository";
import {
  buildTaskDraftRecord,
  normalizeTaskDraftInput,
  taskDraftPayloadMatches,
} from "@/modules/task-hub/draft";
import {
  HeavyChatActionConflictError,
  HeavyChatAttemptConflictError,
  HeavyChatInvalidTransitionError,
  HeavyChatOwnershipError,
  HeavyChatSlotLimitError,
} from "@/modules/heavy-chat/types";

const databaseUrl = process.env.HEAVY_CHAT_INTEGRATION_DATABASE_URL?.trim() || null;

function hasPostgresCode(error: unknown, code: string) {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current && current.code === code) {
      return true;
    }
    current = typeof current === "object" && current !== null && "cause" in current ? current.cause : null;
  }
  return false;
}

function hasErrorMessage(error: unknown, expected: string) {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error && current.message.includes(expected)) return true;
    current = typeof current === "object" && current !== null && "cause" in current ? current.cause : null;
  }
  return false;
}

function databaseUrlForSchema(connectionString: string, schemaName: string) {
  const url = new URL(connectionString);
  url.searchParams.set("options", `-c search_path=${schemaName}`);
  return url.toString();
}

async function waitForAdvisoryWaiters(
  pool: Pool,
  expectedApplications: readonly string[],
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;
  let observed: Array<{ applicationName: string; pid: number }> = [];
  while (Date.now() < deadline) {
    const result = await pool.query<{ application_name: string; pid: number }>(
      `select application_name, pid
         from pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and application_name = any($1::text[])
          and wait_event_type = 'Lock'
          and wait_event = 'advisory'`,
      [expectedApplications],
    );
    observed = result.rows.map((row) => ({
      applicationName: row.application_name,
      pid: Number(row.pid),
    }));
    if (expectedApplications.every((name) => observed.some((row) => row.applicationName === name))) {
      return observed;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `expected PostgreSQL advisory-lock waiters ${expectedApplications.join(", ")}; observed ${observed
      .map((row) => `${row.applicationName}:${row.pid}`)
      .join(", ")}`,
  );
}

async function runWithAdvisoryBarrier<T>(
  controlPool: Pool,
  observerPool: Pool,
  ownerUserId: string,
  expectedApplications: readonly string[],
  operations: readonly (() => Promise<T>)[],
) {
  const client: PoolClient = await controlPool.connect();
  let pending: Promise<T>[] = [];
  let barrierError: unknown = null;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
    pending = operations.map((operation) => operation());
    await waitForAdvisoryWaiters(observerPool, expectedApplications);
  } catch (error) {
    barrierError = error;
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
  const results = await Promise.allSettled(pending);
  if (barrierError) throw barrierError;
  return results;
}

if (!databaseUrl) {
  test("heavy chat PostgreSQL integration requires an explicit isolated database", () => {
    throw new Error(
      "HEAVY_CHAT_INTEGRATION_DATABASE_URL is required; this integration gate must not be recorded as passed or skipped",
    );
  });
} else {
  test("0138 migration enforces composite ownership and repository idempotency", { timeout: 30_000 }, async () => {
      const schemaName = `heavy_chat_it_${crypto.randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      const applicationA = `${schemaName}_repository_a`;
      const applicationB = `${schemaName}_repository_b`;
      const repositoryApplications = [applicationA, applicationB] as const;
    const setupPool = new Pool({ connectionString: databaseUrl, max: 1 });
    let poolA: Pool | null = null;
    let poolB: Pool | null = null;
    let controlPool: Pool | null = null;
    let observerPool: Pool | null = null;

    try {
      await setupPool.query(`create schema ${quotedSchema}`);
      poolA = new Pool({
        application_name: applicationA,
        connectionString: databaseUrl,
        max: 1,
        options: `-c search_path=${schemaName}`,
      });
      poolB = new Pool({
        application_name: applicationB,
        connectionString: databaseUrl,
        max: 1,
        options: `-c search_path=${schemaName}`,
      });
      controlPool = new Pool({
        application_name: `${schemaName}_control`,
        connectionString: databaseUrl,
        max: 2,
        options: `-c search_path=${schemaName}`,
      });
      observerPool = new Pool({
        application_name: `${schemaName}_observer`,
        connectionString: databaseUrl,
        max: 2,
        options: `-c search_path=${schemaName}`,
      });
      await poolA.query(`
        create table users (id text primary key);
        create table agents (
          id text primary key,
          owner_user_id text not null references users(id) on delete cascade
        );
      `);
      await poolA.query("insert into users (id) values ('owner-a'), ('owner-b')");
      await poolA.query(
        "insert into agents (id, owner_user_id) values ('agent-a', 'owner-a'), ('agent-b', 'owner-b')",
      );

      const migration = await readFile(path.resolve(__dirname, "../../../migrations/0138_heavy_chat.sql"), "utf8");
      await poolA.query(migration);

      const databaseA = drizzle(poolA, { schema });
      const databaseB = drizzle(poolB, { schema });
      let idA = 0;
      let idB = 0;
      const repositoryA = createHeavyChatRepository({
        database: databaseA,
        localMutationLocks: new Map(),
        createId: () => `integration-a-${++idA}`,
        now: () => new Date("2026-07-19T00:00:00.000Z"),
      });
      const repositoryB = createHeavyChatRepository({
        database: databaseB,
        localMutationLocks: new Map(),
        createId: () => `integration-b-${++idB}`,
        now: () => new Date("2026-07-19T00:00:00.000Z"),
      });

      const [backendA, backendB] = await Promise.all([
        poolA.query<{ pid: number }>("select pg_backend_pid() as pid"),
        poolB.query<{ pid: number }>("select pg_backend_pid() as pid"),
      ]);
      assert.notEqual(backendA.rows[0]?.pid, backendB.rows[0]?.pid);

      const ownerASlot = await repositoryA.createOrGetDefaultSlot("owner-a");
      const ownerBSlot = await repositoryB.createOrGetDefaultSlot("owner-b");
      const ownerAProject = await repositoryA.createProject("owner-a", {
        id: "project-a",
        title: "Owner A project",
      });
      await repositoryA.bindProjectToSlot("owner-a", ownerASlot.id, ownerAProject.id);
      const ownerAThread = await repositoryA.createThread("owner-a", {
        id: "thread-a",
        slotId: ownerASlot.id,
        projectId: ownerAProject.id,
        title: "Owner A thread",
      });
      const ownerBThread = await repositoryB.createThread("owner-b", {
        id: "thread-b",
        slotId: ownerBSlot.id,
        title: "Owner B thread",
      });

      const ownerABinding = await repositoryA.bindAgentToSlot("owner-a", ownerASlot.id, "agent-a");
      assert.equal(ownerABinding.agentId, "agent-a");
      assert.equal((await repositoryA.bindAgentToSlot("owner-a", ownerASlot.id, "agent-a")).id, ownerABinding.id);
      await repositoryB.bindAgentToSlot("owner-b", ownerBSlot.id, "agent-b");
      const ownerBSecondSlot = await repositoryB.createCustomSlot("owner-b", {
        title: "Owner B second slot",
        slotKey: "owner-b-second",
      });
      await assert.rejects(
        () => repositoryB.bindAgentToSlot("owner-b", ownerBSecondSlot.id, "agent-a"),
        (error: unknown) => hasPostgresCode(error, "23503"),
      );
      await assert.rejects(
        () => repositoryB.bindAgentToSlot("owner-b", ownerASlot.id, "agent-a"),
        (error: unknown) => error instanceof HeavyChatOwnershipError,
      );

      const first = await repositoryA.appendMessage("owner-a", {
        id: "message-a",
        threadId: ownerAThread.id,
        role: "user",
        content: "hello",
        idempotencyKey: "request-1",
      });
      const repeated = await repositoryB.appendMessage("owner-a", {
        id: "message-a-duplicate",
        threadId: ownerAThread.id,
        role: "user",
        content: "must not replace the first payload",
        idempotencyKey: "request-1",
      });
      const otherOwner = await repositoryB.appendMessage("owner-b", {
        id: "message-b",
        threadId: ownerBThread.id,
        role: "user",
        content: "same key, different owner",
        idempotencyKey: "request-1",
      });

      assert.equal(repeated.id, first.id);
      assert.notEqual(otherOwner.id, first.id);
      assert.deepEqual(await repositoryB.listMessages("owner-b", ownerAThread.id), []);
      await assert.rejects(
        () => repositoryB.transitionMessage("owner-b", first.id, "failed"),
        (error: unknown) => error instanceof HeavyChatOwnershipError,
      );

      const messageCount = await poolA.query<{ count: string }>(
        "select count(*)::text as count from heavy_chat_messages where owner_user_id = $1 and idempotency_key = $2",
        ["owner-a", "request-1"],
      );
      assert.equal(messageCount.rows[0]?.count, "1");

      assert.ok(controlPool && observerPool);
      const concurrentResults = await runWithAdvisoryBarrier(
        controlPool,
        observerPool,
        "owner-a",
        repositoryApplications,
        [
        () => repositoryA.appendMessage("owner-a", {
          id: "message-concurrent-a",
          threadId: ownerAThread.id,
          role: "assistant",
          status: "pending",
          idempotencyKey: "request-concurrent",
        }),
        () => repositoryB.appendMessage("owner-a", {
          id: "message-concurrent-b",
          threadId: ownerAThread.id,
          role: "assistant",
          status: "pending",
          idempotencyKey: "request-concurrent",
        }),
        ],
      );
      assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 2);
      const concurrent = concurrentResults.map((result) => {
        assert.equal(result.status, "fulfilled");
        return result.value;
      });
      assert.equal(concurrent[0].id, concurrent[1].id);
      const concurrentCount = await poolA.query<{ count: string }>(
        "select count(*)::text as count from heavy_chat_messages where owner_user_id = $1 and idempotency_key = $2",
        ["owner-a", "request-concurrent"],
      );
      assert.equal(concurrentCount.rows[0]?.count, "1");

      const sequenceResults = await runWithAdvisoryBarrier(
        controlPool,
        observerPool,
        "owner-a",
        repositoryApplications,
        [
        () => repositoryA.appendMessage("owner-a", {
          id: "message-sequence-a",
          threadId: ownerAThread.id,
          role: "assistant",
          status: "pending",
          idempotencyKey: "request-sequence-a",
        }),
        () => repositoryB.appendMessage("owner-a", {
          id: "message-sequence-b",
          threadId: ownerAThread.id,
          role: "assistant",
          status: "pending",
          idempotencyKey: "request-sequence-b",
        }),
        ],
      );
      assert.equal(sequenceResults.filter((result) => result.status === "fulfilled").length, 2);
      const sequenceValues = sequenceResults.map((result) => {
        assert.equal(result.status, "fulfilled");
        return result.value;
      });
      assert.deepEqual(
        sequenceValues.map((message) => message.sequence).sort((left, right) => left - right),
        [3, 4],
      );

      const slotResults = await runWithAdvisoryBarrier(
        controlPool,
        observerPool,
        "owner-a",
        repositoryApplications,
        [
        () => repositoryA.createCustomSlot("owner-a", { title: "Research", slotKey: "research" }),
        () => repositoryB.createCustomSlot("owner-a", { title: "Writing", slotKey: "writing" }),
        ],
      );
      const slotWinner = slotResults.find((result) => result.status === "fulfilled");
      const slotLoser = slotResults.find((result) => result.status === "rejected");
      assert.ok(slotWinner);
      assert.ok(slotLoser);
      assert.ok(slotLoser.reason instanceof HeavyChatSlotLimitError);

      const transitionMessage = await repositoryA.appendMessage("owner-a", {
        id: "message-transition",
        threadId: ownerAThread.id,
        role: "assistant",
        status: "pending",
      });
      const transitionResults = await runWithAdvisoryBarrier(
        controlPool,
        observerPool,
        "owner-a",
        repositoryApplications,
        [
        () => repositoryA.transitionMessage("owner-a", transitionMessage.id, "complete", { content: "done" }),
        () => repositoryB.transitionMessage("owner-a", transitionMessage.id, "failed", { content: "failed" }),
        ],
      );
      const transitionWinner = transitionResults.find((result) => result.status === "fulfilled");
      const transitionLoser = transitionResults.find((result) => result.status === "rejected");
      assert.ok(transitionWinner);
      assert.ok(transitionLoser);
      assert.ok(transitionLoser.reason instanceof HeavyChatInvalidTransitionError);
      assert.equal(
        (await repositoryA.findMessageById("owner-a", transitionMessage.id))?.status,
        transitionWinner.value.status,
      );

      const retryMessage = await repositoryA.appendMessage("owner-a", {
        id: "message-retry",
        threadId: ownerAThread.id,
        role: "assistant",
        status: "failed",
        errorCode: "provider_timeout",
      });
      const firstAttempt = await repositoryA.reserveMessageAttempt("owner-a", retryMessage.id, "retry-request-1");
      const repeatedAttempt = await repositoryB.reserveMessageAttempt("owner-a", retryMessage.id, "retry-request-1");
      assert.equal(firstAttempt.created, true);
      assert.equal(firstAttempt.attempt.attemptNumber, 1);
      assert.equal(firstAttempt.message.status, "pending");
      assert.equal(repeatedAttempt.created, false);
      assert.equal(repeatedAttempt.attempt.id, firstAttempt.attempt.id);
      await repositoryA.transitionMessage("owner-a", retryMessage.id, "failed", {
        errorCode: "provider_timeout",
      });
      const staleAttempt = await repositoryB.reserveMessageAttempt("owner-a", retryMessage.id, "retry-request-1");
      assert.equal(staleAttempt.created, false);
      assert.equal(staleAttempt.message.status, "failed");
      const secondAttempt = await repositoryB.reserveMessageAttempt("owner-a", retryMessage.id, "retry-request-2");
      assert.equal(secondAttempt.created, true);
      assert.equal(secondAttempt.attempt.attemptNumber, 2);
      assert.equal(secondAttempt.message.status, "pending");
      await repositoryB.transitionMessage("owner-a", retryMessage.id, "complete", {
        expectedAttemptNumber: secondAttempt.attempt.attemptNumber,
        content: "fresh result",
      });
      await assert.rejects(
        () =>
          repositoryA.transitionMessage("owner-a", retryMessage.id, "complete", {
            expectedAttemptNumber: firstAttempt.attempt.attemptNumber,
            content: "stale result",
          }),
        (error: unknown) => error instanceof HeavyChatAttemptConflictError,
      );
      assert.equal((await repositoryA.findMessageById("owner-a", retryMessage.id))?.content, "fresh result");
      const attemptCount = await poolA.query<{ count: string }>(
        "select count(*)::text as count from heavy_chat_message_attempts where owner_user_id = $1 and message_id = $2",
        ["owner-a", retryMessage.id],
      );
      assert.equal(attemptCount.rows[0]?.count, "2");
      await assert.rejects(
        () => repositoryB.reserveMessageAttempt("owner-b", retryMessage.id, "retry-request-owner-b"),
        (error: unknown) => error instanceof HeavyChatOwnershipError,
      );

      const actionMessage = await repositoryA.appendMessage("owner-a", {
        id: "message-actions",
        threadId: ownerAThread.id,
        role: "assistant",
        status: "complete",
        content: "Create a task draft and retain this result in the mailbox.",
      });
      const actionReservationResults = await runWithAdvisoryBarrier(
        controlPool,
        observerPool,
        "owner-a",
        repositoryApplications,
        [
          () => repositoryA.reserveMessageAction("owner-a", actionMessage.id, "task"),
          () => repositoryB.reserveMessageAction("owner-a", actionMessage.id, "task"),
        ],
      );
      const taskReservations = actionReservationResults.map((result) => {
        assert.equal(result.status, "fulfilled");
        return result.value;
      });
      assert.equal(taskReservations.filter((result) => result.claimed).length, 1);
      assert.equal(taskReservations.filter((result) => !result.claimed).length, 1);
      assert.equal(taskReservations[0]?.action.id, taskReservations[1]?.action.id);
      assert.equal(taskReservations[0]?.action.attemptNumber, 1);

      const taskAction = taskReservations[0]?.action;
      assert.ok(taskAction);
      const actionCompletionResults = await runWithAdvisoryBarrier(
        controlPool,
        observerPool,
        "owner-a",
        repositoryApplications,
        [
          () => repositoryA.completeMessageAction(
            "owner-a",
            actionMessage.id,
            taskAction.id,
            taskAction.attemptNumber,
            "task-target-a",
          ),
          () => repositoryB.completeMessageAction(
            "owner-a",
            actionMessage.id,
            taskAction.id,
            taskAction.attemptNumber,
            "task-target-b",
          ),
        ],
      );
      const actionCompletionWinner = actionCompletionResults.find((result) => result.status === "fulfilled");
      const actionCompletionLoser = actionCompletionResults.find((result) => result.status === "rejected");
      assert.ok(actionCompletionWinner);
      assert.ok(actionCompletionLoser);
      assert.ok(actionCompletionLoser.reason instanceof HeavyChatActionConflictError);
      assert.equal(actionCompletionWinner.value.action.status, "complete");
      assert.ok(["task-target-a", "task-target-b"].includes(actionCompletionWinner.value.action.targetId ?? ""));

      const mailboxAttemptOne = await repositoryA.reserveMessageAction("owner-a", actionMessage.id, "mailbox");
      assert.equal(mailboxAttemptOne.claimed, true);
      assert.equal(mailboxAttemptOne.action.attemptNumber, 1);
      const mailboxAttemptTwo = await repositoryB.reserveMessageAction(
        "owner-a",
        actionMessage.id,
        "mailbox",
        { staleBefore: new Date("2026-07-20T00:00:00.000Z") },
      );
      assert.equal(mailboxAttemptTwo.claimed, true);
      assert.equal(mailboxAttemptTwo.action.attemptNumber, 2);
      await assert.rejects(
        () => repositoryA.completeMessageAction(
          "owner-a",
          actionMessage.id,
          mailboxAttemptOne.action.id,
          mailboxAttemptOne.action.attemptNumber,
          "mailbox-stale-target",
        ),
        (error: unknown) => error instanceof HeavyChatActionConflictError,
      );
      await repositoryB.completeMessageAction(
        "owner-a",
        actionMessage.id,
        mailboxAttemptTwo.action.id,
        mailboxAttemptTwo.action.attemptNumber,
        "mailbox-current-target",
      );

      const persistedActionMessage = await repositoryA.findMessageById("owner-a", actionMessage.id);
      assert.ok(persistedActionMessage);
      assert.equal(persistedActionMessage.actions.length, 2);
      assert.deepEqual(
        persistedActionMessage.actions
          .map((action) => ({
            attemptNumber: action.attemptNumber,
            status: action.status,
            targetId: action.targetId,
            type: action.type,
          }))
          .sort((left, right) => left.type.localeCompare(right.type)),
        [
          {
            attemptNumber: 2,
            status: "complete",
            targetId: "mailbox-current-target",
            type: "mailbox",
          },
          {
            attemptNumber: 1,
            status: "complete",
            targetId: actionCompletionWinner.value.action.targetId,
            type: "task",
          },
        ],
      );
      const persistedActions = await poolA.query<{ actions: unknown }>(
        "select actions from heavy_chat_messages where owner_user_id = $1 and id = $2",
        ["owner-a", actionMessage.id],
      );
      assert.deepEqual(persistedActions.rows[0]?.actions, persistedActionMessage.actions);

      const orderingTime = new Date("2026-07-20T00:00:00.000Z");
      const projectOrderB = await repositoryB.createProject("owner-b", {
        id: "project-order-b",
        title: "Project B",
        sortOrder: 10,
        createdAt: orderingTime,
      });
      const projectOrderA = await repositoryA.createProject("owner-b", {
        id: "project-order-a",
        title: "Project A",
        sortOrder: 10,
        createdAt: orderingTime,
      });
      assert.deepEqual(
        (await repositoryA.listProjects("owner-b"))
          .filter((project) => project.sortOrder === 10)
          .map((project) => project.id),
        [projectOrderA.id, projectOrderB.id],
      );
      await repositoryA.bindProjectToSlot("owner-b", ownerBSlot.id, projectOrderA.id);
      await repositoryB.bindProjectToSlot("owner-b", ownerBSlot.id, projectOrderB.id);
      assert.equal(
        (await repositoryA.rebindProject("owner-b", ownerBThread.id, projectOrderA.id)).projectId,
        projectOrderA.id,
      );
      assert.equal((await repositoryB.bindProjectToThread("owner-b", ownerBThread.id, null)).projectId, null);

      await repositoryB.createThread("owner-b", {
        id: "thread-order-b",
        slotId: ownerBSlot.id,
        title: "Thread B",
        createdAt: orderingTime,
      });
      await repositoryA.createThread("owner-b", {
        id: "thread-order-a",
        slotId: ownerBSlot.id,
        title: "Thread A",
        createdAt: orderingTime,
      });
      assert.deepEqual(
        (await repositoryA.listThreads("owner-b", ownerBSlot.id)).slice(0, 2).map((thread) => thread.id),
        ["thread-order-a", "thread-order-b"],
      );

      const appendedAt = new Date("2026-07-21T00:00:00.000Z");
      const transitionedAt = new Date("2026-07-22T00:00:00.000Z");
      const activityMessage = await repositoryA.appendMessage("owner-b", {
        id: "message-activity",
        threadId: ownerBThread.id,
        role: "assistant",
        status: "pending",
        createdAt: appendedAt,
      });
      assert.equal((await repositoryB.findThreadById("owner-b", ownerBThread.id))?.updatedAt.toISOString(), appendedAt.toISOString());
      await repositoryB.transitionMessage("owner-b", activityMessage.id, "complete", {
        updatedAt: transitionedAt,
      });
      assert.equal(
        (await repositoryA.findThreadById("owner-b", ownerBThread.id))?.updatedAt.toISOString(),
        transitionedAt.toISOString(),
      );

      const rollbackAt = new Date("2026-07-23T00:00:00.000Z");
      await poolA.query(`
        create function heavy_chat_fail_touch_for_test() returns trigger language plpgsql as $$
        begin
          if new.updated_at = '${rollbackAt.toISOString()}'::timestamptz then
            raise exception 'forced heavy chat touch failure';
          end if;
          return new;
        end;
        $$;
        create trigger heavy_chat_fail_touch_for_test
          before update on heavy_chat_threads
          for each row execute function heavy_chat_fail_touch_for_test();
      `);
      const threadBeforeRollback = await repositoryA.findThreadById("owner-b", ownerBThread.id);
      try {
        await assert.rejects(
          () => repositoryA.appendMessage("owner-b", {
            id: "message-rollback",
            threadId: ownerBThread.id,
            role: "user",
            content: "must roll back",
            createdAt: rollbackAt,
          }),
          (error: unknown) => hasErrorMessage(error, "forced heavy chat touch failure"),
        );
        assert.equal(await repositoryB.findMessageById("owner-b", "message-rollback"), null);
        assert.equal(
          (await repositoryB.findThreadById("owner-b", ownerBThread.id))?.updatedAt.toISOString(),
          threadBeforeRollback?.updatedAt.toISOString(),
        );
      } finally {
        await poolA.query(`
          drop trigger if exists heavy_chat_fail_touch_for_test on heavy_chat_threads;
          drop function if exists heavy_chat_fail_touch_for_test();
        `);
      }

      await assert.rejects(
        poolA.query(
          `insert into heavy_chat_threads
            (id, owner_user_id, slot_id, project_id, title, favorite, sort_order, created_at, updated_at)
           values ('cross-owner-thread', 'owner-b', $1, null, 'invalid', false, 0, now(), now())`,
          [ownerASlot.id],
        ),
        (error: unknown) => hasPostgresCode(error, "23503"),
      );
      await assert.rejects(
        poolA.query(
          `insert into heavy_chat_messages
            (id, owner_user_id, thread_id, role, status, sequence, attempt_number, content, reference_data, actions, created_at, updated_at)
           values ('invalid-sequence', 'owner-a', $1, 'user', 'complete', 0, 0, '', '[]', '[]', now(), now())`,
          [ownerAThread.id],
        ),
        (error: unknown) => hasPostgresCode(error, "23514"),
      );
      const ownerAUnboundProject = await repositoryA.createProject("owner-a", {
        id: "project-a-unbound",
        title: "Owner A unbound project",
      });
      await assert.rejects(
        poolA.query(
          `insert into heavy_chat_threads
            (id, owner_user_id, slot_id, project_id, title, favorite, sort_order, created_at, updated_at)
           values ('unbound-project-thread', 'owner-a', $1, $2, 'invalid', false, 0, now(), now())`,
          [ownerASlot.id, ownerAUnboundProject.id],
        ),
        (error: unknown) => hasPostgresCode(error, "23503"),
      );
      await assert.rejects(
        poolA.query(
          `insert into heavy_chat_messages
            (id, owner_user_id, thread_id, role, status, sequence, content, reference_data, actions, created_at, updated_at)
           values ('cross-owner-message', 'owner-b', $1, 'user', 'complete', 99, '', '[]', '[]', now(), now())`,
          [ownerAThread.id],
        ),
        (error: unknown) => hasPostgresCode(error, "23503"),
      );
    } finally {
      await setupPool.end().catch(() => {});
      await poolA?.end().catch(() => {});
      await poolB?.end().catch(() => {});
      await controlPool?.end().catch(() => {});
      await observerPool?.end().catch(() => {});
      const cleanupPool = new Pool({ connectionString: databaseUrl, max: 1 });
      try {
        await cleanupPool.query(`drop schema if exists ${quotedSchema} cascade`);
      } finally {
        await cleanupPool.end();
      }
    }
  });

  test("0139 task drafts are idempotent, owner-queryable, and excluded from the public list", { timeout: 30_000 }, async () => {
    const schemaName = `task_draft_it_${crypto.randomUUID().replaceAll("-", "")}`;
    const quotedSchema = `"${schemaName}"`;
    const setupPool = new Pool({ connectionString: databaseUrl, max: 1 });
    let taskHubPool: Pool | null = null;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousRedisUrl = process.env.REDIS_URL;
    const previousInternalApiToken = process.env.INTERNAL_API_TOKEN;

    try {
      const migrationClient = await setupPool.connect();
      try {
        await migrationClient.query(`create schema ${quotedSchema}`);
        await migrationClient.query(`set search_path = ${quotedSchema}, public`);
        for (const migrationFile of [
          "0001_init.sql",
          "0003_task_hub_lifecycle.sql",
          "0018_task_preferred_capabilities.sql",
          "0021_arbitration_cases.sql",
          "0121_task_market_pricing_and_modes.sql",
          "0122_task_market_meter_quantity.sql",
          "0139_task_draft_idempotency.sql",
        ]) {
          const migration = await readFile(path.resolve(__dirname, "../../../migrations", migrationFile), "utf8");
          await migrationClient.query(migration);
        }
        await migrationClient.query(`
          insert into users
            (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
          values
            ('owner-task', 'owner-task', 'owner-task@example.test', null, 0, now(), now(), now()),
            ('other-owner', 'other-owner', 'other-owner@example.test', null, 0, now(), now(), now())
        `);
      } finally {
        migrationClient.release();
      }

      process.env.DATABASE_URL = databaseUrlForSchema(databaseUrl, schemaName);
      process.env.REDIS_URL ??= "redis://127.0.0.1:1";
      process.env.INTERNAL_API_TOKEN ??= "heavy-chat-integration-token";
      const taskHub = await import("@/modules/task-hub/repository");
      ({ pgPool: taskHubPool } = await import("@/db/client"));
      const taskPool = taskHubPool;
      if (!taskPool) throw new Error("Task Hub integration pool was not initialized");

      const draftInput = normalizeTaskDraftInput({
        idempotencyKey: "heavy-chat:task-action:integration",
        title: "Persist this task draft",
        description: "Verify Task Hub target persistence.",
        preferredCapabilityCodes: ["writing"],
      });
      const draftRecord = buildTaskDraftRecord({
        id: "task-draft-integration",
        ownerUserId: "owner-task",
        input: draftInput,
        createdAt: new Date("2026-07-19T00:00:00.000Z"),
      });
      const insertDraftSql = `
        insert into tasks
          (id, creator_user_id, assigned_user_id, title, description, preferred_capability_codes,
           pricing_mode, billing_unit, meter_key, meter_quantity, operation_mode, reward_currency,
           reward_amount, required_bond_amount, status, idempotency_key, created_at)
        values
          ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        on conflict (creator_user_id, idempotency_key) do nothing
        returning id
      `;
      const draftValues = [
        draftRecord.id,
        draftRecord.creatorUserId,
        draftRecord.assignedUserId,
        draftRecord.title,
        draftRecord.description,
        JSON.stringify(draftRecord.preferredCapabilityCodes),
        draftRecord.pricingMode,
        draftRecord.billingUnit,
        draftRecord.meterKey,
        draftRecord.meterQuantity,
        draftRecord.operationMode,
        draftRecord.rewardCurrency,
        draftRecord.rewardAmount,
        draftRecord.requiredBondAmount,
        draftRecord.status,
        draftRecord.idempotencyKey,
        draftRecord.createdAt,
      ];
      const [draftInsertA, draftInsertB] = await Promise.all([
        taskPool.query<{ id: string }>(insertDraftSql, draftValues),
        taskPool.query<{ id: string }>(insertDraftSql, [
          "task-draft-integration-race",
          ...draftValues.slice(1),
        ]),
      ]);
      assert.equal(
        [draftInsertA, draftInsertB].filter((result) => result.rowCount === 1).length,
        1,
      );
      const winningDraftId = [draftInsertA, draftInsertB]
        .find((result) => result.rowCount === 1)
        ?.rows[0]?.id;
      assert.ok(winningDraftId);

      const [storedDraft] = await taskPool.query<{
        id: string;
        title: string;
        description: string;
        preferred_capability_codes: string[];
        idempotency_key: string | null;
        status: string;
      }>(
        `select id, title, description, preferred_capability_codes, idempotency_key, status
           from tasks
          where creator_user_id = $1 and idempotency_key = $2`,
        [draftRecord.creatorUserId, draftRecord.idempotencyKey],
      ).then((result) => result.rows);
      assert.ok(storedDraft);
      assert.equal(storedDraft.id, winningDraftId);
      const storedDraftPayload = {
        title: storedDraft.title,
        description: storedDraft.description,
        preferredCapabilityCodes: storedDraft.preferred_capability_codes,
        idempotencyKey: storedDraft.idempotency_key,
        status: storedDraft.status,
      };
      assert.equal(
        taskDraftPayloadMatches(storedDraftPayload, draftInput),
        true,
      );
      assert.equal(
        taskDraftPayloadMatches(
          { ...storedDraftPayload, title: "different payload" },
          draftInput,
        ),
        false,
      );

      await taskPool.query(
        `insert into tasks
          (id, creator_user_id, assigned_user_id, title, description, preferred_capability_codes,
           pricing_mode, billing_unit, meter_key, meter_quantity, operation_mode, reward_currency,
           reward_amount, required_bond_amount, status, idempotency_key, created_at)
         values
          ('task-public-integration', 'owner-task', null, 'Public task', 'Visible task', '[]'::jsonb,
           'flat_task', null, null, null, 'manual', 'obsidian', 10, 0, 'open', null, now())`,
      );
      const publicRows = await taskHub.listTasksWithCounts();
      assert.deepEqual(publicRows.map((entry) => entry.task.id), ["task-public-integration"]);
      const ownerRows = await taskHub.listTasksWithCountsByUser("owner-task");
      assert.deepEqual(
        ownerRows.map((entry) => entry.task.id).sort(),
        [winningDraftId, "task-public-integration"].sort(),
      );
      assert.equal(
        (await taskHub.getTaskByOwnerAndId("owner-task", winningDraftId))?.id,
        winningDraftId,
      );
      assert.equal(await taskHub.getTaskByOwnerAndId("other-owner", winningDraftId), null);
      await assert.rejects(
        taskPool.query(
          `insert into tasks
            (id, creator_user_id, assigned_user_id, title, description, preferred_capability_codes,
             pricing_mode, billing_unit, meter_key, meter_quantity, operation_mode, reward_currency,
             reward_amount, required_bond_amount, status, idempotency_key, created_at)
           values
            ('invalid-draft', 'owner-task', null, 'Invalid', 'Invalid', '[]'::jsonb,
             'flat_task', null, null, null, 'manual', 'obsidian', 1, 0, 'draft',
             'heavy-chat:invalid-draft', now())`,
        ),
        (error: unknown) => hasPostgresCode(error, "23514"),
      );
    } finally {
      await taskHubPool?.end().catch(() => {});
      await setupPool.query(`drop schema if exists ${quotedSchema} cascade`).catch(() => {});
      await setupPool.end().catch(() => {});
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
      if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousRedisUrl;
      if (previousInternalApiToken === undefined) delete process.env.INTERNAL_API_TOKEN;
      else process.env.INTERNAL_API_TOKEN = previousInternalApiToken;
    }
  });
}
