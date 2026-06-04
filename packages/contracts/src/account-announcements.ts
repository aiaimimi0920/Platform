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

function createLongAnnouncementTestSections(label: string): AccountAnnouncementSection[] {
  return [
    {
      title: "测试说明",
      paragraphs: [
        `这是一条用于验证公告面板固定尺寸与内部滚动表现的长公告测试数据，当前批次标记为 ${label}。内容被刻意拉长，用来确认切换公告时外层面板不会再被正文长度带着变化。`,
        "你不需要对这条测试公告执行任何真实操作。它的存在只用于观察右侧正文滚动、左侧列表滚动、标题区换行与滚动条显隐是否符合预期。",
      ],
    },
    {
      title: "模拟更新详情",
      bullets: [
        "公告正文连续放入多段说明文字，用来模拟一次跨模块的大型版本说明，而不是三五句话就结束的短提示。",
        "同一条公告会同时包含背景说明、更新清单、风险提示、回退建议与常见问题，确保正文高度稳定超过单屏可视区。",
        "正文中的句子长度也会故意拉长，以便验证中文长段落在固定宽度下换行后，滚动区域依然只发生在右侧内容窗口内部。",
        "左侧 rail 列表在公告数量增多后，应出现独立滚动条，但每个列表卡片本身仍应保持统一高度，而不是把剩余空间平均摊大。",
        "这条数据不会影响真实的账号规则，也不会改变 Linux.do 绑定、钱包、成长或邮箱的正式产品契约。",
      ],
    },
    {
      title: "验证要点",
      bullets: [
        "切换到这条公告时，外层弹层高度应保持恒定，不得因为正文更长而把整块对话面板撑高。",
        "当公告列表超过左侧可视高度时，左侧只出现列表内部滚动，不得让卡片本身为了填满容器而被拉伸得越来越高。",
        "当正文超过右侧内容区时，正文应只在 article body 内部滚动，hero 头图区域与面板外框不应抖动或变形。",
        "滚动条出现后仍应保留终端风格的边框、切角、浅亮描边与信号黄强调，不要退化成普通后台抽屉样式。",
        "鼠标滚轮、触控板与键盘分页滚动都应尽量只作用在当前悬停的内容区，而不是同时牵动页面底下的主体布局。",
      ],
    },
    {
      title: "补充背景",
      paragraphs: [
        "此前的实现里，左侧列表与右侧正文都参与了父容器剩余空间的分配。列表项数量较少时，卡片会被平均拉大；正文较长时，父容器又会试图跟着内容继续增长，这会让整个体验显得像一张没有边界的说明页，而不是稳定的终端面板。",
        "这批测试公告的目标就是把这个问题放大，让你能快速判断修复是否真实生效。只要这 6 条长公告都能在同一套固定尺寸弹层里顺畅切换、独立滚动，并且左侧卡片高度不被二次拉长，就说明这轮交互修正基本正确。",
      ],
    },
    {
      title: "回归观察建议",
      bullets: [
        "优先测试从短公告切到长公告，再从长公告切回短公告，确认外框高度始终稳定。",
        "测试左侧滚动到底部后再点开一条长公告，确认右侧正文会单独回到顶部，而左侧列表保留自己的滚动位置。",
        "测试浏览器窗口高度变小后的表现，确认左侧和右侧都仍然是各自滚动，不会重新退化为父容器整体拉伸。",
        "测试多次打开关闭公告弹层，确认滚动容器尺寸稳定，且不出现第二层包裹容器跟着内容高度忽大忽小的问题。",
      ],
    },
  ];
}

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
    id: "2026-03-21-scroll-test-a",
    eyebrow: "滚动测试",
    publishedAt: "2026-03-21T21:00:00+08:00",
    railTitle: "长公告测试一",
    summary:
      "这是一条用于验证固定尺寸弹层与右侧正文滚动行为的测试公告。内容被有意拉长，只用于观察样式与交互，不代表真实产品规则变更。",
    title: "长公告滚动测试一：固定尺寸与内部滚动验证",
    tone: "guide",
    sections: createLongAnnouncementTestSections("一"),
  },
  {
    id: "2026-03-20-scroll-test-b",
    eyebrow: "滚动测试",
    publishedAt: "2026-03-20T20:30:00+08:00",
    railTitle: "长公告测试二",
    summary:
      "这是一条第二批长正文测试公告，用于观察从一条长公告切换到另一条长公告时，右侧内容区是否保持内部滚动而不牵动整体面板高度。",
    title: "长公告滚动测试二：长内容切换稳定性验证",
    tone: "update",
    sections: createLongAnnouncementTestSections("二"),
  },
  {
    id: "2026-03-19-scroll-test-c",
    eyebrow: "滚动测试",
    publishedAt: "2026-03-19T19:30:00+08:00",
    railTitle: "长公告测试三",
    summary:
      "这是一条第三批测试公告，用于观察左侧列表数量增加后，列表卡片是否仍保持统一固定高度，而不是按容器剩余空间被动拉长。",
    title: "长公告滚动测试三：左侧固定卡片高度验证",
    tone: "priority",
    sections: createLongAnnouncementTestSections("三"),
  },
  {
    id: "2026-03-18-scroll-test-d",
    eyebrow: "滚动测试",
    publishedAt: "2026-03-18T18:30:00+08:00",
    railTitle: "长公告测试四",
    summary:
      "这是一条第四批长公告测试数据，用于确认左侧列表滚动与右侧正文滚动互不干扰，且面板外层尺寸在多次切换后依然稳定。",
    title: "长公告滚动测试四：双滚动区互不干扰验证",
    tone: "guide",
    sections: createLongAnnouncementTestSections("四"),
  },
  {
    id: "2026-03-17-scroll-test-e",
    eyebrow: "滚动测试",
    publishedAt: "2026-03-17T17:30:00+08:00",
    railTitle: "长公告测试五",
    summary:
      "这是一条第五批测试公告，用于确认在浏览器视口高度变化后，正文区仍然只在内部滚动，不会把公告弹层整体撑大或压坏左侧列表。",
    title: "长公告滚动测试五：小视口内部滚动验证",
    tone: "update",
    sections: createLongAnnouncementTestSections("五"),
  },
  {
    id: "2026-03-16-scroll-test-f",
    eyebrow: "滚动测试",
    publishedAt: "2026-03-16T16:30:00+08:00",
    railTitle: "长公告测试六",
    summary:
      "这是一条第六批测试公告，用于最终回归检查，确保短公告、长公告、长列表三种状态之间切换时，外层尺寸和卡片高度都不再发生非预期伸缩。",
    title: "长公告滚动测试六：最终回归检查",
    tone: "guide",
    sections: createLongAnnouncementTestSections("六"),
  },
  {
    id: "2026-03-15-twenty-character-title-test",
    eyebrow: "标题测试",
    publishedAt: "2026-03-15T15:30:00+08:00",
    railTitle: "二十字标题测试",
    summary:
      "这是一条专门用于观察二十字中文标题在公告头图区域中的换行表现的测试公告，主要用于查看标题宽度、断行位置和整体视觉节奏。",
    title: "测试公告甲乙丙丁哈拉威亚开开心心哈哈哈哈",
    tone: "guide",
    sections: [
      {
        title: "测试目的",
        paragraphs: [
          "这条公告只用于检查二十字中文标题在当前公告头图区域中的实际显示效果，不承载真实产品规则。",
          "你可以直接观察标题换行、字重、行距与整体压迫感是否符合预期，而不需要关注正文内容本身。",
        ],
      },
      {
        title: "观察建议",
        bullets: [
          "先看标题是否在当前宽度下自然断行为两行，而不是出现奇怪的孤字或提前折行。",
          "再看标题与左上信号黄斜切区域、右上装饰雷达纹理之间的视觉关系是否平衡。",
          "最后再切换回其他长公告，确认这条额外测试数据不会破坏已有的长公告换行表现。",
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
