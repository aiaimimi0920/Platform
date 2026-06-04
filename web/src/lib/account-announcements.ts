import { bootstrapAccountAnnouncements } from "@neuro/contracts";

export type AccountAnnouncementTone = "priority" | "update" | "guide";

export type AccountAnnouncementStatus = "draft" | "published" | "archived";

export type AccountAnnouncementSection = {
  title: string;
  bullets?: string[];
  paragraphs?: string[];
};

export type AccountAnnouncementView = {
  id: string;
  title: string;
  railTitle: string;
  summary: string;
  eyebrow: string;
  publishedAt: string | null;
  tone: AccountAnnouncementTone;
  status: AccountAnnouncementStatus;
  sections: AccountAnnouncementSection[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type BootstrapAccountAnnouncement = {
  id: string;
  title: string;
  railTitle: string;
  summary: string;
  eyebrow: string;
  publishedAt: string;
  tone: AccountAnnouncementTone;
  sections: AccountAnnouncementSection[];
};

export type AccountAnnouncement = AccountAnnouncementView & {
  publishedAt: string;
};

function sortAnnouncements(items: AccountAnnouncement[]) {
  return [...items].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

function toFallbackAnnouncement(seed: BootstrapAccountAnnouncement): AccountAnnouncement {
  return {
    id: seed.id,
    title: seed.title,
    railTitle: seed.railTitle,
    summary: seed.summary,
    eyebrow: seed.eyebrow,
    publishedAt: seed.publishedAt,
    tone: seed.tone,
    status: "published",
    sections: seed.sections,
    createdAt: seed.publishedAt,
    updatedAt: seed.publishedAt,
    archivedAt: null,
  };
}

export function normalizeAccountAnnouncements(items: AccountAnnouncementView[]): AccountAnnouncement[] {
  return sortAnnouncements(
    items.flatMap((item) =>
      item.status === "published" && item.publishedAt
        ? [
            {
              ...item,
              publishedAt: item.publishedAt,
            },
          ]
        : [],
    ),
  );
}

export const accountAnnouncements = sortAnnouncements(bootstrapAccountAnnouncements.map(toFallbackAnnouncement));

export const latestAccountAnnouncement = accountAnnouncements[0] ?? null;

export function formatAnnouncementCalendarParts(value: string) {
  const date = new Date(value);
  const day =
    new Intl.DateTimeFormat("zh-CN", { day: "2-digit", timeZone: "Asia/Shanghai" })
      .formatToParts(date)
      .find((part) => part.type === "day")?.value ?? "00";
  const month =
    new Intl.DateTimeFormat("zh-CN", { month: "numeric", timeZone: "Asia/Shanghai" })
      .formatToParts(date)
      .find((part) => part.type === "month")?.value ?? "0";

  return {
    day,
    month,
    stamp: new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai",
    }).format(date),
  };
}
