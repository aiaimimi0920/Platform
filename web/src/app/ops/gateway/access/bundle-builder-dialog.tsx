"use client";

import {
  buildBundleDefaultKeyPrefixPreview,
  type BundleBillingMode,
} from "./bundle-key-prefix";
import { NtInput, NtSelect } from "@/components/nt-primitives";
import type { GatewayAccessCatalogView, GatewayProviderAccountView } from "@/lib/account-client";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const billingModeOptions = [
  { value: "token_prepaid", label: "按 Token 计费" },
  { value: "time_pass", label: "按天数计费" },
  { value: "message_prepaid", label: "按请求数计费" },
] as const;

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

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="app-honor-overlay nt-ops-access-dialog-overlay">
            <button
              aria-label="关闭 Bundle 创建器"
              className="app-honor-backdrop"
              onClick={() => setOpen(false)}
              type="button"
            />
            <div className="nt-ops-access-dialog nt-ops-access-dialog--wide" onClick={(event) => event.stopPropagation()}>
            <form action={props.action} style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto" }}>
              <input type="hidden" name="redirectTo" value={props.redirectTo} />
              <input type="hidden" name="projectId" value={props.defaultProjectId} />

              <div
                className="nt-flex nt-justify-between nt-items-center"
                style={{ gap: 12, padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <span className="nt-kicker">Bundle</span>
                  <strong style={{ fontSize: "1.12rem", color: "rgba(245,247,250,0.96)" }}>创建 Bundle</strong>
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

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: "20px 24px 16px",
                  gridTemplateColumns: "minmax(0, 1.3fr) minmax(220px, 0.7fr)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">名称</span>
                  <NtInput name="displayName" placeholder="例如：Codex 按天数 Bundle" required />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">计费模式</span>
                  <NtSelect
                    name="billingMode"
                    value={billingMode}
                    onChange={(event) => setBillingMode(event.target.value as BundleBillingMode)}
                  >
                    {billingModeOptions.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </NtSelect>
                </label>
                <div style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <span className="nt-kicker">默认 Key 前缀</span>
                  <code
                    style={{
                      display: "block",
                      padding: "12px 14px",
                      borderRadius: 16,
                      background: "rgba(7,11,17,0.82)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(245,247,250,0.92)",
                      fontSize: "0.92rem",
                    }}
                  >
                    {buildBundleDefaultKeyPrefixPreview(billingMode)}
                  </code>
                </div>
              </div>

              <div style={{ padding: "16px 24px 0", overflow: "auto" }}>
                {selectableRows.length > 0 ? (
                  <table
                    style={{
                      width: "max-content",
                      borderCollapse: "collapse",
                      marginBottom: 16,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            position: "sticky",
                            top: 0,
                            left: 0,
                            zIndex: 2,
                            minWidth: 280,
                            padding: "12px 16px",
                            textAlign: "left",
                            background: "rgba(11,15,22,0.98)",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                            color: "rgba(245,247,250,0.94)",
                          }}
                        >
                          可用模型
                        </th>
                        {providerIds.map((providerId) => (
                          <th
                            key={providerId}
                            title={providerId}
                            style={{
                              position: "sticky",
                              top: 0,
                              zIndex: 1,
                              width: 132,
                              maxWidth: 132,
                              padding: "12px 10px",
                              textAlign: "center",
                              background: "rgba(11,15,22,0.98)",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              borderRight: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(245,247,250,0.94)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {providerLabelMap.get(providerId) ?? providerId}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modelCodes.map((modelCode) => {
                        const providerMap = modelMap.get(modelCode)!;
                        return (
                          <tr key={modelCode}>
                            <td
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 1,
                                minWidth: 280,
                                padding: "12px 16px",
                                background: "rgba(9,13,19,0.98)",
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                borderRight: "1px solid rgba(255,255,255,0.08)",
                                color: "rgba(245,247,250,0.96)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {modelCode}
                            </td>
                            {providerIds.map((providerId) => {
                              const rows = providerMap.get(providerId) ?? [];
                              const endpoints = Array.from(new Set(rows.map((row) => row.endpointKind))).join(" / ");
                              return (
                                <td
                                  key={`${modelCode}:${providerId}`}
                                  style={{
                                    width: 132,
                                    maxWidth: 132,
                                    padding: "8px 10px",
                                    textAlign: "center",
                                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    borderRight: "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  {rows.length > 0 ? (
                                    <input
                                      type="checkbox"
                                      name="platformAccessIds"
                                      value={rows.map((row) => row.id).join(",")}
                                      title={`${modelCode} / ${providerLabelMap.get(providerId) ?? providerId} / ${endpoints || "access rows"} / ${rows.length} 条`}
                                      style={{ width: 18, height: 18, accentColor: "#d9ff38" }}
                                    />
                                  ) : (
                                    <span className="nt-text-xs nt-text-muted">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="nt-text-sm nt-text-muted" style={{ paddingBottom: 16 }}>
                    当前没有可建包的访问行。
                  </div>
                )}
              </div>

              <div
                className="nt-flex nt-justify-end nt-items-center"
                style={{
                  gap: 10,
                  padding: "16px 24px 20px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
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
      <button ref={triggerButtonRef} type="button" className="nt-btn nt-btn--primary" onClick={() => setOpen(true)}>
        创建 Bundle
      </button>
      {dialog}
    </>
  );
}
