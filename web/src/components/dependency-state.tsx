import type { CSSProperties } from "react";

import { NtBadge, NtCard, type NtBadgeTone } from "@/components/nt-primitives";
import {
  normalizeDependencyResult,
  type DependencyFailure,
  type DependencyResult,
  type DependencyResultState,
  type DependencyRetryMetadata,
} from "@/lib/dependency-result";

type DependencyStatePresentation = {
  badge: string;
  headingSuffix: string;
  messageSuffix?: string;
  tone: NtBadgeTone;
};

const presentations: Record<DependencyResultState, DependencyStatePresentation> = {
  ready: {
    badge: "已就绪",
    headingSuffix: "可用",
    messageSuffix: "所需数据已成功加载。",
    tone: "success",
  },
  empty: {
    badge: "暂无内容",
    headingSuffix: "暂无数据",
    messageSuffix: "当前没有可显示的内容。",
    tone: "secondary",
  },
  partial: {
    badge: "部分可用",
    headingSuffix: "仅部分可用",
    tone: "warning",
  },
  unavailable: {
    badge: "暂不可用",
    headingSuffix: "暂不可用",
    tone: "danger",
  },
  unauthorized: {
    badge: "需要授权",
    headingSuffix: "需要授权",
    tone: "warning",
  },
};

const rootStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 16,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0,
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
};

const diagnosticsStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  margin: 0,
  paddingTop: 10,
  borderTop: "1px solid var(--nt-border, rgba(148, 163, 184, 0.22))",
  fontSize: 12,
  lineHeight: 1.5,
};

const diagnosticRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(92px, auto) minmax(0, 1fr)",
  gap: 10,
  margin: 0,
};

const diagnosticValueStyle: CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflowWrap: "anywhere",
};

export type DependencyStateProps<T> = {
  result: DependencyResult<T>;
  label?: string;
  diagnostics?: boolean;
  className?: string;
};

function getFailureMessage(state: DependencyResult<unknown>, fallback: string) {
  if (state.state === "ready" || state.state === "empty") {
    return fallback;
  }
  return state.failures[0].message;
}

function formatRetry(retry: DependencyRetryMetadata | null) {
  if (retry === null) {
    return "不适用";
  }
  if (!retry.retryable) {
    return "不可重试";
  }
  if (retry.retryAfterMs === null) {
    return "可重试，等待时间未提供";
  }
  return `可重试，${retry.retryAfterMs} ms 后`;
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={diagnosticRowStyle}>
      <dt>{label}</dt>
      <dd style={diagnosticValueStyle}>{value}</dd>
    </div>
  );
}

function FailureDiagnostics({ failure, index }: { failure: DependencyFailure; index: number }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <strong>{`失败 ${index + 1}`}</strong>
      <DiagnosticRow label="来源" value={failure.source ?? "未提供"} />
      <DiagnosticRow label="代码" value={failure.code ?? "未提供"} />
      <DiagnosticRow label="诊断" value={failure.diagnostics ?? "未提供"} />
    </div>
  );
}

export function DependencyState<T>({
  result,
  label = "依赖服务",
  diagnostics = false,
  className,
}: DependencyStateProps<T>) {
  const normalized = normalizeDependencyResult(result);
  const presentation = presentations[normalized.state];
  const fallbackMessage = `${label}${presentation.messageSuffix ?? "当前状态受限。"}`;
  const message = getFailureMessage(normalized, fallbackMessage);
  const rootClassName = className ? `nt-card--outlined ${className}` : "nt-card--outlined";

  return (
    <NtCard
      aria-atomic="true"
      aria-live="polite"
      className={rootClassName}
      data-dependency-state={normalized.state}
      role="status"
      style={rootStyle}
    >
      <div style={headerStyle}>
        <h3 style={headingStyle}>{`${label}${presentation.headingSuffix}`}</h3>
        <NtBadge tone={presentation.tone}>{presentation.badge}</NtBadge>
      </div>
      <p style={messageStyle}>{message}</p>
      {diagnostics ? (
        <dl aria-label="依赖诊断信息" style={diagnosticsStyle}>
          <DiagnosticRow label="关联 ID" value={normalized.correlationId ?? "未提供"} />
          <DiagnosticRow label="重试" value={formatRetry(normalized.retry)} />
          {normalized.failures.map((failure, index) => (
            <FailureDiagnostics failure={failure} index={index} key={`${index}-${failure.code ?? "failure"}`} />
          ))}
        </dl>
      ) : null}
    </NtCard>
  );
}
