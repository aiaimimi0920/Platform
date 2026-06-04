import type { GatewayProviderCredentialFolderSyncStatusView, GatewayProviderCredentialView } from "@/lib/account-client";
import { NtBadge, NtCard, type NtBadgeTone } from "@/components/nt-primitives";
import Link from "next/link";

import {
  exportGatewayProviderCredentialsToFolderAction,
  importGatewayProviderCredentialsFromFolderAction,
  toggleGatewayProviderCredentialFolderSyncAction,
} from "./[providerAccountId]/credentials/actions";
import { ProviderCredentialBrowserClient } from "./provider-credential-browser-client";
import { formatShanghaiDateTime } from "./provider-inventory-ui";

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
    <NtCard style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <span className="nt-kicker">文件夹同步模式</span>
        <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.02rem" }}>数据库与挂载目录双向同步</strong>
        <span style={{ color: "rgba(190,199,217,0.76)" }}>
          这个模式默认可关闭。启用后，网关会优先监听文件系统事件，把目录中新出现或更新的凭证即时导回数据库，并保留周期性全量重扫作为兜底恢复。默认根目录是当前运行用户的
          <code style={{ marginInline: 4 }}>~/.neuro</code>，不同服务商按
          <code style={{ marginInline: 4 }}>&lt;provider-family&gt;</code>
          子目录归档。
        </span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <span style={{ color: "rgba(214,219,233,0.84)" }}>根目录：{props.status.rootDir ?? "—"}</span>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          兜底重扫间隔：{props.status.intervalSeconds != null ? `${props.status.intervalSeconds}s` : "—"}
        </span>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          监听去抖：{props.status.watchDebounceMillis != null ? `${props.status.watchDebounceMillis}ms` : "—"}
        </span>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          最近运行：{formatShanghaiDateTime(props.status.lastRunAt)}
        </span>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          最近导入 / 导出：{formatShanghaiDateTime(props.status.lastImportAt)} / {formatShanghaiDateTime(props.status.lastExportAt)}
        </span>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          最近监听事件：{formatShanghaiDateTime(props.status.lastWatchEventAt)}
        </span>
        <span
          style={{
            color:
              props.status.lastExplicitDeleteCount > 0
                ? "rgba(252, 211, 77, 0.96)"
                : "rgba(214,219,233,0.84)",
          }}
        >
          最近显式删库命中：{lastExplicitDeleteSummary}
        </span>
        <span style={{ color: props.status.lastError ? "#fecdd3" : "rgba(214,219,233,0.84)" }}>
          最近同步错误：{props.status.lastError ?? "—"}
        </span>
        <span style={{ color: props.status.lastWatchError ? "#fecdd3" : "rgba(214,219,233,0.84)" }}>
          最近监听错误：{props.status.lastWatchError ?? "—"}
        </span>
        <span style={{ color: "rgba(214,219,233,0.84)" }}>
          本轮统计：新增 {props.status.importedCount} / 更新 {props.status.updatedCount} / 导出 {props.status.exportedCount} / 删除 {props.status.deletedCount} / 跳过 {props.status.skippedCount}
        </span>
        {props.status.lastExplicitDeletePaths.length ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(120, 53, 15, 0.2)",
              border: "1px solid rgba(251, 191, 36, 0.28)",
            }}
          >
            <span style={{ color: "rgba(252, 211, 77, 0.96)", fontSize: "0.88rem" }}>
              最近一次显式删除命中路径
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {props.status.lastExplicitDeletePaths.map((path) => (
                <code
                  key={path}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "rgba(15, 23, 42, 0.42)",
                    color: "rgba(252, 211, 77, 0.96)",
                  }}
                >
                  {path}
                </code>
              ))}
            </div>
          </div>
        ) : null}
        {recentExplicitDeleteEvents.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            <span style={{ color: "rgba(252, 211, 77, 0.96)", fontSize: "0.88rem" }}>
              最近显式删库审计记录
            </span>
            <div style={{ display: "grid", gap: 10 }}>
              {recentExplicitDeleteEvents.map((event, index) => (
                <details
                  key={event.eventId}
                  open={index === 0}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(251, 191, 36, 0.24)",
                    background: "rgba(15, 23, 42, 0.28)",
                    padding: "10px 12px",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      color: "rgba(252, 211, 77, 0.96)",
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ fontSize: "0.92rem" }}>
                      {formatShanghaiDateTime(event.occurredAt)}
                    </strong>
                    <span>{event.deletedCount} 条命中</span>
                    <code
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(120, 53, 15, 0.24)",
                        color: "rgba(253, 230, 138, 0.96)",
                      }}
                    >
                      {event.eventId}
                    </code>
                  </summary>
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <span style={{ color: "rgba(214,219,233,0.84)" }}>
                      事件 ID：<code>{event.eventId}</code>
                    </span>
                    <span style={{ color: "rgba(214,219,233,0.84)" }}>
                      删除时间：{formatShanghaiDateTime(event.occurredAt)}
                    </span>
                    <span style={{ color: "rgba(214,219,233,0.84)" }}>
                      命中条数：{event.deletedCount}
                    </span>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "rgba(214,219,233,0.84)" }}>受影响凭证 ID</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {event.providerCredentialIds.map((credentialId) => (
                          <code
                            key={credentialId}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "rgba(15, 23, 42, 0.42)",
                              color: "rgba(226, 232, 240, 0.96)",
                            }}
                          >
                            {credentialId}
                          </code>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "rgba(214,219,233,0.84)" }}>删除路径</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {event.deletedPaths.map((path) => (
                          <code
                            key={path}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "rgba(15, 23, 42, 0.42)",
                              color: "rgba(252, 211, 77, 0.96)",
                            }}
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
          <span style={{ color: "#fcd34d" }}>
            尚未配置挂载根目录，当前不能启用自动同步。
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
    <section id="credentials" style={{ display: "grid", gap: 16, scrollMarginTop: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <span className="nt-kicker">服务商详情 / 凭证</span>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, color: "rgba(243,245,247,0.96)", fontSize: "1.42rem", lineHeight: 1.15 }}>
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

      <div
        style={{
          display: "grid",
          gap: 18,
        }}
      >
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
