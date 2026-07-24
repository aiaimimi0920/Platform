import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DependencyState } from "@/components/dependency-state";
import { BenefitCenter } from "@/features/account-benefit-center";
import { createDependencyFailureResult } from "@/lib/dependency-result";
import {
  getFeatureSnapshot,
  getPublicSurfaceSnapshotStrict,
  isFeatureSnapshotUnavailable,
} from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function BenefitsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [publicSurfaceResponse, features] = await Promise.all([
    getPublicSurfaceSnapshotStrict().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    ),
    getFeatureSnapshot(),
  ]);

  if (publicSurfaceResponse.status === "rejected" || isFeatureSnapshotUnavailable(features)) {
    const result = createDependencyFailureResult({
      error:
        publicSurfaceResponse.status === "rejected"
          ? publicSurfaceResponse.reason
          : new Error("Feature snapshot unavailable"),
      message: "权益工作区依赖暂不可用。",
      source: publicSurfaceResponse.status === "rejected" ? "public-surfaces" : "core-features",
      unauthorizedMessage: "当前账户无权读取权益工作区配置。",
    });
    return (
      <main className="app-page">
        <div className="mg-shell app-stack">
          <h1 className="mg-title">我的权益</h1>
          <DependencyState label="权益工作区" result={result} />
        </div>
      </main>
    );
  }

  if (!isPublicSurfaceVisibleForViewer(
    publicSurfaceResponse.value,
    "benefits",
    session.user.id,
    session.user.providerUserId,
  )) {
    redirect("/dashboard");
  }

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <header className="app-stack">
          <h1 className="mg-title">我的权益</h1>
          <p className="mg-copy">按权益族查看已购服务、同步凭证并管理可用额度。</p>
        </header>
        {features.benefits.enabled ? (
          <BenefitCenter
            displayMode="workspace"
            enabled
            storeVisible={publicSurfaceResponse.value.store.enabled && features.product.enabled}
            userId={session.user.id}
          />
        ) : (
          <p className="app-banner app-banner--error">权益模块当前未启用。</p>
        )}
      </div>
    </main>
  );
}
