import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.ACCOUNT_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || null;

type CurrencyAttachment = {
  kind: "currency";
  currency: "obsidian" | "mira" | "opinionTickets";
  amount: number;
  title?: string | null;
};

type ItemAttachment = {
  kind: "item";
  productId: string;
  title?: string | null;
};

type MailboxInput = {
  userId: string;
  title: string;
  body: string;
  type: "system" | "reward" | "compensation";
  folder: "inbox" | "stash";
  idempotencyKey: string;
  attachments: Array<CurrencyAttachment | ItemAttachment>;
};

type MailboxCounts = {
  messages: number;
  attachments: number;
  outbox: number;
  ownerMessageIds: string[];
};

function schemaConnectionString(connectionString: string, schemaName: string) {
  const url = new URL(connectionString);
  const existingOptions = url.searchParams.get("options");
  url.searchParams.set("options", `${existingOptions ? `${existingOptions} ` : ""}-c search_path=${schemaName}`);
  return url.toString();
}

function quotedIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function createFixture(pool: Pool) {
  await pool.query(`
    create table users (
      id text primary key
    );
    create table agents (
      owner_user_id text not null,
      id text not null,
      primary key (owner_user_id, id)
    );
    create table products (
      id text primary key
    );
    create table items (
      id text primary key
    );
    create table mailbox_messages (
      id text primary key,
      user_id text not null references users(id),
      folder text not null default 'inbox',
      title text not null,
      summary text,
      body text not null,
      source_label text,
      type text not null,
      read_at timestamptz,
      favorited_at timestamptz,
      expires_at timestamptz,
      created_at timestamptz not null
    );
    create table mailbox_attachments (
      id text primary key,
      message_id text not null references mailbox_messages(id) on delete cascade,
      kind text not null,
      title text,
      currency text,
      amount integer,
      product_id text references products(id),
      item_id text references items(id),
      sort_order integer not null default 0,
      claimed_at timestamptz
    );
    create table outbox_events (
      id text primary key,
      event_name text not null,
      consumer_service text not null default 'platform',
      payload jsonb not null,
      status text not null,
      attempts integer not null,
      max_attempts integer not null default 5,
      available_at timestamptz not null,
      processed_at timestamptz,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      last_error text
    );
    insert into users (id) values ('owner-a'), ('owner-b');
    insert into products (id) values ('product-a'), ('product-b');
  `);
}

async function countFixtureRows(pool: Pool, userId: string): Promise<MailboxCounts> {
  const counts = await pool.query<{
    messages: number;
    attachments: number;
    outbox: number;
  }>(
    `
      select
        (select count(*)::int from mailbox_messages where user_id = $1) as messages,
        (select count(*)::int from mailbox_attachments where message_id in (
          select id from mailbox_messages where user_id = $1
        )) as attachments,
        (select count(*)::int from outbox_events where event_name = 'mail.sent') as outbox
    `,
    [userId],
  );
  const ownerMessageIds = await pool.query<{ id: string }>(
    "select id from mailbox_messages where user_id = $1 order by id",
    [userId],
  );
  const row = counts.rows[0];
  assert.ok(row);
  return {
    messages: Number(row.messages),
    attachments: Number(row.attachments),
    outbox: Number(row.outbox),
    ownerMessageIds: ownerMessageIds.rows.map((entry) => entry.id),
  };
}

function isConflictError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === 409 &&
    "message" in error &&
    String((error as { message?: unknown }).message).includes("idempotency key")
  );
}

if (!databaseUrl) {
  test("mailbox PostgreSQL integration requires an explicit isolated database", () => {
    throw new Error(
      "ACCOUNT_DATABASE_URL or DATABASE_URL is required; mailbox integration must not be recorded as passed or skipped",
    );
  });
} else {
  test(
    "20260720 mailbox idempotency is owner-scoped, attachment-consistent, and concurrency-safe",
    { timeout: 60_000 },
    async () => {
      const schemaName = `mailbox_it_${crypto.randomUUID().replaceAll("-", "")}`;
      const quotedSchema = quotedIdentifier(schemaName);
      const isolatedDatabaseUrl = schemaConnectionString(databaseUrl, schemaName);
      const setupPool = new Pool({ connectionString: databaseUrl, max: 1 });
      const isolatedPool = new Pool({ connectionString: isolatedDatabaseUrl, max: 12 });
      let accountPool: { end: () => Promise<void> } | null = null;

      const previousEnvironment = {
        ACCOUNT_DATABASE_URL: process.env.ACCOUNT_DATABASE_URL,
        DATABASE_URL: process.env.DATABASE_URL,
        ACCOUNT_REDIS_URL: process.env.ACCOUNT_REDIS_URL,
        REDIS_URL: process.env.REDIS_URL,
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN,
      };

      try {
        await setupPool.query(`create schema ${quotedSchema}`);
        await createFixture(isolatedPool);

        const heavyChatMigration = await readFile(
          path.resolve(__dirname, "../../../../../../core/migrations/0138_heavy_chat.sql"),
          "utf8",
        );
        const mailboxMigration = await readFile(
          path.resolve(__dirname, "../../../../../../packages/account-domain/migrations/20260720_00_mailbox_message_idempotency.sql"),
          "utf8",
        );
        await isolatedPool.query(heavyChatMigration);
        await isolatedPool.query(mailboxMigration);

        const migrationCheck = await isolatedPool.query<{ index_name: string }>(
          `select indexname as index_name from pg_indexes where schemaname = current_schema() and indexname = 'mailbox_messages_user_idempotency_idx'`,
        );
        assert.equal(migrationCheck.rows.length, 1, "20260720 unique index must be applied in the isolated schema");
        const heavyChatTableCheck = await isolatedPool.query<{ table_name: string }>(
          `select table_name from information_schema.tables where table_schema = current_schema() and table_name = 'heavy_chat_messages'`,
        );
        assert.equal(heavyChatTableCheck.rows.length, 1, "0138 heavy-chat migration must be applied in the isolated schema");

        process.env.ACCOUNT_DATABASE_URL = isolatedDatabaseUrl;
        process.env.DATABASE_URL = isolatedDatabaseUrl;
        process.env.ACCOUNT_REDIS_URL = process.env.ACCOUNT_REDIS_URL?.trim() || "redis://127.0.0.1:1";
        process.env.REDIS_URL = process.env.REDIS_URL?.trim() || process.env.ACCOUNT_REDIS_URL;
        process.env.INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN?.trim() || "mailbox-integration-token";

        const [{ createMailboxMessage }, accountDbClient] = await Promise.all([
          import("./service"),
          import("../../../db/client"),
        ]);
        accountPool = accountDbClient.pgPool;

        const concurrentInput: MailboxInput = {
          userId: "owner-a",
          title: "Concurrent mailbox delivery",
          body: "Only one message should be persisted.",
          type: "reward",
          folder: "inbox",
          idempotencyKey: "it-concurrent-key",
          attachments: [
            { kind: "currency", currency: "obsidian", amount: 10, title: "Ten obsidian" },
            { kind: "item", productId: "product-a", title: "Product A" },
          ],
        };
        const concurrentResults = await Promise.all(
          Array.from({ length: 8 }, () => createMailboxMessage(concurrentInput)),
        );
        assert.equal(concurrentResults.filter((result) => result.created).length, 1);
        assert.equal(new Set(concurrentResults.map((result) => result.messageId)).size, 1);
        const concurrentCounts = await countFixtureRows(isolatedPool, "owner-a");
        assert.deepEqual(concurrentCounts, {
          messages: 1,
          attachments: 2,
          outbox: 1,
          ownerMessageIds: [concurrentResults[0]?.messageId],
        });

        const ownerInput: MailboxInput = {
          ...concurrentInput,
          idempotencyKey: "it-owner-scoped-key",
          attachments: [{ kind: "currency", currency: "mira", amount: 3, title: "Three mira" }],
        };
        const ownerAResult = await createMailboxMessage({ ...ownerInput, userId: "owner-a" });
        const ownerBResult = await createMailboxMessage({ ...ownerInput, userId: "owner-b" });
        assert.equal(ownerAResult.created, true);
        assert.equal(ownerBResult.created, true);
        assert.notEqual(ownerAResult.messageId, ownerBResult.messageId);
        const ownerACounts = await countFixtureRows(isolatedPool, "owner-a");
        const ownerBCounts = await countFixtureRows(isolatedPool, "owner-b");
        assert.equal(ownerACounts.ownerMessageIds.includes(ownerAResult.messageId), true);
        assert.equal(ownerACounts.ownerMessageIds.includes(ownerBResult.messageId), false);
        assert.equal(ownerBCounts.ownerMessageIds.includes(ownerBResult.messageId), true);
        assert.equal(ownerBCounts.ownerMessageIds.includes(ownerAResult.messageId), false);

        const conflictCases: Array<{
          name: string;
          baseAttachments: MailboxInput["attachments"];
          conflictingAttachments: MailboxInput["attachments"];
          mutatePersistedSortOrder?: boolean;
        }> = [
          {
            name: "kind",
            baseAttachments: [{ kind: "currency", currency: "obsidian", amount: 4, title: "Base" }],
            conflictingAttachments: [{ kind: "item", productId: "product-a", title: "Base" }],
          },
          {
            name: "title",
            baseAttachments: [{ kind: "currency", currency: "obsidian", amount: 4, title: "Base" }],
            conflictingAttachments: [{ kind: "currency", currency: "obsidian", amount: 4, title: "Changed" }],
          },
          {
            name: "currency",
            baseAttachments: [{ kind: "currency", currency: "obsidian", amount: 4, title: "Base" }],
            conflictingAttachments: [{ kind: "currency", currency: "mira", amount: 4, title: "Base" }],
          },
          {
            name: "amount",
            baseAttachments: [{ kind: "currency", currency: "obsidian", amount: 4, title: "Base" }],
            conflictingAttachments: [{ kind: "currency", currency: "obsidian", amount: 5, title: "Base" }],
          },
          {
            name: "productId",
            baseAttachments: [{ kind: "item", productId: "product-a", title: "Base" }],
            conflictingAttachments: [{ kind: "item", productId: "product-b", title: "Base" }],
          },
          {
            name: "sortOrder",
            baseAttachments: [
              { kind: "currency", currency: "obsidian", amount: 4, title: "First" },
              { kind: "item", productId: "product-a", title: "Second" },
            ],
            conflictingAttachments: [
              { kind: "currency", currency: "obsidian", amount: 4, title: "First" },
              { kind: "item", productId: "product-a", title: "Second" },
            ],
            mutatePersistedSortOrder: true,
          },
        ];

        for (const conflictCase of conflictCases) {
          const baseInput: MailboxInput = {
            userId: "owner-a",
            title: `Conflict ${conflictCase.name}`,
            body: `Conflict fixture for ${conflictCase.name}.`,
            type: "system",
            folder: "inbox",
            idempotencyKey: `it-conflict-${conflictCase.name}`,
            attachments: conflictCase.baseAttachments,
          };
          const created = await createMailboxMessage(baseInput);
          assert.equal(created.created, true);
          if (conflictCase.mutatePersistedSortOrder) {
            await isolatedPool.query(
              "update mailbox_attachments set sort_order = 99 where message_id = $1 and sort_order = 1",
              [created.messageId],
            );
          }
          const beforeConflict = await countFixtureRows(isolatedPool, "owner-a");
          const conflictingInput: MailboxInput = {
            ...baseInput,
            attachments: conflictCase.conflictingAttachments,
          };
          await assert.rejects(() => createMailboxMessage(conflictingInput), isConflictError);
          const afterConflict = await countFixtureRows(isolatedPool, "owner-a");
          assert.deepEqual(
            afterConflict,
            beforeConflict,
            `${conflictCase.name} conflict must not add messages, attachments, outbox events, or prune existing messages`,
          );
        }

        const pruneLoserInput: MailboxInput = {
          userId: "owner-a",
          title: "Overflow conflict base",
          body: "A conflicting retry must not prune the inbox.",
          type: "system",
          folder: "inbox",
          idempotencyKey: "it-prune-loser-key",
          attachments: [{ kind: "currency", currency: "obsidian", amount: 7, title: "Seven" }],
        };
        const pruneLoserCreated = await createMailboxMessage(pruneLoserInput);
        assert.equal(pruneLoserCreated.created, true);
        await isolatedPool.query(`
          insert into mailbox_messages (
            id,
            user_id,
            folder,
            title,
            summary,
            body,
            source_label,
            type,
            idempotency_key,
            read_at,
            favorited_at,
            expires_at,
            created_at
          )
          select
            'overflow-' || lpad(sequence::text, 4, '0'),
            'owner-a',
            'inbox',
            'Overflow filler ' || sequence,
            'Overflow filler',
            'Overflow filler body',
            'Integration',
            'system',
            null,
            null,
            null,
            null,
            now() - (sequence || ' seconds')::interval
          from generate_series(1, 201) as generated(sequence)
        `);
        const pruneBefore = await countFixtureRows(isolatedPool, "owner-a");
        const overflowBefore = await isolatedPool.query<{ overflow_count: number }>(
          `select greatest(count(*)::int - 200, 0) as overflow_count from mailbox_messages where user_id = $1 and folder = 'inbox'`,
          ["owner-a"],
        );
        assert.ok(Number(overflowBefore.rows[0]?.overflow_count) > 0);
        await assert.rejects(
          () =>
            createMailboxMessage({
              ...pruneLoserInput,
              attachments: [{ kind: "currency", currency: "obsidian", amount: 8, title: "Eight" }],
            }),
          isConflictError,
        );
        const pruneAfter = await countFixtureRows(isolatedPool, "owner-a");
        const overflowAfter = await isolatedPool.query<{ overflow_count: number }>(
          `select greatest(count(*)::int - 200, 0) as overflow_count from mailbox_messages where user_id = $1 and folder = 'inbox'`,
          ["owner-a"],
        );
        assert.deepEqual(
          pruneAfter,
          pruneBefore,
          "an idempotency conflict must not add rows or prune an already-overflowing inbox",
        );
        assert.equal(
          Number(overflowAfter.rows[0]?.overflow_count),
          Number(overflowBefore.rows[0]?.overflow_count),
          "an idempotency conflict must not change inbox overflow count",
        );
      } finally {
        if (accountPool) await accountPool.end().catch(() => {});
        await isolatedPool.end().catch(() => {});
        await setupPool.query(`drop schema if exists ${quotedSchema} cascade`).catch(() => {});
        await setupPool.end().catch(() => {});
        if (previousEnvironment.ACCOUNT_DATABASE_URL === undefined) delete process.env.ACCOUNT_DATABASE_URL;
        else process.env.ACCOUNT_DATABASE_URL = previousEnvironment.ACCOUNT_DATABASE_URL;
        if (previousEnvironment.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousEnvironment.DATABASE_URL;
        if (previousEnvironment.ACCOUNT_REDIS_URL === undefined) delete process.env.ACCOUNT_REDIS_URL;
        else process.env.ACCOUNT_REDIS_URL = previousEnvironment.ACCOUNT_REDIS_URL;
        if (previousEnvironment.REDIS_URL === undefined) delete process.env.REDIS_URL;
        else process.env.REDIS_URL = previousEnvironment.REDIS_URL;
        if (previousEnvironment.INTERNAL_API_TOKEN === undefined) delete process.env.INTERNAL_API_TOKEN;
        else process.env.INTERNAL_API_TOKEN = previousEnvironment.INTERNAL_API_TOKEN;
      }
    },
  );
}
