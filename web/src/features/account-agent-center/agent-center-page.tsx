import Link from "next/link";
import { redirect } from "next/navigation";

import type {
  AgentExecutionView,
  AgentMarketplaceListingView,
  AgentView,
  TaskAgentProposalView,
  TaskView,
} from "@neuro/contracts";
import { auth } from "@/auth";
import { getBenefitPanel, listBenefitServiceModels } from "@/lib/account-client";
import {
  AccountHomeSection,
  AccountHomeSectionHead,
} from "@/components/account-home/templates";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtInput as Input,
  NtSelect as Select,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import {
  formatAccountDateTime,
  formatAccountNumber,
} from "@/lib/account-center";
import {
  getFeatureSnapshot,
  getPublicSurfaceSnapshot,
  isFeatureSnapshotUnavailable,
  listAgentCapabilities,
  listAgentMarketplaceListings,
  listSuppliedAgentMarketplaceExecutions,
  listAgents,
  listTaskAgentProposals,
  listTasks,
} from "@/lib/platform-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";
import {
  invokeAgentMarketplaceListingBatchAction,
  invokeAgentMarketplaceListingAction,
  runAgentMarketplaceAutoProposalSweepAction,
} from "@/lib/platform-actions";
import {
  getTaskRouteMatch,
  normalizeRouteKeywords,
} from "@/lib/agent-market-routing";
import { cn } from "@/lib/cn";
import { ManagedCloudRoleSection } from "@/features/account-agent-center/managed-cloud-role-section";
import { ManagedHeavyRoleSection } from "@/features/account-agent-center/managed-heavy-role-section";
import { ManagedLightRoleSection } from "@/features/account-agent-center/managed-light-role-section";

import "./styles.css";

type AgentCenterPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    executionId?: string;
      embedded?: string;
      mode?: string;
      role?: string;
      panel?: string;
      agentId?: string;
      batch?: string;
    }>;
};

type AgentCenterMode = "roles" | "tasks";
type AgentRoleView = "light" | "heavy" | "cloud";
type AgentWorkbenchPanel = "create" | "edit" | null;
type LightOverviewBatchMode = "delete" | "enable" | "disable" | null;
type AgentRailItem = {
  href: string;
  label: string;
  value?: AgentRoleView;
};
const lightAgentTaskCategoryOptions = [
  { value: "image_processing", label: "图像处理" },
  { value: "video_processing", label: "视频处理" },
  { value: "audio_processing", label: "音频处理" },
  { value: "text_generation", label: "文本生成" },
  { value: "translation", label: "翻译改写" },
  { value: "coding", label: "代码处理" },
  { value: "data_analysis", label: "数据分析" },
] as const;

const LOCAL_DEBUG_MANAGED_LIGHT_SERVICE_ID = "__local_debug_managed_light_service__";
const LOCAL_DEBUG_MANAGED_LIGHT_MODEL_ID = "ui-test-model";
const MANAGED_LIGHT_SUMMARY_EXECUTION_LIMIT = 200;

function buildLocalDebugManagedLightServiceOption() {
  return {
    id: LOCAL_DEBUG_MANAGED_LIGHT_SERVICE_ID,
    title: "测试环境调试凭证",
    description: "本地保底 / 不校验购买状态",
    apiUrl: null,
    providerKey: "local_debug",
    modelOptions: [
      {
        value: LOCAL_DEBUG_MANAGED_LIGHT_MODEL_ID,
        label: LOCAL_DEBUG_MANAGED_LIGHT_MODEL_ID,
        description: "Web 调试专用",
      },
    ],
  };
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
      <path d="M6.5 6.5l11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function formatCurrencyLabel(currency: "obsidian" | "mira") {
  return currency === "obsidian" ? "曜石" : "米拉";
}

function formatHostingModeLabel(agent: AgentView) {
  if (agent.hostingMode === "managed_heavy") {
    return "平台重型";
  }
  if (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime") {
    return "Open Agent";
  }
  if (agent.hostingMode === "registry_only") {
    return "轻量草稿";
  }
  return "平台轻量";
}

function formatLightAgentTaskCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return "未定义";
  }
  return lightAgentTaskCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function buildLightAgentRoutingTagSeed(agent: AgentView) {
  const tags = new Set<string>();
  if (agent.managedTaskCategory) {
    tags.add(formatLightAgentTaskCategoryLabel(agent.managedTaskCategory));
  }
  return [...tags].join(", ");
}

function formatSourceTypeLabel(agent: AgentView) {
  return agent.sourceType === "external" ? "接口定义" : "平台代运行";
}

function formatListingStatusLabel(status: AgentMarketplaceListingView["status"]) {
  if (status === "published") return "已上架";
  if (status === "paused") return "暂停";
  return "草稿";
}

function formatBillingModeLabel(listing: AgentMarketplaceListingView) {
  if (listing.billingMode === "token_metered") {
    return `按 token / ${listing.billingUnit || "计量单位"}`;
  }
  if (listing.billingMode === "property_metered") {
    return `按属性 / ${listing.meterKey || listing.billingUnit || "计量单位"}`;
  }
  return `按任务 / ${listing.billingUnit || "task"}`;
}

function formatSupplierExecutionRequester(execution: AgentExecutionView, currentUserId: string) {
  if (execution.ownerUserId === currentUserId) {
    return "我方测试调用";
  }
  return execution.ownerUserId;
}

function buildTaskSeedHref(listing: AgentMarketplaceListingView) {
  const params = new URLSearchParams();
  params.set("panel", "publish");
  params.set("listingId", listing.id);
  params.set("capabilityCode", listing.capabilityCode);
  params.set(
    "pricingMode",
    listing.billingMode === "token_metered"
      ? "token_metered"
      : listing.billingMode === "property_metered"
        ? "property_metered"
        : "flat_task",
  );
  params.set("operationMode", listing.autoTakeEnabled ? "automatic" : "manual");
  params.set("title", `委托 ${listing.publicTitle}`);
  params.set(
    "description",
    listing.publicDescription ||
      `请使用 ${listing.agentName} / ${listing.capabilityTitle} 能力完成交付，按 ${listing.priceAmount} ${formatCurrencyLabel(listing.priceCurrency)} 报价。`,
  );
  if (listing.billingUnit) {
    params.set("billingUnit", listing.billingUnit);
  }
  if (listing.meterKey) {
    params.set("meterKey", listing.meterKey);
  }
  params.set("preferredCapabilityCodes", listing.capabilityCode);
  params.set("rewardCurrency", listing.priceCurrency);
  params.set("rewardAmount", String(listing.priceAmount));
  return `/tasks?${params.toString()}`;
}

function buildTaskDetailHref(taskId: string) {
  const params = new URLSearchParams();
  params.set("taskId", taskId);
  return `/tasks?${params.toString()}#task-${taskId}`;
}

function AgentStageGlyph() {
  return (
    <svg aria-hidden="true" className="app-agent-center-stage__glyph" viewBox="0 0 64 64">
      <path
        d="M32 8 50 18v28L32 56 14 46V18z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path d="M32 20v24M21 26l11 6 11-6M21 38l11-6 11 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function normalizeTaskUnit(value: string | null | undefined, fallback: string) {
  return value?.trim().toLowerCase() || fallback;
}

function getTaskListingRouteMatch(task: TaskView, listing: AgentMarketplaceListingView) {
  return getTaskRouteMatch(task, {
    code: listing.capabilityCode,
    title: listing.capabilityTitle,
    routingSummary: listing.routingSummary,
    routingTags: listing.routingTags,
    publicTitle: listing.publicTitle,
    publicDescription: listing.publicDescription,
  });
}

function getTaskMeterQuantity(task: TaskView) {
  if (task.pricingMode === "token_metered" || task.pricingMode === "property_metered") {
    return Math.max(1, Number(task.meterQuantity ?? 1));
  }
  return null;
}

function taskAcceptsListingCapability(task: TaskView, listing: AgentMarketplaceListingView) {
  return getTaskListingRouteMatch(task, listing).accepted;
}

function matchTaskAgainstListing(task: TaskView, listing: AgentMarketplaceListingView) {
  const routeMatch = getTaskListingRouteMatch(task, listing);
  if (!taskAcceptsListingCapability(task, listing)) {
    return { eligible: false, match: false, quotedAmount: null as number | null, routeMatch };
  }
  if (task.rewardCurrency !== listing.priceCurrency) {
    return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
  }
  if (task.pricingMode === "flat_task") {
    if (listing.billingMode !== "flat_task") {
      return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
    }
    return {
      eligible: true,
      match: task.rewardAmount >= listing.priceAmount,
      quotedAmount: listing.priceAmount,
      routeMatch,
    };
  }
  if (task.pricingMode === "token_metered") {
    if (listing.billingMode !== "token_metered") {
      return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
    }
    const normalizedTaskUnit = normalizeTaskUnit(task.billingUnit, "1k_tokens");
    const normalizedListingUnit = normalizeTaskUnit(listing.billingUnit, "1k_tokens");
    if (normalizedTaskUnit !== normalizedListingUnit) {
      return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
    }
    const meterQuantity = getTaskMeterQuantity(task) ?? 1;
    const quotedAmount = Math.max(1, meterQuantity * listing.priceAmount);
    return {
      eligible: true,
      match: task.rewardAmount >= quotedAmount,
      quotedAmount,
      routeMatch,
    };
  }
  if (task.pricingMode === "property_metered") {
    if (listing.billingMode !== "property_metered") {
      return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
    }
    const normalizedTaskMeterKey = normalizeTaskUnit(task.meterKey, "task_units");
    const normalizedListingMeterKey = normalizeTaskUnit(listing.meterKey, "task_units");
    if (normalizedTaskMeterKey !== normalizedListingMeterKey) {
      return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
    }
    const normalizedTaskUnit = normalizeTaskUnit(task.billingUnit, "task_property");
    const normalizedListingUnit = normalizeTaskUnit(listing.billingUnit, "task_property");
    if (normalizedTaskUnit !== normalizedListingUnit) {
      return { eligible: true, match: false, quotedAmount: null as number | null, routeMatch };
    }
    const meterQuantity = getTaskMeterQuantity(task) ?? 1;
    const quotedAmount = Math.max(1, meterQuantity * listing.priceAmount);
    return {
      eligible: true,
      match: task.rewardAmount >= quotedAmount,
      quotedAmount,
      routeMatch,
    };
  }
  return { eligible: false, match: false, quotedAmount: null as number | null, routeMatch };
}

function formatTaskMatchScope(task: TaskView) {
  if (task.preferredCapabilityCodes.length === 0) {
    return "未指定偏好能力，当前按路由描述 / 标签匹配";
  }
  return task.preferredCapabilityCodes.join(", ");
}

function formatRoutingTagsSummary(tags: string[] | null | undefined) {
  const normalized = normalizeRouteKeywords(tags);
  return normalized.length > 0 ? normalized.join(" / ") : "未定义";
}

function formatTaskStatusLabel(status: TaskView["status"]) {
  return (
    {
      open: "开放中",
      applying: "申请中",
      assigned: "已分配",
      in_progress: "执行中",
      submitted: "待验收",
      accepted: "已完成",
      rejected: "已退回",
      cancelled: "已取消",
      defaulted: "已违约",
    } as Record<TaskView["status"], string>
  )[status];
}

function taskStatusVariant(status: TaskView["status"]) {
  if (status === "accepted") return "success" as const;
  if (status === "submitted" || status === "assigned" || status === "in_progress") return "cyan" as const;
  if (status === "rejected" || status === "cancelled" || status === "defaulted") return "danger" as const;
  if (status === "applying") return "warning" as const;
  return "violet" as const;
}

function proposalStatusVariant(status: TaskAgentProposalView["status"]) {
  return status === "accepted" ? "success" : status === "rejected" ? "danger" : "warning";
}

function resolveAgentCenterMode(value: string | undefined): AgentCenterMode {
  return value === "tasks" ? "tasks" : "roles";
}

function resolveAgentRoleView(value: string | undefined): AgentRoleView {
  if (value === "heavy") {
    return "heavy";
  }
  if (value === "cloud") {
    return "cloud";
  }
  return "light";
}

function resolveWorkbenchPanel(value: string | undefined): AgentWorkbenchPanel {
  if (value === "create" || value === "edit") {
    return value;
  }
  return null;
}

function resolveLightOverviewBatchMode(value: string | undefined): LightOverviewBatchMode {
  if (value === "delete" || value === "enable" || value === "disable") {
    return value;
  }
  return null;
}

function getAgentRoleView(agent: AgentView): AgentRoleView {
  if (agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only") {
    return "heavy";
  }
  if (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime") {
    return "cloud";
  }
  return "light";
}

function formatAgentRoleLabel(role: AgentRoleView) {
  if (role === "heavy") {
    return "重度";
  }
  if (role === "cloud") {
    return "云端";
  }
  return "羽量";
}

function formatResourceSchemaSummary(schema: Record<string, unknown> | null | undefined) {
  if (!schema) {
    return "未定义";
  }
  const directKeys = Object.keys(schema);
  if (directKeys.length > 0) {
    return directKeys.join(", ");
  }
  const properties = schema.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    const propertyKeys = Object.keys(properties as Record<string, unknown>);
    if (propertyKeys.length > 0) {
      return propertyKeys.join(", ");
    }
  }
  return "已定义";
}

function buildAgentCenterHref(
  mode: AgentCenterMode,
  options?: {
    embedded?: boolean;
    hash?: string;
    role?: AgentRoleView;
    panel?: AgentWorkbenchPanel;
    agentId?: string | null;
  },
) {
  const params = new URLSearchParams();
  if (mode !== "roles") {
    params.set("mode", mode);
  }
  if (mode === "roles" && options?.role && options.role !== "light") {
    params.set("role", options.role);
  }
  if (options?.embedded) {
    params.set("embedded", "1");
  }
  if (mode === "roles" && options?.panel) {
    params.set("panel", options.panel);
  }
  if (mode === "roles" && options?.agentId) {
    params.set("agentId", options.agentId);
  }
  const query = params.toString();
  return `/agents${query ? `?${query}` : ""}${options?.hash ?? ""}`;
}

export default async function AgentCenterPage({ searchParams }: AgentCenterPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const publicSurfaces = await getPublicSurfaceSnapshot();
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "agents", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const embedded = params?.embedded === "1";
  const requestedMode = resolveAgentCenterMode(params?.mode);
  const roleView = resolveAgentRoleView(params?.role);
  const lightWorkbenchPanel = roleView === "light" ? resolveWorkbenchPanel(params?.panel) : null;
  const lightOverviewBatchMode =
    roleView === "light" && lightWorkbenchPanel === null ? resolveLightOverviewBatchMode(params?.batch) : null;
  const heavyWorkbenchPanel = roleView === "heavy" ? resolveWorkbenchPanel(params?.panel) : null;
  const heavyOverviewBatchMode =
    roleView === "heavy" && heavyWorkbenchPanel === null ? resolveLightOverviewBatchMode(params?.batch) : null;
  const cloudWorkbenchPanel = roleView === "cloud" ? resolveWorkbenchPanel(params?.panel) : null;
  const cloudOverviewBatchMode =
    roleView === "cloud" && cloudWorkbenchPanel === null ? resolveLightOverviewBatchMode(params?.batch) : null;
  const lightWorkbenchAgentId =
    roleView === "light" && lightWorkbenchPanel === "edit" ? params?.agentId?.trim() || null : null;
  const heavyWorkbenchAgentId =
    roleView === "heavy" && heavyWorkbenchPanel === "edit" ? params?.agentId?.trim() || null : null;
  const cloudWorkbenchAgentId =
    roleView === "cloud" && cloudWorkbenchPanel === "edit" ? params?.agentId?.trim() || null : null;
  const userContext = {
    userId: session.user.id,
    username: session.user.username,
  };

  const features = await getFeatureSnapshot();

  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">当前无法从 core 读取 Agent 模块快照，请稍后再试。</p>
          </Card>
        </div>
      </main>
    );
  }

  if (!features.agentRegistry.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">Agent 模块已关闭</h1>
            <p className="mg-copy">当前无法读取 Agent Center。</p>
          </Card>
        </div>
      </main>
    );
  }

  const tasksVisible = publicSurfaces.tasks.enabled && features.taskHub.enabled;
  const storeVisible = publicSurfaces.store.enabled && features.product.enabled;
  const mode: AgentCenterMode = requestedMode === "tasks" && !tasksVisible ? "roles" : requestedMode;

  const [agents, ownedListings, publicListings, supplierExecutions, tasks, benefitPanel] = await Promise.all([
    listAgents(userContext),
    listAgentMarketplaceListings(userContext, "owner").catch(() => []),
    listAgentMarketplaceListings(userContext, "public", 12).catch(() => []),
    listSuppliedAgentMarketplaceExecutions(userContext, MANAGED_LIGHT_SUMMARY_EXECUTION_LIMIT).catch(() => []),
    tasksVisible ? listTasks(userContext).catch(() => [] as TaskView[]) : Promise.resolve([] as TaskView[]),
    features.benefits.enabled ? getBenefitPanel(userContext).catch(() => null) : Promise.resolve(null),
  ]);

  const capabilityPairs = await Promise.all(
    agents.map(async (agent) => [agent.id, await listAgentCapabilities(userContext, agent.id).catch(() => [])] as const),
  );

  const capabilitiesByAgentId = new Map(capabilityPairs);
  const listingByCapabilityId = new Map(ownedListings.map((listing) => [listing.capabilityId, listing]));
  const publishedOwnedListings = ownedListings.filter((listing) => listing.status === "published");
  const autoTakeListings = ownedListings.filter((listing) => listing.autoTakeEnabled);
  const directInvokeListings = ownedListings.filter((listing) => listing.externalInvocationEnabled);
  const publicFeed = publicListings.filter((listing) => listing.ownerUserId !== session.user.id);
  const batchInvokeListings = [...directInvokeListings, ...publicFeed.filter((listing) => listing.externalInvocationEnabled)];
  const shouldLoadManagedLightModels = roleView === "light" && lightWorkbenchPanel !== null;
  const localDebugManagedLightEnabled = process.env.NODE_ENV !== "production";
  const managedLightServiceSeeds =
    benefitPanel?.families
      .filter((family) => family.key === "artificial_intelligence")
      .flatMap((family) => family.services)
      .filter(
        (service) => service.status === "active" && service.granted && service.config.apiDeliveryMode === "service_proxy",
      ) ?? [];
  const resolvedManagedLightServiceOptions = shouldLoadManagedLightModels
    ? await Promise.all(
        managedLightServiceSeeds.map(async (service) => ({
          id: service.id,
          title: service.title,
          description: null,
          apiUrl: service.config.apiUrl,
          providerKey: service.providerKey,
          modelOptions: (await listBenefitServiceModels(userContext, service.id).catch(() => []))
            .map((modelId) => ({
              value: modelId,
              label: modelId,
            })),
        })),
      )
    : managedLightServiceSeeds.map((service) => ({
        id: service.id,
        title: service.title,
        description: null,
        apiUrl: service.config.apiUrl,
        providerKey: service.providerKey,
        modelOptions: [],
      }));
  const managedLightServiceOptions = localDebugManagedLightEnabled
    ? [
        buildLocalDebugManagedLightServiceOption(),
        ...resolvedManagedLightServiceOptions.filter((service) => service.id !== LOCAL_DEBUG_MANAGED_LIGHT_SERVICE_ID),
      ]
    : resolvedManagedLightServiceOptions;
  const managedLightServiceTitleById = new Map(
    managedLightServiceOptions.map((service) => [service.id, service.title] as const),
  );
  const ownedAgentIds = new Set(agents.map((agent) => agent.id));
  const taskProposalPairs = tasksVisible
    ? await Promise.all(
        tasks.map(async (task) => [task.id, await listTaskAgentProposals(userContext, task.id).catch(() => [])] as const),
      )
    : [];
  const taskProposalsByTaskId = new Map(taskProposalPairs);
  const proposalPipeline = tasks
    .map((task) => ({
      task,
      proposals: (taskProposalsByTaskId.get(task.id) ?? []).filter((proposal) => ownedAgentIds.has(proposal.agentId)),
    }))
    .filter((entry) => entry.proposals.length > 0)
    .sort((left, right) => Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt));
  const autoMatchQueue = tasks
    .filter((task) => task.status === "open" || task.status === "applying")
    .map((task) => {
      const matchingListings = publishedOwnedListings
        .map((listing) => ({
          listing,
          pricingMatch: matchTaskAgainstListing(task, listing),
        }))
        .filter((entry) => entry.pricingMatch.eligible);
      const hasOwnedProposal = (taskProposalsByTaskId.get(task.id) ?? []).some((proposal) => ownedAgentIds.has(proposal.agentId));
      const rewardMeetsQuote = matchingListings.some((entry) => entry.pricingMatch.match);
      return {
        task,
        matchingListings,
        hasOwnedProposal,
        rewardMeetsQuote,
      };
    })
    .filter((entry) => entry.matchingListings.length > 0 && !entry.hasOwnedProposal)
    .sort((left, right) => Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt))
    .slice(0, 8);
  const selfHref = buildAgentCenterHref(mode, {
    embedded,
    role: roleView,
    panel:
      roleView === "light"
        ? lightWorkbenchPanel
        : roleView === "heavy"
          ? heavyWorkbenchPanel
          : roleView === "cloud"
            ? cloudWorkbenchPanel
            : null,
    agentId:
      roleView === "light"
        ? lightWorkbenchAgentId
        : roleView === "heavy"
          ? heavyWorkbenchAgentId
          : roleView === "cloud"
            ? cloudWorkbenchAgentId
            : null,
  });
  const sweepRedirectTarget = embedded ? selfHref : tasksVisible ? "/tasks" : selfHref;
  const batchSuccessRedirectTarget = selfHref;
  const topNavTarget = embedded ? "_top" : undefined;
  const modeTabs: Array<{ value: AgentCenterMode; label: string }> = tasksVisible
    ? [
        { value: "roles", label: "角色" },
        { value: "tasks", label: "任务" },
      ]
    : [{ value: "roles", label: "角色" }];
  const railItems: AgentRailItem[] =
    mode === "roles"
      ? [
          { href: buildAgentCenterHref("roles", { embedded, role: "light", hash: "#role-light" }), label: "羽量", value: "light" as const },
          { href: buildAgentCenterHref("roles", { embedded, role: "heavy", hash: "#role-heavy" }), label: "重度", value: "heavy" as const },
          { href: buildAgentCenterHref("roles", { embedded, role: "cloud", hash: "#role-cloud" }), label: "云端", value: "cloud" as const },
        ]
      : [
          { href: buildAgentCenterHref("tasks", { embedded, hash: "#proposal-pipeline" }), label: "提案" },
          { href: buildAgentCenterHref("tasks", { embedded, hash: "#batch-dispatch" }), label: "批量调用" },
          { href: buildAgentCenterHref("tasks", { embedded, hash: "#public-offers" }), label: "公开供给" },
        ];
  const selectedRoleAgents = agents.filter((agent) => getAgentRoleView(agent) === roleView);
  const selectedRoleAgentIds = new Set(selectedRoleAgents.map((agent) => agent.id));
  const selectedRoleExecutions = supplierExecutions.filter((execution) => selectedRoleAgentIds.has(execution.agentId));
  const metricsByAgentId = selectedRoleExecutions.reduce((metrics, execution) => {
    const current = metrics.get(execution.agentId) ?? {
      completedTaskCount: 0,
      totalRevenue: {
        obsidian: 0,
        mira: 0,
      },
    };
    if (execution.completedAt) {
      current.completedTaskCount += 1;
    }
    if (execution.settlement?.status === "settled") {
      if (execution.settlement.currency === "mira") {
        current.totalRevenue.mira += execution.settlement.revenueAmount;
      } else {
        current.totalRevenue.obsidian += execution.settlement.revenueAmount;
      }
    }
    metrics.set(execution.agentId, current);
    return metrics;
  }, new Map<string, { completedTaskCount: number; totalRevenue: { obsidian: number; mira: number } }>());

  return (
    <main className={cn("app-page", embedded && "app-agent-page--embedded")}>
        <div
          aria-label={embedded ? undefined : "Agent Center"}
          aria-modal={embedded ? undefined : true}
          className={cn("app-honor-overlay", "app-agent-center-overlay", embedded && "app-agent-center-dialog-shell--embedded")}
          role={embedded ? undefined : "dialog"}
        >
        {!embedded ? <Link aria-label="返回控制台" className="app-honor-backdrop" href="/dashboard" /> : null}

        {status && message ? (
          <div aria-atomic="true" aria-live="polite" className="app-toast-stack">
            <section className={`app-toast app-toast--${status === "success" ? "success" : "error"}`} role="status">
              <div className="app-toast__signal" aria-hidden="true" />
              <div className="app-toast__body">
                <strong className="app-toast__title">{status === "success" ? "操作完成" : "操作失败"}</strong>
                <p className="app-toast__message">{message}</p>
              </div>
              <Link aria-label="关闭提示" className="app-toast__close" href={selfHref}>
                ×
              </Link>
            </section>
          </div>
        ) : null}

        <div
          className={cn(
            "app-agent-center-dialog",
            embedded && "app-agent-center-dialog--embedded",
          )}
        >
          <section className={cn("app-agent-shell", embedded && "app-agent-shell--embedded")} data-mode={mode}>
            <aside className="app-agent-rail">
              <div className="app-agent-rail__head">
                <div className="app-agent-rail__mark" aria-hidden="true">
                  <AgentStageGlyph />
                </div>
                <div className="app-agent-rail__copy">
                  <h1>智能体</h1>
                </div>
              </div>

              <div className="app-agent-rail__mode-tabs" aria-label="智能体模式">
                {modeTabs.map((tab) => (
                  <Link
                    className={cn("app-agent-rail__mode", mode === tab.value && "app-agent-rail__mode--active")}
                    href={buildAgentCenterHref(tab.value, { embedded })}
                    key={tab.value}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>

              <nav className="app-agent-rail__list" aria-label={mode === "roles" ? "角色目录" : "任务目录"}>
                {railItems.map((item, index) => {
                  const isActive = mode === "roles" ? item.value === roleView : index === 0;
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={cn("app-agent-rail__item", isActive && "app-agent-rail__item--active")}
                      href={item.href}
                      key={item.href}
                    >
                      <strong>{item.label}</strong>
                    </Link>
                  );
                })}
              </nav>

            </aside>

            <section className="app-agent-content">
              {!embedded ? (
                <div className="app-agent-content__close-row">
                  <Link aria-label="关闭 Agent Center" className="app-honor-close" href="/dashboard">
                    <CloseIcon />
                  </Link>
                </div>
              ) : null}

              <div className="app-agent-content__body">
                <div className="app-account-content-grid">
            <div className="app-account-content-main">
              {roleView === "light" ? (
                <ManagedLightRoleSection
                  agents={selectedRoleAgents}
                  capabilitiesByAgentId={capabilitiesByAgentId}
                  editingAgentId={lightWorkbenchAgentId}
                  embedded={embedded}
                  listingByCapabilityId={listingByCapabilityId}
                  managedLightServiceOptions={managedLightServiceOptions}
                  managedLightServiceTitleById={managedLightServiceTitleById}
                  metricsByAgentId={metricsByAgentId}
                  batchMode={lightOverviewBatchMode}
                  panel={lightWorkbenchPanel}
                />
              ) : roleView === "heavy" ? (
                <ManagedHeavyRoleSection
                  agents={selectedRoleAgents}
                  batchMode={heavyOverviewBatchMode}
                  editingAgentId={heavyWorkbenchAgentId}
                  embedded={embedded}
                  panel={heavyWorkbenchPanel}
                  selfHref={selfHref}
                  storeVisible={storeVisible}
                />
              ) : roleView === "cloud" ? (
                <ManagedCloudRoleSection
                  agents={selectedRoleAgents}
                  batchMode={cloudOverviewBatchMode}
                  capabilitiesByAgentId={capabilitiesByAgentId}
                  editingAgentId={cloudWorkbenchAgentId}
                  listingByCapabilityId={listingByCapabilityId}
                  metricsByAgentId={metricsByAgentId}
                  panel={cloudWorkbenchPanel}
                  selfHref={selfHref}
                />
              ) : selectedRoleAgents.length > 0 ? (
                <AccountHomeSection className="app-agent-center-section--roles" id={`role-${roleView}`}>
                  <AccountHomeSectionHead title={formatAgentRoleLabel(roleView)} />
                  <div className="app-agent-center-cards">
                    {selectedRoleAgents.map((agent) => {
                      const capabilities = capabilitiesByAgentId.get(agent.id) ?? [];
                      const primaryCapability = capabilities[0] ?? null;
                      const publishedCount = capabilities.filter((capability) => {
                        const listing = listingByCapabilityId.get(capability.id);
                        return listing?.status === "published";
                      }).length;

                      return (
                        <Card className="app-agent-center-card" key={agent.id}>
                          <div className="app-agent-center-card__meta">
                            <Badge variant={agent.enabled ? "success" : "warning"}>{agent.enabled ? "enabled" : "disabled"}</Badge>
                            <Badge variant="cyan">{formatSourceTypeLabel(agent)}</Badge>
                            <Badge variant="violet">{formatHostingModeLabel(agent)}</Badge>
                          </div>
                          <div>
                            <h3 className="app-card-title">{agent.name}</h3>
                            {agent.description || agent.managedCapabilitySummary ? (
                              <p className="app-agent-center-card__summary">{agent.description || agent.managedCapabilitySummary}</p>
                            ) : null}
                          </div>
                          <div className="app-detail-list">
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">运行入口</span>
                              <span className="app-detail-list__value">{agent.runtimeEndpoint || agent.managedApiBaseUrl || "平台内登记"}</span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">Runtime 鉴权</span>
                              <span className="app-detail-list__value">{agent.runtimeAuthTokenPreview || "未配置"}</span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">托管 Provider</span>
                              <span className="app-detail-list__value">
                                {managedLightServiceTitleById.get(agent.managedServiceId ?? "") || agent.managedProviderLabel || "未配置"}
                              </span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">能力数 / 已发布</span>
                              <span className="app-detail-list__value">{capabilities.length} / {publishedCount}</span>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </AccountHomeSection>
              ) : null}

              {tasksVisible ? (
              <>
              <AccountHomeSection className="app-agent-center-collapsed app-agent-center-section--tasks" id="batch-dispatch">
                <details className="app-agent-center-fold app-agent-center-fold--section" open={mode === "tasks"}>
                  <summary>批量调用</summary>
                  <div className="app-agent-center-fold__body">
                    {batchInvokeListings.length === 0 ? (
                      <p className="mg-copy">暂无可调用供给</p>
                    ) : (
                      <form action={invokeAgentMarketplaceListingBatchAction} className="app-agent-center-form">
                        <input name="redirectTo" type="hidden" value={selfHref} />
                        <input name="successRedirectTo" type="hidden" value={batchSuccessRedirectTarget} />
                        <div className="app-agent-center-form__split">
                          <Input defaultValue="多 Agent 批次调用" name="title" placeholder="标题" required />
                          <Input defaultValue={1} min="1" name="meterQuantity" placeholder="统一计量数量" type="number" />
                          <Select defaultValue="baseline" name="runtimeProfileKey">
                            <option value="baseline">基线处理</option>
                            <option value="iterative">迭代处理</option>
                            <option value="deep_runtime">深度运行</option>
                          </Select>
                        </div>
                        <Textarea
                          name="objective"
                          placeholder="目标"
                          required
                          rows={4}
                        />
                        <Textarea
                          name="inputResourcePayload"
                          placeholder='共享输入资源 JSON，例如 {"prompt":"森林里的卡通小屋","size":"1096x1096"}'
                          rows={4}
                        />
                        <div className="app-agent-center-selection-grid">
                          {batchInvokeListings.map((listing) => (
                            <label className="app-agent-center-selection-card" key={`batch-${listing.id}`}>
                              <div className="app-agent-center-selection-head">
                                <input name="listingIds" type="checkbox" value={listing.id} />
                                <div className="app-agent-center-card__meta">
                                  <Badge variant={listing.ownerUserId === session.user.id ? "warning" : "success"}>
                                    {listing.ownerUserId === session.user.id ? "我的供给" : "公开供给"}
                                  </Badge>
                                  <Badge variant="cyan">{listing.capabilityCode}</Badge>
                                  <Badge variant="violet">{formatBillingModeLabel(listing)}</Badge>
                                </div>
                              </div>
                              <div>
                                <strong className="app-card-title">{listing.publicTitle}</strong>
                                {listing.publicDescription ? <p className="app-agent-center-note">{listing.publicDescription}</p> : null}
                              </div>
                              <div className="app-detail-list">
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">报价</span>
                                  <span className="app-detail-list__value">
                                    {listing.priceAmount} {formatCurrencyLabel(listing.priceCurrency)}
                                  </span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">计费单位</span>
                                  <span className="app-detail-list__value">{listing.billingUnit || "task"}</span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">路由标签</span>
                                  <span className="app-detail-list__value">{formatRoutingTagsSummary(listing.routingTags)}</span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">输入资源</span>
                                  <span className="app-detail-list__value">{formatResourceSchemaSummary(listing.inputSchema)}</span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">输出资源</span>
                                  <span className="app-detail-list__value">{formatResourceSchemaSummary(listing.outputSchema)}</span>
                                </div>
                                {listing.meterKey ? (
                                  <div className="app-detail-list__row">
                                    <span className="app-detail-list__label">属性键</span>
                                    <span className="app-detail-list__value">{listing.meterKey}</span>
                                  </div>
                                ) : null}
                              </div>
                            </label>
                          ))}
                        </div>
                        <div className="app-agent-center-inline-actions">
                          <button className="nt-btn nt-btn--secondary" type="submit">并行转发到所选 Agent</button>
                        </div>
                      </form>
                    )}
                  </div>
                </details>
              </AccountHomeSection>

              <AccountHomeSection className="app-agent-center-collapsed app-agent-center-section--tasks" id="proposal-pipeline">
                <details className="app-agent-center-fold app-agent-center-fold--section" open={mode === "tasks"}>
                  <summary>提案</summary>
                  <div className="app-agent-center-fold__body">
                    {proposalPipeline.length === 0 && autoMatchQueue.length === 0 ? (
                      <p className="mg-copy">暂无任务 / 提案</p>
                    ) : (
                      <div className="app-agent-center-cards">
                    {proposalPipeline.slice(0, 6).map((entry) => (
                      <Card className="app-agent-center-card" key={`proposal-${entry.task.id}`}>
                        <div className="app-agent-center-card__meta">
                          <Badge variant={taskStatusVariant(entry.task.status)}>{formatTaskStatusLabel(entry.task.status)}</Badge>
                          <Badge variant="warning">{`${entry.task.rewardAmount} ${formatCurrencyLabel(entry.task.rewardCurrency)}`}</Badge>
                        </div>
                        <div>
                          <h3 className="app-card-title">{entry.task.title}</h3>
                          <p className="app-agent-center-note">{entry.task.description}</p>
                        </div>
                        <div className="app-detail-list">
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">偏好能力</span>
                            <span className="app-detail-list__value">
                              {entry.task.preferredCapabilityCodes.length > 0
                                ? entry.task.preferredCapabilityCodes.join(", ")
                                : "未指定"}
                            </span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">提案数量</span>
                            <span className="app-detail-list__value">{entry.proposals.length}</span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">发布时间</span>
                            <span className="app-detail-list__value">{formatAccountDateTime(entry.task.createdAt)}</span>
                          </div>
                        </div>
                        <div className="app-agent-center-proposal-list">
                          {entry.proposals.map((proposal) => (
                            <div className="app-agent-center-proposal-pill" key={proposal.id}>
                              <div className="app-agent-center-card__meta">
                                <Badge variant={proposalStatusVariant(proposal.status)}>{proposal.status}</Badge>
                                <Badge variant="cyan">{`${proposal.proposedEtaHours}h`}</Badge>
                              </div>
                              <p className="app-agent-center-note">{proposal.statement}</p>
                              <p className="app-agent-center-note">
                                匹配能力：
                                {proposal.matchedCapabilityCodes.length > 0
                                  ? ` ${proposal.matchedCapabilityCodes.join(", ")}`
                                  : ` ${proposal.matchedCapabilityCount} 项`}
                              </p>
                              <div className="app-agent-center-inline-actions">
                                <Link className="nt-btn nt-btn--glass" href={buildTaskDetailHref(entry.task.id)} target={topNavTarget}>查看任务板</Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                    {autoMatchQueue.map((entry) => (
                      <Card className="app-agent-center-card" key={`queue-${entry.task.id}`}>
                        <div className="app-agent-center-card__meta">
                          <Badge variant="warning">待扫任务</Badge>
                          <Badge variant={entry.rewardMeetsQuote ? "success" : "danger"}>
                            {entry.rewardMeetsQuote ? "报价满足" : "报价不足"}
                          </Badge>
                        </div>
                        <div>
                          <h3 className="app-card-title">{entry.task.title}</h3>
                          <p className="app-agent-center-note">{entry.task.description}</p>
                        </div>
                        <div className="app-detail-list">
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">任务奖励</span>
                            <span className="app-detail-list__value">
                              {entry.task.rewardAmount} {formatCurrencyLabel(entry.task.rewardCurrency)}
                            </span>
                          </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">匹配供给</span>
                              <span className="app-detail-list__value">
                                {entry.matchingListings.map((entry) => entry.listing.capabilityCode).join(", ")}
                              </span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">匹配标签</span>
                              <span className="app-detail-list__value">
                                {entry.matchingListings
                                  .flatMap((entry) => entry.pricingMatch.routeMatch.matchedKeywords)
                                  .slice(0, 6)
                                  .join(", ") || "未命中"}
                              </span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">匹配范围</span>
                              <span className="app-detail-list__value">{formatTaskMatchScope(entry.task)}</span>
                            </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">计费口径</span>
                            <span className="app-detail-list__value">
                              {entry.task.pricingMode === "property_metered"
                                ? `${entry.task.meterKey || "task_units"} / ${entry.task.billingUnit || "task_property"}`
                                : entry.task.pricingMode === "token_metered"
                                  ? entry.task.billingUnit || "1k_tokens"
                                  : entry.task.billingUnit || "task"}
                            </span>
                          </div>
                        </div>
                        <div className="app-agent-center-match-list">
                          {entry.matchingListings.slice(0, 4).map((matchEntry) => (
                            <div className="app-agent-center-match-card" key={`${entry.task.id}-${matchEntry.listing.id}`}>
                              <div className="app-agent-center-card__meta">
                                <Badge variant={matchEntry.pricingMatch.match ? "success" : "danger"}>
                                  {matchEntry.pricingMatch.match ? "可提案" : "未达报价"}
                                </Badge>
                                <Badge variant="cyan">{matchEntry.listing.publicTitle}</Badge>
                              </div>
                                <p className="app-agent-center-note">
                                  {matchEntry.listing.capabilityCode} / {formatBillingModeLabel(matchEntry.listing)}
                                </p>
                                <p className="app-agent-center-note">
                                  路由标签：{formatRoutingTagsSummary(matchEntry.listing.routingTags)}
                                </p>
                                <p className="app-agent-center-note">
                                  预估报价：
                                  {matchEntry.pricingMatch.quotedAmount ?? matchEntry.listing.priceAmount}{" "}
                                  {formatCurrencyLabel(matchEntry.listing.priceCurrency)}
                                </p>
                            </div>
                          ))}
                        </div>
                        <div className="app-agent-center-inline-actions">
                          <Link className="nt-btn nt-btn--glass" href={buildTaskDetailHref(entry.task.id)} target={topNavTarget}>查看任务板</Link>
                          <form action={runAgentMarketplaceAutoProposalSweepAction}>
                            <input name="redirectTo" type="hidden" value={sweepRedirectTarget} />
                            <input name="limit" type="hidden" value="20" />
                            <button className="nt-btn nt-btn--outline" type="submit">立即扫描</button>
                          </form>
                        </div>
                      </Card>
                    ))}
                      </div>
                    )}
                  </div>
                </details>
              </AccountHomeSection>

              <AccountHomeSection className="app-agent-center-collapsed app-agent-center-section--tasks" id="public-offers">
                <details className="app-agent-center-fold app-agent-center-fold--section" open={mode === "tasks"}>
                  <summary>公开供给</summary>
                  <div className="app-agent-center-fold__body">
                    {supplierExecutions.length > 0 ? (
                      <div className="app-agent-center-supplier-strip">
                    {supplierExecutions.map((execution) => (
                      <Card className="app-agent-center-card" key={`supplier-${execution.id}`}>
                        <div className="app-agent-center-card__meta">
                          <Badge variant="warning">已受理调用</Badge>
                          <Badge variant="cyan">{execution.status}</Badge>
                          {execution.marketplaceInvocation ? (
                            <Badge variant="violet">{execution.marketplaceInvocation.billingMode}</Badge>
                          ) : null}
                        </div>
                        <div>
                          <h3 className="app-card-title">
                            {execution.marketplaceInvocation?.publicTitle || execution.title}
                          </h3>
                          <p className="app-agent-center-note">{execution.resultSummary || execution.statusNote || execution.objective}</p>
                        </div>
                        <div className="app-detail-list">
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">请求方</span>
                            <span className="app-detail-list__value">
                              {formatSupplierExecutionRequester(execution, session.user.id)}
                            </span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">计费快照</span>
                            <span className="app-detail-list__value">
                              {execution.marketplaceInvocation
                                ? `${execution.marketplaceInvocation.quotedAmount} ${formatCurrencyLabel(execution.marketplaceInvocation.priceCurrency)}`
                                : "无"}
                            </span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">受理时间</span>
                            <span className="app-detail-list__value">
                              {execution.marketplaceInvocation
                                ? formatAccountDateTime(execution.marketplaceInvocation.invokedAt)
                                : formatAccountDateTime(execution.createdAt)}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                      </div>
                    ) : null}
                    {publicFeed.length === 0 ? (
                      <p className="mg-copy">暂无公开供给</p>
                    ) : (
                      <div className="app-agent-center-cards">
                    {publicFeed.map((listing) => (
                      <Card className="app-agent-center-public-card" key={listing.id}>
                        <div className="app-agent-center-card__meta">
                          <Badge variant="success">{formatListingStatusLabel(listing.status)}</Badge>
                          <Badge variant="cyan">{listing.capabilityCode}</Badge>
                          {listing.autoTakeEnabled ? <Badge variant="warning">自动 proposal</Badge> : null}
                        </div>
                        <div>
                          <h3 className="app-card-title">{listing.publicTitle}</h3>
                          {listing.publicDescription ? <p className="app-agent-center-card__summary">{listing.publicDescription}</p> : null}
                        </div>
                        <div className="app-detail-list">
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">提供者</span>
                            <span className="app-detail-list__value">{listing.agentName}</span>
                          </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">路由描述</span>
                              <span className="app-detail-list__value">{listing.routingSummary || "未定义"}</span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">路由标签</span>
                              <span className="app-detail-list__value">{formatRoutingTagsSummary(listing.routingTags)}</span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">报价</span>
                              <span className="app-detail-list__value">{listing.priceAmount} {formatCurrencyLabel(listing.priceCurrency)}</span>
                            </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">输入资源</span>
                            <span className="app-detail-list__value">{formatResourceSchemaSummary(listing.inputSchema)}</span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">输出资源</span>
                            <span className="app-detail-list__value">{formatResourceSchemaSummary(listing.outputSchema)}</span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">计费方式</span>
                            <span className="app-detail-list__value">{formatBillingModeLabel(listing)}</span>
                          </div>
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">计费单位</span>
                            <span className="app-detail-list__value">{listing.billingUnit || "task"}</span>
                          </div>
                          {listing.meterKey ? (
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">属性键</span>
                              <span className="app-detail-list__value">{listing.meterKey}</span>
                            </div>
                          ) : null}
                          <div className="app-detail-list__row">
                            <span className="app-detail-list__label">直接调用</span>
                            <span className="app-detail-list__value">{listing.externalInvocationEnabled ? "已开放" : "仅任务模式"}</span>
                          </div>
                        </div>
                        {listing.externalInvocationEnabled ? (
                          <form action={invokeAgentMarketplaceListingAction} className="app-agent-center-form app-agent-center-form--compact">
                            <input name="redirectTo" type="hidden" value={selfHref} />
                            <input name="listingId" type="hidden" value={listing.id} />
                            <Input defaultValue={`直连调用 · ${listing.publicTitle}`} name="title" placeholder="执行标题" required />
                            <div className="app-agent-center-form__split">
                              {listing.billingMode !== "flat_task" ? (
                                <Input
                                  defaultValue={1}
                                  min="1"
                                  name="meterQuantity"
                                  placeholder={
                                    listing.billingMode === "token_metered"
                                      ? `起始计量值，如 ${listing.billingUnit || "1k_tokens"}`
                                      : `属性数量，如 ${listing.meterKey || listing.billingUnit || "durationSeconds"}`
                                  }
                                  type="number"
                                />
                              ) : null}
                              <Select defaultValue="baseline" name="runtimeProfileKey">
                                <option value="baseline">基线处理</option>
                                <option value="iterative">迭代处理</option>
                                <option value="deep_runtime">深度运行</option>
                              </Select>
                            </div>
                            <Textarea
                              name="objective"
                              placeholder="目标"
                              required
                              rows={4}
                            />
                            <Textarea
                              name="inputResourcePayload"
                              placeholder='输入资源 JSON，例如 {"prompt":"森林里的卡通小屋","size":"1096x1096"}'
                              rows={4}
                            />
                            <div className="app-agent-center-inline-actions">
                              <button className="nt-btn nt-btn--primary" type="submit">直接调用</button>
                              <Link className="nt-btn nt-btn--outline" href={buildTaskSeedHref(listing)} target={topNavTarget}>按此报价发任务</Link>
                            </div>
                          </form>
                        ) : (
                            <div className="app-agent-center-inline-actions">
                              <Link className="nt-btn nt-btn--primary" href={buildTaskSeedHref(listing)} target={topNavTarget}>按此报价发任务</Link>
                              <Link className="nt-btn nt-btn--glass" href="/tasks" target={topNavTarget}>进入集会</Link>
                            </div>
                        )}
                      </Card>
                    ))}
                      </div>
                    )}
                  </div>
                </details>
              </AccountHomeSection>
              </>
              ) : null}
            </div>

                </div>
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
