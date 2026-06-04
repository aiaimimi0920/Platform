"use client";

import { NtBadge } from "@/components/nt-primitives";
import type { HeavyChatMessage } from "@/features/account-heavy-agent-chat/types";

type HeavyChatMessageCardProps = {
  message: HeavyChatMessage;
  onAction: (action: "copy" | "retry" | "task" | "mailbox" | "edit") => void;
};

function ActionBar({
  isAssistant,
  onAction,
}: {
  isAssistant: boolean;
  onAction: HeavyChatMessageCardProps["onAction"];
}) {
  return (
    <div className="nt-chat-app-message__actions">
      <button className="nt-chip nt-chip--glass" onClick={() => onAction("copy")} type="button">
        复制
      </button>
      {isAssistant ? (
        <>
          <button className="nt-chip nt-chip--glass" onClick={() => onAction("retry")} type="button">
            重试
          </button>
          <button className="nt-chip nt-chip--glass" onClick={() => onAction("task")} type="button">
            转任务
          </button>
          <button className="nt-chip nt-chip--glass" onClick={() => onAction("mailbox")} type="button">
            投邮箱
          </button>
        </>
      ) : (
        <button className="nt-chip nt-chip--glass" onClick={() => onAction("edit")} type="button">
          再次编辑
        </button>
      )}
    </div>
  );
}

export function HeavyChatMessageCard({ message, onAction }: HeavyChatMessageCardProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={`nt-chat-app-message nt-chat-app-message--${message.role}`}>
      <div className="nt-chat-app-message__avatar">{isAssistant ? "觅" : "你"}</div>

      <div className="nt-chat-app-message__content">
        <div className="nt-chat-app-message__meta">
          <strong>{isAssistant ? "觅觅" : "你"}</strong>
          <span>{message.createdAtLabel}</span>
          {message.meta ? <NtBadge tone="glass">{message.meta}</NtBadge> : null}
          {message.status !== "complete" ? (
            <NtBadge tone={message.status === "streaming" ? "warning" : "danger"}>
              {message.status === "streaming" ? "生成中" : "异常"}
            </NtBadge>
          ) : null}
        </div>

        <div className={`nt-chat-app-message__bubble${isAssistant ? "" : " nt-chat-app-message__bubble--user"}`}>
          {message.blocks.map((block) => {
            if (block.type === "text") {
              return (
                <p className="nt-chat-app-message__text" key={block.id}>
                  {block.text}
                </p>
              );
            }

            if (block.type === "status") {
              return (
                <div className="nt-chat-app-message__status" key={block.id}>
                  <NtBadge tone={block.tone}>{block.label}</NtBadge>
                  {block.description ? <p>{block.description}</p> : null}
                </div>
              );
            }

            if (block.type === "reference") {
              return (
                <div className="nt-chat-app-message__references" key={block.id}>
                  {block.references.map((reference) => (
                    <div className="nt-chat-app-message__reference" key={reference.id}>
                      <NtBadge tone={reference.tone}>{reference.type}</NtBadge>
                      <strong>{reference.title}</strong>
                      <span>{reference.meta}</span>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="nt-chat-app-message__summary" key={block.id}>
                <strong>{block.title}</strong>
                <ul>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <ActionBar isAssistant={isAssistant} onAction={onAction} />
      </div>
    </article>
  );
}
