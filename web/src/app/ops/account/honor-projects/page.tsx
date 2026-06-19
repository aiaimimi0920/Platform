import { listOperatorHonorProjectCatalog } from "@/lib/account-client";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  archiveHonorProjectAction,
  deleteHonorProjectAction,
  deleteHonorProjectInvestmentAction,
  saveHonorProjectAction,
  saveHonorProjectInvestmentAction,
} from "./actions";

type HonorProjectsOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    projectId?: string;
    q?: string;
    investmentUserId?: string;
  }>;
};

function buildBlankProject() {
  const timestamp = new Date().toISOString();
  return {
    id: "",
    name: "",
    summary: "",
    publicHref: "",
    ownerHandle: "neuroloom",
    ownerLabel: "NeuroLoom 团队",
    categoryLabel: "人工智能",
    stageLabel: "方案整理",
    progressPercent: 20,
    progressLabel: "当前处于早期推进阶段。",
    rewardShareLabel: "收益分成方案待后续明确",
    sponsorOpen: true,
    sponsorStatusLabel: "开放赞助",
    joinOpen: true,
    joinStatusLabel: "接收协作者",
    collaborationLabel: "协作流程待完善",
    fundingTargetAmount: 10000,
    workspaceHref: "https://github.com/neuroloom-labs",
    workspaceLabel: "外部工作目录",
    detailBody: "项目详情将随着后端字段完善逐步补齐。",
    sponsorCount: 0,
    sponsoredAmount: 0,
    sponsoredCurrencyLabel: "MIRA",
    sortOrder: 100,
    status: "active" as const,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function formatShanghaiDateTime(value: string | null | undefined) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function statusDotClass(status: string) {
  if (status === "active") return "ops-status-dot--active";
  if (status === "archived") return "ops-status-dot--inactive";
  return "ops-status-dot--scheduled";
}

function statusLabel(status: string) {
  if (status === "active") return "已启用";
  if (status === "archived") return "已归档";
  return "草稿";
}

export default async function HonorProjectsOpsPage({ searchParams }: HonorProjectsOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问项目运营后台。")}`);
  }

  const userContext = await requirePlatformOperatorUserContext();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() || "";
  const investmentUserId = params.investmentUserId?.trim() || "";
  const catalog = await listOperatorHonorProjectCatalog(userContext, {
    query: query || null,
    investmentUserId: investmentUserId || null,
    limit: 100,
  });

  const selectedProjectId = params.projectId?.trim() || catalog.projects[0]?.id || "new";
  const currentProject =
    catalog.projects.find((project) => project.id === selectedProjectId) ??
    (selectedProjectId === "new" ? buildBlankProject() : catalog.projects[0] ?? buildBlankProject());
  const isNewProject = selectedProjectId === "new" || !currentProject.id;
  const redirectTo = `/ops/account/honor-projects?projectId=${encodeURIComponent(currentProject.id || "new")}${
    query ? `&q=${encodeURIComponent(query)}` : ""
  }${investmentUserId ? `&investmentUserId=${encodeURIComponent(investmentUserId)}` : ""}`;

  const projectInvestments = currentProject.id
    ? catalog.userInvestments.filter((investment) => investment.projectId === currentProject.id)
    : [];

  const activeCount = catalog.projects.filter((p) => p.status === "active").length;
  const archivedCount = catalog.projects.filter((p) => p.status === "archived").length;

  return (
    <main className="ops-main">
      <div className="ops-page-stack">
        {/* -- Header -- */}
        <div className="ops-page-header">
          <h1 className="ops-page-title">荣誉项目</h1>
          <p className="ops-page-subtitle">
            这里负责维护用户档案中「项目 / 投资项目」的真实内容源。当前共 {catalog.projects.length} 个项目。
          </p>
        </div>

        {params.status && params.message ? (
          <p className={`ops-alert ops-alert--${params.status}`}>{params.message}</p>
        ) : null}

        {/* -- Inventory -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">项目库存</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>总数</th>
                  <th>展示中</th>
                  <th>已归档</th>
                  <th>投资记录</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{catalog.projects.length}</td>
                  <td><span className="ops-status-dot ops-status-dot--active">{activeCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--inactive">{archivedCount}</span></td>
                  <td>{catalog.userInvestments.length} 条</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* -- Filter + New -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">筛选</h2>
          <form action="/ops/account/honor-projects" className="ops-form" method="get">
            <div className="ops-form__row">
              <label className="ops-form__label">
                搜索项目 / 用户
                <input className="ops-form__input" defaultValue={query} name="q" placeholder="项目名或用户名" />
              </label>
              <label className="ops-form__label">
                投资用户 ID
                <input className="ops-form__input" defaultValue={investmentUserId} name="investmentUserId" placeholder="用于筛投资记录" />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ops-form__submit" type="submit">
                应用筛选
              </button>
              <Link className="ops-inline-action" href="/ops/account/honor-projects?projectId=new" style={{ textDecoration: "none" }}>
                新建项目
              </Link>
            </div>
          </form>
        </div>

        {/* -- Project List -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">项目目录</h2>

          {catalog.projects.length === 0 ? (
            <p className="ops-empty">暂无项目记录。</p>
          ) : (
            <div className="ops-batch-list">
              {catalog.projects.map((project) => {
                const active = project.id === currentProject.id;
                return (
                  <Link
                    className={cn("ops-batch-item", active && "ops-batch-item__head--active")}
                    href={`/ops/account/honor-projects?projectId=${encodeURIComponent(project.id)}${
                      query ? `&q=${encodeURIComponent(query)}` : ""
                    }${investmentUserId ? `&investmentUserId=${encodeURIComponent(investmentUserId)}` : ""}`}
                    key={project.id}
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    <div className="ops-batch-item__head">
                      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className={cn("ops-status-dot", statusDotClass(project.status))}>
                          {project.status === "active" ? "启用" : "归档"}
                        </span>
                        <strong>{project.name}</strong>
                      </span>
                      <span className="ops-batch-item__stats">
                        {`${formatNumber(project.sponsorCount)} 人 / ${formatNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* -- Project Editor -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">{isNewProject ? "新建项目" : "Project Config"}</h2>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {!isNewProject ? (
              <>
                <span className={cn("ops-status-dot", statusDotClass(currentProject.status))}>
                  {statusLabel(currentProject.status)}
                </span>
                <span className="ops-status-dot ops-status-dot--scheduled">{`排序 ${currentProject.sortOrder}`}</span>
              </>
            ) : (
              <span className="ops-status-dot ops-status-dot--scheduled">新建</span>
            )}
          </div>

          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
            「项目」面板展示的是公共项目 catalog；「投资项目」面板展示的是用户个人投资额视角。
          </p>

          <form action={saveHonorProjectAction} className="ops-form">
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <input name="projectId" type="hidden" value={currentProject.id} />

            <div className="ops-form__row">
              <label className="ops-form__label">
                项目名称
                <input className="ops-form__input" defaultValue={currentProject.name} name="name" required />
              </label>
              <label className="ops-form__label">
                公开链接
                <input className="ops-form__input" defaultValue={currentProject.publicHref ?? ""} name="publicHref" placeholder="/projects/example" />
              </label>
              <label className="ops-form__label">
                负责人标识
                <input className="ops-form__input" defaultValue={currentProject.ownerHandle} name="ownerHandle" required />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                项目摘要
                <textarea className="ops-form__input" defaultValue={currentProject.summary} name="summary" required rows={4} style={{ minHeight: "80px" }} />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                负责人名称
                <input className="ops-form__input" defaultValue={currentProject.ownerLabel} name="ownerLabel" required />
              </label>
              <label className="ops-form__label">
                项目分类
                <input className="ops-form__input" defaultValue={currentProject.categoryLabel} name="categoryLabel" required />
              </label>
              <label className="ops-form__label">
                项目阶段
                <input className="ops-form__input" defaultValue={currentProject.stageLabel} name="stageLabel" required />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                进度百分比
                <input className="ops-form__input" defaultValue={String(currentProject.progressPercent)} inputMode="numeric" name="progressPercent" required />
              </label>
              <label className="ops-form__label">
                分润承诺
                <input className="ops-form__input" defaultValue={currentProject.rewardShareLabel} name="rewardShareLabel" required />
              </label>
              <label className="ops-form__label">
                赞助开放
                <select className="ops-form__select" defaultValue={String(currentProject.sponsorOpen)} name="sponsorOpen">
                  <option value="true">true / 开放</option>
                  <option value="false">false / 暂停</option>
                </select>
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                赞助状态文案
                <input className="ops-form__input" defaultValue={currentProject.sponsorStatusLabel} name="sponsorStatusLabel" required />
              </label>
              <label className="ops-form__label">
                加入开放
                <select className="ops-form__select" defaultValue={String(currentProject.joinOpen)} name="joinOpen">
                  <option value="true">true / 开放</option>
                  <option value="false">false / 暂停</option>
                </select>
              </label>
              <label className="ops-form__label">
                加入状态文案
                <input className="ops-form__input" defaultValue={currentProject.joinStatusLabel} name="joinStatusLabel" required />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                协作方式
                <input className="ops-form__input" defaultValue={currentProject.collaborationLabel} name="collaborationLabel" required />
              </label>
              <label className="ops-form__label">
                目标规模
                <input className="ops-form__input" defaultValue={String(currentProject.fundingTargetAmount)} inputMode="numeric" name="fundingTargetAmount" required />
              </label>
              <label className="ops-form__label">
                工作目录链接
                <input className="ops-form__input" defaultValue={currentProject.workspaceHref} name="workspaceHref" required />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                工作目录标签
                <input className="ops-form__input" defaultValue={currentProject.workspaceLabel} name="workspaceLabel" required />
              </label>
              <label className="ops-form__label">
                资助人数
                <input className="ops-form__input" defaultValue={String(currentProject.sponsorCount)} inputMode="numeric" name="sponsorCount" required />
              </label>
              <label className="ops-form__label">
                资助总额
                <input className="ops-form__input" defaultValue={String(currentProject.sponsoredAmount)} inputMode="numeric" name="sponsoredAmount" required />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                资助货币
                <input className="ops-form__input" defaultValue={currentProject.sponsoredCurrencyLabel} name="sponsoredCurrencyLabel" required />
              </label>
              <label className="ops-form__label">
                排序值
                <input className="ops-form__input" defaultValue={String(currentProject.sortOrder)} inputMode="numeric" name="sortOrder" required />
              </label>
              <label className="ops-form__label">
                状态
                <select className="ops-form__select" defaultValue={currentProject.status} name="status">
                  <option value="active">active / 启用</option>
                  <option value="archived">archived / 归档</option>
                </select>
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                进度说明
                <textarea className="ops-form__input" defaultValue={currentProject.progressLabel} name="progressLabel" required rows={3} style={{ minHeight: "80px" }} />
              </label>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                项目详情
                <textarea className="ops-form__input" defaultValue={currentProject.detailBody} name="detailBody" required rows={5} style={{ minHeight: "80px" }} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="ops-form__submit" type="submit">
                {isNewProject ? "创建项目" : "保存项目"}
              </button>
            </div>
          </form>

          {!isNewProject ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(226,232,240,0.08)" }}>
              <form action={archiveHonorProjectAction}>
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <input name="projectId" type="hidden" value={currentProject.id} />
                <button className="ops-inline-action" type="submit">
                  归档项目
                </button>
              </form>
              <form action={deleteHonorProjectAction}>
                <input name="redirectTo" type="hidden" value="/ops/account/honor-projects?projectId=new" />
                <input name="projectId" type="hidden" value={currentProject.id} />
                <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
                  删除项目
                </button>
              </form>
            </div>
          ) : null}
        </div>

        {/* -- Investment Mapping -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">Investment Mapping</h2>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="ops-status-dot ops-status-dot--scheduled">{`${projectInvestments.length} 条记录`}</span>
          </div>

          {!currentProject.id ? (
            <p className="ops-empty">先创建项目，才能给具体用户登记「个人投资额」。</p>
          ) : (
            <>
              <form action={saveHonorProjectInvestmentAction} className="ops-form">
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <input name="projectId" type="hidden" value={currentProject.id} />

                <div className="ops-form__row">
                  <label className="ops-form__label">
                    用户 ID
                    <input className="ops-form__input" name="userId" placeholder="user_xxx" required />
                  </label>
                  <label className="ops-form__label">
                    个人投资额
                    <input className="ops-form__input" inputMode="numeric" name="investedAmount" placeholder="5200" required />
                  </label>
                  <label className="ops-form__label">
                    投资货币
                    <input className="ops-form__input" defaultValue={currentProject.sponsoredCurrencyLabel || "MIRA"} name="currencyLabel" required />
                  </label>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button className="ops-form__submit" type="submit">
                    新增 / 更新个人投资额
                  </button>
                </div>
              </form>

              {projectInvestments.length === 0 ? (
                <p className="ops-empty">当前项目还没有录入个人投资记录。</p>
              ) : (
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>用户名</th>
                        <th>用户 ID</th>
                        <th>投资额</th>
                        <th>更新时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectInvestments.map((investment) => (
                        <tr key={investment.id}>
                          <td><strong>{investment.username}</strong></td>
                          <td><code>{investment.userId}</code></td>
                          <td>{`${formatNumber(investment.investedAmount)} ${investment.currencyLabel}`}</td>
                          <td>{formatShanghaiDateTime(investment.updatedAt)}</td>
                          <td>
                            <form action={deleteHonorProjectInvestmentAction}>
                              <input name="redirectTo" type="hidden" value={redirectTo} />
                              <input name="projectId" type="hidden" value={currentProject.id} />
                              <input name="investmentId" type="hidden" value={investment.id} />
                              <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
                                删除
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
