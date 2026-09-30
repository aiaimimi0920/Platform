import {
  getOperatorGatewayProviderCredentialFolderSyncStatus,
  getOperatorGatewayProviderModelTiering,
  getOperatorGatewayProviderInventory,
  listOperatorGatewayProviderCredentials,
} from "@/lib/account-client";
import { auth } from "@/auth";
import { NtPanel } from "@/components/nt-primitives";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import {
  buildQueryString,
  formatProviderSurfaceLabel,
  groupProviderInventoryEntries,
  ProviderDetailCard,
} from "../provider-inventory-ui";
import { deleteGatewayProviderAccountAction } from "../actions";
import { ProviderCredentialManagementSection } from "../provider-credentials-ui";
import { ProviderModelTieringSection } from "../provider-model-tiering-ui";

const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };

const DELETE_PROVIDER_BUTTON_STYLE: CSSProperties = { borderColor: "var(--neuro-danger-red)" };

const SUCCESS_NOTICE_STYLE: CSSProperties = {
  borderColor: "var(--neuro-signal-green)",
  background: "var(--neuro-control)",
};

const ERROR_NOTICE_STYLE: CSSProperties = {
  borderColor: "var(--neuro-danger-red)",
  background: "var(--neuro-control)",
};

const CURRENT_SURFACE_BUTTON_STYLE: CSSProperties = { pointerEvents: "none", opacity: 0.92 };

type ProviderDetailPageProps = {
  params: Promise<{ providerAccountId: string }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
    returnTo?: string;
  }>;
};

function resolveReturnTo(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (
    raw.startsWith("//") ||
    (!raw.startsWith("/ops/gateway/providers") && !raw.startsWith("/ops/gateway/access"))
  ) {
    return "/ops/gateway/providers";
  }
  return raw;
}

export default async function GatewayProviderDetailPage({
  params,
  searchParams,
}: ProviderDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关服务商详情。")}`);
  }

  const { providerAccountId } = await params;
  const pageParams = searchParams ? await searchParams : undefined;
  const userContext = await requirePlatformOperatorUserContext();
  const [inventory, { credentials }, folderSyncStatus, providerModelTieringResult] = await Promise.all([
    getOperatorGatewayProviderInventory(userContext),
    listOperatorGatewayProviderCredentials(userContext, providerAccountId, { maskSecrets: true }),
    getOperatorGatewayProviderCredentialFolderSyncStatus(userContext),
    getOperatorGatewayProviderModelTiering(userContext, providerAccountId)
      .then((tiering) => ({
        tiering,
        loadError: null as string | null,
      }))
      .catch((error) => ({
        tiering: null,
        loadError:
          error instanceof Error && error.message.trim()
            ? `服务端模型定级暂时不可用：${error.message.trim()}`
            : "服务端模型定级暂时不可用，请稍后重试。",
      })),
  ]);
  const entry = (inventory.providers ?? []).find((item) => item.providerAccount.id === providerAccountId) ?? null;
  const returnTo = resolveReturnTo(pageParams?.returnTo);

  if (!entry) {
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}status=error&message=${encodeURIComponent("未找到对应的服务商详情。")}`,
    );
  }

  const providerFamily = groupProviderInventoryEntries(inventory.providers ?? []).find((group) =>
    group.entries.some((item) => item.providerAccount.id === providerAccountId),
  );
  const detailRedirect = `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}${buildQueryString({
    returnTo,
  })}`;
  const credentialHref = `${detailRedirect}#credentials`;
  const returnLabel = returnTo.startsWith("/ops/gateway/access") ? "返回 Access 控制" : "返回服务商";

  return (
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <section className="nt-stack nt-gap-3">
        <span className="nt-kicker">Operator / AI 网关 / 服务商详情</span>
        <h1 className="nt-flush nt-text-strong nt-text-metric">
          {entry.providerAccount.label}
        </h1>
        <div className="nt-flex nt-wrap nt-gap-2_5">
          <Link className="nt-btn nt-btn--outline" href={returnTo}>
            {returnLabel}
          </Link>
          <form action={deleteGatewayProviderAccountAction}>
            <input name="providerAccountId" type="hidden" value={providerAccountId} />
            <input name="redirectTo" type="hidden" value={returnTo} />
            <button
              className="nt-btn nt-btn--outline nt-text-danger"
              style={DELETE_PROVIDER_BUTTON_STYLE}
              type="submit"
            >
              删除服务商
            </button>
          </form>
        </div>
      </section>

      {pageParams?.status && pageParams?.message ? (
        <NtPanel
          className="nt-stack nt-gap-2"
          style={pageParams.status === "success" ? SUCCESS_NOTICE_STYLE : ERROR_NOTICE_STYLE}
        >
          <span className="nt-kicker">{pageParams.status === "success" ? "操作完成" : "操作失败"}</span>
          <span className={pageParams.status === "success" ? "nt-text-success" : "nt-text-danger"}>
            {pageParams.message}
          </span>
        </NtPanel>
      ) : null}

      {providerFamily && providerFamily.entries.length > 1 ? (
        <NtPanel className="nt-stack nt-gap-2_5">
          <span className="nt-kicker">同服务商可路由入口</span>
          <span className="nt-text-muted">
            当前 {providerFamily.familyLabel} 在控制面下包含 {providerFamily.entries.length} 个可路由入口。库存页按服务商身份聚合展示，
            详情页仍按单个 endpoint / 协议 / 商品 surface 展开治理。
          </span>
          <div className="nt-flex nt-wrap nt-gap-2_5">
            {providerFamily.entries.map((variant) => {
              const variantHref = `/ops/gateway/providers/${encodeURIComponent(variant.providerAccount.id)}${buildQueryString({
                returnTo,
              })}`;
              const label = formatProviderSurfaceLabel(variant.providerAccount);
              if (variant.providerAccount.id === providerAccountId) {
                return (
                  <span
                    key={variant.providerAccount.id}
                    className="nt-btn nt-btn--primary"
                    style={CURRENT_SURFACE_BUTTON_STYLE}
                  >
                    {label} 当前
                  </span>
                );
              }
              return (
                <Link key={variant.providerAccount.id} className="nt-btn nt-btn--outline" href={variantHref}>
                  {label} 详情
                </Link>
              );
            })}
          </div>
        </NtPanel>
      ) : null}

      <ProviderDetailCard entry={entry} redirectTo={detailRedirect} />
      <ProviderModelTieringSection
        providerAccountId={providerAccountId}
        redirectTo={detailRedirect}
        tiering={providerModelTieringResult.tiering}
        loadError={providerModelTieringResult.loadError}
      />
      <ProviderCredentialManagementSection
        providerAccountId={providerAccountId}
        providerAdapter={entry.providerAccount.adapter}
        redirectTo={credentialHref}
        credentials={credentials}
        folderSyncStatus={folderSyncStatus}
      />
    </div>
  );
}
