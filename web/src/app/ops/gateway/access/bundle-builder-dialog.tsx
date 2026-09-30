"use client";

import {
  buildBundleDefaultKeyPrefixPreview,
  type BundleBillingMode,
} from "./bundle-key-prefix";
import { NtInput, NtSelect } from "@/components/nt-primitives";
import type { GatewayAccessCatalogView, GatewayProviderAccountView } from "@/lib/account-client";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

const billingModeOptions = [
  { value: "token_prepaid", label: "按 Token 计费" },
  { value: "time_pass", label: "按天数计费" },
  { value: "message_prepaid", label: "按请求数计费" },
] as const;

/*
 * The dialog chrome (fixed overlay, backdrop, gradient shell) comes from the shared
 * `app-honor-*` / `nt-ops-access-dialog` classes. Everything left below is either one-off
 * geometry or the sticky access-matrix table, so it lives in module-scope constants: an
 * inline object literal in JSX would allocate on every render of this client component and
 * defeat memoization on anything downstream. Colors resolve through neuro tokens only.
 */
const BUILDER_FORM_STYLE: CSSProperties = { gridTemplateRows: "auto auto minmax(0, 1fr) auto" };

const DIALOG_HEADER_STYLE: CSSProperties = {
  padding: "20px 24px",
  borderBottom: "1px solid var(--neuro-line)",
};

const DIALOG_TITLE_STYLE: CSSProperties = { fontSize: "1.12rem" };

const BUILDER_FIELDS_STYLE: CSSProperties = {
  padding: "20px 24px 16px",
  gridTemplateColumns: "minmax(0, 1.3fr) minmax(220px, 0.7fr)",
  borderBottom: "1px solid var(--neuro-line)",
};

const FULL_SPAN_FIELD_STYLE: CSSProperties = { gridColumn: "1 / -1" };

const KEY_PREFIX_CODE_STYLE: CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 16,
  background: "var(--neuro-control)",
  border: "1px solid var(--neuro-line)",
};

const MATRIX_SCROLL_STYLE: CSSProperties = { padding: "16px 24px 0", overflow: "auto" };

const MATRIX_TABLE_STYLE: CSSProperties = {
  width: "max-content",
  borderCollapse: "collapse",
  marginBottom: 16,
};

const MATRIX_CORNER_HEAD_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  left: 0,
  zIndex: 2,
  minWidth: 280,
  padding: "12px 16px",
  textAlign: "left",
  background: "var(--neuro-surface)",
  borderBottom: "1px solid var(--neuro-line)",
  borderRight: "1px solid var(--neuro-line)",
  color: "var(--neuro-text)",
};

const MATRIX_PROVIDER_HEAD_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  width: 132,
  maxWidth: 132,
  padding: "12px 10px",
  textAlign: "center",
  background: "var(--neuro-surface)",
  borderBottom: "1px solid var(--neuro-line)",
  borderRight: "1px solid var(--neuro-line)",
  color: "var(--neuro-text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const MATRIX_MODEL_CELL_STYLE: CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  minWidth: 280,
  padding: "12px 16px",
  background: "var(--neuro-surface)",
  borderBottom: "1px solid var(--neuro-line)",
  borderRight: "1px solid var(--neuro-line)",
  color: "var(--neuro-text)",
  whiteSpace: "nowrap",
};

const MATRIX_VALUE_CELL_STYLE: CSSProperties = {
  width: 132,
  maxWidth: 132,
  padding: "8px 10px",
  textAlign: "center",
  borderBottom: "1px solid var(--neuro-line)",
  borderRight: "1px solid var(--neuro-line)",
};

const MATRIX_CHECKBOX_STYLE: CSSProperties = {
  width: 18,
  height: 18,
  accentColor: "var(--neuro-signal-yellow)",
};

const EMPTY_MATRIX_STYLE: CSSProperties = { paddingBottom: 16 };

const DIALOG_FOOTER_STYLE: CSSProperties = {
  padding: "16px 24px 20px",
  borderTop: "1px solid var(--neuro-line)",
};

type BundleMatrixColumn = { id: string; label: string };
type BundleMatrixCell = { checkboxValue: string; title: string };
type BundleMatrixRow = {
  modelCode: string;
  cells: Array<{ providerId: string; cell: BundleMatrixCell | null }>;
};

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

function SubmitButton() {
  return (
    <button type="submit" className="nt-btn nt-btn--primary">
      确认创建
    </button>
  );
}

export function BundleBuilderDialog(props: {
  action: (formData: FormData) => void | Promise<void>;
  defaultProjectId: string;
  providerAccounts: GatewayProviderAccountView[];
  platformAccessRows: GatewayAccessCatalogView["platformAccessRows"];
  redirectTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [billingMode, setBillingMode] = useState<BundleBillingMode>("token_prepaid");
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

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
  const handleBillingModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setBillingMode(event.target.value as BundleBillingMode),
    [],
  );

  const providerLabelMap = useMemo(
    () => new Map(props.providerAccounts.map((provider) => [provider.id, provider.label])),
    [props.providerAccounts],
  );
  const collator = useMemo(() => new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" }), []);
  const selectableRows = useMemo(
    () => props.platformAccessRows.filter((row) => row.status === "active" && row.enabledForSale),
    [props.platformAccessRows],
  );
  const providerIds = useMemo(
    () =>
      Array.from(new Set(selectableRows.map((row) => row.providerAccountId))).sort((left, right) =>
        collator.compare(providerLabelMap.get(left) ?? left, providerLabelMap.get(right) ?? right),
      ),
    [collator, providerLabelMap, selectableRows],
  );
  const modelMap = useMemo(() => {
    const nextMap = new Map<string, Map<string, typeof selectableRows>>();
    for (const row of selectableRows) {
      if (!nextMap.has(row.modelCode)) {
        nextMap.set(row.modelCode, new Map());
      }
      const providerMap = nextMap.get(row.modelCode)!;
      const rows = providerMap.get(row.providerAccountId) ?? [];
      rows.push(row);
      providerMap.set(row.providerAccountId, rows);
    }
    return nextMap;
  }, [selectableRows]);
  const modelCodes = useMemo(
    () => Array.from(modelMap.keys()).sort((left, right) => collator.compare(left, right)),
    [collator, modelMap],
  );

  /*
   * The matrix used to re-derive every column label, checkbox value and tooltip inside the
   * render loop — one `Set` plus two `join`s per cell on each keystroke elsewhere in the
   * dialog. Both are now derived once per access-row change.
   */
  const providerColumns = useMemo<BundleMatrixColumn[]>(
    () => providerIds.map((providerId) => ({ id: providerId, label: providerLabelMap.get(providerId) ?? providerId })),
    [providerIds, providerLabelMap],
  );
  const matrixRows = useMemo<BundleMatrixRow[]>(
    () =>
      modelCodes.map((modelCode) => {
        const providerMap = modelMap.get(modelCode)!;
        return {
          modelCode,
          cells: providerColumns.map((column) => {
            const rows = providerMap.get(column.id) ?? [];
            if (rows.length === 0) {
              return { providerId: column.id, cell: null };
            }
            const endpoints = Array.from(new Set(rows.map((row) => row.endpointKind))).join(" / ");
            return {
              providerId: column.id,
              cell: {
                checkboxValue: rows.map((row) => row.id).join(","),
                title: `${modelCode} / ${column.label} / ${endpoints || "access rows"} / ${rows.length} 条`,
              },
            };
          }),
        };
      }),
    [modelCodes, modelMap, providerColumns],
  );
  const keyPrefixPreview = useMemo(() => buildBundleDefaultKeyPrefixPreview(billingMode), [billingMode]);

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="app-honor-overlay nt-ops-access-dialog-overlay">
            <button
              aria-label="关闭 Bundle 创建器"
              className="app-honor-backdrop"
              onClick={closeDialog}
              type="button"
            />
            <div className="nt-ops-access-dialog nt-ops-access-dialog--wide" onClick={stopPropagation}>
            <form action={props.action} className="nt-stack" style={BUILDER_FORM_STYLE}>
              <input type="hidden" name="redirectTo" value={props.redirectTo} />
              <input type="hidden" name="projectId" value={props.defaultProjectId} />

              <div
                className="nt-flex nt-justify-between nt-items-center nt-gap-3"
                style={DIALOG_HEADER_STYLE}
              >
                <div className="nt-stack nt-gap-1">
                  <span className="nt-kicker">Bundle</span>
                  <strong className="nt-text-strong" style={DIALOG_TITLE_STYLE}>创建 Bundle</strong>
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

              <div className="nt-stack nt-gap-3" style={BUILDER_FIELDS_STYLE}>
                <label className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">名称</span>
                  <NtInput name="displayName" placeholder="例如：Codex 按天数 Bundle" required />
                </label>
                <label className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">计费模式</span>
                  <NtSelect
                    name="billingMode"
                    value={billingMode}
                    onChange={handleBillingModeChange}
                  >
                    {billingModeOptions.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </NtSelect>
                </label>
                <div className="nt-stack nt-gap-1_5" style={FULL_SPAN_FIELD_STYLE}>
                  <span className="nt-kicker">默认 Key 前缀</span>
                  <code className="nt-text-md nt-text-strong" style={KEY_PREFIX_CODE_STYLE}>
                    {keyPrefixPreview}
                  </code>
                </div>
              </div>

              <div style={MATRIX_SCROLL_STYLE}>
                {selectableRows.length > 0 ? (
                  <table style={MATRIX_TABLE_STYLE}>
                    <thead>
                      <tr>
                        <th style={MATRIX_CORNER_HEAD_STYLE}>
                          可用模型
                        </th>
                        {providerColumns.map((column) => (
                          <th
                            key={column.id}
                            title={column.id}
                            style={MATRIX_PROVIDER_HEAD_STYLE}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.map((row) => (
                        <tr key={row.modelCode}>
                          <td style={MATRIX_MODEL_CELL_STYLE}>
                            {row.modelCode}
                          </td>
                          {row.cells.map((entry) => (
                            <td
                              key={`${row.modelCode}:${entry.providerId}`}
                              style={MATRIX_VALUE_CELL_STYLE}
                            >
                              {entry.cell ? (
                                <input
                                  type="checkbox"
                                  name="platformAccessIds"
                                  value={entry.cell.checkboxValue}
                                  title={entry.cell.title}
                                  style={MATRIX_CHECKBOX_STYLE}
                                />
                              ) : (
                                <span className="nt-text-xs nt-text-muted">-</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="nt-text-sm nt-text-muted" style={EMPTY_MATRIX_STYLE}>
                    当前没有可建包的访问行。
                  </div>
                )}
              </div>

              <div
                className="nt-flex nt-justify-end nt-items-center nt-gap-2_5"
                style={DIALOG_FOOTER_STYLE}
              >
                <SubmitButton />
              </div>
            </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button ref={triggerButtonRef} type="button" className="nt-btn nt-btn--primary" onClick={openDialog}>
        创建 Bundle
      </button>
      {dialog}
    </>
  );
}
