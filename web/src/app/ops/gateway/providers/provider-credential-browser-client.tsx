"use client";

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
import {
  deleteGatewayProviderCredentialAction,
  patchGatewayProviderCredentialAction,
  refreshGatewayProviderCredentialQuotaAction,
  toggleGatewayProviderCredentialStatusAction,
} from "./[providerAccountId]/credentials/actions";
import { useDeferredValue, useEffect, useState } from "react";
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
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
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

function buildSearchText(credential: GatewayProviderCredentialView) {
  const modelText = extractModelBuckets(credential)
    .flatMap((bucket) => bucket.values)
    .join(" ");
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

function sortCredentials(list: GatewayProviderCredentialView[], sortKey: CredentialSortKey) {
  return [...list].sort((left, right) => {
    if (sortKey === "label_asc") {
      return left.label.localeCompare(right.label, "zh-CN");
    }
    if (sortKey === "problem_first") {
      const severity = problemSeverityRank(left) - problemSeverityRank(right);
      if (severity !== 0) {
        return severity;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    if (sortKey === "quota_worst") {
      const severity = quotaSeverityRank(left.providerQuota?.status) - quotaSeverityRank(right.providerQuota?.status);
      if (severity !== 0) {
        return severity;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function sanitizeFilename(value: string) {
  return value.replace(/[<>:\"/\\\\|?*\\x00-\\x1F]/g, "-").trim();
}

function resolveCredentialFilename(credential: GatewayProviderCredentialView) {
  const sourcePath = credential.sourcePath?.trim() ?? "";
  if (sourcePath) {
    const segments = sourcePath.split(/[\\\\/]/).filter(Boolean);
    const candidate = segments[segments.length - 1];
    if (candidate) {
      return candidate.endsWith(".json") ? candidate : `${candidate}.json`;
    }
  }
  const fallback = sanitizeFilename(credential.label || credential.id);
  return `${fallback || credential.id}.json`;
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

function modelSummary(credential: GatewayProviderCredentialView) {
  const buckets = extractModelBuckets(credential);
  const firstBucket = buckets.find((bucket) => bucket.label !== "排除模型") ?? buckets[0] ?? null;
  if (!firstBucket) {
    return "未声明模型";
  }
  return firstBucket.values.slice(0, 2).join(" / ");
}

function metricLabel(title: string, value: string) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <span className="nt-kicker">{title}</span>
      <strong
        style={{
          color: "rgba(243,245,247,0.96)",
          fontSize: "0.95rem",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function CredentialSummaryCard(props: {
  credential: GatewayProviderCredentialView;
  onView: (credentialId: string, tab?: CredentialDetailTab) => void;
}) {
  const { credential } = props;
  const issue = hasCredentialIssue(credential);
  return (
    <NtCard
      style={{
        display: "grid",
        gap: 14,
        minHeight: 248,
        padding: 18,
        borderColor: issue ? "rgba(245, 158, 11, 0.24)" : undefined,
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NtBadge tone={credentialTone(credential.status)}>{credential.status}</NtBadge>
          <NtBadge tone={quotaTone(credential.providerQuota?.status)}>
            {credential.providerQuota?.status ?? "未探测额度"}
          </NtBadge>
          <NtBadge tone="glass">{credential.sourceKind}</NtBadge>
        </div>
        <strong
          style={{
            color: "rgba(243,245,247,0.96)",
            fontSize: "1rem",
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {credential.label}
        </strong>
        <span style={{ color: "rgba(190,199,217,0.72)", fontSize: "0.86rem", wordBreak: "break-all" }}>
          {credential.sourcePath ?? credential.id}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {metricLabel("模型", modelSummary(credential))}
        {metricLabel("更新时间", formatShanghaiDateTime(credential.updatedAt))}
        {metricLabel("失败次数", String(credential.failureCount))}
        {metricLabel("同步", credential.syncState)}
      </div>

      <NtPanel
        style={{
          display: "grid",
          gap: 6,
          padding: 12,
          borderColor: issue ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.08)",
          background: issue ? "rgba(63, 32, 7, 0.34)" : "rgba(255,255,255,0.03)",
        }}
      >
        <span className="nt-kicker">{issue ? "异常摘要" : "运行摘要"}</span>
        <span
          style={{
            color: issue ? "#fcd34d" : "rgba(214,219,233,0.82)",
            fontSize: "0.92rem",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {summarizeIssue(credential)}
        </span>
      </NtPanel>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: "auto" }}>
        <button className="nt-btn nt-btn--primary" type="button" onClick={() => props.onView(credential.id, "overview")}>
          查看
        </button>
        <span style={{ color: "rgba(190,199,217,0.72)", fontSize: "0.84rem" }}>
          {credential.providerQuota?.representativeClaim ?? "点查看可展开完整详情"}
        </span>
      </div>
    </NtCard>
  );
}

function QuotaOverview(props: { credential: GatewayProviderCredentialView }) {
  const quota = props.credential.providerQuota;
  if (!quota) {
    return (
      <NtPanel style={{ display: "grid", gap: 6 }}>
        <span className="nt-kicker">凭证额度</span>
        <strong style={{ color: "rgba(243,245,247,0.96)" }}>当前未读取到额度快照</strong>
        <span style={{ color: "rgba(190,199,217,0.76)" }}>
          你可以在上方使用 `刷新额度` 重新触发探测。
        </span>
      </NtPanel>
    );
  }

  return (
    <NtPanel style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <span className="nt-kicker">凭证额度</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NtBadge tone={quotaTone(quota.status)}>{quota.status}</NtBadge>
          {quota.planType ? <NtBadge tone="glass">{quota.planType}</NtBadge> : null}
        </div>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          代表性结论：{quota.representativeClaim ?? "—"}
        </span>
        <span style={{ color: "rgba(214,219,233,0.72)" }}>
          最近检查：{formatShanghaiDateTime(quota.checkedAt)} / 下次建议检查：{formatShanghaiDateTime(quota.nextCheckAt)}
        </span>
      </div>

      {quota.windows.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {quota.windows.map((window) => (
            <div
              key={`${quota.providerAccountId}-${window.key}`}
              style={{
                display: "grid",
                gap: 4,
                padding: "10px 12px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <span className="nt-kicker">{window.label}</span>
              <strong style={{ color: "rgba(243,245,247,0.96)" }}>
                已用 {window.usedPercent != null ? `${window.usedPercent.toFixed(0)}%` : "—"}
              </strong>
              <span style={{ color: "rgba(214,219,233,0.78)" }}>
                剩余 {window.remainingRatio != null ? `${Math.round(window.remainingRatio * 100)}%` : "—"}
              </span>
              <span style={{ color: "rgba(214,219,233,0.72)" }}>
                重置 {formatShanghaiDateTime(window.resetAt)}
              </span>
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
  const modelBuckets = extractModelBuckets(credential);
  const isLumalabs = isLumalabsCompatibleAdapter(props.providerAdapter);
  const lumalabsConfigured = readConfiguredLumalabsContract(credential.credential);
  const lumalabsResolved = resolveLumalabsContract(credential.credential);

  function handleDownload() {
    const blob = new Blob([prettyJson(credential.credential)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = resolveCredentialFilename(credential);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <button
        aria-label="关闭凭证详情"
        onClick={props.onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: 0,
          background: "rgba(5, 7, 10, 0.7)",
          backdropFilter: "blur(10px)",
        }}
        type="button"
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: 16,
          width: "min(1180px, calc(100vw - 40px))",
          maxHeight: "min(88vh, 960px)",
          overflow: "hidden",
          padding: 22,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.1)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)), rgba(11, 14, 19, 0.96)",
          boxShadow: "0 28px 80px rgba(0, 0, 0, 0.44)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NtBadge tone={credentialTone(credential.status)}>{credential.status}</NtBadge>
              <NtBadge tone={quotaTone(credential.providerQuota?.status)}>
                {credential.providerQuota?.status ?? "未探测额度"}
              </NtBadge>
              <NtBadge tone="glass">{credential.sourceKind}</NtBadge>
              <NtBadge tone="glass">{credential.syncState}</NtBadge>
            </div>
            <h3 style={{ margin: 0, color: "rgba(243,245,247,0.98)", fontSize: "1.42rem", lineHeight: 1.15 }}>
              认证文件详情 / 编辑 - {credential.label}
            </h3>
            <span style={{ color: "rgba(190,199,217,0.76)", wordBreak: "break-all" }}>
              {credential.sourcePath ?? credential.id}
            </span>
          </div>
          <button className="nt-btn nt-btn--outline" type="button" onClick={props.onClose}>
            关闭
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className={`nt-btn ${props.activeTab === "models" ? "nt-btn--primary" : "nt-btn--secondary"}`}
            type="button"
            onClick={() => props.onChangeTab("models")}
          >
            查看凭证模型
          </button>
          <button className="nt-btn nt-btn--secondary" type="button" onClick={handleDownload}>
            下载凭证
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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "overview", label: "总览" },
            { key: "models", label: "模型" },
            { key: "json", label: "JSON" },
            { key: "edit", label: "编辑" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`nt-btn ${props.activeTab === tab.key ? "nt-btn--primary" : "nt-btn--secondary"}`}
              onClick={() => props.onChangeTab(tab.key as CredentialDetailTab)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ overflow: "auto", paddingRight: 4 }}>
          {props.activeTab === "overview" ? (
            <div style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                {metricLabel("创建时间", formatShanghaiDateTime(credential.createdAt))}
                {metricLabel("更新时间", formatShanghaiDateTime(credential.updatedAt))}
                {metricLabel("失败次数", String(credential.failureCount))}
                {metricLabel("冷却截止", formatShanghaiDateTime(credential.cooldownUntil))}
                {metricLabel("最近健康检查", formatShanghaiDateTime(credential.lastHealthCheckAt))}
                {metricLabel("存储模式", credential.storageMode)}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 14,
                }}
              >
                <NtPanel style={{ display: "grid", gap: 8 }}>
                  <span className="nt-kicker">共享上游信息</span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>
                    credentialMaterialKey：{credential.credentialMaterialKey ?? "—"}
                  </span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>
                    selectedDisplayModel：{credential.selectedDisplayModel ?? "—"}
                  </span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>
                    baseUrl：{credential.sharedPayloadHints.baseUrl ?? "—"}
                  </span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>
                    defaultModel：{credential.sharedPayloadHints.defaultModel ?? "—"}
                  </span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>
                    accountLabel：{credential.sharedPayloadHints.accountLabel ?? "—"}
                  </span>
                </NtPanel>

                <NtPanel style={{ display: "grid", gap: 8 }}>
                  <span className="nt-kicker">同步与生命周期</span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>sourcePath：{credential.sourcePath ?? "—"}</span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>sourceHash：{credential.sourceHash ?? "—"}</span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>syncMode：{credential.syncMode}</span>
                  <span style={{ color: "rgba(214,219,233,0.84)" }}>syncState：{credential.syncState}</span>
                  <span style={{ color: credential.syncError ? "#fecdd3" : "rgba(214,219,233,0.84)" }}>
                    syncError：{credential.syncError ?? "—"}
                  </span>
                  <span style={{ color: credential.lastError ? "#fecdd3" : "rgba(214,219,233,0.84)" }}>
                    lastError：{credential.lastError ?? "—"}
                  </span>
                </NtPanel>

                {isLumalabs ? (
                  <NtPanel style={{ display: "grid", gap: 8 }}>
                    <span className="nt-kicker">Luma Reverse-Web 合同</span>
                    {LUMALABS_CONTRACT_FIELD_DEFINITIONS.map((field) => {
                      const configuredValue = lumalabsConfigured[field.key];
                      const resolvedValue = lumalabsResolved[field.key];
                      return (
                        <span key={field.key} style={{ color: "rgba(214,219,233,0.84)" }}>
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
            <div style={{ display: "grid", gap: 14 }}>
              <NtPanel style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">凭证模型视图</span>
                <strong style={{ color: "rgba(243,245,247,0.96)" }}>从共享配置和凭证 JSON 推导模型声明</strong>
                <span style={{ color: "rgba(190,199,217,0.76)" }}>
                  这个视图用于在摘要卡片之外快速核对当前凭证声明了哪些默认模型、可用模型和排除模型。
                </span>
              </NtPanel>

              {modelBuckets.length ? (
                modelBuckets.map((bucket) => (
                  <NtPanel key={bucket.label} style={{ display: "grid", gap: 10 }}>
                    <span className="nt-kicker">{bucket.label}</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {bucket.values.map((value) => (
                        <NtBadge key={`${bucket.label}-${value}`} tone={bucket.label === "排除模型" ? "warning" : "glass"}>
                          {value}
                        </NtBadge>
                      ))}
                    </div>
                  </NtPanel>
                ))
              ) : (
                <NtCard style={{ display: "grid", gap: 8 }}>
                  <span className="nt-kicker">模型</span>
                  <strong style={{ color: "rgba(243,245,247,0.96)" }}>当前未从凭证中解析到显式模型声明</strong>
                  <span style={{ color: "rgba(190,199,217,0.76)" }}>
                    这通常表示模型能力主要由服务商共享配置或外部别名矩阵决定。
                  </span>
                </NtCard>
              )}
            </div>
          ) : null}

          {props.activeTab === "json" ? (
            <div style={{ display: "grid", gap: 14 }}>
              <NtPanel style={{ display: "grid", gap: 8 }}>
                <span className="nt-kicker">认证文件信息 (info)</span>
                <NtTextarea
                  readOnly
                  rows={14}
                  style={{ fontFamily: "monospace", resize: "vertical" }}
                  value={prettyJson(buildInfoPreview(credential))}
                />
              </NtPanel>

              <NtPanel style={{ display: "grid", gap: 8 }}>
                <span className="nt-kicker">认证文件 JSON (预览)</span>
                <NtTextarea
                  readOnly
                  rows={18}
                  style={{ fontFamily: "monospace", resize: "vertical" }}
                  value={prettyJson(credential.credential)}
                />
              </NtPanel>
            </div>
          ) : null}

          {props.activeTab === "edit" ? (
            <form action={patchGatewayProviderCredentialAction} style={{ display: "grid", gap: 14 }}>
              <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
              <input name="providerCredentialId" type="hidden" value={credential.id} />
              <input name="redirectTo" type="hidden" value={props.redirectTo} />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">显示名</span>
                  <NtInput defaultValue={credential.label} name="label" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">状态</span>
                  <NtInput defaultValue={credential.status} name="status" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">来源类型</span>
                  <NtInput defaultValue={credential.sourceKind} name="sourceKind" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">同步模式</span>
                  <NtInput defaultValue={credential.syncMode} name="syncMode" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">同步状态</span>
                  <NtInput defaultValue={credential.syncState} name="syncState" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">来源路径</span>
                  <NtInput defaultValue={credential.sourcePath ?? ""} name="sourcePath" />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">凭证 JSON</span>
                <NtTextarea
                  defaultValue={prettyJson(credential.credential)}
                  name="credentialJson"
                  rows={18}
                  style={{ fontFamily: "monospace", resize: "vertical" }}
                />
              </label>

              {isLumalabs ? (
                <NtPanel style={{ display: "grid", gap: 10 }}>
                  <span className="nt-kicker">Luma Reverse-Web 合同</span>
                  <span style={{ color: "rgba(190,199,217,0.76)" }}>
                    这些字段会覆盖 JSON 中的 `extraBody.*ActionType` 与 `extraBody.*ArtifactField`。留空表示删除显式 override，回退到平台默认值。
                  </span>
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
                        <NtInput
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
                </NtPanel>
              ) : null}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "rgba(190,199,217,0.76)" }}>
                  这里只显示未脱敏凭证，仅平台 operator 可见。
                </span>
                <button className="nt-btn nt-btn--primary" type="submit">
                  保存凭证
                </button>
              </div>
            </form>
          ) : null}
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

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredCredentials = sortCredentials(
    props.credentials.filter((credential) => {
      if (showOnlyProblems && !hasCredentialIssue(credential)) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return buildSearchText(credential).includes(normalizedSearch);
    }),
    sortKey,
  );

  const pageSizeValue = Number.parseInt(pageSize, 10) || 9;
  const totalPages = Math.max(1, Math.ceil(filteredCredentials.length / pageSizeValue));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSizeValue;
  const pagedCredentials = filteredCredentials.slice(pageStart, pageStart + pageSizeValue);
  const selectedCredential = props.credentials.find((credential) => credential.id === selectedCredentialId) ?? null;
  const problemCount = props.credentials.filter((credential) => hasCredentialIssue(credential)).length;

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  function openDetail(credentialId: string, tab: CredentialDetailTab = "overview") {
    setSelectedCredentialId(credentialId);
    setDetailTab(tab);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <NtCard style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">凭证浏览器</span>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.04rem" }}>
            分页摘要卡片
          </strong>
          <span style={{ color: "rgba(190,199,217,0.76)" }}>
            默认只展示必要摘要，避免凭证数量上来后整页失控。完整信息统一放进 `查看` 详情层。
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">搜索凭证</span>
            <NtInput
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="输入名称、路径、模型或状态关键字"
              value={search}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">单页数量</span>
            <NtSelect onChange={(event) => setPageSize(event.currentTarget.value)} value={pageSize}>
              <option value="9">9</option>
              <option value="18">18</option>
              <option value="27">27</option>
              <option value="54">54</option>
            </NtSelect>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">排序</span>
            <NtSelect onChange={(event) => setSortKey(event.currentTarget.value as CredentialSortKey)} value={sortKey}>
              <option value="updated_desc">最近更新</option>
              <option value="problem_first">异常优先</option>
              <option value="quota_worst">额度风险优先</option>
              <option value="label_asc">按名称排序</option>
            </NtSelect>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {pagedCredentials.map((credential) => (
              <CredentialSummaryCard key={credential.id} credential={credential} onView={openDetail} />
            ))}
          </div>

          <NtCard style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "rgba(190,199,217,0.76)" }}>
              第 {safeCurrentPage} / {totalPages} 页，当前显示 {pagedCredentials.length} 条，共 {filteredCredentials.length} 条结果
            </span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="nt-btn nt-btn--secondary"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="nt-btn nt-btn--secondary"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                type="button"
              >
                下一页
              </button>
            </div>
          </NtCard>
        </>
      ) : (
        <NtCard style={{ display: "grid", gap: 8 }}>
          <span className="nt-kicker">服务商凭证</span>
          <strong style={{ color: "rgba(243,245,247,0.96)" }}>
            {props.credentials.length ? "当前筛选条件下没有结果" : "当前还没有任何真实凭证"}
          </strong>
          <span style={{ color: "rgba(190,199,217,0.76)" }}>
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
          onClose={() => setSelectedCredentialId(null)}
          providerAccountId={props.providerAccountId}
          providerAdapter={props.providerAdapter}
          redirectTo={props.redirectTo}
        />
      ) : null}
    </div>
  );
}
