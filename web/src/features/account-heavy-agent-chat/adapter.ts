import type {
  HeavyChatAction as ContractHeavyChatAction,
  HeavyChatMessageStatus,
  HeavyChatMessageView,
  HeavyChatReference as ContractHeavyChatReference,
  HeavyChatSnapshot,
} from "@neuro/contracts";

import type {
  HeavyChatMessage,
  HeavyChatMessageAction,
  HeavyChatReference,
  HeavyChatThread,
  HeavyMessageBlock,
  HeavyMessageStatus,
  HeavyProjectContext,
  HeavySlotProfile,
  HeavyWorkspaceSnapshot,
} from "./types";

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(value);
}

function formatMessageTime(value: string, now: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  if (sameDay(date, now)) return formatTime(date);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(date, yesterday)) return `昨天 ${formatTime(date)}`;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatHistoryGroup(value: string, now: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更早";
  if (sameDay(date, now)) return "今天";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(date, yesterday)) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function referenceTone(reference: ContractHeavyChatReference): HeavyChatReference["tone"] {
  if (reference.type === "mail") return "warning";
  if (reference.type === "task") return "success";
  if (reference.type === "delivery") return "violet";
  return "cyan";
}

function adaptReference(reference: ContractHeavyChatReference): HeavyChatReference {
  return {
    id: reference.id,
    type: reference.type,
    title: reference.title,
    meta: reference.meta || "",
    tone: referenceTone(reference),
  };
}

function adaptMessageStatus(status: HeavyChatMessageStatus): HeavyMessageStatus {
  if (status === "pending" || status === "streaming") return "streaming";
  if (status === "failed") return "error";
  return "complete";
}

function actionHref(action: ContractHeavyChatAction) {
  if (action.status !== "complete" || !action.targetId) return null;
  return action.type === "task"
    ? `/my-tasks#task-${encodeURIComponent(action.targetId)}`
    : `/mailbox?messageId=${encodeURIComponent(action.targetId)}`;
}

function adaptAction(action: ContractHeavyChatAction): HeavyChatMessageAction {
  return {
    ...action,
    href: actionHref(action),
  };
}

function adaptMessageBlocks(message: HeavyChatMessageView): HeavyMessageBlock[] {
  const blocks: HeavyMessageBlock[] = [];
  if (message.content.trim()) {
    blocks.push({ id: `${message.id}:text`, type: "text", text: message.content });
  }
  if (message.references.length > 0) {
    blocks.push({
      id: `${message.id}:references`,
      type: "reference",
      references: message.references.map(adaptReference),
    });
  }
  if (message.status === "pending" || message.status === "streaming") {
    blocks.push({
      id: `${message.id}:status`,
      type: "status",
      label: message.status === "pending" ? "Pending" : "Streaming",
      description: message.content.trim() ? "服务端仍在生成回复。" : "请求已提交到服务端重度运行时。",
      tone: "warning",
    });
  }
  if (message.status === "failed") {
    blocks.push({
      id: `${message.id}:error`,
      type: "status",
      label: message.errorCode || "请求失败",
      description: message.errorMessage || "服务端未能完成这次回复。",
      tone: "danger",
    });
  }
  if (blocks.length === 0) {
    blocks.push({
      id: `${message.id}:empty`,
      type: "status",
      label: "空回复",
      description: "服务端没有返回可显示的内容。",
      tone: "danger",
    });
  }
  return blocks;
}

function adaptMessage(message: HeavyChatMessageView, now: Date): HeavyChatMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    status: adaptMessageStatus(message.status),
    createdAtLabel: formatMessageTime(message.createdAt, now),
    meta:
      message.status === "failed"
        ? message.errorCode || "服务端错误"
        : message.role === "assistant"
          ? message.status === "complete"
            ? "服务端重度运行时"
            : "服务端重度运行时 / streaming"
          : null,
    blocks: adaptMessageBlocks(message),
    actions: message.actions.map(adaptAction),
  };
}

function messagePreview(message: HeavyChatMessageView | undefined) {
  if (!message) return "新的重度智能体线程已建立。";
  if (message.content.trim()) return message.content.trim().slice(0, 80);
  if (message.errorMessage?.trim()) return message.errorMessage.trim().slice(0, 80);
  return message.status === "failed" ? "上一条回复执行失败。" : "服务端正在生成回复。";
}

export function adaptHeavyChatSnapshot(snapshot: HeavyChatSnapshot, now = new Date()): HeavyWorkspaceSnapshot {
  const projectIdsBySlot = new Map<string, string[]>();
  for (const binding of snapshot.slotProjects) {
    const projectIds = projectIdsBySlot.get(binding.slotId) ?? [];
    projectIds.push(binding.projectId);
    projectIdsBySlot.set(binding.slotId, projectIds);
  }
  const boundSlotIds = new Set(snapshot.bindings.map((binding) => binding.slotId));

  const slots: HeavySlotProfile[] = snapshot.slots.map((slot) => ({
    id: slot.id,
    title: slot.title,
    kind: slot.kind,
    personaLabel: slot.personaLabel || (slot.kind === "default" ? "默认重度对话" : "重度智能体槽位"),
    summary: slot.summary || "该槽位的持久化重度对话上下文。",
    tokenLabel: boundSlotIds.has(slot.id) ? "已连接托管智能体" : "等待绑定托管智能体",
    projectIds: projectIdsBySlot.get(slot.id) ?? [],
    occupied: boundSlotIds.has(slot.id),
  }));

  const projects: HeavyProjectContext[] = snapshot.projects.map((project) => ({
    id: project.id,
    title: project.title,
    subtitle: project.subtitle || "",
    instructions: project.instructions || "",
    knowledgeItems: [],
    fileCount: 0,
  }));

  const messagesByThread = new Map<string, HeavyChatMessageView[]>();
  for (const message of snapshot.messages) {
    const messages = messagesByThread.get(message.threadId) ?? [];
    messages.push(message);
    messagesByThread.set(message.threadId, messages);
  }

  const threads: HeavyChatThread[] = snapshot.threads.map((thread) => {
    const persistedMessages = (messagesByThread.get(thread.id) ?? []).sort(
      (left, right) => left.sequence - right.sequence,
    );
    const latestMessage = persistedMessages.at(-1);
    return {
      id: thread.id,
      slotId: thread.slotId,
      projectId: thread.projectId,
      title: thread.title,
      preview: messagePreview(latestMessage),
      favorite: thread.favorite,
      updatedAtLabel: formatMessageTime(thread.updatedAt, now),
      updatedAtGroup: formatHistoryGroup(thread.updatedAt, now),
      updatedAtSort: parseTimestamp(thread.updatedAt),
      messages: persistedMessages.map((message) => adaptMessage(message, now)),
    };
  });

  return { slots, projects, threads };
}
