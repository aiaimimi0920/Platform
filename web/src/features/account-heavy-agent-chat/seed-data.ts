import type {
  HeavyChatMessage,
  HeavyChatReference,
  HeavyChatThread,
  HeavyMessageBlock,
  HeavyProjectContext,
  HeavyReferenceType,
  HeavySlotProfile,
} from "@/features/account-heavy-agent-chat/types";

function slug(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function textBlock(text: string): HeavyMessageBlock {
  return {
    id: slug("block-text"),
    type: "text",
    text,
  };
}

function statusBlock(
  label: string,
  description: string,
  tone: "glass" | "warning" | "cyan" | "success" | "danger" | "violet" = "glass",
): HeavyMessageBlock {
  return {
    id: slug("block-status"),
    type: "status",
    label,
    description,
    tone,
  };
}

function summaryBlock(title: string, items: string[]): HeavyMessageBlock {
  return {
    id: slug("block-summary"),
    type: "actionable-summary",
    title,
    items,
  };
}

function referenceBlock(references: HeavyChatReference[]): HeavyMessageBlock {
  return {
    id: slug("block-reference"),
    type: "reference",
    references,
  };
}

export function createReference(
  type: HeavyReferenceType,
  sequence: number,
  projectTitle?: string,
): HeavyChatReference {
  if (type === "file") {
    return {
      id: slug("ref-file"),
      type,
      title: `${projectTitle || "项目"}规范-${sequence}.md`,
      meta: "Project Knowledge / File",
      tone: "cyan",
    };
  }

  if (type === "mail") {
    return {
      id: slug("ref-mail"),
      type,
      title: `站内邮箱消息 #${sequence}`,
      meta: "Mailbox / Reward or Delivery",
      tone: "warning",
    };
  }

  if (type === "task") {
    return {
      id: slug("ref-task"),
      type,
      title: `任务单 TASK-${sequence.toString().padStart(3, "0")}`,
      meta: "任务中心 / 活跃请求",
      tone: "success",
    };
  }

  return {
    id: slug("ref-delivery"),
    type,
    title: `交付项 DEL-${sequence.toString().padStart(3, "0")}`,
    meta: "Fulfillment / Draft Artifact",
    tone: "violet",
  };
}

export function createSeedSlotProfiles(): HeavySlotProfile[] {
  return [
    {
      id: "slot-default-heavy",
      title: "觅觅",
      kind: "default",
      personaLabel: "默认重度对话",
      summary: "默认重度对话体，负责通用对话、任务整理、邮件草稿与长上下文承接。",
      tokenLabel: "固定 / 主人成长",
      projectIds: ["project-default-dialog", "project-delivery-desk", "project-product-notes"],
      occupied: true,
    },
    {
      id: "slot-custom-heavy",
      title: "自创建重度槽位",
      kind: "custom",
      personaLabel: "自定义重度运行",
      summary: "保留给用户自定义的重度智能体人格与长期上下文。",
      tokenLabel: "自建槽位 / 已启用",
      projectIds: ["project-product-notes"],
      occupied: true,
    },
    {
      id: "slot-purchased-extension",
      title: "扩展槽位",
      kind: "purchased",
      personaLabel: "购买更多容量",
      summary: "当前未购买更多重度槽位。购买后可增加更多长期重度智能体人格。",
      tokenLabel: "未购入",
      projectIds: [],
      occupied: false,
    },
  ];
}

export function createSeedProjects(): HeavyProjectContext[] {
  return [
    {
      id: "project-default-dialog",
      title: "主对话终端",
      subtitle: "默认对话上下文",
      instructions:
        "用于日常对话与任务调度。优先给出下一步动作、结构化摘要和任务化建议，不输出空泛解释。",
      knowledgeItems: [
        { id: "knowledge-dialog-1", label: "工作清单模板", type: "file", note: "将用户输入整理为工作清单和执行步骤。" },
        { id: "knowledge-dialog-2", label: "默认会话习惯", type: "delivery", note: "更偏行动摘要而不是长篇说明。" },
      ],
      fileCount: 2,
    },
    {
      id: "project-delivery-desk",
      title: "交付工作台",
      subtitle: "交付与邮件入口",
      instructions:
        "把邮件、任务和交付项统一整理成可提交、可回执、可验收的结构化工作流，优先生成发单草稿与交付摘要。",
      knowledgeItems: [
        { id: "knowledge-delivery-1", label: "邮件任务转换规范", type: "mail", note: "从邮件摘要抽取 metadata 并转成任务草稿。" },
        { id: "knowledge-delivery-2", label: "交付摘要模板", type: "delivery", note: "统一输出交付范围、缺失项和回执摘要。" },
        { id: "knowledge-delivery-3", label: "任务引用说明", type: "task", note: "优先链接任务中心中的活跃任务。" },
      ],
      fileCount: 4,
    },
    {
      id: "project-product-notes",
      title: "产品规则",
      subtitle: "重度槽位规则",
      instructions:
        "用于固定重度智能体槽位、购买规则、觅觅边界与产品说明，输出时优先保持规则精确。",
      knowledgeItems: [
        { id: "knowledge-policy-1", label: "槽位边界", type: "file", note: "默认 1 个 + 自创建 1 个 + 购买扩展。" },
        { id: "knowledge-policy-2", label: "智能模式", type: "delivery", note: "觅觅支持共创成长、主人成长和锁定三种模式。" },
      ],
      fileCount: 2,
    },
  ];
}

function seedAssistantMessage(
  createdAtLabel: string,
  meta: string,
  blocks: HeavyMessageBlock[],
): HeavyChatMessage {
  return {
    id: slug("message-assistant"),
    role: "assistant",
    status: "complete",
    createdAtLabel,
    meta,
    blocks,
  };
}

export function createSeedThreads(displayName: string): HeavyChatThread[] {
  return [
    {
      id: "thread-email-native",
      slotId: "slot-default-heavy",
      projectId: "project-delivery-desk",
      title: "邮件任务整理",
      preview: "把真实邮箱来信转成任务或执行动作，并整理交付回执。",
      favorite: true,
      updatedAtLabel: "今天 08:40",
      updatedAtGroup: "今天",
      updatedAtSort: Date.now() - 1000 * 60 * 30,
      messages: [
        {
          id: slug("message-user"),
          role: "user",
          status: "complete",
          createdAtLabel: "08:38",
          blocks: [
            textBlock("帮我把最近几封真实邮箱来信整理成可发单的工作单草稿。"),
            referenceBlock([createReference("mail", 1, "交付工作台"), createReference("task", 2, "交付工作台")]),
          ],
        },
        seedAssistantMessage("08:40", "交付工作台项目", [
          textBlock(`已收到，${displayName}。我会先按来信主题归档，再抽取任务元数据。`),
          statusBlock("邮件入口", "建议先按邮件类别整理为新任务、补充材料和待回执三组。", "cyan"),
          summaryBlock("下一步动作", [
            "抽取发件人、目标、附件与截止时间",
            "生成任务中心发单草稿",
            "同步准备邮箱回执摘要",
          ]),
        ]),
      ],
    },
    {
      id: "thread-slot-policy",
      slotId: "slot-custom-heavy",
      projectId: "project-product-notes",
      title: "重度槽位 / 产品策略",
      preview: "默认槽位、自创建槽位和购买扩展槽位的边界已经同步。",
      favorite: false,
      updatedAtLabel: "昨天 21:15",
      updatedAtGroup: "昨天",
      updatedAtSort: Date.now() - 1000 * 60 * 60 * 20,
      messages: [
        seedAssistantMessage("昨天 21:15", "自创建重度槽位", [
          textBlock("当前产品规则已经收口为：每个用户 1 个默认免费对话槽位 + 1 个自创建重度槽位，更多槽位需要购买扩展服务。"),
          statusBlock("重度槽位规则", "默认免费槽位和自创建槽位独立计数。", "warning"),
        ]),
      ],
    },
  ];
}

export function buildAssistantReplyBlocks(input: string, project?: HeavyProjectContext | null) {
  const normalized = input.trim().toLowerCase();
  const leadTitle = project?.title || "觅觅";

  if (normalized.includes("邮件") || normalized.includes("email")) {
    return [
      textBlock(`已把这条请求挂到项目「${leadTitle}」下，并按邮件工作流准备处理。`),
      statusBlock("服务端托管调度", "服务端运行时负责读取来信、抽取 metadata 并生成结构化结果。", "cyan"),
      summaryBlock("邮件任务建议", [
        "先做来信归类与主题聚合",
        "抽取任务 metadata 与附件引用",
        "生成发单草稿与回执摘要",
      ]),
    ];
  }

  if (normalized.includes("槽位") || normalized.includes("heavy") || normalized.includes("重度")) {
    return [
      textBlock("已切到重度智能体槽位策略语境。"),
      statusBlock("重度槽位账本", "每个用户默认拥有觅觅 + 1 个自创建槽位，更多槽位通过购买解锁。", "warning"),
      summaryBlock("槽位说明", [
        "觅觅固定保留",
        "自创建槽位与默认对话体分开计数",
        "扩展槽位需要购买服务",
      ]),
    ];
  }

  if (normalized.includes("任务") || normalized.includes("交付") || normalized.includes("执行")) {
    return [
      textBlock(`我已把这条输入挂到项目「${leadTitle}」下，并按任务/交付链路整理。`),
      statusBlock("Task Ready", "当前对话会按服务端重度运行时的结构化输出协议整理结果。", "success"),
      summaryBlock("建议产物", [
        "当前目标拆解",
        "缺失输入资源清单",
        "可直接发往任务中心的结构化草稿",
      ]),
    ];
  }

  return [
    textBlock(`已收到你的请求，并已切到项目「${leadTitle}」下的对话线程。`),
    statusBlock("Streaming Ready", "消息结构已经按服务端 streaming 路径准备，正在整理为可继续投递的回复。", "glass"),
    summaryBlock("下一步", [
      "继续细化任务目标",
      "必要时挂载文件 / 邮件 / 任务引用",
      "再把结果转成任务或邮箱投递草稿",
    ]),
  ];
}

export function nowLabel() {
  return "刚刚";
}

export function nowGroup() {
  return "今天";
}

export function createEmptyThread(slotId: string, projectId: string | null, slotTitle: string): HeavyChatThread {
  return {
    id: slug("thread"),
    slotId,
    projectId,
    title: `新对话 / ${slotTitle}`,
    preview: "新的重度智能体线程已建立。",
    favorite: false,
    updatedAtLabel: nowLabel(),
    updatedAtGroup: nowGroup(),
    updatedAtSort: Date.now(),
    messages: [],
  };
}

export function flattenMessageText(blocks: HeavyMessageBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      if (block.type === "status") {
        return `${block.label}${block.description ? `: ${block.description}` : ""}`;
      }
      if (block.type === "actionable-summary") {
        return `${block.title}\n${block.items.join("\n")}`;
      }
      return block.references.map((reference) => `${reference.title} (${reference.meta})`).join("\n");
    })
    .join("\n\n");
}
