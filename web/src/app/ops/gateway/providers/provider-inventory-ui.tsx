import type {
  GatewayProviderAccountView,
  GatewayProviderInventoryEntryView,
  GatewayProviderQuotaView,
  GatewayProviderSourceView,
} from "@/lib/account-client";
import { NtBadge, NtCard, NtPanel, type NtBadgeTone } from "@/components/nt-primitives";
import Link from "next/link";

import { refreshGatewayProviderQuotaAction, updateGatewayProviderLumalabsContractAction } from "./actions";
import {
  isLumalabsCompatibleAdapter,
  LUMALABS_CONTRACT_FIELD_DEFINITIONS,
  readConfiguredLumalabsContract,
  resolveLumalabsContract,
} from "./lumalabs-contract";

export const SOURCE_KIND_OPTIONS = [
  { value: "official_model_api", label: "官方单模型 API" },
  { value: "official_vendor_api", label: "官方 API" },
  { value: "aggregator_api", label: "聚合 API" },
  { value: "web_reverse_api", label: "Web 转 API" },
] as const;

export function formatCostMicros(value: number | null | undefined) {
  if (value == null) return null;
  return `${(value / 1_000_000).toFixed(4)} US$`;
}

function formatRateMicros(promptMicros: number | null | undefined, completionMicros: number | null | undefined) {
  if (promptMicros == null && completionMicros == null) {
    return null;
  }
  const prompt = promptMicros != null ? `${(promptMicros / 1_000_000).toFixed(4)} US$/1k prompt` : "—";
  const completion =
    completionMicros != null ? `${(completionMicros / 1_000_000).toFixed(4)} US$/1k completion` : "—";
  return `${prompt} / ${completion}`;
}

function formatStaticPricingCoverage(entry: GatewayProviderInventoryEntryView["costHints"]["staticPricingCoverage"]) {
  if (!entry.totalModels) {
    return "未登记模型";
  }
  return `${entry.configuredModels}/${entry.totalModels}`;
}

export function formatShanghaiDateTime(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function buildQueryString(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const trimmed = safeTrim(value);
    if (trimmed) {
      search.set(key, trimmed);
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

const PROVIDER_FAMILY_LABEL_SUFFIX_PATTERN = /(?:[\s\-_/]+|\s*[\(\[]\s*)(openai|anthropic|messages|responses|realtime)(?:\s*[\)\]])?$/i;

function safeTrim(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function withFallback(value: string | null | undefined, fallback: string) {
  const trimmed = safeTrim(value);
  return trimmed || fallback;
}

export function getProviderPayloadBaseUrl(provider: GatewayProviderAccountView) {
  if ("baseUrl" in provider.payload && typeof provider.payload.baseUrl === "string") {
    return provider.payload.baseUrl;
  }
  return "base_url" in provider.payload && typeof provider.payload.base_url === "string"
    ? provider.payload.base_url
    : null;
}

function getProviderBaseHost(provider: GatewayProviderAccountView) {
  const baseUrl = getProviderPayloadBaseUrl(provider);
  if (!baseUrl) {
    return null;
  }
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getProviderBaseSurface(provider: GatewayProviderAccountView) {
  const baseUrl = getProviderPayloadBaseUrl(provider);
  if (!baseUrl) {
    return null;
  }
  try {
    const url = new URL(baseUrl);
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.hostname}${pathname && pathname !== "/" ? pathname : ""}`;
  } catch {
    return null;
  }
}

export function normalizeProviderFamilyLabel(label: string | null | undefined) {
  const trimmed = safeTrim(label);
  if (!trimmed) {
    return "未命名服务商";
  }
  const stripped = trimmed.replace(PROVIDER_FAMILY_LABEL_SUFFIX_PATTERN, "").trim();
  return stripped || trimmed;
}

export function formatProtocolFamilyLabel(protocolFamily: string | null | undefined) {
  const trimmed = safeTrim(protocolFamily);
  const normalized = trimmed.toLowerCase();
  if (!normalized) return "未知协议";
  if (normalized === "openai") return "OpenAI";
  if (normalized === "anthropic") return "Anthropic";
  if (normalized === "search" || normalized === "search_api") return "Search";
  if (normalized === "bedrock_converse") return "Bedrock Converse";
  if (normalized === "cohere_chat" || normalized === "cohere_chat_v2") return "Cohere Chat";
  if (normalized === "gemini_live") return "Gemini Live";
  if (normalized === "gemini_canvas") return "Gemini Canvas";
  return trimmed;
}

export function formatProtocolProfileLabel(protocolProfile: string | null | undefined) {
  const trimmed = safeTrim(protocolProfile);
  const normalized = trimmed.toLowerCase();
  if (!normalized) return "未声明 Profile";
  if (normalized === "azure_openai") return "Azure OpenAI";
  if (normalized === "google_gemini_api") return "Google Gemini API";
  if (normalized === "google_vertex_gemini") return "Google Vertex Gemini";
  if (normalized === "aws_bedrock") return "AWS Bedrock";
  if (normalized === "perplexity_chat") return "Perplexity Chat";
  if (normalized === "perplexity_search") return "Perplexity Search";
  if (normalized === "tavily") return "Tavily Search";
  if (normalized === "exa") return "Exa Search";
  if (normalized === "jina_search") return "Jina Search";
  if (normalized === "jina_reader") return "Jina Reader";
  if (normalized === "linkup") return "Linkup Search";
  if (normalized === "you_search") return "You Search";
  if (normalized === "websearchapi") return "WebSearchAPI Search";
  return trimmed;
}

function formatProviderVariantLabel(provider: GatewayProviderAccountView) {
  return `${withFallback(provider.adapter, "未声明适配器")} / ${formatProtocolFamilyLabel(provider.protocolFamily)} / ${formatProtocolProfileLabel(provider.protocolProfile)}`;
}

function getProviderDisplayLabel(provider: GatewayProviderAccountView) {
  return withFallback(provider.label, "未命名 Provider Surface");
}

export function getProviderServiceIdentity(provider: GatewayProviderAccountView) {
  const explicitKey = safeTrim(provider.serviceProviderKey) || null;
  const explicitLabel = safeTrim(provider.serviceProviderLabel) || null;

  if (explicitKey && explicitLabel) {
    return {
      key: explicitKey,
      label: explicitLabel,
      inferred: false,
    };
  }

  const fallbackLabel = explicitLabel ?? normalizeProviderFamilyLabel(provider.label);
  const fallbackKey =
    explicitKey ??
    [fallbackLabel.toLowerCase(), getProviderBaseHost(provider) ?? ""].filter((part) => part.length > 0).join("::");
  return {
    key: fallbackKey || "unknown-provider",
    label: fallbackLabel,
    inferred: true,
  };
}

export function formatProviderSurfaceLabel(provider: GatewayProviderAccountView) {
  const identity = getProviderServiceIdentity(provider);
  const parts: string[] = [];
  const providerLabel = safeTrim(provider.label);
  if (providerLabel && providerLabel !== identity.label) {
    parts.push(providerLabel);
  }
  parts.push(formatProtocolFamilyLabel(provider.protocolFamily));
  const surface = getProviderBaseSurface(provider);
  if (surface) {
    parts.push(surface);
  } else {
    parts.push(withFallback(provider.adapter, "未声明适配器"));
  }
  return parts.join(" / ");
}

function getEffectiveProviderStatus(entry: GatewayProviderInventoryEntryView) {
  return entry.providerHealth?.status ?? entry.providerAccount.status;
}

function getStatusSeverity(status: string | null | undefined) {
  if (status === "disabled") return 3;
  if (status === "cooling") return 2;
  if (status === "active") return 1;
  return 0;
}

function compareProviderVariants(left: GatewayProviderInventoryEntryView, right: GatewayProviderInventoryEntryView) {
  const leftOpenAi = left.providerAccount.protocolFamily === "openai" ? 0 : 1;
  const rightOpenAi = right.providerAccount.protocolFamily === "openai" ? 0 : 1;
  if (leftOpenAi !== rightOpenAi) {
    return leftOpenAi - rightOpenAi;
  }
  return formatProviderSurfaceLabel(left.providerAccount).localeCompare(
    formatProviderSurfaceLabel(right.providerAccount),
    "zh-CN",
  );
}

export type ProviderInventoryFamilyGroup = {
  familyKey: string;
  familyLabel: string;
  representative: GatewayProviderInventoryEntryView;
  entries: GatewayProviderInventoryEntryView[];
};

export function groupProviderInventoryEntries(entries: GatewayProviderInventoryEntryView[]) {
  const groups = new Map<string, ProviderInventoryFamilyGroup>();
  for (const entry of entries) {
    const identity = getProviderServiceIdentity(entry.providerAccount);
    const familyLabel = identity.label;
    const familyKey = identity.key;
    const current = groups.get(familyKey);
    if (current) {
      current.entries.push(entry);
      continue;
    }
    groups.set(familyKey, {
      familyKey,
      familyLabel,
      representative: entry,
      entries: [entry],
    });
  }

  return Array.from(groups.values())
    .map((group) => {
      const sortedEntries = [...group.entries].sort(compareProviderVariants);
      return {
        ...group,
        representative: sortedEntries[0],
        entries: sortedEntries,
      };
    })
    .sort((left, right) => {
      const leftScore = left.representative.providerHealth?.routingScore ?? -1;
      const rightScore = right.representative.providerHealth?.routingScore ?? -1;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.familyLabel.localeCompare(right.familyLabel);
    });
}

function getQuotaTone(status: string | null | undefined): NtBadgeTone {
  if (status === "available") return "success";
  if (status === "warning") return "warning";
  if (status === "exhausted") return "danger";
  return "glass";
}

function getQuotaLabel(status: string | null | undefined) {
  if (status === "available") return "额度正常";
  if (status === "warning") return "额度预警";
  if (status === "exhausted") return "额度耗尽";
  return "额度未知";
}

function formatQuotaPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(0)}%`;
}

function getStatusTone(status: GatewayProviderAccountView["status"]): NtBadgeTone {
  if (status === "active") return "success";
  if (status === "cooling") return "warning";
  if (status === "disabled") return "danger";
  return "secondary";
}

function getStatusLabel(status: GatewayProviderAccountView["status"] | string) {
  if (status === "active") return "运行正常";
  if (status === "cooling") return "冷却中";
  if (status === "disabled") return "已停用";
  return status;
}

function getSourceTone(sourceKind: GatewayProviderSourceView["sourceKind"]): NtBadgeTone {
  if (sourceKind === "official_vendor_api" || sourceKind === "official_model_api") return "success";
  if (sourceKind === "aggregator_api") return "cyan";
  return "warning";
}

function getSourceLabel(sourceKind: GatewayProviderSourceView["sourceKind"]) {
  return SOURCE_KIND_OPTIONS.find((item) => item.value === sourceKind)?.label ?? sourceKind;
}

function getRoutingTone(score: number | null | undefined): NtBadgeTone {
  if (score == null) return "secondary";
  if (score >= 0.85) return "success";
  if (score >= 0.55) return "cyan";
  if (score >= 0.3) return "warning";
  return "danger";
}

function resolveQuotaRemainingRatio(quota: GatewayProviderQuotaView | null | undefined) {
  if (!quota?.windows?.length) {
    return null;
  }
  const ratios = quota.windows
    .map((window) => window.remainingRatio)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!ratios.length) {
    return null;
  }
  return Math.max(0, Math.min(...ratios));
}

function formatQuotaRollup(quota: GatewayProviderQuotaView | null | undefined) {
  const ratio = resolveQuotaRemainingRatio(quota);
  if (ratio == null) {
    return "—";
  }
  return `${Math.round(ratio * 100)}% / 100%`;
}

function formatMetricCount(value: number | null | undefined) {
  return `${Math.max(0, value ?? 0)}`;
}

function aggregateMetricCount(
  entries: GatewayProviderInventoryEntryView[],
  selector: (entry: GatewayProviderInventoryEntryView) => number | null | undefined,
) {
  return entries.reduce((sum, entry) => sum + Math.max(0, selector(entry) ?? 0), 0);
}

function aggregateObservedCostMicros(entries: GatewayProviderInventoryEntryView[]) {
  const values = entries
    .map((entry) => entry.costHints.observedCostMicros)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0);
}

function resolveFamilyQuotaStatus(entries: GatewayProviderInventoryEntryView[]) {
  const statuses = entries
    .map((entry) => entry.providerQuota?.status)
    .filter(
      (
        status,
      ): status is NonNullable<GatewayProviderQuotaView["status"]> => typeof status === "string" && status.length > 0,
    );
  if (statuses.includes("exhausted")) return "exhausted";
  if (statuses.includes("warning")) return "warning";
  if (statuses.includes("available")) return "available";
  return null;
}

function formatFamilyQuotaRollup(entries: GatewayProviderInventoryEntryView[]) {
  const ratios = entries
    .map((entry) => resolveQuotaRemainingRatio(entry.providerQuota))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!ratios.length) {
    return "—";
  }
  return `${Math.round(Math.max(0, Math.min(...ratios)) * 100)}% / 100%`;
}

function resolveFamilyStatus(entries: GatewayProviderInventoryEntryView[]) {
  const statuses = Array.from(new Set(entries.map((entry) => getEffectiveProviderStatus(entry))));
  if (statuses.length <= 1) {
    return statuses[0] ?? "disabled";
  }
  if (statuses.includes("active")) {
    return "partial";
  }
  return statuses.sort((left, right) => getStatusSeverity(right) - getStatusSeverity(left))[0] ?? "disabled";
}

function getFamilyStatusTone(status: string): NtBadgeTone {
  if (status === "partial") return "warning";
  return getStatusTone(status as GatewayProviderAccountView["status"]);
}

function getFamilyStatusLabel(status: string) {
  if (status === "partial") return "部分可用";
  return getStatusLabel(status);
}

function buildProviderActionItems(entry: GatewayProviderInventoryEntryView) {
  const { providerAccount, providerHealth, costHints, providerQuota } = entry;
  const items: string[] = [];
  if (providerHealth?.breakerOpen) {
    items.push("断路器已开启，优先检查上游状态与凭证可用性。");
  }
  if (providerHealth?.degraded && providerHealth.degradationReasons.length > 0) {
    items.push(`当前服务商已降级：${providerHealth.degradationReasons.join(" / ")}`);
  }
  if (costHints.staticPricingCoverage.totalModels > 0 && !costHints.staticPricingCoverage.fullyConfigured) {
    items.push(
      `模型静态价仍有缺口：已配置 ${costHints.staticPricingCoverage.configuredModels}/${costHints.staticPricingCoverage.totalModels}` +
        (costHints.staticPricingCoverage.missingModels.length
          ? `，待补 ${costHints.staticPricingCoverage.missingModels.join(" / ")}`
          : ""),
    );
  }
  if (providerHealth?.lastError) {
    items.push(`最近错误：${providerHealth.lastError}`);
  }
  if (providerQuota?.status === "warning") {
    items.push(`服务商额度已进入预警：${providerQuota.representativeClaim ?? "建议补充账号池或降低权重。"}`);
  }
  if (providerQuota?.status === "exhausted") {
    items.push(`服务商额度已耗尽：${providerQuota.representativeClaim ?? "应切换其他凭证或等待窗口重置。"}`);
  }
  if (providerQuota && !providerQuota.ready) {
    items.push("当前额度快照显示该凭证暂不可调度，优先检查额度窗口与可用性。");
  }
  return items;
}

export function StatCard(props: { label: string; value: number; tone?: NtBadgeTone }) {
  return (
    <NtCard style={{ display: "grid", gap: 10 }}>
      <NtBadge tone={props.tone ?? "glass"}>{props.label}</NtBadge>
      <strong style={{ fontSize: "1.7rem", color: "rgba(243,245,247,0.96)" }}>{props.value}</strong>
    </NtCard>
  );
}

function DetailLine(props: { label: string; value: string | null }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span className="nt-kicker" style={{ fontSize: "0.72rem" }}>
        {props.label}
      </span>
      <span style={{ color: "rgba(243,245,247,0.88)", wordBreak: "break-word" }}>{props.value || "—"}</span>
    </div>
  );
}

function InventoryMetric(props: { label: string; value: string | null; tone?: NtBadgeTone }) {
  return (
    <NtCard style={{ display: "grid", gap: 4, padding: 12, alignItems: "center" }}>
      <NtBadge tone={props.tone ?? "glass"}>{props.label}</NtBadge>
      <strong style={{ color: "rgba(243,245,247,0.92)", fontSize: "1.4rem" }}>{props.value || "—"}</strong>
    </NtCard>
  );
}

function metricValueColor(tone: NtBadgeTone | undefined) {
  if (tone === "danger") return "#fda4af";
  if (tone === "warning") return "#fde68a";
  if (tone === "success") return "#bbf7d0";
  if (tone === "cyan") return "#a5f3fc";
  return "rgba(243,245,247,0.94)";
}

function CompactMetric(props: { label: string; value: string | null; tone?: NtBadgeTone }) {
  return (
    <NtPanel style={{ display: "grid", gap: 4, padding: 12 }}>
      <span className="nt-kicker">{props.label}</span>
      <strong style={{ color: metricValueColor(props.tone), fontSize: "1.02rem" }}>{props.value || "—"}</strong>
    </NtPanel>
  );
}

export function ProviderSummaryCard(props: {
  entry: GatewayProviderInventoryEntryView;
  detailHref: string;
}) {
  const { entry } = props;
  const { providerAccount: provider, providerHealth, providerQuota, costHints } = entry;
  const effectiveStatus = providerHealth?.status ?? provider.status;

  return (
    <NtCard style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NtBadge tone={getStatusTone(effectiveStatus)}>{getStatusLabel(effectiveStatus)}</NtBadge>
          {providerQuota ? <NtBadge tone={getQuotaTone(providerQuota.status)}>{getQuotaLabel(providerQuota.status)}</NtBadge> : null}
          {providerHealth?.breakerOpen ? <NtBadge tone="danger">断路器开启</NtBadge> : null}
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.05rem" }}>{getProviderDisplayLabel(provider)}</strong>
          <span style={{ color: "rgba(190,199,217,0.72)", fontSize: "0.9rem" }}>
            {formatProviderVariantLabel(provider)}
          </span>
          <span style={{ color: "rgba(148,163,184,0.76)", fontSize: "0.8rem", wordBreak: "break-all" }}>
            ID: {provider.id}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <CompactMetric
          label="可用总额度 / 总额度"
          value={formatQuotaRollup(providerQuota)}
          tone={providerQuota ? getQuotaTone(providerQuota.status) : "glass"}
        />
        <CompactMetric label="当前总计费" value={formatCostMicros(costHints.observedCostMicros)} />
        <CompactMetric label="总请求数" value={formatMetricCount(costHints.observedRequestCount)} />
        <CompactMetric
          label="总失败数"
          value={formatMetricCount(costHints.observedFailureCount)}
          tone={costHints.observedFailureCount > 0 ? "warning" : "glass"}
        />
        <CompactMetric label="最近10分钟请求数" value={formatMetricCount(costHints.recentRequestCount10m)} />
        <CompactMetric
          label="最近10分钟失败数"
          value={formatMetricCount(costHints.recentFailureCount10m)}
          tone={costHints.recentFailureCount10m > 0 ? "warning" : "glass"}
        />
        <CompactMetric
          label="实时并发数"
          value={formatMetricCount(providerHealth?.activeConcurrency)}
          tone="cyan"
        />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="nt-btn nt-btn--primary" href={props.detailHref}>
          进入详情
        </Link>
      </div>
    </NtCard>
  );
}

export type ProviderFamilyDetailLink = {
  href: string;
  label: string;
  providerAccountId: string;
};

export function ProviderFamilySummaryCard(props: {
  group: ProviderInventoryFamilyGroup;
  detailLinks: ProviderFamilyDetailLink[];
}) {
  const { group, detailLinks } = props;
  const sourceKinds = Array.from(
    new Set(group.entries.map((entry) => entry.providerAccount.sourceProfile.sourceKind)),
  );
  const familyStatus = resolveFamilyStatus(group.entries);
  const quotaStatus = resolveFamilyQuotaStatus(group.entries);
  const observedCostMicros = aggregateObservedCostMicros(group.entries);
  const observedRequestCount = aggregateMetricCount(group.entries, (entry) => entry.costHints.observedRequestCount);
  const observedFailureCount = aggregateMetricCount(group.entries, (entry) => entry.costHints.observedFailureCount);
  const recentRequestCount10m = aggregateMetricCount(group.entries, (entry) => entry.costHints.recentRequestCount10m);
  const recentFailureCount10m = aggregateMetricCount(group.entries, (entry) => entry.costHints.recentFailureCount10m);
  const activeConcurrency = aggregateMetricCount(group.entries, (entry) => entry.providerHealth?.activeConcurrency);

  return (
    <NtCard style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NtBadge tone={getFamilyStatusTone(familyStatus)}>{getFamilyStatusLabel(familyStatus)}</NtBadge>
          {quotaStatus ? <NtBadge tone={getQuotaTone(quotaStatus)}>{getQuotaLabel(quotaStatus)}</NtBadge> : null}
          {sourceKinds.length === 1 ? (
            <NtBadge tone={getSourceTone(sourceKinds[0])}>{getSourceLabel(sourceKinds[0])}</NtBadge>
          ) : (
            <NtBadge tone="glass">多来源</NtBadge>
          )}
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.05rem" }}>{group.familyLabel}</strong>
          <span style={{ color: "rgba(190,199,217,0.72)", fontSize: "0.9rem" }}>
            {group.entries.length} 个可路由入口
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {group.entries.map((entry) => (
            <NtBadge key={entry.providerAccount.id} tone="glass">
              {formatProviderSurfaceLabel(entry.providerAccount)}
            </NtBadge>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <CompactMetric
          label="可用总额度 / 总额度"
          value={formatFamilyQuotaRollup(group.entries)}
          tone={quotaStatus ? getQuotaTone(quotaStatus) : "glass"}
        />
        <CompactMetric label="当前总计费" value={formatCostMicros(observedCostMicros)} />
        <CompactMetric label="总请求数" value={formatMetricCount(observedRequestCount)} />
        <CompactMetric
          label="总失败数"
          value={formatMetricCount(observedFailureCount)}
          tone={observedFailureCount > 0 ? "warning" : "glass"}
        />
        <CompactMetric label="最近10分钟请求数" value={formatMetricCount(recentRequestCount10m)} />
        <CompactMetric
          label="最近10分钟失败数"
          value={formatMetricCount(recentFailureCount10m)}
          tone={recentFailureCount10m > 0 ? "warning" : "glass"}
        />
        <CompactMetric label="实时并发数" value={formatMetricCount(activeConcurrency)} tone="cyan" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {detailLinks.map((link, index) => (
          <Link
            key={link.providerAccountId}
            className={`nt-btn ${index === 0 ? "nt-btn--primary" : "nt-btn--outline"}`}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </NtCard>
  );
}

export function ProviderDetailCard(props: {
  entry: GatewayProviderInventoryEntryView;
  redirectTo: string;
}) {
  const { entry, redirectTo } = props;
  const { providerAccount: provider, providerHealth, costHints, providerQuota } = entry;
  const effectiveStatus = providerHealth?.status ?? provider.status;
  const serviceIdentity = getProviderServiceIdentity(provider);
  const isLumalabs = isLumalabsCompatibleAdapter(provider.adapter);
  const lumalabsConfigured = readConfiguredLumalabsContract(provider.payload);
  const lumalabsResolved = resolveLumalabsContract(provider.payload);

  return (
    <NtCard style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <NtBadge tone={getStatusTone(effectiveStatus)}>{getStatusLabel(effectiveStatus)}</NtBadge>
            <NtBadge tone={getSourceTone(provider.sourceProfile.sourceKind)}>
              {getSourceLabel(provider.sourceProfile.sourceKind)}
            </NtBadge>
            {provider.sourceProfile.derived ? <NtBadge tone="warning">推导值</NtBadge> : null}
            {providerHealth?.breakerOpen ? <NtBadge tone="danger">断路器开启</NtBadge> : null}
            {providerHealth?.degraded ? <NtBadge tone="warning">已降级</NtBadge> : null}
            {providerHealth?.saturated ? <NtBadge tone="warning">已饱和</NtBadge> : null}
            {providerQuota ? <NtBadge tone={getQuotaTone(providerQuota.status)}>{getQuotaLabel(providerQuota.status)}</NtBadge> : null}
            <NtBadge
              tone={
                !costHints.staticPricingCoverage.totalModels
                  ? "secondary"
                  : costHints.staticPricingCoverage.fullyConfigured
                    ? "success"
                    : "warning"
              }
            >
              模型静态价 {formatStaticPricingCoverage(costHints.staticPricingCoverage)}
            </NtBadge>
          </div>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: "1rem", color: "rgba(243,245,247,0.96)" }}>{getProviderDisplayLabel(provider)}</strong>
          <span style={{ color: "rgba(190,199,217,0.76)", fontSize: "0.92rem" }}>
            {formatProviderVariantLabel(provider)}
          </span>
        </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <DetailLine label="服务商 ID" value={provider.id} />
        <DetailLine label="服务商归属" value={serviceIdentity.label} />
        <DetailLine label="服务商归属 Key" value={serviceIdentity.key} />
        <DetailLine label="上游地址" value={getProviderPayloadBaseUrl(provider)} />
        <DetailLine label="执行模式" value={provider.executionMode} />
        <DetailLine label="更新时间" value={formatShanghaiDateTime(provider.updatedAt)} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <InventoryMetric
          label="路由分数"
          value={providerHealth?.routingScore?.toFixed(2) ?? "—"}
          tone={getRoutingTone(providerHealth?.routingScore)}
        />
        <InventoryMetric
          label="健康权重"
          value={providerHealth?.healthWeight?.toFixed(2) ?? "—"}
          tone={providerHealth?.degraded ? "warning" : "glass"}
        />
        <InventoryMetric
          label="容量权重"
          value={providerHealth?.capacityWeight?.toFixed(2) ?? "—"}
          tone={providerHealth?.saturated ? "warning" : "glass"}
        />
        <InventoryMetric
          label="实时并发"
          value={formatMetricCount(providerHealth?.activeConcurrency)}
          tone="cyan"
        />
        <InventoryMetric
          label="总失败数"
          value={formatMetricCount(costHints.observedFailureCount)}
          tone={costHints.observedFailureCount > 0 ? "warning" : "glass"}
        />
      </div>

      <NtPanel style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span className="nt-kicker">服务商额度</span>
          <form action={refreshGatewayProviderQuotaAction}>
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <input name="providerAccountId" type="hidden" value={provider.id} />
            <button className="nt-btn nt-btn--secondary" type="submit">
              刷新额度
            </button>
          </form>
        </div>
        {providerQuota ? (
          <>
            <span style={{ color: "rgba(214,219,233,0.85)" }}>
              当前状态：{getQuotaLabel(providerQuota.status)}
              {providerQuota.planType ? ` · 计划 ${providerQuota.planType}` : ""}
            </span>
            <span style={{ color: "rgba(214,219,233,0.85)" }}>
              代表性结论：{providerQuota.representativeClaim ?? "—"}
            </span>
            <span style={{ color: "rgba(214,219,233,0.85)" }}>
              最近检查：{formatShanghaiDateTime(providerQuota.checkedAt)}
            </span>
            <span style={{ color: "rgba(214,219,233,0.85)" }}>
              下次建议检查：{formatShanghaiDateTime(providerQuota.nextCheckAt)}
            </span>
            <span style={{ color: "rgba(214,219,233,0.85)" }}>
              最近重置点：{formatShanghaiDateTime(providerQuota.nextResetAt)}
            </span>
            {providerQuota.windows.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                {providerQuota.windows.map((window) => (
                  <NtCard key={`${provider.id}-${window.key}`} style={{ display: "grid", gap: 6, padding: 12 }}>
                    <NtBadge tone={getQuotaTone(providerQuota.status)}>{window.label}</NtBadge>
                    <span style={{ color: "rgba(214,219,233,0.85)" }}>已用：{formatQuotaPercent(window.usedPercent)}</span>
                    <span style={{ color: "rgba(214,219,233,0.85)" }}>
                      剩余比：{window.remainingRatio != null ? `${Math.round(window.remainingRatio * 100)}%` : "—"}
                    </span>
                    <span style={{ color: "rgba(214,219,233,0.85)" }}>
                      重置：{formatShanghaiDateTime(window.resetAt)}
                    </span>
                  </NtCard>
                ))}
              </div>
            ) : (
              <span style={{ color: "rgba(214,219,233,0.64)" }}>当前额度源未提供窗口明细。</span>
            )}
          </>
        ) : (
          <span style={{ color: "rgba(214,219,233,0.64)" }}>当前服务商尚未声明可读取的额度接口。</span>
        )}
      </NtPanel>

      <NtPanel style={{ display: "grid", gap: 6 }}>
        <span className="nt-kicker">路由诊断</span>
        <span style={{ color: "rgba(214,219,233,0.85)" }}>
          最近健康检查：{formatShanghaiDateTime(providerHealth?.lastHealthCheckAt ?? null)}
        </span>
        <span style={{ color: "rgba(214,219,233,0.85)" }}>
          冷却截止：{formatShanghaiDateTime(providerHealth?.cooldownUntil ?? null)}
        </span>
        <span style={{ color: "rgba(214,219,233,0.85)" }}>
          最近错误：{providerHealth?.lastError ?? "—"}
        </span>
        {providerHealth?.degradationReasons?.length ? (
          <span style={{ color: "rgba(252,211,77,0.92)" }}>
            降级原因：{providerHealth.degradationReasons.join(" / ")}
          </span>
        ) : (
          <span style={{ color: "rgba(214,219,233,0.64)" }}>当前无显式降级原因。</span>
        )}
      </NtPanel>

      <NtPanel style={{ display: "grid", gap: 6 }}>
        <span className="nt-kicker">静态定价与流量摘要</span>
        {(() => {
          const coverage = costHints.staticPricingCoverage;
          const costLines = [
            coverage.totalModels
              ? `模型静态价覆盖：${coverage.configuredModels}/${coverage.totalModels}`
              : "当前尚未登记模型能力，无法判定模型级静态价覆盖。",
            ...coverage.configuredEntries.slice(0, 6).map((pricing) => {
              const line = formatRateMicros(
                pricing.staticRate.promptMicrosPer1kTokens,
                pricing.staticRate.completionMicrosPer1kTokens,
              );
              return line ? `${pricing.model}：${line}` : null;
            }),
            coverage.missingModels.length
              ? `待补模型：${coverage.missingModels.join(" / ")}`
              : coverage.totalModels > 0
                ? "已为当前登记模型补齐静态价。"
                : null,
            costHints.observedRequestCount > 0 ? `总请求数：${costHints.observedRequestCount}` : null,
            costHints.observedFailureCount > 0 ? `总失败数：${costHints.observedFailureCount}` : null,
            costHints.recentRequestCount10m > 0 ? `最近 10 分钟请求数：${costHints.recentRequestCount10m}` : null,
            costHints.recentFailureCount10m > 0 ? `最近 10 分钟失败数：${costHints.recentFailureCount10m}` : null,
            costHints.observedTotalTokens > 0 ? `观测 Token：${costHints.observedTotalTokens}` : null,
            costHints.observedCostMicros != null ? `当前总计费：${formatCostMicros(costHints.observedCostMicros)}` : null,
            costHints.lastRequestAt ? `最近请求：${formatShanghaiDateTime(costHints.lastRequestAt)}` : null,
          ].filter((line): line is string => Boolean(line));
          if (!costLines.length) {
            return <span style={{ color: "rgba(214,219,233,0.64)" }}>暂无静态定价与流量摘要</span>;
          }
          return costLines.map((line) => (
            <span key={line} style={{ color: "rgba(214,219,233,0.85)" }}>
              {line}
            </span>
          ));
        })()}
      </NtPanel>

      {isLumalabs ? (
        <NtPanel style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">Luma Reverse-Web 合同</span>
            <span style={{ color: "rgba(214,219,233,0.84)" }}>
              当前 Luma surface 仍是 browser-backed reverse-web，不是官方 API。这里维护的是 capture-derived 视频 / 音频 action 与产物字段覆盖。
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => (
              <DetailLine
                key={field.key}
                label={field.label}
                value={`${lumalabsResolved[field.key]}${lumalabsConfigured[field.key] ? "" : "（默认）"}`}
              />
            ))}
          </div>

          <form action={updateGatewayProviderLumalabsContractAction} style={{ display: "grid", gap: 12 }}>
            <input name="providerAccountId" type="hidden" value={provider.id} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => (
                <label key={field.key} style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">{field.label}</span>
                  <input
                    className="nt-input"
                    defaultValue={lumalabsConfigured[field.key] ?? ""}
                    name={field.key}
                    placeholder={field.placeholder}
                  />
                  <span style={{ color: "rgba(190,199,217,0.7)", fontSize: "0.82rem" }}>
                    {field.description} 默认：{field.fallbackValue}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: "rgba(190,199,217,0.76)" }}>
                留空表示不写显式 override，让运行时按平台默认 `ray-2 / music-v1` 合同回退。
              </span>
              <button className="nt-btn nt-btn--primary" type="submit">
                保存 Luma 合同
              </button>
            </div>
          </form>
        </NtPanel>
      ) : null}

      <NtPanel style={{ display: "grid", gap: 6 }}>
        <span className="nt-kicker">下一步处理建议</span>
        {buildProviderActionItems(entry).length ? (
          buildProviderActionItems(entry).map((line) => (
            <span key={line} style={{ color: "rgba(214,219,233,0.84)" }}>
              {line}
            </span>
          ))
        ) : (
          <span style={{ color: "rgba(214,219,233,0.64)" }}>当前服务商没有明显治理缺口。</span>
        )}
      </NtPanel>
    </NtCard>
  );
}
