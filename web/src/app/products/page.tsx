import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { Card } from "@/components/ui/card";
import { getFeatureSnapshot, isFeatureSnapshotUnavailable } from "@/lib/core-client";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const publicSurfaceDependency = await loadPublicSurfaceDependency();
  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "store", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const features = await getFeatureSnapshot();

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Card className="app-stack">
          <h1 className="mg-title">
            {isFeatureSnapshotUnavailable(features)
              ? "商城入口暂不可用"
              : features.product.enabled
                ? "商城终端已切换为弹窗面板"
                : "官方货架当前未启用"}
          </h1>
          <p className="mg-copy">
            {isFeatureSnapshotUnavailable(features)
              ? "当前无法读取模块快照，请稍后再试。"
              : features.product.enabled
                ? "当前 `/products` 用作商城弹层的官方售卖深链接入口。若弹层尚未自动打开，请返回账户终端后重新点击右上角“商城”或控制台里的商城入口。"
                : "官方货架当前已关闭；若仍需查看玩家流转资产，请改走 `/marketplace`。"}
          </p>
        </Card>
      </div>
    </main>
  );
}
