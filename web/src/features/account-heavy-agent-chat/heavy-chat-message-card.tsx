"use client";

import { NtBadge } from "@/components/nt-primitives";
import type { HeavyChatMessage } from "@/features/account-heavy-agent-chat/types";

type HeavyChatMessageCardProps = {
  mailboxActionEnabled: boolean;
  message: HeavyChatMessage;
  onAction: (action: "copy" | "retry" | "task" | "mailbox" | "edit") => void;
  taskActionEnabled: boolean;
};

const actionControlClass = "nt-chip nt-chip--glass nt-chat-app-message__action-control";

function ActionBar({
  message,
  onAction,
  taskActionEnabled,
  mailboxActionEnabled,
}: {
  mailboxActionEnabled: boolean;
  message: HeavyChatMessage;
  onAction: HeavyChatMessageCardProps["onAction"];
  taskActionEnabled: boolean;
}) {
  const isAssistant = message.role === "assistant";
  const workflowActions = message.actions;

  function workflowAction(type: "task" | "mailbox") {
    if (type === "task" && !taskActionEnabled) return null;
    if (type === "mailbox" && !mailboxActionEnabled) return null;
    const action = workflowActions.find((candidate) => candidate.type === type);
    const label = type === "task" ? "转任务" : "投邮箱";
    if (action?.status === "complete" && action.href) {
      return (
        <a className={actionControlClass} href={action.href}>
          {type === "task" ? "查看任务草稿" : "查看邮箱草稿"}
        </a>
      );
    }
    if (action?.status === "pending") {
      return (
        <button className={actionControlClass} onClick={() => onAction(type)} type="button">
          {type === "task" ? "检查任务进度" : "检查邮箱进度"}
        </button>
      );
    }
    return (
      <span className="nt-chat-app-message__action-state">
        <button className={actionControlClass} onClick={() => onAction(type)} type="button">
          {action?.status === "failed" ? `重试${label}` : label}
        </button>
        {action?.status === "failed" && action.errorMessage ? <span>{action.errorMessage}</span> : null}
      </span>
    );
  }

  return (
    <div className="nt-chat-app-message__actions">
      <button className={actionControlClass} onClick={() => onAction("copy")} type="button">
        复制
      </button>
      {isAssistant && message.status !== "streaming" ? (
        <>
          <button className={actionControlClass} onClick={() => onAction("retry")} type="button">
            重试
          </button>
          {message.status === "complete" ? workflowAction("task") : null}
          {message.status === "complete" ? workflowAction("mailbox") : null}
        </>
      ) : !isAssistant ? (
        <button className={actionControlClass} onClick={() => onAction("edit")} type="button">
          再次编辑
        </button>
      ) : null}
    </div>
  );
}

export function HeavyChatMessageCard({
  mailboxActionEnabled,
  message,
  onAction,
  taskActionEnabled,
}: HeavyChatMessageCardProps) {
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

        <ActionBar
          mailboxActionEnabled={mailboxActionEnabled}
          message={message}
          onAction={onAction}
          taskActionEnabled={taskActionEnabled}
        />
      </div>
    </article>
  );
}
