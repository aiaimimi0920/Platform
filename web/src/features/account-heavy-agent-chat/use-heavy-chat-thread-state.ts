"use client";

import { startTransition, useMemo, useState } from "react";

import {
  buildAssistantReplyBlocks,
  createEmptyThread,
  createReference,
  flattenMessageText,
  nowGroup,
  nowLabel,
} from "@/features/account-heavy-agent-chat/mock-data";
import type {
  HeavyActionNotice,
  HeavyChatMessage,
  HeavyChatReference,
  HeavyChatThread,
  HeavyMessageBlock,
  HeavyProjectContext,
  HeavyReferenceType,
  HeavySlotProfile,
} from "@/features/account-heavy-agent-chat/types";

type UseHeavyChatThreadStateOptions = {
  displayName: string;
  initialThreads: HeavyChatThread[];
  projects: HeavyProjectContext[];
  slots: HeavySlotProfile[];
};

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildUserMessage(input: string, references: HeavyChatReference[]): HeavyChatMessage {
  const blocks: HeavyMessageBlock[] = [
    {
      id: id("block-text"),
      type: "text",
      text: input,
    },
  ];
  if (references.length > 0) {
    blocks.push({
      id: id("block-reference"),
      type: "reference",
      references,
    });
  }
  return {
    id: id("message-user"),
    role: "user",
    status: "complete",
    createdAtLabel: nowLabel(),
    blocks,
  };
}

function buildStreamingAssistantMessage(): HeavyChatMessage {
  return {
    id: id("message-assistant"),
    role: "assistant",
    status: "streaming",
    createdAtLabel: nowLabel(),
    meta: "服务端重度运行时 / streaming 占位",
    blocks: [
      {
        id: id("block-status"),
        type: "status",
        label: "Streaming",
        description: "正在整理上下文并生成结构化回复。",
        tone: "warning",
      },
    ],
  };
}

export function useHeavyChatThreadState({
  displayName,
  initialThreads,
  projects,
  slots,
}: UseHeavyChatThreadStateOptions) {
  const [threads, setThreads] = useState<HeavyChatThread[]>(initialThreads);
  const [draft, setDraft] = useState("");
  const [selectedReferences, setSelectedReferences] = useState<HeavyChatReference[]>([]);
  const [actionNotice, setActionNotice] = useState<HeavyActionNotice | null>(null);

  const threadMap = useMemo(() => new Map(threads.map((thread) => [thread.id, thread])), [threads]);

  function ensureThread(slotId: string, projectId: string | null) {
    const slot = slots.find((item) => item.id === slotId);
    const freshThread = createEmptyThread(slotId, projectId, slot?.title || "重度对话体");
    setThreads((current) => [freshThread, ...current]);
    return freshThread;
  }

  function createThread(slotId: string, projectId: string | null) {
    const nextThread = ensureThread(slotId, projectId);
    return nextThread;
  }

  function bindProjectToThread(threadId: string, projectId: string | null) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              projectId,
              updatedAtLabel: nowLabel(),
              updatedAtGroup: nowGroup(),
              updatedAtSort: Date.now(),
            }
          : thread,
      ),
    );
  }

  function toggleFavorite(threadId: string) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              favorite: !thread.favorite,
            }
          : thread,
      ),
    );
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

  function clearReferences() {
    setSelectedReferences([]);
  }

  function sendMessage(
    activeThreadId: string | null,
    activeSlotId: string | null,
    activeProjectId: string | null,
  ) {
    const input = draft.trim();
    if (!input || !activeSlotId) {
      return null;
    }

    const resolvedProject = projects.find((project) => project.id === activeProjectId) ?? null;
    const thread = activeThreadId ? threadMap.get(activeThreadId) : null;
    const targetThread = thread ?? ensureThread(activeSlotId, activeProjectId);
    const userMessage = buildUserMessage(input, selectedReferences);
    const assistantMessage = buildStreamingAssistantMessage();
    const nextPreview = input;
    const nextTitle =
      targetThread.messages.length === 0 && targetThread.title.startsWith("新对话")
        ? `${input.slice(0, 16)}${input.length > 16 ? "…" : ""}`
        : targetThread.title;

    setThreads((current) =>
      current.map((item) =>
        item.id === targetThread.id
          ? {
              ...item,
              projectId: activeProjectId,
              title: nextTitle,
              preview: nextPreview,
              updatedAtLabel: nowLabel(),
              updatedAtGroup: nowGroup(),
              updatedAtSort: Date.now(),
              messages: [...item.messages, userMessage, assistantMessage],
            }
          : item,
      ),
    );
    setDraft("");
    clearReferences();
    setActionNotice({
      id: id("notice"),
      tone: "cyan",
      message: "已把输入挂到当前线程，正在模拟服务端重度运行时回复。",
    });

    window.setTimeout(() => {
      const slot = slots.find((item) => item.id === activeSlotId) ?? null;
      const replyBlocks = buildAssistantReplyBlocks(input, resolvedProject);
      const firstReplyText = replyPreview(replyBlocks);
      setThreads((current) =>
        current.map((item) =>
          item.id === targetThread.id
            ? {
                ...item,
                preview: firstReplyText ?? item.preview,
                updatedAtLabel: nowLabel(),
                updatedAtGroup: nowGroup(),
                updatedAtSort: Date.now(),
                messages: item.messages.map((message) =>
                  message.id === assistantMessage.id
                    ? {
                        ...message,
                        status: "complete",
                        meta: `${slot?.title || "重度智能体"} / 结构化回复`,
                        blocks: replyBlocks,
                      }
                    : message,
                ),
              }
            : item,
        ),
      );
      setActionNotice({
        id: id("notice"),
        tone: "success",
        message: "结构化回复已生成。你可以复制、重试、转成任务或投递到邮箱。",
      });
    }, 520);

    return {
      projectId: activeProjectId,
      slotId: activeSlotId,
      threadId: targetThread.id,
    };
  }

  function runMessageAction(threadId: string, messageId: string, action: "copy" | "retry" | "task" | "mailbox" | "edit") {
    const thread = threadMap.get(threadId);
    const message = thread?.messages.find((item) => item.id === messageId);
    if (!thread || !message) {
      return;
    }

    if (action === "copy") {
      const text = flattenMessageText(message.blocks);
      navigator.clipboard?.writeText(text);
      setActionNotice({
        id: id("notice"),
        tone: "glass",
        message: "已复制当前消息内容。",
      });
      return;
    }

    if (action === "edit") {
      const text = flattenMessageText(message.blocks);
      setDraft(text);
      setActionNotice({
        id: id("notice"),
        tone: "warning",
        message: "已把当前用户消息重新放回输入框。",
      });
      return;
    }

    if (action === "task") {
      setActionNotice({
        id: id("notice"),
        tone: "success",
        message: "已生成任务草稿占位。后续接 API 时可直接发送到 Task Hub。",
      });
      return;
    }

    if (action === "mailbox") {
      setActionNotice({
        id: id("notice"),
        tone: "cyan",
        message: "已生成邮箱投递草稿占位。后续接 API 时可投影到真实邮箱与站内 mailbox。",
      });
      return;
    }

    const priorUserMessage = [...thread.messages]
      .reverse()
      .find((item) => item.role === "user");

    if (!priorUserMessage) {
      return;
    }

    const text = flattenMessageText(priorUserMessage.blocks);
    const resolvedProject = projects.find((project) => project.id === thread.projectId) ?? null;
    setThreads((current) =>
      current.map((item) =>
        item.id === threadId
          ? {
              ...item,
              updatedAtLabel: nowLabel(),
              updatedAtGroup: nowGroup(),
              updatedAtSort: Date.now(),
              messages: item.messages.map((entry) =>
                entry.id === messageId
                  ? {
                      ...entry,
                      status: "streaming",
                      meta: "重试中 / streaming 占位",
                      blocks: [
                        {
                          id: id("block-status"),
                          type: "status",
                          label: "Retry",
                          description: "正在重新整理上一条用户输入。",
                          tone: "warning",
                        },
                      ],
                    }
                  : entry,
              ),
            }
          : item,
      ),
    );
    setActionNotice({
      id: id("notice"),
      tone: "warning",
      message: "已重新触发本地重试占位。",
    });

    window.setTimeout(() => {
      const replyBlocks = buildAssistantReplyBlocks(`${text} retry`, resolvedProject);
      const nextReplyText = replyPreview(replyBlocks);
      startTransition(() => {
        setThreads((current) =>
          current.map((item) =>
            item.id === threadId
              ? {
                  ...item,
                  preview: nextReplyText ?? item.preview,
                  updatedAtLabel: nowLabel(),
                  updatedAtGroup: nowGroup(),
                  updatedAtSort: Date.now(),
                  messages: item.messages.map((entry) =>
                    entry.id === messageId
                      ? {
                          ...entry,
                          status: "complete",
                          meta: "重试完成 / 结构化回复",
                          blocks: replyBlocks,
                        }
                      : entry,
                  ),
                }
              : item,
          ),
        );
      });
    }, 460);
  }

  return {
    actionNotice,
    addReference,
    bindProjectToThread,
    clearReferences,
    createThread,
    draft,
    removeReference,
    runMessageAction,
    selectedReferences,
    sendMessage,
    setActionNotice,
    setDraft,
    threads,
    toggleFavorite,
  };
}

function replyPreview(blocks: HeavyMessageBlock[]) {
  const firstTextBlock = blocks.find(
    (block): block is Extract<HeavyMessageBlock, { type: "text" }> => block.type === "text",
  );
  return firstTextBlock?.text.slice(0, 44) ?? null;
}
