"use client";

import Link from "next/link";
import { useState } from "react";

import { NtBadge } from "@/components/nt-primitives";
import { HeavyChatComposer } from "@/features/account-heavy-agent-chat/heavy-chat-composer";
import { HeavyChatDirectory } from "@/features/account-heavy-agent-chat/heavy-chat-directory";
import { HeavyChatMessageCard } from "@/features/account-heavy-agent-chat/heavy-chat-message-card";
import { useHeavyChatDirectory } from "@/features/account-heavy-agent-chat/use-heavy-chat-directory";
import { useHeavyChatThreadState } from "@/features/account-heavy-agent-chat/use-heavy-chat-thread-state";
import type { HeavyWorkspaceSnapshot } from "@/features/account-heavy-agent-chat/types";

type HeavyAgentChatWorkspaceProps = {
  displayName: string;
  initialError?: string | null;
  initialSnapshot: HeavyWorkspaceSnapshot;
  initialSlotId?: string | null;
  mailboxVisible: boolean;
  storeVisible: boolean;
};

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MimiGlyph() {
  return (
    <svg aria-hidden="true" className="nt-chat-app-home__glyph" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="mimi-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#d9ff38" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" fill="rgba(124,92,255,0.12)" r="72" />
      <path
        d="M80 28c-22.5 0-40.5 17.2-40.5 39.2 0 10.8 4.4 20.4 11.5 27.4v18.7l18.1-10.6c3.5 1 7.2 1.6 10.9 1.6 22.5 0 40.5-17.2 40.5-39.1C120.5 45.2 102.5 28 80 28Z"
        fill="url(#mimi-body)"
      />
      <circle cx="66" cy="69" fill="#120d24" r="5.5" />
      <circle cx="94" cy="69" fill="#120d24" r="5.5" />
      <path
        d="M67.5 89.5c7.9 5.7 17.1 5.7 25 0"
        fill="none"
        stroke="#120d24"
        strokeLinecap="round"
        strokeWidth="6"
      />
      <path d="m57 42 9 16-17 3ZM103 42l-9 16 17 3Z" fill="#a58cff" />
    </svg>
  );
}

function HomeTrustCard({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="nt-chat-app-home__trust-card">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function EmptyHome({
  composer,
}: {
  composer: React.ReactNode;
}) {
  return (
    <div className="nt-chat-app-home">
      <div className="nt-chat-app-home__hero">
        <div className="nt-chat-app-home__copy">
          <span className="nt-kicker">NeuroLoom Chat</span>
          <h1>嗨，我是觅觅。有任何想问的尽管问。</h1>
          <p>这是一个独立聊天程序，由平台提供 AI 服务与凭证调度支持。</p>
        </div>
        <MimiGlyph />
      </div>

      <div className="nt-chat-app-home__composer">{composer}</div>

      <div className="nt-chat-app-home__trust">
        <HomeTrustCard body="上下文与凭证隔离处理，不把单条请求暴露成通用共享状态。" title="私密的" />
        <HomeTrustCard body="请求统一经过平台网关与服务商凭证池，便于审计、限额和稳定调度。" title="受保护的" />
        <HomeTrustCard body="聊天程序是独立 Web 应用，但仍与项目、邮箱、任务和交付上下文保持联动。" title="可控的" />
      </div>
    </div>
  );
}

export function HeavyAgentChatWorkspace({
  displayName,
  initialError = null,
  initialSnapshot,
  initialSlotId = null,
  mailboxVisible,
  storeVisible,
}: HeavyAgentChatWorkspaceProps) {
  const threadState = useHeavyChatThreadState({
    initialError,
    initialSnapshot,
  });
  const slots = threadState.slots;
  const projects = threadState.projects;
  const directory = useHeavyChatDirectory({
    initialSlotId,
    projects,
    slots,
    threads: threadState.threads,
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const activeSlot = slots.find((slot) => slot.id === directory.activeSlotId) ?? null;
  const activeThread = threadState.threads.find((thread) => thread.id === directory.activeThreadId) ?? null;
  const activeProjectId = activeThread?.projectId ?? directory.activeProjectId;
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const isStreaming = threadState.busy || (activeThread?.messages.some((message) => message.status === "streaming") ?? false);

  function handleSelectSlot(slotId: string) {
    directory.selectSlot(slotId);
  }

  function handleSelectProject(projectId: string) {
    directory.selectProject(projectId);
  }

  function handleSelectThread(threadId: string) {
    directory.selectThread(threadId);
    setMobileSidebarOpen(false);
  }

  async function handleCreateThread() {
    if (!directory.activeSlotId) {
      return;
    }
    const thread = await threadState.createThread(directory.activeSlotId, activeProjectId);
    if (!thread) return;
    directory.syncThreadContext(thread.id, thread.slotId, thread.projectId);
    setMobileSidebarOpen(false);
  }

  async function handleSend() {
    const nextThread = await threadState.sendMessage(
      directory.activeThreadId,
      directory.activeSlotId,
      activeProjectId,
    );
    if (!nextThread) {
      return;
    }
    directory.syncThreadContext(nextThread.threadId, nextThread.slotId, nextThread.projectId);
  }

  const composer = (
    <HeavyChatComposer
      actionNotice={threadState.actionNotice}
      draft={threadState.draft}
      mode={activeThread ? "thread" : "landing"}
      onAddReference={(type) => threadState.addReference(type, activeProject)}
      onQuickPrompt={threadState.setDraft}
      onRemoveReference={threadState.removeReference}
      onSend={handleSend}
      onSetDraft={threadState.setDraft}
      onToggleWebSearch={() => setWebSearchEnabled((current) => !current)}
      project={activeProject}
      references={threadState.selectedReferences}
      streaming={isStreaming}
      webSearchEnabled={webSearchEnabled}
    />
  );

  return (
    <div className="nt-chat-app">
      <header className="nt-chat-app__topbar">
        <div className="nt-chat-app__topbar-brand">
          <Link className="nt-chat-app__logo" href="/chat">
            <span>觅</span>
            <strong>mimi</strong>
          </Link>
          <nav className="nt-chat-app__topnav">
            <Link href="/dashboard">关于</Link>
            {mailboxVisible ? <Link href="/mailbox">隐私与支持</Link> : null}
            {storeVisible ? <Link href="/products">企业版</Link> : null}
          </nav>
        </div>

        <div className="nt-chat-app__topbar-actions">
          <button className="nt-chat-app__mobile-menu" onClick={() => setMobileSidebarOpen(true)} type="button">
            <MenuIcon />
          </button>
          <Link className="nt-chat-app__action-link" href="/dashboard">
            返回平台
          </Link>
          <div className="nt-chat-app__account-chip">
            <span>{displayName.slice(0, 1).toUpperCase()}</span>
          </div>
        </div>
      </header>

      <div className="nt-chat-app__body">
        <aside className={`nt-chat-app__sidebar-shell${sidebarCollapsed ? " nt-chat-app__sidebar-shell--collapsed" : ""}`}>
          <HeavyChatDirectory
            activeProjectId={activeProjectId}
            activeSlotId={directory.activeSlotId}
            activeThreadId={directory.activeThreadId}
            collapsed={sidebarCollapsed}
            displayName={displayName}
            historyFilter={directory.historyFilter}
            historyGroups={directory.historyGroups}
            onCreateThread={handleCreateThread}
            onSelectProject={handleSelectProject}
            onSelectSlot={handleSelectSlot}
            onSelectThread={handleSelectThread}
            onSetHistoryFilter={directory.setHistoryFilter}
            onSetSearchQuery={directory.setSearchQuery}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            projects={directory.visibleProjects}
            searchQuery={directory.searchQuery}
            slots={slots}
          />
        </aside>

        <main className="nt-chat-app__main">
          {activeThread ? (
            <>
              <div className="nt-chat-app__conversation-head">
                <div className="nt-chat-app__conversation-meta">
                  <NtBadge tone="warning">{activeSlot?.title || "觅觅"}</NtBadge>
                  {activeProject ? <NtBadge tone="cyan">{activeProject.title}</NtBadge> : null}
                  {activeThread.favorite ? <NtBadge tone="success">收藏会话</NtBadge> : null}
                </div>
                <div>
                  <h1>{activeThread.title}</h1>
                  <p>{activeProject?.instructions || activeThread.preview}</p>
                </div>
              </div>

              <div className="nt-chat-app__messages">
                <div className="nt-chat-app__messages-inner">
                  {activeThread.messages.map((message) => (
                    <HeavyChatMessageCard
                      key={message.id}
                      message={message}
                      onAction={(action) => void threadState.runMessageAction(activeThread.id, message.id, action)}
                    />
                  ))}
                </div>
              </div>

              <div className="nt-chat-app__composer-dock">{composer}</div>
            </>
          ) : (
            <EmptyHome composer={composer} />
          )}
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div className="nt-chat-app__mobile-layer">
          <button
            aria-label="关闭会话目录"
            className="nt-chat-app__mobile-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          />
          <div className="nt-chat-app__mobile-drawer">
            <HeavyChatDirectory
              activeProjectId={activeProjectId}
              activeSlotId={directory.activeSlotId}
              activeThreadId={directory.activeThreadId}
              collapsed={false}
              displayName={displayName}
              historyFilter={directory.historyFilter}
              historyGroups={directory.historyGroups}
              onCreateThread={handleCreateThread}
              onSelectProject={handleSelectProject}
              onSelectSlot={handleSelectSlot}
              onSelectThread={handleSelectThread}
              onSetHistoryFilter={directory.setHistoryFilter}
              onSetSearchQuery={directory.setSearchQuery}
              onToggleCollapsed={() => setMobileSidebarOpen(false)}
              projects={directory.visibleProjects}
              searchQuery={directory.searchQuery}
              slots={slots}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
