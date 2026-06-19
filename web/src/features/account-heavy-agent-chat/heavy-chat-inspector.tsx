"use client";

import Link from "next/link";

import { NtBadge, NtPanel } from "@/components/nt-primitives";
import type {
  HeavyChatThread,
  HeavyInspectorTarget,
  HeavyProjectContext,
  HeavySlotProfile,
} from "@/features/account-heavy-agent-chat/types";

type HeavyChatInspectorProps = {
  project: HeavyProjectContext | null;
  slot: HeavySlotProfile | null;
  target: HeavyInspectorTarget;
  thread: HeavyChatThread | null;
};

function InspectorSection({
  kicker,
  tone = "glass",
  title,
  children,
}: {
  children: React.ReactNode;
  kicker: string;
  title: string;
  tone?: "glass" | "warning" | "cyan" | "success" | "violet";
}) {
  return (
    <NtPanel className="nt-heavy-chat-inspector__panel">
      <div className="nt-heavy-chat-inspector__panel-head">
        <div>
          <span className="nt-kicker">{kicker}</span>
          <h3>{title}</h3>
        </div>
        <NtBadge tone={tone}>{title}</NtBadge>
      </div>
      {children}
    </NtPanel>
  );
}

export function HeavyChatInspector({
  project,
  slot,
  target,
  thread,
}: HeavyChatInspectorProps) {
  const showProject = target.type === "project" && project;
  const showThread = target.type === "thread" && thread;
  const showSlot = !showProject && !showThread && slot;

  return (
    <div className="nt-heavy-chat-inspector">
      {showSlot ? (
        <>
      <InspectorSection kicker="槽位" title={showSlot.title} tone="warning">
            <p className="nt-heavy-chat-inspector__summary">{showSlot.summary}</p>
            <div className="nt-heavy-chat-inspector__stats">
              <div>
                <span>Persona</span>
                <strong>{showSlot.personaLabel}</strong>
              </div>
              <div>
                <span>Token</span>
                <strong>{showSlot.tokenLabel}</strong>
              </div>
            </div>
          </InspectorSection>

        <InspectorSection kicker="运行" title="槽位边界" tone="cyan">
            <ul className="nt-heavy-chat-inspector__list">
              <li>默认对话体固定保留，不与新 thread 数量绑定。</li>
              <li>自创建重度槽位与默认对话体独立计数。</li>
              <li>更多槽位通过购买解锁，购买后可加入长期重度智能体池。</li>
            </ul>
            <div className="nt-heavy-chat-inspector__actions">
              <Link className="nt-btn nt-btn--secondary" href="/agents?role=heavy">
                Manage slots
              </Link>
              <Link className="nt-btn nt-btn--outline" href="/products">
                Purchase more slots
              </Link>
            </div>
          </InspectorSection>
        </>
      ) : null}

      {showProject ? (
        <>
      <InspectorSection kicker="项目" title={showProject.title} tone="success">
            <p className="nt-heavy-chat-inspector__summary">{showProject.subtitle}</p>
            <div className="nt-heavy-chat-inspector__copy">{showProject.instructions}</div>
          </InspectorSection>

        <InspectorSection kicker="知识" title="知识上下文" tone="glass">
            <div className="nt-heavy-chat-inspector__knowledge-list">
              {showProject.knowledgeItems.map((item) => (
                <div className="nt-heavy-chat-inspector__knowledge-card" key={item.id}>
                  <NtBadge tone={item.type === "file" ? "cyan" : item.type === "mail" ? "warning" : item.type === "task" ? "success" : "violet"}>
                    {item.type}
                  </NtBadge>
                  <strong>{item.label}</strong>
                  <p>{item.note}</p>
                </div>
              ))}
            </div>
          </InspectorSection>
        </>
      ) : null}

      {showThread ? (
        <>
      <InspectorSection kicker="会话" title={showThread.title} tone={showThread.favorite ? "success" : "glass"}>
            <p className="nt-heavy-chat-inspector__summary">{showThread.preview}</p>
            <div className="nt-heavy-chat-inspector__stats">
              <div>
                <span>Updated</span>
                <strong>{showThread.updatedAtLabel}</strong>
              </div>
              <div>
                <span>Messages</span>
                <strong>{showThread.messages.length}</strong>
              </div>
            </div>
          </InspectorSection>

        <InspectorSection kicker="关联上下文" title="关联上下文" tone="warning">
            <ul className="nt-heavy-chat-inspector__list">
              <li>当前 thread 只绑定当前选中的 slot，不会创建新的 slot 消耗。</li>
              <li>切换 project 只影响这个 thread 的长期上下文，不改变 slot。</li>
              <li>用量与引用信息会随会话持续更新，方便回看上下文消耗。</li>
            </ul>
          </InspectorSection>
        </>
      ) : null}
    </div>
  );
}
