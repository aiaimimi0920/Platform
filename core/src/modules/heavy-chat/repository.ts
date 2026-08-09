import type {
  AppendHeavyChatMessageInput,
  CreateHeavyChatSlotInput,
  HeavyChatAction,
  HeavyChatActionType,
  HeavyChatMessageRole,
  HeavyChatMessageStatus,
  HeavyChatReference,
  TransitionHeavyChatMessageInput,
} from "@neuro/contracts";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as databaseSchema from "@/db/schema";
import {
  heavyChatMessageAttempts,
  heavyChatMessages,
  heavyChatProjects,
  heavyChatSlotAgents,
  heavyChatSlotProjects,
  heavyChatSlots,
  heavyChatThreads,
} from "@/modules/heavy-chat/schema";
import {
  canTransitionHeavyChatMessageStatus,
  HEAVY_CHAT_DEFAULT_MAX_SLOTS,
  HEAVY_CHAT_DEFAULT_SLOT_KEY,
  HEAVY_CHAT_DEFAULT_SLOT_TITLE,
  HeavyChatAgentBindingConflictError,
  HeavyChatActionConflictError,
  HeavyChatAttemptConflictError,
  HeavyChatInvalidTransitionError,
  HeavyChatOwnershipError,
  HeavyChatSlotLimitError,
  type HeavyChatGatewayHistoryMessageRecord,
  type HeavyChatMessageAttemptRecord,
  type HeavyChatMessagePageRecord,
  type HeavyChatMessageRecord,
  type HeavyChatProjectRecord,
  type HeavyChatSlotAgentBindingRecord,
  type HeavyChatSlotProjectRecord,
  type HeavyChatSlotRecord,
  type HeavyChatThreadRecord,
} from "@/modules/heavy-chat/types";

type DbConnection = NodePgDatabase<typeof databaseSchema>;

export type CreateHeavyChatProjectArgs = {
  id?: string;
  title: string;
  subtitle?: string | null;
  instructions?: string | null;
  sortOrder?: number;
  createdAt?: Date;
};

export type CreateHeavyChatThreadArgs = {
  id?: string;
  slotId: string;
  projectId?: string | null;
  title: string;
  favorite?: boolean;
  sortOrder?: number;
  createdAt?: Date;
};

export type AppendHeavyChatMessageArgs = Omit<AppendHeavyChatMessageInput, "createdAt"> & {
  createdAt?: Date;
};

export type TransitionHeavyChatMessageArgs = Omit<TransitionHeavyChatMessageInput, "status"> & {
  updatedAt?: Date;
  expectedAttemptNumber?: number;
};

export type ReserveHeavyChatMessageAttemptOptions = {
  staleBefore?: Date;
};

export type ReserveHeavyChatMessageActionOptions = {
  staleBefore?: Date;
};

export interface HeavyChatStore {
  transaction<T>(fn: (tx: HeavyChatStore) => Promise<T>): Promise<T>;

  /** Database implementations use transaction-scoped locks; test stores may omit these. */
  lockOwner?(ownerUserId: string): Promise<void>;
  lockMessage?(ownerUserId: string, messageId: string): Promise<void>;

  findSlotByKey(ownerUserId: string, slotKey: string): Promise<HeavyChatSlotRecord | null>;
  findSlotById(ownerUserId: string, id: string): Promise<HeavyChatSlotRecord | null>;
  listSlots(ownerUserId: string): Promise<HeavyChatSlotRecord[]>;
  countSlots(ownerUserId: string): Promise<number>;
  insertSlot(row: HeavyChatSlotRecord): Promise<HeavyChatSlotRecord>;
  findSlotAgentBySlot(ownerUserId: string, slotId: string): Promise<HeavyChatSlotAgentBindingRecord | null>;
  findSlotAgentByAgent(ownerUserId: string, agentId: string): Promise<HeavyChatSlotAgentBindingRecord | null>;
  insertSlotAgent(row: HeavyChatSlotAgentBindingRecord): Promise<HeavyChatSlotAgentBindingRecord>;
  listSlotAgentsBySlotIds(ownerUserId: string, slotIds: string[]): Promise<HeavyChatSlotAgentBindingRecord[]>;

  findProjectById(ownerUserId: string, id: string): Promise<HeavyChatProjectRecord | null>;
  listProjects(ownerUserId: string): Promise<HeavyChatProjectRecord[]>;
  listProjectsForSlot(ownerUserId: string, slotId: string): Promise<HeavyChatProjectRecord[]>;
  insertProject(row: HeavyChatProjectRecord): Promise<HeavyChatProjectRecord>;
  findSlotProject(ownerUserId: string, slotId: string, projectId: string): Promise<HeavyChatSlotProjectRecord | null>;
  listSlotProjects(ownerUserId: string, slotId: string): Promise<HeavyChatSlotProjectRecord[]>;
  listSlotProjectsBySlotIds(ownerUserId: string, slotIds: string[]): Promise<HeavyChatSlotProjectRecord[]>;
  insertSlotProject(row: HeavyChatSlotProjectRecord): Promise<HeavyChatSlotProjectRecord>;

  findThreadById(ownerUserId: string, id: string): Promise<HeavyChatThreadRecord | null>;
  listThreads(ownerUserId: string, slotId?: string): Promise<HeavyChatThreadRecord[]>;
  insertThread(row: HeavyChatThreadRecord): Promise<HeavyChatThreadRecord>;
  updateThread(
    ownerUserId: string,
    id: string,
    patch: Partial<HeavyChatThreadRecord>,
  ): Promise<HeavyChatThreadRecord | null>;

  maxMessageSequence(ownerUserId: string, threadId: string): Promise<number>;
  findMessageById(ownerUserId: string, id: string): Promise<HeavyChatMessageRecord | null>;
  findMessageByIdempotencyKey(ownerUserId: string, key: string): Promise<HeavyChatMessageRecord | null>;
  insertMessage(row: HeavyChatMessageRecord): Promise<HeavyChatMessageRecord>;
  updateMessage(
    ownerUserId: string,
    id: string,
    patch: Partial<HeavyChatMessageRecord>,
  ): Promise<HeavyChatMessageRecord | null>;
  updateMessageIfStatus?(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageStatus,
    patch: Partial<HeavyChatMessageRecord>,
  ): Promise<HeavyChatMessageRecord | null>;
  updateMessageIfStatusAndAttempt(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageStatus,
    attemptNumber: number,
    patch: Partial<HeavyChatMessageRecord>,
  ): Promise<HeavyChatMessageRecord | null>;
  listMessages(ownerUserId: string, threadId: string): Promise<HeavyChatMessageRecord[]>;
  listMessagesByThreadIds(ownerUserId: string, threadIds: string[]): Promise<HeavyChatMessageRecord[]>;
  listRecentMessagePages(
    ownerUserId: string,
    threadIds: string[],
    pageSize: number,
  ): Promise<HeavyChatMessagePageRecord[]>;
  listMessagePage(
    ownerUserId: string,
    threadId: string,
    beforeSequence: number | null,
    pageSize: number,
  ): Promise<HeavyChatMessagePageRecord>;
  listGatewayHistoryMessages(
    ownerUserId: string,
    threadId: string,
    beforeSequence: number,
  ): Promise<HeavyChatGatewayHistoryMessageRecord[]>;
  maxMessageAttemptNumber(ownerUserId: string, messageId: string): Promise<number>;
  findMessageAttemptByIdempotencyKey(
    ownerUserId: string,
    key: string,
  ): Promise<HeavyChatMessageAttemptRecord | null>;
  insertMessageAttempt(row: HeavyChatMessageAttemptRecord): Promise<HeavyChatMessageAttemptRecord>;
}

function toSlotRecord(row: typeof heavyChatSlots.$inferSelect): HeavyChatSlotRecord {
  return {
    ...row,
    kind: row.kind as HeavyChatSlotRecord["kind"],
  };
}

function toSlotAgentRecord(row: typeof heavyChatSlotAgents.$inferSelect): HeavyChatSlotAgentBindingRecord {
  return row;
}

function toProjectRecord(row: typeof heavyChatProjects.$inferSelect): HeavyChatProjectRecord {
  return row;
}

function toSlotProjectRecord(row: typeof heavyChatSlotProjects.$inferSelect): HeavyChatSlotProjectRecord {
  return row;
}

function toThreadRecord(row: typeof heavyChatThreads.$inferSelect): HeavyChatThreadRecord {
  return row;
}

function toMessageRecord(row: typeof heavyChatMessages.$inferSelect): HeavyChatMessageRecord {
  return {
    ...row,
    role: row.role as HeavyChatMessageRole,
    status: row.status as HeavyChatMessageStatus,
    references: (row.references ?? []) as HeavyChatReference[],
    actions: (row.actions ?? []) as HeavyChatAction[],
  };
}

const heavyChatMessageSelection = {
  id: heavyChatMessages.id,
  ownerUserId: heavyChatMessages.ownerUserId,
  threadId: heavyChatMessages.threadId,
  role: heavyChatMessages.role,
  status: heavyChatMessages.status,
  sequence: heavyChatMessages.sequence,
  attemptNumber: heavyChatMessages.attemptNumber,
  content: heavyChatMessages.content,
  references: heavyChatMessages.references,
  actions: heavyChatMessages.actions,
  idempotencyKey: heavyChatMessages.idempotencyKey,
  errorCode: heavyChatMessages.errorCode,
  errorMessage: heavyChatMessages.errorMessage,
  createdAt: heavyChatMessages.createdAt,
  updatedAt: heavyChatMessages.updatedAt,
};

function toMessagePage(
  threadId: string,
  messagesDescending: HeavyChatMessageRecord[],
  pageSize: number,
): HeavyChatMessagePageRecord {
  const hasMore = messagesDescending.length > pageSize;
  const retained = messagesDescending.slice(0, pageSize);
  const nextBeforeSequence = hasMore ? retained.at(-1)?.sequence ?? null : null;
  return {
    threadId,
    messages: [...retained].reverse(),
    hasMore,
    nextBeforeSequence,
  };
}

function toMessageAttemptRecord(
  row: typeof heavyChatMessageAttempts.$inferSelect,
): HeavyChatMessageAttemptRecord {
  return row;
}

class DrizzleHeavyChatStore implements HeavyChatStore {
  constructor(private readonly database: DbConnection) {}

  async lockOwner(ownerUserId: string) {
    await this.database.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${ownerUserId}, 0))`,
    );
  }

  async lockMessage(ownerUserId: string, messageId: string) {
    await this.database.execute(
      sql`select id from ${heavyChatMessages}
        where owner_user_id = ${ownerUserId} and id = ${messageId}
        for update`,
    );
  }

  transaction<T>(fn: (tx: HeavyChatStore) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx) => fn(new DrizzleHeavyChatStore(tx as unknown as DbConnection)));
  }

  async findSlotByKey(ownerUserId: string, slotKey: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatSlots)
      .where(and(eq(heavyChatSlots.ownerUserId, ownerUserId), eq(heavyChatSlots.slotKey, slotKey)))
      .limit(1);
    return row ? toSlotRecord(row) : null;
  }

  async findSlotById(ownerUserId: string, id: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatSlots)
      .where(and(eq(heavyChatSlots.ownerUserId, ownerUserId), eq(heavyChatSlots.id, id)))
      .limit(1);
    return row ? toSlotRecord(row) : null;
  }

  async listSlots(ownerUserId: string) {
    const rows = await this.database
      .select()
      .from(heavyChatSlots)
      .where(eq(heavyChatSlots.ownerUserId, ownerUserId))
      .orderBy(asc(heavyChatSlots.sortOrder), asc(heavyChatSlots.createdAt), asc(heavyChatSlots.id));
    return rows.map(toSlotRecord);
  }

  async countSlots(ownerUserId: string) {
    const [row] = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(heavyChatSlots)
      .where(eq(heavyChatSlots.ownerUserId, ownerUserId));
    return Number(row?.count ?? 0);
  }

  async insertSlot(row: HeavyChatSlotRecord) {
    const [inserted] = await this.database
      .insert(heavyChatSlots)
      .values(row)
      .onConflictDoNothing({ target: [heavyChatSlots.ownerUserId, heavyChatSlots.slotKey] })
      .returning();
    if (inserted) return toSlotRecord(inserted);
    const existing = await this.findSlotByKey(row.ownerUserId, row.slotKey);
    if (!existing) throw new Error("Heavy chat slot insert did not return a row");
    return existing;
  }

  async findSlotAgentBySlot(ownerUserId: string, slotId: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatSlotAgents)
      .where(
        and(
          eq(heavyChatSlotAgents.ownerUserId, ownerUserId),
          eq(heavyChatSlotAgents.slotId, slotId),
        ),
      )
      .limit(1);
    return row ? toSlotAgentRecord(row) : null;
  }

  async findSlotAgentByAgent(ownerUserId: string, agentId: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatSlotAgents)
      .where(
        and(
          eq(heavyChatSlotAgents.ownerUserId, ownerUserId),
          eq(heavyChatSlotAgents.agentId, agentId),
        ),
      )
      .limit(1);
    return row ? toSlotAgentRecord(row) : null;
  }

  async insertSlotAgent(row: HeavyChatSlotAgentBindingRecord) {
    const [inserted] = await this.database
      .insert(heavyChatSlotAgents)
      .values(row)
      .onConflictDoNothing()
      .returning();
    if (!inserted) throw new HeavyChatAgentBindingConflictError("Heavy chat slot or agent is already bound");
    return toSlotAgentRecord(inserted);
  }

  async listSlotAgentsBySlotIds(ownerUserId: string, slotIds: string[]) {
    if (slotIds.length === 0) return [];
    const rows = await this.database
      .select()
      .from(heavyChatSlotAgents)
      .where(
        and(
          eq(heavyChatSlotAgents.ownerUserId, ownerUserId),
          inArray(heavyChatSlotAgents.slotId, slotIds),
        ),
      )
      .orderBy(
        asc(heavyChatSlotAgents.slotId),
        asc(heavyChatSlotAgents.createdAt),
        asc(heavyChatSlotAgents.id),
      );
    return rows.map(toSlotAgentRecord);
  }

  async findProjectById(ownerUserId: string, id: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatProjects)
      .where(and(eq(heavyChatProjects.ownerUserId, ownerUserId), eq(heavyChatProjects.id, id)))
      .limit(1);
    return row ? toProjectRecord(row) : null;
  }

  async listProjects(ownerUserId: string) {
    const rows = await this.database
      .select()
      .from(heavyChatProjects)
      .where(eq(heavyChatProjects.ownerUserId, ownerUserId))
      .orderBy(asc(heavyChatProjects.sortOrder), asc(heavyChatProjects.createdAt), asc(heavyChatProjects.id));
    return rows.map(toProjectRecord);
  }

  async listProjectsForSlot(ownerUserId: string, slotId: string) {
    const rows = await this.database
      .select({ project: heavyChatProjects })
      .from(heavyChatSlotProjects)
      .innerJoin(
        heavyChatProjects,
        and(
          eq(heavyChatProjects.ownerUserId, heavyChatSlotProjects.ownerUserId),
          eq(heavyChatProjects.id, heavyChatSlotProjects.projectId),
        ),
      )
      .where(
        and(
          eq(heavyChatSlotProjects.ownerUserId, ownerUserId),
          eq(heavyChatSlotProjects.slotId, slotId),
        ),
      )
      .orderBy(asc(heavyChatSlotProjects.createdAt), asc(heavyChatSlotProjects.id));
    return rows.map((row) => toProjectRecord(row.project));
  }

  async insertProject(row: HeavyChatProjectRecord) {
    const [inserted] = await this.database.insert(heavyChatProjects).values(row).returning();
    if (!inserted) throw new Error("Heavy chat project insert did not return a row");
    return toProjectRecord(inserted);
  }

  async findSlotProject(ownerUserId: string, slotId: string, projectId: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatSlotProjects)
      .where(
        and(
          eq(heavyChatSlotProjects.ownerUserId, ownerUserId),
          eq(heavyChatSlotProjects.slotId, slotId),
          eq(heavyChatSlotProjects.projectId, projectId),
        ),
      )
      .limit(1);
    return row ? toSlotProjectRecord(row) : null;
  }

  async listSlotProjects(ownerUserId: string, slotId: string) {
    const rows = await this.database
      .select()
      .from(heavyChatSlotProjects)
      .where(and(eq(heavyChatSlotProjects.ownerUserId, ownerUserId), eq(heavyChatSlotProjects.slotId, slotId)))
      .orderBy(asc(heavyChatSlotProjects.createdAt), asc(heavyChatSlotProjects.id));
    return rows.map(toSlotProjectRecord);
  }

  async listSlotProjectsBySlotIds(ownerUserId: string, slotIds: string[]) {
    if (slotIds.length === 0) return [];
    const rows = await this.database
      .select()
      .from(heavyChatSlotProjects)
      .where(
        and(
          eq(heavyChatSlotProjects.ownerUserId, ownerUserId),
          inArray(heavyChatSlotProjects.slotId, slotIds),
        ),
      )
      .orderBy(
        asc(heavyChatSlotProjects.slotId),
        asc(heavyChatSlotProjects.createdAt),
        asc(heavyChatSlotProjects.id),
      );
    return rows.map(toSlotProjectRecord);
  }

  async insertSlotProject(row: HeavyChatSlotProjectRecord) {
    const [inserted] = await this.database
      .insert(heavyChatSlotProjects)
      .values(row)
      .onConflictDoNothing({
        target: [
          heavyChatSlotProjects.ownerUserId,
          heavyChatSlotProjects.slotId,
          heavyChatSlotProjects.projectId,
        ],
      })
      .returning();
    if (inserted) return toSlotProjectRecord(inserted);
    const existing = await this.findSlotProject(row.ownerUserId, row.slotId, row.projectId);
    if (!existing) throw new Error("Heavy chat project binding insert did not return a row");
    return existing;
  }

  async findThreadById(ownerUserId: string, id: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatThreads)
      .where(and(eq(heavyChatThreads.ownerUserId, ownerUserId), eq(heavyChatThreads.id, id)))
      .limit(1);
    return row ? toThreadRecord(row) : null;
  }

  async listThreads(ownerUserId: string, slotId?: string) {
    const ownerPredicate = eq(heavyChatThreads.ownerUserId, ownerUserId);
    const rows = await this.database
      .select()
      .from(heavyChatThreads)
      .where(slotId ? and(ownerPredicate, eq(heavyChatThreads.slotId, slotId)) : ownerPredicate)
      .orderBy(
        desc(heavyChatThreads.favorite),
        desc(heavyChatThreads.updatedAt),
        desc(heavyChatThreads.createdAt),
        asc(heavyChatThreads.id),
      );
    return rows.map(toThreadRecord);
  }

  async insertThread(row: HeavyChatThreadRecord) {
    const [inserted] = await this.database.insert(heavyChatThreads).values(row).returning();
    if (!inserted) throw new Error("Heavy chat thread insert did not return a row");
    return toThreadRecord(inserted);
  }

  async updateThread(ownerUserId: string, id: string, patch: Partial<HeavyChatThreadRecord>) {
    const [updated] = await this.database
      .update(heavyChatThreads)
      .set(patch)
      .where(and(eq(heavyChatThreads.ownerUserId, ownerUserId), eq(heavyChatThreads.id, id)))
      .returning();
    return updated ? toThreadRecord(updated) : null;
  }

  async maxMessageSequence(ownerUserId: string, threadId: string) {
    const [row] = await this.database
      .select({ value: sql<number>`coalesce(max(${heavyChatMessages.sequence}), 0)` })
      .from(heavyChatMessages)
      .where(and(eq(heavyChatMessages.ownerUserId, ownerUserId), eq(heavyChatMessages.threadId, threadId)));
    return Number(row?.value ?? 0);
  }

  async findMessageById(ownerUserId: string, id: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatMessages)
      .where(and(eq(heavyChatMessages.ownerUserId, ownerUserId), eq(heavyChatMessages.id, id)))
      .limit(1);
    return row ? toMessageRecord(row) : null;
  }

  async findMessageByIdempotencyKey(ownerUserId: string, key: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatMessages)
      .where(and(eq(heavyChatMessages.ownerUserId, ownerUserId), eq(heavyChatMessages.idempotencyKey, key)))
      .limit(1);
    return row ? toMessageRecord(row) : null;
  }

  async insertMessage(row: HeavyChatMessageRecord) {
    const [inserted] = await this.database
      .insert(heavyChatMessages)
      .values(row)
      .onConflictDoNothing()
      .returning();
    if (!inserted) throw new Error("Heavy chat message insert did not return a row");
    return toMessageRecord(inserted);
  }

  async updateMessage(ownerUserId: string, id: string, patch: Partial<HeavyChatMessageRecord>) {
    const [updated] = await this.database
      .update(heavyChatMessages)
      .set(patch)
      .where(and(eq(heavyChatMessages.ownerUserId, ownerUserId), eq(heavyChatMessages.id, id)))
      .returning();
    return updated ? toMessageRecord(updated) : null;
  }

  async updateMessageIfStatus(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageStatus,
    patch: Partial<HeavyChatMessageRecord>,
  ) {
    const [updated] = await this.database
      .update(heavyChatMessages)
      .set(patch)
      .where(
        and(
          eq(heavyChatMessages.ownerUserId, ownerUserId),
          eq(heavyChatMessages.id, id),
          eq(heavyChatMessages.status, currentStatus),
        ),
      )
      .returning();
    return updated ? toMessageRecord(updated) : null;
  }

  async updateMessageIfStatusAndAttempt(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageStatus,
    attemptNumber: number,
    patch: Partial<HeavyChatMessageRecord>,
  ) {
    const [updated] = await this.database
      .update(heavyChatMessages)
      .set(patch)
      .where(
        and(
          eq(heavyChatMessages.ownerUserId, ownerUserId),
          eq(heavyChatMessages.id, id),
          eq(heavyChatMessages.status, currentStatus),
          eq(heavyChatMessages.attemptNumber, attemptNumber),
        ),
      )
      .returning();
    return updated ? toMessageRecord(updated) : null;
  }

  async listMessages(ownerUserId: string, threadId: string) {
    const rows = await this.database
      .select()
      .from(heavyChatMessages)
      .where(and(eq(heavyChatMessages.ownerUserId, ownerUserId), eq(heavyChatMessages.threadId, threadId)))
      .orderBy(asc(heavyChatMessages.sequence), asc(heavyChatMessages.id));
    return rows.map(toMessageRecord);
  }

  async listMessagesByThreadIds(ownerUserId: string, threadIds: string[]) {
    if (threadIds.length === 0) return [];
    const rows = await this.database
      .select()
      .from(heavyChatMessages)
      .where(
        and(
          eq(heavyChatMessages.ownerUserId, ownerUserId),
          inArray(heavyChatMessages.threadId, threadIds),
        ),
      )
      .orderBy(
        asc(heavyChatMessages.threadId),
        asc(heavyChatMessages.sequence),
        asc(heavyChatMessages.id),
      );
    return rows.map(toMessageRecord);
  }

  async listRecentMessagePages(ownerUserId: string, threadIds: string[], pageSize: number) {
    if (threadIds.length === 0) return [];
    const requestedThreads = this.database
      .select({ threadId: heavyChatThreads.id })
      .from(heavyChatThreads)
      .where(
        and(
          eq(heavyChatThreads.ownerUserId, ownerUserId),
          inArray(heavyChatThreads.id, threadIds),
        ),
      )
      .as("requested_heavy_chat_threads");
    const recentMessages = this.database
      .select({
        ...heavyChatMessageSelection,
      })
      .from(heavyChatMessages)
      .where(
        and(
          eq(heavyChatMessages.ownerUserId, ownerUserId),
          eq(heavyChatMessages.threadId, requestedThreads.threadId),
        ),
      )
      .orderBy(desc(heavyChatMessages.sequence), desc(heavyChatMessages.id))
      .limit(pageSize + 1)
      .as("recent_heavy_chat_messages");
    const rows = await this.database
      .select({
        requestedThreadId: requestedThreads.threadId,
        id: recentMessages.id,
        ownerUserId: recentMessages.ownerUserId,
        threadId: recentMessages.threadId,
        role: recentMessages.role,
        status: recentMessages.status,
        sequence: recentMessages.sequence,
        attemptNumber: recentMessages.attemptNumber,
        content: recentMessages.content,
        references: recentMessages.references,
        actions: recentMessages.actions,
        idempotencyKey: recentMessages.idempotencyKey,
        errorCode: recentMessages.errorCode,
        errorMessage: recentMessages.errorMessage,
        createdAt: recentMessages.createdAt,
        updatedAt: recentMessages.updatedAt,
      })
      .from(requestedThreads)
      .innerJoinLateral(recentMessages, sql`true`)
      .orderBy(
        asc(requestedThreads.threadId),
        desc(recentMessages.sequence),
        desc(recentMessages.id),
      );
    const messagesByThreadId = new Map<string, HeavyChatMessageRecord[]>();
    for (const row of rows) {
      const { requestedThreadId, ...messageRow } = row;
      const messages = messagesByThreadId.get(row.requestedThreadId) ?? [];
      messages.push(toMessageRecord(messageRow));
      messagesByThreadId.set(requestedThreadId, messages);
    }
    return threadIds.map((threadId) =>
      toMessagePage(threadId, messagesByThreadId.get(threadId) ?? [], pageSize),
    );
  }

  async listMessagePage(
    ownerUserId: string,
    threadId: string,
    beforeSequence: number | null,
    pageSize: number,
  ) {
    const ownerThreadPredicate = and(
      eq(heavyChatMessages.ownerUserId, ownerUserId),
      eq(heavyChatMessages.threadId, threadId),
    );
    const rows = await this.database
      .select()
      .from(heavyChatMessages)
      .where(
        beforeSequence === null
          ? ownerThreadPredicate
          : and(ownerThreadPredicate, lt(heavyChatMessages.sequence, beforeSequence)),
      )
      .orderBy(desc(heavyChatMessages.sequence), desc(heavyChatMessages.id))
      .limit(pageSize + 1);
    return toMessagePage(threadId, rows.map(toMessageRecord), pageSize);
  }

  async listGatewayHistoryMessages(ownerUserId: string, threadId: string, beforeSequence: number) {
    const rows = await this.database
      .select({
        role: heavyChatMessages.role,
        content: heavyChatMessages.content,
      })
      .from(heavyChatMessages)
      .where(
        and(
          eq(heavyChatMessages.ownerUserId, ownerUserId),
          eq(heavyChatMessages.threadId, threadId),
          lt(heavyChatMessages.sequence, beforeSequence),
          eq(heavyChatMessages.status, "complete"),
          inArray(heavyChatMessages.role, ["user", "assistant", "system"]),
        ),
      )
      .orderBy(asc(heavyChatMessages.sequence), asc(heavyChatMessages.id));
    return rows.map((row) => ({
      role: row.role as HeavyChatMessageRole,
      content: row.content,
    }));
  }

  async maxMessageAttemptNumber(ownerUserId: string, messageId: string) {
    const [row] = await this.database
      .select({ value: sql<number>`coalesce(max(${heavyChatMessageAttempts.attemptNumber}), 0)` })
      .from(heavyChatMessageAttempts)
      .where(
        and(
          eq(heavyChatMessageAttempts.ownerUserId, ownerUserId),
          eq(heavyChatMessageAttempts.messageId, messageId),
        ),
      );
    return Number(row?.value ?? 0);
  }

  async findMessageAttemptByIdempotencyKey(ownerUserId: string, key: string) {
    const [row] = await this.database
      .select()
      .from(heavyChatMessageAttempts)
      .where(
        and(
          eq(heavyChatMessageAttempts.ownerUserId, ownerUserId),
          eq(heavyChatMessageAttempts.idempotencyKey, key),
        ),
      )
      .limit(1);
    return row ? toMessageAttemptRecord(row) : null;
  }

  async insertMessageAttempt(row: HeavyChatMessageAttemptRecord) {
    const [inserted] = await this.database
      .insert(heavyChatMessageAttempts)
      .values(row)
      .onConflictDoNothing()
      .returning();
    if (!inserted) throw new HeavyChatAttemptConflictError("Heavy chat message attempt already exists");
    return toMessageAttemptRecord(inserted);
  }
}

class LazyDrizzleHeavyChatStore implements HeavyChatStore {
  private delegate: HeavyChatStore | null = null;

  private async getDelegate() {
    if (!this.delegate) {
      const { db } = await import("@/db/client");
      this.delegate = new DrizzleHeavyChatStore(db);
    }
    return this.delegate;
  }

  async transaction<T>(fn: (tx: HeavyChatStore) => Promise<T>) {
    return (await this.getDelegate()).transaction(fn);
  }

  async lockOwner(ownerUserId: string) {
    return (await this.getDelegate()).lockOwner?.(ownerUserId);
  }

  async lockMessage(ownerUserId: string, messageId: string) {
    return (await this.getDelegate()).lockMessage?.(ownerUserId, messageId);
  }

  async findSlotByKey(ownerUserId: string, slotKey: string) {
    return (await this.getDelegate()).findSlotByKey(ownerUserId, slotKey);
  }

  async findSlotById(ownerUserId: string, id: string) {
    return (await this.getDelegate()).findSlotById(ownerUserId, id);
  }

  async listSlots(ownerUserId: string) {
    return (await this.getDelegate()).listSlots(ownerUserId);
  }

  async countSlots(ownerUserId: string) {
    return (await this.getDelegate()).countSlots(ownerUserId);
  }

  async insertSlot(row: HeavyChatSlotRecord) {
    return (await this.getDelegate()).insertSlot(row);
  }

  async findSlotAgentBySlot(ownerUserId: string, slotId: string) {
    return (await this.getDelegate()).findSlotAgentBySlot(ownerUserId, slotId);
  }

  async findSlotAgentByAgent(ownerUserId: string, agentId: string) {
    return (await this.getDelegate()).findSlotAgentByAgent(ownerUserId, agentId);
  }

  async insertSlotAgent(row: HeavyChatSlotAgentBindingRecord) {
    return (await this.getDelegate()).insertSlotAgent(row);
  }

  async listSlotAgentsBySlotIds(ownerUserId: string, slotIds: string[]) {
    return (await this.getDelegate()).listSlotAgentsBySlotIds(ownerUserId, slotIds);
  }

  async findProjectById(ownerUserId: string, id: string) {
    return (await this.getDelegate()).findProjectById(ownerUserId, id);
  }

  async listProjects(ownerUserId: string) {
    return (await this.getDelegate()).listProjects(ownerUserId);
  }

  async listProjectsForSlot(ownerUserId: string, slotId: string) {
    return (await this.getDelegate()).listProjectsForSlot(ownerUserId, slotId);
  }

  async insertProject(row: HeavyChatProjectRecord) {
    return (await this.getDelegate()).insertProject(row);
  }

  async findSlotProject(ownerUserId: string, slotId: string, projectId: string) {
    return (await this.getDelegate()).findSlotProject(ownerUserId, slotId, projectId);
  }

  async listSlotProjects(ownerUserId: string, slotId: string) {
    return (await this.getDelegate()).listSlotProjects(ownerUserId, slotId);
  }

  async listSlotProjectsBySlotIds(ownerUserId: string, slotIds: string[]) {
    return (await this.getDelegate()).listSlotProjectsBySlotIds(ownerUserId, slotIds);
  }

  async insertSlotProject(row: HeavyChatSlotProjectRecord) {
    return (await this.getDelegate()).insertSlotProject(row);
  }

  async findThreadById(ownerUserId: string, id: string) {
    return (await this.getDelegate()).findThreadById(ownerUserId, id);
  }

  async listThreads(ownerUserId: string, slotId?: string) {
    return (await this.getDelegate()).listThreads(ownerUserId, slotId);
  }

  async insertThread(row: HeavyChatThreadRecord) {
    return (await this.getDelegate()).insertThread(row);
  }

  async updateThread(ownerUserId: string, id: string, patch: Partial<HeavyChatThreadRecord>) {
    return (await this.getDelegate()).updateThread(ownerUserId, id, patch);
  }

  async maxMessageSequence(ownerUserId: string, threadId: string) {
    return (await this.getDelegate()).maxMessageSequence(ownerUserId, threadId);
  }

  async findMessageById(ownerUserId: string, id: string) {
    return (await this.getDelegate()).findMessageById(ownerUserId, id);
  }

  async findMessageByIdempotencyKey(ownerUserId: string, key: string) {
    return (await this.getDelegate()).findMessageByIdempotencyKey(ownerUserId, key);
  }

  async insertMessage(row: HeavyChatMessageRecord) {
    return (await this.getDelegate()).insertMessage(row);
  }

  async updateMessage(ownerUserId: string, id: string, patch: Partial<HeavyChatMessageRecord>) {
    return (await this.getDelegate()).updateMessage(ownerUserId, id, patch);
  }

  async updateMessageIfStatus(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageStatus,
    patch: Partial<HeavyChatMessageRecord>,
  ) {
    const delegate = await this.getDelegate();
    return delegate.updateMessageIfStatus
      ? delegate.updateMessageIfStatus(ownerUserId, id, currentStatus, patch)
      : delegate.updateMessage(ownerUserId, id, patch);
  }

  async updateMessageIfStatusAndAttempt(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageStatus,
    attemptNumber: number,
    patch: Partial<HeavyChatMessageRecord>,
  ) {
    const delegate = await this.getDelegate();
    if (typeof delegate.updateMessageIfStatusAndAttempt !== "function") {
      throw new HeavyChatAttemptConflictError("Attempt-aware message transition requires atomic CAS support");
    }
    return delegate.updateMessageIfStatusAndAttempt(ownerUserId, id, currentStatus, attemptNumber, patch);
  }

  async listMessages(ownerUserId: string, threadId: string) {
    return (await this.getDelegate()).listMessages(ownerUserId, threadId);
  }

  async listMessagesByThreadIds(ownerUserId: string, threadIds: string[]) {
    return (await this.getDelegate()).listMessagesByThreadIds(ownerUserId, threadIds);
  }

  async listRecentMessagePages(ownerUserId: string, threadIds: string[], pageSize: number) {
    return (await this.getDelegate()).listRecentMessagePages(ownerUserId, threadIds, pageSize);
  }

  async listMessagePage(
    ownerUserId: string,
    threadId: string,
    beforeSequence: number | null,
    pageSize: number,
  ) {
    return (await this.getDelegate()).listMessagePage(ownerUserId, threadId, beforeSequence, pageSize);
  }

  async listGatewayHistoryMessages(ownerUserId: string, threadId: string, beforeSequence: number) {
    return (await this.getDelegate()).listGatewayHistoryMessages(ownerUserId, threadId, beforeSequence);
  }

  async maxMessageAttemptNumber(ownerUserId: string, messageId: string) {
    return (await this.getDelegate()).maxMessageAttemptNumber(ownerUserId, messageId);
  }

  async findMessageAttemptByIdempotencyKey(ownerUserId: string, key: string) {
    return (await this.getDelegate()).findMessageAttemptByIdempotencyKey(ownerUserId, key);
  }

  async insertMessageAttempt(row: HeavyChatMessageAttemptRecord) {
    return (await this.getDelegate()).insertMessageAttempt(row);
  }
}

export type HeavyChatRepositoryOptions = {
  store?: HeavyChatStore;
  database?: DbConnection;
  now?: () => Date;
  createId?: () => string;
  /** Override only when a test must model separate module or process instances. */
  localMutationLocks?: Map<string, Promise<void>>;
};

export type HeavyChatRepository = ReturnType<typeof createHeavyChatRepository>;

function normalizeOwnerUserId(ownerUserId: string) {
  const normalized = ownerUserId.trim();
  if (!normalized) throw new HeavyChatOwnershipError("Heavy chat owner is required");
  return normalized;
}

function requireText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function resolveMaxSlots(args: CreateHeavyChatSlotInput) {
  const value = args.entitlement?.maxSlots ?? args.maxSlots ?? HEAVY_CHAT_DEFAULT_MAX_SLOTS;
  if (!Number.isInteger(value) || value < 1) {
    throw new HeavyChatSlotLimitError("Heavy chat maxSlots entitlement must be a positive integer");
  }
  return value;
}

function normalizeIdempotencyKey(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function recoveryAttemptKey(rootAttemptId: string, attemptNumber: number) {
  return `heavy-chat:recovery:${rootAttemptId}:${attemptNumber}`;
}

function isRecoverableStaleMessage(message: HeavyChatMessageRecord, staleBefore: Date | undefined) {
  return (
    staleBefore !== undefined &&
    (message.status === "pending" || message.status === "streaming") &&
    message.updatedAt.getTime() <= staleBefore.getTime()
  );
}

function actionIdentity(messageId: string, type: HeavyChatActionType) {
  return `heavy-chat-action:${messageId}:${type}`;
}

function actionUpdatedAt(action: HeavyChatAction) {
  const timestamp = Date.parse(action.updatedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function replaceMessageAction(
  actions: HeavyChatAction[],
  nextAction: HeavyChatAction,
) {
  const nextActions = actions.filter((action) => action.id !== nextAction.id && action.type !== nextAction.type);
  nextActions.push(nextAction);
  return nextActions;
}

const defaultLocalMutationLocks = new Map<string, Promise<void>>();

async function withLocalMutationLock<T>(
  locks: Map<string, Promise<void>>,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, current);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === current) {
      locks.delete(key);
    }
  }
}

export function createHeavyChatRepository(options: HeavyChatRepositoryOptions = {}) {
  const store = options.store ?? (options.database ? new DrizzleHeavyChatStore(options.database) : new LazyDrizzleHeavyChatStore());
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const localMutationLocks = options.localMutationLocks ?? defaultLocalMutationLocks;

  async function runOwnerTransaction<T>(ownerUserId: string, fn: (tx: HeavyChatStore) => Promise<T>) {
    return withLocalMutationLock(localMutationLocks, `heavy-chat-owner:${ownerUserId}`, () =>
      store.transaction(async (tx) => {
        await tx.lockOwner?.(ownerUserId);
        return fn(tx);
      }),
    );
  }

  async function touchThread(tx: HeavyChatStore, ownerUserId: string, threadId: string, activityAt: Date) {
    const thread = await tx.findThreadById(ownerUserId, threadId);
    if (!thread) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
    const updatedAt = thread.updatedAt.getTime() >= activityAt.getTime() ? thread.updatedAt : activityAt;
    const updated = await tx.updateThread(ownerUserId, thread.id, { updatedAt });
    if (!updated) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
    return updated;
  }

  async function rebindThreadProject(ownerUserId: string, threadId: string, projectId: string | null) {
    const owner = normalizeOwnerUserId(ownerUserId);
    const normalizedProjectId = projectId?.trim() || null;
    return runOwnerTransaction(owner, async (tx) => {
      const thread = await tx.findThreadById(owner, threadId);
      if (!thread) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
      if (normalizedProjectId) {
        const project = await tx.findProjectById(owner, normalizedProjectId);
        const binding = project
          ? await tx.findSlotProject(owner, thread.slotId, project.id)
          : null;
        if (!project || !binding) {
          throw new HeavyChatOwnershipError("Heavy chat project is not bound to the selected slot");
        }
      }
      const updated = await tx.updateThread(owner, thread.id, {
        projectId: normalizedProjectId,
        updatedAt: now(),
      });
      if (!updated) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
      return updated;
    });
  }

  async function ensureDefaultSlot(tx: HeavyChatStore, ownerUserId: string) {
    const existing = await tx.findSlotByKey(ownerUserId, HEAVY_CHAT_DEFAULT_SLOT_KEY);
    if (existing) return existing;
    const createdAt = now();
    return tx.insertSlot({
      id: createId(),
      ownerUserId,
      slotKey: HEAVY_CHAT_DEFAULT_SLOT_KEY,
      kind: "default",
      title: HEAVY_CHAT_DEFAULT_SLOT_TITLE,
      personaLabel: "Default heavy chat",
      summary: null,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return {
    async createOrGetDefaultSlot(ownerUserId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return runOwnerTransaction(owner, (tx) => ensureDefaultSlot(tx, owner));
    },

    async createCustomSlot(ownerUserId: string, args: CreateHeavyChatSlotInput) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const title = requireText(args.title, "Heavy chat slot title");
      const maxSlots = resolveMaxSlots(args);
      return runOwnerTransaction(owner, async (tx) => {
        await ensureDefaultSlot(tx, owner);
        const currentCount = await tx.countSlots(owner);
        if (currentCount >= maxSlots) {
          throw new HeavyChatSlotLimitError(
            `Heavy chat slot limit reached: ${currentCount}/${maxSlots} slots are already occupied`,
          );
        }
        const id = createId();
        const createdAt = now();
        return tx.insertSlot({
          id,
          ownerUserId: owner,
          slotKey: args.slotKey?.trim() || `custom-${id}`,
          kind: args.kind ?? "custom",
          title,
          personaLabel: args.personaLabel?.trim() || null,
          summary: args.summary?.trim() || null,
          sortOrder: currentCount,
          createdAt,
          updatedAt: createdAt,
        });
      });
    },

    async listSlots(ownerUserId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return store.listSlots(owner);
    },

    async createProject(ownerUserId: string, args: CreateHeavyChatProjectArgs) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const createdAt = args.createdAt ?? now();
      return runOwnerTransaction(owner, (tx) =>
        tx.insertProject({
          id: args.id?.trim() || createId(),
          ownerUserId: owner,
          title: requireText(args.title, "Heavy chat project title"),
          subtitle: args.subtitle?.trim() || null,
          instructions: args.instructions?.trim() || null,
          sortOrder: args.sortOrder ?? 0,
          createdAt,
          updatedAt: createdAt,
        }),
      );
    },

    async listProjects(ownerUserId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return store.listProjects(owner);
    },

    async bindProjectToSlot(ownerUserId: string, slotId: string, projectId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return runOwnerTransaction(owner, async (tx) => {
        const [slot, project] = await Promise.all([
          tx.findSlotById(owner, slotId),
          tx.findProjectById(owner, projectId),
        ]);
        if (!slot || !project) {
          throw new HeavyChatOwnershipError("Heavy chat slot or project does not belong to the owner");
        }
        const existing = await tx.findSlotProject(owner, slot.id, project.id);
        if (existing) return existing;
        return tx.insertSlotProject({
          id: createId(),
          ownerUserId: owner,
          slotId: slot.id,
          projectId: project.id,
          createdAt: now(),
        });
      });
    },

    async listProjectsForSlot(ownerUserId: string, slotId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const slot = await store.findSlotById(owner, slotId);
      if (!slot) return [];
      return store.listProjectsForSlot(owner, slot.id);
    },

    async listProjectBindingsForSlots(ownerUserId: string, slotIds: string[]) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedSlotIds = Array.from(new Set(slotIds.map((slotId) => slotId.trim()).filter(Boolean)));
      return store.listSlotProjectsBySlotIds(owner, normalizedSlotIds);
    },

    async createThread(ownerUserId: string, args: CreateHeavyChatThreadArgs) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return runOwnerTransaction(owner, async (tx) => {
        const slot = await tx.findSlotById(owner, args.slotId);
        if (!slot) throw new HeavyChatOwnershipError("Heavy chat slot does not belong to the owner");
        const projectId = args.projectId?.trim() || null;
        if (projectId) {
          const project = await tx.findProjectById(owner, projectId);
          if (!project) {
            throw new HeavyChatOwnershipError("Heavy chat project does not belong to the owner");
          }
          const binding = await tx.findSlotProject(owner, slot.id, project.id);
          if (!binding) {
            throw new HeavyChatOwnershipError("Heavy chat project is not bound to the selected slot");
          }
        }
        const createdAt = args.createdAt ?? now();
        return tx.insertThread({
          id: args.id?.trim() || createId(),
          ownerUserId: owner,
          slotId: slot.id,
          projectId,
          title: requireText(args.title, "Heavy chat thread title"),
          favorite: args.favorite ?? false,
          sortOrder: args.sortOrder ?? 0,
          createdAt,
          updatedAt: createdAt,
        });
      });
    },

    async findThreadById(ownerUserId: string, threadId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return store.findThreadById(owner, threadId);
    },

    async listThreads(ownerUserId: string, slotId?: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return store.listThreads(owner, slotId);
    },

    async setThreadFavorite(ownerUserId: string, threadId: string, favorite: boolean) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return runOwnerTransaction(owner, async (tx) => {
        const thread = await tx.findThreadById(owner, threadId);
        if (!thread) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
        const updated = await tx.updateThread(owner, thread.id, { favorite, updatedAt: now() });
        if (!updated) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
        return updated;
      });
    },

    rebindProject: rebindThreadProject,
    bindProjectToThread: rebindThreadProject,

    async appendMessage(ownerUserId: string, args: AppendHeavyChatMessageArgs) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const idempotencyKey = normalizeIdempotencyKey(args.idempotencyKey);
      return runOwnerTransaction(owner, async (tx) => {
        const thread = await tx.findThreadById(owner, args.threadId);
        if (!thread) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
        if (idempotencyKey) {
          const existing = await tx.findMessageByIdempotencyKey(owner, idempotencyKey);
          if (existing) return existing;
        }
        const createdAt = args.createdAt ?? now();
        const status = args.status ?? (args.role === "assistant" ? "pending" : "complete");
        const row: HeavyChatMessageRecord = {
          id: args.id?.trim() || createId(),
          ownerUserId: owner,
          threadId: thread.id,
          role: args.role,
          status,
          sequence: (await tx.maxMessageSequence(owner, thread.id)) + 1,
          attemptNumber: 0,
          content: args.content ?? "",
          references: structuredClone(args.references ?? []),
          actions: structuredClone(args.actions ?? []),
          idempotencyKey,
          errorCode: args.errorCode?.trim() || null,
          errorMessage: args.errorMessage?.trim() || null,
          createdAt,
          updatedAt: createdAt,
        };
        try {
          const inserted = await tx.insertMessage(row);
          await touchThread(tx, owner, thread.id, createdAt);
          return inserted;
        } catch (error) {
          if (idempotencyKey) {
            const existing = await tx.findMessageByIdempotencyKey(owner, idempotencyKey);
            if (existing) return existing;
          }
          throw error;
        }
      });
    },

    async bindAgentToSlot(ownerUserId: string, slotId: string, agentId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedSlotId = requireText(slotId, "Heavy chat slot id");
      const normalizedAgentId = requireText(agentId, "Heavy chat agent id");
      return runOwnerTransaction(owner, async (tx) => {
        const slot = await tx.findSlotById(owner, normalizedSlotId);
        if (!slot) throw new HeavyChatOwnershipError("Heavy chat slot does not belong to the owner");
        const existingForSlot = await tx.findSlotAgentBySlot(owner, slot.id);
        if (existingForSlot) {
          if (existingForSlot.agentId === normalizedAgentId) return existingForSlot;
          throw new HeavyChatAgentBindingConflictError("Heavy chat slot is already bound to another agent");
        }
        const existingForAgent = await tx.findSlotAgentByAgent(owner, normalizedAgentId);
        if (existingForAgent) {
          if (existingForAgent.slotId === slot.id) return existingForAgent;
          throw new HeavyChatAgentBindingConflictError("Heavy chat agent is already bound to another slot");
        }
        try {
          const createdAt = now();
          return await tx.insertSlotAgent({
            id: createId(),
            ownerUserId: owner,
            slotId: slot.id,
            agentId: normalizedAgentId,
            createdAt,
            updatedAt: createdAt,
          });
        } catch (error) {
          if (error instanceof HeavyChatAgentBindingConflictError) {
            const racedForSlot = await tx.findSlotAgentBySlot(owner, slot.id);
            if (racedForSlot?.agentId === normalizedAgentId) return racedForSlot;
          }
          throw error;
        }
      });
    },

    async findAgentBindingForSlot(ownerUserId: string, slotId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return store.findSlotAgentBySlot(owner, requireText(slotId, "Heavy chat slot id"));
    },

    async listAgentBindingsForSlots(ownerUserId: string, slotIds: string[]) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedSlotIds = Array.from(new Set(slotIds.map((slotId) => slotId.trim()).filter(Boolean)));
      return store.listSlotAgentsBySlotIds(owner, normalizedSlotIds);
    },

    async reserveMessageAttempt(
      ownerUserId: string,
      messageId: string,
      idempotencyKey: string,
      options: ReserveHeavyChatMessageAttemptOptions = {},
    ) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedMessageId = requireText(messageId, "Heavy chat message id");
      const normalizedKey = requireText(idempotencyKey, "Heavy chat attempt idempotency key");
      return runOwnerTransaction(owner, async (tx) => {
        const existingAttempt = await tx.findMessageAttemptByIdempotencyKey(owner, normalizedKey);
        if (existingAttempt) {
          if (existingAttempt.messageId !== normalizedMessageId) {
            throw new HeavyChatAttemptConflictError("Heavy chat attempt key is already used for another message");
          }
          await tx.lockMessage?.(owner, normalizedMessageId);
          const existingMessage = await tx.findMessageById(owner, existingAttempt.messageId);
          if (!existingMessage) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");

          let activeAttempt = existingAttempt;
          if (existingMessage.attemptNumber !== existingAttempt.attemptNumber) {
            const recoveryAttempt = await tx.findMessageAttemptByIdempotencyKey(
              owner,
              recoveryAttemptKey(existingAttempt.id, existingMessage.attemptNumber),
            );
            if (
              !recoveryAttempt ||
              recoveryAttempt.messageId !== existingMessage.id ||
              recoveryAttempt.attemptNumber !== existingMessage.attemptNumber
            ) {
              return { attempt: existingAttempt, message: existingMessage, created: false as const };
            }
            activeAttempt = recoveryAttempt;
          }

          if (isRecoverableStaleMessage(existingMessage, options.staleBefore)) {
            const attemptNumber = (await tx.maxMessageAttemptNumber(owner, existingMessage.id)) + 1;
            const recoveryKey = recoveryAttemptKey(existingAttempt.id, attemptNumber);
            const racedRecovery = await tx.findMessageAttemptByIdempotencyKey(owner, recoveryKey);
            if (racedRecovery) {
              const racedMessage = await tx.findMessageById(owner, racedRecovery.messageId);
              if (racedMessage) {
                return { attempt: racedRecovery, message: racedMessage, created: false as const };
              }
            }

            const recoveryAttempt: HeavyChatMessageAttemptRecord = {
              id: createId(),
              ownerUserId: owner,
              messageId: existingMessage.id,
              idempotencyKey: recoveryKey,
              attemptNumber,
              createdAt: now(),
            };
            try {
              await tx.insertMessageAttempt(recoveryAttempt);
            } catch (error) {
              if (error instanceof HeavyChatAttemptConflictError) {
                const raced = await tx.findMessageAttemptByIdempotencyKey(owner, recoveryKey);
                if (raced) {
                  const racedMessage = await tx.findMessageById(owner, raced.messageId);
                  if (racedMessage) {
                    return { attempt: raced, message: racedMessage, created: false as const };
                  }
                }
              }
              throw error;
            }

            const updated = await tx.updateMessageIfStatusAndAttempt(
              owner,
              existingMessage.id,
              existingMessage.status,
              activeAttempt.attemptNumber,
              {
                status: "pending",
                attemptNumber,
                errorCode: null,
                errorMessage: null,
                updatedAt: now(),
              },
            );
            if (!updated) {
              throw new HeavyChatAttemptConflictError("Heavy chat message changed before stale attempt recovery");
            }
            await touchThread(tx, owner, updated.threadId, updated.updatedAt);
            return { attempt: recoveryAttempt, message: updated, created: true as const };
          }

          return { attempt: activeAttempt, message: existingMessage, created: false as const };
        }

        await tx.lockMessage?.(owner, normalizedMessageId);
        const message = await tx.findMessageById(owner, normalizedMessageId);
        if (!message) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        if (message.role !== "assistant") {
          throw new HeavyChatInvalidTransitionError("Only assistant messages can reserve execution attempts");
        }
        if (message.status === "pending" && message.attemptNumber > 0) {
          throw new HeavyChatAttemptConflictError("Heavy chat message already has a pending execution attempt");
        }
        if (message.status !== "pending" && message.status !== "failed") {
          throw new HeavyChatInvalidTransitionError(
            `Cannot reserve an execution attempt while message is ${message.status}`,
          );
        }

        const attemptNumber = (await tx.maxMessageAttemptNumber(owner, message.id)) + 1;
        const attempt: HeavyChatMessageAttemptRecord = {
          id: createId(),
          ownerUserId: owner,
          messageId: message.id,
          idempotencyKey: normalizedKey,
          attemptNumber,
          createdAt: now(),
        };
        try {
          await tx.insertMessageAttempt(attempt);
        } catch (error) {
          if (error instanceof HeavyChatAttemptConflictError) {
            const raced = await tx.findMessageAttemptByIdempotencyKey(owner, normalizedKey);
            if (raced) {
              const racedMessage = await tx.findMessageById(owner, raced.messageId);
              if (racedMessage && raced.messageId === message.id) {
                return { attempt: raced, message: racedMessage, created: false as const };
              }
            }
          }
          throw error;
        }

        const updated = tx.updateMessageIfStatus
          ? await tx.updateMessageIfStatus(owner, message.id, message.status, {
              status: "pending",
              attemptNumber,
              errorCode: null,
              errorMessage: null,
              updatedAt: now(),
            })
          : await tx.updateMessage(owner, message.id, {
              status: "pending",
              attemptNumber,
              errorCode: null,
              errorMessage: null,
              updatedAt: now(),
            });
        if (!updated) throw new HeavyChatAttemptConflictError("Heavy chat message changed before attempt reservation");
        await touchThread(tx, owner, updated.threadId, updated.updatedAt);
        return { attempt, message: updated, created: true as const };
      });
    },

    async reserveMessageAction(
      ownerUserId: string,
      messageId: string,
      type: HeavyChatActionType,
      options: ReserveHeavyChatMessageActionOptions = {},
    ) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedMessageId = requireText(messageId, "Heavy chat message id");
      if (type !== "task" && type !== "mailbox") {
        throw new HeavyChatInvalidTransitionError("Unsupported heavy chat action type");
      }
      return runOwnerTransaction(owner, async (tx) => {
        await tx.lockMessage?.(owner, normalizedMessageId);
        const message = await tx.findMessageById(owner, normalizedMessageId);
        if (!message) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        if (message.role !== "assistant" || message.status !== "complete") {
          throw new HeavyChatInvalidTransitionError(
            "Heavy chat actions require a completed assistant message",
          );
        }

        const existing = message.actions.find((action) => action.type === type);
        if (existing?.status === "complete") {
          return { message, action: existing, claimed: false as const };
        }
        if (
          existing?.status === "pending" &&
          (!options.staleBefore || actionUpdatedAt(existing) > options.staleBefore.getTime())
        ) {
          return { message, action: existing, claimed: false as const };
        }

        const updatedAt = now();
        const action: HeavyChatAction = existing
          ? {
              ...existing,
              status: "pending",
              attemptNumber: existing.attemptNumber + 1,
              errorMessage: null,
              updatedAt: updatedAt.toISOString(),
            }
          : {
              id: actionIdentity(message.id, type),
              type,
              status: "pending",
              attemptNumber: 1,
              targetId: null,
              errorMessage: null,
              updatedAt: updatedAt.toISOString(),
            };
        const updated = await tx.updateMessage(owner, message.id, {
          actions: replaceMessageAction(message.actions, action),
          updatedAt,
        });
        if (!updated) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        await touchThread(tx, owner, updated.threadId, updatedAt);
        return { message: updated, action, claimed: true as const };
      });
    },

    async completeMessageAction(
      ownerUserId: string,
      messageId: string,
      actionId: string,
      expectedAttemptNumber: number,
      targetId: string,
    ) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedMessageId = requireText(messageId, "Heavy chat message id");
      const normalizedActionId = requireText(actionId, "Heavy chat action id");
      const normalizedTargetId = requireText(targetId, "Heavy chat action target id");
      return runOwnerTransaction(owner, async (tx) => {
        await tx.lockMessage?.(owner, normalizedMessageId);
        const message = await tx.findMessageById(owner, normalizedMessageId);
        if (!message) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        const current = message.actions.find((action) => action.id === normalizedActionId);
        if (!current) throw new HeavyChatActionConflictError("Heavy chat action does not exist");
        if (current.attemptNumber !== expectedAttemptNumber) {
          throw new HeavyChatActionConflictError("Heavy chat action attempt changed before completion");
        }
        if (current.status === "complete") {
          if (current.targetId !== normalizedTargetId) {
            throw new HeavyChatActionConflictError("Heavy chat action already completed with another target");
          }
          return { message, action: current };
        }
        if (current.status !== "pending") {
          throw new HeavyChatActionConflictError("Heavy chat action is not pending completion");
        }
        const updatedAt = now();
        const action: HeavyChatAction = {
          ...current,
          status: "complete",
          targetId: normalizedTargetId,
          errorMessage: null,
          updatedAt: updatedAt.toISOString(),
        };
        const updated = await tx.updateMessage(owner, message.id, {
          actions: replaceMessageAction(message.actions, action),
          updatedAt,
        });
        if (!updated) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        await touchThread(tx, owner, updated.threadId, updatedAt);
        return { message: updated, action };
      });
    },

    async failMessageAction(
      ownerUserId: string,
      messageId: string,
      actionId: string,
      expectedAttemptNumber: number,
      input: { errorMessage: string; targetId?: string | null },
    ) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedMessageId = requireText(messageId, "Heavy chat message id");
      const normalizedActionId = requireText(actionId, "Heavy chat action id");
      const errorMessage = requireText(input.errorMessage, "Heavy chat action error").slice(0, 1_000);
      return runOwnerTransaction(owner, async (tx) => {
        await tx.lockMessage?.(owner, normalizedMessageId);
        const message = await tx.findMessageById(owner, normalizedMessageId);
        if (!message) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        const current = message.actions.find((action) => action.id === normalizedActionId);
        if (!current) throw new HeavyChatActionConflictError("Heavy chat action does not exist");
        if (current.attemptNumber !== expectedAttemptNumber) {
          throw new HeavyChatActionConflictError("Heavy chat action attempt changed before failure persistence");
        }
        if (current.status === "complete") {
          throw new HeavyChatActionConflictError("Completed heavy chat actions cannot fail");
        }
        if (current.status === "failed") {
          return { message, action: current };
        }
        const updatedAt = now();
        const action: HeavyChatAction = {
          ...current,
          status: "failed",
          targetId: input.targetId === undefined
            ? current.targetId
            : input.targetId?.trim() || null,
          errorMessage,
          updatedAt: updatedAt.toISOString(),
        };
        const updated = await tx.updateMessage(owner, message.id, {
          actions: replaceMessageAction(message.actions, action),
          updatedAt,
        });
        if (!updated) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        await touchThread(tx, owner, updated.threadId, updatedAt);
        return { message: updated, action };
      });
    },

    async transitionMessage(
      ownerUserId: string,
      messageId: string,
      status: HeavyChatMessageStatus,
      args: TransitionHeavyChatMessageArgs = {},
    ) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return runOwnerTransaction(owner, async (tx) => {
        await tx.lockMessage?.(owner, messageId);
        const message = await tx.findMessageById(owner, messageId);
        if (!message) throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        if (!canTransitionHeavyChatMessageStatus(message.status, status)) {
          throw new HeavyChatInvalidTransitionError(
            `Cannot move heavy chat message from ${message.status} to ${status}`,
          );
        }
        const patch: Partial<HeavyChatMessageRecord> = {
          status,
          updatedAt: args.updatedAt ?? now(),
        };
        if (args.content !== undefined) patch.content = args.content;
        if (args.references !== undefined) patch.references = structuredClone(args.references);
        if (args.actions !== undefined) patch.actions = structuredClone(args.actions);
        if (args.errorCode !== undefined) patch.errorCode = args.errorCode?.trim() || null;
        if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage?.trim() || null;
        let updated: HeavyChatMessageRecord | null;
        if (args.expectedAttemptNumber !== undefined) {
          if (typeof tx.updateMessageIfStatusAndAttempt !== "function") {
            throw new HeavyChatAttemptConflictError("Attempt-aware message transition requires atomic CAS support");
          }
          updated = await tx.updateMessageIfStatusAndAttempt(
            owner,
            message.id,
            message.status,
            args.expectedAttemptNumber,
            patch,
          );
        } else if (tx.updateMessageIfStatus) {
          updated = await tx.updateMessageIfStatus(owner, message.id, message.status, patch);
        } else {
          updated = await tx.updateMessage(owner, message.id, patch);
        }
        if (!updated) {
          const latest = await tx.findMessageById(owner, message.id);
          if (latest && args.expectedAttemptNumber !== undefined && latest.attemptNumber !== args.expectedAttemptNumber) {
            throw new HeavyChatAttemptConflictError("Heavy chat message attempt changed before transition");
          }
          if (latest && !canTransitionHeavyChatMessageStatus(latest.status, status)) {
            throw new HeavyChatInvalidTransitionError(
              `Cannot move heavy chat message from ${latest.status} to ${status}`,
            );
          }
          throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
        }
        await touchThread(tx, owner, updated.threadId, patch.updatedAt ?? now());
        return updated;
      });
    },

    async findMessageById(ownerUserId: string, messageId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      return store.findMessageById(owner, messageId);
    },

    async findMessageByIdempotencyKey(ownerUserId: string, key: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const idempotencyKey = normalizeIdempotencyKey(key);
      return idempotencyKey ? store.findMessageByIdempotencyKey(owner, idempotencyKey) : null;
    },

    async listMessages(ownerUserId: string, threadId: string) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const thread = await store.findThreadById(owner, threadId);
      if (!thread) return [];
      return store.listMessages(owner, thread.id);
    },

    async listMessagesByThreadIds(ownerUserId: string, threadIds: string[]) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedThreadIds = Array.from(
        new Set(threadIds.map((threadId) => threadId.trim()).filter(Boolean)),
      );
      return store.listMessagesByThreadIds(owner, normalizedThreadIds);
    },

    async listRecentMessagePages(ownerUserId: string, threadIds: string[], pageSize: number) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedThreadIds = Array.from(
        new Set(threadIds.map((threadId) => threadId.trim()).filter(Boolean)),
      );
      if (!Number.isInteger(pageSize) || pageSize < 1) {
        throw new Error("Heavy chat message page size must be a positive integer");
      }
      return store.listRecentMessagePages(owner, normalizedThreadIds, pageSize);
    },

    async listMessagePage(
      ownerUserId: string,
      threadId: string,
      beforeSequence: number | null,
      pageSize: number,
    ) {
      const owner = normalizeOwnerUserId(ownerUserId);
      const normalizedThreadId = requireText(threadId, "Heavy chat thread id");
      if (beforeSequence !== null && (!Number.isInteger(beforeSequence) || beforeSequence < 1)) {
        throw new Error("Heavy chat message cursor must be a positive integer");
      }
      if (!Number.isInteger(pageSize) || pageSize < 1) {
        throw new Error("Heavy chat message page size must be a positive integer");
      }
      return store.listMessagePage(owner, normalizedThreadId, beforeSequence, pageSize);
    },

    async listGatewayHistoryMessages(ownerUserId: string, threadId: string, beforeSequence: number) {
      const owner = normalizeOwnerUserId(ownerUserId);
      if (!Number.isInteger(beforeSequence) || beforeSequence < 1) {
        throw new Error("Heavy chat history boundary must be a positive integer");
      }
      const messages = await store.listGatewayHistoryMessages(owner, threadId, beforeSequence);
      return messages.filter((message) => message.content.trim());
    },
  };
}

const defaultRepository = createHeavyChatRepository();

export const createOrGetDefaultSlot = defaultRepository.createOrGetDefaultSlot;
export const createCustomSlot = defaultRepository.createCustomSlot;
export const listSlots = defaultRepository.listSlots;
export const createProject = defaultRepository.createProject;
export const listProjects = defaultRepository.listProjects;
export const bindProjectToSlot = defaultRepository.bindProjectToSlot;
export const listProjectsForSlot = defaultRepository.listProjectsForSlot;
export const listProjectBindingsForSlots = defaultRepository.listProjectBindingsForSlots;
export const createThread = defaultRepository.createThread;
export const findThreadById = defaultRepository.findThreadById;
export const listThreads = defaultRepository.listThreads;
export const setThreadFavorite = defaultRepository.setThreadFavorite;
export const rebindProject = defaultRepository.rebindProject;
export const bindProjectToThread = defaultRepository.bindProjectToThread;
export const bindAgentToSlot = defaultRepository.bindAgentToSlot;
export const findAgentBindingForSlot = defaultRepository.findAgentBindingForSlot;
export const listAgentBindingsForSlots = defaultRepository.listAgentBindingsForSlots;
export const appendMessage = defaultRepository.appendMessage;
export const reserveMessageAttempt = defaultRepository.reserveMessageAttempt;
export const reserveMessageAction = defaultRepository.reserveMessageAction;
export const completeMessageAction = defaultRepository.completeMessageAction;
export const failMessageAction = defaultRepository.failMessageAction;
export const transitionMessage = defaultRepository.transitionMessage;
export const findMessageById = defaultRepository.findMessageById;
export const findMessageByIdempotencyKey = defaultRepository.findMessageByIdempotencyKey;
export const listMessages = defaultRepository.listMessages;
export const listMessagesByThreadIds = defaultRepository.listMessagesByThreadIds;
export const listRecentMessagePages = defaultRepository.listRecentMessagePages;
export const listMessagePage = defaultRepository.listMessagePage;
export const listGatewayHistoryMessages = defaultRepository.listGatewayHistoryMessages;
