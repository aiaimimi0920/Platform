"use client";

import type { BundleBillingMode } from "./bundle-key-prefix";
import { NtInput, NtSelect } from "@/components/nt-primitives";
import type { GatewayAccessCatalogView } from "@/lib/account-client";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const billingModeOptions: Array<{ value: BundleBillingMode; label: string }> = [
  { value: "token_prepaid", label: "按 Token 计费" },
  { value: "time_pass", label: "按天数计费" },
  { value: "message_prepaid", label: "按请求数计费" },
];

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
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

function stringifyMetadata(metadata: GatewayAccessCatalogView["bundles"][number]["metadata"]) {
  if (!metadata) {
    return "";
  }
  return JSON.stringify(metadata);
}

export function BundleSettingsDialog(props: {
  action: (formData: FormData) => void | Promise<void>;
  bundle: GatewayAccessCatalogView["bundles"][number];
  redirectTo: string;
  inferredBillingMode?: BundleBillingMode | null;
  triggerButtonStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const defaultBillingMode = props.inferredBillingMode ?? "time_pass";

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="app-honor-overlay nt-ops-access-dialog-overlay">
            <button
              aria-label="关闭 Bundle 编辑器"
              className="app-honor-backdrop"
              onClick={() => setOpen(false)}
              type="button"
            />
            <div
              aria-label="编辑 Bundle"
              aria-modal="true"
              className="nt-ops-access-dialog"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <form action={props.action} className="nt-ops-access-dialog__scroll">
                <input type="hidden" name="redirectTo" value={props.redirectTo} />
                <input type="hidden" name="bundleId" value={props.bundle.id} />
                <input type="hidden" name="projectId" value={props.bundle.projectId ?? ""} />
                <input type="hidden" name="slug" value={props.bundle.slug} />
                <input type="hidden" name="status" value={props.bundle.status} />
                <input type="hidden" name="description" value={props.bundle.description ?? ""} />
                <input type="hidden" name="metadata" value={stringifyMetadata(props.bundle.metadata)} />

                <div className="nt-flex nt-justify-between nt-items-start" style={{ gap: 12 }}>
                  <div style={{ display: "grid", gap: 4, maxWidth: 620 }}>
                    <span className="nt-kicker">Bundle</span>
                    <strong style={{ fontSize: "1.16rem", color: "rgba(245,247,250,0.96)" }}>
                      编辑 Bundle
                    </strong>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="app-honor-close"
                    onClick={() => setOpen(false)}
                    aria-label="关闭"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="nt-kicker">名称</span>
                    <NtInput name="displayName" defaultValue={props.bundle.displayName} required />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="nt-kicker">计费模式</span>
                    <NtSelect name="billingMode" defaultValue={defaultBillingMode}>
                      {billingModeOptions.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </NtSelect>
                  </label>
                </div>

                <div className="nt-flex nt-justify-end nt-items-center" style={{ gap: 10 }}>
                  <button type="button" className="nt-btn nt-btn--ghost" onClick={() => setOpen(false)}>
                    取消
                  </button>
                  <button type="submit" className="nt-btn nt-btn--primary">
                    保存 Bundle
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        className="nt-btn nt-btn--ghost"
        style={props.triggerButtonStyle}
        onClick={() => setOpen(true)}
      >
        编辑 Bundle
      </button>
      {dialog}
    </>
  );
}
