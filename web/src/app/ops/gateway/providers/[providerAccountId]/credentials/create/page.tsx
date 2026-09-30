import { auth } from "@/auth";
import { NtPanel } from "@/components/nt-primitives";
import { getOperatorGatewayProviderAccount } from "@/lib/account-client";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { ProviderCredentialCreateClient } from "../../../provider-credential-create-client";

type ProviderCredentialCreatePageProps = {
  params: Promise<{ providerAccountId: string }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
    returnTo?: string;
  }>;
};

/*
 * Layout runs through the shared `nt-` utilities; the only survivors are the page shell
 * padding and the two token-colored status panel skins, hoisted to module scope.
 */
const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };
const STATUS_PANEL_SUCCESS_STYLE: CSSProperties = {
  borderColor: "var(--neuro-signal-green)",
  background: "var(--neuro-control)",
};
const STATUS_PANEL_DANGER_STYLE: CSSProperties = {
  borderColor: "var(--neuro-danger-red)",
  background: "var(--neuro-control)",
};

function resolveReturnTo(value: string | undefined, providerAccountId: string) {
  const raw = value?.trim() ?? "";
  if (!raw.startsWith("/ops/gateway/providers") || raw.startsWith("//")) {
    return `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}#credentials`;
  }
  return raw;
}

export default async function ProviderCredentialCreatePage({
  params,
  searchParams,
}: ProviderCredentialCreatePageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以新增服务商凭证。")}`);
  }

  const { providerAccountId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const userContext = await requirePlatformOperatorUserContext();
  const { providerAccount } = await getOperatorGatewayProviderAccount(userContext, providerAccountId);
  const returnTo = resolveReturnTo(query?.returnTo, providerAccountId);

  return (
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <section className="nt-stack nt-gap-3">
        <span className="nt-kicker">Operator / AI 网关 / 新增凭证</span>
        <h1 className="nt-flush nt-text-strong nt-text-metric">
          新增凭证
        </h1>
        <div className="nt-flex nt-gap-2_5 nt-wrap">
          <Link className="nt-btn nt-btn--outline" href={returnTo}>
            返回服务商详情
          </Link>
        </div>
      </section>

      {query?.status && query?.message ? (
        <NtPanel
          className="nt-stack nt-gap-2"
          style={query.status === "success" ? STATUS_PANEL_SUCCESS_STYLE : STATUS_PANEL_DANGER_STYLE}
        >
          <span className="nt-kicker">{query.status === "success" ? "操作完成" : "操作失败"}</span>
          <span className={query.status === "success" ? "nt-text-success" : "nt-text-danger"}>{query.message}</span>
        </NtPanel>
      ) : null}

      <ProviderCredentialCreateClient providerAccount={providerAccount} redirectTo={returnTo} />
    </div>
  );
}
