import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isDevAuthBypassProviderUserId, isPlatformOperatorUserId } from "@/lib/platform-session";

type DashboardPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;

  const isOperator = isPlatformOperatorUserId(session.user.id, session.user.providerUserId);
  const isDevBypassSession = isDevAuthBypassProviderUserId(session.user.providerUserId);
  const showOpsCenterFab = isOperator || isDevBypassSession;
  const opsCenterBadge = isDevBypassSession ? "DEV ACCESS" : "OPERATOR ACCESS";
  const opsCenterHint = isDevBypassSession ? "本地调试 / 开发者入口" : "平台管理员入口";

  return (
    <main className="app-page app-page--dashboard">
      <div className="mg-shell app-stack app-stack--dashboard" style={{ paddingBottom: "120px" }}>
        {status && message ? (
          <section style={{ maxWidth: 780 }}>
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </section>
        ) : null}
      </div>
      {showOpsCenterFab ? (
        <div className="nt-dashboard-ops-fab-wrap">
          <Link
            aria-label="进入运维中心"
            className="nt-btn nt-btn--primary nt-dashboard-ops-fab"
            href="/ops/gateway/providers"
            title={opsCenterHint}
          >
            <span className="nt-dashboard-ops-fab__kicker">{opsCenterBadge}</span>
            <span className="nt-dashboard-ops-fab__title">运维中心</span>
            <span className="nt-dashboard-ops-fab__hint">{opsCenterHint}</span>
          </Link>
        </div>
      ) : null}
    </main>
  );
}
