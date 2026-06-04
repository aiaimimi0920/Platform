"use client";
import { NtInput, NtSelect, NtTextarea } from "@/components/nt-primitives";
import type { GatewayAccessCatalogView } from "@/lib/account-client";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type BundlePlatformKeyView = GatewayAccessCatalogView["accessKeys"][number];
type BundlePlatformKeyBalanceView = GatewayAccessCatalogView["balances"][number] | null;

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

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function buildDraftDisplayName() {
  return "新平台密钥";
}

function noteFromMetadata(key: BundlePlatformKeyView | null) {
  const value = key?.metadata;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const note = value.note;
  return typeof note === "string" ? note : "";
}

function codeValue(value: string | null | undefined) {
  if (!value) {
    return "当前未下发可见凭证";
  }
  return value;
}

export function BundlePlatformKeyDialog(props: {
  action: (formData: FormData) => void | Promise<void>;
  bundleId: string;
  bundleDisplayName: string;
  billingMode: string;
  resolvedProjectId: string;
  resolvedTenantId: string;
  redirectTo: string;
  existingKey?: BundlePlatformKeyView | null;
  existingBalance?: BundlePlatformKeyBalanceView;
  triggerButtonStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const mode = props.existingKey ? "edit" : "create";
  const draftTimePassUntil =
    mode === "create" && props.billingMode === "time_pass"
      ? toDateTimeLocalValue(addDays(new Date(), 30).toISOString())
      : "";
  const defaultDisplayName = props.existingKey?.displayName ?? buildDraftDisplayName();
  const defaultBalanceStatus = props.existingBalance?.status ?? "active";
  const defaultNote = noteFromMetadata(props.existingKey ?? null);
  const defaultInitialTotalTokens = props.billingMode === "token_prepaid" ? 1000000 : "";
  const defaultInitialTotalMessages = props.billingMode === "message_prepaid" ? 5000 : "";

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
          <div
            className="app-honor-overlay nt-ops-access-dialog-overlay"
          >
            <button
              aria-label="关闭平台密钥编辑器"
              className="app-honor-backdrop"
              onClick={() => setOpen(false)}
              type="button"
            />
            <div
              aria-label={mode === "create" ? "创建平台密钥" : "编辑平台密钥"}
              aria-modal="true"
              className="nt-ops-access-dialog"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <form action={props.action} className="nt-ops-access-dialog__scroll">
                <input type="hidden" name="redirectTo" value={props.redirectTo} />
                <input type="hidden" name="bundleId" value={props.bundleId} />
                <input type="hidden" name="billingMode" value={props.billingMode} />
                <input type="hidden" name="resolvedProjectId" value={props.resolvedProjectId} />
                <input type="hidden" name="resolvedTenantId" value={props.resolvedTenantId} />
                {props.existingKey ? <input type="hidden" name="accessKeyId" value={props.existingKey.id} /> : null}

                <div className="nt-flex nt-justify-between nt-items-start" style={{ gap: 12 }}>
                  <div style={{ display: "grid", gap: 4, maxWidth: 620 }}>
                    <span className="nt-kicker">平台密钥</span>
                    <strong style={{ fontSize: "1.16rem", color: "rgba(245,247,250,0.96)" }}>
                      {props.bundleDisplayName}
                    </strong>
                  </div>
                  <button ref={closeButtonRef} type="button" className="app-honor-close" onClick={() => setOpen(false)} aria-label="关闭">
                    <CloseIcon />
                  </button>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="nt-kicker">名称</span>
                    <NtInput
                      name="displayName"
                      defaultValue={defaultDisplayName}
                      placeholder="例如：五一平台限时 Key"
                      required
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="nt-kicker">额度状态</span>
                    <NtSelect name="balanceStatus" defaultValue={defaultBalanceStatus}>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                      <option value="exhausted">exhausted</option>
                      <option value="expired">expired</option>
                    </NtSelect>
                  </label>
                </div>

                {props.existingKey ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <span className="nt-kicker">当前凭证</span>
                    <code
                      style={{
                        display: "block",
                        padding: "12px 14px",
                        borderRadius: 16,
                        background: "rgba(7,11,17,0.82)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(245,247,250,0.92)",
                        fontSize: "0.84rem",
                        wordBreak: "break-all",
                      }}
                    >
                      {codeValue(props.existingKey.token ?? props.existingKey.externalKey)}
                    </code>
                  </div>
                ) : null}

                {props.billingMode === "time_pass" ? (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="nt-kicker">到期日</span>
                      <NtInput
                        name="timePassUntil"
                        type="datetime-local"
                        defaultValue={toDateTimeLocalValue(props.existingBalance?.unlimitedUntil ?? props.existingBalance?.periodEndsAt) || draftTimePassUntil}
                        required={mode === "create"}
                      />
                    </label>
                  </div>
                ) : null}

                {props.billingMode === "token_prepaid" ? (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    {mode === "create" ? (
                      <label style={{ display: "grid", gap: 6 }}>
                        <span className="nt-kicker">总 Token</span>
                        <NtInput min={1} name="initialTotalTokens" type="number" defaultValue={defaultInitialTotalTokens} required />
                      </label>
                    ) : (
                      <>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">当前总 Token</span>
                          <NtInput value={props.existingBalance?.totalTokens ?? ""} readOnly />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">剩余 Token</span>
                          <NtInput value={props.existingBalance?.remainingTokens ?? ""} readOnly />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">补充 Token</span>
                          <NtInput min={0} name="tokenDelta" type="number" placeholder="不补充可留空" />
                        </label>
                      </>
                    )}
                  </div>
                ) : null}

                {props.billingMode === "message_prepaid" ? (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    {mode === "create" ? (
                      <label style={{ display: "grid", gap: 6 }}>
                        <span className="nt-kicker">总请求数</span>
                        <NtInput min={1} name="initialTotalMessages" type="number" defaultValue={defaultInitialTotalMessages} required />
                      </label>
                    ) : (
                      <>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">当前总请求数</span>
                          <NtInput value={props.existingBalance?.totalMessages ?? ""} readOnly />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">剩余请求数</span>
                          <NtInput value={props.existingBalance?.remainingMessages ?? ""} readOnly />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">补充请求数</span>
                          <NtInput min={0} name="messageDelta" type="number" placeholder="不补充可留空" />
                        </label>
                      </>
                    )}
                  </div>
                ) : null}

                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">备注</span>
                  <NtTextarea name="note" rows={3} defaultValue={defaultNote} placeholder="可选，记录平台侧用途说明。" />
                </label>

                <div className="nt-flex nt-justify-end" style={{ gap: 10, paddingTop: 6 }}>
                  <button type="button" className="nt-btn nt-btn--ghost" onClick={() => setOpen(false)}>
                    取消
                  </button>
                  <button type="submit" className="nt-btn nt-btn--primary">
                    {mode === "create" ? "发布平台密钥" : "更新平台密钥"}
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
        className={mode === "create" ? "nt-btn nt-btn--secondary" : "nt-btn nt-btn--ghost"}
        style={props.triggerButtonStyle}
        onClick={() => setOpen(true)}
      >
        {mode === "create" ? "创建平台密钥" : "编辑平台密钥"}
      </button>
      {dialog}
    </>
  );
}
