"use client";

import { useState } from "react";

import type { HeavyInspectorTarget } from "@/features/account-heavy-agent-chat/types";

export function useHeavyChatInspector(initialTarget: HeavyInspectorTarget = { type: "none" }) {
  const [target, setTarget] = useState<HeavyInspectorTarget>(initialTarget);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  function inspectSlot(slotId: string) {
    setTarget({ type: "slot", slotId });
  }

  function inspectProject(projectId: string) {
    setTarget({ type: "project", projectId });
  }

  function inspectThread(threadId: string) {
    setTarget({ type: "thread", threadId });
  }

  return {
    inspectProject,
    inspectSlot,
    inspectThread,
    mobileInspectorOpen,
    setMobileInspectorOpen,
    setTarget,
    target,
  };
}
