import { auth } from "@/auth";
import { NtCard, NtPanel } from "@/components/nt-primitives";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PROVIDER_CREATE_ADAPTER_OPTIONS,
  PROVIDER_CREATE_AUTH_MODE_OPTIONS,
  PROVIDER_CREATE_HTTP_SPECS,
  PROVIDER_CREATE_PROTOCOL_FAMILY_OPTIONS,
  PROVIDER_CREATE_PROTOCOL_PROFILE_OPTIONS,
  getProviderCreateDefaults,
} from "../provider-create-catalog";
import { createGatewayProviderFromWorkbenchAction } from "./actions";

type ProviderCreatePageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    adapter?: string;
    protocolFamily?: string;
    protocolProfile?: string;
    returnTo?: string;
  }>;
};

function resolveReturnTo(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw.startsWith("/ops/gateway/providers") || raw.startsWith("//")) {
    return "/ops/gateway/providers";
  }
  return raw;
}

function formatExecutionModeLabel(value: string) {
  return value === "browser_backed" ? "浏览器托管" : "直连 HTTP";
}

export default async function GatewayProviderCreatePage({ searchParams }: ProviderCreatePageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以配置 AI 网关服务商。")}`);
  }

  const params = searchParams ? await searchParams : undefined;
  await requirePlatformOperatorUserContext();

  const returnTo = resolveReturnTo(params?.returnTo);
  const defaults = getProviderCreateDefaults(
    params?.adapter,
    params?.protocolFamily,
    params?.protocolProfile,
  );
  const failureRedirect =
    `/ops/gateway/providers/create?adapter=${encodeURIComponent(defaults.adapter)}` +
    `&protocolFamily=${encodeURIComponent(defaults.protocolFamily)}` +
    `&protocolProfile=${encodeURIComponent(defaults.protocolProfile)}` +
    `&returnTo=${encodeURIComponent(returnTo)}`;

  const groupedTemplates = [
    {
      title: "Gemini Platform",
      entries: PROVIDER_CREATE_HTTP_SPECS.filter((spec) =>
        ["google_gemini_api", "google_vertex_gemini", "gemini_business", "gemini_canvas"].includes(spec.protocolProfile),
      ),
    },
    {
      title: "Qwen Platform",
      entries: PROVIDER_CREATE_HTTP_SPECS.filter((spec) =>
        ["qwen_dashscope_openai", "qwen_coding_plan_openai", "qwen_coding_plan_anthropic", "qwen_web_chat"].includes(
          spec.protocolProfile,
        ),
      ),
    },
  ].filter((group) => group.entries.length > 0);

  return (
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <section style={{ display: "grid", gap: 12 }}>
        <span className="nt-kicker">Operator / AI 网关 / 创建服务商</span>
        <h1 style={{ margin: 0, color: "rgba(243,245,247,0.98)", fontSize: "2rem", lineHeight: 1.1 }}>
          创建服务商
        </h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="nt-btn nt-btn--outline" href={returnTo}>
            返回服务商
          </Link>
        </div>
      </section>

      {params?.status && params?.message ? (
        <NtPanel
          style={{
            display: "grid",
            gap: 8,
            borderColor: params.status === "success" ? "rgba(34,197,94,0.22)" : "rgba(244,63,94,0.22)",
            background: params.status === "success" ? "rgba(8,39,24,0.7)" : "rgba(39,11,17,0.72)",
          }}
        >
          <span className="nt-kicker">{params.status === "success" ? "操作完成" : "操作失败"}</span>
          <span style={{ color: params.status === "success" ? "#bbf7d0" : "#fecdd3" }}>{params.message}</span>
        </NtPanel>
      ) : null}

      {groupedTemplates.length > 0 ? (
        <NtCard style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">快速模板</span>
            <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.1rem" }}>平台预设入口</strong>
            <span style={{ color: "rgba(190,199,217,0.82)" }}>
              这里展示的是可快速创建的 provider surface 模板。`/ops/gateway/providers` 库存页只显示已经创建到数据库里的服务商，不会自动列出这些模板。
            </span>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {groupedTemplates.map((group) => (
              <div key={group.title} style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">{group.title}</span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {group.entries.map((entry) => {
                    const href =
                      `/ops/gateway/providers/create?adapter=${encodeURIComponent(entry.adapter)}` +
                      `&protocolFamily=${encodeURIComponent(entry.protocolFamily)}` +
                      `&protocolProfile=${encodeURIComponent(entry.protocolProfile)}` +
                      `&returnTo=${encodeURIComponent(returnTo)}`;
                    const modeLabel = formatExecutionModeLabel(entry.defaultExecutionMode);
                    return (
                      <Link
                        key={entry.key}
                        href={href}
                        style={{
                          display: "grid",
                          gap: 8,
                          padding: "14px 16px",
                          borderRadius: 16,
                          textDecoration: "none",
                          border: "1px solid rgba(142,197,255,0.18)",
                          background: "rgba(7,12,20,0.72)",
                        }}
                      >
                        <strong style={{ color: "rgba(243,245,247,0.96)" }}>{entry.label}</strong>
                        <span style={{ color: "rgba(148,163,184,0.9)", fontSize: "0.88rem" }}>
                          {entry.protocolProfile} / {entry.protocolFamily}
                        </span>
                        <span style={{ color: "rgba(190,199,217,0.82)", fontSize: "0.86rem" }}>
                          {entry.sourceKind} / {modeLabel}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </NtCard>
      ) : null}

      <NtCard style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">配置型服务商</span>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.1rem" }}>共享配置</strong>
        </div>

        <form action={createGatewayProviderFromWorkbenchAction} style={{ display: "grid", gap: 16 }}>
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="failureRedirectTo" type="hidden" value={failureRedirect} />
          <input name="executionMode" type="hidden" value={defaults.defaultExecutionMode} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">显示名</span>
              <input className="nt-input" defaultValue={defaults.label} name="label" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">服务商归属名</span>
              <input
                className="nt-input"
                defaultValue={defaults.defaultServiceProviderLabel ?? defaults.label}
                name="serviceProviderLabel"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">服务商归属 Key</span>
              <input
                className="nt-input"
                defaultValue={defaults.defaultServiceProviderKey ?? ""}
                name="serviceProviderKey"
                placeholder="留空则按归属名自动生成"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">默认模型</span>
              <input className="nt-input" defaultValue="" name="defaultModel" placeholder="留空" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">默认 Base URL</span>
              <input
                className="nt-input"
                defaultValue={defaults.defaultBaseUrl ?? ""}
                name="baseUrl"
                placeholder="https://api.example.com/v1"
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">适配器</span>
              <select className="nt-input" defaultValue={defaults.adapter} name="adapter">
                {PROVIDER_CREATE_ADAPTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">协议族</span>
              <select className="nt-input" defaultValue={defaults.protocolFamily} name="protocolFamily">
                {PROVIDER_CREATE_PROTOCOL_FAMILY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">协议 Profile</span>
              <select className="nt-input" defaultValue={defaults.protocolProfile} name="protocolProfile">
                {PROVIDER_CREATE_PROTOCOL_PROFILE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">执行模式</span>
              <input
                className="nt-input"
                readOnly
                value={formatExecutionModeLabel(defaults.defaultExecutionMode)}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="nt-kicker">鉴权方式</span>
              <select className="nt-input" defaultValue="default" name="authMode">
                {PROVIDER_CREATE_AUTH_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">来源备注</span>
            <textarea className="nt-input" defaultValue="" name="sourceNotes" rows={3} style={{ resize: "vertical" }} />
          </label>

          <NtPanel style={{ display: "grid", gap: 8 }}>
            <span className="nt-kicker">建模提示</span>
            <span style={{ color: "rgba(190,199,217,0.82)" }}>
              `显示名` 描述当前可路由 surface；`协议族` 描述出站 wire family；`协议 Profile`
              描述该 family 下的厂商变体；`服务商归属名 / Key`
              描述它属于哪家上游服务商。若同一服务商有多个 endpoint、协议或商品 surface，应复用同一组归属字段。
            </span>
          </NtPanel>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <button className="nt-btn nt-btn--primary" type="submit">
              创建服务商
            </button>
          </div>
        </form>
      </NtCard>
    </div>
  );
}
