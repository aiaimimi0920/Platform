import { auth } from "@/auth";
import {
  getGatewayAccessCatalog,
  getOperatorGatewayProviderInventory,
  type GatewayAccessCatalogView,
} from "@/lib/account-client";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { NtBadge, NtCard, NtPanel, type NtBadgeTone } from "@/components/nt-primitives";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createGatewayAccessBundleMatrixAction,
  deleteGatewayAccessBundleAction,
  deleteGatewayBundlePlatformKeyAction,
  saveGatewayAccessBundleAction,
  saveGatewayBundlePlatformKeyAction,
} from "./actions";
import { BundleBuilderDialog } from "./bundle-builder-dialog";
import { BundlePlatformKeyDialog } from "./bundle-promo-key-dialog";
import { BundleSettingsDialog } from "./bundle-settings-dialog";

type AccessPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

const gatewayBundleBillingModes = ["time_pass", "token_prepaid", "message_prepaid"] as const;

function isGatewayBundleBillingMode(
  value: string | null | undefined,
): value is (typeof gatewayBundleBillingModes)[number] {
  return value === "time_pass" || value === "token_prepaid" || value === "message_prepaid";
}

function toneForStatus(status: string): NtBadgeTone {
  if (status === "active") return "success";
  if (status === "revoked" || status === "disabled") return "danger";
  if (status === "cooling" || status === "expired") return "warning";
  return "secondary";
}

function labelForBillingMode(value: string | null | undefined) {
  if (value === "time_pass") return "按天数计费";
  if (value === "token_prepaid") return "按 Token 计费";
  if (value === "message_prepaid") return "按请求数计费";
  return "未设定";
}

function displayPlatformKeyTitle(value: string | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return "未命名平台密钥";
  }
  return raw;
}

function resolveBundleBillingMode(
  bundleBillingMode: string | null | undefined,
  platformKeys: GatewayAccessCatalogView["accessKeys"],
  balanceByKeyId: Map<string, GatewayAccessCatalogView["balances"][number]>,
) {
  if (isGatewayBundleBillingMode(bundleBillingMode)) {
    return bundleBillingMode;
  }
  for (const key of platformKeys) {
    const balanceMode = balanceByKeyId.get(key.id)?.balanceMode;
    if (isGatewayBundleBillingMode(balanceMode)) {
      return balanceMode;
    }
  }
  return null;
}

function CodeValue({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="nt-text-sm nt-text-muted">—</span>;
  }
  return (
    <code
      style={{
        display: "block",
        padding: "8px 10px",
        borderRadius: 12,
        background: "rgba(6,10,18,0.82)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(245,247,250,0.9)",
        wordBreak: "break-all",
        fontSize: "0.84rem",
      }}
    >
      {value}
    </code>
  );
}

function noteFromMetadata(metadata: GatewayAccessCatalogView["accessKeys"][number]["metadata"]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const note = metadata.note;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

function platformKeyBalanceMeta(balance: GatewayAccessCatalogView["balances"][number]) {
  if (balance.balanceMode === "time_pass") {
    return balance.unlimitedUntil ? `有效期： ${new Date(balance.unlimitedUntil).toLocaleString("zh-CN")}` : "有效期： 未设定";
  }
  const details: string[] = [];
  if (typeof balance.remainingTokens === "number") {
    details.push(`剩余 Token： ${balance.remainingTokens}`);
  }
  if (typeof balance.remainingMessages === "number") {
    details.push(`剩余请求： ${balance.remainingMessages}`);
  }
  return details.join(" / ");
}

function StatusBanner({ status, message }: { status?: string; message?: string }) {
  if (!status || !message) {
    return null;
  }
  return (
    <NtCard
      style={{
        border: `1px solid ${status === "success" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
        background: status === "success" ? "rgba(15,28,18,0.82)" : "rgba(33,15,18,0.82)",
      }}
    >
      <div className="nt-flex nt-justify-between nt-items-center" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="nt-stack nt-gap-1">
          <NtBadge tone={status === "success" ? "success" : "danger"}>
            {status === "success" ? "操作成功" : "操作失败"}
          </NtBadge>
          <span style={{ color: "rgba(245,247,250,0.92)" }}>{message}</span>
        </div>
        <Link href="/ops/gateway/access" className="nt-link">
          清除提示
        </Link>
      </div>
    </NtCard>
  );
}

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect("/");
  }
  const userContext = await requirePlatformOperatorUserContext();

  const query = (await searchParams) ?? {};
  const [catalog, providerInventory] = await Promise.all([
    getGatewayAccessCatalog(userContext),
    getOperatorGatewayProviderInventory(userContext),
  ]);
  const providerAccounts = providerInventory.providers.map((entry) => entry.providerAccount);
  const defaultProjectId =
    catalog.accessKeys.find((key) => key.keyKind === "normal")?.resolvedProjectId ?? catalog.bundles[0]?.projectId ?? "";
  const defaultTenantId = catalog.accessKeys.find((key) => key.keyKind === "normal")?.resolvedTenantId ?? "";

  const bundleItemCount = new Map<string, number>();
  const bundleProviderSets = new Map<string, Set<string>>();
  const bundleModelSets = new Map<string, Set<string>>();
  const platformAccessById = new Map(catalog.platformAccessRows.map((row) => [row.id, row]));
  for (const item of catalog.bundleItems) {
    bundleItemCount.set(item.bundleId, (bundleItemCount.get(item.bundleId) ?? 0) + 1);
    const accessRow = platformAccessById.get(item.platformAccessId);
    if (!accessRow) {
      continue;
    }
    if (!bundleProviderSets.has(item.bundleId)) {
      bundleProviderSets.set(item.bundleId, new Set());
    }
    bundleProviderSets.get(item.bundleId)!.add(accessRow.providerAccountId);
    if (!bundleModelSets.has(item.bundleId)) {
      bundleModelSets.set(item.bundleId, new Set());
    }
    bundleModelSets.get(item.bundleId)!.add(accessRow.modelCode);
  }

  const accessKeyById = new Map(catalog.accessKeys.map((key) => [key.id, key]));
  const balanceByKeyId = new Map(catalog.balances.map((item) => [item.accessKeyId, item]));
  const bundlePlatformKeys = new Map<string, GatewayAccessCatalogView["accessKeys"]>();
  for (const binding of catalog.keyBundleBindings) {
    const key = accessKeyById.get(binding.accessKeyId);
    if (!key || key.ownerType !== "platform" || key.keyKind !== "normal") {
      continue;
    }
    if (!bundlePlatformKeys.has(binding.bundleId)) {
      bundlePlatformKeys.set(binding.bundleId, []);
    }
    const list = bundlePlatformKeys.get(binding.bundleId)!;
    if (!list.some((item) => item.id === key.id)) {
      list.push(key);
    }
  }

  return (
    <div className="nt-stack nt-gap-6">
      <StatusBanner status={query.status} message={query.message} />

      <NtPanel>
        <div className="nt-stack nt-gap-4">
          <div className="nt-flex nt-justify-between nt-items-start" style={{ gap: 16, flexWrap: "wrap" }}>
            <div className="nt-stack nt-gap-1" style={{ maxWidth: 720 }}>
              <span className="nt-kicker">Bundle</span>
              <h1 style={{ margin: 0, color: "rgba(245,247,250,0.96)" }}>Bundle 与平台密钥</h1>
            </div>
            <BundleBuilderDialog
              action={createGatewayAccessBundleMatrixAction}
              defaultProjectId={defaultProjectId}
              providerAccounts={providerAccounts}
              platformAccessRows={catalog.platformAccessRows}
              redirectTo="/ops/gateway/access"
            />
          </div>

          <div className="nt-stack nt-gap-3">
            {catalog.bundles.map((bundle) => {
              const platformKeys = bundlePlatformKeys.get(bundle.id) ?? [];
              const resolvedBundleBillingMode = resolveBundleBillingMode(bundle.billingMode, platformKeys, balanceByKeyId);
              const bundleAnchorId = `bundle-${bundle.id}`;
              const bundleRedirectTo = `/ops/gateway/access#${bundleAnchorId}`;
              return (
                <NtCard
                  key={bundle.id}
                  id={bundleAnchorId}
                  className="nt-card--outlined"
                  style={{ display: "grid", gap: 14, scrollMarginTop: 104 }}
                >
                  <div className="nt-stack nt-gap-3">
                    <div className="nt-stack nt-gap-1" style={{ minWidth: 0 }}>
                      <strong>{bundle.displayName}</strong>
                    </div>
                    <div
                      className="nt-flex"
                      style={{
                        gap: 8,
                        flexWrap: "nowrap",
                        alignItems: "center",
                        overflowX: "auto",
                        paddingBottom: 2,
                      }}
                    >
                      <BundleSettingsDialog
                        action={saveGatewayAccessBundleAction}
                        bundle={bundle}
                        redirectTo={bundleRedirectTo}
                        inferredBillingMode={resolvedBundleBillingMode}
                        triggerButtonStyle={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
                      />
                      <form action={deleteGatewayAccessBundleAction} style={{ display: "flex", flex: "0 0 auto" }}>
                        <input type="hidden" name="redirectTo" value="/ops/gateway/access" />
                        <input type="hidden" name="bundleId" value={bundle.id} />
                        <input type="hidden" name="displayName" value={bundle.displayName} />
                        <button
                          type="submit"
                          className="nt-btn nt-btn--ghost"
                          style={{
                            flex: "0 0 auto",
                            borderColor: "rgba(248,113,113,0.28)",
                            color: "rgba(255,186,186,0.96)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          删除 Bundle
                        </button>
                      </form>
                      {resolvedBundleBillingMode && defaultTenantId && (bundle.projectId ?? defaultProjectId) ? (
                        <BundlePlatformKeyDialog
                          action={saveGatewayBundlePlatformKeyAction}
                          bundleId={bundle.id}
                          bundleDisplayName={bundle.displayName}
                          billingMode={resolvedBundleBillingMode}
                          resolvedProjectId={bundle.projectId ?? defaultProjectId}
                          resolvedTenantId={defaultTenantId}
                          redirectTo={bundleRedirectTo}
                          triggerButtonStyle={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
                        />
                      ) : null}
                    </div>
                    <div
                      className="nt-flex"
                      style={{
                        gap: 8,
                        flexWrap: "nowrap",
                        alignItems: "center",
                        overflowX: "auto",
                        paddingBottom: 2,
                      }}
                    >
                      <NtBadge
                        tone={
                          resolvedBundleBillingMode === "time_pass"
                            ? "warning"
                            : resolvedBundleBillingMode === "token_prepaid"
                              ? "cyan"
                              : resolvedBundleBillingMode === "message_prepaid"
                                ? "success"
                                : "secondary"
                        }
                      >
                        {labelForBillingMode(resolvedBundleBillingMode)}
                      </NtBadge>
                      <NtBadge tone={toneForStatus(bundle.status)}>{bundle.status}</NtBadge>
                      <NtBadge tone="glass">访问行 {bundleItemCount.get(bundle.id) ?? 0}</NtBadge>
                      <NtBadge tone="glass">模型 {bundleModelSets.get(bundle.id)?.size ?? 0}</NtBadge>
                      <NtBadge tone="glass">服务商 {bundleProviderSets.get(bundle.id)?.size ?? 0}</NtBadge>
                      <NtBadge tone="glass">平台密钥 {platformKeys.length}</NtBadge>
                    </div>
                  </div>

                  <div className="nt-stack nt-gap-2">
                    {platformKeys.length > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 380px))",
                          justifyContent: "start",
                        }}
                      >
                        {platformKeys.map((key) => {
                          const balance = balanceByKeyId.get(key.id) ?? null;
                          const keyBillingMode =
                            (isGatewayBundleBillingMode(balance?.balanceMode) ? balance?.balanceMode : resolvedBundleBillingMode) ?? null;
                          return (
                            <div
                              key={key.id}
                              style={{
                                display: "grid",
                                gap: 10,
                                padding: 16,
                                borderRadius: 20,
                                border: "1px solid rgba(255,255,255,0.08)",
                                background: "rgba(7,11,17,0.74)",
                              }}
                            >
                              <div className="nt-flex nt-justify-between nt-items-start" style={{ gap: 10 }}>
                                <div className="nt-stack nt-gap-1">
                                  <strong>{displayPlatformKeyTitle(key.displayName)}</strong>
                                </div>
                                <NtBadge tone={toneForStatus(key.status)}>{key.status}</NtBadge>
                              </div>
                              <div className="nt-stack nt-gap-1">
                                <span className="nt-kicker">分发凭证</span>
                                <CodeValue value={key.token ?? key.externalKey ?? null} />
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                <div className="nt-kicker">额度</div>
                                {balance ? (
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span className="nt-text-sm nt-text-muted">{labelForBillingMode(balance.balanceMode)}</span>
                                    {platformKeyBalanceMeta(balance) ? (
                                      <span className="nt-text-xs nt-text-muted">{platformKeyBalanceMeta(balance)}</span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="nt-text-sm nt-text-muted">尚未初始化余额</span>
                                )}
                              </div>
                              {noteFromMetadata(key.metadata) ? (
                                <span className="nt-text-xs nt-text-muted">{noteFromMetadata(key.metadata)}</span>
                              ) : null}
                              <div className="nt-flex nt-justify-end" style={{ gap: 10, flexWrap: "wrap" }}>
                                {keyBillingMode ? (
                                  <BundlePlatformKeyDialog
                                    action={saveGatewayBundlePlatformKeyAction}
                                    bundleId={bundle.id}
                                    bundleDisplayName={bundle.displayName}
                                    billingMode={keyBillingMode}
                                    resolvedProjectId={bundle.projectId ?? defaultProjectId}
                                    resolvedTenantId={defaultTenantId}
                                    redirectTo={bundleRedirectTo}
                                    existingKey={key}
                                    existingBalance={balance}
                                  />
                                ) : null}
                                <form action={deleteGatewayBundlePlatformKeyAction} style={{ display: "flex" }}>
                                  <input type="hidden" name="redirectTo" value={bundleRedirectTo} />
                                  <input type="hidden" name="accessKeyId" value={key.id} />
                                  <input type="hidden" name="displayName" value={displayPlatformKeyTitle(key.displayName)} />
                                  <button
                                    type="submit"
                                    className="nt-btn nt-btn--ghost"
                                    style={{
                                      borderColor: "rgba(248,113,113,0.28)",
                                      color: "rgba(255,186,186,0.96)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    删除平台密钥
                                  </button>
                                </form>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          padding: "16px 18px",
                          borderRadius: 18,
                          border: "1px dashed rgba(255,255,255,0.16)",
                          color: "rgba(201,208,221,0.78)",
                          background: "rgba(7,11,17,0.38)",
                        }}
                      >
                        <strong style={{ color: "rgba(245,247,250,0.94)" }}>
                          {resolvedBundleBillingMode
                            ? "当前 bundle 还没有平台密钥。"
                            : "当前 bundle 缺少正式计费模式，暂不能创建平台密钥。"}
                        </strong>
                        {!resolvedBundleBillingMode ? (
                          <span className="nt-text-sm nt-text-muted">先为 bundle 补设计费模式，再按对应模式创建平台密钥。</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </NtCard>
              );
            })}
            {catalog.bundles.length === 0 ? (
              <NtCard className="nt-card--outlined">
                <span className="nt-text-sm nt-text-muted">当前还没有 Access Bundle。</span>
              </NtCard>
            ) : null}
          </div>
        </div>
      </NtPanel>
    </div>
  );
}
