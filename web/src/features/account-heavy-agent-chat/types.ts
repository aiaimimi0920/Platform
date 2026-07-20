export type HeavySlotKind = "default" | "custom" | "purchased";

export type HeavyReferenceType = "file" | "mail" | "task" | "delivery";

export type HeavyMessageRole = "assistant" | "user";

export type HeavyMessageStatus = "idle" | "streaming" | "complete" | "error";

export type HeavyHistoryFilter = "all" | "starred" | "recent";

export type HeavyInspectorTarget =
  | { type: "slot"; slotId: string }
  | { type: "project"; projectId: string }
  | { type: "thread"; threadId: string }
  | { type: "none" };

export type HeavyMessageBlock =
  | {
      id: string;
      type: "text";
      text: string;
    }
  | {
      id: string;
      type: "status";
      label: string;
      description?: string | null;
      tone: "glass" | "warning" | "cyan" | "success" | "danger" | "violet";
    }
  | {
      id: string;
      type: "reference";
      references: HeavyChatReference[];
    }
  | {
      id: string;
      type: "actionable-summary";
      title: string;
      items: string[];
    };

export type HeavyChatReference = {
  id: string;
  type: HeavyReferenceType;
  title: string;
  meta: string;
  tone: "glass" | "warning" | "cyan" | "success" | "violet";
};

export type HeavyChatMessage = {
  id: string;
  role: HeavyMessageRole;
  status: HeavyMessageStatus;
  createdAtLabel: string;
  meta?: string | null;
  blocks: HeavyMessageBlock[];
};

export type HeavyChatThread = {
  id: string;
  slotId: string;
  projectId: string | null;
  title: string;
  preview: string;
  favorite: boolean;
  updatedAtLabel: string;
  updatedAtGroup: string;
  updatedAtSort: number;
  messages: HeavyChatMessage[];
};

export type HeavyProjectKnowledgeItem = {
  id: string;
  label: string;
  type: HeavyReferenceType;
  note: string;
};

export type HeavyProjectContext = {
  id: string;
  title: string;
  subtitle: string;
  instructions: string;
  knowledgeItems: HeavyProjectKnowledgeItem[];
  fileCount: number;
};

export type HeavySlotProfile = {
  id: string;
  title: string;
  kind: HeavySlotKind;
  personaLabel: string;
  summary: string;
  tokenLabel: string;
  projectIds: string[];
  occupied: boolean;
};

export type HeavyWorkspaceSnapshot = {
  slots: HeavySlotProfile[];
  projects: HeavyProjectContext[];
  threads: HeavyChatThread[];
};

export type HeavyActionNotice = {
  id: string;
  tone: "glass" | "warning" | "cyan" | "success" | "danger";
  message: string;
};
