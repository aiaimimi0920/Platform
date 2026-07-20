"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type {
  HeavyChatThread,
  HeavyHistoryFilter,
  HeavyProjectContext,
  HeavySlotProfile,
} from "@/features/account-heavy-agent-chat/types";

type UseHeavyChatDirectoryOptions = {
  initialSlotId?: string | null;
  projects: HeavyProjectContext[];
  slots: HeavySlotProfile[];
  threads: HeavyChatThread[];
};

type HeavyChatDirectoryDefaultsInput = Pick<UseHeavyChatDirectoryOptions, "initialSlotId" | "projects" | "slots">;

type HeavyChatDirectorySelectionInput = Pick<UseHeavyChatDirectoryOptions, "projects" | "slots"> & {
  activeProjectId: string | null;
  activeSlotId: string | null;
};

export function resolveHeavyChatDirectoryDefaults({
  initialSlotId,
  projects,
  slots,
}: HeavyChatDirectoryDefaultsInput) {
  const activeSlotId = slots.some((slot) => slot.id === initialSlotId)
    ? initialSlotId ?? null
    : slots[0]?.id ?? null;
  const activeSlot = slots.find((slot) => slot.id === activeSlotId);
  const activeProjectId =
    activeSlot?.projectIds.find((projectId) => projects.some((project) => project.id === projectId)) ?? null;

  return { activeSlotId, activeProjectId };
}

export function reconcileHeavyChatDirectorySelection({
  activeProjectId,
  activeSlotId,
  projects,
  slots,
}: HeavyChatDirectorySelectionInput) {
  const defaults = resolveHeavyChatDirectoryDefaults({ initialSlotId: activeSlotId, projects, slots });
  const projectIsValid =
    activeProjectId !== null &&
    slots.some((slot) => slot.id === defaults.activeSlotId && slot.projectIds.includes(activeProjectId)) &&
    projects.some((project) => project.id === activeProjectId);

  return {
    activeSlotId: defaults.activeSlotId,
    activeProjectId: projectIsValid ? activeProjectId : defaults.activeProjectId,
  };
}

function resolveBoundProjectId(slotId: string | null, slots: HeavySlotProfile[], projects: HeavyProjectContext[]) {
  const slot = slots.find((item) => item.id === slotId);
  return slot?.projectIds.find((projectId) => projects.some((project) => project.id === projectId)) ?? null;
}

export function useHeavyChatDirectory({
  initialSlotId,
  projects,
  slots,
  threads,
}: UseHeavyChatDirectoryOptions) {
  const defaults = resolveHeavyChatDirectoryDefaults({ initialSlotId, projects, slots });

  const [activeSlotId, setActiveSlotId] = useState(defaults.activeSlotId);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(defaults.activeProjectId);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HeavyHistoryFilter>("all");
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

  useEffect(() => {
    const nextSelection = reconcileHeavyChatDirectorySelection({
      activeProjectId,
      activeSlotId,
      projects,
      slots,
    });

    if (activeSlotId !== nextSelection.activeSlotId) {
      setActiveSlotId(nextSelection.activeSlotId);
    }
    if (activeProjectId !== nextSelection.activeProjectId) {
      setActiveProjectId(nextSelection.activeProjectId);
    }
    if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(null);
    }
  }, [activeProjectId, activeSlotId, activeThreadId, projects, slots, threads]);

  const visibleProjects = useMemo(() => {
    return projects.filter((project) => {
      const slotVisible = activeSlotId ? slots.find((slot) => slot.id === activeSlotId)?.projectIds.includes(project.id) ?? false : true;
      if (!slotVisible) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [project.title, project.subtitle, project.instructions]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeSlotId, normalizedQuery, projects, slots]);

  const visibleThreads = useMemo(() => {
    let scopedThreads = activeSlotId ? threads.filter((thread) => thread.slotId === activeSlotId) : threads;
    if (historyFilter === "starred") {
      scopedThreads = scopedThreads.filter((thread) => thread.favorite);
    }
    if (historyFilter === "recent") {
      scopedThreads = [...scopedThreads]
        .sort((left, right) => right.updatedAtSort - left.updatedAtSort)
        .slice(0, 4);
    }
    if (!normalizedQuery) {
      return scopedThreads;
    }
    return scopedThreads.filter((thread) =>
      [thread.title, thread.preview]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [activeSlotId, historyFilter, normalizedQuery, threads]);

  const historyGroups = useMemo(() => {
    const groups = new Map<string, HeavyChatThread[]>();
    visibleThreads
      .slice()
      .sort((left, right) => right.updatedAtSort - left.updatedAtSort)
      .forEach((thread) => {
        const bucket = groups.get(thread.updatedAtGroup) ?? [];
        bucket.push(thread);
        groups.set(thread.updatedAtGroup, bucket);
      });
    return [...groups.entries()].map(([label, items]) => ({
      label,
      items,
    }));
  }, [visibleThreads]);

  function selectSlot(slotId: string) {
    setActiveSlotId(slotId);
    setActiveProjectId(resolveBoundProjectId(slotId, slots, projects));
    setActiveThreadId(null);
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId);
  }

  function selectThread(threadId: string) {
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) {
      return;
    }
    setActiveSlotId(thread.slotId);
    setActiveProjectId(thread.projectId);
    setActiveThreadId(thread.id);
    setMobileRailOpen(false);
  }

  function syncThreadContext(threadId: string, slotId: string, projectId: string | null) {
    setActiveThreadId(threadId);
    setActiveSlotId(slotId);
    setActiveProjectId(projectId);
  }

  return {
    activeProjectId,
    activeSlotId,
    activeThreadId,
    historyFilter,
    historyGroups,
    mobileRailOpen,
    searchQuery,
    setHistoryFilter,
    setMobileRailOpen,
    setSearchQuery,
    selectProject,
    selectSlot,
    selectThread,
    syncThreadContext,
    visibleProjects,
  };
}
