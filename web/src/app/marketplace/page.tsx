import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { Card } from "@/components/ui/card";
import { getFeatureSnapshot, isFeatureSnapshotUnavailable } from "@/lib/core-client";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function MarketplacePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const publicSurfaceDependency = await loadPublicSurfaceDependency();
  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "marketplace", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const features = await getFeatureSnapshot();

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Card className="app-stack">
          <h1 className="mg-title">
            {isFeatureSnapshotUnavailable(features)
              ? "小集市入口暂不可用"
              : features.marketplace.enabled
                ? "玩家小集市已切换为弹窗面板"
                : "小集市当前未启用"}
          </h1>
          <p className="mg-copy">
            {isFeatureSnapshotUnavailable(features)
              ? "当前无法读取模块快照，请稍后再试。"
              : features.marketplace.enabled
                ? "当前 `/marketplace` 用作商城弹层中的玩家流转深链接入口。若弹层尚未自动打开，请返回账户终端后重新点击“商城”，再切到“小集市”。"
                : "小集市当前已关闭；若仍需浏览官方售卖条目，请改走 `/products`。"}
          </p>
        </Card>
      </div>
    </main>
  );
}
