"use client";

import { NtBadge } from "@/components/nt-primitives";
import type {
  HeavyActionNotice,
  HeavyChatReference,
  HeavyProjectContext,
  HeavyReferenceType,
} from "@/features/account-heavy-agent-chat/types";

type HeavyChatComposerProps = {
  actionNotice: HeavyActionNotice | null;
  draft: string;
  mode: "landing" | "thread";
  onAddReference: (type: HeavyReferenceType) => void;
  onQuickPrompt: (prompt: string) => void;
  onRemoveReference: (referenceId: string) => void;
  onSend: () => void;
  onSetDraft: (value: string) => void;
  onToggleWebSearch: () => void;
  project: HeavyProjectContext | null;
  references: HeavyChatReference[];
  streaming: boolean;
  webSearchEnabled: boolean;
};

const QUICK_PROMPTS = [
  "帮我整理今天的待办事项",
  "把这件事拆成执行步骤",
  "生成一封简洁的回复邮件",
  "根据当前项目整理摘要",
];

export function HeavyChatComposer({
  actionNotice,
  draft,
  mode,
  onAddReference,
  onQuickPrompt,
  onRemoveReference,
  onSend,
  onSetDraft,
  onToggleWebSearch,
  project,
  references,
  streaming,
  webSearchEnabled,
}: HeavyChatComposerProps) {
  return (
    <div className={`nt-chat-app-composer nt-chat-app-composer--${mode}`}>
      {actionNotice ? (
        <div className="nt-chat-app-composer__notice">
          <NtBadge tone={actionNotice.tone}>{actionNotice.message}</NtBadge>
        </div>
      ) : null}

      <div className="nt-chat-app-composer__shell">
        {references.length > 0 ? (
          <div className="nt-chat-app-composer__references">
            {references.map((reference) => (
              <button
                className="nt-chat-app-composer__reference"
                key={reference.id}
                onClick={() => onRemoveReference(reference.id)}
                type="button"
              >
                <NtBadge tone={reference.tone}>{reference.type}</NtBadge>
                <strong>{reference.title}</strong>
                <span>{reference.meta}</span>
              </button>
            ))}
          </div>
        ) : null}

        <textarea
          className="nt-chat-app-composer__input"
          onChange={(event) => onSetDraft(event.target.value)}
          placeholder={mode === "landing" ? "有什么想问的？" : "继续你的对话…"}
          rows={mode === "landing" ? 2 : 3}
          value={draft}
        />

        <div className="nt-chat-app-composer__toolbar">
          <div className="nt-chat-app-composer__toolbar-main">
            <button className="nt-chat-app-composer__tool" onClick={() => onAddReference("file")} type="button">
              上传
            </button>
            <button
              className={`nt-chat-app-composer__tool${webSearchEnabled ? " nt-chat-app-composer__tool--active" : ""}`}
              onClick={onToggleWebSearch}
              type="button"
            >
              网络搜索
            </button>
            {project ? (
              <button className="nt-chat-app-composer__tool" onClick={() => onAddReference("task")} type="button">
                项目上下文
              </button>
            ) : null}
          </div>

          <div className="nt-chat-app-composer__toolbar-side">
            {streaming ? <NtBadge tone="warning">Streaming</NtBadge> : null}
            <button className="nt-btn nt-btn--primary" onClick={onSend} type="button">
              发送
            </button>
          </div>
        </div>
      </div>

      {mode === "landing" ? (
        <div className="nt-chat-app-composer__prompts">
          {QUICK_PROMPTS.map((prompt) => (
            <button className="nt-chip nt-chip--glass" key={prompt} onClick={() => onQuickPrompt(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
