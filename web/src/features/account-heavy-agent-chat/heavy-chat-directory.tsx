"use client";

import Link from "next/link";

import { NtBadge } from "@/components/nt-primitives";
import type {
  HeavyChatThread,
  HeavyHistoryFilter,
  HeavyProjectContext,
  HeavySlotProfile,
} from "@/features/account-heavy-agent-chat/types";

type HeavyChatDirectoryProps = {
  activeProjectId: string | null;
  activeSlotId: string | null;
  activeThreadId: string | null;
  collapsed: boolean;
  displayName: string;
  historyFilter: HeavyHistoryFilter;
  historyGroups: Array<{
    label: string;
    items: HeavyChatThread[];
  }>;
  onCreateThread: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectSlot: (slotId: string) => void;
  onSelectThread: (threadId: string) => void;
  onSetHistoryFilter: (value: HeavyHistoryFilter) => void;
  onSetSearchQuery: (value: string) => void;
  onToggleCollapsed: () => void;
  projects: HeavyProjectContext[];
  searchQuery: string;
  slots: HeavySlotProfile[];
};

const HISTORY_FILTERS: Array<{ label: string; value: HeavyHistoryFilter }> = [
  { label: "全部", value: "all" },
  { label: "收藏", value: "starred" },
  { label: "最近", value: "recent" },
];

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" fill="none" r="5.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m15.2 15.2 4.3 4.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 5.5v13M5.5 12h13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4.5 7.5a2 2 0 0 1 2-2h4l1.6 2h5.4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M12 8v4l2.8 1.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function SettingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm0-4 1.1 2.3 2.5.4-.9 2.3 1.6 1.9-1.9 1.6.9 2.3-2.5.4L12 19.5l-1.1-2.3-2.5-.4.9-2.3-1.6-1.9 1.9-1.6-.9-2.3 2.5-.4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M8.5 9.5a3.5 3.5 0 1 1 5.6 2.8c-1 .8-1.6 1.5-1.6 2.7M12 18h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function HeavyChatDirectory({
  activeProjectId,
  activeSlotId,
  activeThreadId,
  collapsed,
  displayName,
  historyFilter,
  historyGroups,
  onCreateThread,
  onSelectProject,
  onSelectSlot,
  onSelectThread,
  onSetHistoryFilter,
  onSetSearchQuery,
  onToggleCollapsed,
  projects,
  searchQuery,
  slots,
}: HeavyChatDirectoryProps) {
  const currentSlot = slots.find((slot) => slot.id === activeSlotId) ?? slots[0] ?? null;

  return (
    <div className={`nt-chat-app-sidebar ${collapsed ? "nt-chat-app-sidebar--collapsed" : ""}`}>
      <div className="nt-chat-app-sidebar__brand">
        <div className="nt-chat-app-sidebar__brand-mark">M</div>
        {!collapsed ? (
          <div className="nt-chat-app-sidebar__brand-copy">
            <strong>觅觅</strong>
            <span>NeuroLoom Chat</span>
          </div>
        ) : null}
      </div>

      <label className="nt-chat-app-sidebar__search">
        <span className="nt-chat-app-sidebar__search-icon">
          <SearchIcon />
        </span>
        <input
          aria-label="搜索聊天记录"
          onChange={(event) => onSetSearchQuery(event.target.value)}
          placeholder={collapsed ? "" : "搜索聊天记录"}
          type="search"
          value={searchQuery}
        />
        {!collapsed ? <kbd>Ctrl+K</kbd> : null}
      </label>

      <button
        aria-label="新聊天"
        className="nt-chat-app-sidebar__new"
        onClick={onCreateThread}
        title="新聊天"
        type="button"
      >
        <NewChatIcon />
        {!collapsed ? <span>新聊天</span> : null}
      </button>

      {!collapsed ? (
        <section className="nt-chat-app-sidebar__section">
          <div className="nt-chat-app-sidebar__section-head">
            <strong>人格</strong>
            {currentSlot ? <NtBadge tone="warning">{currentSlot.kind === "default" ? "固定" : "扩展"}</NtBadge> : null}
          </div>
          <div className="nt-chat-app-sidebar__slot-list">
            {slots.map((slot) => (
              <button
                className={`nt-chat-app-sidebar__slot${slot.id === activeSlotId ? " nt-chat-app-sidebar__slot--active" : ""}`}
                key={slot.id}
                onClick={() => onSelectSlot(slot.id)}
                type="button"
              >
                <strong>{slot.title}</strong>
                <span>{slot.personaLabel}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="nt-chat-app-sidebar__section">
        {!collapsed ? (
          <div className="nt-chat-app-sidebar__section-head">
            <strong>项目</strong>
            <button className="nt-chat-app-sidebar__icon-button" onClick={onCreateThread} type="button">
              +
            </button>
          </div>
        ) : null}
        <div className="nt-chat-app-sidebar__project-list">
          {projects.length === 0 ? (
            !collapsed ? <p className="nt-chat-app-sidebar__empty">目前还没有项目</p> : null
          ) : (
            projects.map((project) => (
              <button
                className={`nt-chat-app-sidebar__project${project.id === activeProjectId ? " nt-chat-app-sidebar__project--active" : ""}`}
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                type="button"
              >
                <FolderIcon />
                {!collapsed ? (
                  <span className="nt-chat-app-sidebar__project-copy">
                    <strong>{project.title}</strong>
                    <small>{project.fileCount} 文件</small>
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </section>

      <section className="nt-chat-app-sidebar__section nt-chat-app-sidebar__section--grow">
        {!collapsed ? (
          <>
            <div className="nt-chat-app-sidebar__section-head">
              <strong>历史</strong>
              <HistoryIcon />
            </div>
            <div className="nt-chat-app-sidebar__filters">
              {HISTORY_FILTERS.map((item) => (
                <button
                  className={historyFilter === item.value ? "nt-chip nt-chip--warning" : "nt-chip nt-chip--glass"}
                  key={item.value}
                  onClick={() => onSetHistoryFilter(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="nt-chat-app-sidebar__history">
          {historyGroups.length === 0 ? (
            !collapsed ? <p className="nt-chat-app-sidebar__empty">还没有聊天记录。开始聊吧。</p> : null
          ) : (
            historyGroups.map((group) => (
              <section className="nt-chat-app-sidebar__history-group" key={group.label}>
                {!collapsed ? <span className="nt-chat-app-sidebar__history-label">{group.label}</span> : null}
                <div className="nt-chat-app-sidebar__history-list">
                  {group.items.map((thread) => (
                    <button
                      className={`nt-chat-app-sidebar__thread${thread.id === activeThreadId ? " nt-chat-app-sidebar__thread--active" : ""}`}
                      key={thread.id}
                      onClick={() => onSelectThread(thread.id)}
                      type="button"
                    >
                      {!collapsed ? (
                        <span className="nt-chat-app-sidebar__thread-copy">
                          <strong>{thread.title}</strong>
                          <small>{thread.preview}</small>
                        </span>
                      ) : (
                        <span className="nt-chat-app-sidebar__thread-dot" />
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      <div className="nt-chat-app-sidebar__footer">
        {!collapsed ? (
          <div className="nt-chat-app-sidebar__upgrade">
            <span>你好，{displayName}</span>
            <strong>由平台提供 AI 服务支持</strong>
          </div>
        ) : null}
        <div className="nt-chat-app-sidebar__footer-actions">
          <Link className="nt-chat-app-sidebar__footer-link" href="/mailbox">
            <SupportIcon />
            {!collapsed ? <span>帮助和支持</span> : null}
          </Link>
          <Link className="nt-chat-app-sidebar__footer-link" href="/dashboard">
            <SettingIcon />
            {!collapsed ? <span>返回平台</span> : null}
          </Link>
          <button className="nt-chat-app-sidebar__footer-link" onClick={onToggleCollapsed} type="button">
            {!collapsed ? <span>隐藏边栏</span> : <span>展开</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
