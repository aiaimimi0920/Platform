export type AccountAnnouncementTone = "priority" | "update" | "guide";

export type AccountAnnouncementStatus = "draft" | "published" | "archived";

export type AccountAnnouncementSection = {
  title: string;
  bullets?: string[];
  paragraphs?: string[];
};

export type UpsertAccountAnnouncementInput = {
  title: string;
  railTitle: string;
  summary: string;
  eyebrow: string;
  publishedAt?: string | null;
  tone: AccountAnnouncementTone;
  status: AccountAnnouncementStatus;
  sections: AccountAnnouncementSection[];
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

export const bootstrapAccountAnnouncements: BootstrapAccountAnnouncement[] = [
  {
    id: "2026-03-25-account-terminal-rollout",
    eyebrow: "重要公告",
    publishedAt: "2026-03-25T10:00:00+08:00",
    railTitle: "终端入口上线",
    summary:
      "账户终端、钱包、成长、信誉、邮箱与个人域入口现已收口到同一套个人终端壳层，后续重要变更会优先通过公告同步。",
    title: "账户终端与个人域入口已正式上线",
    tone: "priority",
    sections: [
      {
        title: "本次更新",
        paragraphs: [],
        bullets: [
          "登录后首页、钱包、成长、信誉、邮箱已切换到统一的工业终端壳层。",
          "个人商品、任务、Agents 与仲裁入口已经并入同一套账户导航。",
          "重要信息默认会通过公告与站内消息双通道同步，不再散落在说明页。",
        ],
      },
      {
        title: "你需要知道",
        paragraphs: [
          "如果你看到了与旧版页面明显不同的界面，这是正常更新结果，不代表账户异常。",
          "若界面样式未刷新完整，优先强制刷新页面后再继续操作。",
        ],
      },
    ],
  },
  {
    id: "2026-03-24-linuxdo-binding-policy",
    eyebrow: "接入说明",
    publishedAt: "2026-03-24T20:00:00+08:00",
    railTitle: "授权绑定说明",
    summary:
      "当前正式身份入口仅支持 Linux.do 授权。首次授权会自动创建本地账户，并与该 Linux.do 身份建立一对一绑定。",
    title: "Linux.do 授权绑定规则说明",
    tone: "guide",
    sections: [
      {
        title: "当前规则",
        paragraphs: [],
        bullets: [
          "不提供邮箱注册、邮箱密码登录或第二套平行账号体系。",
          "首次授权完成后，将自动创建平台本地账户。",
          "后续登录默认以该绑定关系作为平台身份来源。",
        ],
      },
      {
        title: "异常处理",
        paragraphs: [
          "如果你切换了 Linux.do 账号，请不要重复绑定旧账号。优先联系平台维护者处理身份迁移。",
        ],
      },
    ],
  },
  {
    id: "2026-03-23-email-native-identity",
    eyebrow: "身份能力",
    publishedAt: "2026-03-23T21:00:00+08:00",
    railTitle: "邮箱身份锚点",
    summary:
      "真实邮箱绑定现在作为外部身份锚点与 Email-Native 调用入口使用，不会替代 Linux.do 主登录关系。",
    title: "真实邮箱身份锚点与邮件调用入口说明",
    tone: "guide",
    sections: [
      {
        title: "当前用途",
        bullets: [
          "绑定并验证真实邮箱后，该邮箱可作为 Email-Native 调用入口与回执投递地址。",
          "邮件入口可承接任务创建、Agent 执行触发、结果回执等异步工作流。",
          "邮箱身份只作为外部身份锚点，不会创建第二套登录账号体系。",
        ],
      },
      {
        title: "安全边界",
        paragraphs: [
          "平台身份仍以 Linux.do 授权绑定关系和内部 users.id 为准。若邮箱需要更换，应先在账户终端完成新的验证流程，再继续使用邮件调用能力。",
        ],
      },
    ],
  },
  {
    id: "2026-03-21-heavy-chat-terminal",
    eyebrow: "重度智能体",
    publishedAt: "2026-03-21T21:00:00+08:00",
    railTitle: "觅觅入口",
    summary:
      "/chat 已作为默认免费重度智能体觅觅的正式入口，负责长上下文对话、任务整理、邮件草稿和交付摘要。",
    title: "默认重度智能体觅觅已接入账户终端",
    tone: "guide",
    sections: [
      {
        title: "能力范围",
        bullets: [
          "觅觅会按 slot / project / thread 三层结构组织长期对话。",
          "对话可以挂载文件、邮件、任务与交付引用，便于后续转成工作项。",
          "默认免费对话体固定保留，不与用户自创建重度槽位混用。",
        ],
      },
      {
        title: "使用建议",
        paragraphs: [
          "如果你要把一段想法转成任务、邮件草稿或交付摘要，优先从 /chat 入口发起，再根据回复中的动作建议继续处理。",
        ],
      },
    ],
  },
  {
    id: "2026-03-20-task-marketplace-boundary",
    eyebrow: "任务协作",
    publishedAt: "2026-03-20T20:30:00+08:00",
    railTitle: "任务与能力集市",
    summary:
      "任务、能力集市和 Agent 执行入口已统一到同一条协作链路，发布、承接、执行、验收会逐步收口为可追踪流程。",
    title: "任务协作链路已统一到平台终端",
    tone: "update",
    sections: [
      {
        title: "协作链路",
        bullets: [
          "任务发布者可以创建明确目标、奖励和验收规则。",
          "承接者或 Agent 执行会话会围绕同一个任务上下文推进。",
          "成果物、仲裁和信誉变化会继续写入平台记录，便于后续追踪。",
        ],
      },
      {
        title: "后续同步",
        paragraphs: [
          "涉及任务状态变化、执行完成、违约处理或取消的关键通知，会通过站内邮箱和真实邮箱投递能力继续补齐。",
        ],
      },
    ],
  },
  {
    id: "2026-03-19-benefits-and-wallet",
    eyebrow: "权益与资产",
    publishedAt: "2026-03-19T19:30:00+08:00",
    railTitle: "钱包与权益",
    summary:
      "账户终端中的钱包、权益、兑换码与已购资产会作为同一套产品资产视图维护，减少用户在多个入口之间来回查找。",
    title: "钱包、权益与已购资产视图已合并",
    tone: "priority",
    sections: [
      {
        title: "统一展示",
        bullets: [
          "钱包负责展示曜石、米拉等平台货币与账本变化。",
          "权益中心负责展示可领取、可兑换或已绑定的服务权益。",
          "已购资产与问题单元会继续进入履约和补位流程。",
        ],
      },
      {
        title: "操作提醒",
        paragraphs: [
          "如果某个权益暂时不可领取，优先查看对应商品、资产或凭证状态；涉及补偿或人工复核的事项会通过站内通知继续提示。",
        ],
      },
    ],
  },
  {
    id: "2026-03-18-operator-governance",
    eyebrow: "治理说明",
    publishedAt: "2026-03-18T18:30:00+08:00",
    railTitle: "异常与仲裁",
    summary:
      "履约异常、任务争议、Agent callback 问题和网关治理事件会逐步进入统一的运营治理面。",
    title: "运营治理与仲裁入口说明",
    tone: "guide",
    sections: [
      {
        title: "治理范围",
        bullets: [
          "任务争议可进入仲裁案件，双方可补充证据并等待处理。",
          "资产履约异常会根据规则进入自动补位、人工复核或运营告警。",
          "Agent callback 与网关异常会优先进入 operator 面板，避免用户自行排查底层细节。",
        ],
      },
      {
        title: "用户动作",
        paragraphs: [
          "当你收到异常、仲裁或补偿相关消息时，按通知中的实体编号进入对应详情页处理；不要重复提交相同问题，以免影响排队和追踪。",
        ],
      },
    ],
  },
  {
    id: "2026-03-17-public-profile",
    eyebrow: "公开档案",
    publishedAt: "2026-03-17T17:30:00+08:00",
    railTitle: "个人公开页",
    summary:
      "个人公开页会用于展示用户愿意公开的项目、荣誉、Agent 与协作记录，但不会暴露钱包、邮箱、订单或凭证等私有数据。",
    title: "个人公开档案与隐私边界说明",
    tone: "update",
    sections: [
      {
        title: "公开内容",
        bullets: [
          "公开页可展示昵称、简介、项目、荣誉和用户主动公开的协作信息。",
          "owner 视图和 visitor 视图会保持相似结构，但权限边界不同。",
          "后续公开展示内容会继续按账户终端中的隐私规则收口。",
        ],
      },
      {
        title: "不会公开",
        bullets: [
          "钱包余额、真实邮箱、订单、凭证、成长细项和私有任务不会暴露给游客。",
          "涉及运营处理、仲裁证据或内部治理状态的内容不会进入游客视图。",
        ],
      },
    ],
  },
  {
    id: "2026-03-16-local-preview-policy",
    eyebrow: "开发说明",
    publishedAt: "2026-03-16T16:30:00+08:00",
    railTitle: "本地预览边界",
    summary:
      "开发和预览环境中的调试凭证、fake provider 与本地端口只用于验证 UI 与流程，不代表生产权益或正式供给。",
    title: "本地预览、调试凭证与生产边界说明",
    tone: "guide",
    sections: [
      {
        title: "如何理解",
        bullets: [
          "本地 fake gateway provider 只用于页面调试和流程连通性验证。",
          "本地预览端口、开发账号和调试凭证不会改变生产账户权益。",
          "真实模型调用、凭证库存和供给状态仍以正式 Gateway 与账户域数据为准。",
        ],
      },
      {
        title: "遇到异常时",
        paragraphs: [
          "如果预览环境出现模型目录为空、权益不可用或调试账号状态异常，优先检查本地 compose、gateway provider bootstrap 和账户域迁移状态。",
        ],
      },
    ],
  },
  {
    id: "2026-03-22-important-message-routing",
    eyebrow: "使用说明",
    publishedAt: "2026-03-22T18:00:00+08:00",
    railTitle: "公告投递说明",
    summary:
      "后续需要用户知晓的重要事项，将优先通过公告面板展示；涉及到账务、附件或履约变化的内容，会继续同步到邮箱。",
    title: "重要信息将通过公告面板持续投递",
    tone: "update",
    sections: [
      {
        title: "信息分发原则",
        paragraphs: [],
        bullets: [
          "公告用于集中展示需要你立即知道的重要更新、规则变化和风险提示。",
          "邮箱继续负责账务、附件领取、站内消息等需要逐条处理的通知。",
          "你可以随时点击右上角喇叭按钮重新打开公告面板查看历史内容。",
        ],
      },
    ],
  },
];
