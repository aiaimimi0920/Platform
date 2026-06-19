import type {
  AccountAnnouncementSection,
  AccountAnnouncementStatus,
  AccountAnnouncementTone,
  AccountAnnouncementView,
  BootstrapAccountAnnouncement,
  UpsertAccountAnnouncementInput,
} from "@neuro/contracts";
import { bootstrapAccountAnnouncements } from "@neuro/contracts";

import {
  archiveAccountAnnouncementRowsByIds,
  deleteAccountAnnouncementRow,
  getAccountAnnouncementRowById,
  insertAccountAnnouncementRow,
  listAccountAnnouncementRowsByIds,
  listOperatorAccountAnnouncementRows,
  listPublishedAccountAnnouncementRows,
  updateAccountAnnouncementRow,
} from "@/modules/announcements/repository";
import { accountAnnouncements } from "@/modules/announcements/schema";
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/platform/errors";

function now() {
  return new Date();
}

const LEGACY_UI_TEST_ANNOUNCEMENT_IDS = [
  "2026-03-21-scroll-test-a",
  "2026-03-20-scroll-test-b",
  "2026-03-19-scroll-test-c",
  "2026-03-18-scroll-test-d",
  "2026-03-17-scroll-test-e",
  "2026-03-16-scroll-test-f",
  "2026-03-15-twenty-character-title-test",
] as const;

function getPlatformOperatorUserIdSet() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function assertPlatformOperator(userId: string, providerUserId?: string | null) {
  const operatorIds = getPlatformOperatorUserIdSet();
  if (!operatorIds.has(userId) && (!providerUserId || !operatorIds.has(providerUserId))) {
    throw new UnauthorizedError("Only platform operators can manage account announcements");
  }
}

function normalizeRequiredText(value: string, fieldLabel: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`${fieldLabel}长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeParagraphs(paragraphs: string[] | undefined) {
  const normalized = (paragraphs ?? [])
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeBullets(bullets: string[] | undefined) {
  const normalized = (bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSections(sections: AccountAnnouncementSection[]) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new BadRequestError("至少需要保留一个正文分区。");
  }

  return sections.map((section, index) => {
    const title = normalizeRequiredText(section.title, `分区 ${index + 1} 标题`, 120);
    const paragraphs = normalizeParagraphs(section.paragraphs);
    const bullets = normalizeBullets(section.bullets);

    if (!paragraphs?.length && !bullets?.length) {
      throw new BadRequestError(`分区 ${index + 1} 至少需要一段正文或一组要点。`);
    }

    return {
      title,
      paragraphs,
      bullets,
    } satisfies AccountAnnouncementSection;
  });
}

function parsePublishedAt(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("发布时间格式无效。");
  }
  return parsed;
}

function normalizeTone(value: string): AccountAnnouncementTone {
  if (value === "priority" || value === "update" || value === "guide") {
    return value;
  }
  throw new BadRequestError("公告语气无效。");
}

function normalizeStatus(value: string): AccountAnnouncementStatus {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  throw new BadRequestError("公告状态无效。");
}

function toAccountAnnouncementView(
  row: typeof accountAnnouncements.$inferSelect,
): AccountAnnouncementView {
  return {
    id: row.id,
    title: row.title,
    railTitle: row.railTitle,
    summary: row.summary,
    eyebrow: row.eyebrow,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    tone: normalizeTone(row.tone),
    status: normalizeStatus(row.status),
    sections: row.sections ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

function normalizeAnnouncementInput(
  input: UpsertAccountAnnouncementInput,
  current?: typeof accountAnnouncements.$inferSelect | null,
) {
  const status = normalizeStatus(input.status);
  const tone = normalizeTone(input.tone);
  const explicitPublishedAt = parsePublishedAt(input.publishedAt);
  let publishedAt = explicitPublishedAt ?? current?.publishedAt ?? null;

  if (status === "draft") {
    publishedAt = null;
  } else if (status === "published" && !publishedAt) {
    publishedAt = now();
  }

  let archivedAt = current?.archivedAt ?? null;
  if (status === "archived") {
    archivedAt = current?.archivedAt ?? now();
  } else {
    archivedAt = null;
  }

  return {
    title: normalizeRequiredText(input.title, "公告标题", 200),
    railTitle: normalizeRequiredText(input.railTitle, "左侧标题", 40),
    summary: normalizeRequiredText(input.summary, "摘要", 2_000),
    eyebrow: normalizeRequiredText(input.eyebrow, "标签", 40),
    tone,
    status,
    sections: normalizeSections(input.sections),
    publishedAt,
    archivedAt,
  };
}

function buildSeedInsert(seed: BootstrapAccountAnnouncement) {
  const timestamp = new Date(seed.publishedAt);
  return {
    id: seed.id,
    title: seed.title,
    railTitle: seed.railTitle,
    summary: seed.summary,
    eyebrow: seed.eyebrow,
    tone: seed.tone,
    status: "published" as const,
    sections: seed.sections,
    publishedAt: timestamp,
    archivedAt: null,
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function ensureAnnouncementCatalogSeeded() {
  await archiveAccountAnnouncementRowsByIds([...LEGACY_UI_TEST_ANNOUNCEMENT_IDS], now());

  const existingRows = await listAccountAnnouncementRowsByIds(bootstrapAccountAnnouncements.map((seed) => seed.id));
  const existingIdSet = new Set(existingRows.map((row) => row.id));

  for (const seed of bootstrapAccountAnnouncements) {
    if (existingIdSet.has(seed.id)) {
      continue;
    }

    await insertAccountAnnouncementRow(buildSeedInsert(seed));
  }
}

export async function listPublishedAccountAnnouncements(): Promise<AccountAnnouncementView[]> {
  const rows = await listPublishedAccountAnnouncementRows();
  return rows.map(toAccountAnnouncementView);
}

export async function listOperatorAccountAnnouncements(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<AccountAnnouncementView[]> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const rows = await listOperatorAccountAnnouncementRows();
  return rows.map(toAccountAnnouncementView);
}

export async function createOperatorAccountAnnouncement(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertAccountAnnouncementInput,
): Promise<AccountAnnouncementView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const normalized = normalizeAnnouncementInput(input);
  const row = await insertAccountAnnouncementRow({
    id: crypto.randomUUID(),
    title: normalized.title,
    railTitle: normalized.railTitle,
    summary: normalized.summary,
    eyebrow: normalized.eyebrow,
    tone: normalized.tone,
    status: normalized.status,
    sections: normalized.sections,
    publishedAt: normalized.publishedAt,
    archivedAt: normalized.archivedAt,
    createdByUserId: operatorUserId,
    updatedByUserId: operatorUserId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return toAccountAnnouncementView(row);
}

export async function updateOperatorAccountAnnouncement(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  announcementId: string,
  input: UpsertAccountAnnouncementInput,
): Promise<AccountAnnouncementView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getAccountAnnouncementRowById(announcementId);
  if (!current) {
    throw new NotFoundError("公告不存在。");
  }

  const normalized = normalizeAnnouncementInput(input, current);
  const updated = await updateAccountAnnouncementRow(announcementId, {
    title: normalized.title,
    railTitle: normalized.railTitle,
    summary: normalized.summary,
    eyebrow: normalized.eyebrow,
    tone: normalized.tone,
    status: normalized.status,
    sections: normalized.sections,
    publishedAt: normalized.publishedAt,
    archivedAt: normalized.archivedAt,
    updatedByUserId: operatorUserId,
    updatedAt: now(),
  });

  if (!updated) {
    throw new NotFoundError("公告不存在。");
  }

  return toAccountAnnouncementView(updated);
}

export async function deleteOperatorAccountAnnouncement(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  announcementId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const deleted = await deleteAccountAnnouncementRow(announcementId);
  if (!deleted) {
    throw new NotFoundError("公告不存在。");
  }
  return {
    id: announcementId,
  };
}
