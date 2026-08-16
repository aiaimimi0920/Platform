import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;
process.env.ARBITRATION_EVIDENCE_STORAGE_POLICIES_JSON = JSON.stringify({
  default: { cleanupMode: "bucket_lifecycle" },
});

function resolveModuleExports<T extends object>(loadedModule: T) {
  if ("default" in loadedModule && typeof loadedModule.default === "object" && loadedModule.default !== null) {
    return loadedModule.default as T;
  }
  return loadedModule;
}

function isHttpError(error: unknown, statusCode: number, pattern: RegExp) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode &&
    "message" in error &&
    pattern.test(String((error as { message?: unknown }).message))
  );
}

if (!databaseUrl) {
  test("arbitration integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for arbitration integration coverage");
  });
} else {
  test("arbitration cases enforce participant-only creation, evidence capture, and claimer-owned review flow", { timeout: 120_000 }, async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });
    pool.on("error", () => undefined);

    let corePool: { end: () => Promise<void> } | null = null;
    let coreRedis: { disconnect: () => void } | null = null;
    let accountPool: { end: () => Promise<void> } | null = null;
    let accountRedis: { disconnect: () => void } | null = null;

    try {
      await pool.query(`
        insert into users (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
        values
          ('arb-creator', 'arb-creator', 'arb-creator@example.test', null, 3, now(), now(), now()),
          ('arb-worker', 'arb-worker', 'arb-worker@example.test', null, 3, now(), now(), now()),
          ('arb-outsider', 'arb-outsider', 'arb-outsider@example.test', null, 1, now(), now(), now()),
          ('operator-1', 'operator-1', 'operator-1@example.test', null, 4, now(), now(), now()),
          ('operator-2', 'operator-2', 'operator-2@example.test', null, 4, now(), now(), now())
      `);

      await pool.query(`
        insert into tasks (
          id,
          creator_user_id,
          assigned_user_id,
          title,
          description,
          preferred_capability_codes,
          pricing_mode,
          billing_unit,
          meter_key,
          meter_quantity,
          operation_mode,
          reward_currency,
          reward_amount,
          required_bond_amount,
          status,
          idempotency_key,
          created_at
        ) values (
          'arb-task-1',
          'arb-creator',
          'arb-worker',
          'Arbitrated task',
          'A task used to verify arbitration review flow.',
          '[]'::jsonb,
          'flat_task',
          null,
          null,
          null,
          'manual',
          'obsidian',
          10,
          0,
          'submitted',
          null,
          now()
        )
      `);

      const arbitrationService = resolveModuleExports(await import("../service"));
      const {
        addArbitrationEvidence,
        advanceArbitrationReviewRound,
        claimArbitrationCase,
        claimNextArbitrationCase,
        cleanupResolvedRemoteArbitrationAttachments,
        createArbitrationCase,
        getArbitrationCaseWorkload,
        getVisibleArbitrationCaseSummary,
        releaseArbitrationCase,
        updateArbitrationCaseStatus,
      } = arbitrationService as typeof import("../service");
      const { claimUploadedAttachmentCleanup } = resolveModuleExports(
        await import("../service/attachments"),
      ) as typeof import("../service/attachments");
      const coreDbClient = resolveModuleExports(await import("../../../db/client")) as typeof import("../../../db/client");
      const coreRedisClient = resolveModuleExports(await import("../../../db/redis")) as typeof import("../../../db/redis");
      const accountDbClient = resolveModuleExports(
        await import("../../../../../packages/account-domain/dist/db/client.js"),
      ) as typeof import("../../../../../packages/account-domain/dist/db/client.js");
      const accountRedisClient = resolveModuleExports(
        await import("../../../../../packages/account-domain/dist/db/redis.js"),
      ) as typeof import("../../../../../packages/account-domain/dist/db/redis.js");
      corePool = coreDbClient.pgPool;
      coreRedis = coreRedisClient.redis;
      accountPool = accountDbClient.pgPool;
      accountRedis = accountRedisClient.redis;
      const corePoolWithEvents = corePool as { on?: (event: string, listener: () => void) => unknown } | null;
      const accountPoolWithEvents = accountPool as { on?: (event: string, listener: () => void) => unknown } | null;
      if (typeof corePoolWithEvents?.on === "function") {
        corePoolWithEvents.on("error", () => undefined);
      }
      if (typeof accountPoolWithEvents?.on === "function") {
        accountPoolWithEvents.on("error", () => undefined);
      }

      await assert.rejects(
        () =>
          createArbitrationCase("arb-outsider", {
            entityType: "task",
            entityId: "arb-task-1",
            reason: "No standing",
          }),
        (error: unknown) => isHttpError(error, 401, /participants/i),
      );

      const arbitrationCase = await createArbitrationCase("arb-creator", {
        entityType: "task",
        entityId: "arb-task-1",
        reason: "The submitted artifact is disputed.",
        evidenceSummary: "Initial screenshots from the creator.",
      });
      assert.equal(arbitrationCase.status, "open");
      assert.equal(arbitrationCase.evidences.length, 1);
      assert.equal(arbitrationCase.reviewRounds.length, 1);
      assert.equal(arbitrationCase.reviewRounds[0]?.roundNumber, 1);

      const withWorkerEvidence = await addArbitrationEvidence("arb-worker", arbitrationCase.id, {
        kind: "text_note",
        title: "Worker evidence",
        content: "The worker attached additional context for the dispute.",
      });
      assert.equal(withWorkerEvidence.evidences.length, 2);

      const claimed = await claimArbitrationCase("operator-1", arbitrationCase.id);
      assert.equal(claimed.assignedOperatorUserId, "operator-1");
      assert.equal(claimed.reviewRounds[0]?.assignedOperatorUserId, "operator-1");

      const underReview = await updateArbitrationCaseStatus("operator-1", arbitrationCase.id, {
        status: "under_review",
      });
      assert.equal(underReview.status, "under_review");

      const secondRound = await advanceArbitrationReviewRound("operator-1", arbitrationCase.id, {
        summary: "Escalate to a second operator review round.",
        assignToOperatorUserId: "operator-2",
      });
      assert.equal(secondRound.currentReviewRoundNumber, 2);
      assert.equal(secondRound.assignedOperatorUserId, "operator-2");
      assert.equal(secondRound.reviewRounds.length, 2);
      assert.equal(secondRound.reviewRounds[0]?.status, "completed");
      assert.equal(secondRound.reviewRounds[1]?.status, "open");
      assert.equal(secondRound.reviewRounds[1]?.assignedOperatorUserId, "operator-2");

      await assert.rejects(
        () => releaseArbitrationCase("operator-1", arbitrationCase.id),
        (error: unknown) => isHttpError(error, 409, /claimed by another operator/i),
      );

      const released = await releaseArbitrationCase("operator-2", arbitrationCase.id);
      assert.equal(released.assignedOperatorUserId, null);
      assert.equal(released.reviewRounds[1]?.assignedOperatorUserId, null);

      await pool.query(`
        insert into arbitration_cases (
          id,
          entity_type,
          entity_id,
          requester_user_id,
          respondent_user_id,
          assigned_operator_user_id,
          status,
          reason,
          created_at,
          updated_at
        ) values (
          'arb-stale-candidate',
          'task',
          'arb-stale-task',
          'arb-creator',
          'arb-worker',
          null,
          'open',
          'A stale review round should be claimed first.',
          now() - interval '1 hour',
          now() - interval '1 hour'
        );

        insert into arbitration_case_review_rounds (
          id,
          case_id,
          round_number,
          status,
          started_at
        ) values (
          'arb-stale-round',
          'arb-stale-candidate',
          1,
          'open',
          now() - interval '10000 hours'
        );

        insert into arbitration_case_evidences (
          id,
          case_id,
          creator_user_id,
          kind,
          title,
          created_at
        ) values (
          'arb-stale-evidence',
          'arb-stale-candidate',
          'arb-creator',
          'text_note',
          'Stale candidate evidence',
          now() - interval '1 hour'
        );

        insert into arbitration_cases (
          id,
          entity_type,
          entity_id,
          requester_user_id,
          respondent_user_id,
          assigned_operator_user_id,
          status,
          reason,
          task_resolution_action,
          created_at,
          updated_at,
          resolved_at,
          effects_applied_at
        ) values (
          'arb-resolved-metric',
          'task',
          'arb-task-1',
          'arb-creator',
          'arb-worker',
          null,
          'resolved',
          'A resolved case verifies viewer-relative reputation metrics.',
          'default',
          now() - interval '2 hours',
          now() - interval '1 hour',
          now() - interval '1 hour',
          now() - interval '1 hour'
        );

        insert into arbitration_evidence_attachments (
          id,
          evidence_id,
          case_id,
          uploader_user_id,
          file_name,
          content_type,
          size_bytes,
          storage_mode,
          storage_path,
          cleanup_requested_at,
          archived_at,
          created_at
        ) values
          (
            'arb-stale-attachment-cleanup',
            'arb-stale-evidence',
            'arb-stale-candidate',
            'arb-creator',
            'cleanup.txt',
            'text/plain',
            10,
            'remote',
            'remote/cleanup.txt',
            now() - interval '30 minutes',
            null,
            now() - interval '1 hour'
          ),
          (
            'arb-stale-attachment-archived',
            'arb-stale-evidence',
            'arb-stale-candidate',
            'arb-creator',
            'archived.txt',
            'text/plain',
            10,
            'remote',
            'remote/archived.txt',
            now() - interval '40 minutes',
            now() - interval '20 minutes',
            now() - interval '1 hour'
          ),
          (
            'arb-stale-attachment-local',
            'arb-stale-evidence',
            'arb-stale-candidate',
            'arb-creator',
            'local.txt',
            'text/plain',
            10,
            'local',
            'local/local.txt',
            null,
            now() - interval '20 minutes',
            now() - interval '1 hour'
          );
      `);

      const creatorSummary = await getVisibleArbitrationCaseSummary("arb-creator");
      assert.equal(creatorSummary.totalCount, 3);
      assert.equal(creatorSummary.evidenceCount, 3);
      assert.equal(creatorSummary.casesWithEvidenceCount, 2);
      assert.deepEqual(creatorSummary.byEvidenceKind, [{ key: "text_note", count: 3 }]);
      assert.equal(creatorSummary.remoteAttachmentCount, 2);
      assert.equal(creatorSummary.cleanupRequestedRemoteAttachmentCount, 1);
      assert.equal(creatorSummary.archivedRemoteAttachmentCount, 1);
      assert.deepEqual(creatorSummary.byReputationImpact, [
        { key: "neutral", count: 2 },
        { key: "favorable", count: 1 },
      ]);
      const workerSummary = await getVisibleArbitrationCaseSummary("arb-worker");
      assert.deepEqual(workerSummary.byReputationImpact, [
        { key: "neutral", count: 2 },
        { key: "unfavorable", count: 1 },
      ]);

      const leaseReferenceTime = new Date();
      const cleanupClaims = await Promise.all([
        claimUploadedAttachmentCleanup("arb-stale-attachment-cleanup", leaseReferenceTime, 5),
        claimUploadedAttachmentCleanup("arb-stale-attachment-cleanup", leaseReferenceTime, 5),
      ]);
      assert.equal(cleanupClaims.filter(Boolean).length, 1);
      await pool.query(`
        update arbitration_evidence_attachments
        set cleanup_lease_token = null,
            cleanup_lease_expires_at = null
        where id = 'arb-stale-attachment-cleanup'
      `);

      const cleanupRuns = await Promise.all([
        cleanupResolvedRemoteArbitrationAttachments({ limit: 10 }),
        cleanupResolvedRemoteArbitrationAttachments({ limit: 10 }),
      ]);
      assert.equal(cleanupRuns.reduce((total, result) => total + result.archivedCount, 0), 1);
      assert.equal(cleanupRuns.reduce((total, result) => total + result.failedCount, 0), 0);
      const cleanupState = await pool.query<{
        upload_state: string;
        cleanup_attempt_count: number;
        cleanup_lease_token: string | null;
        cleanup_lease_expires_at: Date | null;
      }>(`
        select upload_state,
               cleanup_attempt_count,
               cleanup_lease_token,
               cleanup_lease_expires_at
        from arbitration_evidence_attachments
        where id = 'arb-stale-attachment-cleanup'
      `);
      assert.equal(cleanupState.rows[0]?.upload_state, "archived");
      assert.equal(cleanupState.rows[0]?.cleanup_attempt_count, 1);
      assert.equal(cleanupState.rows[0]?.cleanup_lease_token, null);
      assert.equal(cleanupState.rows[0]?.cleanup_lease_expires_at, null);

      const workload = await getArbitrationCaseWorkload("operator-1");
      assert.equal(workload.claimedCount, 0);
      assert.equal(workload.unclaimedCount, 3);
      assert.equal(workload.staleRoundCount, 1);
      assert.equal(workload.unassignedOpenRoundCount, 2);
      assert.equal(workload.nextClaimCandidate?.caseId, arbitrationCase.id);
      assert.equal(workload.nextClaimCandidate?.currentReviewRoundNumber, 2);
      assert.equal(workload.nextClaimCandidate?.evidenceCount, 2);

      const nextClaimed = await claimNextArbitrationCase("operator-1");
      assert.equal(nextClaimed?.id, "arb-stale-candidate");
      assert.equal(nextClaimed?.evidences.length, 1);

      await pool.query(
        `update arbitration_cases
            set status = 'rejected', resolved_at = now(), updated_at = now()
          where id in ($1, $2)`,
        [arbitrationCase.id, "arb-stale-candidate"],
      );
      await pool.query(`
        insert into arbitration_cases (
          id, entity_type, entity_id, requester_user_id, respondent_user_id,
          assigned_operator_user_id, status, reason, created_at, updated_at
        ) values (
          'arb-atomic-claim', 'task', 'arb-atomic-task', 'arb-creator', 'arb-worker',
          null, 'open', 'Concurrent claim-next must have exactly one winner.', now(), now()
        );
        insert into arbitration_case_review_rounds (
          id, case_id, round_number, status, started_at
        ) values (
          'arb-atomic-round', 'arb-atomic-claim', 1, 'open', now()
        );
      `);

      const concurrentClaims = await Promise.all([
        claimNextArbitrationCase("operator-1"),
        claimNextArbitrationCase("operator-2"),
      ]);
      const claimWinners = concurrentClaims.filter((value) => value?.id === "arb-atomic-claim");
      assert.equal(claimWinners.length, 1);
      assert.equal(concurrentClaims.filter((value) => value === null).length, 1);
      const atomicClaimState = await pool.query<{
        assigned_operator_user_id: string | null;
        round_assignee_user_id: string | null;
      }>(`
        select ac.assigned_operator_user_id, rr.assigned_operator_user_id as round_assignee_user_id
        from arbitration_cases ac
        inner join arbitration_case_review_rounds rr on rr.case_id = ac.id and rr.status = 'open'
        where ac.id = 'arb-atomic-claim'
      `);
      assert.ok(["operator-1", "operator-2"].includes(atomicClaimState.rows[0]?.assigned_operator_user_id ?? ""));
      assert.equal(
        atomicClaimState.rows[0]?.round_assignee_user_id,
        atomicClaimState.rows[0]?.assigned_operator_user_id,
      );
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await accountPool?.end().catch(() => undefined);
      await corePool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
