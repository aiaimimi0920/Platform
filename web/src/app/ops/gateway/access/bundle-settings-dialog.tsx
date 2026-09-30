"use client";

import type { BundleBillingMode } from "./bundle-key-prefix";
import { NtInput, NtSelect } from "@/components/nt-primitives";
import type { GatewayAccessCatalogView } from "@/lib/account-client";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

const billingModeOptions: Array<{ value: BundleBillingMode; label: string }> = [
  { value: "token_prepaid", label: "按 Token 计费" },
  { value: "time_pass", label: "按天数计费" },
  { value: "message_prepaid", label: "按请求数计费" },
];

/*
 * Dialog chrome comes from the shared `app-honor-*` / `nt-ops-access-dialog` classes; only
 * one-off geometry survives as inline style, and it lives at module scope so this client
 * component does not allocate a fresh style object on every render.
 */
const DIALOG_TITLE_BLOCK_STYLE: CSSProperties = { maxWidth: 620 };

const DIALOG_TITLE_STYLE: CSSProperties = { fontSize: "1.16rem" };

function stopPropagation(event: MouseEvent<HTMLDivElement>) {
  event.stopPropagation();
}

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

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);

  const serializedMetadata = useMemo(() => stringifyMetadata(props.bundle.metadata), [props.bundle.metadata]);

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="app-honor-overlay nt-ops-access-dialog-overlay">
            <button
              aria-label="关闭 Bundle 编辑器"
              className="app-honor-backdrop"
              onClick={closeDialog}
              type="button"
            />
            <div
              aria-label="编辑 Bundle"
              aria-modal="true"
              className="nt-ops-access-dialog"
              role="dialog"
              onClick={stopPropagation}
            >
              <form action={props.action} className="nt-ops-access-dialog__scroll">
                <input type="hidden" name="redirectTo" value={props.redirectTo} />
                <input type="hidden" name="bundleId" value={props.bundle.id} />
                <input type="hidden" name="projectId" value={props.bundle.projectId ?? ""} />
                <input type="hidden" name="slug" value={props.bundle.slug} />
                <input type="hidden" name="status" value={props.bundle.status} />
                <input type="hidden" name="description" value={props.bundle.description ?? ""} />
                <input type="hidden" name="metadata" value={serializedMetadata} />

                <div className="nt-flex nt-justify-between nt-items-start nt-gap-3">
                  <div className="nt-stack nt-gap-1" style={DIALOG_TITLE_BLOCK_STYLE}>
                    <span className="nt-kicker">Bundle</span>
                    <strong className="nt-text-strong" style={DIALOG_TITLE_STYLE}>
                      编辑 Bundle
                    </strong>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="app-honor-close"
                    onClick={closeDialog}
                    aria-label="关闭"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="nt-autofit">
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">名称</span>
                    <NtInput name="displayName" defaultValue={props.bundle.displayName} required />
                  </label>
                  <label className="nt-stack nt-gap-1_5">
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

                <div className="nt-flex nt-justify-end nt-items-center nt-gap-2_5">
                  <button type="button" className="nt-btn nt-btn--ghost" onClick={closeDialog}>
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
        className="nt-btn nt-btn--ghost nt-flex-none nt-nowrap"
        onClick={openDialog}
      >
        编辑 Bundle
      </button>
      {dialog}
    </>
  );
}
