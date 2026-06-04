import { auth } from "@/auth";
import { NtPanel } from "@/components/nt-primitives";
import { getOperatorGatewayProviderAccount } from "@/lib/account-client";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProviderCredentialCreateClient } from "../../../provider-credential-create-client";

type ProviderCredentialCreatePageProps = {
  params: Promise<{ providerAccountId: string }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
    returnTo?: string;
  }>;
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
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <section style={{ display: "grid", gap: 12 }}>
        <span className="nt-kicker">Operator / AI 网关 / 新增凭证</span>
        <h1 style={{ margin: 0, color: "rgba(243,245,247,0.98)", fontSize: "2rem", lineHeight: 1.1 }}>
          新增凭证
        </h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="nt-btn nt-btn--outline" href={returnTo}>
            返回服务商详情
          </Link>
        </div>
      </section>

      {query?.status && query?.message ? (
        <NtPanel
          style={{
            display: "grid",
            gap: 8,
            borderColor: query.status === "success" ? "rgba(34,197,94,0.22)" : "rgba(244,63,94,0.22)",
            background: query.status === "success" ? "rgba(8,39,24,0.7)" : "rgba(39,11,17,0.72)",
          }}
        >
          <span className="nt-kicker">{query.status === "success" ? "操作完成" : "操作失败"}</span>
          <span style={{ color: query.status === "success" ? "#bbf7d0" : "#fecdd3" }}>{query.message}</span>
        </NtPanel>
      ) : null}

      <ProviderCredentialCreateClient providerAccount={providerAccount} redirectTo={returnTo} />
    </div>
  );
}
