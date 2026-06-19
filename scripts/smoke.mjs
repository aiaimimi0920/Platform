import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectMarkdownFiles(baseDir) {
  const files = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          "dist",
          "build",
          "target",
          ".next",
          ".runtime",
          "50-history",
        ].includes(entry.name)
      ) {
        continue;
      }
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("monorepo structure", () => {
  it("keeps core module directories", () => {
    const modulesPath = join(rootDir, "core/src/modules");
    const entries = readdirSync(modulesPath);
    const expected = [
      "agent-execution",
      "agent-registry",
      "arbitration",
      "daily-rewards",
      "development-queue",
      "identity",
      "opinion-hub",
      "product-order-item",
      "redemption-mailbox-marketplace",
      "reputation",
      "task-hub",
      "wallet-ledger",
    ];
    for (const moduleName of expected) {
      assert(entries.includes(moduleName), `${moduleName} missing from core modules`);
    }
  });

  it("exposes the contract feature list", () => {
    const contractPath = join(rootDir, "packages/contracts/src/index.ts");
    const contents = readFileSync(contractPath, "utf8");
    assert(
      contents.includes("export const featureModuleKeys"),
      "contracts index is missing featureModuleKeys definition",
    );
  });

  it("holds the key Platform docs", () => {
    const docPath = join(rootDir, "docs/10-platform/NeuroLoom平台总基线.md");
    const migrationPath = join(rootDir, "MIGRATION_NOTES.md");
    const stats = statSync(docPath);
    const migrationStats = statSync(migrationPath);
    assert(stats.isFile(), "Platform baseline doc not present");
    assert(migrationStats.isFile(), "Platform migration notes not present");
  });

  it("documents Neuro/Platform as the active Platform workspace", () => {
    const currentMainRepoPath = join(rootDir, "CURRENT_MAIN_REPO.md");
    const contents = readFileSync(currentMainRepoPath, "utf8");
    assert(
      contents.includes("C:\\Users\\Public\\nas_home\\AI\\GameEditor\\Neuro\\Platform"),
      "CURRENT_MAIN_REPO.md must point Platform work at the migrated Neuro/Platform workspace",
    );
    assert(
      !contents.includes("正式继续开发的主仓目录**重新固定为：\n\n- `C:\\Users\\Public\\nas_home\\AI\\GameEditor\\NeuroPlatform`"),
      "CURRENT_MAIN_REPO.md must not keep the pre-migration NeuroPlatform directory as the active Platform workspace",
    );
  });

  it("keeps active user-facing surfaces on current NeuroLoom branding", () => {
    const activeSurfaceFiles = [
      "deploy/env/account-worker.env.example",
      "packages/account-domain/src/modules/email-native/service.ts",
      "services/account-worker/src/env.ts",
      "services/account-worker/src/handlers.ts",
      "web/README.md",
    ];

    const staleFiles = activeSurfaceFiles.filter((surfaceFile) =>
      readFileSync(join(rootDir, surfaceFile), "utf8").includes("NeuroPlatform"),
    );

    assert.deepStrictEqual(
      staleFiles,
      [],
      "active user-facing surfaces must use current NeuroLoom branding instead of legacy NeuroPlatform",
    );
  });

  it("does not keep the web workspace under the legacy package name", () => {
    const rootPackage = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
    const webPackage = JSON.parse(readFileSync(join(rootDir, "web/package.json"), "utf8"));
    const dockerfile = readFileSync(join(rootDir, "deploy/docker/web.Dockerfile"), "utf8");

    assert.equal(webPackage.name, "@neuro/web");
    assert(!rootPackage.dependencies?.["neuroplatform-web"], "root package must not depend on the old web workspace name");
    assert(!dockerfile.includes("neuroplatform-web"), "web Dockerfile must build the current web workspace name");
  });

  it("keeps the root README on current NeuroLoom branding", () => {
    const contents = readFileSync(join(rootDir, "README.md"), "utf8");
    assert(!contents.includes("# Neuro Platform"), "root README title must use the current NeuroLoom branding");
    assert(!contents.includes("Neuro Platform is the website and public service layer for the Neuro system."));
  });

  it("does not expose placeholder wording in the heavy chat user surface", () => {
    const heavyChatFiles = [
      "web/src/features/account-opinion-center/OpinionCenterPanel.tsx",
      "web/src/features/account-heavy-agent-chat/chat-workspace.tsx",
      "web/src/features/account-heavy-agent-chat/heavy-chat-inspector.tsx",
      "web/src/features/account-heavy-agent-chat/seed-data.ts",
      "web/src/features/account-heavy-agent-chat/use-heavy-chat-thread-state.ts",
    ];

    const placeholderFiles = heavyChatFiles.filter((surfaceFile) =>
      readFileSync(join(rootDir, surfaceFile), "utf8").includes("占位"),
    );

    assert.deepStrictEqual(
      placeholderFiles,
      [],
      "active user-facing copy must describe the runtime surface without placeholder wording",
    );

    assert(
      !existsSync(join(rootDir, "web/src/features/account-heavy-agent-chat/mock-data.ts")),
      "heavy chat seed data must not keep the old mock-data module name",
    );

    const mockModuleImports = heavyChatFiles.filter((surfaceFile) =>
      readFileSync(join(rootDir, surfaceFile), "utf8").includes("mock-data"),
    );
    assert.deepStrictEqual(mockModuleImports, [], "heavy chat code must import the formal seed-data module");
  });

  it("does not leak core-client implementation wording on the arbitration surface", () => {
    const contents = readFileSync(join(rootDir, "web/src/app/arbitrations/page.tsx"), "utf8");
    const forbiddenPhrases = ["暂未接入 core-client", "在 `core-client` 暴露", "当前环境暂未开放"];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "arbitration user-facing copy must not expose core-client implementation wording",
    );
    assert(
      contents.includes("当前环境未启用仲裁操作能力"),
      "arbitration user-facing copy must describe unavailable capabilities as disabled in the current environment",
    );
  });

  it("keeps arbitration status labels localized instead of exposing raw enum copy", () => {
    const contents = readFileSync(join(rootDir, "web/src/app/arbitrations/page.tsx"), "utf8");
    const forbiddenPhrases = [
      'open: "Open"',
      'under_review: "Under Review"',
      'resolved: "Resolved"',
      'rejected: "Rejected"',
      "open / under_review / resolved / rejected",
      ">open</option>",
      ">under_review</option>",
      ">resolved</option>",
      ">rejected</option>",
      "By case status",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "arbitration surface must translate visible case statuses and filter labels",
    );
    assert(
      contents.includes("待受理") &&
        contents.includes("审理中") &&
        contents.includes("已裁决") &&
        contents.includes("已驳回") &&
        contents.includes("待受理 → 审理中 → 已裁决 / 已驳回"),
      "arbitration surface must keep localized status labels and transition copy",
    );
  });

  it("keeps arbitration operator and cleanup copy localized instead of exposing internal queue keys", () => {
    const contents = readFileSync(join(rootDir, "web/src/app/arbitrations/page.tsx"), "utf8");
    const forbiddenPhrases = [
      '<p className="mg-subtitle">Create Case</p>',
      '<p className="mg-subtitle">Rules</p>',
      '<p className="mg-subtitle">Cases</p>',
      '<p className="mg-subtitle">Resolution</p>',
      '<p className="mg-subtitle">Impact</p>',
      '<p className="mg-subtitle">Evidence</p>',
      '<p className="mg-subtitle">Assignment</p>',
      '<p className="mg-subtitle">Operator Workload</p>',
      '<p className="mg-subtitle">Operator</p>',
      '<p className="mg-subtitle">Operator Filters</p>',
      '<p className="mg-subtitle">Remote Cleanup Queue</p>',
      '<p className="mg-subtitle">Evidence Objects</p>',
      '<p className="mg-subtitle">Attachment Repository</p>',
      '<h4 className="app-card-title">Review Rounds</h4>',
      '<span className="app-detail-list__label">Claimed</span>',
      '<span className="app-detail-list__label">Open rounds</span>',
      '<span className="app-detail-list__label">Pending / due now</span>',
      '<span className="app-detail-list__label">Cleanup requested</span>',
      '<span className="app-detail-list__label">Failed cleanup / max attempts</span>',
      '<span className="app-detail-list__label">Oldest retention expiry</span>',
      "Stale claims",
      "Stale rounds",
      "stale {bucket.staleClaimCount}",
      "stale claim",
      "round stale",
      "base-url",
      "no-base-url",
      "upload-url",
      "no-upload-url",
      "auth-ready",
      "no-auth",
      "cleanup_requested",
      "retained",
      "h overdue",
      "avgClaimAgeHours}h",
      "retention {toLocaleDateTime",
      "cleanup request",
      "prepared {toLocaleDateTime",
      "completed {toLocaleDateTime",
      "选择 operator",
      "claimed {bucket.claimedCount}",
      '<p className="mg-subtitle">{arbitrationCase.entityType}</p>',
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "arbitration operator and cleanup surface must not expose raw English labels or remote cleanup keys",
    );
    assert(
      contents.includes("发起案件") &&
        contents.includes("案件规则") &&
        contents.includes("清理队列") &&
        contents.includes("待清理 / 当前到期") &&
        contents.includes("已请求清理") &&
        contents.includes("清理失败 / 最大尝试") &&
        contents.includes("最早保留到期") &&
        contents.includes("已请求清理") &&
        contents.includes("继续保留") &&
        contents.includes("超期"),
      "arbitration operator and cleanup surface must keep localized labels for workflow and cleanup states",
    );
  });

  it("keeps heavy-agent creation copy pointed at the dedicated heavy-agent entry", () => {
    const heavyEntryFiles = [
      "web/src/app/my-agents/page.tsx",
      "web/src/app/ops/account/agents/page.tsx",
    ];

    const staleFiles = heavyEntryFiles.filter((surfaceFile) => {
      const contents = readFileSync(join(rootDir, surfaceFile), "utf8");
      return (
        contents.includes("平台重 Agent（暂未开放）") ||
        !contents.includes("重度智能体入口")
      );
    });

    assert.deepStrictEqual(
      staleFiles,
      [],
      "heavy-agent creation copy must route users to the dedicated heavy-agent entry instead of saying the capability is unopened",
    );
  });

  it("keeps project sponsorship copy on precise project-level wording", () => {
    const sponsorPanelPath = "web/src/features/account-project-center/components/ProjectSponsorPanel.tsx";
    const sponsorPanelContents = readFileSync(join(rootDir, sponsorPanelPath), "utf8");
    assert(
      !sponsorPanelContents.includes("暂未开放"),
      "project sponsor panel must not describe a closed project sponsor state as unopened",
    );
    assert(
      sponsorPanelContents.includes("暂不接收赞助"),
      "project sponsor panel must describe a closed sponsor state as not accepting sponsorship",
    );

    const sponsorSeedFiles = [
      "packages/account-domain/migrations/20260402_01_honor_project_detail_fields.sql",
      "packages/account-domain/src/modules/honor-projects/service.ts",
      "web/src/features/account-project-center/model.ts",
      "web/src/features/account-project-center/server.ts",
      "web/src/features/account-honor/server.ts",
    ];

    const staleSponsorFiles = sponsorSeedFiles.filter((surfaceFile) =>
      /sponsor(?:StatusLabel|_status_label)\s*[:=]\s*["']暂未开放["']/.test(
        readFileSync(join(rootDir, surfaceFile), "utf8"),
      ),
    );

    assert.deepStrictEqual(
      staleSponsorFiles,
      [],
      "project sponsorship seed/fallback data must describe closed sponsorship as not accepting sponsorship",
    );
  });

  it("keeps project showcase seed copy out of private-beta wording", () => {
    const projectSeedFiles = [
      "packages/account-domain/migrations/20260402_01_honor_project_detail_fields.sql",
      "packages/account-domain/src/modules/honor-projects/service.ts",
      "web/src/features/account-project-center/model.ts",
      "web/src/features/account-honor/server.ts",
    ];

    const staleMatches = [];
    for (const surfaceFile of projectSeedFiles) {
      const contents = readFileSync(join(rootDir, surfaceFile), "utf8");
      for (const phrase of ["协作封测", "进入封测", "正在封测", "临时锁机制"]) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${surfaceFile}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "project showcase seed/fallback data must use production-facing validation wording",
    );
    assert(
      readFileSync(join(rootDir, "web/src/features/account-project-center/model.ts"), "utf8").includes(
        "同步冲突回放与协作锁机制正在小范围验证。",
      ),
      "project center fallback milestones must describe collaborative locking without temporary/private-beta wording",
    );
  });

  it("keeps benefit-center empty states on inventory wording instead of unopened-panel wording", () => {
    const benefitPath = "web/src/features/account-benefit-center/owner/benefit-center-container.tsx";
    const contents = readFileSync(join(rootDir, benefitPath), "utf8");

    assert(
      !contents.includes("暂未开放用户领取台"),
      "benefit center empty-state copy must not describe a category as an unopened receiving desk",
    );
    assert(
      contents.includes("当前分类暂无可领取权益"),
      "benefit center empty-state copy must explain that the selected category currently has no claimable benefits",
    );
  });

  it("keeps the task-market feature gate on environment wording", () => {
    const taskMarketPath = "web/src/features/account-task-market/task-market-page.tsx";
    const contents = readFileSync(join(rootDir, taskMarketPath), "utf8");

    assert(
      !contents.includes("集市暂未开放"),
      "task-market feature gate copy must not use the older unopened wording",
    );
    assert(
      contents.includes("任务集市当前未开放"),
      "task-market feature gate copy must explain that the current environment has not opened the task market",
    );
  });

  it("keeps Tea configuration copy user-facing instead of exposing raw implementation states", () => {
    const teaPagePath = "web/src/app/tea/page.tsx";
    const contents = readFileSync(join(rootDir, teaPagePath), "utf8");
    const forbiddenPhrases = [
      "临时使用本地 fallback 配置",
      "template/manual provider",
      "{configSource(teaStatus)}",
      "{brainProviderMode(teaStatus)}",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "Tea page must translate raw configuration/provider states into user-facing copy",
    );
    assert(
      contents.includes("继续使用本地配置保持可用"),
      "Tea fallback copy must explain local continuity instead of raw fallback implementation state",
    );
  });

  it("keeps mission empty states concrete instead of generic teaser wording", () => {
    const missionConstantsPath = "web/src/features/account-mission-center/constants.ts";
    const contents = readFileSync(join(rootDir, missionConstantsPath), "utf8");

    assert(
      !contents.includes("敬请期待"),
      "mission empty states must not use generic teaser wording",
    );
    assert(
      contents.includes("当前暂无可领取永久任务"),
      "permanent mission empty state must clearly say there is no claimable permanent mission",
    );
  });

  it("keeps wallet exchange copy free of internal route-code wording", () => {
    const walletPath = "web/src/app/wallet/page.tsx";
    const contents = readFileSync(join(rootDir, walletPath), "utf8");

    assert(
      !contents.includes("内部 route code"),
      "wallet exchange copy must not expose internal route-code compatibility wording",
    );
    assert(
      contents.includes("当前支持单向耀晶兑换米拉"),
      "wallet exchange copy must explain the currently supported exchange direction",
    );
  });

  it("keeps account utility page section kickers localized", () => {
    const pageExpectations = [
      {
        file: "web/src/app/growth/page.tsx",
        forbidden: [
          'kicker="Growth Terminal"',
          'kicker="Next Level"',
          'kicker="Level"',
          'kicker="Benefits"',
          'kicker="Current"',
          'kicker="Next"',
          'kicker="Access"',
          'kicker="Sources"',
          'kicker="Rules"',
          'kicker="Summary"',
        ],
        required: [
          'kicker="成长终端"',
          'kicker="下一等级"',
          'kicker="等级"',
          'kicker="权益"',
          'kicker="当前"',
          'kicker="后续"',
          'kicker="准入"',
          'kicker="来源"',
          'kicker="规则"',
          'kicker="摘要"',
        ],
      },
      {
        file: "web/src/app/inventory/page.tsx",
        forbidden: [
          'kicker="Inventory Terminal"',
          'kicker="Asset Mix"',
          'kicker="Owned Items"',
          'kicker="Order History"',
          'kicker="Summary"',
          'kicker="Quick Actions"',
          'kicker="Scope"',
        ],
        required: [
          'kicker="资产终端"',
          'kicker="资产结构"',
          'kicker="持有资产"',
          'kicker="订单历史"',
          'kicker="摘要"',
          'kicker="快捷动作"',
          'kicker="范围"',
        ],
      },
      {
        file: "web/src/app/my-tasks/page.tsx",
        forbidden: [
          'kicker="Task Terminal"',
          'kicker="Status"',
          'kicker="Created"',
          'kicker="Assigned"',
          'kicker="Quick Publish"',
          'kicker="Summary"',
          'kicker="Scope"',
        ],
        required: [
          'kicker="任务终端"',
          'kicker="状态"',
          'kicker="我发布"',
          'kicker="我承接"',
          'kicker="快速发布"',
          'kicker="摘要"',
          'kicker="范围"',
        ],
      },
      {
        file: "web/src/app/reputation/page.tsx",
        forbidden: [
          'kicker="Reputation Terminal"',
          'kicker="History"',
          'kicker="Snapshot"',
          'kicker="Explain"',
          'kicker="Inputs"',
          'kicker="Factors"',
          'kicker="Scope"',
        ],
        required: [
          'kicker="信誉终端"',
          'kicker="历史"',
          'kicker="快照"',
          'kicker="拆解"',
          'kicker="输入"',
          'kicker="因素"',
          'kicker="范围"',
        ],
      },
      {
        file: "web/src/app/wallet/page.tsx",
        forbidden: [
          'kicker="Wallet Terminal"',
          'kicker="Ledger"',
          'kicker="Balances"',
          'kicker="Asset Roles"',
          'kicker="Exchange"',
          'kicker="Recent Ledger"',
          'kicker="Value Ingress"',
          'kicker="Rules"',
          'kicker="Snapshot"',
        ],
        required: [
          'kicker="钱包终端"',
          'kicker="账本"',
          'kicker="余额"',
          'kicker="资产角色"',
          'kicker="兑换"',
          'kicker="近期账本"',
          'kicker="价值入口"',
          'kicker="规则"',
          'kicker="快照"',
        ],
      },
      {
        file: "web/src/app/tea/[ticketId]/page.tsx",
        forbidden: [
          'kicker="Ticket"',
          'kicker="Review"',
          'kicker="Evidence"',
          'kicker="Audit"',
          'kicker="Reject"',
          'kicker="Export"',
          'kicker="Access"',
        ],
        required: [
          'kicker="工单"',
          'kicker="审阅"',
          'kicker="证据"',
          'kicker="审计"',
          'kicker="驳回"',
          'kicker="导出"',
          'kicker="访问"',
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "account utility pages must not expose English section kickers on active user-facing pages",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "account utility pages must keep localized section kicker replacements",
    );
  });

  it("keeps remaining account surface section kickers localized", () => {
    const pageExpectations = [
      {
        file: "web/src/app/dashboard/page.tsx",
        forbidden: [
          'kicker="Account Terminal"',
          'kicker="Session"',
          'kicker="Launch Board"',
          'kicker="Account Snapshot"',
        ],
        required: [
          'kicker="账户终端"',
          'kicker="身份"',
          'kicker="快捷入口"',
          'kicker="账户摘要"',
        ],
      },
      {
        file: "web/src/app/my-agents/page.tsx",
        forbidden: ['kicker="Agent Terminal"', 'kicker="Runtime"'],
        required: ['kicker="智能体终端"', 'kicker="运行"'],
      },
      {
        file: "web/src/features/account-email-access/page.tsx",
        forbidden: [
          'kicker="Email-Native"',
          'kicker="Routes"',
          'kicker="Bind"',
          'kicker="Step 1"',
          'kicker="Step 2"',
          'kicker="Identities"',
          'kicker="Recent Ingress"',
          'kicker="Pending"',
          'kicker="Route Catalog"',
          'kicker="Metadata"',
        ],
        required: [
          'kicker="邮件入口"',
          'kicker="入口模式"',
          'kicker="邮箱绑定"',
          'kicker="步骤一"',
          'kicker="步骤二"',
          'kicker="邮箱身份"',
          'kicker="最近入口"',
          'kicker="待验证"',
          'kicker="入口规则"',
          'kicker="头字段"',
        ],
      },
      {
        file: "web/src/features/account-heavy-agent-chat/heavy-chat-inspector.tsx",
        forbidden: [
          'kicker="Slot"',
          'kicker="Runtime"',
          'kicker="Project"',
          'kicker="Knowledge"',
          'kicker="Thread"',
          'kicker="Linked Context"',
        ],
        required: [
          'kicker="槽位"',
          'kicker="运行"',
          'kicker="项目"',
          'kicker="知识"',
          'kicker="会话"',
          'kicker="关联上下文"',
        ],
      },
      {
        file: "web/src/features/account-honor/account-honor-panel.tsx",
        forbidden: ['kicker="Honor Archive"', 'kicker="Profile Signal"'],
        required: ['kicker="荣誉档案"', 'kicker="身份信标"'],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "remaining account surfaces must not expose English section kickers on active user-facing pages",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "remaining account surfaces must keep localized section kicker replacements",
    );
  });

  it("keeps account product copy free of internal status and raw email route keys", () => {
    const pageExpectations = [
      {
        file: "web/src/app/dashboard/page.tsx",
        forbidden: [
          "Email-Native",
          "CORE DEGRADED",
          "CORE ONLINE",
          "OPS READY",
          "USER MODE",
          "CLAIM WAITING",
          "Core degraded",
          "Core online",
          'title="Trust Level"',
        ],
        required: [
          "配置真实邮箱身份与邮件入口。",
          "服务降级",
          "服务在线",
          "运维就绪",
          "用户模式",
          "待领取",
          'title="信任等级"',
        ],
      },
      {
        file: "web/src/app/growth/page.tsx",
        forbidden: [
          "source=${source.key}",
          "/v1/me.snapshot.progression",
          'title="暴露位置"',
          'title="数据模型"',
        ],
        required: [
          "计数 ${formatAccountNumber(source.metricValue)} · 已计入成长经验",
          "账户成长快照",
          'title="展示位置"',
          'title="口径说明"',
        ],
      },
      {
        file: "web/src/features/account-heavy-agent-chat/heavy-chat-inspector.tsx",
        forbidden: ["后续接 API 时", "真实 token"],
        required: ["用量与引用信息会随会话持续更新"],
      },
      {
        file: "web/src/features/account-email-access/page.tsx",
        forbidden: [
          "Email-Native",
          "panel.deliveryMode.toUpperCase()",
          "{instruction.routeKind}",
          "{message.status}",
          "`路由 ${message.routeKind}`",
          "taskDefaults.pricingMode",
          "taskDefaults.operationMode",
          'label="Agent"',
          'label="Task"',
          'label="Ingress"',
          'label="Delivery"',
        ],
        required: [
          "formatEmailDeliveryMode",
          "formatEmailRouteKind",
          "formatEmailInboundStatus",
          "formatEmailPricingMode",
          "formatEmailOperationMode",
          "邮件调用入口",
          'label="智能体字段"',
          'label="任务字段"',
          'label="入口域名"',
          'label="投递模式"',
        ],
      },
      {
        file: "web/src/features/account-email-access/actions.ts",
        forbidden: ["Email-Native 调用入口已启用"],
        required: ["邮件调用入口已启用"],
      },
      {
        file: "web/src/app/wallet/page.tsx",
        forbidden: [
          "Email-Native 回执",
          "Agent 执行",
          "人工 grant",
          "credential assignment",
          "asset.category.toUpperCase()",
          'label="钱包 owner"',
          'value="account-api"',
          'value="account-domain"',
          'value="wallet panel"',
        ],
        required: [
          "邮件入口回执",
          "智能体执行",
          "人工发放",
          "凭证分配",
          "formatAssetCategoryLabel",
          'label="钱包归属"',
          'value="账户钱包服务"',
          'value="账户账本"',
          'value="钱包面板"',
        ],
      },
      {
        file: "web/src/app/reputation/page.tsx",
        forbidden: ['title="Trust Level"', 'label="Trust Level"'],
        required: ['title="信任等级"', 'label="信任等级"'],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "account product surfaces must not expose internal status strings, future API wiring copy, or raw email route keys",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "account product surfaces must keep productized replacements for internal status and route key copy",
    );
  });

  it("keeps active account fallback copy free of core implementation wording", () => {
    const fallbackFiles = [
      "web/src/app/arbitrations/page.tsx",
      "web/src/app/growth/page.tsx",
      "web/src/app/inventory/page.tsx",
      "web/src/app/my-tasks/page.tsx",
      "web/src/app/redeem/page.tsx",
      "web/src/app/reputation/page.tsx",
      "web/src/app/wallet/page.tsx",
    ];

    const staleFiles = [];
    const missingFiles = [];
    for (const fallbackFile of fallbackFiles) {
      const contents = readFileSync(join(rootDir, fallbackFile), "utf8");
      if (contents.includes("当前无法从 core 读取模块快照")) {
        staleFiles.push(fallbackFile);
      }
      if (!contents.includes("当前无法读取模块状态")) {
        missingFiles.push(fallbackFile);
      }
    }

    assert.deepStrictEqual(
      staleFiles,
      [],
      "active account fallback copy must not expose core implementation wording",
    );
    assert.deepStrictEqual(
      missingFiles,
      [],
      "active account fallback copy must keep user-facing module status wording",
    );
  });

  it("keeps account overview sections framed as user capabilities instead of implementation boundaries", () => {
    const overviewFiles = [
      "web/src/app/my-agents/page.tsx",
      "web/src/app/my-tasks/page.tsx",
      "web/src/app/reputation/page.tsx",
    ];

    const staleFiles = overviewFiles.filter((surfaceFile) =>
      readFileSync(join(rootDir, surfaceFile), "utf8").includes("实现边界"),
    );

    assert.deepStrictEqual(
      staleFiles,
      [],
      "account overview pages must describe capability scope instead of implementation boundaries",
    );
  });

  it("keeps Tea pages framed as product review flows instead of API boundary diagnostics", () => {
    const teaFiles = [
      "web/src/app/tea/page.tsx",
      "web/src/app/tea/[ticketId]/page.tsx",
    ];
    const forbiddenPatterns = [
      /接口边界/,
      /Core 内部代理读取/,
      /Runs API/,
      /Ticket unavailable/,
      /Core\/Tea daemon/,
      /\|\|\s*"unknown"/,
    ];

    const staleMatches = [];
    for (const surfaceFile of teaFiles) {
      const contents = readFileSync(join(rootDir, surfaceFile), "utf8");
      for (const forbiddenPattern of forbiddenPatterns) {
        if (forbiddenPattern.test(contents)) {
          staleMatches.push(`${surfaceFile}: ${forbiddenPattern.source}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "Tea user-facing pages must not expose API-boundary diagnostics or raw unknown fallbacks",
    );
    assert(
      readFileSync(join(rootDir, "web/src/app/tea/page.tsx"), "utf8").includes("访问说明"),
      "Tea queue page must keep a user-facing access explanation section",
    );
    assert(
      readFileSync(join(rootDir, "web/src/app/tea/[ticketId]/page.tsx"), "utf8").includes("查看执行记录"),
      "Tea detail page must label run history as a user-facing execution record",
    );
  });

  it("keeps inventory scope copy free of route and owner implementation labels", () => {
    const inventoryPath = "web/src/app/inventory/page.tsx";
    const contents = readFileSync(join(rootDir, inventoryPath), "utf8");
    const forbiddenPhrases = [
      "当前 owner 边界",
      "/v1/items + /v1/orders",
      "读取接口",
      "platform owner",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "inventory page must describe account asset scope instead of route/owner implementation labels",
    );
    assert(
      contents.includes("账户资产范围"),
      "inventory page must keep an account asset scope section",
    );
  });

  it("keeps agent-center local development option copy out of test/mock wording", () => {
    const agentCenterPath = "web/src/features/account-agent-center/agent-center-page.tsx";
    const contents = readFileSync(join(rootDir, agentCenterPath), "utf8");
    const forbiddenPhrases = [
      "测试环境调试凭证",
      "本地保底 / 不校验购买状态",
      "Web 调试专用",
      "我方测试调用",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "agent center user-facing copy must describe local development fallbacks without test/mock wording",
    );
    assert(
      contents.includes("本地开发保底服务"),
      "agent center local development option must have a formal local-development label",
    );
  });

  it("keeps agent-center visible shell labels localized and user-facing", () => {
    const pageExpectations = [
      {
        file: "web/src/features/account-agent-center/agent-center-page.tsx",
        forbidden: [
          "Agent Center",
          "Agent 模块已关闭",
          "Runtime 鉴权",
          "多 Agent 批次调用",
          "轻量 Agent 流程",
          "当前无法从 core 读取 Agent 模块快照",
          "{agent.enabled ? \"enabled\" : \"disabled\"}",
        ],
        required: [
          "智能体中心",
          "智能体模块已关闭",
          "运行鉴权",
          "多智能体批次调用",
          "轻量智能体流程",
          "当前无法读取智能体模块状态",
          "{agent.enabled ? \"已启用\" : \"已停用\"}",
        ],
      },
      {
        file: "web/src/features/account-agent-center/managed-cloud-role-section.tsx",
        forbidden: ["API Key"],
        required: ["访问密钥"],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "agent-center visible shell labels must not expose raw English product or auth labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "agent-center visible shell labels must keep localized replacements",
    );
  });

  it("keeps marketplace billing unit defaults user-facing instead of raw unit keys", () => {
    const pageExpectations = [
      {
        file: "web/src/features/account-task-market/task-market-page.tsx",
        forbidden: [
          'return `按 token / ${task.billingUnit || "1k_tokens"}`',
          'return `按属性 / ${task.meterKey || task.billingUnit || "task_units"}`',
          'return `按 token / ${listing.billingUnit || "1k_tokens"}`',
          'return `按属性 / ${listing.meterKey || listing.billingUnit || "task_units"}`',
          'return `按任务 / ${listing.billingUnit || "task"}`',
        ],
        required: [
          "formatBillingUnitLabel",
          "formatMeterKeyLabel",
        ],
      },
      {
        file: "web/src/features/account-agent-center/agent-center-page.tsx",
        forbidden: [
          'return `按任务 / ${listing.billingUnit || "task"}`',
          'listing.billingUnit || "task"',
          'entry.task.meterKey || "task_units"',
          'entry.task.billingUnit || "task_property"',
          'entry.task.billingUnit || "1k_tokens"',
        ],
        required: [
          "formatBillingUnitLabel",
          "formatMeterKeyLabel",
          "formatTaskPricingUnitLabel",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "marketplace and agent-center billing labels must not expose raw default unit keys in visible copy",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "marketplace and agent-center billing labels must keep user-facing unit formatters",
    );
  });

  it("keeps public profile and managed-light billing copy user-facing", () => {
    const pageExpectations = [
      {
        file: "web/src/features/public-profile/public-profile-page.tsx",
        forbidden: [
          "公开 Agent 面板",
          "Agent 供给摘要",
          'return `按 token / ${listing.billingUnit || "1k_tokens"}`',
          'return `按属性 / ${listing.meterKey || listing.billingUnit || "task_units"}`',
          'return `按任务 / ${listing.billingUnit || "task"}`',
        ],
        required: [
          "公开智能体面板",
          "智能体供给摘要",
          "formatBillingUnitLabel",
          "formatMeterKeyLabel",
        ],
      },
      {
        file: "web/src/features/account-agent-center/managed-light-role-section.tsx",
        forbidden: [
          'return `按 token / ${listing.billingUnit || "1k_tokens"}`',
          'return `按属性 / ${listing.meterKey || listing.billingUnit || "task_units"}`',
          'return `按任务 / ${listing.billingUnit || "task"}`',
          "按 token 计费",
          "创建羽量 Agent",
        ],
        required: [
          "formatBillingUnitLabel",
          "formatMeterKeyLabel",
          "按 Token 计费",
          "创建羽量智能体",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "public profile and managed-light billing copy must not expose raw billing unit keys or generic Agent wording",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "public profile and managed-light billing copy must keep user-facing labels and unit formatters",
    );
  });

  it("keeps task proposal and supplier execution labels localized", () => {
    const pageExpectations = [
      {
        file: "web/src/features/account-task-market/task-market-page.tsx",
        forbidden: [
          "{proposal.status}",
          "Agent {proposal.agentId}",
        ],
        required: [
          "formatProposalStatusLabel",
          "智能体 {proposal.agentId}",
        ],
      },
      {
        file: "web/src/features/account-agent-center/agent-center-page.tsx",
        forbidden: [
          "{proposal.status}",
          "{execution.status}",
          "{execution.marketplaceInvocation.billingMode}",
          "自动 proposal",
        ],
        required: [
          "formatProposalStatusLabel",
          "formatExecutionStatusLabel",
          "formatBillingModeLabel(execution.marketplaceInvocation)",
          "自动提案",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "task proposal and supplier execution labels must not expose raw status or billing mode keys",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "task proposal and supplier execution labels must keep localized formatter calls",
    );
  });

  it("keeps dashboard agent summary labels localized", () => {
    const dashboardPath = "web/src/app/dashboard/page.tsx";
    const contents = readFileSync(join(rootDir, dashboardPath), "utf8");
    const forbiddenPhrases = [
      'title: "我的 Agents"',
      'label: "启用 Agent"',
      'label: "总 Agent"',
      'label="Agent 能力"',
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "dashboard agent summary labels must use localized smart-agent wording",
    );
    assert(
      contents.includes('title: "我的智能体"') &&
        contents.includes('label: "启用智能体"') &&
        contents.includes('label: "总智能体"') &&
        contents.includes('label="智能体能力"'),
      "dashboard must keep localized smart-agent replacements",
    );
  });

  it("keeps heavy-chat draft action notices free of unfinished API wiring wording", () => {
    const heavyChatStatePath = "web/src/features/account-heavy-agent-chat/use-heavy-chat-thread-state.ts";
    const contents = readFileSync(join(rootDir, heavyChatStatePath), "utf8");

    assert(
      !contents.includes("接入 API 后"),
      "heavy chat draft action notices must not imply unfinished API wiring",
    );
    assert(
      contents.includes("可从任务面板继续完善与发布"),
      "heavy chat task draft notice must route users to the task panel flow",
    );
  });

  it("keeps Tea entry hero copy free of internal route and daemon-token wording", () => {
    const teaPagePath = "web/src/app/tea/page.tsx";
    const contents = readFileSync(join(rootDir, teaPagePath), "utf8");
    const forbiddenPhrases = [
      "/internal/tea/*",
      "Tea daemon token",
      "代理调用 Tea daemon",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "Tea entry hero copy must not expose internal route paths or daemon-token implementation details",
    );
    assert(
      contents.includes("后台凭证不会暴露给浏览器"),
      "Tea entry hero copy must preserve the browser credential-safety guarantee",
    );
  });

  it("keeps Tea queue page labels localized and free of raw provider/status fallback wording", () => {
    const teaPagePath = "web/src/app/tea/page.tsx";
    const contents = readFileSync(join(rootDir, teaPagePath), "utf8");
    const forbiddenPhrases = [
      "Tea Work Order Desk",
      "Core/Tea unavailable",
      'kicker="Queue"',
      'kicker="Configuration"',
      'kicker="BrainProvider"',
      'kicker="Create"',
      'kicker="Status"',
      'kicker="Access"',
      '"unknown"',
      'ticket.source || "human"',
      "tea.ticket.decompose.v1}</span>",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "Tea queue page must localize visible section labels, fallback states, ticket sources, and provider capability copy",
    );
    assert(
      contents.includes("Tea 工单台") &&
        contents.includes("工单服务暂不可用") &&
        contents.includes("手动提交") &&
        contents.includes("工单拆解能力") &&
        contents.includes("未声明"),
      "Tea queue page must keep localized replacements for queue labels and missing values",
    );
  });

  it("keeps my-agents policy catalog copy localized and user-facing", () => {
    const myAgentsPath = "web/src/app/my-agents/page.tsx";
    const contents = readFileSync(join(rootDir, myAgentsPath), "utf8");
    const forbiddenPhrases = [
      "Policy Catalog",
      "callback remediation policy catalog",
      "fallback on",
      "fallback off",
      "backoff",
      "remediation policy catalog",
      "不再依赖写死的本地下拉枚举",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "my-agents policy catalog copy must be localized and must not expose implementation labels",
    );
    assert(
      contents.includes("回调补救策略"),
      "my-agents policy section must keep a user-facing callback remediation title",
    );
  });

  it("keeps my-agents personal surface free of raw callback/runtime labels", () => {
    const myAgentsPath = "web/src/app/my-agents/page.tsx";
    const contents = readFileSync(join(rootDir, myAgentsPath), "utf8");
    const forbiddenPhrases = [
      "My View",
      "Owned Agents",
      "Policy Recommendation",
      "callbacks /",
      " rejected",
      "暂无 callback 统计",
      "无 runtime endpoint",
      "Replay 兼容策略",
      "Fallback 失败画像",
      "Agent 已停用",
      "Agent 模块已关闭",
      "个人 Agent 视图",
      "当前无法从 core 读取模块快照",
      "我的 Agents",
      "总 Agents",
      "我的 Agent 列表",
      "已拥有 Agent",
      "创建 Agent 后",
      "Agent 名称",
      "平台轻量 Agent",
      "平台重 Agent",
      ">API Key</option>",
      "托管 API 地址",
      "托管 API Key",
      "完整 Agent 管理台",
      "仅展示当前账户拥有的 Agent",
      "capability code",
      "Capability 标题",
      "Capability 描述",
      "追加 Capability",
      "Quick Create",
      'kicker="Capabilities"',
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "my-agents personal page must localize callback, runtime, and capability labels",
    );
    assert(
        contents.includes("策略建议") &&
        contents.includes("回调统计") &&
        contents.includes("运行地址") &&
        contents.includes("智能体已停用") &&
        contents.includes("智能体模块已关闭") &&
        contents.includes("个人智能体视图") &&
        contents.includes("当前无法读取模块状态") &&
        contents.includes("我的智能体") &&
        contents.includes("智能体名称") &&
        contents.includes("平台轻量智能体") &&
        contents.includes("平台重型智能体") &&
        contents.includes("访问密钥") &&
        contents.includes("托管访问地址") &&
        contents.includes("托管访问密钥") &&
        contents.includes("能力编码") &&
        contents.includes("追加能力"),
      "my-agents personal page must keep localized replacements for callback, runtime, and capability labels",
    );
  });

  it("keeps task-market server warnings free of raw Agent proposal wording", () => {
    const taskMarketServerPath = "web/src/features/account-task-market/server.ts";
    const contents = readFileSync(join(rootDir, taskMarketServerPath), "utf8");

    assert(
      !contents.includes("Agent proposal 数据暂不可用"),
      "task-market warning copy must not expose raw Agent proposal wording",
    );
    assert(
      contents.includes("智能体提案数据暂不可用"),
      "task-market warning copy must keep a localized smart-agent proposal warning",
    );
  });

  it("keeps honor, project, email, growth, and wallet seed copy on smart-agent wording", () => {
    const expectations = [
      {
        file: "web/src/features/account-honor/account-honor-panel.tsx",
        forbidden: ["Agent 分项", "尚未选择展示 Agent。", "暂无可展示的 Agent。"],
        required: ["智能体分项", "尚未选择展示智能体。", "暂无可展示的智能体。"],
      },
      {
        file: "web/src/features/account-honor/shared/agent-display.tsx",
        forbidden: ["Agent 分项", "暂无可展示的 Agent。"],
        required: ["智能体分项", "暂无可展示的智能体。"],
      },
      {
        file: "web/src/features/account-honor/owner/agent-showcase-config.tsx",
        forbidden: [
          "展示 Agent 保存失败",
          "关闭 Agent 展示配置",
          "Agent 展示配置",
          "展示 Agent",
          "最多展示 4 个 Agent",
        ],
        required: [
          "展示智能体保存失败",
          "关闭智能体展示配置",
          "智能体展示配置",
          "展示智能体",
          "最多展示 4 个智能体",
        ],
      },
      {
        file: "web/src/features/account-honor/server.ts",
        forbidden: [
          "Agent 建设",
          "Agent 训练仪表盘",
          "Agent 协作时间线",
          "多 Agent 任务",
          "登记 Agent",
          "Agent 更新",
          'shortLabel: "Agent"',
        ],
        required: [
          "智能体建设",
          "智能体训练仪表盘",
          "智能体协作时间线",
          "多智能体任务",
          "登记智能体",
          "智能体更新",
          'shortLabel: "智能体"',
        ],
      },
      {
        file: "web/src/features/account-project-center/model.ts",
        forbidden: ["Agent 训练仪表盘"],
        required: ["智能体训练仪表盘"],
      },
      {
        file: "packages/account-domain/src/modules/honor-projects/service.ts",
        forbidden: ["Agent 训练仪表盘"],
        required: ["智能体训练仪表盘"],
      },
      {
        file: "packages/account-domain/src/modules/email-native/model.ts",
        forbidden: ["Agent 调用"],
        required: ["智能体调用"],
      },
      {
        file: "packages/account-domain/src/modules/email-native/service.ts",
        forbidden: ["Agent 调用入口"],
        required: ["智能体调用入口"],
      },
      {
        file: "packages/account-domain/src/modules/user-progression/model.ts",
        forbidden: ["登记 Agent", "Agent 能力", "平台 Agent", "外部 Agent"],
        required: ["登记智能体", "智能体能力", "平台智能体", "外部智能体"],
      },
      {
        file: "web/src/app/growth/page.tsx",
        forbidden: ["创建 Agent"],
        required: ["创建智能体"],
      },
      {
        file: "web/src/features/account-agent-center/agent-center-page.tsx",
        forbidden: ["并行转发到所选 Agent"],
        required: ["并行转发到所选智能体"],
      },
      {
        file: "packages/account-domain/src/modules/wallet-ledger/service.ts",
        forbidden: ["Agent 消费"],
        required: ["智能体消费"],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of expectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "honor, project, email, growth, and wallet seed copy must not expose generic Agent wording",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "honor, project, email, growth, and wallet seed copy must keep smart-agent wording",
    );
  });

  it("keeps heavy-chat seed copy localized and free of raw implementation labels", () => {
    const seedPath = "web/src/features/account-heavy-agent-chat/seed-data.ts";
    const contents = readFileSync(join(rootDir, seedPath), "utf8");
    const forbiddenPhrases = [
      "Default Heavy Dialog",
      "Custom Heavy Runtime",
      "Purchase More Capacity",
      "Default Chat Context",
      "Delivery + Email Native",
      "Heavy Slot Policy",
      "Heavy Slot Rules",
      "Heavy Slot Ledger",
      "Email-Native",
      "Task Hub",
      "task metadata",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "heavy-chat seed copy must not expose raw English implementation labels",
    );
    assert(
      contents.includes("默认重度对话") &&
        contents.includes("自定义重度运行") &&
        contents.includes("购买更多容量") &&
        contents.includes("默认对话上下文") &&
        contents.includes("交付与邮件入口") &&
        contents.includes("重度槽位规则") &&
        contents.includes("重度槽位账本") &&
        contents.includes("邮件任务整理") &&
        contents.includes("任务中心") &&
        contents.includes("任务元数据"),
      "heavy-chat seed copy must keep localized product labels",
    );
  });

  it("keeps account email service and personal task badges on product wording", () => {
    const expectations = [
      {
        file: "packages/account-domain/src/modules/email-native/service.ts",
        forbidden: [
          "Email-Native 调用入口",
          "Email-Native 调用",
          'sourceLabel: "Email-Native"',
          "Email-Native route execution failed",
        ],
        required: [
          "邮件调用入口",
          "邮件入口调用",
          'sourceLabel: "邮件入口"',
          "邮件入口执行失败",
        ],
      },
      {
        file: "web/src/app/my-tasks/page.tsx",
        forbidden: ["Task Hub"],
        required: ["任务中心"],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of expectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "account email service and personal task badges must not expose raw Email-Native or Task Hub labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "account email service and personal task badges must keep productized labels",
    );
  });

  it("keeps mailbox API fallback messages localized for the browser surface", () => {
    const mailboxServerPath = "web/src/features/mailbox/server.ts";
    const contents = readFileSync(join(rootDir, mailboxServerPath), "utf8");
    const forbiddenPhrases = [
      "Mailbox unavailable",
      "Mailbox claim failed",
      "Mailbox claim-all failed",
      "Mailbox archive-read failed",
      "Mailbox read failed",
      "Mailbox favorite update failed",
      "Mailbox delete failed",
      "Mailbox message claim failed",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "mailbox browser API fallbacks must not expose raw English Mailbox labels",
    );
    assert(
      contents.includes("站内邮箱暂不可用") &&
        contents.includes("领取邮箱附件失败") &&
        contents.includes("批量领取邮箱附件失败") &&
        contents.includes("归档已读邮箱消息失败") &&
        contents.includes("标记邮箱消息已读失败") &&
        contents.includes("更新邮箱收藏状态失败") &&
        contents.includes("删除邮箱消息失败") &&
        contents.includes("领取该邮箱消息附件失败"),
      "mailbox browser API fallbacks must keep localized user-facing labels",
    );
  });

  it("keeps callback policy helper copy free of raw policy keys and English implementation wording", () => {
    const policyHelperPath = "web/src/lib/agent-callback-policies.ts";
    const contents = readFileSync(join(rootDir, policyHelperPath), "utf8");
    const forbiddenPhrases = [
      "stored payload missing",
      "callback secret missing",
      "duplicate replay cooldown",
      "prev protocol on",
      "prev protocol off",
      "prev secret on",
      "prev secret off",
      "建议临时提升为 aggressive",
      "external callback",
      "secret 切换",
      "rejected callback",
      "operator backlog",
      "建议从 manual_only",
      "建议从 safe_retry",
      "建议从 aggressive",
      "duplicate callback",
      "execution override",
      "linked Agent",
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));

    assert.deepStrictEqual(
      matchedPhrases,
      [],
      "callback policy helper copy must be suitable for owner-facing pages",
    );
    assert(
      contents.includes("强化补救") &&
        contents.includes("安全重试") &&
        contents.includes("回调被拒绝") &&
        contents.includes("密钥切换"),
      "callback policy helper copy must keep localized policy and callback wording",
    );
  });

  it("keeps Tea settings copy localized and free of raw unknown fallbacks", () => {
    const teaSettingsPath = "web/src/app/tea/settings/page.tsx";
    const contents = readFileSync(join(rootDir, teaSettingsPath), "utf8");
    const forbiddenPhrases = [
      "Tea Settings",
      "Configuration unavailable",
      "Ownership",
      "Current",
      "owner:",
      'kicker="Local"',
      "Hook intake 默认审批策略",
    ];
    const forbiddenPatterns = [
      /\?\?\s*"unknown"/,
      /:\s*"unknown"/,
    ];
    const matchedPhrases = forbiddenPhrases.filter((phrase) => contents.includes(phrase));
    const matchedPatterns = forbiddenPatterns
      .filter((pattern) => pattern.test(contents))
      .map((pattern) => pattern.source);

    assert.deepStrictEqual(
      [...matchedPhrases, ...matchedPatterns],
      [],
      "Tea settings page must not expose raw English labels or unknown fallbacks",
    );
    assert(
      contents.includes("配置暂不可用") &&
        contents.includes("归属") &&
        contents.includes("当前配置") &&
        contents.includes("未声明"),
      "Tea settings page must keep localized replacements for settings labels and missing values",
    );
  });

  it("keeps bootstrap announcements free of UI test catalog copy", () => {
    const announcementsPath = "packages/contracts/src/account-announcements.ts";
    const contents = readFileSync(join(rootDir, announcementsPath), "utf8");
    const forbiddenPatterns = [
      /scroll-test/,
      /滚动测试/,
      /长公告测试/,
      /测试公告/,
      /模拟更新详情/,
      /二十字标题测试/,
    ];

    const matchedPatterns = forbiddenPatterns
      .filter((pattern) => pattern.test(contents))
      .map((pattern) => pattern.source);

    assert.deepStrictEqual(
      matchedPatterns,
      [],
      "bootstrap announcement fallback data must not expose layout-test copy to users",
    );
  });

  it("keeps ops agent console copy localized and free of raw callback/runtime labels", () => {
    const pageExpectations = [
      {
        file: "web/src/components/ops-shell.tsx",
        forbidden: ['label: "Agent 管理"'],
        required: ['label: "智能体管理"'],
      },
      {
        file: "web/src/app/ops/account/agents/sections.tsx",
        forbidden: [
          "Agent Detail",
          "External Callback Governance",
          "协议 / 密钥 / Policy",
          ">external<",
          "Runtime Bridge",
          "Runtime Session Watch",
          "Runtime Pressure",
          "Runtime Pressure Playbook",
          "Callback Health",
          "Recent Callback Audits",
          'capability.enabled ? "enabled" : "disabled"',
        ],
        required: [
          "智能体详情",
          "外部回调治理",
          "协议 / 密钥 / 策略",
          "运行桥接",
          "运行会话观测",
          "运行压力",
          "运行压力处置手册",
          "回调健康",
          "最近回调审计",
          'capability.enabled ? "已启用" : "已停用"',
        ],
      },
      {
        file: "web/src/app/ops/account/agents/page.tsx",
        forbidden: [
          "只有平台管理员可以访问 Agent 模块运维台。",
          "当前无法从 core 读取 Agent 模块快照",
          "Agent Registry 已关闭",
          "Agent 注册",
          "继承 Agent 默认",
          "linked agent",
          "callback health 正常",
          "duplicate callback",
          "rejected callback",
          "accepted 回调",
          "平台 Agent",
          "external callback",
          "capability 描述",
          "external execution",
          "打开 Agent Center",
          "回 Agent Center",
          "compatibility 命中",
          "running execution",
          "disabled 状态",
          "platform agent",
          "当前 agent",
          "Agent Ops Terminal",
          "Agent 模块运维台",
          "Agent Rail",
          "Agent 名称",
          "平台轻量 Agent",
          "平台重 Agent",
          "当前筛选条件下没有匹配的 Agent。",
          "当前没有可管理的 Agent",
          "Agent Center",
          "Callback Ops",
          "Operator Snapshot",
          "Create Agent",
          "in rail",
          "Owner runtime pressure is already critical.",
          "Recover stale executions first",
          "queued or blocked work can move forward from the same agent view",
          "stale open runtime sessions",
          "Push the queued backlog forward",
          "queued executions waiting here",
          "global ops console",
          "Keep runtime pressure under watch",
          "This agent still has open runtime sessions",
          "Open Runtime Pressure",
          "Runtime Pressure",
          "Runtime Sessions",
          "runtime catalog",
          "owner hotspot",
        ],
        required: [
          "只有平台管理员可以访问智能体模块运维台。",
          "当前无法读取智能体模块状态",
          "智能体注册已关闭",
          "智能体注册与回调治理能力",
          "继承智能体默认",
          "已接收回调趋势",
          "平台智能体",
          "外部回调",
          "能力描述",
          "外部执行",
          "打开智能体中心",
          "回智能体中心",
          "兼容命中",
          "运行中执行",
          "停用状态",
          "智能体运维终端",
          "智能体模块运维台",
          "智能体列表",
          "智能体名称",
          "平台轻量智能体",
          "平台重型智能体",
          "当前筛选条件下没有匹配的智能体。",
          "当前没有可管理的智能体",
          "回调运维",
          "运维总览",
          "创建智能体",
          "条在列表中",
          "归属运行压力已经达到严重等级",
          "优先恢复过期执行",
          "排队或阻塞的工作可以从同一智能体视图继续推进",
          "个过期打开运行会话",
          "推进排队积压",
          "条排队执行正在这里等待",
          "全局运维台",
          "保持运行压力可见",
          "该智能体仍有打开的运行会话",
          "打开运行压力",
          "运行压力",
          "运行会话",
          "运行目录",
          "归属热点",
        ],
      },
      {
        file: "web/src/app/ops/account/agents/item-builders.tsx",
        forbidden: [
          "最近 external callback",
          "Phase Age / Timeout",
          "Auto Recovery",
          "Operator Cue",
          "Next Step",
          "Execution Callback Policy",
          "execution override",
          "继承 Agent 默认",
          "当前 effective policy",
          "打开 Agent Center",
          "当前 duplicate callback 需要回看 replay",
          "当前 execution",
          "runtime risk",
          "phase overdue",
          "recovery exhausted",
          "run executor",
          "callback / runtime",
          "未进入 runtime",
          "Override 当前 execution",
          "next {executionActionTemplate.nextStepLabel}",
        ],
        required: [
          "最近外部回调",
          "阶段耗时 / 超时",
          "自动恢复",
          "运维提示",
          "下一步",
          "执行回调策略",
          "执行级覆盖",
          "继承智能体默认",
          "当前生效策略",
          "打开智能体中心",
          "当前重复回调需要回看重放",
          "当前执行",
          "运行风险",
          "阶段超时",
          "恢复次数耗尽",
          "运行执行器",
          "回调 / 运行",
          "未进入运行阶段",
          "覆盖当前执行",
          "后续 {executionActionTemplate.nextStepLabel}",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "ops agent console must not expose raw Agent Center, callback, runtime, or policy labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "ops agent console must keep localized operator-facing replacements",
    );
  });

  it("keeps account-worker ops copy localized and free of raw worker/digest labels", () => {
    const pageExpectations = [
      {
        file: "web/src/components/ops-shell.tsx",
        forbidden: ['label: "Account Worker"', "Operator Console"],
        required: ['label: "账户后台任务"', "运维控制台"],
      },
      {
        file: "web/src/app/ops/account-worker/page.tsx",
        forbidden: [
          'return "Healthy"',
          'return "Degraded"',
          'return "Unknown"',
          'return "Manual Cluster"',
          'return "Mixed Cluster"',
          'return "Worker Cluster"',
          'return "Digest Queue"',
          'return "Failing Presets"',
          'return "Mailbox Subscriptions"',
          'return "Cleanup Alert"',
          "批量重试 Digest",
          "批量忽略 Digest",
          "Cleanup 告警",
          "worker flush failed without explicit error",
          "shadow sync 处于 error 状态",
          "dedicated-db",
          "查看 Worker Runtime",
          "Operator Ops",
          "Account Worker Ops",
          "Products Ops",
          "account worker 运维台",
          '<p className="mg-subtitle">Risk</p>',
          '<h2 className="app-card-title">Backlog</h2>',
          '<p className="mg-subtitle">Worker</p>',
          '<h2 className="app-card-title">Digest Health</h2>',
          '<p className="mg-subtitle">Queue</p>',
          '<h2 className="app-card-title">Open / Due</h2>',
          '<p className="mg-subtitle">Runs</p>',
          '<h2 className="app-card-title">Recent 8</h2>',
          '<h2 className="app-card-title">Shadow Sync</h2>',
          '<h2 className="app-card-title">Outbox Recovery</h2>',
          "/ Requeued",
          "Dead-letter",
          '<p className="mg-subtitle">Subscriptions</p>',
          '<h2 className="app-card-title">Rules</h2>',
          "Pending digest",
          '<p className="mg-subtitle">Runbook</p>',
          "Suggestions",
          '<p className="mg-subtitle">Recent Playbooks</p>',
          "{normalizedRecentWorkerOpsSessions.length} Sessions",
          "worker playbook",
          '<p className="mg-subtitle">Failure Reasons</p>',
          "{failureClusters.length} Clusters",
          '<p className="mg-subtitle">Run Window</p>',
          '<p className="mg-subtitle">Worker Runtime</p>',
          '<Badge variant="warning">Internal</Badge>',
          "Started At",
          "Last Cycle",
          "Last Success",
          "Last Error",
          "Last Digest Run",
          "Last Digest Error",
          "Last Shadow Sync",
          "Last Outbox Recovery",
          "Outbox Recovery Totals",
          "Outbox Recovery Error",
          '<p className="mg-subtitle">Digest Pressure</p>',
          "Worker Snapshot",
          "Mailbox Summary",
          '<p className="mg-subtitle">Flush Trend</p>',
          "Worker Runs",
          "Manual Runs",
          "Degraded",
          "Healthy",
          "Scan {run.scannedCount}",
          "Sent {run.flushedCount}",
          "Pending Digests",
          "Products Ops",
          "{pendingDigests.length} Pending",
          "Due {toLocaleDateTime",
          "Namespace",
          "Batch",
          "Digest {String(subscription.digestWindowMinutes",
          "{subscriptions.length} Rules",
        ],
        required: [
          "账户后台任务运维",
          "运维动作",
          "返回商品运营",
          "当前账号无法访问账户后台任务运维台",
          '<p className="mg-subtitle">风险</p>',
          '<h2 className="app-card-title">积压</h2>',
          '<p className="mg-subtitle">后台任务</p>',
          '<h2 className="app-card-title">摘要健康</h2>',
          '<p className="mg-subtitle">队列</p>',
          '<h2 className="app-card-title">打开 / 到期</h2>',
          '<p className="mg-subtitle">运行</p>',
          '<h2 className="app-card-title">最近 8 次</h2>',
          '<h2 className="app-card-title">商品影子同步</h2>',
          '<h2 className="app-card-title">发件箱恢复</h2>',
          "重新入队",
          "死信",
          '<p className="mg-subtitle">订阅</p>',
          '<h2 className="app-card-title">规则</h2>',
          "待处理摘要",
          '<p className="mg-subtitle">处理手册</p>',
          "条建议",
          '<p className="mg-subtitle">最近处理会话</p>',
          "个会话",
          "后台任务处理会话",
          '<p className="mg-subtitle">失败原因</p>',
          "个聚类",
          '<p className="mg-subtitle">运行时间窗</p>',
          '<p className="mg-subtitle">后台任务运行</p>',
          '<Badge variant="warning">内部</Badge>',
          "启动时间",
          "最近循环",
          "最近成功",
          "最近错误",
          "最近摘要运行",
          "最近摘要错误",
          "最近影子同步",
          "最近发件箱恢复",
          "发件箱恢复累计",
          "发件箱恢复错误",
          '<p className="mg-subtitle">摘要压力</p>',
          "后台快照",
          "站内邮箱摘要",
          '<p className="mg-subtitle">刷新趋势</p>',
          "后台任务运行",
          "人工运行",
          "降级",
          "健康",
          "扫描 {run.scannedCount}",
          "发送 {run.flushedCount}",
          "待发送摘要",
          "去商品运营处理",
          "到期 {toLocaleDateTime",
          "命名空间",
          "批次",
          "摘要 {String(subscription.digestWindowMinutes",
          "条规则",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "account-worker ops page must not expose raw worker/digest/runbook labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "account-worker ops page must keep localized operator-facing replacements",
    );
  });

  it("keeps remaining account and ops surfaces free of raw English/internal product labels", () => {
    const pageExpectations = [
      {
        file: "web/src/app/growth/page.tsx",
        forbidden: [
          "Current Level",
          "${progression.sources.length} sources",
        ],
        required: [
          "当前等级",
          "${progression.sources.length} 来源",
        ],
      },
      {
        file: "web/src/app/arbitrations/page.tsx",
        forbidden: [
          "Case Timeline",
          "下一轮 operator 用户 ID",
        ],
        required: [
          "案件时间线",
          "下一轮运维用户 ID",
        ],
      },
      {
        file: "web/src/app/tea/[ticketId]/page.tsx",
        forbidden: [
          "Tea Review Desk",
          "Tea 没有返回该工单详情",
        ],
        required: [
          "Tea 审阅台",
          "工单详情暂不可用",
        ],
      },
      {
        file: "web/src/app/ops/account/agents/sections.tsx",
        forbidden: [
          "Oldest Open",
          "Oldest Stale",
          '<p className="mg-subtitle">Recommendation</p>',
          '<Badge variant="warning">next action</Badge>',
          '<p className="mg-subtitle">Capabilities</p>',
          '<p className="mg-subtitle">Executions</p>',
        ],
        required: [
          "最早打开",
          "最早过期",
          "处置建议",
          "下一步动作",
          "能力",
          "执行",
        ],
      },
      {
        file: "web/src/app/ops/products/page.tsx",
        forbidden: [
          "Inventory",
          "Total Products",
          "<th>Active</th>",
          "<th>Inactive</th>",
        ],
        required: [
          "商品库存",
          "商品总数",
          "<th>已上架</th>",
          "<th>未上架</th>",
        ],
      },
      {
        file: "web/src/app/ops/account/email-ingress/page.tsx",
        forbidden: [
          "Email-Native / Mailgun",
          "真实邮件 provider",
          "Email-Native 主链",
          "正式 provider",
          "公开 ingress",
        ],
        required: [
          "邮件入口 / Mailgun",
          "真实邮件服务商",
          "邮件入口主链",
          "正式服务商",
          "公开入口",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "remaining account and ops surfaces must not expose raw English/internal product labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "remaining account and ops surfaces must keep localized product-facing labels",
    );
  });

  it("keeps agent ops detail metrics, history, and execution policy copy localized", () => {
    const pageExpectations = [
      {
        file: "web/src/app/ops/account/agents/page.tsx",
        forbidden: [
          'label: "Capabilities"',
          'label: "Executions"',
          'label: "Rejected"',
          'label: "Policy"',
          'label: "Owner"',
          'label: "Source / Auth"',
          'label: "Runtime"',
          "secret rotated",
          "protocol updated",
          "compatibility cleaned",
          "agent created",
          ': "Healthy"',
          "profile {selectedPrimaryOwnerPressure.key}",
          "stale {formatCount(selectedRuntimeSessionSummary.staleOpenCount)}",
          "Execution Watch",
          "Duplicate ${formatRate",
          "Rejected ${formatRate",
          "Compat Hits",
          'subtitle="Governance Posture"',
          'subtitle="Policy Recommendation"',
          'subtitle="Callback History"',
        ],
        required: [
          'label: "能力"',
          'label: "执行"',
          'label: "被拒绝"',
          'label: "策略"',
          'label: "归属"',
          'label: "来源 / 鉴权"',
          'label: "运行地址"',
          "密钥已轮换",
          "协议已更新",
          "兼容窗口已清理",
          "智能体已创建",
          ': "健康"',
          "配置 {selectedPrimaryOwnerPressure.key}",
          "过期 {formatCount(selectedRuntimeSessionSummary.staleOpenCount)}",
          "执行观测",
          "重复 ${formatRate",
          "拒绝 ${formatRate",
          "兼容命中",
          'subtitle="治理状态"',
          'subtitle="策略建议"',
          'subtitle="回调历史"',
        ],
      },
      {
        file: "web/src/app/ops/account/agents/item-builders.tsx",
        forbidden: [
          "Failure Watch",
          "Settlement Watch",
          "Running Watch",
          "Queue Watch",
          "Execution Watch",
          "失败 callback 审计",
          "验收前 callback 审计",
          "运行态 callback 审计",
          "排队态 callback 审计",
          "查看 callback 审计",
          "更新 Execution Policy",
          "Execution Policy Recommendation",
        ],
        required: [
          "失败观测",
          "结算观测",
          "运行观测",
          "排队观测",
          "执行观测",
          "失败回调审计",
          "验收前回调审计",
          "运行态回调审计",
          "排队态回调审计",
          "查看回调审计",
          "更新执行策略",
          "执行策略建议",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "agent ops detail surfaces must not expose raw English metrics, history labels, or execution policy labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "agent ops detail surfaces must keep localized metrics, history labels, and execution policy labels",
    );
  });

  it("keeps ops inventory summaries localized instead of exposing raw English table labels", () => {
    const pageExpectations = [
      {
        file: "web/src/app/ops/discount-codes/page.tsx",
        forbidden: [
          '<h2 className="ops-card__title">Inventory</h2>',
          "<th>Total</th>",
          "<th>Enabled</th>",
          "<th>Filtered</th>",
          "Expiring ({discountWindowDays}d)",
        ],
        required: [
          '<h2 className="ops-card__title">优惠码库存</h2>',
          "<th>总数</th>",
          "<th>已启用</th>",
          "<th>当前筛选</th>",
          "即将到期 ({discountWindowDays} 天)",
        ],
      },
      {
        file: "web/src/app/ops/account/missions/page.tsx",
        forbidden: [
          '<h2 className="ops-card__title">Inventory</h2>',
          "<th>Total</th>",
          "<th>Active</th>",
          "<th>Draft</th>",
          "<th>Archived</th>",
        ],
        required: [
          '<h2 className="ops-card__title">任务库存</h2>',
          "<th>总数</th>",
          "<th>已上线</th>",
          "<th>草稿</th>",
          "<th>已归档</th>",
        ],
      },
      {
        file: "web/src/app/ops/account/mailbox/page.tsx",
        forbidden: [
          '<h2 className="ops-card__title">Inventory</h2>',
          "<th>Total</th>",
          "<th>Scheduled</th>",
          "<th>Sent</th>",
          "<th>Failed</th>",
        ],
        required: [
          '<h2 className="ops-card__title">邮件活动库存</h2>',
          "<th>总数</th>",
          "<th>待投递</th>",
          "<th>已发送</th>",
          "<th>失败</th>",
        ],
      },
      {
        file: "web/src/app/ops/account/announcements/page.tsx",
        forbidden: [
          '<h2 className="ops-card__title">Inventory</h2>',
          "<th>Total</th>",
          "<th>Published</th>",
          "<th>Draft</th>",
          "<th>Archived</th>",
        ],
        required: [
          '<h2 className="ops-card__title">公告库存</h2>',
          "<th>总数</th>",
          "<th>已发布</th>",
          "<th>草稿</th>",
          "<th>已归档</th>",
        ],
      },
      {
        file: "web/src/app/ops/account/honor-projects/page.tsx",
        forbidden: [
          '<h1 className="ops-page-title">Honor Projects</h1>',
          '<h2 className="ops-card__title">Inventory</h2>',
          "<th>Total</th>",
          "<th>Active</th>",
          "<th>Archived</th>",
          "<th>Investments</th>",
        ],
        required: [
          '<h1 className="ops-page-title">荣誉项目</h1>',
          '<h2 className="ops-card__title">项目库存</h2>',
          "<th>总数</th>",
          "<th>展示中</th>",
          "<th>已归档</th>",
          "<th>投资记录</th>",
        ],
      },
      {
        file: "web/src/app/ops/account/credential-pools/page.tsx",
        forbidden: [
          "当前在管 lifecycle",
          "available /",
          "项 assignment",
          "{selectedProvider.serviceCount} services",
          "<span>Active entries</span>",
          "<span>Active assignments</span>",
          "<span>Terminals</span>",
          "选择 Provider 聚焦",
        ],
        required: [
          "当前在管生命周期",
          "个可用凭证",
          "项分配",
          "{selectedProvider.serviceCount} 个服务",
          "<span>可用凭证</span>",
          "<span>有效分配</span>",
          "<span>终端</span>",
          "选择服务商聚焦",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "ops inventory summaries must not expose raw English table labels or mixed internal inventory wording",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "ops inventory summaries must keep localized titles, columns, and provider inventory copy",
    );
  });

  it("keeps account API fallback messages localized for browser-displayed errors", () => {
    const apiExpectations = [
      {
        file: "web/src/app/api/account-commerce/panel/route.ts",
        forbidden: ["Commerce panel unavailable"],
        required: ["商城面板暂不可用"],
      },
      {
        file: "web/src/app/api/account-benefits/panel/route.ts",
        forbidden: ["Benefit panel unavailable"],
        required: ["权益面板暂不可用"],
      },
      {
        file: "web/src/app/api/account-benefits/services/[serviceId]/api-access/route.ts",
        forbidden: ["Benefit service API access unavailable"],
        required: ["权益服务 API 访问暂不可用"],
      },
      {
        file: "web/src/app/api/account-benefits/services/[serviceId]/api-access/rotate/route.ts",
        forbidden: ["Benefit service API access rotate unavailable"],
        required: ["权益服务 API 访问轮换暂不可用"],
      },
      {
        file: "web/src/app/api/account-missions/panel/route.ts",
        forbidden: ["Mission panel unavailable"],
        required: ["任务面板暂不可用"],
      },
      {
        file: "web/src/app/api/account-credential-pools/services/[serviceId]/credential/route.ts",
        forbidden: ["Credential unavailable"],
        required: ["凭证暂不可用"],
      },
      {
        file: "web/src/app/api/account-credential-pools/services/[serviceId]/credential/rotate/route.ts",
        forbidden: ["Credential rotate unavailable"],
        required: ["凭证轮换暂不可用"],
      },
      {
        file: "web/src/features/account-honor/server.ts",
        forbidden: ["Honor panel unavailable"],
        required: ["荣誉面板暂不可用"],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of apiExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "account API fallback messages must not leak English unavailable copy to browser surfaces",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "account API fallback messages must keep localized user-facing fallback copy",
    );
  });

  it("keeps gateway health and archive ops copy localized", () => {
    const pageExpectations = [
      {
        file: "web/src/app/ops/gateway/health/page.tsx",
        forbidden: [
          "AI Gateway / Health",
          "Provider:",
          "Credential:",
          "Profile:",
          "Failures:",
          "Cooldown:",
          "Updated:",
          "credential × model 状态机和 usage bucket",
          "provider credential × model 状态机、usage queue 聚合摘要与最近 bucket",
          "queue:",
          "24h req:",
          "alerts:",
          "Operator Alerts",
          "Usage Buckets",
          "user:",
          "credential:",
          "req {bucket.requestCount} / fail {bucket.failureCount} / tokens {bucket.totalTokens}",
          "暂无聚合 bucket",
        ],
        required: [
          "AI 网关 / 健康状态",
          "服务商：",
          "凭证：",
          "协议配置：",
          "失败次数：",
          "冷却截止：",
          "更新时间：",
          "凭证 × 模型状态机和用量聚合桶",
          "服务商凭证 × 模型状态机、用量队列聚合摘要与最近聚合桶",
          "队列：",
          "24 小时请求：",
          "告警：",
          "运维告警",
          "用量聚合",
          "用户：",
          "请求 {bucket.requestCount} / 失败 {bucket.failureCount} / Token {bucket.totalTokens}",
          "暂无聚合桶",
        ],
      },
      {
        file: "web/src/app/ops/gateway/conversation-archives/page.tsx",
        forbidden: [
          ">truncated<",
          'label="Provider"',
          'label="Endpoint"',
          "artifact 预览暂不可查看",
          "对话存档 artifact",
          "artifact 预览暂不可用",
          "AI Gateway / Conversation Archives",
          "request / response artifact 索引与 NDJSON export 落点",
          "rows:",
          "搜索 request/user/provider/model",
          "Selected Archive",
          "Request object",
          "Response object",
          "Retention",
          "Export API",
          "Artifact Preview",
          "查看 artifact",
        ],
        required: [
          "已截断",
          'label="服务商"',
          'label="端点"',
          "归档预览暂不可查看",
          "对话存档归档对象",
          "归档预览暂不可用",
          "AI 网关 / 对话存档",
          "请求 / 响应归档对象索引与 NDJSON 导出落点",
          "记录：",
          "搜索请求、用户、服务商或模型",
          "已选存档",
          "请求对象",
          "响应对象",
          "保留期限",
          "导出接口",
          "归档预览",
          "查看归档对象",
        ],
      },
    ];

    const staleMatches = [];
    const missingMatches = [];
    for (const expectation of pageExpectations) {
      const contents = readFileSync(join(rootDir, expectation.file), "utf8");
      for (const phrase of expectation.forbidden) {
        if (contents.includes(phrase)) {
          staleMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
      for (const phrase of expectation.required) {
        if (!contents.includes(phrase)) {
          missingMatches.push(`${expectation.file}: ${phrase}`);
        }
      }
    }

    assert.deepStrictEqual(
      staleMatches,
      [],
      "gateway health and archive ops pages must not expose raw English or internal artifact/usage labels",
    );
    assert.deepStrictEqual(
      missingMatches,
      [],
      "gateway health and archive ops pages must keep localized operator-facing copy",
    );
  });

  it("keeps gateway trace detail copy localized", () => {
    const pagePath = "web/src/app/ops/gateway/traces/page.tsx";
    const contents = readFileSync(join(rootDir, pagePath), "utf8");

    const forbidden = [
      "Operator / AI 网关",
      "当前无法连接 AI Gateway",
      "Gateway 服务恢复后",
      "<NtBadge tone={tone}>{status}</NtBadge>",
      '<span className="nt-kicker">Token</span>',
      'label="Provider ID"',
      'label="Pipeline"',
      'label="Token"',
      'label="Provider"',
      'label="Platform Access"',
      'label="Source Access Key"',
      'label="Real Credential"',
      'label="Access Key"',
      'label="Legacy API Key"',
      'label="User Credential"',
      'label="Previous Response"',
      'label="Session"',
      'label="显式 Session Key"',
    ].filter((phrase) => contents.includes(phrase));
    const required = [
      "运维 / AI 网关",
      "当前无法连接 AI 网关",
      "网关服务恢复后",
      "function getRequestStatusLabel",
      "<NtBadge tone={tone}>{getRequestStatusLabel(status)}</NtBadge>",
      '<span className="nt-kicker">Token 用量</span>',
      'label="服务商 ID"',
      'label="执行管线"',
      'label="Token 用量"',
      'label="服务商"',
      'label="平台访问"',
      'label="来源访问密钥"',
      'label="真实凭证"',
      'label="访问密钥"',
      'label="旧版 API 密钥"',
      'label="用户凭证"',
      'label="上一轮响应"',
      'label="会话"',
      'label="显式会话密钥"',
    ].filter((phrase) => !contents.includes(phrase));

    assert.deepStrictEqual(
      forbidden,
      [],
      "gateway trace page must not expose raw English trace detail labels",
    );
    assert.deepStrictEqual(
      required,
      [],
      "gateway trace page must keep localized request status, credential, and route-detail labels",
    );
  });

  it("keeps gateway cost page token copy consistently localized", () => {
    const pagePath = "web/src/app/ops/gateway/costs/page.tsx";
    const contents = readFileSync(join(rootDir, pagePath), "utf8");

    const forbidden = [
      "Operator / AI 网关",
      "输入Tokens",
      "输出Tokens",
      "思考Tokens",
      "缓存Tokens",
      "总Token数",
      "历史 token 使用量",
      "思考Tokens当前",
      "缓存Tokens当前",
    ].filter((phrase) => contents.includes(phrase));
    const required = [
      "运维 / AI 网关",
      "输入 Token",
      "输出 Token",
      "思考 Token",
      "缓存 Token",
      "总 Token 数",
      "历史 Token 使用量",
      "思考 Token 当前",
      "缓存 Token 当前",
    ].filter((phrase) => !contents.includes(phrase));

    assert.deepStrictEqual(
      forbidden,
      [],
      "gateway cost page must not expose mixed English token copy or raw operator breadcrumb",
    );
    assert.deepStrictEqual(
      required,
      [],
      "gateway cost page must keep Token metrics spaced and localized consistently",
    );
  });

  it("keeps gateway provider create execution-mode copy localized", () => {
    const pagePath = "web/src/app/ops/gateway/providers/create/page.tsx";
    const contents = readFileSync(join(rootDir, pagePath), "utf8");

    const forbidden = [
      '"Browser Backed"',
      '"Direct HTTP"',
    ].filter((phrase) => contents.includes(phrase));
    const required = [
      '"浏览器托管"',
      '"直连 HTTP"',
      "formatExecutionModeLabel",
    ].filter((phrase) => !contents.includes(phrase));

    assert.deepStrictEqual(
      forbidden,
      [],
      "gateway provider create page must not expose raw English execution-mode labels",
    );
    assert.deepStrictEqual(
      required,
      [],
      "gateway provider create page must keep localized execution-mode labels through a shared formatter",
    );
  });

  it("renders the web entry page", () => {
    const appPath = join(rootDir, "web/src/app/page.tsx");
    const stats = statSync(appPath);
    assert(stats.isFile(), "web app page missing");
  });

  it("keeps sanitized workspace environment examples", () => {
    const envExamplePaths = [
      "core/.env.example",
      "executor/.env.example",
      "web/.env.example",
      "worker/.env.example",
    ];

    for (const envExamplePath of envExamplePaths) {
      const stats = statSync(join(rootDir, envExamplePath));
      assert(stats.isFile(), `${envExamplePath} missing from Platform workspace`);
    }
  });

  it("keeps root runtime capture artifacts local", () => {
    const gitignorePath = join(rootDir, "..", ".gitignore");
    const contents = readFileSync(gitignorePath, "utf8");
    assert(
      /^\/\.runtime\/$/m.test(contents),
      "root .runtime capture artifacts must stay ignored and local",
    );
  });

  it("keeps Platform-local operational helper entrypoints", () => {
    const helperPaths = [
      "deploy/claim-heavy-task.ps1",
      "deploy/release-heavy-task.ps1",
      "deploy/show-heavy-task-status.ps1",
      "deploy/invoke-heavy-task.ps1",
      "deploy/wait-heavy-task-available.ps1",
      "deploy/heavy-task-common.ps1",
      "deploy/bootstrap-local-gateway-fake-provider.ps1",
      "deploy/bootstrap-local-gateway-provider.ps1",
      "deploy/bootstrap-local-gateway-freebuff-provider.ps1",
      "deploy/bootstrap-local-gateway-kiro-provider.ps1",
      "deploy/write-qwen-official-credential-files.ps1",
    ];

    for (const helperPath of helperPaths) {
      const stats = statSync(join(rootDir, helperPath));
      assert(stats.isFile(), `${helperPath} missing from Platform deploy helpers`);
    }
  });

  it("does not document Gateway release helpers as Platform-local deploy scripts", () => {
    const filesToCheck = [
      "AGENTS.md",
      "docs/20-ai-gateway/AI网关发布与滚动切流基线.md",
      "../docs/gateway/baseline/AI网关发布与滚动切流基线.md",
    ];
    const stalePlatformLocalReferencePatterns = [
      /-\s+`deploy\/build-images\.sh`\s+与\s+`deploy\/push-images\.sh`/,
      /-\s+`deploy\/docker\/gateway\.Dockerfile`/,
      /-\s+`deploy\/build-gateway-binary\.sh`/,
      /-\s+`deploy\/reload-gateway-splitter\.sh`/,
      /-\s+`deploy\/release-gateway\.sh`/,
      /`deploy\/build-images\.sh`、`deploy\/push-images\.sh`、`deploy\/rollout-gateway\.sh`/,
    ];

    for (const fileToCheck of filesToCheck) {
      const contents = readFileSync(join(rootDir, fileToCheck), "utf8");
      for (const stalePattern of stalePlatformLocalReferencePatterns) {
        assert(
          !stalePattern.test(contents),
          `${fileToCheck}: ${stalePattern} should be documented as Gateway-owned, not Platform-local`,
        );
      }
    }
  });

  it("has root GitHub Actions validation for Platform", () => {
    const workflowPath = join(rootDir, "../.github/workflows/package-platform.yml");
    const contents = readFileSync(workflowPath, "utf8");
    assert(contents.includes("name: Package Platform"), "Platform workflow has wrong name");
    assert(contents.includes("Platform/**"), "Platform workflow does not watch Platform paths");
    assert(contents.includes("npm run smoke"), "Platform workflow does not run the smoke suite");
    assert(
      contents.includes("docker compose -f deploy/docker-compose.local.yml config --quiet"),
      "Platform workflow does not validate the local compose topology",
    );
  });

  it("keeps locally referenced docs and rules available", () => {
    const referenceFiles = [
      "AGENTS.md",
      "README.md",
      "docs/README.md",
      "docs/20-ai-gateway/README.md",
    ];

    const missingReferences = [];
    for (const referenceFile of referenceFiles) {
      const contents = readFileSync(join(rootDir, referenceFile), "utf8");
      const matches = contents.matchAll(/`((?:docs|rules)\/[^`]+?\.md)`/g);
      for (const match of matches) {
        const referencedPath = decodeURIComponent(match[1]);
        try {
          const stats = statSync(join(rootDir, referencedPath));
          if (!stats.isFile()) {
            missingReferences.push(`${referenceFile} -> ${referencedPath}`);
          }
        } catch {
          missingReferences.push(`${referenceFile} -> ${referencedPath}`);
        }
      }
    }

    assert.deepStrictEqual(missingReferences, []);
  });

  it("keeps non-history markdown docs self-contained for local docs/rules references", () => {
    const missingReferences = [];
    for (const markdownPath of collectMarkdownFiles(rootDir)) {
      const referenceFile = markdownPath.slice(rootDir.length + 1).replaceAll("\\", "/");
      const contents = readFileSync(markdownPath, "utf8");
      const matches = contents.matchAll(/`((?:docs|rules)\/[^`]+?\.md)`/g);
      for (const match of matches) {
        const referencedPath = decodeURIComponent(match[1]);
        try {
          const stats = statSync(join(rootDir, referencedPath));
          if (!stats.isFile()) {
            missingReferences.push(`${referenceFile} -> ${referencedPath}`);
          }
        } catch {
          missingReferences.push(`${referenceFile} -> ${referencedPath}`);
        }
      }
    }

    assert.deepStrictEqual(missingReferences, []);
  });
});
