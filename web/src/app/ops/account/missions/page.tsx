import type { MissionDefinitionView } from "@/lib/account-client";
import { listOperatorMissionDefinitions } from "@/lib/account-client";
import { auth } from "@/auth";
import { CurrencyIcon } from "@/components/currency-icon";
import { cn } from "@/lib/cn";
import { getCurrencyLabel, rewardCurrencyOptions } from "@/lib/currency-display";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  archiveMissionDefinitionAction,
  deleteMissionDefinitionAction,
  saveMissionDefinitionAction,
} from "./actions";

type MissionOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    editingId?: string;
  }>;
};

const STATUS_OPTIONS = [
  { value: "draft" as const, label: "草稿" },
  { value: "active" as const, label: "已启用" },
  { value: "archived" as const, label: "已归档" },
];

const KIND_OPTIONS = [
  { value: "checkin" as const, label: "签到" },
  { value: "permanent" as const, label: "永久任务" },
  { value: "daily" as const, label: "每日任务" },
  { value: "weekly" as const, label: "周任务" },
  { value: "event" as const, label: "活动任务" },
];

const METRIC_OPTIONS = [
  { value: "dailyCheckInClaim" as const, label: "签到次数" },
  { value: "taskApply" as const, label: "任务申请次数" },
  { value: "mailClaim" as const, label: "邮箱附件领取次数" },
  { value: "productPurchase" as const, label: "商品购买次数" },
  { value: "opinionSupport" as const, label: "议题支持次数" },
];

function formatShanghaiDateTime(value: string | null) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const partValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${partValue("year")}-${partValue("month")}-${partValue("day")}T${partValue("hour")}:${partValue("minute")}`;
}

function getStatusLabel(status: MissionDefinitionView["status"]) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getKindLabel(kind: MissionDefinitionView["kind"]) {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

function getMetricLabel(metricKey: MissionDefinitionView["metricKey"]) {
  return METRIC_OPTIONS.find((option) => option.value === metricKey)?.label ?? metricKey;
}

function getDefaultDescription(kind: MissionDefinitionView["kind"]) {
  switch (kind) {
    case "checkin":
      return "每天签到一次，领取固定奖励，并结算次日压注的双倍额外奖励。";
    case "daily":
      return "每日自然日内完成指定动作后领取奖励。";
    case "weekly":
      return "每周周期内完成指定动作后领取奖励。";
    case "event":
      return "在活动时间窗内完成指定动作后领取奖励。";
    case "permanent":
    default:
      return "长期保留的探索型任务，完成后领取一次奖励。";
  }
}

function statusDotClass(status: MissionDefinitionView["status"]) {
  if (status === "active") return "ops-status-dot--active";
  if (status === "archived") return "ops-status-dot--inactive";
  return "ops-status-dot--scheduled";
}

function buildBlankDraft(): MissionDefinitionView {
  const timestamp = new Date().toISOString();
  return {
    id: "",
    kind: "permanent",
    status: "draft",
    title: "",
    subtitle: null,
    description: getDefaultDescription("permanent"),
    eyebrow: "永久任务",
    rewardCurrency: "mira",
    rewardAmount: 20,
    metricKey: "taskApply",
    progressTarget: 1,
    resetRule: "none",
    streakMode: "none",
    streakTarget: null,
    startsAt: null,
    endsAt: null,
    sortOrder: 200,
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

function EditorCard(props: {
  redirectTo: string;
  mission: MissionDefinitionView;
  isNew: boolean;
}) {
  return (
    <div className="ops-card">
      <h2 className="ops-card__title">{props.isNew ? "新建任务" : "编辑任务"}</h2>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span className={cn("ops-status-dot", statusDotClass(props.mission.status))}>
          {getStatusLabel(props.mission.status)}
        </span>
        <span className="ops-status-dot ops-status-dot--scheduled">
          {getKindLabel(props.mission.kind)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--mg-text-muted)", marginBottom: 16 }}>
        <span>
          奖励：
          <CurrencyIcon className="app-mission-ops__summary-icon" currency={props.mission.rewardCurrency} />
          {" "}{props.mission.rewardAmount} {getCurrencyLabel(props.mission.rewardCurrency)}
        </span>
        <span>指标：{getMetricLabel(props.mission.metricKey)}</span>
        <span>目标：{props.mission.progressTarget}</span>
      </div>

      <form action={saveMissionDefinitionAction} className="ops-form">
        <input name="redirectTo" type="hidden" value={props.redirectTo} />
        <input name="missionId" type="hidden" value={props.isNew ? "" : props.mission.id} />
        <input name="subtitle" type="hidden" value="" />
        <input name="eyebrow" type="hidden" value="" />

        {/* ── 基本配置 ── */}
        <h3 style={{ margin: "16px 0 4px", fontSize: "0.95rem" }}>基本配置</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
          决定用户端看到什么任务、给什么奖励、以什么状态上线。
        </p>

        <div className="ops-form__row">
          <label className="ops-form__label">
            任务类型
            <select className="ops-form__select" defaultValue={props.mission.kind} name="kind">
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-form__label">
            状态
            <select className="ops-form__select" defaultValue={props.mission.status} name="status">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
            任务标题
            <input className="ops-form__input" defaultValue={props.mission.title} name="title" placeholder="例如：累计领取邮箱附件 5 次" />
          </label>
        </div>

        <div className="ops-form__row">
          <label className="ops-form__label">
            奖励货币
            <select className="ops-form__select" defaultValue={props.mission.rewardCurrency} name="rewardCurrency">
              {rewardCurrencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-form__label">
            奖励数额
            <input className="ops-form__input" defaultValue={String(props.mission.rewardAmount)} min="1" name="rewardAmount" type="number" />
          </label>

          <label className="ops-form__label">
            排序值
            <input className="ops-form__input" defaultValue={String(props.mission.sortOrder)} name="sortOrder" type="number" />
          </label>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
          当前支持米拉、曜石、意见券三种奖励货币；保存后会以所选币种进入用户侧任务与签到结算链路。
        </p>

        {/* ── 任务规则 ── */}
        <h3 style={{ margin: "16px 0 4px", fontSize: "0.95rem" }}>任务规则</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
          控制任务完成条件与可见时间窗。签到任务会自动保持自己的签到语义。
        </p>

        <div className="ops-form__row">
          <label className="ops-form__label">
            统计指标
            <select className="ops-form__select" defaultValue={props.mission.metricKey} name="metricKey">
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-form__label">
            目标值
            <input className="ops-form__input" defaultValue={String(props.mission.progressTarget)} min="1" name="progressTarget" type="number" />
          </label>

          <label className="ops-form__label">
            连续签到目标
            <input
              className="ops-form__input"
              defaultValue={props.mission.streakTarget ? String(props.mission.streakTarget) : ""}
              min="1"
              name="streakTarget"
              placeholder="仅签到任务使用"
              type="number"
            />
          </label>
        </div>

        <div className="ops-form__row">
          <label className="ops-form__label">
            活动开始
            <input className="ops-form__input" defaultValue={toDateTimeLocalValue(props.mission.startsAt)} name="startsAt" type="datetime-local" />
          </label>

          <label className="ops-form__label">
            活动结束
            <input className="ops-form__input" defaultValue={toDateTimeLocalValue(props.mission.endsAt)} name="endsAt" type="datetime-local" />
          </label>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
          <strong>签到任务安全规则：</strong>压注与签到固定奖励会使用同一币种；若存在待结算压注，后台将阻止直接切换该签到任务的奖励币种。
        </p>

        {/* ── 备用说明 ── */}
        <h3 style={{ margin: "16px 0 4px", fontSize: "0.95rem" }}>备用说明</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
          当前用户弹窗默认不直接读取这段文字；这里只保留一段正式说明，供后续运营或用户面回接时复用。
        </p>

        <div className="ops-form__row">
          <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
            任务说明
            <textarea
              className="ops-form__input"
              defaultValue={props.mission.description}
              name="description"
              placeholder={getDefaultDescription(props.mission.kind)}
              rows={5}
              style={{ minHeight: "80px" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="ops-form__submit" type="submit">
            {props.isNew ? "创建任务" : "保存任务"}
          </button>
          <Link className="ops-inline-action" href="/ops/account/missions?editingId=new">
            新建任务
          </Link>
        </div>
      </form>

      {!props.isNew ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(226,232,240,0.08)" }}>
          {props.mission.status !== "archived" ? (
            <form action={archiveMissionDefinitionAction}>
              <input name="redirectTo" type="hidden" value={props.redirectTo} />
              <input name="missionId" type="hidden" value={props.mission.id} />
              <button className="ops-inline-action" type="submit">
                归档任务
              </button>
            </form>
          ) : null}

          <form action={deleteMissionDefinitionAction}>
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <input name="missionId" type="hidden" value={props.mission.id} />
            <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
              彻底删除
            </button>
          </form>

          <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
            默认优先使用"归档任务"从用户侧下线；"彻底删除"只建议用于误建草稿或错误数据清理。
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default async function MissionOpsPage({ searchParams }: MissionOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问任务后台。")}`);
  }

  const params = searchParams ? await searchParams : undefined;
  const userContext = await requirePlatformOperatorUserContext();
  const missions = await listOperatorMissionDefinitions(userContext);
  const editingId = params?.editingId?.trim() || missions[0]?.id || "new";
  const editingMission = missions.find((mission) => mission.id === editingId) ?? buildBlankDraft();
  const redirectTo = "/ops/account/missions";

  const activeCount = missions.filter((m) => m.status === "active").length;
  const draftCount = missions.filter((m) => m.status === "draft").length;
  const archivedCount = missions.filter((m) => m.status === "archived").length;

  return (
    <main className="ops-main">
      <div className="ops-page-stack">
        {/* ── Header ── */}
        <div className="ops-page-header">
          <h1 className="ops-page-title">签到与玩家任务</h1>
          <p className="ops-page-subtitle">
            任务标题、奖励、币种、目标、周期与时间窗的运营写入口。当前共 {missions.length} 条任务定义。
          </p>
        </div>

        {params?.status && params?.message ? (
          <p className={`ops-alert ops-alert--${params.status}`}>{params.message}</p>
        ) : null}

        {/* ── Inventory ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">任务库存</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>总数</th>
                  <th>已上线</th>
                  <th>草稿</th>
                  <th>已归档</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{missions.length}</td>
                  <td><span className="ops-status-dot ops-status-dot--active">{activeCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--scheduled">{draftCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--inactive">{archivedCount}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Mission List ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">任务目录</h2>

          <div style={{ marginBottom: 12 }}>
            <Link className="ops-form__submit" href="/ops/account/missions?editingId=new" style={{ display: "inline-block", textDecoration: "none" }}>
              新建任务
            </Link>
          </div>

          {missions.length === 0 ? (
            <p className="ops-empty">暂无任务记录。</p>
          ) : (
            <div className="ops-batch-list">
              {missions.map((mission) => (
                <Link
                  className={cn("ops-batch-item", mission.id === editingId && "ops-batch-item__head--active")}
                  href={`/ops/account/missions?editingId=${encodeURIComponent(mission.id)}`}
                  key={mission.id}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div className="ops-batch-item__head">
                    <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={cn("ops-status-dot", statusDotClass(mission.status))}>
                        {getStatusLabel(mission.status)}
                      </span>
                      <span className="ops-status-dot ops-status-dot--scheduled">
                        {getKindLabel(mission.kind)}
                      </span>
                      <strong>{mission.title}</strong>
                    </span>
                  </div>
                  <div style={{ padding: "6px 16px 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
                    <span>{getMetricLabel(mission.metricKey)} · 目标 {mission.progressTarget}</span>
                    <span style={{ marginLeft: 12 }}>
                      <CurrencyIcon className="app-mission-ops__list-reward-icon" currency={mission.rewardCurrency} />
                      {" "}{mission.rewardAmount} {getCurrencyLabel(mission.rewardCurrency)}
                    </span>
                    <span style={{ marginLeft: 12 }}>更新：{formatShanghaiDateTime(mission.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Editor ── */}
        <EditorCard
          isNew={editingId === "new" || !editingMission.id}
          mission={editingMission}
          redirectTo={redirectTo}
        />
      </div>
    </main>
  );
}
