"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  type AccountAnnouncement,
  accountAnnouncements,
  formatAnnouncementCalendarParts,
} from "@/lib/account-announcements";
import { cn } from "@/lib/cn";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import { AnnouncementRailTitle } from "./announcement-rail-title";
import { ANNOUNCEMENT_POLL_INTERVAL_MS } from "./constants";
import { CloseIcon, MegaphoneIcon } from "./icons";
import { readLastSeenAt, writeLastSeenAt } from "./storage";
import { isAnnouncementNewer, sortAnnouncements } from "./utils";

export type AnnouncementCenterProps = {
  userId: string | null;
};

export function AnnouncementCenterContainer({ userId }: AnnouncementCenterProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const announcementRequestIdRef = useRef(0);
  const announcementRequestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const wasOpenRef = useRef(false);
  const initialAutoOpenCheckedRef = useRef(false);
  const latestPublishedAtRef = useRef<string | null>(accountAnnouncements[0]?.publishedAt ?? null);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [announcements, setAnnouncements] = useState<AccountAnnouncement[]>(() =>
    sortAnnouncements(accountAnnouncements),
  );
  const [lastSeenPublishedAt, setLastSeenPublishedAt] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(accountAnnouncements[0]?.id ?? null);
  const titleId = useId();
  const latestAnnouncement = announcements[0] ?? null;

  const selectedAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === selectedId) ?? latestAnnouncement,
    [announcements, latestAnnouncement, selectedId],
  );

  const hasUnread = Boolean(
    hydrated &&
      userId &&
      isAnnouncementNewer(latestAnnouncement?.publishedAt ?? null, lastSeenPublishedAt),
  );

  function markLatestSeen() {
    if (!userId || !latestAnnouncement) {
      return;
    }

    writeLastSeenAt(userId, latestAnnouncement.publishedAt);
    setLastSeenPublishedAt(latestAnnouncement.publishedAt);
  }

  function handleOpen() {
    if (latestAnnouncement) {
      setSelectedId((current) => current ?? latestAnnouncement.id);
    }

    setOpen(true);
    markLatestSeen();
  }

  useEffect(() => {
    setHydrated(true);

    const seedAnnouncements = sortAnnouncements(accountAnnouncements);
    setAnnouncements(seedAnnouncements);
    latestPublishedAtRef.current = seedAnnouncements[0]?.publishedAt ?? null;
    initialAutoOpenCheckedRef.current = false;

    if (!userId) {
      setLastSeenPublishedAt(null);
      setSelectedId(seedAnnouncements[0]?.id ?? null);
      return;
    }

    const storedLastSeenAt = readLastSeenAt(userId, seedAnnouncements);
    setLastSeenPublishedAt(storedLastSeenAt);
    setSelectedId(seedAnnouncements[0]?.id ?? null);
  }, [userId]);

  useEffect(() => {
    if (!hydrated || !userId || !latestAnnouncement || initialAutoOpenCheckedRef.current) {
      return;
    }

    initialAutoOpenCheckedRef.current = true;

    if (!isAnnouncementNewer(latestAnnouncement.publishedAt, lastSeenPublishedAt)) {
      return;
    }

    setSelectedId(latestAnnouncement.id);
    setOpen(true);
    markLatestSeen();
  }, [hydrated, lastSeenPublishedAt, latestAnnouncement, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    async function refreshAnnouncements() {
      if (cancelled || announcementRequestRef.current) {
        return;
      }

      const requestId = announcementRequestIdRef.current + 1;
      announcementRequestIdRef.current = requestId;
      const controller = new AbortController();
      announcementRequestRef.current = { id: requestId, controller };

      try {
        const response = await fetch("/api/account-announcements", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (
          cancelled ||
          controller.signal.aborted ||
          announcementRequestIdRef.current !== requestId ||
          announcementRequestRef.current?.id !== requestId ||
          !response.ok
        ) {
          return;
        }

        const payload = (await response.json()) as {
          announcements?: AccountAnnouncement[];
        };

        if (
          cancelled ||
          controller.signal.aborted ||
          announcementRequestIdRef.current !== requestId ||
          announcementRequestRef.current?.id !== requestId ||
          !payload.announcements?.length
        ) {
          return;
        }

        const nextAnnouncements = sortAnnouncements(payload.announcements);
        const nextLatestPublishedAt = nextAnnouncements[0]?.publishedAt ?? null;
        const previousLatestPublishedAt = latestPublishedAtRef.current;

        latestPublishedAtRef.current = nextLatestPublishedAt;
        setAnnouncements(nextAnnouncements);

        if (nextLatestPublishedAt && previousLatestPublishedAt !== nextLatestPublishedAt) {
          setSelectedId((current) => current ?? nextAnnouncements[0]?.id ?? null);
        }
      } catch {
        // Ignore polling errors and keep the current shell usable.
      } finally {
        if (announcementRequestRef.current?.id === requestId) {
          announcementRequestRef.current = null;
        }
      }
    }

    void refreshAnnouncements();
    const intervalId = window.setInterval(refreshAnnouncements, ANNOUNCEMENT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      announcementRequestRef.current?.controller.abort();
      announcementRequestRef.current = null;
      announcementRequestIdRef.current += 1;
    };
  }, [userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    return acquireBodyOverlayLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!userId || !latestAnnouncement) {
    return null;
  }

  const announcementHeroStyle = {
    background:
      "linear-gradient(135deg, rgba(217, 255, 56, 0.88) 0 18%, rgba(22, 26, 31, 0.94) 18% 100%), linear-gradient(180deg, rgba(43, 49, 56, 0.42), rgba(13, 16, 20, 0.82))",
    color: "rgba(247, 250, 252, 0.96)",
  } as const;

  const announcementBodyStyle = {
    background:
      "linear-gradient(180deg, rgba(24, 29, 35, 0.86), rgba(11, 15, 19, 0.95) 18%, rgba(7, 10, 13, 0.98)), linear-gradient(135deg, rgba(86, 118, 146, 0.12), transparent 28%), radial-gradient(circle at top left, rgba(217, 255, 56, 0.08), transparent 18%)",
    boxShadow: "none",
    color: "rgba(232, 237, 243, 0.9)",
  } as const;

  const announcementSummaryStyle = {
    color: "rgba(232, 237, 243, 0.76)",
  } as const;

  const announcementSectionHeadingStyle = {
    color: "rgba(242, 246, 250, 0.96)",
  } as const;

  const announcementSectionTextStyle = {
    color: "rgba(226, 232, 238, 0.78)",
  } as const;

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn("app-announcement-trigger", hasUnread && !open && "app-announcement-trigger--unread")}
        onClick={handleOpen}
        ref={triggerButtonRef}
        type="button"
      >
        <span className="app-announcement-trigger__copy">
          <MegaphoneIcon />
          <span>公告</span>
        </span>
        {hasUnread ? (
          <span className={cn("app-announcement-trigger__badge", !open && "app-announcement-trigger__badge--unread")}>
            NEW
          </span>
        ) : null}
      </button>

      {open && selectedAnnouncement ? (
        <div aria-labelledby={titleId} aria-modal="true" className="app-announcement-overlay" role="dialog">
          <button
            aria-label="关闭公告面板"
            className="app-announcement-backdrop"
            onClick={() => setOpen(false)}
            type="button"
          />

          <section className="app-announcement">
            <aside className="app-announcement__rail">
              <div className="app-announcement__rail-head">
                <div className="app-announcement__rail-head-mark" aria-hidden="true">
                  <MegaphoneIcon />
                </div>
                <div className="app-announcement__rail-head-copy">
                  <h2 className="app-announcement__rail-title" id={titleId}>
                    公告
                  </h2>
                </div>
              </div>

              <div className="app-announcement__list">
                {announcements.map((announcement) => {
                  const calendar = formatAnnouncementCalendarParts(announcement.publishedAt);

                  return (
                    <button
                      className={cn(
                        "app-announcement__item",
                        selectedAnnouncement.id === announcement.id && "app-announcement__item--active",
                      )}
                      key={announcement.id}
                      onClick={() => setSelectedId(announcement.id)}
                      type="button"
                    >
                      <div className="app-announcement__item-date">
                        <strong>{calendar.day}</strong>
                        <span>{calendar.month}月</span>
                      </div>
                      <div className="app-announcement__item-divider" aria-hidden="true" />
                      <div className="app-announcement__item-body">
                        <AnnouncementRailTitle title={announcement.railTitle} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="app-announcement__content">
              <article className="app-announcement__article">
                <button
                  aria-label="关闭公告面板"
                  className="app-announcement-close"
                  onClick={() => setOpen(false)}
                  ref={closeButtonRef}
                  type="button"
                >
                  <CloseIcon />
                </button>

                <div className="app-announcement__hero" style={announcementHeroStyle}>
                  <div className="app-announcement__hero-copy">
                    <strong>{selectedAnnouncement.title}</strong>
                    <span>{formatAnnouncementCalendarParts(selectedAnnouncement.publishedAt).stamp}</span>
                  </div>
                </div>

                <div className="app-announcement__article-body" style={announcementBodyStyle}>
                  <div className="app-announcement__article-intro">
                    <span
                      className={cn(
                        "app-announcement__head-tag",
                        `app-announcement__head-tag--${selectedAnnouncement.tone}`,
                      )}
                    >
                      {selectedAnnouncement.eyebrow}
                    </span>
                    <p className="app-announcement__article-summary" style={announcementSummaryStyle}>
                      {selectedAnnouncement.summary}
                    </p>
                  </div>

                  <div className="app-announcement__body">
                    {selectedAnnouncement.sections.map((section) => (
                      <section className="app-announcement__section" key={section.title}>
                        <h4 style={announcementSectionHeadingStyle}>{section.title}</h4>
                        {section.paragraphs?.map((paragraph) => (
                          <p key={paragraph} style={announcementSectionTextStyle}>
                            {paragraph}
                          </p>
                        ))}
                        {section.bullets?.length ? (
                          <ul>
                            {section.bullets.map((bullet) => (
                              <li key={bullet} style={announcementSectionTextStyle}>
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
