import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { getPublicSurfaceSnapshot } from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function BenefitsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const publicSurfaces = await getPublicSurfaceSnapshot();
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "benefits", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Card className="app-stack">
          <h1 className="mg-title">羊毛派终端已切换为弹窗面板</h1>
          <p className="mg-copy">
            当前 `/benefits` 用作羊毛派弹层的深链接入口。若面板尚未自动打开，请返回控制台后重新点击导航中的“羊毛派”。
          </p>
        </Card>
      </div>
    </main>
  );
}
