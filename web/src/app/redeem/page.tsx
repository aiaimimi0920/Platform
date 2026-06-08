import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable } from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function RedeemPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const publicSurfaces = await getPublicSurfaceSnapshot();
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "redemption", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }
  const features = await getFeatureSnapshot();
  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">当前无法从 core 读取模块快照，请稍后再试。</p>
          </Card>
        </div>
      </main>
    );
  }
  if (!features.redemption.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">兑换码模块已下架</h1>
            <p className="mg-copy">当前兑换码模块已关闭，暂不提供兑换入口。</p>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mg-shell">
        <Card className="app-stack">
          <h1 className="mg-title">兑换码</h1>
          <p className="mg-copy">输入平台发放的兑换码，领取对应的钱包、资产或服务权益。</p>
          <p className="mg-copy">兑换面板会自动打开；如果没有出现，请点击顶部的“立即兑换”按钮。</p>
        </Card>
      </div>
    </main>
  );
}
