"use client";

import { startTransition, useCallback, useMemo, useRef, useState } from "react";

import type { HeavyChatSnapshot, HeavyChatThreadView } from "@neuro/contracts";

import { adaptHeavyChatSnapshot } from "./adapter";
import type {
  HeavyActionNotice,
  HeavyChatReference,
  HeavyMessageBlock,
  HeavyProjectContext,
  HeavyReferenceType,
  HeavyWorkspaceSnapshot,
} from "./types";

type UseHeavyChatThreadStateOptions = {
  initialSnapshot: HeavyWorkspaceSnapshot;
  initialError?: string | null;
};

function id(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
  return `${prefix}-${random}`;
}

function correlationId() {
  return globalThis.crypto?.randomUUID?.() ?? id("correlation");
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "重度对话服务暂时不可用。";
}

async function browserRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(pathname, {
    ...init,
    headers,
    cache: "no-store",
  });
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = raw;
    }
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : null;
    throw new Error(typeof message === "string" && message.trim() ? message : "重度对话请求失败。");
  }
  return body as T;
}

function referenceTone(type: HeavyReferenceType): HeavyChatReference["tone"] {
  if (type === "mail") return "warning";
  if (type === "task") return "success";
  if (type === "delivery") return "violet";
  return "cyan";
}

function createReference(type: HeavyReferenceType, sequence: number, projectTitle?: string): HeavyChatReference {
  return {
    id: id("reference"),
    type,
    title: type === "file"
      ? `${projectTitle || "项目"}上下文-${sequence}`
      : type === "mail"
        ? `站内邮箱消息 #${sequence}`
        : type === "task"
          ? `任务单 TASK-${String(sequence).padStart(3, "0")}`
          : `交付项 DEL-${String(sequence).padStart(3, "0")}`,
    meta: type === "file" ? "Project context" : type === "mail" ? "Mailbox" : type === "task" ? "Task Hub" : "Delivery",
    tone: referenceTone(type),
  };
}

function flattenMessageText(blocks: HeavyMessageBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "status") return `${block.label}${block.description ? `: ${block.description}` : ""}`;
      if (block.type === "actionable-summary") return `${block.title}\n${block.items.join("\n")}`;
      return block.references.map((reference) => `${reference.title} (${reference.meta})`).join("\n");
    })
    .join("\n\n");
}

function notice(tone: HeavyActionNotice["tone"], message: string): HeavyActionNotice {
  return { id: id("notice"), tone, message };
}

export function useHeavyChatThreadState({
  initialSnapshot,
  initialError = null,
}: UseHeavyChatThreadStateOptions) {
  const [workspace, setWorkspace] = useState<HeavyWorkspaceSnapshot>(initialSnapshot);
  const [draft, setDraft] = useState("");
  const [selectedReferences, setSelectedReferences] = useState<HeavyChatReference[]>([]);
  const [actionNotice, setActionNotice] = useState<HeavyActionNotice | null>(
    initialError ? notice("danger", initialError) : null,
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const threadMap = useMemo(
    () => new Map(workspace.threads.map((thread) => [thread.id, thread])),
    [workspace.threads],
  );

  const refreshSnapshot = useCallback(async () => {
    const response = await browserRequest<{ snapshot: HeavyChatSnapshot }>("/api/heavy-chat/snapshot");
    const nextWorkspace = adaptHeavyChatSnapshot(response.snapshot);
    startTransition(() => setWorkspace(nextWorkspace));
    return nextWorkspace;
  }, []);

  const refreshSnapshotSilently = useCallback(async () => {
    try {
      return await refreshSnapshot();
    } catch {
      return null;
    }
  }, [refreshSnapshot]);

  const createPersistedThread = useCallback(
    async (slotId: string, projectId: string | null, title: string) => {
      const response = await browserRequest<{ thread: HeavyChatThreadView }>("/api/heavy-chat/threads", {
        method: "POST",
        body: JSON.stringify({ slotId, projectId, title }),
      });
      const nextWorkspace = await refreshSnapshot();
      return nextWorkspace.threads.find((thread) => thread.id === response.thread.id) ?? null;
    },
    [refreshSnapshot],
  );

  async function createThread(slotId: string, projectId: string | null) {
    if (busyRef.current) return null;
    const slot = workspace.slots.find((item) => item.id === slotId);
    busyRef.current = true;
    setBusy(true);
    try {
      const thread = await createPersistedThread(slotId, projectId, `新对话 / ${slot?.title || "重度对话"}`);
      setActionNotice(thread ? notice("success", "会话已保存到当前账户。") : notice("danger", "会话创建后未能刷新持久化状态。"));
      return thread;
    } catch (error) {
      await refreshSnapshotSilently();
      setActionNotice(notice("danger", errorMessage(error)));
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function sendMessage(
    activeThreadId: string | null,
    activeSlotId: string | null,
    activeProjectId: string | null,
  ) {
    const content = draft.trim();
    if (!content || !activeSlotId || busyRef.current) {
      if (!content) setActionNotice(notice("danger", "请输入消息后再发送。"));
      return null;
    }

    setDraft("");
    setSelectedReferences([]);
    busyRef.current = true;
    setBusy(true);
    let targetThreadId = activeThreadId;
    try {
      if (!targetThreadId) {
        const created = await createPersistedThread(
          activeSlotId,
          activeProjectId,
          `${content.slice(0, 32)}${content.length > 32 ? "…" : ""}`,
        );
        if (!created) throw new Error("会话创建后未能读取持久化线程");
        targetThreadId = created.id;
      }

      await browserRequest(`/api/heavy-chat/threads/${encodeURIComponent(targetThreadId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          idempotencyKey: id(`heavy-chat:send:${targetThreadId}`),
          correlationId: correlationId(),
        }),
      });
      const nextWorkspace = await refreshSnapshot();
      const persistedThread = nextWorkspace.threads.find((thread) => thread.id === targetThreadId);
      setActionNotice(notice("success", "回复已持久化，可以继续编辑、重试或转入后续工作流。"));
      return persistedThread
        ? { threadId: persistedThread.id, slotId: persistedThread.slotId, projectId: persistedThread.projectId }
        : null;
    } catch (error) {
      await refreshSnapshotSilently();
      setActionNotice(notice("danger", errorMessage(error)));
      return targetThreadId
        ? { threadId: targetThreadId, slotId: activeSlotId, projectId: activeProjectId }
        : null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function runMessageAction(
    threadId: string,
    messageId: string,
    action: "copy" | "retry" | "task" | "mailbox" | "edit",
  ) {
    const thread = threadMap.get(threadId);
    const message = thread?.messages.find((item) => item.id === messageId);
    if (!thread || !message) return;

    if (action === "copy") {
      const text = flattenMessageText(message.blocks);
      await navigator.clipboard?.writeText(text);
      setActionNotice(notice("glass", "已复制当前消息内容。"));
      return;
    }
    if (action === "edit") {
      setDraft(flattenMessageText(message.blocks));
      setActionNotice(notice("warning", "已把当前消息放回输入框。"));
      return;
    }
    if (action === "task") {
      setActionNotice(notice("warning", "任务动作将在 Task Hub bridge 完成后写入。"));
      return;
    }
    if (action === "mailbox") {
      setActionNotice(notice("warning", "邮箱动作将在 mailbox bridge 完成后写入。"));
      return;
    }
    if (busyRef.current || message.role !== "assistant") return;

    busyRef.current = true;
    setBusy(true);
    setActionNotice(notice("warning", "正在向服务端提交重试请求。"));
    try {
      await browserRequest(`/api/heavy-chat/messages/${encodeURIComponent(messageId)}/retry`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: id(`heavy-chat:retry:${messageId}`),
          correlationId: correlationId(),
        }),
      });
      await refreshSnapshot();
      setActionNotice(notice("success", "重试结果已持久化。"));
    } catch (error) {
      await refreshSnapshotSilently();
      setActionNotice(notice("danger", errorMessage(error)));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function addReference(type: HeavyReferenceType, project?: HeavyProjectContext | null) {
    setSelectedReferences((current) => [
      ...current,
      createReference(type, current.length + 1, project?.title),
    ]);
  }

  function removeReference(referenceId: string) {
    setSelectedReferences((current) => current.filter((reference) => reference.id !== referenceId));
  }

  return {
    actionNotice,
    addReference,
    busy,
    createThread,
    draft,
    projects: workspace.projects,
    refreshSnapshot,
    removeReference,
    runMessageAction,
    selectedReferences,
    sendMessage,
    setActionNotice,
    setDraft,
    slots: workspace.slots,
    threads: workspace.threads,
  };
}
