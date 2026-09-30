"use client";

import type { CSSProperties } from "react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import type { GatewayProviderCredentialView } from "@/lib/account-client";
import {
  NtBadge,
  NtCard,
  NtInput,
  NtPanel,
  NtSelect,
  NtTextarea,
  type NtBadgeTone,
} from "@/components/nt-primitives";
import { formatPlatformDateTime } from "@/lib/platform-date-time";
import {
  deleteGatewayProviderCredentialAction,
  patchGatewayProviderCredentialAction,
  refreshGatewayProviderCredentialQuotaAction,
  toggleGatewayProviderCredentialStatusAction,
} from "./[providerAccountId]/credentials/actions";
import {
  isLumalabsCompatibleAdapter,
  LUMALABS_CONTRACT_FIELD_DEFINITIONS,
  readConfiguredLumalabsContract,
  resolveLumalabsContract,
} from "./lumalabs-contract";

type ProviderCredentialBrowserClientProps = {
  providerAccountId: string;
  providerAdapter: string;
  redirectTo: string;
  credentials: GatewayProviderCredentialView[];
};

type CredentialSortKey = "updated_desc" | "label_asc" | "problem_first" | "quota_worst";
type CredentialDetailTab = "overview" | "models" | "json" | "edit";

type ModelBucket = {
  label: string;
  values: string[];
};

/*
 * Every card and panel below used to carry its own inline style object, which allocated a
 * fresh object on each render and hardcoded colors outside the neuro token layer. The
 * layout now runs through the shared `nt-` utilities and the few genuinely one-off values
 * live in module-scope constants so they are allocated once.
 */
const autofitMin = (min: string) => ({ "--nt-autofit-min": min }) as CSSProperties;

const AUTOFIT_160 = autofitMin("160px");
const AUTOFIT_180 = autofitMin("180px");
const AUTOFIT_200 = autofitMin("200px");
const AUTOFIT_220 = autofitMin("220px");
const AUTOFIT_260 = autofitMin("260px");

const CARD_GRID_STYLE: CSSProperties = { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" };
const METRIC_PAIR_STYLE: CSSProperties = { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
const SUMMARY_CARD_STYLE: CSSProperties = { minHeight: 248, padding: 18 };
const SUMMARY_CARD_ISSUE_STYLE: CSSProperties = {
  ...SUMMARY_CARD_STYLE,
  borderColor: "var(--neuro-yellow-line)",
};
const ISSUE_PANEL_STYLE: CSSProperties = {
  borderColor: "var(--neuro-yellow-line)",
  background: "var(--neuro-yellow-soft)",
};
const PUSH_RIGHT_STYLE: CSSProperties = { marginTop: "auto" };
const DETAIL_SCROLL_STYLE: CSSProperties = { paddingRight: 4 };

const DETAIL_TABS: ReadonlyArray<{ key: CredentialDetailTab; label: string }> = [
  { key: "overview", label: "总览" },
  { key: "models", label: "模型" },
  { key: "json", label: "JSON" },
  { key: "edit", label: "编辑" },
];

function quotaTone(status: string | null | undefined): NtBadgeTone {
  if (status === "available") return "success";
  if (status === "warning") return "warning";
  if (status === "exhausted") return "danger";
  return "glass";
}

function credentialTone(status: string): NtBadgeTone {
  if (status === "active") return "success";
  if (status === "cooling") return "warning";
  if (status === "archived" || status === "disabled") return "danger";
  return "glass";
}

function formatShanghaiDateTime(value: string | null | undefined) {
  return formatPlatformDateTime(value, "—");
}

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function toTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => toTextList(item));
  }
  return [];
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function extractModelBuckets(credential: GatewayProviderCredentialView): ModelBucket[] {
  const payload = credential.credential ?? {};
  const buckets: ModelBucket[] = [
    {
      label: "显式允许模型",
      values: uniqueList(credential.supportedModels ?? []),
    },
    {
      label: "绑定真实模型",
      values: uniqueList(toTextList(credential.selectedDisplayModel)),
    },
    {
      label: "共享默认模型",
      values: uniqueList(toTextList(credential.sharedPayloadHints.defaultModel)),
    },
    {
      label: "凭证默认模型",
      values: uniqueList(
        toTextList(
          payload.defaultModel ??
            payload.default_model ??
            payload.model ??
            payload.modelId ??
            payload.model_id,
        ),
      ),
    },
    {
      label: "可用模型",
      values: uniqueList(
        toTextList(
          payload.models ??
            payload.supportedModels ??
            payload.supported_models ??
            payload.allowedModels ??
            payload.allowed_models,
        ),
      ),
    },
    {
      label: "排除模型",
      values: uniqueList(toTextList(payload.excludedModels ?? payload.excluded_models)),
    },
  ];
  return buckets.filter((bucket) => bucket.values.length > 0);
}

function hasCredentialIssue(credential: GatewayProviderCredentialView) {
  if (credential.lastError || credential.syncError) {
    return true;
  }
  if (credential.status !== "active") {
    return true;
  }
  const quotaStatus = credential.providerQuota?.status ?? null;
  return quotaStatus === "warning" || quotaStatus === "exhausted";
}

function summarizeIssue(credential: GatewayProviderCredentialView) {
  if (credential.lastError) {
    return credential.lastError;
  }
  if (credential.syncError) {
    return credential.syncError;
  }
  if (credential.status !== "active") {
    return `当前状态：${credential.status}`;
  }
  const quotaStatus = credential.providerQuota?.status ?? null;
  if (quotaStatus === "warning" || quotaStatus === "exhausted") {
    return credential.providerQuota?.representativeClaim ?? `当前额度状态：${quotaStatus}`;
  }
  return "当前没有检测到显式异常。";
}

function buildSearchText(credential: GatewayProviderCredentialView, buckets: ModelBucket[]) {
  const modelText = buckets.flatMap((bucket) => bucket.values).join(" ");
  return [
    credential.label,
    credential.id,
    credential.sourceKind,
    credential.sourcePath ?? "",
    credential.sourceHash ?? "",
    credential.syncMode,
    credential.syncState,
    credential.credentialMaterialKey ?? "",
    credential.selectedDisplayModel ?? "",
    (credential.supportedModels ?? []).join(" "),
    credential.sharedPayloadHints.baseUrl ?? "",
    credential.sharedPayloadHints.defaultModel ?? "",
    credential.sharedPayloadHints.accountLabel ?? "",
    credential.providerQuota?.status ?? "",
    credential.providerQuota?.planType ?? "",
    credential.providerQuota?.representativeClaim ?? "",
    modelText,
  ]
    .join(" ")
    .toLowerCase();
}

function quotaSeverityRank(status: string | null | undefined) {
  if (status === "exhausted") return 0;
  if (status === "warning") return 1;
  if (status === "available") return 2;
  return 3;
}

function problemSeverityRank(credential: GatewayProviderCredentialView) {
  if (credential.lastError || credential.syncError) return 0;
  if (credential.providerQuota?.status === "exhausted") return 1;
  if (credential.status !== "active" || credential.providerQuota?.status === "warning") return 2;
  return 3;
}

function modelSummary(buckets: ModelBucket[]) {
  const firstBucket = buckets.find((bucket) => bucket.label !== "排除模型") ?? buckets[0] ?? null;
  if (!firstBucket) {
    return "未声明模型";
  }
  return firstBucket.values.slice(0, 2).join(" / ");
}

/*
 * Search, sort and card rendering all needed the same derived facts, and each of them used
 * to re-derive the model buckets from the raw credential payload. Deriving them once per
 * credential list keeps filtering off the payload-parsing path entirely.
 */
type IndexedCredential = {
  credential: GatewayProviderCredentialView;
  searchText: string;
  issue: boolean;
  issueSummary: string;
  models: string;
};

function indexCredential(credential: GatewayProviderCredentialView): IndexedCredential {
  const buckets = extractModelBuckets(credential);
  return {
    credential,
    searchText: buildSearchText(credential, buckets),
    issue: hasCredentialIssue(credential),
    issueSummary: summarizeIssue(credential),
    models: modelSummary(buckets),
  };
}

function compareIndexed(sortKey: CredentialSortKey) {
  return (left: IndexedCredential, right: IndexedCredential) => {
    if (sortKey === "label_asc") {
      return left.credential.label.localeCompare(right.credential.label, "zh-CN");
    }
    if (sortKey === "problem_first") {
      const severity = problemSeverityRank(left.credential) - problemSeverityRank(right.credential);
      if (severity !== 0) {
        return severity;
      }
      return right.credential.updatedAt.localeCompare(left.credential.updatedAt);
    }
    if (sortKey === "quota_worst") {
      const severity =
        quotaSeverityRank(left.credential.providerQuota?.status) -
        quotaSeverityRank(right.credential.providerQuota?.status);
      if (severity !== 0) {
        return severity;
      }
      return right.credential.updatedAt.localeCompare(left.credential.updatedAt);
    }
    return right.credential.updatedAt.localeCompare(left.credential.updatedAt);
  };
}

function buildInfoPreview(credential: GatewayProviderCredentialView) {
  return {
    id: credential.id,
    providerAccountId: credential.providerAccountId,
    label: credential.label,
    status: credential.status,
    storageMode: credential.storageMode,
    sourceKind: credential.sourceKind,
    sourcePath: credential.sourcePath,
    sourceHash: credential.sourceHash,
    syncMode: credential.syncMode,
    syncState: credential.syncState,
    syncError: credential.syncError,
    cooldownUntil: credential.cooldownUntil,
    lastError: credential.lastError,
    failureCount: credential.failureCount,
    lastHealthCheckAt: credential.lastHealthCheckAt,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    archivedAt: credential.archivedAt,
    quota: credential.providerQuota,
    credentialMaterialKey: credential.credentialMaterialKey,
    selectedDisplayModel: credential.selectedDisplayModel,
    supportedModels: credential.supportedModels,
    sharedPayloadHints: credential.sharedPayloadHints,
  };
}

function metricTile(title: string, value: string) {
  return (
    <div className="nt-card nt-panel nt-stack nt-gap-1 nt-metric-tile">
      <span className="nt-kicker">{title}</span>
      <strong className="nt-text-strong nt-text-md nt-break-word">{value}</strong>
    </div>
  );
}

const CredentialSummaryCard = memo(function CredentialSummaryCard(props: {
  entry: IndexedCredential;
  onView: (credentialId: string, tab?: CredentialDetailTab) => void;
}) {
  const { credential, issue, issueSummary, models } = props.entry;
  return (
    <NtCard
      className="nt-stack nt-gap-3_5"
      style={issue ? SUMMARY_CARD_ISSUE_STYLE : SUMMARY_CARD_STYLE}
    >
      <div className="nt-stack nt-gap-2">
        <div className="nt-flex nt-gap-2 nt-wrap">
          <NtBadge tone={credentialTone(credential.status)}>{credential.status}</NtBadge>
          <NtBadge tone={quotaTone(credential.providerQuota?.status)}>
            {credential.providerQuota?.status ?? "未探测额度"}
          </NtBadge>
          <NtBadge tone="glass">{credential.sourceKind}</NtBadge>
        </div>
        <strong className="nt-text-strong nt-break-word nt-credential-title">{credential.label}</strong>
        <span className="nt-text-muted nt-text-sm nt-break-word">
          {credential.sourcePath ?? credential.id}
        </span>
      </div>

      <div className="nt-stack nt-gap-2" style={METRIC_PAIR_STYLE}>
        {metricTile("模型", models)}
        {metricTile("更新时间", formatShanghaiDateTime(credential.updatedAt))}
        {metricTile("失败次数", String(credential.failureCount))}
        {metricTile("同步", credential.syncState)}
      </div>

      <NtPanel
        className="nt-stack nt-gap-1_5 nt-pad-3"
        style={issue ? ISSUE_PANEL_STYLE : undefined}
      >
        <span className="nt-kicker">{issue ? "异常摘要" : "运行摘要"}</span>
        <span className={`nt-text-md nt-clamp-2 ${issue ? "nt-text-warn" : "nt-text-hint"}`}>
          {issueSummary}
        </span>
      </NtPanel>

      <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap" style={PUSH_RIGHT_STYLE}>
        <button className="nt-btn nt-btn--primary" type="button" onClick={() => props.onView(credential.id, "overview")}>
          查看
        </button>
        <span className="nt-text-muted nt-text-sm">
          {credential.providerQuota?.representativeClaim ?? "点查看可展开完整详情"}
        </span>
      </div>
    </NtCard>
  );
});

function QuotaOverview(props: { credential: GatewayProviderCredentialView }) {
  const quota = props.credential.providerQuota;
  if (!quota) {
    return (
      <NtPanel className="nt-stack nt-gap-1_5">
        <span className="nt-kicker">凭证额度</span>
        <strong className="nt-text-strong">当前未读取到额度快照</strong>
        <span className="nt-text-muted">你可以在上方使用 `刷新额度` 重新触发探测。</span>
      </NtPanel>
    );
  }

  return (
    <NtPanel className="nt-stack nt-gap-3">
      <div className="nt-stack nt-gap-1_5">
        <span className="nt-kicker">凭证额度</span>
        <div className="nt-flex nt-gap-2 nt-wrap">
          <NtBadge tone={quotaTone(quota.status)}>{quota.status}</NtBadge>
          {quota.planType ? <NtBadge tone="glass">{quota.planType}</NtBadge> : null}
        </div>
        <span className="nt-text-hint">代表性结论：{quota.representativeClaim ?? "—"}</span>
        <span className="nt-text-hint">
          最近检查：{formatShanghaiDateTime(quota.checkedAt)} / 下次建议检查：{formatShanghaiDateTime(quota.nextCheckAt)}
        </span>
      </div>

      {quota.windows.length ? (
        <div className="nt-autofit nt-gap-2_5" style={AUTOFIT_160}>
          {quota.windows.map((window) => (
            <div
              key={`${quota.providerAccountId}-${window.key}`}
              className="nt-card nt-panel nt-stack nt-gap-1 nt-metric-tile"
            >
              <span className="nt-kicker">{window.label}</span>
              <strong className="nt-text-strong">
                已用 {window.usedPercent != null ? `${window.usedPercent.toFixed(0)}%` : "—"}
              </strong>
              <span className="nt-text-hint">
                剩余 {window.remainingRatio != null ? `${Math.round(window.remainingRatio * 100)}%` : "—"}
              </span>
              <span className="nt-text-hint">重置 {formatShanghaiDateTime(window.resetAt)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </NtPanel>
  );
}

function CredentialDetailDialog(props: {
  providerAccountId: string;
  providerAdapter: string;
  redirectTo: string;
  credential: GatewayProviderCredentialView;
  activeTab: CredentialDetailTab;
  onClose: () => void;
  onChangeTab: (tab: CredentialDetailTab) => void;
}) {
  const { credential } = props;
  const shouldEnable = credential.status !== "active";
  const modelBuckets = useMemo(() => extractModelBuckets(credential), [credential]);
  const isLumalabs = isLumalabsCompatibleAdapter(props.providerAdapter);
  const lumalabsConfigured = useMemo(
    () => readConfiguredLumalabsContract(credential.credential),
    [credential.credential],
  );
  const lumalabsResolved = useMemo(() => resolveLumalabsContract(credential.credential), [credential.credential]);

  return (
    <div aria-modal="true" className="app-honor-overlay nt-ops-access-dialog-overlay" role="dialog">
      <button
        aria-label="关闭凭证详情"
        className="app-honor-backdrop"
        onClick={props.onClose}
        type="button"
      />

      <div className="nt-ops-access-dialog nt-ops-access-dialog--wide">
        <div className="nt-ops-access-dialog__scroll">
          <div className="nt-flex nt-justify-between nt-gap-4 nt-items-start nt-wrap">
            <div className="nt-stack nt-gap-2">
              <div className="nt-flex nt-gap-2 nt-wrap">
                <NtBadge tone={credentialTone(credential.status)}>{credential.status}</NtBadge>
                <NtBadge tone={quotaTone(credential.providerQuota?.status)}>
                  {credential.providerQuota?.status ?? "未探测额度"}
                </NtBadge>
                <NtBadge tone="glass">{credential.sourceKind}</NtBadge>
                <NtBadge tone="glass">{credential.syncState}</NtBadge>
              </div>
              <h3 className="nt-flush nt-text-strong nt-dialog-title">
                认证文件详情 / 编辑 - {credential.label}
              </h3>
              <span className="nt-text-muted nt-break-word">{credential.sourcePath ?? credential.id}</span>
            </div>
            <button className="nt-btn nt-btn--outline" type="button" onClick={props.onClose}>
              关闭
            </button>
          </div>

          <div className="nt-flex nt-gap-2_5 nt-wrap">
            <button
              className={`nt-btn ${props.activeTab === "models" ? "nt-btn--primary" : "nt-btn--secondary"}`}
              type="button"
              onClick={() => props.onChangeTab("models")}
            >
              查看凭证模型
            </button>
            <form action={refreshGatewayProviderCredentialQuotaAction}>
              <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
              <input name="providerCredentialId" type="hidden" value={credential.id} />
              <input name="redirectTo" type="hidden" value={props.redirectTo} />
              <button className="nt-btn nt-btn--secondary" type="submit">
                刷新额度
              </button>
            </form>
            <form action={toggleGatewayProviderCredentialStatusAction}>
              <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
              <input name="providerCredentialId" type="hidden" value={credential.id} />
              <input name="currentStatus" type="hidden" value={credential.status} />
              <input name="redirectTo" type="hidden" value={props.redirectTo} />
              <button className={`nt-btn ${shouldEnable ? "nt-btn--primary" : "nt-btn--outline"}`} type="submit">
                {shouldEnable ? "启用凭证" : "关闭凭证"}
              </button>
            </form>
            <form
              action={deleteGatewayProviderCredentialAction}
              onSubmit={(event) => {
                if (!window.confirm(`确认删除凭证 ${credential.label} 吗？`)) {
                  event.preventDefault();
                }
              }}
            >
              <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
              <input name="providerCredentialId" type="hidden" value={credential.id} />
              <input name="redirectTo" type="hidden" value={props.redirectTo} />
              <button className="nt-btn nt-btn--outline" type="submit">
                删除凭证
              </button>
            </form>
          </div>

          <div className="nt-flex nt-gap-2 nt-wrap">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`nt-btn ${props.activeTab === tab.key ? "nt-btn--primary" : "nt-btn--secondary"}`}
                onClick={() => props.onChangeTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={DETAIL_SCROLL_STYLE}>
            {props.activeTab === "overview" ? (
              <div className="nt-stack nt-gap-3_5">
                <div className="nt-autofit nt-gap-2_5" style={AUTOFIT_180}>
                  {metricTile("创建时间", formatShanghaiDateTime(credential.createdAt))}
                  {metricTile("更新时间", formatShanghaiDateTime(credential.updatedAt))}
                  {metricTile("失败次数", String(credential.failureCount))}
                  {metricTile("冷却截止", formatShanghaiDateTime(credential.cooldownUntil))}
                  {metricTile("最近健康检查", formatShanghaiDateTime(credential.lastHealthCheckAt))}
                  {metricTile("存储模式", credential.storageMode)}
                </div>

                <div className="nt-autofit nt-gap-3_5" style={AUTOFIT_260}>
                  <NtPanel className="nt-stack nt-gap-2">
                    <span className="nt-kicker">共享上游信息</span>
                    <span className="nt-text-hint">
                      credentialMaterialKey：{credential.credentialMaterialKey ?? "—"}
                    </span>
                    <span className="nt-text-hint">
                      selectedDisplayModel：{credential.selectedDisplayModel ?? "—"}
                    </span>
                    <span className="nt-text-hint">baseUrl：{credential.sharedPayloadHints.baseUrl ?? "—"}</span>
                    <span className="nt-text-hint">
                      defaultModel：{credential.sharedPayloadHints.defaultModel ?? "—"}
                    </span>
                    <span className="nt-text-hint">
                      accountLabel：{credential.sharedPayloadHints.accountLabel ?? "—"}
                    </span>
                  </NtPanel>

                  <NtPanel className="nt-stack nt-gap-2">
                    <span className="nt-kicker">同步与生命周期</span>
                    <span className="nt-text-hint">sourcePath：{credential.sourcePath ?? "—"}</span>
                    <span className="nt-text-hint">sourceHash：{credential.sourceHash ?? "—"}</span>
                    <span className="nt-text-hint">syncMode：{credential.syncMode}</span>
                    <span className="nt-text-hint">syncState：{credential.syncState}</span>
                    <span className={credential.syncError ? "nt-text-danger" : "nt-text-hint"}>
                      syncError：{credential.syncError ?? "—"}
                    </span>
                    <span className={credential.lastError ? "nt-text-danger" : "nt-text-hint"}>
                      lastError：{credential.lastError ?? "—"}
                    </span>
                  </NtPanel>

                  {isLumalabs ? (
                    <NtPanel className="nt-stack nt-gap-2">
                      <span className="nt-kicker">Luma Reverse-Web 合同</span>
                      {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => {
                        const configuredValue = lumalabsConfigured[field.key];
                        const resolvedValue = lumalabsResolved[field.key];
                        return (
                          <span key={field.key} className="nt-text-hint">
                            {field.label}：{resolvedValue}
                            {configuredValue ? "" : "（默认）"}
                          </span>
                        );
                      })}
                    </NtPanel>
                  ) : null}
                </div>

                <QuotaOverview credential={credential} />
              </div>
            ) : null}
            {props.activeTab === "models" ? (
              <div className="nt-stack nt-gap-3_5">
                <NtPanel className="nt-stack nt-gap-2_5">
                  <span className="nt-kicker">凭证模型视图</span>
                  <strong className="nt-text-strong">从共享配置和凭证 JSON 推导模型声明</strong>
                  <span className="nt-text-muted">
                    这个视图用于在摘要卡片之外快速核对当前凭证声明了哪些默认模型、可用模型和排除模型。
                  </span>
                </NtPanel>

                {modelBuckets.length ? (
                  modelBuckets.map((bucket) => (
                    <NtPanel key={bucket.label} className="nt-stack nt-gap-2_5">
                      <span className="nt-kicker">{bucket.label}</span>
                      <div className="nt-flex nt-gap-2 nt-wrap">
                        {bucket.values.map((value) => (
                          <NtBadge key={`${bucket.label}-${value}`} tone={bucket.label === "排除模型" ? "warning" : "glass"}>
                            {value}
                          </NtBadge>
                        ))}
                      </div>
                    </NtPanel>
                  ))
                ) : (
                  <NtCard className="nt-panel nt-stack nt-gap-2">
                    <span className="nt-kicker">模型</span>
                    <strong className="nt-text-strong">当前未从凭证中解析到显式模型声明</strong>
                    <span className="nt-text-muted">
                      这通常表示模型能力主要由服务商共享配置或外部别名矩阵决定。
                    </span>
                  </NtCard>
                )}
              </div>
            ) : null}

            {props.activeTab === "json" ? (
              <div className="nt-stack nt-gap-3_5">
                <NtPanel className="nt-stack nt-gap-2">
                  <span className="nt-kicker">认证文件信息 (info)</span>
                  <NtTextarea
                    className="nt-mono nt-resize-y"
                    readOnly
                    rows={14}
                    value={prettyJson(buildInfoPreview(credential))}
                  />
                </NtPanel>

                <NtPanel className="nt-stack nt-gap-2">
                  <span className="nt-kicker">认证文件 JSON (脱敏预览)</span>
                  <NtTextarea
                    className="nt-mono nt-resize-y"
                    readOnly
                    rows={18}
                    value={prettyJson(credential.credential)}
                  />
                </NtPanel>
              </div>
            ) : null}

            {props.activeTab === "edit" ? (
              <form action={patchGatewayProviderCredentialAction} className="nt-stack nt-gap-3_5">
                <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
                <input name="providerCredentialId" type="hidden" value={credential.id} />
                <input name="redirectTo" type="hidden" value={props.redirectTo} />

                <div className="nt-autofit nt-gap-3" style={AUTOFIT_200}>
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">显示名</span>
                    <NtInput defaultValue={credential.label} name="label" />
                  </label>
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">状态</span>
                    <NtInput defaultValue={credential.status} name="status" />
                  </label>
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">来源类型</span>
                    <NtInput defaultValue={credential.sourceKind} name="sourceKind" />
                  </label>
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">同步模式</span>
                    <NtInput defaultValue={credential.syncMode} name="syncMode" />
                  </label>
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">同步状态</span>
                    <NtInput defaultValue={credential.syncState} name="syncState" />
                  </label>
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">来源路径</span>
                    <NtInput defaultValue={credential.sourcePath ?? ""} name="sourcePath" />
                  </label>
                </div>

                {isLumalabs ? (
                  <NtPanel className="nt-stack nt-gap-2_5">
                    <span className="nt-kicker">Luma Reverse-Web 合同</span>
                    <span className="nt-text-muted">
                      这些字段会覆盖 JSON 中的 `extraBody.*ActionType` 与 `extraBody.*ArtifactField`。留空表示删除显式 override，回退到平台默认值。
                    </span>
                    <div className="nt-autofit nt-gap-3" style={AUTOFIT_220}>
                      {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => (
                        <label key={field.key} className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">{field.label}</span>
                          <NtInput
                            defaultValue={lumalabsConfigured[field.key] ?? ""}
                            name={field.key}
                            placeholder={field.placeholder}
                          />
                          <span className="nt-text-muted nt-text-xs">
                            {field.description} 默认：{field.fallbackValue}
                          </span>
                        </label>
                      ))}
                    </div>
                  </NtPanel>
                ) : null}

                <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap">
                  <span className="nt-text-muted">这里只显示未脱敏凭证，仅平台 operator 可见。</span>
                  <button className="nt-btn nt-btn--primary" type="submit">
                    保存凭证
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProviderCredentialBrowserClient(props: ProviderCredentialBrowserClientProps) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState("9");
  const [sortKey, setSortKey] = useState<CredentialSortKey>("updated_desc");
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<CredentialDetailTab>("overview");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, pageSize, sortKey, showOnlyProblems]);

  useEffect(() => {
    if (!selectedCredentialId) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCredentialId(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCredentialId]);

  const indexedCredentials = useMemo(() => props.credentials.map(indexCredential), [props.credentials]);
  const problemCount = useMemo(
    () => indexedCredentials.reduce((total, entry) => (entry.issue ? total + 1 : total), 0),
    [indexedCredentials],
  );

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredCredentials = useMemo(() => {
    const matches = indexedCredentials.filter((entry) => {
      if (showOnlyProblems && !entry.issue) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return entry.searchText.includes(normalizedSearch);
    });
    return matches.sort(compareIndexed(sortKey));
  }, [indexedCredentials, normalizedSearch, showOnlyProblems, sortKey]);

  const pageSizeValue = Number.parseInt(pageSize, 10) || 9;
  const totalPages = Math.max(1, Math.ceil(filteredCredentials.length / pageSizeValue));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSizeValue;
  const pagedCredentials = filteredCredentials.slice(pageStart, pageStart + pageSizeValue);
  const selectedCredential =
    props.credentials.find((credential) => credential.id === selectedCredentialId) ?? null;

  const openDetail = useCallback((credentialId: string, tab: CredentialDetailTab = "overview") => {
    setSelectedCredentialId(credentialId);
    setDetailTab(tab);
  }, []);

  const closeDetail = useCallback(() => setSelectedCredentialId(null), []);

  return (
    <div className="nt-stack nt-gap-4">
      <NtCard className="nt-panel nt-stack nt-gap-3_5">
        <div className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">凭证浏览器</span>
          <strong className="nt-text-strong nt-credential-title">分页摘要卡片</strong>
          <span className="nt-text-muted">
            默认只展示必要摘要，避免凭证数量上来后整页失控。完整信息统一放进 `查看` 详情层。
          </span>
        </div>

        <div className="nt-autofit nt-gap-3" style={AUTOFIT_220}>
          <label className="nt-stack nt-gap-1_5">
            <span className="nt-kicker">搜索凭证</span>
            <NtInput
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="输入名称、路径、模型或状态关键字"
              value={search}
            />
          </label>

          <label className="nt-stack nt-gap-1_5">
            <span className="nt-kicker">单页数量</span>
            <NtSelect onChange={(event) => setPageSize(event.currentTarget.value)} value={pageSize}>
              <option value="9">9</option>
              <option value="18">18</option>
              <option value="27">27</option>
              <option value="54">54</option>
            </NtSelect>
          </label>

          <label className="nt-stack nt-gap-1_5">
            <span className="nt-kicker">排序</span>
            <NtSelect onChange={(event) => setSortKey(event.currentTarget.value as CredentialSortKey)} value={sortKey}>
              <option value="updated_desc">最近更新</option>
              <option value="problem_first">异常优先</option>
              <option value="quota_worst">额度风险优先</option>
              <option value="label_asc">按名称排序</option>
            </NtSelect>
          </label>
        </div>

        <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap">
          <div className="nt-flex nt-gap-2 nt-wrap">
            <NtBadge tone="glass">总计 {props.credentials.length} 条</NtBadge>
            <NtBadge tone="glass">当前命中 {filteredCredentials.length} 条</NtBadge>
            <NtBadge tone={problemCount ? "warning" : "glass"}>异常 {problemCount} 条</NtBadge>
          </div>
          <button
            className={`nt-btn ${showOnlyProblems ? "nt-btn--primary" : "nt-btn--secondary"}`}
            onClick={() => setShowOnlyProblems((value) => !value)}
            type="button"
          >
            {showOnlyProblems ? "显示全部凭证" : "仅显示异常凭证"}
          </button>
        </div>
      </NtCard>

      {filteredCredentials.length ? (
        <>
          <div className="nt-stack nt-gap-3_5" style={CARD_GRID_STYLE}>
            {pagedCredentials.map((entry) => (
              <CredentialSummaryCard key={entry.credential.id} entry={entry} onView={openDetail} />
            ))}
          </div>

          <NtCard className="nt-panel nt-flex nt-justify-between nt-gap-3 nt-wrap nt-items-center">
            <span className="nt-text-muted">
              第 {safeCurrentPage} / {totalPages} 页，当前显示 {pagedCredentials.length} 条，共 {filteredCredentials.length} 条结果
            </span>
            <div className="nt-flex nt-gap-2_5 nt-wrap">
              <button
                className="nt-btn nt-btn--secondary"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="nt-btn nt-btn--secondary"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                type="button"
              >
                下一页
              </button>
            </div>
          </NtCard>
        </>
      ) : (
        <NtCard className="nt-panel nt-stack nt-gap-2">
          <span className="nt-kicker">服务商凭证</span>
          <strong className="nt-text-strong">
            {props.credentials.length ? "当前筛选条件下没有结果" : "当前还没有任何真实凭证"}
          </strong>
          <span className="nt-text-muted">
            {props.credentials.length
              ? "你可以放宽搜索条件，或者切回全部凭证。"
              : "你可以点击新增凭证，或通过文件夹同步导入现有认证文件。"}
          </span>
        </NtCard>
      )}

      {selectedCredential ? (
        <CredentialDetailDialog
          activeTab={detailTab}
          credential={selectedCredential}
          onChangeTab={setDetailTab}
          onClose={closeDetail}
          providerAccountId={props.providerAccountId}
          providerAdapter={props.providerAdapter}
          redirectTo={props.redirectTo}
        />
      ) : null}
    </div>
  );
}
