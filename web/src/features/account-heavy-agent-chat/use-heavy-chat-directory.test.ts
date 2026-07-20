import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyProjectContext, HeavySlotProfile } from "./types";
import {
  reconcileHeavyChatDirectorySelection,
  resolveHeavyChatDirectoryDefaults,
} from "./use-heavy-chat-directory";

const project = (id: string): HeavyProjectContext => ({
  id,
  title: id,
  subtitle: "",
  instructions: "",
  knowledgeItems: [],
  fileCount: 0,
});

const slot = (id: string, projectIds: string[]): HeavySlotProfile => ({
  id,
  title: id,
  kind: "default",
  personaLabel: id,
  summary: "",
  tokenLabel: "",
  projectIds,
  occupied: true,
});

test("directory defaults never select a project that is not bound to the active slot", () => {
  const result = resolveHeavyChatDirectoryDefaults({
    initialSlotId: "slot-a",
    projects: [project("unbound"), project("bound-to-other-slot")],
    slots: [slot("slot-a", []), slot("slot-b", ["bound-to-other-slot"])],
  });

  assert.deepEqual(result, { activeSlotId: "slot-a", activeProjectId: null });
});

test("directory defaults choose the first valid bound project for a slot", () => {
  const result = resolveHeavyChatDirectoryDefaults({
    initialSlotId: "missing-slot",
    projects: [project("project-a"), project("project-b")],
    slots: [slot("slot-a", ["project-a"]), slot("slot-b", ["project-b"])],
  });

  assert.deepEqual(result, { activeSlotId: "slot-a", activeProjectId: "project-a" });
});

test("directory selection adopts a slot and bound project after a refreshed snapshot becomes available", () => {
  const result = reconcileHeavyChatDirectorySelection({
    activeProjectId: null,
    activeSlotId: null,
    projects: [project("project-a")],
    slots: [slot("slot-a", ["project-a"])],
  });

  assert.deepEqual(result, { activeSlotId: "slot-a", activeProjectId: "project-a" });
});
