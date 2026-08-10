import Link from "next/link";
import { redirect } from "next/navigation";
import type {
  AgentCapabilityView,
  AgentMarketplaceListingView,
  AgentView,
  ProductCurrency,
  TaskAgentProposalView,
  TaskView,
} from "@neuro/contracts";

import { auth } from "@/auth";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { formatAccountDateTime, formatAccountNumber } from "@/lib/account-center";
import { getTaskRouteMatch, normalizeRouteKeywords } from "@/lib/agent-market-routing";
import { cn } from "@/lib/cn";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";
import {
  acceptTaskAgentProposalAction,
  applyTaskAction,
  createTaskAgentProposalAction,
  dispatchTaskAction,
  invokeAgentMarketplaceListingAction,
  rejectTaskAgentProposalAction,
  taskLifecycleAction,
  updateAgentMarketplaceListingStatusAction,
  upsertAgentMarketplaceListingAction,
} from "@/lib/platform-actions";

import { buildTaskMarketHref } from "./routes";
import { loadTaskMarketServerState } from "./server";
import { TaskPublishDialog } from "./task-publish-dialog";

type Panel = "publish" | "market";
type MarketTab = "request" | "buy" | "sell" | "take";
type MarketMode = "tasks" | "sell";
type MarketCurrency = "obsidian" | "mira";
type PriceTab = "flat" | "metered";
type Composer = "request" | "sell" | null;
type Tone = "glass" | "cyan" | "violet" | "success" | "warning" | "danger";

type CapabilityMarketEntry = {
  agent: AgentView;
  capability: AgentCapabilityView;
  listing: AgentMarketplaceListingView | null;
};

type PageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
      <path d="M6.5 6.5l11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg aria-hidden="true" className="app-task-market-rail__mark-icon" viewBox="0 0 24 24">
      <path d="M5 8.5h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7 8.5V6.8a5 5 0 0 1 10 0v1.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M6.4 8.5l.9 8.7a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.9-8.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function toneClass(tone: Tone) {
  return cn(
    "nt-chip",
    tone === "glass" && "nt-chip--glass",
    tone === "cyan" && "nt-chip--cyan",
    tone === "violet" && "nt-chip--violet",
    tone === "success" && "nt-chip--success",
    tone === "warning" && "nt-chip--warning",
    tone === "danger" && "nt-chip--danger",
  );
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function resolvePanel(value?: string): Panel {
  return value === "capability" || value === "market" ? "market" : "publish";
}

function resolveTab(value: string | undefined, panel: Panel): MarketTab {
  if (value === "request" || value === "buy" || value === "sell" || value === "take") {
    return value;
  }
  return panel === "market" ? "buy" : "request";
}

function resolveMode(value: string | undefined, legacyTab: MarketTab): MarketMode {
  if (value === "sell") {
    return "sell";
  }
  if (value === "tasks" || value === "buy") {
    return "tasks";
  }
  if (legacyTab === "sell" || legacyTab === "buy") {
    return "sell";
  }
  return "tasks";
}

function resolveMarketCurrency(value?: string): MarketCurrency {
  return value === "mira" ? "mira" : "obsidian";
}

function resolvePriceTab(value?: string): PriceTab {
  return value === "metered" ? "metered" : "flat";
}

function resolveComposer(value: string | undefined, legacyTab: MarketTab, hasExplicitLegacyTab: boolean): Composer {
  if (value === "request" || value === "sell") {
    return value;
  }
  if (hasExplicitLegacyTab) {
    if (legacyTab === "request") return "request";
    if (legacyTab === "sell") return "sell";
  }
  return null;
}

function parsePositiveNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolvePricingModeSeed(value?: string): TaskView["pricingMode"] | null {
  return value === "token_metered" || value === "property_metered" || value === "flat_task" ? value : null;
}

function resolveRewardCurrencySeed(value?: string): ProductCurrency | null {
  return value === "mira" || value === "obsidian" ? value : null;
}

function normalizeSearchText(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function matchesSearch(query: string, values: Array<string | null | undefined>) {
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

function matchesListingPriceTab(listing: AgentMarketplaceListingView, priceTab: PriceTab) {
  if (priceTab === "flat") return listing.billingMode === "flat_task";
  return listing.billingMode !== "flat_task";
}

function matchesTaskPriceTab(task: TaskView, priceTab: PriceTab) {
  if (priceTab === "flat") return task.pricingMode === "flat_task";
  return task.pricingMode !== "flat_task";
}

function money(currency: ProductCurrency) {
  return currency === "mira" ? "米拉" : "曜晶";
}

function taskStatus(status: TaskView["status"]) {
  return (
    {
      draft: "草稿",
      open: "开放中",
      applying: "申请中",
      assigned: "已分配",
      in_progress: "执行中",
      submitted: "待验收",
      accepted: "已完成",
      rejected: "已退回",
      cancelled: "已取消",
      defaulted: "已违约",
    }[status] ?? status
  );
}

function taskTone(status: TaskView["status"]): Tone {
  if (status === "accepted") return "success";
  if (status === "assigned" || status === "in_progress" || status === "submitted") return "cyan";
  if (status === "applying") return "warning";
  if (status === "rejected" || status === "cancelled" || status === "defaulted") return "danger";
  return "violet";
}

function proposalTone(status: TaskAgentProposalView["status"]): Tone {
  return status === "accepted" ? "success" : status === "rejected" ? "danger" : "warning";
}

function formatProposalStatusLabel(status: TaskAgentProposalView["status"]) {
  if (status === "accepted") return "已接受";
  if (status === "rejected") return "已拒绝";
  return "待处理";
}

function listingStatusLabel(status: AgentMarketplaceListingView["status"] | null | undefined) {
  if (status === "published") return "已上架";
  if (status === "paused") return "已暂停";
  if (status === "draft") return "草稿";
  return "未上架";
}

function listingStatusTone(status: AgentMarketplaceListingView["status"] | null | undefined): Tone {
  if (status === "published") return "success";
  if (status === "paused") return "warning";
  return "glass";
}

function hostingModeLabel(agent: AgentView) {
  if (agent.hostingMode === "managed_heavy") return "重度智能体";
  if (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime") return "云端智能体";
  if (agent.hostingMode === "registry_only") return "轻度草稿";
  return "轻度智能体";
}

function formatBillingUnitLabel(value: string | null | undefined, fallback: "task" | "token" | "property") {
  const normalized = value?.trim() || fallback;
  if (normalized === "task") return "单个任务";
  if (normalized === "1k_tokens") return "千 Token";
  if (normalized === "task_units") return "任务属性";
  if (normalized === "task_property") return "单项属性";
  if (normalized === "durationSeconds") return "时长秒数";
  return normalized;
}

function formatMeterKeyLabel(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "任务属性";
  if (normalized === "task_units") return "任务属性";
  if (normalized === "durationSeconds") return "时长秒数";
  return normalized;
}

function pricingLabel(task: Pick<TaskView, "pricingMode" | "billingUnit" | "meterKey">) {
  if (task.pricingMode === "token_metered") return `按 Token / ${formatBillingUnitLabel(task.billingUnit, "token")}`;
  if (task.pricingMode === "property_metered") return `按属性 / ${task.meterKey ? formatMeterKeyLabel(task.meterKey) : formatBillingUnitLabel(task.billingUnit, "property")}`;
  return "一口价";
}

function billingLabel(listing: AgentMarketplaceListingView) {
  if (listing.billingMode === "token_metered") return `按 Token / ${formatBillingUnitLabel(listing.billingUnit, "token")}`;
  if (listing.billingMode === "property_metered") {
    return `按属性 / ${listing.meterKey ? formatMeterKeyLabel(listing.meterKey) : formatBillingUnitLabel(listing.billingUnit, "property")}`;
  }
  return `按任务 / ${formatBillingUnitLabel(listing.billingUnit, "task")}`;
}

function routeSummary(tags: string[] | null | undefined) {
  const normalized = normalizeRouteKeywords(tags);
  return normalized.length ? normalized.join(" / ") : "未标记";
}

function seedTaskHref(listing: AgentMarketplaceListingView) {
  return `${buildTaskMarketHref({
    panel: "publish",
    tab: "request",
    mode: "tasks",
    marketCurrency: listing.priceCurrency === "mira" ? "mira" : "obsidian",
    priceTab: listing.billingMode === "flat_task" ? "flat" : "metered",
    composer: "request",
    capabilityId: listing.capabilityId,
    listingId: listing.id,
    capabilityCode: listing.capabilityCode,
    preferredCapabilityCodes: listing.capabilityCode,
    title: `委托 ${listing.publicTitle}`,
    description: listing.publicDescription || `${listing.agentName} / ${listing.capabilityTitle}`,
    pricingMode:
      listing.billingMode === "property_metered"
        ? "property_metered"
        : listing.billingMode === "token_metered"
          ? "token_metered"
          : "flat_task",
    operationMode: listing.autoTakeEnabled ? "automatic" : "manual",
    billingUnit: listing.billingUnit,
    meterKey: listing.meterKey,
    meterQuantity: 1,
    rewardCurrency: listing.priceCurrency === "mira" ? "mira" : "obsidian",
    rewardAmount: listing.priceAmount,
  })}#request-lane`;
}

function getQuotedAmount(task: TaskView, listing: AgentMarketplaceListingView) {
  const routeMatch = getTaskRouteMatch(task, {
    code: listing.capabilityCode,
    title: listing.capabilityTitle,
    routingSummary: listing.routingSummary,
    routingTags: listing.routingTags,
    publicTitle: listing.publicTitle,
    publicDescription: listing.publicDescription,
  });
  if (!routeMatch.accepted || task.rewardCurrency !== listing.priceCurrency) {
    return { accepted: false, routeMatch, quotedAmount: null as number | null };
  }
  if (task.pricingMode === "flat_task" && listing.billingMode === "flat_task") {
    return { accepted: true, routeMatch, quotedAmount: listing.priceAmount };
  }
  if (task.pricingMode === "token_metered" && listing.billingMode === "token_metered") {
    if ((task.billingUnit || "1k_tokens").toLowerCase() !== (listing.billingUnit || "1k_tokens").toLowerCase()) {
      return { accepted: false, routeMatch, quotedAmount: null as number | null };
    }
    return {
      accepted: true,
      routeMatch,
      quotedAmount: Math.max(1, Number(task.meterQuantity || 1) * listing.priceAmount),
    };
  }
  if (task.pricingMode === "property_metered" && listing.billingMode === "property_metered") {
    if ((task.meterKey || "task_units").toLowerCase() !== (listing.meterKey || "task_units").toLowerCase()) {
      return { accepted: false, routeMatch, quotedAmount: null as number | null };
    }
    if ((task.billingUnit || "task_property").toLowerCase() !== (listing.billingUnit || "task_property").toLowerCase()) {
      return { accepted: false, routeMatch, quotedAmount: null as number | null };
    }
    return {
      accepted: true,
      routeMatch,
      quotedAmount: Math.max(1, Number(task.meterQuantity || 1) * listing.priceAmount),
    };
  }
  return { accepted: false, routeMatch, quotedAmount: null as number | null };
}

export default async function TaskMarketPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const publicSurfaceDependency = await loadPublicSurfaceDependency();
  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "tasks", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const panel = resolvePanel(params.panel);
  const legacyTab = resolveTab(params.tab, panel);
  const mode = resolveMode(params.mode, legacyTab);
  const marketCurrency = resolveMarketCurrency(params.marketCurrency);
  const priceTab = resolvePriceTab(params.priceTab);
  const composer = resolveComposer(params.composer, legacyTab, Boolean(params.tab?.trim()));
  const searchQuery = params.query?.trim() || "";
  const normalizedQuery = normalizeSearchText(params.query);
  const selectedTaskId = params.taskId?.trim() || null;
  const executionId = params.executionId?.trim() || null;
  const requestedCapabilityId = params.capabilityId?.trim() || null;
  const selectedListingId = params.listingId?.trim() || null;
  const seededPricingMode = resolvePricingModeSeed(params.pricingMode);
  const seededRewardCurrency = resolveRewardCurrencySeed(params.rewardCurrency);
  const seededRewardAmount = parsePositiveNumber(params.rewardAmount);

  const userContext = { userId: session.user.id, username: session.user.username };
  const state = await loadTaskMarketServerState(userContext);

  if (!state.features.taskHub.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell app-stack">
          <section className="nt-panel nt-task-market-empty">
            <h1 className="mg-title">任务集市当前未开放</h1>
            <p className="mg-copy">请返回控制台，或联系运营团队确认当前环境的开放范围。</p>
          </section>
        </div>
      </main>
    );
  }

  const allTasks = [...state.tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myCreatedTasks = allTasks.filter((task) => task.creatorUserId === session.user.id);
  const myAssignedTasks = allTasks.filter((task) => task.assignedUserId === session.user.id);
  const publishedOwnedListings = state.ownedListings.filter((listing) => listing.status === "published");
  const ownedListingByCapabilityId = new Map(state.ownedListings.map((listing) => [listing.capabilityId, listing] as const));
  const combinedListings = [...state.ownedListings, ...state.publicListings];
  const selectedListing = selectedListingId ? combinedListings.find((listing) => listing.id === selectedListingId) ?? null : null;

  const ownedCapabilityEntries: CapabilityMarketEntry[] = state.ownedAgents
    .flatMap((agent) =>
      (state.capabilitiesByAgentId.get(agent.id) ?? []).map((capability) => ({
        agent,
        capability,
        listing: ownedListingByCapabilityId.get(capability.id) ?? null,
      })),
    )
    .sort((left, right) => {
      const leftScore = left.listing ? (left.listing.status === "published" ? 2 : 1) : 0;
      const rightScore = right.listing ? (right.listing.status === "published" ? 2 : 1) : 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return left.capability.title.localeCompare(right.capability.title, "zh-CN");
    });

  const selectedCapabilityEntry =
    (requestedCapabilityId
      ? ownedCapabilityEntries.find((entry) => entry.capability.id === requestedCapabilityId)
      : null) ??
    (selectedListing?.ownerUserId === session.user.id
      ? ownedCapabilityEntries.find((entry) => entry.capability.id === selectedListing.capabilityId)
      : null) ??
    ownedCapabilityEntries[0] ??
    null;

  const selectedOwnedListing = selectedCapabilityEntry?.listing ?? null;
  const publicListings = dedupeById(
    selectedListing && selectedListing.ownerUserId !== session.user.id ? [selectedListing, ...state.publicListings] : state.publicListings,
  ).filter((listing) => listing.ownerUserId !== session.user.id && listing.status === "published");
  const filteredPublicListings = publicListings.filter(
    (listing) =>
      listing.priceCurrency === marketCurrency &&
      matchesListingPriceTab(listing, priceTab) &&
      matchesSearch(normalizedQuery, [
        listing.publicTitle,
        listing.publicDescription,
        listing.capabilityTitle,
        listing.capabilityCode,
        listing.agentName,
        listing.routingSummary,
        listing.routingTags?.join(" "),
      ]),
  );
  const filteredOwnedCapabilityEntries = ownedCapabilityEntries.filter(
    (entry) =>
      (entry.listing?.priceCurrency ?? "obsidian") === marketCurrency &&
      matchesListingPriceTab(
        entry.listing ?? {
          billingMode: "flat_task",
        } as AgentMarketplaceListingView,
        priceTab,
      ) &&
      matchesSearch(normalizedQuery, [
        entry.capability.title,
        entry.capability.description,
        entry.capability.code,
        entry.capability.routingSummary,
        entry.capability.routingTags?.join(" "),
        entry.agent.name,
        entry.listing?.publicTitle,
        entry.listing?.publicDescription,
      ]),
  );

  const taskBoard = dedupeById(selectedTaskId ? allTasks.filter((task) => task.id === selectedTaskId).concat(allTasks) : allTasks).filter(
    (task) => task.status === "open" || task.status === "applying" || task.creatorUserId === session.user.id,
  );
  const filteredTaskBoard = taskBoard.filter(
    (task) =>
      task.rewardCurrency === marketCurrency &&
      matchesTaskPriceTab(task, priceTab) &&
      matchesSearch(normalizedQuery, [
        task.title,
        task.description,
        task.preferredCapabilityCodes.join(" "),
      ]),
  );

  const proposalReviewCount = myCreatedTasks.reduce(
    (count, task) => count + (state.taskProposalsMap.get(task.id) || []).filter((proposal) => proposal.status === "pending").length,
    0,
  );
  const currentHref = buildTaskMarketHref({
    mode,
    marketCurrency,
    priceTab,
    query: searchQuery || null,
    composer: null,
    taskId: selectedTaskId,
    listingId: selectedListing?.id ?? selectedOwnedListing?.id ?? null,
    capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
    executionId,
  });

  const requestRedirectTo = `${buildTaskMarketHref({
    panel: "publish",
    tab: "request",
    mode: "tasks",
    marketCurrency,
    priceTab,
    query: searchQuery || null,
    capabilityId: selectedCapabilityEntry?.capability.id ?? null,
    listingId: selectedListing?.id ?? null,
  })}#task-list`;
  const supplyRedirectTo = `${buildTaskMarketHref({
    panel: "market",
    tab: "sell",
    mode: "sell",
    marketCurrency,
    priceTab,
    query: searchQuery || null,
    composer: "sell",
    capabilityId: selectedCapabilityEntry?.capability.id ?? null,
    listingId: selectedOwnedListing?.id ?? null,
  })}#supply-studio`;
  const modeLinks = {
    tasks: buildTaskMarketHref({
      mode: "tasks",
      marketCurrency,
      priceTab,
      query: searchQuery || null,
      composer: null,
      taskId: selectedTaskId,
      listingId: selectedListing?.id ?? null,
      capabilityId: requestedCapabilityId,
      executionId,
    }),
    sell: buildTaskMarketHref({
      mode: "sell",
      marketCurrency,
      priceTab,
      query: searchQuery || null,
      composer: null,
      taskId: selectedTaskId,
      listingId: selectedOwnedListing?.id ?? selectedListing?.id ?? null,
      capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
      executionId,
    }),
  };
  const currencyLinks = {
    obsidian: buildTaskMarketHref({
      mode,
      marketCurrency: "obsidian",
      priceTab,
      query: searchQuery || null,
      composer: null,
      taskId: selectedTaskId,
      listingId: selectedListing?.id ?? selectedOwnedListing?.id ?? null,
      capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
      executionId,
    }),
    mira: buildTaskMarketHref({
      mode,
      marketCurrency: "mira",
      priceTab,
      query: searchQuery || null,
      composer: null,
      taskId: selectedTaskId,
      listingId: selectedListing?.id ?? selectedOwnedListing?.id ?? null,
      capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
      executionId,
    }),
  };
  const priceTabLinks = {
    flat: buildTaskMarketHref({
      mode,
      marketCurrency,
      priceTab: "flat",
      query: searchQuery || null,
      composer: null,
      taskId: selectedTaskId,
      listingId: selectedListing?.id ?? selectedOwnedListing?.id ?? null,
      capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
      executionId,
    }),
    metered: buildTaskMarketHref({
      mode,
      marketCurrency,
      priceTab: "metered",
      query: searchQuery || null,
      composer: null,
      taskId: selectedTaskId,
      listingId: selectedListing?.id ?? selectedOwnedListing?.id ?? null,
      capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
      executionId,
    }),
  };
  const composerToggleHref =
    mode === "tasks"
      ? buildTaskMarketHref({
          mode,
          marketCurrency,
          priceTab,
          query: searchQuery || null,
          composer: composer === "request" ? null : "request",
          taskId: selectedTaskId,
          listingId: selectedListing?.id ?? null,
          capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
          executionId,
          capabilityCode: params.capabilityCode?.trim() || null,
          preferredCapabilityCodes: params.preferredCapabilityCodes?.trim() || null,
          title: params.title?.trim() || null,
          description: params.description?.trim() || null,
          pricingMode: seededPricingMode,
          rewardCurrency: seededRewardCurrency,
          rewardAmount: seededRewardAmount,
        })
      : buildTaskMarketHref({
          mode,
          marketCurrency,
          priceTab,
          query: searchQuery || null,
          composer: composer === "sell" ? null : "sell",
          taskId: selectedTaskId,
          listingId: selectedOwnedListing?.id ?? null,
          capabilityId: selectedCapabilityEntry?.capability.id ?? requestedCapabilityId,
          executionId,
        });

  return (
    <main className="app-page">
      <div aria-label="集市 / 任务与能力中心" aria-modal="true" className="app-honor-overlay app-task-market-overlay" role="dialog">
        <Link aria-label="返回控制台" className="app-honor-backdrop" href="/dashboard" />
        {(params.message || state.proposalReadWarning) ? (
          <div aria-atomic="true" aria-live="polite" className="app-toast-stack">
            {params.message ? (
              <section className={`app-toast app-toast--${params.status === "success" ? "success" : "error"}`} role="status">
                <div className="app-toast__signal" aria-hidden="true" />
                <div className="app-toast__body">
                  <strong className="app-toast__title">{params.status === "success" ? "操作完成" : "操作失败"}</strong>
                  <p className="app-toast__message">{params.message}</p>
                </div>
                <Link aria-label="关闭提示" className="app-toast__close" href={currentHref}>
                  ×
                </Link>
              </section>
            ) : null}
            {state.proposalReadWarning ? (
              <section className="app-toast app-toast--warning" role="status">
                <div className="app-toast__signal" aria-hidden="true" />
                <div className="app-toast__body">
                  <strong className="app-toast__title">提示</strong>
                  <p className="app-toast__message">{state.proposalReadWarning}</p>
                </div>
                <Link aria-label="关闭提示" className="app-toast__close" href={currentHref}>
                  ×
                </Link>
              </section>
            ) : null}
          </div>
        ) : null}
        <div className="app-task-market-dialog">
          <section className="app-task-market-shell">
            <div className="app-task-market-layout">
              <aside className="app-task-market-rail">
                <div className="app-task-market-rail__head">
                  <span className="app-task-market-rail__mark" aria-hidden="true">
                    <MarketIcon />
                  </span>
                  <div className="app-task-market-rail__copy">
                    <h1 className="mg-title">集市</h1>
                  </div>
                </div>

                <div className="app-task-market-rail__modes">
                  <Link
                    className={cn("app-task-market-rail__mode", mode === "tasks" && "app-task-market-rail__mode--active")}
                    href={modeLinks.tasks}
                  >
                    任务列表
                  </Link>
                  <Link
                    className={cn("app-task-market-rail__mode", mode === "sell" && "app-task-market-rail__mode--active")}
                    href={modeLinks.sell}
                  >
                    出售
                  </Link>
                </div>

                <div className="app-task-market-rail__markets">
                  <Link
                    className={cn("app-task-market-rail__market", marketCurrency === "obsidian" && "app-task-market-rail__market--active")}
                    href={currencyLinks.obsidian}
                  >
                    <strong>曜晶市场</strong>
                    <span>{formatAccountNumber(mode === "tasks" ? filteredTaskBoard.length : filteredPublicListings.length)}</span>
                  </Link>
                  <Link
                    className={cn("app-task-market-rail__market", marketCurrency === "mira" && "app-task-market-rail__market--active")}
                    href={currencyLinks.mira}
                  >
                    <strong>米拉市场</strong>
                    <span>{formatAccountNumber(mode === "tasks" ? filteredTaskBoard.length : filteredPublicListings.length)}</span>
                  </Link>
                </div>

                <div className="app-task-market-rail__stats">
                  <div className="app-task-market-rail__stat">
                    <span>我的在售能力</span>
                    <strong>{formatAccountNumber(publishedOwnedListings.length)}</strong>
                  </div>
                  <div className="app-task-market-rail__stat">
                    <span>待处理提案</span>
                    <strong>{formatAccountNumber(proposalReviewCount)}</strong>
                  </div>
                </div>
              </aside>

              <div className="app-task-market-main">
                <Link aria-label="关闭集市面板" className="app-honor-close app-task-market-close" href="/dashboard">
                  <CloseIcon />
                </Link>

                <header className="app-task-market-board-head">
                  <div className="app-task-market-board-toolbar">
                    <div className="app-task-market-board-tabs" role="tablist" aria-label="价格类型">
                      <Link
                        aria-selected={priceTab === "flat"}
                        className={cn("app-task-market-board-tab", priceTab === "flat" && "app-task-market-board-tab--active")}
                        href={priceTabLinks.flat}
                        role="tab"
                      >
                        任务一口价
                      </Link>
                      <Link
                        aria-selected={priceTab === "metered"}
                        className={cn("app-task-market-board-tab", priceTab === "metered" && "app-task-market-board-tab--active")}
                        href={priceTabLinks.metered}
                        role="tab"
                      >
                        token量
                      </Link>
                    </div>

                    <div className="app-task-market-board-toolbar__actions">
                      <form className="app-task-market-search" method="get">
                        <input name="mode" type="hidden" value={mode} />
                        <input name="marketCurrency" type="hidden" value={marketCurrency} />
                        <input name="priceTab" type="hidden" value={priceTab} />
                        {composer ? <input name="composer" type="hidden" value={composer} /> : null}
                        <input className="nt-input" defaultValue={searchQuery} name="query" />
                        <button className="nt-btn nt-btn--glass" type="submit">
                          搜索
                        </button>
                      </form>
                      {mode === "tasks" ? (
                        <TaskPublishDialog
                          defaultCapabilityCode={
                            params.preferredCapabilityCodes?.trim() ||
                            params.capabilityCode?.trim() ||
                            selectedListing?.capabilityCode ||
                            null
                          }
                          defaultDescription={params.description?.trim() || selectedListing?.publicDescription || ""}
                          defaultPricingMode={seededPricingMode === "token_metered" ? "token_metered" : "flat_task"}
                          defaultRewardAmount={seededRewardAmount || selectedListing?.priceAmount || 300}
                          defaultRewardCurrency={seededRewardCurrency || (selectedListing?.priceCurrency === "mira" ? "mira" : "obsidian")}
                          defaultTitle={params.title?.trim() || (selectedListing ? `委托 ${selectedListing.publicTitle}` : "")}
                          initialOpen={composer === "request"}
                          redirectTo={requestRedirectTo}
                          triggerLabel="发布任务"
                        />
                      ) : (
                        <Link className="nt-btn nt-btn--primary" href={composerToggleHref}>
                          {composer === "sell" ? "收起出售" : "出售"}
                        </Link>
                      )}
                    </div>
                  </div>
                </header>

                <div className={cn("app-task-market-grid", `app-task-market-grid--${mode}`)}>
              {mode === "sell" ? (
              <section className="nt-panel nt-task-market-section-card nt-task-market-section-card--focus" id="ability-market">
                <div className="nt-task-market-section-head">
                  <div className="nt-task-market-section-copy">
                    <h2>出售列表</h2>
                  </div>
                  <span className={toneClass("glass")}>{formatAccountNumber(filteredPublicListings.length)} 项</span>
                </div>

                {filteredPublicListings.length === 0 ? (
                  <div className="nt-task-market-empty-state">
                    <strong>暂无商品</strong>
                  </div>
                ) : (
                  <div className="nt-task-market-listing-grid">
                    {filteredPublicListings.map((listing) => {
                      const marketHref = `${buildTaskMarketHref({
                        panel: "market",
                        tab: "buy",
                        mode: "sell",
                        marketCurrency,
                        priceTab,
                        query: searchQuery || null,
                        listingId: listing.id,
                      })}#ability-market`;
                      return (
                        <article
                          className={cn("nt-task-market-listing-card", selectedListing?.id === listing.id && "nt-task-market-task-card--focused")}
                          key={listing.id}
                        >
                          <div className="nt-task-market-card-head">
                            <div className="nt-task-market-card-copy">
                              <div className="nt-task-market-card-chips">
                                <span className={toneClass("cyan")}>{listing.capabilityCode}</span>
                                <span className={toneClass("violet")}>{billingLabel(listing)}</span>
                                {listing.externalInvocationEnabled ? (
                                  <span className={toneClass("success")}>可直接调用</span>
                                ) : (
                                  <span className={toneClass("glass")}>仅委托模式</span>
                                )}
                              </div>
                              <h3>{listing.publicTitle}</h3>
                              <p className="mg-copy">
                                {listing.publicDescription || `${listing.agentName} / ${listing.capabilityTitle}`}
                              </p>
                            </div>
                            <div className="nt-task-market-card-price">
                              <strong>
                                {listing.priceAmount} {money(listing.priceCurrency)}
                              </strong>
                              <span>{listing.agentName}</span>
                            </div>
                          </div>

                          <div className="nt-task-market-meta-grid">
                            <div className="nt-task-market-meta-item">
                              <span>能力路由</span>
                              <strong>{listing.routingSummary || "未填写"}</strong>
                            </div>
                            <div className="nt-task-market-meta-item">
                              <span>能力标签</span>
                              <strong>{routeSummary(listing.routingTags)}</strong>
                            </div>
                            <div className="nt-task-market-meta-item">
                              <span>提供方</span>
                              <strong>{listing.agentName}</strong>
                            </div>
                            <div className="nt-task-market-meta-item">
                              <span>计费</span>
                              <strong>{billingLabel(listing)}</strong>
                            </div>
                          </div>

                          <div className="nt-task-market-inline-actions">
                            <Link className="nt-btn nt-btn--glass" href={seedTaskHref(listing)}>
                              任务委托
                            </Link>
                          </div>

                          {listing.externalInvocationEnabled ? (
                            <form action={invokeAgentMarketplaceListingAction} className="nt-task-market-inline-form">
                              <input name="redirectTo" type="hidden" value={marketHref} />
                              <input name="listingId" type="hidden" value={listing.id} />
                              <input name="title" type="hidden" value={`调用 · ${listing.publicTitle}`} />
                              <label className="nt-task-market-field nt-task-market-field--full">
                                <span>调用目标</span>
                                <textarea
                                  className="nt-textarea"
                                  defaultValue={`请完成 ${listing.publicTitle} 对应能力。`}
                                  name="objective"
                                  required
                                  rows={3}
                                />
                              </label>
                              <div className="nt-task-market-form-grid nt-task-market-form-grid--compact">
                                {listing.billingMode !== "flat_task" ? (
                                  <label className="nt-task-market-field">
                                    <span>数量</span>
                                    <input className="nt-input" defaultValue={1} min="1" name="meterQuantity" type="number" />
                                  </label>
                                ) : null}
                              </div>
                              <button className="nt-btn nt-btn--primary" type="submit">
                                调用
                              </button>
                            </form>
                          ) : (
                            <></>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
              ) : null}

              {mode === "sell" && composer === "sell" ? (
              <section className="nt-panel nt-task-market-section-card nt-task-market-section-card--focus" id="supply-studio">
                <div className="nt-task-market-section-head">
                  <div className="nt-task-market-section-copy">
                    <h2>出售</h2>
                  </div>
                </div>

                {filteredOwnedCapabilityEntries.length === 0 ? (
                  <div className="nt-task-market-empty-state">
                    <strong>暂无能力</strong>
                  </div>
                ) : (
                  <>
                    {composer === "sell" ? (
                    <form action={upsertAgentMarketplaceListingAction} className="nt-task-market-form">
                      <input name="redirectTo" type="hidden" value={supplyRedirectTo} />
                      <div className="nt-task-market-form-grid">
                        <label className="nt-task-market-field nt-task-market-field--full">
                          <span>选择能力</span>
                          <select className="nt-select" defaultValue={selectedCapabilityEntry?.capability.id || ""} name="capabilityId">
                            {ownedCapabilityEntries.map((entry) => (
                              <option key={entry.capability.id} value={entry.capability.id}>
                                {entry.capability.title} · {entry.agent.name} · {hostingModeLabel(entry.agent)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="nt-task-market-field nt-task-market-field--full">
                          <span>商品标题</span>
                          <input
                            className="nt-input"
                            defaultValue={selectedOwnedListing?.publicTitle || (selectedCapabilityEntry ? `${selectedCapabilityEntry.capability.title}` : "")}
                            name="publicTitle"
                            required
                          />
                        </label>
                        <label className="nt-task-market-field nt-task-market-field--full">
                          <span>商品说明</span>
                          <textarea
                            className="nt-textarea"
                            defaultValue={
                              selectedOwnedListing?.publicDescription ||
                              selectedCapabilityEntry?.capability.description ||
                              selectedCapabilityEntry?.capability.routingSummary ||
                              ""
                            }
                            name="publicDescription"
                            rows={4}
                          />
                        </label>
                        <label className="nt-task-market-field">
                          <span>计费方式</span>
                          <select className="nt-select" defaultValue={selectedOwnedListing?.billingMode || "flat_task"} name="billingMode">
                            <option value="flat_task">按任务一口价</option>
                            <option value="token_metered">按 Token 计费</option>
                            <option value="property_metered">按属性计费</option>
                          </select>
                        </label>
                        <label className="nt-task-market-field">
                          <span>计量单位</span>
                          <input
                            className="nt-input"
                            defaultValue={selectedOwnedListing?.billingUnit || ""}
                            name="billingUnit"
                          />
                        </label>
                        <label className="nt-task-market-field">
                          <span>属性键</span>
                          <input
                            className="nt-input"
                            defaultValue={selectedOwnedListing?.meterKey || ""}
                            name="meterKey"
                          />
                        </label>
                        <label className="nt-task-market-field">
                          <span>币种</span>
                          <select className="nt-select" defaultValue={selectedOwnedListing?.priceCurrency || "obsidian"} name="priceCurrency">
                            <option value="obsidian">曜石</option>
                            <option value="mira">米拉</option>
                          </select>
                        </label>
                        <label className="nt-task-market-field">
                          <span>报价</span>
                          <input
                            className="nt-input"
                            defaultValue={selectedOwnedListing?.priceAmount || 300}
                            min="1"
                            name="priceAmount"
                            required
                            type="number"
                          />
                        </label>
                        <label className="nt-task-market-field">
                          <span>市场状态</span>
                          <select className="nt-select" defaultValue={selectedOwnedListing?.status || "draft"} name="status">
                            <option value="draft">草稿</option>
                            <option value="published">立即上架</option>
                            <option value="paused">暂停售卖</option>
                          </select>
                        </label>
                        <label className="nt-task-market-field">
                          <span>调用方式</span>
                          <select
                            className="nt-select"
                            defaultValue={selectedOwnedListing?.externalInvocationEnabled ? "true" : "false"}
                            name="externalInvocationEnabled"
                          >
                            <option value="true">允许直接调用</option>
                            <option value="false">仅支持任务委托</option>
                          </select>
                        </label>
                        <label className="nt-task-market-field">
                          <span>接单方式</span>
                          <select className="nt-select" defaultValue={selectedOwnedListing?.autoTakeEnabled ? "true" : "false"} name="autoTakeEnabled">
                            <option value="true">自动接单</option>
                            <option value="false">手动接单</option>
                          </select>
                        </label>
                      </div>
                      <div className="nt-task-market-inline-actions">
                        <button className="nt-btn nt-btn--primary" type="submit">
                          提交出售
                        </button>
                      </div>
                    </form>
                    ) : null}

                    <div className="nt-task-market-stack">
                      <div className="nt-task-market-section-head">
                        <div className="nt-task-market-section-copy">
                          <h3>我的出售</h3>
                        </div>
                        <span className={toneClass("glass")}>{formatAccountNumber(filteredOwnedCapabilityEntries.length)} 项能力</span>
                      </div>

                      <div className="nt-task-market-capability-grid">
                        {filteredOwnedCapabilityEntries.map((entry) => {
                      const editHref = `${buildTaskMarketHref({
                            panel: "market",
                            tab: "sell",
                            mode: "sell",
                            marketCurrency,
                            priceTab,
                            query: searchQuery || null,
                            composer: "sell",
                            capabilityId: entry.capability.id,
                            listingId: entry.listing?.id ?? null,
                          })}#supply-studio`;
                          const statusRedirect = editHref;

                          return (
                            <article
                              className={cn(
                                "nt-task-market-capability-card",
                                selectedCapabilityEntry?.capability.id === entry.capability.id && "nt-task-market-capability-card--focused",
                              )}
                              key={entry.capability.id}
                            >
                              <div className="nt-task-market-card-head">
                                <div className="nt-task-market-card-copy">
                                  <div className="nt-task-market-card-chips">
                                    <span className={toneClass(listingStatusTone(entry.listing?.status))}>
                                      {listingStatusLabel(entry.listing?.status)}
                                    </span>
                                    <span className={toneClass("cyan")}>{entry.capability.code}</span>
                                    <span className={toneClass("glass")}>{hostingModeLabel(entry.agent)}</span>
                                  </div>
                                  <h3>{entry.listing?.publicTitle || entry.capability.title}</h3>
                                  {entry.listing?.publicDescription || entry.capability.description || entry.capability.routingSummary ? (
                                    <p className="mg-copy">
                                      {entry.listing?.publicDescription || entry.capability.description || entry.capability.routingSummary}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="nt-task-market-card-price">
                                  <strong>{entry.listing ? `${entry.listing.priceAmount} ${money(entry.listing.priceCurrency)}` : "未定价"}</strong>
                                  <span>{entry.agent.name}</span>
                                </div>
                              </div>

                              <div className="nt-task-market-meta-grid">
                                <div className="nt-task-market-meta-item">
                                  <span>能力标签</span>
                                  <strong>{routeSummary(entry.capability.routingTags)}</strong>
                                </div>
                                <div className="nt-task-market-meta-item">
                                  <span>接单方式</span>
                                  <strong>{entry.listing?.autoTakeEnabled ? "自动接单" : "手动接单"}</strong>
                                </div>
                                <div className="nt-task-market-meta-item">
                                  <span>调用方式</span>
                                  <strong>{entry.listing?.externalInvocationEnabled ? "可直接调用" : "仅任务委托"}</strong>
                                </div>
                                <div className="nt-task-market-meta-item">
                                  <span>计费</span>
                                  <strong>{entry.listing ? billingLabel(entry.listing) : "未配置"}</strong>
                                </div>
                              </div>

                              <div className="nt-task-market-inline-actions">
                                <Link className="nt-btn nt-btn--glass" href={editHref}>
                                  {entry.listing ? "编辑商品" : "创建商品"}
                                </Link>
                                {entry.listing && entry.listing.status !== "published" ? (
                                  <form action={updateAgentMarketplaceListingStatusAction}>
                                    <input name="redirectTo" type="hidden" value={statusRedirect} />
                                    <input name="listingId" type="hidden" value={entry.listing.id} />
                                    <input name="status" type="hidden" value="published" />
                                    <button className="nt-btn nt-btn--primary" type="submit">
                                      上架
                                    </button>
                                  </form>
                                ) : null}
                                {entry.listing && entry.listing.status === "published" ? (
                                  <form action={updateAgentMarketplaceListingStatusAction}>
                                    <input name="redirectTo" type="hidden" value={statusRedirect} />
                                    <input name="listingId" type="hidden" value={entry.listing.id} />
                                    <input name="status" type="hidden" value="paused" />
                                    <button className="nt-btn nt-btn--glass" type="submit">
                                      暂停售卖
                                    </button>
                                  </form>
                                ) : null}
                                {entry.listing && entry.listing.status !== "draft" ? (
                                  <form action={updateAgentMarketplaceListingStatusAction}>
                                    <input name="redirectTo" type="hidden" value={statusRedirect} />
                                    <input name="listingId" type="hidden" value={entry.listing.id} />
                                    <input name="status" type="hidden" value="draft" />
                                    <button className="nt-btn nt-btn--glass" type="submit">
                                      移出市场
                                    </button>
                                  </form>
                                ) : null}
                                {entry.listing ? (
                                  <Link className="nt-btn nt-btn--glass" href={seedTaskHref(entry.listing)}>
                                    用它接单
                                  </Link>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </section>
              ) : null}

              {mode === "tasks" ? (
              <section className="nt-panel nt-task-market-section-card nt-task-market-section-card--focus" id="task-list">
                <div className="nt-task-market-section-head">
                  <div className="nt-task-market-section-copy">
                    <h2>任务列表</h2>
                  </div>
                </div>
                <div className="nt-task-market-task-grid">
                  {filteredTaskBoard.map((task) => {
                    const taskHref = `${buildTaskMarketHref({
                      panel: "publish",
                      tab: "take",
                      mode: "tasks",
                      marketCurrency,
                      priceTab,
                      query: searchQuery || null,
                      taskId: task.id,
                    })}#task-list`;
                    const proposals = (state.taskProposalsMap.get(task.id) || []).sort(
                      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
                    );
                    const pendingProposals = proposals.filter((proposal) => proposal.status === "pending");
                    const matchedListings = dedupeById(
                      publishedOwnedListings
                        .map((listing) => ({
                          ...getQuotedAmount(task, listing),
                          listing,
                        }))
                        .filter((entry) => entry.routeMatch.accepted)
                        .sort((left, right) => right.routeMatch.score - left.routeMatch.score)
                        .map((entry) => ({
                          id: entry.listing.agentId,
                          listing: entry.listing,
                          quotedAmount: entry.quotedAmount,
                          routeMatch: entry.routeMatch,
                        })),
                    ).slice(0, 4);
                    const isCreatedByMe = task.creatorUserId === session.user.id;
                    const isAssignedToMe = task.assignedUserId === session.user.id;

                    return (
                      <article
                        className={cn("nt-task-market-task-card", selectedTaskId === task.id && "nt-task-market-task-card--focused")}
                        id={`task-${task.id}`}
                        key={task.id}
                      >
                        <div className="nt-task-market-card-head">
                          <div className="nt-task-market-card-copy">
                            <div className="nt-task-market-card-chips">
                              <span className={toneClass(taskTone(task.status))}>{taskStatus(task.status)}</span>
                              <span className={toneClass("cyan")}>{pricingLabel(task)}</span>
                              {isCreatedByMe ? <span className={toneClass("violet")}>我发布的</span> : null}
                              {pendingProposals.length > 0 ? (
                                <span className={toneClass("warning")}>待处理提案 {pendingProposals.length}</span>
                              ) : null}
                            </div>
                            <h3>{task.title}</h3>
                            <p className="mg-copy">{task.description}</p>
                          </div>
                          <div className="nt-task-market-card-price">
                            <strong>
                              {task.rewardAmount} {money(task.rewardCurrency)}
                            </strong>
                            <span>{formatAccountDateTime(task.createdAt)}</span>
                          </div>
                        </div>

                        <div className="nt-task-market-meta-grid">
                          <div className="nt-task-market-meta-item">
                            <span>需求能力</span>
                            <strong>{task.preferredCapabilityCodes.length ? task.preferredCapabilityCodes.join(", ") : "开放匹配"}</strong>
                          </div>
                          <div className="nt-task-market-meta-item">
                            <span>申请 / 提案</span>
                            <strong>
                              {task.applicationCount} / {proposals.length}
                            </strong>
                          </div>
                          <div className="nt-task-market-meta-item">
                            <span>当前执行者</span>
                            <strong>{task.assignedUserId ? (isAssignedToMe ? "我" : task.assignedUserId) : "未分配"}</strong>
                          </div>
                          <div className="nt-task-market-meta-item">
                            <span>保证金</span>
                            <strong>{task.requiredBondAmount}</strong>
                          </div>
                        </div>

                        {isCreatedByMe ? (
                          <>
                            <div className="nt-task-market-inline-actions">
                              {task.status === "applying" && task.applicationCount > 0 ? (
                                <form action={dispatchTaskAction}>
                                  <input name="redirectTo" type="hidden" value={taskHref} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <button className="nt-btn nt-btn--primary" type="submit">
                                    立即调度
                                  </button>
                                </form>
                              ) : null}
                              {["open", "applying", "assigned"].includes(task.status) ? (
                                <form action={taskLifecycleAction}>
                                  <input name="action" type="hidden" value="cancel" />
                                  <input name="redirectTo" type="hidden" value={taskHref} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <button className="nt-btn nt-btn--glass" type="submit">
                                    取消任务
                                  </button>
                                </form>
                              ) : null}
                              {isAssignedToMe && task.status === "assigned" ? (
                                <form action={taskLifecycleAction}>
                                  <input name="action" type="hidden" value="start" />
                                  <input name="redirectTo" type="hidden" value={taskHref} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <button className="nt-btn nt-btn--primary" type="submit">
                                    开始执行
                                  </button>
                                </form>
                              ) : null}
                              {isAssignedToMe && task.status === "in_progress" ? (
                                <form action={taskLifecycleAction}>
                                  <input name="action" type="hidden" value="submit" />
                                  <input name="redirectTo" type="hidden" value={taskHref} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <button className="nt-btn nt-btn--secondary" type="submit">
                                    提交验收
                                  </button>
                                </form>
                              ) : null}
                              {task.status === "submitted" ? (
                                <>
                                  <form action={taskLifecycleAction}>
                                    <input name="action" type="hidden" value="accept" />
                                    <input name="redirectTo" type="hidden" value={taskHref} />
                                    <input name="taskId" type="hidden" value={task.id} />
                                    <button className="nt-btn nt-btn--primary" type="submit">
                                      验收通过
                                    </button>
                                  </form>
                                  <form action={taskLifecycleAction}>
                                    <input name="action" type="hidden" value="default" />
                                    <input name="redirectTo" type="hidden" value={taskHref} />
                                    <input name="taskId" type="hidden" value={task.id} />
                                    <button className="nt-btn nt-btn--glass" type="submit">
                                      标记违约
                                    </button>
                                  </form>
                                </>
                              ) : null}
                            </div>

                            {proposals.length > 0 ? (
                              <div className="nt-task-market-proposal-list">
                                {proposals.slice(0, 4).map((proposal) => (
                                  <div className="nt-task-market-proposal-card" key={proposal.id}>
                                    <div className="nt-task-market-card-head">
                                      <div className="nt-task-market-card-copy">
                                        <div className="nt-task-market-card-chips">
                                          <span className={toneClass(proposalTone(proposal.status))}>
                                            {formatProposalStatusLabel(proposal.status)}
                                          </span>
                                          <span className={toneClass("cyan")}>{proposal.proposedEtaHours}h</span>
                                        </div>
                                        <p className="mg-copy">{proposal.statement}</p>
                                      </div>
                                      <span className="nt-task-market-proposal-card__meta">{formatAccountDateTime(proposal.createdAt)}</span>
                                    </div>
                                    <div className="nt-task-market-inline-actions">
                                      <span className="mg-copy">
                                        智能体 {proposal.agentId}
                                        {proposal.matchedCapabilityCodes.length > 0
                                          ? ` · ${proposal.matchedCapabilityCodes.join(", ")}`
                                          : ` · ${proposal.matchedCapabilityCount} 项能力`}
                                      </span>
                                      {proposal.executionId ? (
                                        <Link className="nt-btn nt-btn--glass" href="/agents">
                                          去智能体中心查看执行
                                        </Link>
                                      ) : null}
                                      {proposal.canAccept ? (
                                        <form action={acceptTaskAgentProposalAction}>
                                          <input name="redirectTo" type="hidden" value={taskHref} />
                                          <input name="proposalId" type="hidden" value={proposal.id} />
                                          <input name="taskId" type="hidden" value={task.id} />
                                          <button className="nt-btn nt-btn--primary" type="submit">
                                            接受提案
                                          </button>
                                        </form>
                                      ) : null}
                                      {proposal.canReject ? (
                                        <form action={rejectTaskAgentProposalAction}>
                                          <input name="redirectTo" type="hidden" value={taskHref} />
                                          <input name="proposalId" type="hidden" value={proposal.id} />
                                          <input name="taskId" type="hidden" value={task.id} />
                                          <button className="nt-btn nt-btn--glass" type="submit">
                                            拒绝
                                          </button>
                                        </form>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="nt-task-market-subpanel">
                              <div className="nt-task-market-section-copy">
                                <h3>申请</h3>
                              </div>
                              <form action={applyTaskAction} className="nt-task-market-inline-form">
                                <input name="redirectTo" type="hidden" value={taskHref} />
                                <input name="taskId" type="hidden" value={task.id} />
                                <label className="nt-task-market-field nt-task-market-field--full">
                                  <span>申请说明</span>
                                  <textarea
                                    className="nt-textarea"
                                    defaultValue={`我可以承接「${task.title}」，会按要求完成交付。`}
                                    name="statement"
                                    required
                                    rows={3}
                                  />
                                </label>
                                <div className="nt-task-market-form-grid nt-task-market-form-grid--compact">
                                  <label className="nt-task-market-field">
                                    <span>预计耗时（小时）</span>
                                    <input className="nt-input" defaultValue={4} min="1" name="proposedEtaHours" required type="number" />
                                  </label>
                                </div>
                                <button className="nt-btn nt-btn--primary" type="submit">
                                  提交申请
                                </button>
                              </form>
                            </div>

                            {matchedListings.length > 0 ? (
                              <div className="nt-task-market-subpanel">
                                <div className="nt-task-market-section-copy">
                                  <h3>能力提案</h3>
                                </div>
                                <form action={createTaskAgentProposalAction} className="nt-task-market-inline-form">
                                  <input name="redirectTo" type="hidden" value={taskHref} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <label className="nt-task-market-field">
                                    <span>选择能力商品</span>
                                    <select className="nt-select" name="agentId" required>
                                      {matchedListings.map((entry) => (
                                        <option key={`${task.id}-${entry.listing.id}`} value={entry.listing.agentId}>
                                          {entry.listing.publicTitle}
                                          {entry.quotedAmount ? ` · 参考报价 ${entry.quotedAmount} ${money(entry.listing.priceCurrency)}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="nt-task-market-field nt-task-market-field--full">
                                    <span>提案说明</span>
                                    <textarea
                                      className="nt-textarea"
                                      defaultValue={`使用我的智能体能力承接「${task.title}」。`}
                                      name="statement"
                                      required
                                      rows={3}
                                    />
                                  </label>
                                  <div className="nt-task-market-form-grid nt-task-market-form-grid--compact">
                                    <label className="nt-task-market-field">
                                      <span>预计耗时（小时）</span>
                                      <input className="nt-input" defaultValue={4} min="1" name="proposedEtaHours" required type="number" />
                                    </label>
                                    <label className="nt-task-market-field">
                                      <span>成本备注</span>
                                      <input
                                        className="nt-input"
                                        defaultValue={
                                          matchedListings[0]?.quotedAmount
                                            ? `参考报价 ${matchedListings[0].quotedAmount} ${money(matchedListings[0].listing.priceCurrency)}`
                                            : billingLabel(matchedListings[0].listing)
                                        }
                                        name="proposedCostNote"
                                      />
                                    </label>
                                  </div>
                                  <button className="nt-btn nt-btn--secondary" type="submit">
                                    提交智能体提案
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
              ) : null}
            </div>
          </div>
        </div>
          </section>
        </div>
      </div>
    </main>
  );
}
