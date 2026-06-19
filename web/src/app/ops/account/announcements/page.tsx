import type { AccountAnnouncementView } from "@/lib/account-client";
import { listOperatorAccountAnnouncements } from "@/lib/account-client";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteAccountAnnouncementAction, saveAccountAnnouncementAction } from "./actions";

type AnnouncementOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    editingId?: string;
  }>;
};

const STATUS_OPTIONS = [
  {
    value: "draft" as const,
    label: "草稿",
    description: "仅后台可见，适合继续编辑和内部校对。",
  },
  {
    value: "published" as const,
    label: "已发布",
    description: "进入用户侧公告弹层，并按发布时间参与排序。",
  },
  {
    value: "archived" as const,
    label: "已归档",
    description: "从用户侧移除，但后台仍保留记录，方便回看。",
  },
];

const TONE_OPTIONS = [
  {
    value: "priority" as const,
    label: "重点公告",
    description: "高优先级提醒，适合规则变化、入口调整、风险提示。",
  },
  {
    value: "update" as const,
    label: "更新说明",
    description: "偏版本更新和功能变更，视觉强调会比重点公告轻一些。",
  },
  {
    value: "guide" as const,
    label: "规则说明",
    description: "适合接入、绑定、操作说明这类解释型公告。",
  },
];

const EMPTY_SECTIONS_JSON = JSON.stringify(
  [
    {
      title: "本次更新",
      bullets: ["第一条更新内容"],
      paragraphs: ["如需长段正文，可写在 paragraphs 中。"],
    },
  ],
  null,
  2,
);

function formatShanghaiDateTime(value: string | null) {
  if (!value) return "未发布";
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

function getStatusLabel(status: AccountAnnouncementView["status"]) {
  if (status === "published") return "已发布";
  if (status === "archived") return "已归档";
  return "草稿";
}

function statusDotClass(status: AccountAnnouncementView["status"]) {
  if (status === "published") return "ops-status-dot--active";
  if (status === "archived") return "ops-status-dot--inactive";
  return "ops-status-dot--scheduled";
}

function getToneLabel(tone: AccountAnnouncementView["tone"]) {
  return TONE_OPTIONS.find((option) => option.value === tone)?.label ?? "说明";
}

function getStatusDescription(status: AccountAnnouncementView["status"]) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.description ?? "";
}

function getToneDescription(tone: AccountAnnouncementView["tone"]) {
  return TONE_OPTIONS.find((option) => option.value === tone)?.description ?? "";
}

function buildBlankDraft(): AccountAnnouncementView {
  const timestamp = new Date().toISOString();
  return {
    id: "",
    title: "",
    railTitle: "",
    summary: "",
    eyebrow: "重要公告",
    publishedAt: null,
    tone: "priority",
    status: "draft",
    sections: [
      {
        title: "本次更新",
        bullets: ["第一条更新内容"],
        paragraphs: ["如需长段正文，可写在 paragraphs 中。"],
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

function EditorCard(props: {
  redirectTo: string;
  announcement: AccountAnnouncementView;
  isNew: boolean;
}) {
  const sectionsJson = props.announcement.sections.length
    ? JSON.stringify(props.announcement.sections, null, 2)
    : EMPTY_SECTIONS_JSON;
  const currentStatusDescription = getStatusDescription(props.announcement.status);
  const currentToneDescription = getToneDescription(props.announcement.tone);

  return (
    <div className="ops-card">
      <h2 className="ops-card__title">{props.isNew ? "新建公告" : "编辑公告"}</h2>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span className={cn("ops-status-dot", statusDotClass(props.announcement.status))}>
          {getStatusLabel(props.announcement.status)}
        </span>
        <span className="ops-status-dot ops-status-dot--scheduled">
          {getToneLabel(props.announcement.tone)}
        </span>
        {props.isNew ? (
          <span className="ops-status-dot ops-status-dot--scheduled">新建</span>
        ) : null}
      </div>

      <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
        这里管理账户终端公告的正式数据源。用户侧公告弹层会读取 <code>account-api</code> 中状态为{" "}
        <code>published</code> 的记录，不再依赖前端发版。
      </p>

      <form action={saveAccountAnnouncementAction} className="ops-form">
        <input name="redirectTo" type="hidden" value={props.redirectTo} />
        <input name="announcementId" type="hidden" value={props.isNew ? "" : props.announcement.id} />

        {/* -- 基本字段 -- */}
        <h3 style={{ margin: "16px 0 4px", fontSize: "0.95rem" }}>基本字段</h3>

        <div className="ops-form__row">
          <label className="ops-form__label">
            右侧大标题
            <input className="ops-form__input" defaultValue={props.announcement.title} name="title" placeholder="例如：账户终端与个人域入口已正式上线" />
          </label>

          <label className="ops-form__label">
            左侧短标题
            <input className="ops-form__input" defaultValue={props.announcement.railTitle} name="railTitle" placeholder="例如：终端入口上线" />
          </label>

          <label className="ops-form__label">
            标签文案
            <input className="ops-form__input" defaultValue={props.announcement.eyebrow} name="eyebrow" placeholder="例如：重要公告" />
          </label>
        </div>

        <div className="ops-form__row">
          <label className="ops-form__label">
            公告类型
            <select className="ops-form__select" defaultValue={props.announcement.tone} name="tone">
              {TONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} · {option.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
              这不是权限字段，只影响用户侧标题区、徽标和整体语气。当前类型：{currentToneDescription}
            </span>
          </label>

          <label className="ops-form__label">
            状态
            <select className="ops-form__select" defaultValue={props.announcement.status} name="status">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} · {option.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>当前状态：{currentStatusDescription}</span>
          </label>

          <label className="ops-form__label">
            发布时间
            <input
              className="ops-form__input"
              defaultValue={toDateTimeLocalValue(props.announcement.publishedAt)}
              name="publishedAt"
              type="datetime-local"
            />
            <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
              仅 <code>published</code> 会进入用户侧排序。留空时可先保存草稿。
            </span>
          </label>
        </div>

        {/* -- 参考说明 -- */}
        <h3 style={{ margin: "16px 0 4px", fontSize: "0.95rem" }}>参考说明</h3>

        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_OPTIONS.map((option) => (
                <tr key={option.value}>
                  <td><strong>{option.value} / {option.label}</strong></td>
                  <td>{option.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ops-table-wrap" style={{ marginTop: 12 }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th>公告类型</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {TONE_OPTIONS.map((option) => (
                <tr key={option.value}>
                  <td><strong>{option.value} / {option.label}</strong></td>
                  <td>{option.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* -- 正文 -- */}
        <h3 style={{ margin: "16px 0 4px", fontSize: "0.95rem" }}>正文内容</h3>

        <div className="ops-form__row">
          <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
            正文摘要
            <textarea
              className="ops-form__input"
              defaultValue={props.announcement.summary}
              name="summary"
              placeholder="这一段会出现在正文上方的摘要区。"
              rows={4}
              style={{ minHeight: "80px" }}
            />
          </label>
        </div>

        <div className="ops-form__row">
          <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
            正文分区 JSON
            <textarea
              className="ops-form__input"
              defaultValue={sectionsJson}
              name="sectionsJson"
              rows={18}
              spellCheck={false}
              style={{ minHeight: "80px", fontFamily: "\"JetBrains Mono\", \"Fira Code\", monospace" }}
            />
            <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
              当前最小后台先用 JSON 编辑正文分区，结构固定为 <code>title / paragraphs / bullets</code>。
            </span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="ops-form__submit" type="submit">
            {props.isNew ? "创建公告" : "保存公告"}
          </button>
          <Link className="ops-inline-action" href="/ops/account/announcements?editingId=new">
            新建草稿
          </Link>
        </div>
      </form>

      {!props.isNew ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(226,232,240,0.08)" }}>
          <form action={deleteAccountAnnouncementAction}>
            <input name="redirectTo" type="hidden" value={props.redirectTo} />
            <input name="announcementId" type="hidden" value={props.announcement.id} />
            <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
              删除公告
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default async function AnnouncementOpsPage({ searchParams }: AnnouncementOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问公告后台。")}`);
  }

  const userContext = await requirePlatformOperatorUserContext();
  const params = (await searchParams) ?? {};
  const announcements = await listOperatorAccountAnnouncements(userContext);
  const editingId = params.editingId?.trim() || announcements[0]?.id || "new";
  const editingAnnouncement = announcements.find((announcement) => announcement.id === editingId) ?? buildBlankDraft();
  const isNew = editingId === "new" || !editingAnnouncement.id;
  const redirectTo = "/ops/account/announcements";

  const publishedCount = announcements.filter((a) => a.status === "published").length;
  const draftCount = announcements.filter((a) => a.status === "draft").length;
  const archivedCount = announcements.filter((a) => a.status === "archived").length;

  return (
    <main className="ops-main">
      <div className="ops-page-stack">
        {/* -- Header -- */}
        <div className="ops-page-header">
          <h1 className="ops-page-title">公告后台</h1>
          <p className="ops-page-subtitle">
            管理账户终端公告的正式数据源。用户侧公告弹层会读取状态为 published 的记录，不再依赖前端发版。当前共 {announcements.length} 条。
          </p>
        </div>

        {params.status && params.message ? (
          <p className={`ops-alert ops-alert--${params.status}`}>{params.message}</p>
        ) : null}

        {/* -- Inventory -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">公告库存</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>总数</th>
                  <th>已发布</th>
                  <th>草稿</th>
                  <th>已归档</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{announcements.length}</td>
                  <td><span className="ops-status-dot ops-status-dot--active">{publishedCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--scheduled">{draftCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--inactive">{archivedCount}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* -- Announcement List -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">公告目录</h2>

          <div style={{ marginBottom: 12 }}>
            <Link className="ops-form__submit" href="/ops/account/announcements?editingId=new" style={{ display: "inline-block", textDecoration: "none" }}>
              新建公告
            </Link>
          </div>

          {announcements.length === 0 ? (
            <p className="ops-empty">暂无公告记录。</p>
          ) : (
            <div className="ops-batch-list">
              {announcements.map((announcement) => {
                const active = !isNew && editingAnnouncement.id === announcement.id;

                return (
                  <Link
                    className={cn("ops-batch-item", active && "ops-batch-item__head--active")}
                    href={`/ops/account/announcements?editingId=${encodeURIComponent(announcement.id)}`}
                    key={announcement.id}
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    <div className="ops-batch-item__head">
                      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className={cn("ops-status-dot", statusDotClass(announcement.status))}>
                          {getStatusLabel(announcement.status)}
                        </span>
                        <span className="ops-status-dot ops-status-dot--scheduled">
                          {getToneLabel(announcement.tone)}
                        </span>
                        <strong>{announcement.title}</strong>
                      </span>
                    </div>
                    <div style={{ padding: "6px 16px 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
                      <span>{announcement.railTitle}</span>
                      <span style={{ marginLeft: 12 }}>{formatShanghaiDateTime(announcement.publishedAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* -- Editor -- */}
        <EditorCard announcement={editingAnnouncement} isNew={isNew} redirectTo={redirectTo} />

        {/* -- Notes -- */}
        <div className="ops-card">
          <h2 className="ops-card__title">编辑说明</h2>
          {!isNew ? (
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
              当前编辑 ID: {editingAnnouncement.id}
            </p>
          ) : null}
          <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
            右侧字段里，<code>状态</code> 决定是否进入用户侧；<code>公告类型</code> 只决定用户侧的展示语气，不决定是否可见。
          </p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
            当前正文仍使用 JSON，是为了先把正式 CRUD、发布、归档和回看链路跑通。下一步如果你要，我可以继续把它替换成可视化分段编辑器。
          </p>
        </div>
      </div>
    </main>
  );
}
