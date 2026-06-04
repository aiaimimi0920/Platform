import type { EventName } from "@neuro/contracts";

import { pgPool } from "@/db";
import {
  buildProcessingRecoveryErrorMessage,
  shouldDeadLetterRecoveredProcessingEvent,
} from "./outbox-recovery";

type PendingEvent = {
  id: string;
  eventName: EventName;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
};

type StaleProcessingRow = {
  id: string;
  attempts: number | string;
  max_attempts: number | string | null;
  last_error: string | null;
};

type StaleProcessingRecoveryResult = {
  requeuedCount: number;
  deadLetterCount: number;
};

const BACKOFF_BASE_SECONDS = 5;
const BACKOFF_CAP_SECONDS = 300;
const MAX_ERROR_MESSAGE_LENGTH = 1024;
const DEFAULT_STALE_PROCESSING_SCAN_LIMIT = 100;

function computeBackoffSeconds(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const seconds = BACKOFF_BASE_SECONDS * Math.pow(2, exponent);
  return Math.min(BACKOFF_CAP_SECONDS, Math.ceil(seconds));
}

function normalizeErrorMessage(message?: string): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_ERROR_MESSAGE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`;
}

export async function requeueStaleProcessingEvents(
  staleAfterMs: number,
  limit = DEFAULT_STALE_PROCESSING_SCAN_LIMIT,
): Promise<StaleProcessingRecoveryResult> {
  const client = await pgPool.connect();
  try {
    await client.query("begin");
    const result = await client.query<StaleProcessingRow>(
      `
        select id, attempts, max_attempts, last_error
        from outbox_events
        where status = 'processing'
          and consumer_service = 'platform'
          and updated_at <= now() - ($1::int * interval '1 millisecond')
        order by updated_at asc
        limit $2
        for update skip locked
      `,
      [staleAfterMs, limit],
    );

    let requeuedCount = 0;
    let deadLetterCount = 0;

    for (const row of result.rows) {
      const attempts = Number(row.attempts);
      const maxAttempts = Number(row.max_attempts ?? 5) || 5;
      if (shouldDeadLetterRecoveredProcessingEvent(attempts, maxAttempts)) {
        await client.query(
          `
            update outbox_events
            set
              status = 'dead_letter',
              last_error = $2,
              updated_at = now()
            where id = $1
          `,
          [row.id, buildProcessingRecoveryErrorMessage(row.last_error, "dead_letter")],
        );
        deadLetterCount += 1;
        continue;
      }

      await client.query(
        `
          update outbox_events
          set
            status = 'pending',
            available_at = now(),
            last_error = $2,
            updated_at = now()
          where id = $1
        `,
        [row.id, buildProcessingRecoveryErrorMessage(row.last_error, "requeued")],
      );
      requeuedCount += 1;
    }

    await client.query("commit");
    return {
      requeuedCount,
      deadLetterCount,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function pollPendingEvents(limit = 10): Promise<PendingEvent[]> {
  const client = await pgPool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `
        select id, event_name, payload, attempts, max_attempts
        from outbox_events
        where status = 'pending'
          and available_at <= now()
          and consumer_service = 'platform'
        order by created_at asc
        limit $1
        for update skip locked
      `,
      [limit],
    );

    if (result.rowCount) {
      const ids = result.rows.map((row: { id: string }) => row.id);
      await client.query(
        "update outbox_events set status = 'processing', attempts = attempts + 1, updated_at = now() where id = any($1::text[])",
        [ids],
      );
    }

    await client.query("commit");

    return result.rows.map(
      (row: {
        id: string;
        event_name: EventName;
        payload: Record<string, unknown>;
        attempts: number | string;
        max_attempts: number | string | null;
      }) => {
        const previousAttempts = Number(row.attempts);
        const maxAttempts = Number(row.max_attempts ?? 5) || 5;
        return {
          id: row.id,
          eventName: row.event_name,
          payload: row.payload,
          attempts: previousAttempts + 1,
          maxAttempts,
        };
      },
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function markEventProcessed(id: string) {
  await pgPool.query(
    `
      update outbox_events
      set
        status = 'processed',
        processed_at = now(),
        last_error = null,
        updated_at = now()
      where id = $1
    `,
    [id],
  );
}

export async function markEventFailed(
  id: string,
  attempts: number,
  maxAttempts: number,
  errorMessage?: string,
) {
  const sanitizedError = normalizeErrorMessage(errorMessage);
  const isDeadLetter = attempts >= maxAttempts;

  if (isDeadLetter) {
    await pgPool.query(
      `
        update outbox_events
        set
          status = 'dead_letter',
          last_error = $2,
          updated_at = now()
        where id = $1
      `,
      [id, sanitizedError],
    );
    return;
  }

  const delaySeconds = computeBackoffSeconds(attempts);
  await pgPool.query(
    `
      update outbox_events
      set
        status = 'pending',
        available_at = now() + ($2::int * interval '1 second'),
        last_error = $3,
        updated_at = now()
      where id = $1
    `,
    [id, delaySeconds, sanitizedError],
  );
}
