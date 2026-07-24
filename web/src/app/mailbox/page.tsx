import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DependencyState } from "@/components/dependency-state";
import { MailboxCenter } from "@/features/mailbox";
import { createDependencyFailureResult } from "@/lib/dependency-result";
import {
  getFeatureSnapshot,
  getPublicSurfaceSnapshotStrict,
  isFeatureSnapshotUnavailable,
} from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function MailboxPage() {
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
      message: "邮箱工作区依赖暂不可用。",
      source: publicSurfaceResponse.status === "rejected" ? "public-surfaces" : "core-features",
      unauthorizedMessage: "当前账户无权读取邮箱工作区配置。",
    });
    return (
      <main className="app-page">
        <div className="mg-shell app-stack">
          <h1 className="mg-title">邮箱</h1>
          <DependencyState label="邮箱工作区" result={result} />
        </div>
      </main>
    );
  }

  if (!isPublicSurfaceVisibleForViewer(
    publicSurfaceResponse.value,
    "mailbox",
    session.user.id,
    session.user.providerUserId,
  )) {
    redirect("/dashboard");
  }

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <header className="app-stack">
          <h1 className="mg-title">邮箱</h1>
          <p className="mg-copy">查看站内消息、管理收藏并领取邮件附件。</p>
        </header>
        {features.mailbox.enabled ? (
          <MailboxCenter displayMode="workspace" enabled userId={session.user.id} />
        ) : (
          <p className="app-banner app-banner--error">邮箱模块当前未启用。</p>
        )}
      </div>
    </main>
  );
}
