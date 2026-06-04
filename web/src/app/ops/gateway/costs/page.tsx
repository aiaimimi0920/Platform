import { auth } from "@/auth";
import { getOperatorGatewayCosts } from "@/lib/account-client";
import type { GatewayCostOverviewView } from "@/lib/account-client";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { NtBadge, NtCard, NtInput, NtPanel } from "@/components/nt-primitives";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";

import { updateGatewayProviderModelPricingAction } from "./actions";

type ProviderBucket = GatewayCostOverviewView["providerBuckets"][number];
type ModelBucket = GatewayCostOverviewView["modelBuckets"][number];
type PricingEditor = GatewayCostOverviewView["pricingEditors"][number];

function formatMicros(value?: number | null) {
  if (value == null) {
    return "未配置";
  }
  return `${(value / 1_000_000).toFixed(4)} US$`;
}

function formatRateLabel(
  promptMicrosPer1kTokens?: number | null,
  completionMicrosPer1kTokens?: number | null,
) {
  if (promptMicrosPer1kTokens == null && completionMicrosPer1kTokens == null) {
    return "未配置";
  }
  const prompt =
    promptMicrosPer1kTokens != null
      ? `${(promptMicrosPer1kTokens / 1000).toFixed(3)} /1M 输入`
      : "—";
  const completion =
    completionMicrosPer1kTokens != null
      ? `${(completionMicrosPer1kTokens / 1000).toFixed(3)} /1M 输出`
      : "—";
  return `${prompt} · ${completion}`;
}

function toInputUsdPerMillion(value?: number | null) {
  if (value == null) {
    return "";
  }
  return (value / 1000).toFixed(3);
}

function formatDate(value?: string | null) {
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

function SummaryCard(props: { title: string; value: string | number; hint?: string }) {
  return (
    <NtCard style={{ display: "grid", gap: 8, padding: 16 }}>
      <span className="nt-kicker">{props.title}</span>
      <strong style={{ fontSize: "1.45rem", color: "rgba(243,245,247,0.95)" }}>{props.value}</strong>
      {props.hint ? <span style={{ color: "rgba(190,199,217,0.72)", fontSize: "0.9rem" }}>{props.hint}</span> : null}
    </NtCard>
  );
}

function PricingEditorCard(props: { editor: PricingEditor }) {
  const { editor } = props;
  return (
    <NtCard style={{ display: "grid", gap: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ fontSize: "1.1rem", color: "rgba(243,245,247,0.96)" }}>{editor.label}</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <NtBadge tone="cyan">{editor.adapter}</NtBadge>
            <NtBadge tone="glass">{editor.protocolFamily}</NtBadge>
            <NtBadge tone={editor.configuredModelCount === editor.modelCount ? "success" : "warning"}>
              模型定价 {editor.configuredModelCount}/{editor.modelCount}
            </NtBadge>
          </div>
        </div>
        <div style={{ color: "rgba(190,199,217,0.7)", fontSize: "0.9rem" }} />
      </div>

      <form action={updateGatewayProviderModelPricingAction} style={{ display: "grid", gap: 12 }}>
        <input type="hidden" name="providerAccountId" value={editor.providerAccountId} />
        <input type="hidden" name="redirectTo" value="/ops/gateway/costs#pricing" />

        <div style={{ overflow: "auto" }}>
          <table className="nt-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="nt-table__cell">模型</th>
                <th className="nt-table__cell">Prompt US$/1M</th>
                <th className="nt-table__cell">Completion US$/1M</th>
                <th className="nt-table__cell">价格来源</th>
                <th className="nt-table__cell">输入Tokens</th>
                <th className="nt-table__cell">输出Tokens</th>
                <th className="nt-table__cell">思考Tokens</th>
                <th className="nt-table__cell">缓存Tokens</th>
                <th className="nt-table__cell">总Token数</th>
                <th className="nt-table__cell">估算金额</th>
              </tr>
            </thead>
            <tbody>
              {editor.rows.map((row) => (
                <tr key={`${editor.providerAccountId}:${row.model}`}>
                  <td className="nt-table__cell" style={{ minWidth: 180 }}>
                    <input type="hidden" name="model[]" value={row.model} />
                    <strong style={{ color: "rgba(243,245,247,0.95)" }}>{row.model}</strong>
                  </td>
                  <td className="nt-table__cell" style={{ minWidth: 160 }}>
                    <NtInput
                      name="promptUsdPer1m[]"
                      defaultValue={toInputUsdPerMillion(row.marketRate.promptMicrosPer1kTokens)}
                      placeholder="留空移除覆盖"
                    />
                  </td>
                  <td className="nt-table__cell" style={{ minWidth: 160 }}>
                    <NtInput
                      name="completionUsdPer1m[]"
                      defaultValue={toInputUsdPerMillion(row.marketRate.completionMicrosPer1kTokens)}
                      placeholder="留空移除覆盖"
                    />
                  </td>
                  <td className="nt-table__cell">
                    <NtBadge tone={row.marketRate.source === "default_registry" ? "secondary" : "success"}>
                      {row.marketRate.source === "model_pricing"
                        ? "手动覆盖"
                        : row.marketRate.source === "default_registry"
                          ? "默认市场价"
                          : row.marketRate.source === "payload"
                          ? "共享配置"
                            : "未配置"}
                    </NtBadge>
                  </td>
                  <td className="nt-table__cell">{row.inputTokens}</td>
                  <td className="nt-table__cell">{row.outputTokens}</td>
                  <td className="nt-table__cell">{row.thinkingTokens}</td>
                  <td className="nt-table__cell">{row.cachedTokens}</td>
                  <td className="nt-table__cell">{row.totalTokens}</td>
                  <td className="nt-table__cell">{formatMicros(row.estimatedMarketCostMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="nt-btn nt-btn--primary" type="submit">
            保存模型定价
          </button>
        </div>
      </form>
    </NtCard>
  );
}

function ProviderMarketTable(props: { buckets: ProviderBucket[] }) {
  if (!props.buckets.length) {
    return (
      <NtCard style={{ display: "grid", gap: 8 }}>
        <span className="nt-kicker">按服务商统计</span>
        <strong style={{ color: "rgba(243,245,247,0.96)" }}>当前没有历史调用数据</strong>
      </NtCard>
    );
  }

  return (
    <NtCard style={{ overflow: "auto" }}>
      <table className="nt-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="nt-table__cell">服务商 / 模型</th>
            <th className="nt-table__cell">请求数</th>
            <th className="nt-table__cell">输入Tokens</th>
            <th className="nt-table__cell">输出Tokens</th>
            <th className="nt-table__cell">思考Tokens</th>
            <th className="nt-table__cell">缓存Tokens</th>
            <th className="nt-table__cell">总Token数</th>
            <th className="nt-table__cell">市场价估算</th>
            <th className="nt-table__cell">最近请求</th>
          </tr>
        </thead>
        <tbody>
          {props.buckets.map((bucket) => (
            <Fragment key={bucket.providerAccountId}>
              <tr key={bucket.providerAccountId}>
                <td className="nt-table__cell" style={{ minWidth: 220 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ color: "rgba(243,245,247,0.97)" }}>{bucket.label}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <NtBadge tone="cyan">{bucket.adapter}</NtBadge>
                      <NtBadge tone="glass">{bucket.protocolFamily}</NtBadge>
                      <NtBadge tone={bucket.unpricedModelCount === 0 ? "success" : "warning"}>
                        定价 {bucket.pricedModelCount}/{bucket.pricedModelCount + bucket.unpricedModelCount}
                      </NtBadge>
                    </div>
                  </div>
                </td>
                <td className="nt-table__cell">{bucket.requestCount}</td>
                <td className="nt-table__cell">{bucket.inputTokens}</td>
                <td className="nt-table__cell">{bucket.outputTokens}</td>
                <td className="nt-table__cell">{bucket.thinkingTokens}</td>
                <td className="nt-table__cell">{bucket.cachedTokens}</td>
                <td className="nt-table__cell">{bucket.totalTokens}</td>
                <td className="nt-table__cell">{formatMicros(bucket.estimatedMarketCostMicros)}</td>
                <td className="nt-table__cell">{formatDate(bucket.lastRequestAt)}</td>
              </tr>
              {bucket.models.map((row) => (
                <tr key={`${bucket.providerAccountId}:${row.model}`}>
                  <td className="nt-table__cell" style={{ paddingLeft: 32, minWidth: 220 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: "rgba(214,219,233,0.9)" }}>{row.model}</strong>
                      <span style={{ color: "rgba(190,199,217,0.7)", fontSize: "0.84rem" }}>
                        {formatRateLabel(
                          row.marketRate.promptMicrosPer1kTokens,
                          row.marketRate.completionMicrosPer1kTokens,
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="nt-table__cell">{row.requestCount}</td>
                  <td className="nt-table__cell">{row.inputTokens}</td>
                  <td className="nt-table__cell">{row.outputTokens}</td>
                  <td className="nt-table__cell">{row.thinkingTokens}</td>
                  <td className="nt-table__cell">{row.cachedTokens}</td>
                  <td className="nt-table__cell">{row.totalTokens}</td>
                  <td className="nt-table__cell">{formatMicros(row.estimatedMarketCostMicros)}</td>
                  <td className="nt-table__cell">{formatDate(row.lastRequestAt)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </NtCard>
  );
}

function ModelMarketTable(props: { buckets: ModelBucket[] }) {
  if (!props.buckets.length) {
    return (
      <NtCard style={{ display: "grid", gap: 8 }}>
        <span className="nt-kicker">按模型统计</span>
        <strong style={{ color: "rgba(243,245,247,0.96)" }}>当前没有历史调用数据</strong>
      </NtCard>
    );
  }

  return (
    <NtCard style={{ overflow: "auto" }}>
      <table className="nt-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="nt-table__cell">模型 / 服务商</th>
            <th className="nt-table__cell">请求数</th>
            <th className="nt-table__cell">输入Tokens</th>
            <th className="nt-table__cell">输出Tokens</th>
            <th className="nt-table__cell">思考Tokens</th>
            <th className="nt-table__cell">缓存Tokens</th>
            <th className="nt-table__cell">总Token数</th>
            <th className="nt-table__cell">市场价估算</th>
            <th className="nt-table__cell">最近请求</th>
          </tr>
        </thead>
        <tbody>
          {props.buckets.map((bucket) => (
            <Fragment key={bucket.model}>
              <tr key={bucket.model}>
                <td className="nt-table__cell" style={{ minWidth: 220 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ color: "rgba(243,245,247,0.97)" }}>{bucket.model}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <NtBadge tone="glass">{bucket.providerCount} 个服务商</NtBadge>
                      <NtBadge tone={bucket.providerCount === bucket.pricedProviderCount ? "success" : "warning"}>
                        定价 {bucket.pricedProviderCount}/{bucket.providerCount}
                      </NtBadge>
                    </div>
                  </div>
                </td>
                <td className="nt-table__cell">{bucket.requestCount}</td>
                <td className="nt-table__cell">{bucket.inputTokens}</td>
                <td className="nt-table__cell">{bucket.outputTokens}</td>
                <td className="nt-table__cell">{bucket.thinkingTokens}</td>
                <td className="nt-table__cell">{bucket.cachedTokens}</td>
                <td className="nt-table__cell">{bucket.totalTokens}</td>
                <td className="nt-table__cell">{formatMicros(bucket.estimatedMarketCostMicros)}</td>
                <td className="nt-table__cell">{formatDate(bucket.lastRequestAt)}</td>
              </tr>
              {bucket.providers.map((row) => (
                <tr key={`${bucket.model}:${row.providerAccountId}`}>
                  <td className="nt-table__cell" style={{ paddingLeft: 32, minWidth: 220 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: "rgba(214,219,233,0.9)" }}>{row.label}</strong>
                      <span style={{ color: "rgba(190,199,217,0.7)", fontSize: "0.84rem" }}>
                        {formatRateLabel(
                          row.marketRate.promptMicrosPer1kTokens,
                          row.marketRate.completionMicrosPer1kTokens,
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="nt-table__cell">{row.requestCount}</td>
                  <td className="nt-table__cell">{row.inputTokens}</td>
                  <td className="nt-table__cell">{row.outputTokens}</td>
                  <td className="nt-table__cell">{row.thinkingTokens}</td>
                  <td className="nt-table__cell">{row.cachedTokens}</td>
                  <td className="nt-table__cell">{row.totalTokens}</td>
                  <td className="nt-table__cell">{formatMicros(row.estimatedMarketCostMicros)}</td>
                  <td className="nt-table__cell">{formatDate(row.lastRequestAt)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </NtCard>
  );
}

export default async function GatewayCostOpsPage() {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关使用统计页。")}`);
  }

  const userContext = await requirePlatformOperatorUserContext();
  const costs = (await getOperatorGatewayCosts(userContext)) as GatewayCostOverviewView | null;
  const summary = costs?.summary ?? {
    providerCount: 0,
    pricedProviderCount: 0,
    unpricedProviderCount: 0,
    modelCount: 0,
    pricedModelCount: 0,
    unpricedModelCount: 0,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalThinkingTokens: 0,
    totalCachedTokens: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    estimatedMarketCostMicros: null,
  };
  const providerBuckets = costs?.providerBuckets ?? [];
  const modelBuckets = costs?.modelBuckets ?? [];
  const pricingEditors = costs?.pricingEditors ?? [];

  return (
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <section style={{ display: "grid", gap: 8 }}>
        <span className="nt-kicker">Operator / AI 网关</span>
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: "2rem", color: "rgba(243,245,247,0.98)" }}>使用统计</h1>
          <p style={{ margin: 0, color: "rgba(190,199,217,0.78)", maxWidth: "88ch", lineHeight: 1.6 }}>
            这里展示的是历史调用量与按市场价折算后的估算值，不是上游账单真相。管理员可以直接维护每个服务商各模型的
            token 市场价，页面再按服务商和按模型两种视角汇总历史使用情况。
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="nt-btn nt-btn--primary" href="/ops/gateway/providers">
            返回服务商
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <SummaryCard title="服务商总数" value={summary.providerCount} hint={`已定价 ${summary.pricedProviderCount}`} />
        <SummaryCard title="模型总数" value={summary.modelCount} hint={`已定价 ${summary.pricedModelCount}`} />
        <SummaryCard title="历史请求数" value={summary.totalRequests} />
        <SummaryCard title="总Token数" value={summary.totalTokens} />
        <SummaryCard title="输入Tokens" value={summary.totalInputTokens} />
        <SummaryCard title="输出Tokens" value={summary.totalOutputTokens} />
        <SummaryCard title="思考Tokens" value={summary.totalThinkingTokens} />
        <SummaryCard title="缓存Tokens" value={summary.totalCachedTokens} />
        <SummaryCard title="市场价估算" value={formatMicros(summary.estimatedMarketCostMicros)} />
        <SummaryCard title="未定价模型" value={summary.unpricedModelCount} hint={`未定价服务商 ${summary.unpricedProviderCount}`} />
      </section>

      <NtPanel id="pricing" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">模型市场价</span>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.15rem" }}>按服务商维护模型定价</strong>
          <span style={{ color: "rgba(190,199,217,0.72)" }}>
            默认市场价会使用官方公开价格表回填。你在这里修改后，会覆盖默认值并进入使用统计中的市场价估算。
          </span>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          {pricingEditors.map((editor) => (
            <PricingEditorCard key={editor.providerAccountId} editor={editor} />
          ))}
        </div>
      </NtPanel>

      <NtPanel style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">按服务商统计</span>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.15rem" }}>
            每个服务商的模型调用量与市场价估算
          </strong>
        </div>
        <ProviderMarketTable buckets={providerBuckets} />
      </NtPanel>

      <NtPanel style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">按模型统计</span>
          <strong style={{ color: "rgba(243,245,247,0.96)", fontSize: "1.15rem" }}>
            每个模型在不同服务商上的调用量与市场价估算
          </strong>
        </div>
        <ModelMarketTable buckets={modelBuckets} />
      </NtPanel>

      <NtCard
        style={{
          display: "grid",
          gap: 10,
          borderColor: "rgba(251,146,60,0.24)",
          background: "rgba(67,20,7,0.62)",
        }}
      >
        <span className="nt-kicker">重要说明</span>
        <strong style={{ color: "rgba(254,215,170,0.96)" }}>这里是市场价估算，不是账单对账</strong>
        <span style={{ color: "rgba(253,186,116,0.86)", lineHeight: 1.6 }}>
          页面金额由历史 token 使用量 × 管理员配置的模型市场价计算得到，目的是帮助平台做定价和运营判断。思考Tokens当前仅用于展示，不额外单独计价；缓存Tokens当前沿用输入价格口径估算。它不会替代上游账单，也不直接代表用户侧结算结果。
        </span>
      </NtCard>
    </div>
  );
}
