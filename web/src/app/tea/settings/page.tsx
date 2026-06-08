import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  AccountHomeList,
  AccountHomeListRow,
  AccountHomeSection,
  AccountHomeSectionHead,
} from "@/components/account-home/templates";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { updateTeaConfigurationAction } from "@/lib/tea-actions";
import { getTeaConfiguration, type TeaConfigurationView } from "@/lib/tea-client";

export const dynamic = "force-dynamic";

type TeaSettingsPageProps = {
  searchParams?: Promise<{
    message?: string;
    status?: string;
  }>;
};

function sourceOf(configuration: TeaConfigurationView | null): string {
  return typeof configuration?.configuration_source === "string"
    ? configuration.configuration_source
    : "unknown";
}

function ownerOf(configuration: TeaConfigurationView | null): string {
  return typeof configuration?.configuration?.owner === "string"
    ? configuration.configuration.owner
    : "unknown";
}

function loomPanelUrl(configuration: TeaConfigurationView | null): string | null {
  const panelUrl = configuration?.configuration?.loom_panel_url;
  return typeof panelUrl === "string" && panelUrl.length > 0 ? panelUrl : null;
}

function configRecord(configuration: TeaConfigurationView | null): Record<string, unknown> {
  return typeof configuration?.config === "object" && configuration.config !== null && !Array.isArray(configuration.config)
    ? (configuration.config as Record<string, unknown>)
    : {};
}

export default async function TeaSettingsPage({ searchParams }: TeaSettingsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userContext = {
    userId: session.user.id,
    providerUserId: session.user.providerUserId,
    username: session.user.username || session.user.name || undefined,
  };
  const params = searchParams ? await searchParams : undefined;
  const actionStatus = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;

  let configuration: TeaConfigurationView | null = null;
  let loadError: string | null = null;
  try {
    configuration = await getTeaConfiguration(userContext);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Tea 配置不可用。";
  }

  const source = sourceOf(configuration);
  const config = configRecord(configuration);
  const panelUrl = loomPanelUrl(configuration);

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Card className="app-stack">
          <div className="app-task-card__header">
            <div>
              <p className="mg-subtitle">Tea Settings</p>
              <h1 className="mg-title">Tea 配置</h1>
              <p className="mg-copy">
                Tea 可以独立使用本地配置；当 Loom 声明接管 Tea 配置时，本页只读并跳转到 Loom。
              </p>
            </div>
            <Link className="mg-btn mg-btn--secondary" href="/tea">
              返回 Tea
            </Link>
          </div>
        </Card>

        {loadError ? (
          <Card className="app-stack">
            <Badge variant="danger">Configuration unavailable</Badge>
            <p className="mg-copy">{loadError}</p>
          </Card>
        ) : (
          <AccountHomeSection>
            {actionStatus && message ? (
              <Card className="app-stack">
                <p className={actionStatus === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
                  {message}
                </p>
              </Card>
            ) : null}

            <AccountHomeSectionHead kicker="Ownership" title="配置来源" />
            <Card className="app-stack">
              <div className="app-action-row">
                <Badge variant={source === "loom-managed" ? "cyan" : source === "fallback" ? "warning" : "glass"}>
                  {source}
                </Badge>
                <span className="app-note">owner: {ownerOf(configuration)}</span>
              </div>
              {source === "loom-managed" && panelUrl ? (
                <>
                  <p className="mg-copy">Loom 当前接管 Tea 配置。本地设置页只读，避免同时写入同一配置项。</p>
                  <Link className="mg-btn mg-btn--primary" href={panelUrl}>
                    在 Loom 中配置 Tea
                  </Link>
                </>
              ) : (
                <p className="mg-copy">
                  当前可使用 Tea 本地配置。CLI 可通过 <code>tea config show</code> 和
                  <code> tea config set --notifications-enabled true|false</code> 读写同一配置接口。
                </p>
              )}
            </Card>

            <Card className="app-stack">
              <AccountHomeSectionHead kicker="Current" title="当前本地配置" />
              <AccountHomeList>
                <AccountHomeListRow
                  aside={<span className="app-note">{String(config.notifications_enabled ?? "unknown")}</span>}
                  title="通知/UI 提示"
                />
                <AccountHomeListRow
                  aside={<span className="app-note">{String(config.human_ticket_default_approval_policy ?? "unknown")}</span>}
                  title="人类工单默认审批策略"
                />
                <AccountHomeListRow
                  aside={<span className="app-note">{String(config.hook_ticket_default_approval_policy ?? "unknown")}</span>}
                  title="Hook intake 默认审批策略"
                />
              </AccountHomeList>
            </Card>

            {source === "loom-managed" ? null : (
              <Card className="app-stack">
                <AccountHomeSectionHead kicker="Local" title="本地配置写入" />
                <form action={updateTeaConfigurationAction} className="app-form-grid">
                  <input name="redirectTo" type="hidden" value="/tea/settings" />
                  <label className="app-note" htmlFor="notifications_enabled">
                    通知/UI 提示
                  </label>
                  <select
                    className="app-input"
                    defaultValue={String(config.notifications_enabled ?? true)}
                    id="notifications_enabled"
                    name="notifications_enabled"
                  >
                    <option value="true">启用</option>
                    <option value="false">关闭</option>
                  </select>
                  <label className="app-note" htmlFor="human_ticket_default_approval_policy">
                    人类工单默认审批策略
                  </label>
                  <select
                    className="app-input"
                    defaultValue={String(config.human_ticket_default_approval_policy ?? "human_before_execute")}
                    id="human_ticket_default_approval_policy"
                    name="human_ticket_default_approval_policy"
                  >
                    <option value="human_before_execute">执行前人工确认</option>
                    <option value="human_before_completion">完成前人工验收</option>
                    <option value="manual_only">仅人工推进</option>
                  </select>
                  <label className="app-note" htmlFor="hook_ticket_default_approval_policy">
                    Hook intake 默认审批策略
                  </label>
                  <select
                    className="app-input"
                    defaultValue={String(config.hook_ticket_default_approval_policy ?? "plan_only")}
                    id="hook_ticket_default_approval_policy"
                    name="hook_ticket_default_approval_policy"
                  >
                    <option value="plan_only">只生成计划</option>
                    <option value="human_before_execute">执行前人工确认</option>
                    <option value="manual_only">仅人工推进</option>
                  </select>
                  <button className="mg-btn mg-btn--primary" type="submit">
                    保存 Tea 本地配置
                  </button>
                </form>
              </Card>
            )}
          </AccountHomeSection>
        )}
      </div>
    </main>
  );
}
