import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, Panel } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { listOperatorBenefitCatalog, listOperatorCredentialPoolCatalog } from "@/lib/account-client";
import { cn } from "@/lib/cn";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";

import {
  claimCredentialRepairAction,
  createCredentialTerminalAction,
  importCredentialPoolAction,
  markCredentialCoolingAction,
  markCredentialDeathAction,
  markCredentialInvalidAction,
  releaseCredentialRepairAction,
  revokeCredentialTerminalAction,
  rotateCredentialAssignmentAction,
} from "./actions";

type CredentialPoolsOpsPageProps = {
  searchParams?: Promise<{
    provider?: string;
    status?: string;
    serviceId?: string;
    message?: string;
    flash?: string;
  }>;
};

const LIFECYCLE_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "available", label: "可用" },
  { value: "repair", label: "修缮" },
  { value: "cooling", label: "冷却" },
  { value: "invalid", label: "无效" },
  { value: "death_pending", label: "待删除" },
  { value: "deleted", label: "已删除" },
];

export default async function CredentialPoolsOpsPage({ searchParams }: CredentialPoolsOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问凭证池后台。")}`);
  }

  const params = (await searchParams) ?? {};
  const flashStatus = params.flash?.trim() || "";
  const userContext = await requirePlatformOperatorUserContext();
  const [credentialCatalog, benefitCatalog] = await Promise.all([
    listOperatorCredentialPoolCatalog(userContext),
    listOperatorBenefitCatalog(userContext),
  ]);

  const providerFilter = params.provider?.trim() || "all";
  const lifecycleFilter = params.status?.trim() || "all";
  const serviceId = params.serviceId?.trim() || "all";

  const services = benefitCatalog.services.map((service) => ({
    id: service.id,
    title: service.title,
    providerKey: service.config.providerKey,
    familyKey: service.familyKey,
  }));

  const providerOptions = [
    { value: "all", label: "全部 provider" },
    ...credentialCatalog.providers.map((provider) => ({
      value: provider.key,
      label: `${provider.displayName} · ${provider.activeEntryCount} 个可用`,
    })),
  ];

  const selectedProvider =
    providerFilter === "all"
      ? undefined
      : credentialCatalog.providers.find((provider) => provider.key === providerFilter);
  const selectedService = services.find((service) => service.id === serviceId);

  const filteredEntries = credentialCatalog.entries.filter((entry) => {
    if (providerFilter !== "all" && entry.providerKey !== providerFilter) return false;
    if (lifecycleFilter !== "all" && entry.lifecycleStatus !== lifecycleFilter) return false;
    if (serviceId !== "all" && entry.benefitServiceId !== serviceId) return false;
    return true;
  });

  const filteredAssignments = credentialCatalog.assignments.filter((assignment) => {
    if (providerFilter !== "all" && assignment.providerKey !== providerFilter) return false;
    if (serviceId !== "all" && assignment.benefitServiceId !== serviceId) return false;
    return true;
  });

  const filteredBatches = credentialCatalog.uploadBatches.filter((batch) => {
    if (providerFilter !== "all" && batch.providerKey !== providerFilter) return false;
    if (serviceId !== "all" && batch.benefitServiceId !== serviceId) return false;
    return true;
  });

  const filteredRepairClaims = credentialCatalog.repairClaims.filter((claim) => {
    if (serviceId !== "all" && claim.benefitServiceId !== serviceId) return false;
    return true;
  });

  const benefitHandoffUrl = selectedService
    ? `/ops/account/benefits?familyKey=${encodeURIComponent(selectedService.familyKey)}&serviceId=${encodeURIComponent(
        selectedService.id,
      )}`
    : "/ops/account/benefits";

  const redirectTo = `/ops/account/credential-pools?provider=${encodeURIComponent(providerFilter)}&status=${encodeURIComponent(
    lifecycleFilter,
  )}&serviceId=${encodeURIComponent(serviceId)}`;

  return (
    <main className="app-page">
      <div className="mg-shell app-stack" style={{ paddingBlock: "32px 48px" }}>
        {params.message ? (
          <Panel
            className="mg-panel--glass"
            style={{
              padding: "16px 18px",
              color: flashStatus === "success" ? "rgba(180,255,214,0.94)" : "rgba(255,198,198,0.94)",
            }}
          >
            {params.message}
          </Panel>
        ) : null}

        <div className="app-announcement-ops">
          <aside className="app-announcement-ops__sidebar">
            <Card className="app-announcement-ops__sidebar-card">
              <div className="app-announcement-ops__sidebar-head">
                <span className="mg-badge mg-badge--warning">Credential Pools</span>
                <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05 }}>多平台凭证池</h2>
                <p style={{ margin: 0, color: "rgba(226,232,240,0.72)" }}>
                  后台 owner：provider / terminal / batch / entry / assignment / repair / death。
                </p>
              </div>

              <form action="/ops/account/credential-pools" className="app-announcement-ops__form" method="get">
                <div className="app-announcement-ops__field-grid app-mission-ops__field-grid">
                  <label className="app-announcement-ops__field">
                    <span>Provider</span>
                    <Select defaultValue={providerFilter} name="provider">
                      {providerOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="app-announcement-ops__field">
                    <span>生命周期</span>
                    <Select defaultValue={lifecycleFilter} name="status">
                      {LIFECYCLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="app-announcement-ops__field">
                    <span>服务</span>
                    <Select defaultValue={serviceId} name="serviceId">
                      <option value="all">全部服务</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>{service.title} · {service.providerKey}</option>
                      ))}
                    </Select>
                  </label>
                </div>
                <div className="app-announcement-ops__actions">
                  <button className="mg-btn mg-btn--secondary" type="submit">应用筛选</button>
                  <Link className="mg-btn mg-btn--outline" href={benefitHandoffUrl}>返回羊毛派目录</Link>
                </div>
              </form>

              {selectedService ? (
                <Panel className="app-announcement-ops__provider-summary" style={{ marginTop: "12px", padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                    <div>
                      <strong>{selectedService.title}</strong>
                      <p style={{ margin: 0, color: "rgba(226,232,240,0.7)" }}>
                        当前已按服务聚焦，用户侧羊毛派与后台凭证池会使用同一个 service id。
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Badge variant="warning">{selectedService.providerKey}</Badge>
                      <Badge variant="cyan">{filteredEntries.length} entries</Badge>
                      <Badge variant="success">{filteredAssignments.length} assignments</Badge>
                    </div>
                  </div>
                  <div className="app-announcement-ops__actions" style={{ marginTop: "8px" }}>
                    <Link className="mg-btn mg-btn--outline" href={benefitHandoffUrl}>
                      返回服务编辑
                    </Link>
                  </div>
                </Panel>
              ) : selectedProvider ? (
                <Panel className="app-announcement-ops__provider-summary" style={{ marginTop: "12px", padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                    <div>
                      <strong>{selectedProvider.displayName}</strong>
                      <p style={{ margin: 0, color: "rgba(226,232,240,0.7)" }}>
                        当前在管 lifecycle {selectedProvider.activeEntryCount} 个 available / {selectedProvider.activeAssignmentCount} 项 assignment
                      </p>
                    </div>
                    <Badge variant="cyan">{selectedProvider.serviceCount} services</Badge>
                  </div>
                  <div className="app-announcement-ops__field-grid app-mission-ops__field-grid" style={{ marginTop: "12px" }}>
                    <div className="app-announcement-ops__field">
                      <span>Active entries</span>
                      <strong>{selectedProvider.activeEntryCount}</strong>
                    </div>
                    <div className="app-announcement-ops__field">
                      <span>Active assignments</span>
                      <strong>{selectedProvider.activeAssignmentCount}</strong>
                    </div>
                    <div className="app-announcement-ops__field">
                      <span>Terminals</span>
                      <strong>{selectedProvider.terminalCount}</strong>
                    </div>
                  </div>
                  <div className="app-announcement-ops__actions" style={{ marginTop: "8px" }}>
                    <Link className="mg-btn mg-btn--outline" href={benefitHandoffUrl}>
                      继续在 benefits 查看服务
                    </Link>
                  </div>
                </Panel>
              ) : (
                <Panel className="app-announcement-ops__provider-summary" style={{ marginTop: "12px", padding: "14px 18px" }}>
                  <strong>选择 Provider 聚焦</strong>
                  <p style={{ margin: 0, color: "rgba(226,232,240,0.7)" }}>当前显示全部 provider，过滤后会有对应统计。</p>
                </Panel>
              )}

              <div className="app-announcement-ops__list" style={{ gap: "12px" }}>
                {credentialCatalog.providers.map((provider) => (
                  <div className="app-announcement-ops__list-item" key={provider.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                      <strong className="app-announcement-ops__list-item-title">{provider.displayName}</strong>
                      <span className="mg-badge mg-badge--glass">{provider.activeEntryCount}</span>
                    </div>
                    <span className="app-announcement-ops__list-item-subtitle">
                      terminal {provider.terminalCount} · assignment {provider.activeAssignmentCount}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </aside>

          <div className="app-announcement-ops__main" style={{ display: "grid", gap: "20px" }}>
            <Card className="app-announcement-ops__editor-card">
              <div className="app-announcement-ops__editor-head">
                <div className="app-announcement-ops__editor-copy">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className="mg-badge mg-badge--cyan">独立 owner</span>
                    <Badge variant="warning">credential-pools</Badge>
                  </div>
                  <h1 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05 }}>账号凭证池后台</h1>
                  <p style={{ margin: 0, color: "rgba(226,232,240,0.72)", maxWidth: "78ch" }}>
                    `benefits` 现在只负责 family / service / grant；真正的凭证池生命周期、终端上传、修缮、冷却、无效、死亡清理都收口在这里。
                  </p>
                </div>
              </div>

              <div className="app-announcement-ops__field-grid app-mission-ops__field-grid">
                <div className="app-announcement-ops__field">
                  <span>可用</span>
                  <strong>{credentialCatalog.summary.availableEntryCount}</strong>
                </div>
                <div className="app-announcement-ops__field">
                  <span>修缮</span>
                  <strong>{credentialCatalog.summary.repairEntryCount}</strong>
                </div>
                <div className="app-announcement-ops__field">
                  <span>冷却</span>
                  <strong>{credentialCatalog.summary.coolingEntryCount}</strong>
                </div>
                <div className="app-announcement-ops__field">
                  <span>无效 / 待删除</span>
                  <strong>{credentialCatalog.summary.invalidEntryCount} / {credentialCatalog.summary.deathPendingEntryCount}</strong>
                </div>
              </div>
            </Card>

            <Card className="app-announcement-ops__editor-card">
              <div className="app-mission-ops__section">
                <div className="app-mission-ops__section-head">
                  <div>
                    <strong>终端签发与导入</strong>
                    <p>终端令牌和 operator import 都走同一套 provider 框架。</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "18px" }}>
                  <form action={createCredentialTerminalAction} className="app-announcement-ops__form">
                    <input name="redirectTo" type="hidden" value={redirectTo} />
                    <div className="app-announcement-ops__field-grid app-mission-ops__field-grid">
                      <label className="app-announcement-ops__field">
                        <span>Provider</span>
                        <Select defaultValue={providerFilter === "all" ? "platform_a" : providerFilter} name="providerKey">
                          {providerOptions.filter((option) => option.value !== "all").map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="app-announcement-ops__field">
                        <span>终端名称</span>
                        <Input name="label" placeholder="例如 upload-node-01" />
                      </label>
                      <label className="app-announcement-ops__field app-mission-ops__field--wide">
                        <span>备注</span>
                        <Input name="note" placeholder="终端来源、用途、所在子终端等说明" />
                      </label>
                    </div>
                    <div className="app-announcement-ops__actions">
                      <button className="mg-btn mg-btn--secondary" type="submit">签发终端令牌</button>
                    </div>
                  </form>

                  <form action={importCredentialPoolAction} className="app-announcement-ops__form">
                    <input name="redirectTo" type="hidden" value={redirectTo} />
                    <div className="app-announcement-ops__field-grid app-mission-ops__field-grid">
                      <label className="app-announcement-ops__field">
                        <span>Provider</span>
                        <Select defaultValue={providerFilter === "all" ? "platform_a" : providerFilter} name="providerKey">
                          {providerOptions.filter((option) => option.value !== "all").map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="app-announcement-ops__field">
                        <span>批次标题</span>
                        <Input name="label" placeholder="例如 2026-03-28 A 平台首批" />
                      </label>
                      <label className="app-announcement-ops__field app-mission-ops__field--wide">
                        <span>批次备注</span>
                        <Input name="importNote" placeholder="导入来源 / 兼容说明 / 修缮背景" />
                      </label>
                      <label className="app-announcement-ops__field app-mission-ops__field--wide">
                        <span>Entries JSON</span>
                        <Textarea
                          name="entriesJson"
                          defaultValue={
                            selectedService
                              ? `[{"benefitServiceId":"${selectedService.id}","entryLabel":"slot-01","scope":"public","payload":{"refillCode":"abc","apiKey":"xyz","apiUrl":"https://example.com"}}]`
                              : undefined
                          }
                          placeholder='[{"benefitServiceId":"benefit-service-codex","entryLabel":"slot-01","scope":"public","payload":{"refillCode":"abc","apiKey":"xyz","apiUrl":"https://example.com"}}]'
                          rows={8}
                        />
                      </label>
                    </div>
                    <div className="app-announcement-ops__actions">
                      <button className="mg-btn mg-btn--primary" type="submit">导入凭证池批次</button>
                    </div>
                  </form>
                </div>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
              <Card className="app-announcement-ops__editor-card">
                <div className="app-mission-ops__section">
                  <div className="app-mission-ops__section-head">
                    <div>
                      <strong>Entry 列表</strong>
                      <p>按 provider / service / lifecycle 过滤后的凭证条目。</p>
                    </div>
                  </div>
                  <div className="app-announcement-ops__list" style={{ maxHeight: "600px" }}>
                    {filteredEntries.length === 0 ? (
                      <div className="app-benefit-card__preview-empty">当前筛选下没有凭证条目。</div>
                    ) : (
                      filteredEntries.map((entry) => (
                        <div className="app-announcement-ops__list-item" key={entry.id}>
                          <div style={{ display: "grid", gap: "6px" }}>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                              <span className="mg-badge mg-badge--glass">{entry.providerKey}</span>
                              <span className={cn("mg-badge", entry.lifecycleStatus === "available" ? "mg-badge--success" : "mg-badge--warning")}>
                                {entry.lifecycleStatus}
                              </span>
                              <Badge variant="cyan">{entry.storageMode}</Badge>
                            </div>
                            <strong className="app-announcement-ops__list-item-title">{entry.previewLabel ?? entry.maskedSummary}</strong>
                            <span className="app-announcement-ops__list-item-subtitle">
                              {entry.benefitServiceId} · {entry.scope} · {entry.id}
                            </span>
                            {entry.invalidReason ? <span className="app-announcement-ops__list-item-subtitle">原因：{entry.invalidReason}</span> : null}
                          </div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <form action={claimCredentialRepairAction}>
                              <input name="redirectTo" type="hidden" value={redirectTo} />
                              <input name="entryId" type="hidden" value={entry.id} />
                              <button className="mg-btn mg-btn--glass" type="submit">领取修缮</button>
                            </form>
                            <form action={markCredentialCoolingAction}>
                              <input name="redirectTo" type="hidden" value={redirectTo} />
                              <input name="entryId" type="hidden" value={entry.id} />
                              <input name="cooldownMinutes" type="hidden" value="60" />
                              <input name="reason" type="hidden" value="operator manual cooling" />
                              <button className="mg-btn mg-btn--outline" type="submit">冷却 60m</button>
                            </form>
                            <form action={markCredentialInvalidAction}>
                              <input name="redirectTo" type="hidden" value={redirectTo} />
                              <input name="entryId" type="hidden" value={entry.id} />
                              <input name="reason" type="hidden" value="operator marked invalid" />
                              <button className="mg-btn mg-btn--outline" type="submit">标记无效</button>
                            </form>
                            <form action={markCredentialDeathAction}>
                              <input name="redirectTo" type="hidden" value={redirectTo} />
                              <input name="entryId" type="hidden" value={entry.id} />
                              <input name="reason" type="hidden" value="operator scheduled purge" />
                              <button className="mg-btn mg-btn--secondary" type="submit">死亡清理</button>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              <div style={{ display: "grid", gap: "20px" }}>
                <Card className="app-announcement-ops__editor-card">
                  <div className="app-mission-ops__section">
                    <div className="app-mission-ops__section-head">
                      <div>
                        <strong>终端与修缮</strong>
                        <p>终端上传身份和当前修缮 claim。</p>
                      </div>
                    </div>
                    <div className="app-announcement-ops__list" style={{ maxHeight: "280px" }}>
                      {credentialCatalog.terminals.map((terminal) => (
                        <div className="app-announcement-ops__list-item" key={terminal.id}>
                          <div>
                            <strong className="app-announcement-ops__list-item-title">{terminal.label}</strong>
                            <span className="app-announcement-ops__list-item-subtitle">
                              {terminal.providerKey} · {terminal.status}
                            </span>
                          </div>
                          <form action={revokeCredentialTerminalAction}>
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <input name="terminalId" type="hidden" value={terminal.id} />
                            <button className="mg-btn mg-btn--glass" type="submit">吊销</button>
                          </form>
                        </div>
                      ))}
                      {filteredRepairClaims.map((claim) => (
                        <div className="app-announcement-ops__list-item" key={claim.id}>
                          <div>
                            <strong className="app-announcement-ops__list-item-title">{claim.claimOwnerKey}</strong>
                            <span className="app-announcement-ops__list-item-subtitle">
                              {claim.status} · {claim.credentialEntryId}
                            </span>
                          </div>
                          <form action={releaseCredentialRepairAction}>
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <input name="claimId" type="hidden" value={claim.id} />
                            <button className="mg-btn mg-btn--outline" type="submit">释放</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="app-announcement-ops__editor-card">
                  <div className="app-mission-ops__section">
                    <div className="app-mission-ops__section-head">
                      <div>
                        <strong>Assignments / Batches / Death Jobs</strong>
                        <p>用户分配与清理审计。</p>
                      </div>
                    </div>
                    <div className="app-announcement-ops__list" style={{ maxHeight: "320px" }}>
                      {filteredAssignments.map((assignment) => (
                        <div className="app-announcement-ops__list-item" key={assignment.id}>
                          <div>
                            <strong className="app-announcement-ops__list-item-title">
                              {assignment.username ?? assignment.userId}
                            </strong>
                            <span className="app-announcement-ops__list-item-subtitle">
                              {assignment.benefitServiceId} · {assignment.assignmentMode} · {assignment.maskedSummary ?? "无摘要"}
                            </span>
                          </div>
                          <form action={rotateCredentialAssignmentAction}>
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <input name="serviceId" type="hidden" value={assignment.benefitServiceId} />
                            <input name="userId" type="hidden" value={assignment.userId} />
                            <button className="mg-btn mg-btn--outline" type="submit">轮换</button>
                          </form>
                        </div>
                      ))}
                      {filteredBatches.map((batch) => (
                        <div className="app-announcement-ops__list-item" key={batch.id}>
                          <div>
                            <strong className="app-announcement-ops__list-item-title">{batch.label}</strong>
                            <span className="app-announcement-ops__list-item-subtitle">
                              {batch.providerKey} · accepted {batch.acceptedCount} · inline {batch.inlineCount} / r2 {batch.r2Count}
                            </span>
                          </div>
                        </div>
                      ))}
                      {credentialCatalog.deathJobs.map((job) => (
                        <div className="app-announcement-ops__list-item" key={job.id}>
                          <div>
                            <strong className="app-announcement-ops__list-item-title">{job.credentialEntryId}</strong>
                            <span className="app-announcement-ops__list-item-subtitle">
                              {job.status} · attempts {job.attempts}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
