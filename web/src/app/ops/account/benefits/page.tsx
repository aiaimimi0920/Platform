import type { BenefitFamilyKey, BenefitServiceView } from "@/lib/account-client";
import { listOperatorBenefitCatalog, searchOperatorBenefitUsers } from "@/lib/account-client";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ServiceForm } from "./service-form";

import {
  addBenefitProductBindingAction,
  archiveBenefitServiceAction,
  createBenefitGrantAction,
  deleteBenefitProductBindingAction,
  deleteBenefitServiceAction,
  importBenefitCredentialPoolAction,
  revokeBenefitGrantAction,
  rotateBenefitAssignmentAction,
  saveBenefitFamilyAction,
  saveBenefitServiceAction,
} from "./actions";

type BenefitOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    familyKey?: string;
    serviceId?: string;
    productLineId?: string;
    q?: string;
  }>;
};

const FAMILY_TONE_OPTIONS = [
  { value: "signal", label: "信号黄" },
  { value: "cyan", label: "冷青" },
  { value: "ink", label: "深墨" },
];

const SERVICE_STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "启用" },
  { value: "archived", label: "归档" },
];

// SERVICE_ROLE_OPTIONS and inferServiceRole moved to service-form.tsx (client component)

function buildBlankService(familyKey: BenefitFamilyKey): BenefitServiceView {
  const timestamp = new Date().toISOString();
  return {
    id: "",
    familyKey,
    productLineId: null,
    serviceKind: "credential_service_v1",
    status: "draft",
    title: "",
    sortOrder: 100,
    config: {
      title: "",
      providerKey: "platform_a",
      assignmentMode: "sticky",
      payloadSchemaVersion: "credential-v1",
      refillDeliveryMode: "direct_credential",
      refillModeText: "无限续杯",
      availabilityLabel: "可用账号数",
      availabilityText: "30/30",
      apiDeliveryMode: "service_proxy",
      apiModeText: "无限调用",
      apiUrl: "",
      downloadEnabled: true,
      downloadUrl: null,
    },
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

function statusDotClass(status: string) {
  if (status === "active") return "ops-status-dot--active";
  if (status === "archived") return "ops-status-dot--inactive";
  return "ops-status-dot--scheduled";
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "启用",
  archived: "归档",
};

export default async function BenefitOpsPage({ searchParams }: BenefitOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const userContext = await requirePlatformOperatorUserContext();

  let catalog: Awaited<ReturnType<typeof listOperatorBenefitCatalog>>;
  try {
    catalog = await listOperatorBenefitCatalog(userContext);
  } catch (error) {
    return (
      <div className="ops-page-stack">
        <div className="ops-page-header">
          <h1 className="ops-page-title">羊毛派管理</h1>
        </div>
        <div className="ops-alert ops-alert--error">
          {error instanceof Error ? error.message : "加载失败"}
        </div>
      </div>
    );
  }

  const familyKey = (params.familyKey?.trim() as BenefitFamilyKey | undefined) || catalog.families[0]?.key || "artificial_intelligence";
  const currentFamily = catalog.families.find((f) => f.key === familyKey) ?? catalog.families[0];
  const servicesForFamily = catalog.services.filter((s) => s.familyKey === currentFamily.key);
  const serviceId = params.serviceId?.trim() || servicesForFamily[0]?.id || "new";
  const currentService = servicesForFamily.find((s) => s.id === serviceId) ?? buildBlankService(currentFamily.key);
  const isNewService = serviceId === "new" || !currentService.id;
  const searchQuery = params.q?.trim() || "";
  const userSearchResults = !isNewService && searchQuery ? await searchOperatorBenefitUsers(userContext, searchQuery) : [];

  const bindings = currentService.id ? catalog.productBindings.filter((b) => b.serviceId === currentService.id) : [];
  const grants = currentService.id ? catalog.grants.filter((g) => g.serviceId === currentService.id) : [];
  const assignments = currentService.id ? catalog.assignments.filter((a) => a.serviceId === currentService.id) : [];
  const pools = currentService.id ? catalog.credentialPools.filter((p) => p.serviceId === currentService.id) : [];

  const redirectTo = `/ops/account/benefits?familyKey=${encodeURIComponent(currentFamily.key)}&serviceId=${encodeURIComponent(currentService.id || "new")}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`;

  return (
    <div className="ops-page-stack">
      <div className="ops-page-header">
        <h1 className="ops-page-title">羊毛派管理</h1>
        <p className="ops-page-subtitle">管理权益族、服务、商品映射与用户授权</p>
      </div>

      {params.status && params.message ? (
        <div className={`ops-alert ops-alert--${params.status === "success" ? "success" : "error"}`}>
          {params.message}
        </div>
      ) : null}

      {/* ─── 左右布局：权益族导航 + 主编辑区 ─── */}
      <div className="ops-benefit-layout">

        {/* ─── 左侧：权益族 → 产品线 → 服务 三层导航 ─── */}
        <aside className="ops-benefit-sidebar">
          <div className="ops-card">
            <h2 className="ops-card__title">权益族目录</h2>
            <div className="ops-benefit-nav">
              {catalog.families.map((family) => {
                const familyActive = family.key === currentFamily.key;
                const familyProductLines = (catalog.productLines ?? []).filter((pl) => pl.familyKey === family.key);
                const ungroupedServices = catalog.services.filter((s) => s.familyKey === family.key && !s.productLineId);
                return (
                  <div key={family.key} className="ops-benefit-nav__group">
                    <Link
                      className={cn("ops-benefit-nav__family", familyActive && "ops-benefit-nav__family--active")}
                      href={`/ops/account/benefits?familyKey=${encodeURIComponent(family.key)}&serviceId=new`}
                    >
                      <strong>{family.title}</strong>
                      <span className="ops-benefit-nav__count">
                        {family.actionableServiceCount}/{family.serviceCount}
                      </span>
                    </Link>
                    {familyActive ? (
                      <div className="ops-benefit-nav__services">
                        {/* Product lines with their services */}
                        {familyProductLines.map((pl) => {
                          const plServices = catalog.services.filter((s) => s.productLineId === pl.id);
                          return (
                            <div key={pl.id} className="ops-benefit-nav__product-line">
                              <div className="ops-benefit-nav__pl-head">
                                <strong>{pl.displayName}</strong>
                                <span className="ops-benefit-nav__count">{pl.serviceCount}</span>
                              </div>
                              <div className="ops-benefit-nav__pl-services">
                                {plServices.map((service) => (
                                  <Link
                                    className={cn("ops-benefit-nav__service", service.id === currentService.id && "ops-benefit-nav__service--active")}
                                    href={`/ops/account/benefits?familyKey=${encodeURIComponent(family.key)}&serviceId=${encodeURIComponent(service.id)}`}
                                    key={service.id}
                                  >
                                    <span className={`ops-status-dot ${statusDotClass(service.status)}`}>{STATUS_LABELS[service.status] ?? service.status}</span>
                                    <strong>{service.title}</strong>
                                  </Link>
                                ))}
                                <Link
                                  className="ops-benefit-nav__new"
                                  href={`/ops/account/benefits?familyKey=${encodeURIComponent(family.key)}&serviceId=new&productLineId=${encodeURIComponent(pl.id)}`}
                                >
                                  + 新服务
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                        {/* Ungrouped services (no product line) */}
                        {ungroupedServices.map((service) => (
                          <Link
                            className={cn("ops-benefit-nav__service", service.id === currentService.id && "ops-benefit-nav__service--active")}
                            href={`/ops/account/benefits?familyKey=${encodeURIComponent(family.key)}&serviceId=${encodeURIComponent(service.id)}`}
                            key={service.id}
                          >
                            <span className={`ops-status-dot ${statusDotClass(service.status)}`}>{STATUS_LABELS[service.status] ?? service.status}</span>
                            <strong>{service.title}</strong>
                          </Link>
                        ))}
                        <Link className="ops-benefit-nav__new" href={`/ops/account/benefits?familyKey=${encodeURIComponent(family.key)}&serviceId=new`}>
                          + 新建服务
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ─── 右侧：编辑主板 ─── */}
        <div className="ops-benefit-main">

          {/* 权益族配置 */}
          <div className="ops-card" key={`fam-${currentFamily.key}`}>
            <h2 className="ops-card__title">权益族 · {currentFamily.title}</h2>
            <form action={saveBenefitFamilyAction} className="ops-form">
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <input name="familyKey" type="hidden" value={currentFamily.key} />
              <div className="ops-form__row">
                <label className="ops-form__label">
                  标题
                  <input className="ops-form__input" defaultValue={currentFamily.title} name="title" required />
                </label>
                <label className="ops-form__label">
                  视觉语气
                  <select className="ops-form__select" defaultValue={currentFamily.tone} name="tone">
                    {FAMILY_TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="ops-form__label">
                  排序
                  <input className="ops-form__input" defaultValue={String(currentFamily.sortOrder)} name="sortOrder" type="number" />
                </label>
              </div>
              <div className="ops-form__row">
                <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                  说明
                  <input className="ops-form__input" defaultValue={currentFamily.description ?? ""} name="description" placeholder="可留空" />
                </label>
              </div>
              <button className="ops-form__submit" type="submit">保存权益族</button>
            </form>
          </div>

          {/* 服务编辑 */}
          <ServiceForm
            key={`svc-form-${currentService.id || "new"}`}
            currentService={currentService}
            isNewService={isNewService}
            familyKey={currentFamily.key}
            productLineId={currentService.productLineId ?? params.productLineId ?? null}
            redirectTo={redirectTo}
          />

          {!isNewService ? (
            <>
              {/* 商品映射 */}
              <div className="ops-card">
                <h2 className="ops-card__title">商品映射</h2>
                <form action={addBenefitProductBindingAction} className="ops-form">
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <input name="serviceId" type="hidden" value={currentService.id} />
                  <div className="ops-form__row">
                    <label className="ops-form__label" style={{ gridColumn: "1 / 3" }}>
                      绑定商品
                      <select className="ops-form__select" name="productId">
                        {catalog.products.map((p) => (
                          <option key={p.id} value={p.id}>{p.title} · {p.active ? "active" : "inactive"}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ops-form__label" style={{ display: "flex", alignItems: "flex-end" }}>
                      <button className="ops-form__submit" type="submit">新增映射</button>
                    </label>
                  </div>
                </form>
                {bindings.length === 0 ? (
                  <p className="ops-empty">暂无商品映射</p>
                ) : (
                  <div className="ops-table-wrap">
                    <table className="ops-table">
                      <thead><tr><th>商品</th><th>商品 ID</th><th>操作</th></tr></thead>
                      <tbody>
                        {bindings.map((b) => (
                          <tr key={b.id}>
                            <td>{b.productTitle}</td>
                            <td><code>{b.productId}</code></td>
                            <td>
                              <form action={deleteBenefitProductBindingAction} style={{ display: "inline" }}>
                                <input name="redirectTo" type="hidden" value={redirectTo} />
                                <input name="bindingId" type="hidden" value={b.id} />
                                <button className="ops-inline-action" type="submit">删除</button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 用户授权 */}
              <div className="ops-card">
                <h2 className="ops-card__title">用户授权</h2>
                <form action="/ops/account/benefits" method="get" className="ops-form">
                  <input name="familyKey" type="hidden" value={currentFamily.key} />
                  <input name="serviceId" type="hidden" value={currentService.id} />
                  <div className="ops-form__row">
                    <label className="ops-form__label" style={{ gridColumn: "1 / 3" }}>
                      搜索用户
                      <input className="ops-form__input" defaultValue={searchQuery} name="q" placeholder="用户名 / providerUserId / 邮箱" />
                    </label>
                    <label className="ops-form__label" style={{ display: "flex", alignItems: "flex-end" }}>
                      <button className="ops-form__submit" type="submit">搜索</button>
                    </label>
                  </div>
                </form>

                {searchQuery && userSearchResults.length > 0 ? (
                  <div className="ops-table-wrap">
                    <table className="ops-table">
                      <thead><tr><th>用户</th><th>Provider ID</th><th>操作</th></tr></thead>
                      <tbody>
                        {userSearchResults.map((u) => (
                          <tr key={u.userId}>
                            <td>{u.username}</td>
                            <td><code>{u.providerUserId ?? "—"}</code></td>
                            <td>
                              <form action={createBenefitGrantAction} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                <input name="redirectTo" type="hidden" value={redirectTo} />
                                <input name="serviceId" type="hidden" value={currentService.id} />
                                <input name="userId" type="hidden" value={u.userId} />
                                <input className="ops-form__input" name="durationDays" type="number" min={1} defaultValue={1} style={{ width: 60 }} placeholder="天" />
                                <button className="ops-form__submit" type="submit">授权</button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : searchQuery ? (
                  <p className="ops-empty">没有找到匹配用户</p>
                ) : null}

                {/* 当前授权 + 分配 */}
                <div className="ops-benefit-dual">
                  <div>
                    <h3 className="ops-card__title">当前授权 ({grants.length})</h3>
                    {grants.length === 0 ? (
                      <p className="ops-empty">暂无授权</p>
                    ) : (
                      <div className="ops-table-wrap">
                        <table className="ops-table">
                          <thead><tr><th>用户</th><th>来源</th><th>状态</th><th>过期时间</th><th>操作</th></tr></thead>
                          <tbody>
                            {grants.map((g) => (
                              <tr key={g.id}>
                                <td>{g.username ?? g.userId}</td>
                                <td><span className={`ops-status-dot ${g.sourceType === "purchase" ? "ops-status-dot--active" : "ops-status-dot--scheduled"}`}>{g.sourceType}</span></td>
                                <td><span className={`ops-status-dot ${g.status === "active" ? "ops-status-dot--active" : "ops-status-dot--inactive"}`}>{g.status}</span></td>
                                <td style={{ fontSize: "0.78rem" }}>{g.expiresAt ? new Date(g.expiresAt).toLocaleString("zh-CN") : "永久"}{g.durationDays ? ` (${g.durationDays}天)` : ""}</td>
                                <td>
                                  {g.status === "active" ? (
                                    <form action={revokeBenefitGrantAction} style={{ display: "inline" }}>
                                      <input name="redirectTo" type="hidden" value={redirectTo} />
                                      <input name="grantId" type="hidden" value={g.id} />
                                      <button className="ops-inline-action" type="submit">回收</button>
                                    </form>
                                  ) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="ops-card__title">当前分配 ({assignments.length})</h3>
                    {assignments.length === 0 ? (
                      <p className="ops-empty">暂无分配</p>
                    ) : (
                      <div className="ops-table-wrap">
                        <table className="ops-table">
                          <thead><tr><th>用户</th><th>状态</th><th>操作</th></tr></thead>
                          <tbody>
                            {assignments.map((a) => (
                              <tr key={a.id}>
                                <td>{a.username ?? a.userId}</td>
                                <td><span className={`ops-status-dot ${a.status === "active" ? "ops-status-dot--active" : a.status === "pending" ? "ops-status-dot--scheduled" : "ops-status-dot--inactive"}`}>{a.status}</span></td>
                                <td>
                                  <form action={rotateBenefitAssignmentAction} style={{ display: "inline" }}>
                                    <input name="redirectTo" type="hidden" value={redirectTo} />
                                    <input name="serviceId" type="hidden" value={currentService.id} />
                                    <input name="userId" type="hidden" value={a.userId} />
                                    <button className="ops-inline-action" type="submit">轮换</button>
                                  </form>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 凭证池 */}
              <div className="ops-card">
                <h2 className="ops-card__title">凭证池 ({pools.length})</h2>
                <form action={importBenefitCredentialPoolAction} className="ops-form">
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <input name="serviceId" type="hidden" value={currentService.id} />
                  <div className="ops-form__row">
                    <label className="ops-form__label">
                      批次标题
                      <input className="ops-form__input" name="label" placeholder="codex-batch-01" />
                    </label>
                    <label className="ops-form__label">
                      导入备注
                      <input className="ops-form__input" name="importNote" placeholder="可留空" />
                    </label>
                    <label className="ops-form__label" style={{ display: "flex", alignItems: "flex-end" }}>
                      <button className="ops-form__submit" type="submit">导入凭证</button>
                    </label>
                  </div>
                  <label className="ops-form__label">
                    凭证 JSON
                    <textarea
                      className="ops-form__input"
                      defaultValue={JSON.stringify([{ entryLabel: "slot-01", refillCode: "CODX-XXXX", apiKey: "sk-xxxx", apiUrl: "https://xxxx" }], null, 2)}
                      name="entriesJson"
                      rows={6}
                      spellCheck={false}
                      style={{ fontFamily: "monospace", resize: "vertical" }}
                    />
                  </label>
                </form>

                {pools.length > 0 ? (
                  <div className="ops-table-wrap">
                    <table className="ops-table">
                      <thead><tr><th>批次</th><th>可用</th><th>已分配</th><th>已回收</th></tr></thead>
                      <tbody>
                        {pools.map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.label}</strong></td>
                            <td>{p.availableCount}</td>
                            <td>{p.assignedCount}</td>
                            <td>{p.revokedCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              {/* 危险操作 */}
              <div className="ops-card">
                <h2 className="ops-card__title">危险操作</h2>
                <div style={{ display: "flex", gap: 10 }}>
                  {currentService.status !== "archived" ? (
                    <form action={archiveBenefitServiceAction}>
                      <input name="redirectTo" type="hidden" value={redirectTo} />
                      <input name="serviceId" type="hidden" value={currentService.id} />
                      <button className="ops-inline-action" type="submit">归档服务</button>
                    </form>
                  ) : null}
                  <form action={deleteBenefitServiceAction}>
                    <input name="redirectTo" type="hidden" value={`/ops/account/benefits?familyKey=${encodeURIComponent(currentFamily.key)}&serviceId=new`} />
                    <input name="serviceId" type="hidden" value={currentService.id} />
                    <button className="ops-inline-action" style={{ borderColor: "rgba(244,63,94,0.3)", color: "#fda4af" }} type="submit">删除服务</button>
                  </form>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
