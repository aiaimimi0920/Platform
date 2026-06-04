"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAppToast } from "@/components/app-toast-center";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import { REDEEM_API_PATH } from "../routes";
import type { RedeemResponsePayload } from "../types";

type RedeemCenterProps = {
  enabled: boolean;
  routeOpen?: boolean;
  userId: string | null;
};

function RedeemIcon() {
  return (
    <svg aria-hidden="true" className="app-redeem-trigger__icon" viewBox="0 0 24 24">
      <path
        d="M4 8.5h16v7H4z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 8.5v7M15.5 8.5v7M12 8.5v7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 5.5h11"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-redeem-close__icon" viewBox="0 0 24 24">
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

export function RedeemCenter({ enabled, routeOpen = false, userId }: RedeemCenterProps) {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    tone: "success" | "error";
    message: string;
    outcome?: "walletGrant" | "itemGrant";
  } | null>(null);

  function handleClose() {
    setOpen(false);
    if (routeOpen) {
      router.push("/dashboard");
      return;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      pushToast({
        tone: "error",
        title: "兑换码",
        message: "请输入兑换码。",
      });
      return;
    }

    setSubmitting(true);
    setLastResult(null);
    try {
      const response = await fetch(REDEEM_API_PATH, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const payload = (await response.json()) as RedeemResponsePayload;

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "兑换失败，请稍后重试。");
      }

      setCode("");
      setLastResult({
        tone: "success",
        message: payload.result.message,
        outcome: payload.result.outcome,
      });
      pushToast({
        tone: "success",
        title: "兑换码",
        message: payload.result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "兑换失败，请稍后重试。";
      setLastResult({ tone: "error", message });
      pushToast({
        tone: "error",
        title: "兑换码",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!routeOpen || !enabled || !userId) {
      return;
    }
    setOpen(true);
  }, [enabled, routeOpen, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    return acquireBodyOverlayLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      const frameId = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, routeOpen]);

  if (!enabled || !userId) {
    return null;
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="app-redeem-trigger"
        onClick={() => setOpen(true)}
        ref={triggerButtonRef}
        type="button"
      >
        <span className="app-redeem-trigger__copy">
          <RedeemIcon />
          <span>兑换码</span>
        </span>
      </button>

      {open ? (
        <div aria-label="兑换码" aria-modal="true" className="app-redeem-overlay" role="dialog">
          <button
            aria-label="关闭兑换码面板"
            className="app-redeem-backdrop"
            onClick={handleClose}
            type="button"
          />

          <section className="app-redeem app-redeem--minimal">
            <form className="app-redeem__compact-form" onSubmit={handleSubmit}>
              <input
                className="app-redeem__compact-input"
                name="code"
                onChange={(event) => {
                  setCode(event.target.value);
                  setLastResult(null);
                }}
                placeholder="输入兑换码"
                ref={inputRef}
                type="text"
                value={code}
              />
              <button className="app-redeem__compact-submit" disabled={submitting} type="submit">
                {submitting ? "兑换中..." : "立即兑换"}
              </button>
              <button
                aria-label="关闭兑换码面板"
                className="app-redeem-close app-redeem-close--inline"
                onClick={handleClose}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon />
              </button>
            </form>
            {lastResult ? (
              <div className={`app-redeem__result app-redeem__result--${lastResult.tone}`}>
                <span className="app-redeem__result-message">{lastResult.message}</span>
                {lastResult.tone === "success" && lastResult.outcome === "walletGrant" ? (
                  <a className="app-redeem__result-link" href="/wallet">查看钱包</a>
                ) : null}
                {lastResult.tone === "success" && lastResult.outcome === "itemGrant" ? (
                  <a className="app-redeem__result-link" href="/inventory">查看资产</a>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
