"use client";
import { NtInput, NtSelect, NtTextarea } from "@/components/nt-primitives";
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

type BundlePlatformKeyView = GatewayAccessCatalogView["accessKeys"][number];
type BundlePlatformKeyBalanceView = GatewayAccessCatalogView["balances"][number] | null;

/*
 * All the fixed positioning, backdrop blur and gradient shell now come from the shared
 * `app-honor-*` / `nt-ops-access-dialog` chrome. The handful of values left below are pure
 * one-off geometry, so they sit at module scope: an inline object literal in JSX would
 * allocate a fresh object on every render of this client component.
 */
const DIALOG_TITLE_BLOCK_STYLE: CSSProperties = { maxWidth: 620 };

const DIALOG_TITLE_STYLE: CSSProperties = { fontSize: "1.16rem" };

const TOKEN_CODE_STYLE: CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 16,
  background: "var(--neuro-control)",
  border: "1px solid var(--neuro-line)",
  fontSize: "0.84rem",
};

const FOOTER_STYLE: CSSProperties = { paddingTop: 6 };

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
  const defaultNote = useMemo(() => noteFromMetadata(props.existingKey ?? null), [props.existingKey]);
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

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);

  const timePassDefaultValue = useMemo(
    () =>
      toDateTimeLocalValue(props.existingBalance?.unlimitedUntil ?? props.existingBalance?.periodEndsAt) ||
      draftTimePassUntil,
    [draftTimePassUntil, props.existingBalance?.periodEndsAt, props.existingBalance?.unlimitedUntil],
  );
  const visibleTokenValue = useMemo(
    () => (props.existingKey ? codeValue(props.existingKey.token ?? props.existingKey.externalKey) : ""),
    [props.existingKey],
  );

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="app-honor-overlay nt-ops-access-dialog-overlay"
          >
            <button
              aria-label="关闭平台密钥编辑器"
              className="app-honor-backdrop"
              onClick={closeDialog}
              type="button"
            />
            <div
              aria-label={mode === "create" ? "创建平台密钥" : "编辑平台密钥"}
              aria-modal="true"
              className="nt-ops-access-dialog"
              role="dialog"
              onClick={stopPropagation}
            >
              <form action={props.action} className="nt-ops-access-dialog__scroll">
                <input type="hidden" name="redirectTo" value={props.redirectTo} />
                <input type="hidden" name="bundleId" value={props.bundleId} />
                <input type="hidden" name="billingMode" value={props.billingMode} />
                <input type="hidden" name="resolvedProjectId" value={props.resolvedProjectId} />
                <input type="hidden" name="resolvedTenantId" value={props.resolvedTenantId} />
                {props.existingKey ? <input type="hidden" name="accessKeyId" value={props.existingKey.id} /> : null}

                <div className="nt-flex nt-justify-between nt-items-start nt-gap-3">
                  <div className="nt-stack nt-gap-1" style={DIALOG_TITLE_BLOCK_STYLE}>
                    <span className="nt-kicker">平台密钥</span>
                    <strong className="nt-text-strong" style={DIALOG_TITLE_STYLE}>
                      {props.bundleDisplayName}
                    </strong>
                  </div>
                  <button ref={closeButtonRef} type="button" className="app-honor-close" onClick={closeDialog} aria-label="关闭">
                    <CloseIcon />
                  </button>
                </div>

                <div className="nt-autofit">
                  <label className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">名称</span>
                    <NtInput
                      name="displayName"
                      defaultValue={defaultDisplayName}
                      placeholder="例如：五一平台限时 Key"
                      required
                    />
                  </label>
                </div>

                <div className="nt-autofit">
                  <label className="nt-stack nt-gap-1_5">
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
                  <div className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">当前凭证</span>
                    <code className="nt-text-strong nt-break-word" style={TOKEN_CODE_STYLE}>
                      {visibleTokenValue}
                    </code>
                  </div>
                ) : null}

                {props.billingMode === "time_pass" ? (
                  <div className="nt-autofit">
                    <label className="nt-stack nt-gap-1_5">
                      <span className="nt-kicker">到期日</span>
                      <NtInput
                        name="timePassUntil"
                        type="datetime-local"
                        defaultValue={timePassDefaultValue}
                        required={mode === "create"}
                      />
                    </label>
                  </div>
                ) : null}

                {props.billingMode === "token_prepaid" ? (
                  <div className="nt-autofit">
                    {mode === "create" ? (
                      <label className="nt-stack nt-gap-1_5">
                        <span className="nt-kicker">总 Token</span>
                        <NtInput min={1} name="initialTotalTokens" type="number" defaultValue={defaultInitialTotalTokens} required />
                      </label>
                    ) : (
                      <>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">当前总 Token</span>
                          <NtInput value={props.existingBalance?.totalTokens ?? ""} readOnly />
                        </label>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">剩余 Token</span>
                          <NtInput value={props.existingBalance?.remainingTokens ?? ""} readOnly />
                        </label>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">补充 Token</span>
                          <NtInput min={0} name="tokenDelta" type="number" placeholder="不补充可留空" />
                        </label>
                      </>
                    )}
                  </div>
                ) : null}

                {props.billingMode === "message_prepaid" ? (
                  <div className="nt-autofit">
                    {mode === "create" ? (
                      <label className="nt-stack nt-gap-1_5">
                        <span className="nt-kicker">总请求数</span>
                        <NtInput min={1} name="initialTotalMessages" type="number" defaultValue={defaultInitialTotalMessages} required />
                      </label>
                    ) : (
                      <>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">当前总请求数</span>
                          <NtInput value={props.existingBalance?.totalMessages ?? ""} readOnly />
                        </label>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">剩余请求数</span>
                          <NtInput value={props.existingBalance?.remainingMessages ?? ""} readOnly />
                        </label>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">补充请求数</span>
                          <NtInput min={0} name="messageDelta" type="number" placeholder="不补充可留空" />
                        </label>
                      </>
                    )}
                  </div>
                ) : null}

                <label className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">备注</span>
                  <NtTextarea className="nt-resize-y" name="note" rows={3} defaultValue={defaultNote} placeholder="可选，记录平台侧用途说明。" />
                </label>

                <div className="nt-flex nt-justify-end nt-gap-2_5" style={FOOTER_STYLE}>
                  <button type="button" className="nt-btn nt-btn--ghost" onClick={closeDialog}>
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
        className={
          mode === "create"
            ? "nt-btn nt-btn--secondary nt-flex-none nt-nowrap"
            : "nt-btn nt-btn--ghost nt-flex-none nt-nowrap"
        }
        onClick={openDialog}
      >
        {mode === "create" ? "创建平台密钥" : "编辑平台密钥"}
      </button>
      {dialog}
    </>
  );
}
