import { auth } from "@/auth";
import { GatewayDependencyUnavailableCard } from "@/components/gateway-dependency-unavailable-card";
import { getOperatorGatewayCosts } from "@/lib/account-client";
import type { GatewayCostOverviewView } from "@/lib/account-client";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { formatPlatformDateTime } from "@/lib/platform-date-time";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { NtBadge, NtCard, NtInput, NtPanel } from "@/components/nt-primitives";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";

import { updateGatewayProviderModelPricingAction } from "./actions";

type ProviderBucket = GatewayCostOverviewView["providerBuckets"][number];
type ModelBucket = GatewayCostOverviewView["modelBuckets"][number];
type PricingEditor = GatewayCostOverviewView["pricingEditors"][number];

/*
 * Layout runs through the shared `nt-` utility classes; only the one-off geometry and
 * token-colored values that have no utility live here, hoisted to module scope so they
 * are allocated once instead of on every render.
 */
const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };
const SUMMARY_GRID_STYLE = { "--nt-autofit-min": "180px" } as CSSProperties;
const SUMMARY_VALUE_STYLE: CSSProperties = { fontSize: "1.45rem" };
const SUMMARY_HINT_STYLE: CSSProperties = { fontSize: "0.9rem" };
const PAGE_INTRO_STYLE: CSSProperties = { maxWidth: "88ch", lineHeight: 1.6 };
const SECTION_TITLE_STYLE: CSSProperties = { fontSize: "1.15rem" };
const DISCLAIMER_CARD_STYLE: CSSProperties = {
  borderColor: "var(--neuro-yellow-line)",
  background: "var(--neuro-yellow-soft)",
};
const DISCLAIMER_BODY_STYLE: CSSProperties = { lineHeight: 1.6 };

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
  return formatPlatformDateTime(value, "—");
}

function SummaryCard(props: { title: string; value: string | number; hint?: string }) {
  return (
    <NtCard className="nt-stack nt-gap-2 nt-pad-4">
      <span className="nt-kicker">{props.title}</span>
      <strong className="nt-text-strong" style={SUMMARY_VALUE_STYLE}>{props.value}</strong>
      {props.hint ? <span className="nt-text-muted" style={SUMMARY_HINT_STYLE}>{props.hint}</span> : null}
    </NtCard>
  );
}

function PricingEditorCard(props: { editor: PricingEditor }) {
  const { editor } = props;
  return (
    <NtCard className="nt-stack nt-gap-3_5 nt-pad-4_5">
        <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap">
        <div className="nt-stack nt-gap-1_5">
          <strong className="nt-text-strong nt-text-xl">{editor.label}</strong>
          <div className="nt-flex nt-gap-2 nt-wrap">
            <NtBadge tone="cyan">{editor.adapter}</NtBadge>
            <NtBadge tone="glass">{editor.protocolFamily}</NtBadge>
            <NtBadge tone={editor.configuredModelCount === editor.modelCount ? "success" : "warning"}>
              模型定价 {editor.configuredModelCount}/{editor.modelCount}
            </NtBadge>
          </div>
        </div>
        <div className="nt-text-muted nt-text-md" />
      </div>

      <form action={updateGatewayProviderModelPricingAction} className="nt-stack nt-gap-3">
        <input type="hidden" name="providerAccountId" value={editor.providerAccountId} />
        <input type="hidden" name="redirectTo" value="/ops/gateway/costs#pricing" />

        <div className="nt-overflow-auto">
          <table className="nt-table">
            <thead>
              <tr>
                <th className="nt-table__cell">模型</th>
                <th className="nt-table__cell nt-table__cell--numeric">Prompt US$/1M</th>
                <th className="nt-table__cell nt-table__cell--numeric">Completion US$/1M</th>
                <th className="nt-table__cell">价格来源</th>
                <th className="nt-table__cell nt-table__cell--numeric">输入 Token</th>
                <th className="nt-table__cell nt-table__cell--numeric">输出 Token</th>
                <th className="nt-table__cell nt-table__cell--numeric">思考 Token</th>
                <th className="nt-table__cell nt-table__cell--numeric">缓存 Token</th>
                <th className="nt-table__cell nt-table__cell--numeric">总 Token 数</th>
                <th className="nt-table__cell nt-table__cell--numeric">估算金额</th>
              </tr>
            </thead>
            <tbody>
              {editor.rows.map((row) => (
                <tr key={`${editor.providerAccountId}:${row.model}`}>
                  <td className="nt-table__cell nt-col-180">
                    <input type="hidden" name="model[]" value={row.model} />
                    <strong className="nt-text-strong">{row.model}</strong>
                  </td>
                  <td className="nt-table__cell nt-table__cell--numeric nt-col-160">
                    <NtInput
                      name="promptUsdPer1m[]"
                      defaultValue={toInputUsdPerMillion(row.marketRate.promptMicrosPer1kTokens)}
                      placeholder="留空移除覆盖"
                    />
                  </td>
                  <td className="nt-table__cell nt-table__cell--numeric nt-col-160">
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
                  <td className="nt-table__cell nt-table__cell--numeric">{row.inputTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.outputTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.thinkingTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.cachedTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.totalTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{formatMicros(row.estimatedMarketCostMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="nt-flex nt-justify-end">
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
      <NtCard className="nt-stack nt-gap-2">
        <span className="nt-kicker">按服务商统计</span>
        <strong className="nt-text-strong">当前没有历史调用数据</strong>
      </NtCard>
    );
  }

  return (
    <NtCard className="nt-overflow-auto">
      <table className="nt-table">
        <thead>
          <tr>
            <th className="nt-table__cell">服务商 / 模型</th>
            <th className="nt-table__cell nt-table__cell--numeric">请求数</th>
            <th className="nt-table__cell nt-table__cell--numeric">输入 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">输出 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">思考 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">缓存 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">总 Token 数</th>
            <th className="nt-table__cell nt-table__cell--numeric">市场价估算</th>
            <th className="nt-table__cell">最近请求</th>
          </tr>
        </thead>
        <tbody>
          {props.buckets.map((bucket) => (
            <Fragment key={bucket.providerAccountId}>
              <tr key={bucket.providerAccountId}>
                <td className="nt-table__cell nt-col-220">
                  <div className="nt-stack nt-gap-1_5">
                    <strong className="nt-text-strong">{bucket.label}</strong>
                    <div className="nt-flex nt-gap-2 nt-wrap">
                      <NtBadge tone="cyan">{bucket.adapter}</NtBadge>
                      <NtBadge tone="glass">{bucket.protocolFamily}</NtBadge>
                      <NtBadge tone={bucket.unpricedModelCount === 0 ? "success" : "warning"}>
                        定价 {bucket.pricedModelCount}/{bucket.pricedModelCount + bucket.unpricedModelCount}
                      </NtBadge>
                    </div>
                  </div>
                </td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.requestCount}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.inputTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.outputTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.thinkingTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.cachedTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.totalTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{formatMicros(bucket.estimatedMarketCostMicros)}</td>
                <td className="nt-table__cell">{formatDate(bucket.lastRequestAt)}</td>
              </tr>
              {bucket.models.map((row) => (
                <tr key={`${bucket.providerAccountId}:${row.model}`}>
                  <td className="nt-table__cell nt-col-220 nt-indent-8">
                    <div className="nt-stack nt-gap-1">
                      <strong className="nt-text-muted">{row.model}</strong>
                      <span className="nt-text-muted nt-text-xs">
                        {formatRateLabel(
                          row.marketRate.promptMicrosPer1kTokens,
                          row.marketRate.completionMicrosPer1kTokens,
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.requestCount}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.inputTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.outputTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.thinkingTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.cachedTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.totalTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{formatMicros(row.estimatedMarketCostMicros)}</td>
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
      <NtCard className="nt-stack nt-gap-2">
        <span className="nt-kicker">按模型统计</span>
        <strong className="nt-text-strong">当前没有历史调用数据</strong>
      </NtCard>
    );
  }

  return (
    <NtCard className="nt-overflow-auto">
      <table className="nt-table">
        <thead>
          <tr>
            <th className="nt-table__cell">模型 / 服务商</th>
            <th className="nt-table__cell nt-table__cell--numeric">请求数</th>
            <th className="nt-table__cell nt-table__cell--numeric">输入 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">输出 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">思考 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">缓存 Token</th>
            <th className="nt-table__cell nt-table__cell--numeric">总 Token 数</th>
            <th className="nt-table__cell nt-table__cell--numeric">市场价估算</th>
            <th className="nt-table__cell">最近请求</th>
          </tr>
        </thead>
        <tbody>
          {props.buckets.map((bucket) => (
            <Fragment key={bucket.model}>
              <tr key={bucket.model}>
                <td className="nt-table__cell nt-col-220">
                  <div className="nt-stack nt-gap-1_5">
                    <strong className="nt-text-strong">{bucket.model}</strong>
                    <div className="nt-flex nt-gap-2 nt-wrap">
                      <NtBadge tone="glass">{bucket.providerCount} 个服务商</NtBadge>
                      <NtBadge tone={bucket.providerCount === bucket.pricedProviderCount ? "success" : "warning"}>
                        定价 {bucket.pricedProviderCount}/{bucket.providerCount}
                      </NtBadge>
                    </div>
                  </div>
                </td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.requestCount}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.inputTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.outputTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.thinkingTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.cachedTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{bucket.totalTokens}</td>
                <td className="nt-table__cell nt-table__cell--numeric">{formatMicros(bucket.estimatedMarketCostMicros)}</td>
                <td className="nt-table__cell">{formatDate(bucket.lastRequestAt)}</td>
              </tr>
              {bucket.providers.map((row) => (
                <tr key={`${bucket.model}:${row.providerAccountId}`}>
                  <td className="nt-table__cell nt-col-220 nt-indent-8">
                    <div className="nt-stack nt-gap-1">
                      <strong className="nt-text-muted">{row.label}</strong>
                      <span className="nt-text-muted nt-text-xs">
                        {formatRateLabel(
                          row.marketRate.promptMicrosPer1kTokens,
                          row.marketRate.completionMicrosPer1kTokens,
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.requestCount}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.inputTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.outputTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.thinkingTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.cachedTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{row.totalTokens}</td>
                  <td className="nt-table__cell nt-table__cell--numeric">{formatMicros(row.estimatedMarketCostMicros)}</td>
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
  let costs: GatewayCostOverviewView | null = null;
  let dependencyNotice: ReturnType<typeof buildGatewayDependencyUnavailableNotice> | null = null;
  try {
    costs = (await getOperatorGatewayCosts(userContext)) as GatewayCostOverviewView | null;
  } catch (error) {
    dependencyNotice = buildGatewayDependencyUnavailableNotice(error, {
      resourceName: "使用统计与模型市场价",
      continuation: "历史调用量和模型定价编辑暂不可用；其他运营页面仍可继续使用。",
    });
  }
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
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <section className="nt-stack nt-gap-2">
        <span className="nt-kicker">运维 / AI 网关</span>
        <div className="nt-stack nt-gap-1_5">
          <h1 className="nt-flush nt-text-strong nt-text-metric">使用统计</h1>
          <p className="nt-flush nt-text-muted" style={PAGE_INTRO_STYLE}>
            这里展示的是历史调用量与按市场价折算后的估算值，不是上游账单真相。管理员可以直接维护每个服务商各模型的
            token 市场价，页面再按服务商和按模型两种视角汇总历史使用情况。
          </p>
        </div>
        <div className="nt-flex nt-gap-2">
          <Link className="nt-btn nt-btn--primary" href="/ops/gateway/providers">
            返回服务商
          </Link>
        </div>
      </section>

      {dependencyNotice ? <GatewayDependencyUnavailableCard notice={dependencyNotice} /> : null}

      <section className="nt-autofit nt-gap-4" style={SUMMARY_GRID_STYLE}>
        <SummaryCard title="服务商总数" value={summary.providerCount} hint={`已定价 ${summary.pricedProviderCount}`} />
        <SummaryCard title="模型总数" value={summary.modelCount} hint={`已定价 ${summary.pricedModelCount}`} />
        <SummaryCard title="历史请求数" value={summary.totalRequests} />
        <SummaryCard title="总 Token 数" value={summary.totalTokens} />
        <SummaryCard title="输入 Token" value={summary.totalInputTokens} />
        <SummaryCard title="输出 Token" value={summary.totalOutputTokens} />
        <SummaryCard title="思考 Token" value={summary.totalThinkingTokens} />
        <SummaryCard title="缓存 Token" value={summary.totalCachedTokens} />
        <SummaryCard title="市场价估算" value={formatMicros(summary.estimatedMarketCostMicros)} />
        <SummaryCard title="未定价模型" value={summary.unpricedModelCount} hint={`未定价服务商 ${summary.unpricedProviderCount}`} />
      </section>

      <NtPanel className="nt-stack nt-gap-3" id="pricing">
        <div className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">模型市场价</span>
          <strong className="nt-text-strong" style={SECTION_TITLE_STYLE}>按服务商维护模型定价</strong>
          <span className="nt-text-muted">
            默认市场价会使用官方公开价格表回填。你在这里修改后，会覆盖默认值并进入使用统计中的市场价估算。
          </span>
        </div>
        <div className="nt-stack nt-gap-4">
          {pricingEditors.map((editor) => (
            <PricingEditorCard key={editor.providerAccountId} editor={editor} />
          ))}
        </div>
      </NtPanel>

      <NtPanel className="nt-stack nt-gap-3">
        <div className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">按服务商统计</span>
          <strong className="nt-text-strong" style={SECTION_TITLE_STYLE}>
            每个服务商的模型调用量与市场价估算
          </strong>
        </div>
        <ProviderMarketTable buckets={providerBuckets} />
      </NtPanel>

      <NtPanel className="nt-stack nt-gap-3">
        <div className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">按模型统计</span>
          <strong className="nt-text-strong" style={SECTION_TITLE_STYLE}>
            每个模型在不同服务商上的调用量与市场价估算
          </strong>
        </div>
        <ModelMarketTable buckets={modelBuckets} />
      </NtPanel>

      <NtCard className="nt-stack nt-gap-2_5" style={DISCLAIMER_CARD_STYLE}>
        <span className="nt-kicker">重要说明</span>
        <strong className="nt-text-warn">这里是市场价估算，不是账单对账</strong>
        <span className="nt-text-warn" style={DISCLAIMER_BODY_STYLE}>
          页面金额由历史 Token 使用量 × 管理员配置的模型市场价计算得到，目的是帮助平台做定价和运营判断。思考 Token 当前仅用于展示，不额外单独计价；缓存 Token 当前沿用输入价格口径估算。它不会替代上游账单，也不直接代表用户侧结算结果。
        </span>
      </NtCard>
    </div>
  );
}
