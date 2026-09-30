import { auth } from "@/auth";
import { GatewayDependencyUnavailableCard } from "@/components/gateway-dependency-unavailable-card";
import {
  getGatewayAccessCatalog,
  getOperatorGatewayProviderInventory,
  type GatewayAccessCatalogView,
} from "@/lib/account-client";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { NtBadge, NtCard, NtPanel, type NtBadgeTone } from "@/components/nt-primitives";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

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

/*
 * Layout and color run through the shared `nt-` utility layer; these constants keep only what
 * the vocabulary has no class for — the one-off geometry, the platform-key card tracks, the
 * overrides that must beat the `.nt-btn` cascade — with every color resolved to a neuro token.
 * Module scope means one allocation per process instead of one per render.
 */
const FALLBACK_HEADER_TEXT_STYLE: CSSProperties = { maxWidth: 760 };

const HEADER_TEXT_STYLE: CSSProperties = { maxWidth: 720 };

const STATUS_BANNER_SUCCESS_STYLE: CSSProperties = {
  border: "1px solid var(--neuro-signal-green)",
  background: "var(--neuro-control)",
};

const STATUS_BANNER_DANGER_STYLE: CSSProperties = {
  border: "1px solid var(--neuro-danger-red)",
  background: "var(--neuro-control)",
};

const CODE_VALUE_STYLE: CSSProperties = {
  display: "block",
  padding: "8px 10px",
  borderRadius: 12,
  background: "var(--neuro-control)",
  border: "1px solid var(--neuro-line)",
  wordBreak: "break-all",
  fontSize: "0.84rem",
};

const DANGER_BUTTON_STYLE: CSSProperties = {
  borderColor: "var(--neuro-danger-red)",
  color: "var(--neuro-danger-text)",
};

const BUNDLE_DELETE_BUTTON_STYLE: CSSProperties = {
  ...DANGER_BUTTON_STYLE,
  flex: "0 0 auto",
};

const PLATFORM_KEY_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 380px))",
  justifyContent: "start",
};

const PLATFORM_KEY_CARD_STYLE: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: "1px solid var(--neuro-line)",
  background: "var(--neuro-surface)",
};

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
    <code className="nt-text-strong" style={CODE_VALUE_STYLE}>
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
    <NtCard style={status === "success" ? STATUS_BANNER_SUCCESS_STYLE : STATUS_BANNER_DANGER_STYLE}>
      <div className="nt-flex nt-justify-between nt-items-center nt-gap-3 nt-wrap">
        <div className="nt-stack nt-gap-1">
          <NtBadge tone={status === "success" ? "success" : "danger"}>
            {status === "success" ? "操作成功" : "操作失败"}
          </NtBadge>
          <span className="nt-text-strong">{message}</span>
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
  const [catalogResult, providerInventoryResult] = await Promise.allSettled([
    getGatewayAccessCatalog(userContext),
    getOperatorGatewayProviderInventory(userContext),
  ]);

  if (catalogResult.status === "rejected" || providerInventoryResult.status === "rejected") {
    let dependencyError: unknown;
    if (catalogResult.status === "rejected") {
      dependencyError = catalogResult.reason;
    } else if (providerInventoryResult.status === "rejected") {
      dependencyError = providerInventoryResult.reason;
    }
    const notice = buildGatewayDependencyUnavailableNotice(dependencyError, {
      resourceName: "Access Bundle 与平台密钥目录",
      continuation: "Bundle、平台密钥和访问矩阵暂不可编辑；其他运营页面仍可继续使用。",
    });

    return (
      <div className="nt-stack nt-gap-6">
        <StatusBanner status={query.status} message={query.message} />
        <NtPanel>
          <div className="nt-stack nt-gap-4">
            <div className="nt-stack nt-gap-1" style={FALLBACK_HEADER_TEXT_STYLE}>
              <span className="nt-kicker">Bundle</span>
              <h1 className="nt-flush nt-text-strong">Bundle 与平台密钥</h1>
              <span className="nt-text-sm nt-text-muted">
                页面已降级为只读提示，避免 AI Gateway 离线时整页 500。
              </span>
            </div>
            <GatewayDependencyUnavailableCard
              notice={notice}
              action={{ href: "/ops/gateway/providers/create", label: "打开创建服务商模板" }}
            />
          </div>
        </NtPanel>
      </div>
    );
  }

  const catalog = catalogResult.value;
  const providerInventory = providerInventoryResult.value;
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
          <div className="nt-flex nt-justify-between nt-items-start nt-gap-4 nt-wrap">
            <div className="nt-stack nt-gap-1" style={HEADER_TEXT_STYLE}>
              <span className="nt-kicker">Bundle</span>
              <h1 className="nt-flush nt-text-strong">Bundle 与平台密钥</h1>
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
                  className="nt-card--outlined nt-stack nt-gap-3_5 nt-scroll-anchor"
                >
                  <div className="nt-stack nt-gap-3">
                    <div className="nt-stack nt-gap-1 nt-min-0">
                      <strong>{bundle.displayName}</strong>
                    </div>
                    <div className="nt-flex nt-gap-2 nt-items-center nt-scroll-x">
                      <BundleSettingsDialog
                        action={saveGatewayAccessBundleAction}
                        bundle={bundle}
                        redirectTo={bundleRedirectTo}
                        inferredBillingMode={resolvedBundleBillingMode}
                      />
                      <form action={deleteGatewayAccessBundleAction} className="nt-flex nt-flex-none">
                        <input type="hidden" name="redirectTo" value="/ops/gateway/access" />
                        <input type="hidden" name="bundleId" value={bundle.id} />
                        <input type="hidden" name="displayName" value={bundle.displayName} />
                        <button
                          type="submit"
                          className="nt-btn nt-btn--ghost nt-nowrap"
                          style={BUNDLE_DELETE_BUTTON_STYLE}
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
                        />
                      ) : null}
                    </div>
                    <div className="nt-flex nt-gap-2 nt-items-center nt-scroll-x">
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
                      <div className="nt-stack nt-gap-3" style={PLATFORM_KEY_GRID_STYLE}>
                        {platformKeys.map((key) => {
                          const balance = balanceByKeyId.get(key.id) ?? null;
                          const keyBillingMode =
                            (isGatewayBundleBillingMode(balance?.balanceMode) ? balance?.balanceMode : resolvedBundleBillingMode) ?? null;
                          return (
                            <div key={key.id} className="nt-stack nt-gap-2_5" style={PLATFORM_KEY_CARD_STYLE}>
                              <div className="nt-flex nt-justify-between nt-items-start nt-gap-2_5">
                                <div className="nt-stack nt-gap-1">
                                  <strong>{displayPlatformKeyTitle(key.displayName)}</strong>
                                </div>
                                <NtBadge tone={toneForStatus(key.status)}>{key.status}</NtBadge>
                              </div>
                              <div className="nt-stack nt-gap-1">
                                <span className="nt-kicker">分发凭证</span>
                                <CodeValue value={key.token ?? key.externalKey ?? null} />
                              </div>
                              <div className="nt-stack nt-gap-1_5">
                                <div className="nt-kicker">额度</div>
                                {balance ? (
                                  <div className="nt-stack nt-gap-1">
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
                              <div className="nt-flex nt-justify-end nt-gap-2_5 nt-wrap">
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
                                <form action={deleteGatewayBundlePlatformKeyAction} className="nt-flex">
                                  <input type="hidden" name="redirectTo" value={bundleRedirectTo} />
                                  <input type="hidden" name="accessKeyId" value={key.id} />
                                  <input type="hidden" name="displayName" value={displayPlatformKeyTitle(key.displayName)} />
                                  <button
                                    type="submit"
                                    className="nt-btn nt-btn--ghost nt-nowrap"
                                    style={DANGER_BUTTON_STYLE}
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
                      <div className="nt-stack nt-gap-2_5 nt-text-muted nt-dashed-tile">
                        <strong className="nt-text-strong">
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
