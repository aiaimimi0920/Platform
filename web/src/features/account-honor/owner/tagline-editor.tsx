"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

function EditIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-inline-action__icon" viewBox="0 0 24 24">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12.8 6.7 17.3 11.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-inline-action__icon" viewBox="0 0 24 24">
      <path
        d="m5.5 12.5 4 4 9-9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-inline-action__icon" viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export type AccountHonorTaglineEditorProps = {
  profileTagline: string | null;
};

export function AccountHonorTaglineEditor({ profileTagline }: AccountHonorTaglineEditorProps) {
  const taglineInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(false);
  const saveRequestIdRef = useRef(0);
  const [taglineValue, setTaglineValue] = useState(profileTagline ?? "");
  const [taglineDraft, setTaglineDraft] = useState(profileTagline ?? "");
  const [editingTagline, setEditingTagline] = useState(false);
  const [savingTagline, setSavingTagline] = useState(false);
  const [taglineError, setTaglineError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      saveRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    saveRequestIdRef.current += 1;
    const nextTagline = profileTagline ?? "";
    setTaglineValue(nextTagline);
    setTaglineDraft(nextTagline);
    setEditingTagline(false);
    setSavingTagline(false);
    setTaglineError(null);
  }, [profileTagline]);

  useEffect(() => {
    if (editingTagline) {
      taglineInputRef.current?.focus();
      taglineInputRef.current?.select();
    }
  }, [editingTagline]);

  async function handleTaglineSave() {
    if (savingTagline) {
      return;
    }

    setSavingTagline(true);
    setTaglineError(null);
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    const requestTagline = taglineDraft.trim() ? taglineDraft : null;

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileTagline: requestTagline,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: { profileTagline?: string | null } | null; error?: string }
        | null;

      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "保存失败");
      }

      const nextTagline = payload?.user?.profileTagline ?? "";
      setTaglineValue(nextTagline);
      setTaglineDraft(nextTagline);
      setEditingTagline(false);
    } catch (error) {
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      setTaglineError(error instanceof Error ? error.message : "保存失败");
    } finally {
      if (mountedRef.current && saveRequestIdRef.current === requestId) {
        setSavingTagline(false);
      }
    }
  }

  function handleTaglineCancel() {
    setEditingTagline(false);
    setTaglineDraft(taglineValue);
    setTaglineError(null);
  }

  return (
    <>
      {editingTagline ? (
        <div className="app-honor__tagline-editor">
          <input
            className="app-honor__tagline-input"
            maxLength={80}
            onChange={(event) => setTaglineDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleTaglineSave();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                handleTaglineCancel();
              }
            }}
            placeholder="签名"
            ref={taglineInputRef}
            value={taglineDraft}
          />
          <div className="app-honor__tagline-actions">
            <button
              aria-label="保存签名"
              className="app-honor-inline-action app-honor-inline-action--confirm"
              disabled={savingTagline}
              onClick={() => void handleTaglineSave()}
              type="button"
            >
              <CheckIcon />
            </button>
            <button
              aria-label="取消签名编辑"
              className="app-honor-inline-action"
              disabled={savingTagline}
              onClick={handleTaglineCancel}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className="app-honor__tagline-row">
          <div
            className={cn("app-honor__tagline", !taglineValue && "app-honor__tagline--empty")}
            title={taglineValue || "未设签名"}
          >
            {taglineValue || "未设签名"}
          </div>
          <button
            aria-label="编辑签名"
            className="app-honor-inline-action"
            onClick={() => {
              setTaglineError(null);
              setEditingTagline(true);
            }}
            type="button"
          >
            <EditIcon />
          </button>
        </div>
      )}
      {taglineError ? <div className="app-honor__tagline-status">{taglineError}</div> : null}
    </>
  );
}
