import type { GatewayProviderCredentialFolderSyncStatusView, GatewayProviderCredentialView } from "@/lib/account-client";
import { NtBadge, NtCard, type NtBadgeTone } from "@/components/nt-primitives";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  exportGatewayProviderCredentialsToFolderAction,
  importGatewayProviderCredentialsFromFolderAction,
  toggleGatewayProviderCredentialFolderSyncAction,
} from "./[providerAccountId]/credentials/actions";
import { ProviderCredentialBrowserClient } from "./provider-credential-browser-client";
import { formatShanghaiDateTime } from "./provider-inventory-ui";

/*
 * Layout, gaps and color now come from the shared `nt-` utility layer, so these constants keep
 * only what the vocabulary has no class for: the pill/callout geometry of the explicit-delete
 * audit trail, the 18px stack step, and two one-off type sizes. Module scope means one
 * allocation per process instead of one per render.
 */
const INLINE_CODE_STYLE: CSSProperties = { marginInline: 4 };

const EXPLICIT_DELETE_CALLOUT_STYLE: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  background: "var(--neuro-yellow-soft)",
  border: "1px solid var(--neuro-yellow-line)",
};

const AUDIT_EVENT_STYLE: CSSProperties = {
  borderRadius: 14,
  border: "1px solid var(--neuro-yellow-line)",
  background: "var(--neuro-control)",
  padding: "10px 12px",
};

const AUDIT_SUMMARY_STYLE: CSSProperties = { cursor: "pointer" };

const AUDIT_EVENT_BODY_STYLE: CSSProperties = { marginTop: 12 };

const CODE_CHIP_STYLE: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "var(--neuro-control)",
};

const EVENT_ID_CHIP_STYLE: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "var(--neuro-yellow-soft)",
};

const CREDENTIALS_SECTION_STYLE: CSSProperties = { scrollMarginTop: 24 };

const CREDENTIAL_BROWSER_STACK_STYLE: CSSProperties = { gap: 18 };

function FolderSyncPanel(props: {
  providerAccountId: string;
  redirectTo: string;
  status: GatewayProviderCredentialFolderSyncStatusView;
}) {
  const rootConfigured = Boolean(props.status.rootDir?.trim());
  const watchTone: NtBadgeTone = props.status.watchRunning
    ? props.status.enabled
      ? "success"
      : "glass"
    : props.status.watchEnabled
      ? "warning"
      : "glass";
  const watchLabel = props.status.watchRunning
    ? props.status.enabled
      ? "文件系统监听中"
      : "监听待命"
    : props.status.watchEnabled
      ? "监听待降级"
      : "监听关闭";
  const lastExplicitDeleteSummary = props.status.lastExplicitDeleteAt
    ? `${formatShanghaiDateTime(props.status.lastExplicitDeleteAt)} / ${props.status.lastExplicitDeleteCount} 条`
    : "—";
  const recentExplicitDeleteEvents = props.status.recentExplicitDeleteEvents ?? [];

  return (
    <NtCard className="nt-stack nt-gap-3_5">
      <div className="nt-stack nt-gap-1_5">
        <span className="nt-kicker">文件夹同步模式</span>
        <strong className="nt-text-strong nt-text-lg">数据库与挂载目录双向同步</strong>
        <span className="nt-text-muted">
          这个模式默认可关闭。启用后，网关会优先监听文件系统事件，把目录中新出现或更新的凭证即时导回数据库，并保留周期性全量重扫作为兜底恢复。默认根目录是当前运行用户的
          <code style={INLINE_CODE_STYLE}>~/.neuro</code>，不同服务商按
          <code style={INLINE_CODE_STYLE}>&lt;provider-family&gt;</code>
          子目录归档。
        </span>
      </div>
      <div className="nt-stack nt-gap-1_5">
        <div className="nt-flex nt-gap-2 nt-wrap">
          <NtBadge tone={props.status.enabled ? "success" : "warning"}>
            {props.status.enabled ? "已启用" : "未启用"}
          </NtBadge>
          <NtBadge tone={watchTone}>
            {watchLabel}
          </NtBadge>
          <NtBadge tone={props.status.importEnabled ? "success" : "glass"}>
            {props.status.importEnabled ? "允许导入" : "导入关闭"}
          </NtBadge>
          <NtBadge tone={props.status.exportEnabled ? "success" : "glass"}>
            {props.status.exportEnabled ? "允许导出" : "导出关闭"}
          </NtBadge>
          {props.status.deleteMissing ? <NtBadge tone="warning">缺失文件将清理</NtBadge> : null}
        </div>
        <span className="nt-text-muted">根目录：{props.status.rootDir ?? "—"}</span>
        <span className="nt-text-muted">
          兜底重扫间隔：{props.status.intervalSeconds != null ? `${props.status.intervalSeconds}s` : "—"}
        </span>
        <span className="nt-text-muted">
          监听去抖：{props.status.watchDebounceMillis != null ? `${props.status.watchDebounceMillis}ms` : "—"}
        </span>
        <span className="nt-text-muted">
          最近运行：{formatShanghaiDateTime(props.status.lastRunAt)}
        </span>
        <span className="nt-text-muted">
          最近导入 / 导出：{formatShanghaiDateTime(props.status.lastImportAt)} / {formatShanghaiDateTime(props.status.lastExportAt)}
        </span>
        <span className="nt-text-muted">
          最近监听事件：{formatShanghaiDateTime(props.status.lastWatchEventAt)}
        </span>
        <span
          className={props.status.lastExplicitDeleteCount > 0 ? "nt-text-warn" : "nt-text-muted"}
        >
          最近显式删库命中：{lastExplicitDeleteSummary}
        </span>
        <span className={props.status.lastError ? "nt-text-danger" : "nt-text-muted"}>
          最近同步错误：{props.status.lastError ?? "—"}
        </span>
        <span className={props.status.lastWatchError ? "nt-text-danger" : "nt-text-muted"}>
          最近监听错误：{props.status.lastWatchError ?? "—"}
        </span>
        <span className="nt-text-muted">
          本轮统计：新增 {props.status.importedCount} / 更新 {props.status.updatedCount} / 导出 {props.status.exportedCount} / 删除 {props.status.deletedCount} / 跳过 {props.status.skippedCount}
        </span>
        {props.status.lastExplicitDeletePaths.length ? (
          <div className="nt-stack nt-gap-2" style={EXPLICIT_DELETE_CALLOUT_STYLE}>
            <span className="nt-text-warn nt-text-sm">
              最近一次显式删除命中路径
            </span>
            <div className="nt-flex nt-gap-2 nt-wrap">
              {props.status.lastExplicitDeletePaths.map((path) => (
                <code
                  key={path}
                  className="nt-text-warn"
                  style={CODE_CHIP_STYLE}
                >
                  {path}
                </code>
              ))}
            </div>
          </div>
        ) : null}
        {recentExplicitDeleteEvents.length ? (
          <div className="nt-stack nt-gap-2_5">
            <span className="nt-text-warn nt-text-sm">
              最近显式删库审计记录
            </span>
            <div className="nt-stack nt-gap-2_5">
              {recentExplicitDeleteEvents.map((event, index) => (
                <details
                  key={event.eventId}
                  open={index === 0}
                  style={AUDIT_EVENT_STYLE}
                >
                  <summary
                    className="nt-text-warn nt-flex nt-gap-2_5 nt-wrap nt-items-center"
                    style={AUDIT_SUMMARY_STYLE}
                  >
                    <strong className="nt-text-md">
                      {formatShanghaiDateTime(event.occurredAt)}
                    </strong>
                    <span>{event.deletedCount} 条命中</span>
                    <code
                      className="nt-text-warn"
                      style={EVENT_ID_CHIP_STYLE}
                    >
                      {event.eventId}
                    </code>
                  </summary>
                  <div className="nt-stack nt-gap-2_5" style={AUDIT_EVENT_BODY_STYLE}>
                    <span className="nt-text-muted">
                      事件 ID：<code>{event.eventId}</code>
                    </span>
                    <span className="nt-text-muted">
                      删除时间：{formatShanghaiDateTime(event.occurredAt)}
                    </span>
                    <span className="nt-text-muted">
                      命中条数：{event.deletedCount}
                    </span>
                    <div className="nt-stack nt-gap-1_5">
                      <span className="nt-text-muted">受影响凭证 ID</span>
                      <div className="nt-flex nt-gap-2 nt-wrap">
                        {event.providerCredentialIds.map((credentialId) => (
                          <code
                            key={credentialId}
                            className="nt-text-strong"
                            style={CODE_CHIP_STYLE}
                          >
                            {credentialId}
                          </code>
                        ))}
                      </div>
                    </div>
                    <div className="nt-stack nt-gap-1_5">
                      <span className="nt-text-muted">删除路径</span>
                      <div className="nt-flex nt-gap-2 nt-wrap">
                        {event.deletedPaths.map((path) => (
                          <code
                            key={path}
                            className="nt-text-warn"
                            style={CODE_CHIP_STYLE}
                          >
                            {path}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : null}
        {!rootConfigured ? (
          <span className="nt-text-warn">
            尚未配置挂载根目录，当前不能启用自动同步。
          </span>
        ) : null}
      </div>
      <div className="nt-flex nt-gap-2_5 nt-wrap">
        <form action={toggleGatewayProviderCredentialFolderSyncAction}>
          <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
          <input name="nextEnabled" type="hidden" value={props.status.enabled ? "false" : "true"} />
          <button
            className={props.status.enabled ? "nt-btn nt-btn--outline" : "nt-btn nt-btn--primary"}
            disabled={!rootConfigured}
            type="submit"
          >
            {props.status.enabled ? "停用同步模式" : "启用同步模式"}
          </button>
        </form>
        <form action={importGatewayProviderCredentialsFromFolderAction}>
          <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
          <button
            className="nt-btn nt-btn--secondary"
            disabled={!rootConfigured || !props.status.importEnabled}
            type="submit"
          >
            从目录导入
          </button>
        </form>
        <form action={exportGatewayProviderCredentialsToFolderAction}>
          <input name="providerAccountId" type="hidden" value={props.providerAccountId} />
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
          <button
            className="nt-btn nt-btn--secondary"
            disabled={!rootConfigured || !props.status.exportEnabled}
            type="submit"
          >
            写回目录
          </button>
        </form>
      </div>
    </NtCard>
  );
}

export function ProviderCredentialManagementSection(props: {
  providerAccountId: string;
  providerAdapter: string;
  redirectTo: string;
  credentials: GatewayProviderCredentialView[];
  folderSyncStatus: GatewayProviderCredentialFolderSyncStatusView;
}) {
  const createCredentialHref = `/ops/gateway/providers/${encodeURIComponent(props.providerAccountId)}/credentials/create?returnTo=${encodeURIComponent(props.redirectTo)}`;

  return (
    <section className="nt-stack nt-gap-4" id="credentials" style={CREDENTIALS_SECTION_STYLE}>
      <div className="nt-stack nt-gap-2">
        <span className="nt-kicker">服务商详情 / 凭证</span>
        <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap nt-items-center">
          <h2 className="nt-flush nt-text-strong nt-dialog-title">
            服务商凭证
          </h2>
          <Link className="nt-btn nt-btn--primary" href={createCredentialHref}>
            新增凭证
          </Link>
        </div>
      </div>

      <FolderSyncPanel
        providerAccountId={props.providerAccountId}
        redirectTo={props.redirectTo}
        status={props.folderSyncStatus}
      />

      <div className="nt-stack" style={CREDENTIAL_BROWSER_STACK_STYLE}>
        <ProviderCredentialBrowserClient
          credentials={props.credentials}
          providerAccountId={props.providerAccountId}
          providerAdapter={props.providerAdapter}
          redirectTo={props.redirectTo}
        />
      </div>
    </section>
  );
}
