import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OperatorDiscountCodeCreateCard,
  OperatorDiscountCodeEditor,
} from "@/components/products/operator-discount-code-editor";
import { auth } from "@/auth";
import {
  getFeatureSnapshot,
  listOperatorDiscountCodes,
  listOperatorProducts,
  type DiscountCodeOperatorView,
  type ProductOperatorView,
} from "@/lib/core-client";
import {
  applyOperatorDiscountCodeBatchAction,
  importOperatorDiscountCodesCsvAction,
  previewOperatorDiscountCodesCsvAction,
} from "@/lib/platform-actions";
import { isPlatformOperatorUserId } from "@/lib/platform-session";
import {
  consumeDiscountCodeImportPreviewFlash,
  DISCOUNT_CODE_IMPORT_PREVIEW_FLASH_COOKIE,
} from "@/lib/server-flash";

import type { DiscountCodeOperatorState } from "@neuro/contracts";

type PageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    csvPreview?: string;
    discountProductId?: string;
    discountState?: string;
    discountScope?: string;
    discountAudienceScope?: string;
    discountNamespace?: string;
    discountBatchLabel?: string;
    discountWindowDays?: string;
  }>;
};

function buildRedirectPath(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  if (params?.discountProductId) query.set("discountProductId", params.discountProductId);
  if (params?.discountState && params.discountState !== "all") query.set("discountState", params.discountState);
  if (params?.discountScope && params.discountScope !== "all") query.set("discountScope", params.discountScope);
  if (params?.discountAudienceScope && params.discountAudienceScope !== "all")
    query.set("discountAudienceScope", params.discountAudienceScope);
  if (params?.discountNamespace) query.set("discountNamespace", params.discountNamespace);
  if (params?.discountBatchLabel) query.set("discountBatchLabel", params.discountBatchLabel);
  if (params?.discountWindowDays) query.set("discountWindowDays", params.discountWindowDays);
  return query.size > 0 ? `/ops/discount-codes?${query.toString()}` : "/ops/discount-codes";
}

function scopeLabel(d: DiscountCodeOperatorView) {
  if (d.scope === "allProducts") return "全商品";
  if (d.scope === "productCategory") return `类目：${d.targetProductCategory ?? "—"}`;
  return `商品：${d.targetProductId ?? "—"}`;
}

function audienceLabel(d: DiscountCodeOperatorView) {
  if (d.audienceScope === "allUsers") return "全体用户";
  if (d.audienceScope === "userGroup") return `用户组：${d.audienceGroupKey ?? "—"}`;
  return `指定用户：${d.audienceUserId ?? "—"}`;
}

function resolveState(d: DiscountCodeOperatorView, windowDays: number): DiscountCodeOperatorState {
  const now = Date.now();
  if (!d.enabled) return "disabled";
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return "scheduled";
  if (d.expiresAt && new Date(d.expiresAt).getTime() < now) return "expired";
  if (d.expiresAt && new Date(d.expiresAt).getTime() <= now + windowDays * 86_400_000) return "expiring";
  return "activeWindow";
}

function stateClass(s: DiscountCodeOperatorState) {
  if (s === "activeWindow") return "ops-status-dot--active";
  if (s === "disabled" || s === "expired") return "ops-status-dot--inactive";
  return "ops-status-dot--scheduled";
}

function dt(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString("zh-CN") : "未设置";
}

export default async function DiscountCodeOpsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const showCsvPreview = params?.csvPreview === "1";
  const discountState = (params?.discountState as DiscountCodeOperatorState | undefined) ?? "all";
  const discountScope = params?.discountScope ?? "all";
  const discountAudienceScope = params?.discountAudienceScope ?? "all";
  const discountNamespace = params?.discountNamespace ?? "";
  const discountBatchLabel = params?.discountBatchLabel ?? "";
  const discountProductId = params?.discountProductId ?? "";
  const discountWindowDays = Math.max(1, Math.min(Number(params?.discountWindowDays || 7) || 7, 365));

  const isOperator = isPlatformOperatorUserId(session.user.id, session.user.providerUserId);
  const userContext = {
    userId: session.user.id,
    providerUserId: session.user.providerUserId ?? undefined,
    username: session.user.username,
  };
  const features = await getFeatureSnapshot();
  const cookieStore = await cookies();

  if (!isOperator) {
    return (
      <main className="ops-main">
        <div className="ops-page-stack">
          <p className="ops-alert ops-alert--error">当前账号无法访问优惠码运营台，需要平台操作员权限。</p>
        </div>
      </main>
    );
  }

  if (!features.discountCode.enabled) {
    return (
      <main className="ops-main">
        <div className="ops-page-stack">
          <p className="ops-alert ops-alert--error">当前 discountCode 模块未启用。</p>
        </div>
      </main>
    );
  }

  const baseArgs = {
    discountProductId,
    discountState,
    discountScope,
    discountAudienceScope,
    discountNamespace,
    discountBatchLabel,
    discountWindowDays: String(discountWindowDays),
  };
  const redirectTo = buildRedirectPath(baseArgs);
  const exportHref = redirectTo.replace("/ops/discount-codes", "/ops/discount-codes/export");

  const operatorProducts = features.product.enabled
    ? ((await listOperatorProducts(userContext)) as ProductOperatorView[])
    : [];
  const allCodes = (await listOperatorDiscountCodes(userContext)) as DiscountCodeOperatorView[];
  const filteredCodes = (await listOperatorDiscountCodes(userContext, {
    productId: discountProductId || undefined,
    state: discountState,
    scope: discountScope as DiscountCodeOperatorView["scope"] | "all",
    audienceScope: discountAudienceScope as DiscountCodeOperatorView["audienceScope"] | "all",
    namespace: discountNamespace || undefined,
    batchLabel: discountBatchLabel || undefined,
    windowDays: discountWindowDays,
  })) as DiscountCodeOperatorView[];

  const csvPreview = showCsvPreview && cookieStore.get(DISCOUNT_CODE_IMPORT_PREVIEW_FLASH_COOKIE)?.value
    ? await consumeDiscountCodeImportPreviewFlash(
        cookieStore.get(DISCOUNT_CODE_IMPORT_PREVIEW_FLASH_COOKIE)?.value || "",
      )
    : null;

  const enabledCount = allCodes.filter((c) => c.enabled).length;
  const expiringCount = allCodes.filter((c) => resolveState(c, discountWindowDays) === "expiring").length;

  return (
    <main className="ops-main">
      <div className="ops-page-stack">
        {/* ── Header ── */}
        <div className="ops-page-header">
          <h1 className="ops-page-title">优惠码管理</h1>
          <p className="ops-page-subtitle">
            优惠码全生命周期管理：创建、筛选、批量操作、CSV 导入。
          </p>
        </div>

        {status && message ? <p className={`ops-alert ops-alert--${status}`}>{message}</p> : null}

        {/* ── Overview ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">Inventory</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Total</th>
                  <th>Enabled</th>
                  <th>Filtered</th>
                  <th>Expiring ({discountWindowDays}d)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{allCodes.length}</td>
                  <td><span className="ops-status-dot ops-status-dot--active">{enabledCount}</span></td>
                  <td>{filteredCodes.length}</td>
                  <td><span className="ops-status-dot ops-status-dot--scheduled">{expiringCount}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">筛选</h2>
          <form action="/ops/discount-codes" className="ops-form" method="GET">
            <div className="ops-form__row">
              <label className="ops-form__label">
                商品
                <select className="ops-form__select" name="discountProductId" defaultValue={discountProductId}>
                  <option value="">全部商品</option>
                  {operatorProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.id})</option>
                  ))}
                </select>
              </label>
              <label className="ops-form__label">
                状态
                <select className="ops-form__select" name="discountState" defaultValue={discountState}>
                  <option value="all">全部</option>
                  <option value="activeWindow">当前生效</option>
                  <option value="expiring">即将到期</option>
                  <option value="expired">已过期</option>
                  <option value="scheduled">未生效</option>
                  <option value="enabled">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
              <label className="ops-form__label">
                范围
                <select className="ops-form__select" name="discountScope" defaultValue={discountScope}>
                  <option value="all">全部范围</option>
                  <option value="allProducts">全商品</option>
                  <option value="productCategory">指定类目</option>
                  <option value="specificProduct">指定商品</option>
                </select>
              </label>
            </div>
            <div className="ops-form__row">
              <label className="ops-form__label">
                受众
                <select className="ops-form__select" name="discountAudienceScope" defaultValue={discountAudienceScope}>
                  <option value="all">全部受众</option>
                  <option value="allUsers">全体用户</option>
                  <option value="userGroup">用户组</option>
                  <option value="specificUser">指定用户</option>
                </select>
              </label>
              <label className="ops-form__label">
                Namespace
                <input className="ops-form__input" name="discountNamespace" defaultValue={discountNamespace} placeholder="例如 spring-campaign" />
              </label>
              <label className="ops-form__label">
                Batch Label
                <input className="ops-form__input" name="discountBatchLabel" defaultValue={discountBatchLabel} placeholder="例如 2026-q1-a" />
              </label>
            </div>
            <div className="ops-form__row">
              <label className="ops-form__label">
                到期窗口（天）
                <input className="ops-form__input" min={1} max={365} name="discountWindowDays" step={1} type="number" defaultValue={discountWindowDays} />
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
                <button className="ops-form__submit" type="submit">应用筛选</button>
                <Link className="ops-inline-action" href="/ops/discount-codes">清空</Link>
              </div>
            </div>
          </form>
        </div>

        {/* ── Batch Ops ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">批量操作</h2>
          {filteredCodes.length === 0 ? (
            <p className="ops-empty">当前筛选条件下没有可批量操作的优惠码。</p>
          ) : (
            <form action={applyOperatorDiscountCodeBatchAction} className="ops-form">
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <div className="ops-form__row">
                <label className="ops-form__label">
                  批量动作
                  <select className="ops-form__select" name="batchAction" defaultValue="disable">
                    <option value="enable">批量启用</option>
                    <option value="disable">批量停用</option>
                    <option value="extendExpiry">批量延期</option>
                    <option value="setQuota">批量配额</option>
                    <option value="disableExpired">仅停用已过期</option>
                  </select>
                </label>
                <label className="ops-form__label">
                  延期天数
                  <input className="ops-form__input" min={1} max={365} name="extendDays" placeholder="仅延期时使用" step={1} type="number" defaultValue={7} />
                </label>
                <label className="ops-form__label">
                  总次数策略
                  <select className="ops-form__select" name="totalMaxUsesMode" defaultValue="leave">
                    <option value="leave">保持不变</option>
                    <option value="set">设置总次数</option>
                    <option value="clear">清空总次数</option>
                  </select>
                </label>
              </div>
              <div className="ops-form__row">
                <label className="ops-form__label">
                  总次数
                  <input className="ops-form__input" min={1} max={1000000} name="totalMaxUses" placeholder="仅配额时使用" step={1} type="number" />
                </label>
                <label className="ops-form__label">
                  单用户策略
                  <select className="ops-form__select" name="perUserLimitMode" defaultValue="leave">
                    <option value="leave">保持不变</option>
                    <option value="set">设置单用户上限</option>
                    <option value="clear">清空单用户上限</option>
                  </select>
                </label>
                <label className="ops-form__label">
                  单用户上限
                  <input className="ops-form__input" min={1} max={1000000} name="perUserLimit" placeholder="仅配额时使用" step={1} type="number" />
                </label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="ops-form__submit" type="submit">执行批量动作</button>
                <Link className="ops-inline-action" href={exportHref}>导出当前筛选 CSV</Link>
              </div>

              <div className="ops-batch-list">
                {filteredCodes.map((d) => {
                  const st = resolveState(d, discountWindowDays);
                  return (
                    <label className="ops-batch-item" key={d.id}>
                      <div className="ops-batch-item__head">
                        <span>
                          <input defaultChecked={false} name="discountCodeIds" type="checkbox" value={d.id} style={{ marginRight: 8 }} />
                          <strong>{d.code}</strong>
                          <span style={{ marginLeft: 8, opacity: 0.5, fontSize: "0.78rem" }}>{d.id}</span>
                        </span>
                        <span className={`ops-status-dot ${stateClass(st)}`}>{st}</span>
                        <span className={`ops-status-dot ${d.enabled ? "ops-status-dot--active" : "ops-status-dot--inactive"}`}>
                          {d.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <div style={{ padding: "6px 16px 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
                        {scopeLabel(d)} · {audienceLabel(d)} · 已用 {d.totalUsedCount} 次 · 到期 {dt(d.expiresAt)}
                      </div>
                    </label>
                  );
                })}
              </div>
            </form>
          )}
        </div>

        {/* ── CSV Preview ── */}
        {csvPreview ? (
          <div className="ops-card">
            <h2 className="ops-card__title">CSV Preview — Dry Run</h2>
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Total Rows</th>
                    <th>Create</th>
                    <th>Update</th>
                    <th>Unchanged</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{csvPreview.totalRows}</td>
                    <td><span className="ops-status-dot ops-status-dot--active">{csvPreview.createCount}</span></td>
                    <td><span className="ops-status-dot ops-status-dot--scheduled">{csvPreview.updateCount}</span></td>
                    <td>{csvPreview.unchangedCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="ops-batch-list">
              {csvPreview.previewItems.map((item) => (
                <div className="ops-batch-item" key={`${item.discountCodeId}-${item.code}`}>
                  <div className="ops-batch-item__head">
                    <span><strong>{item.code}</strong> <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>{item.discountCodeId}</span></span>
                    <span className={`ops-status-dot ${item.status === "create" ? "ops-status-dot--active" : item.status === "update" ? "ops-status-dot--scheduled" : "ops-status-dot--inactive"}`}>
                      {item.status}
                    </span>
                  </div>
                  {item.fieldDiffs.length > 0 ? (
                    <div className="ops-table-wrap" style={{ padding: "0 16px 12px" }}>
                      <table className="ops-table">
                        <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                        <tbody>
                          {item.fieldDiffs.map((fd) => (
                            <tr key={`${item.discountCodeId}-${String(fd.field)}`}>
                              <td><code>{String(fd.field)}</code></td>
                              <td>{fd.before ?? "—"}</td>
                              <td>{fd.after ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── CSV Import ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">CSV 导入</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--mg-text-muted)", margin: 0 }}>
            先用"导出当前筛选 CSV"拿到标准列头，再编辑后重新导入。按 <code>discountCodeId</code> 做 upsert。
          </p>
          <form action={importOperatorDiscountCodesCsvAction} className="ops-form">
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <div className="ops-form__row">
              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                CSV 文件
                <input className="ops-form__input" accept=".csv,text/csv" name="csvFile" type="file" />
              </label>
            </div>
            <div className="ops-form__row">
              <label className="ops-form__label">
                原因
                <input className="ops-form__input" name="importReason" placeholder="例如 运营交接导入" />
              </label>
              <label className="ops-form__label">
                渠道
                <input className="ops-form__input" name="importChannel" placeholder="例如 ops-products-ui" />
              </label>
              <label className="ops-form__label">
                备注
                <input className="ops-form__input" name="importNote" placeholder="记录 CSV 来源" />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ops-form__submit" type="submit">导入 CSV</button>
              <button className="ops-inline-action" formAction={previewOperatorDiscountCodesCsvAction} type="submit">先做预览</button>
              <Link className="ops-inline-action" href={exportHref}>下载当前筛选 CSV</Link>
            </div>
          </form>
        </div>

        {/* ── Create ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">新建优惠码</h2>
          <OperatorDiscountCodeCreateCard redirectTo={redirectTo} />
        </div>

        {/* ── Edit ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">现有优惠码维护</h2>
          {filteredCodes.length === 0 ? (
            <p className="ops-empty">暂无优惠码记录。</p>
          ) : (
            filteredCodes.map((d) => (
              <OperatorDiscountCodeEditor key={d.id} discountCode={d} redirectTo={redirectTo} />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
