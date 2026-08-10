import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PublicSurfaceVisibilityClient } from "@/app/ops/account/surface-visibility/client";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { isPlatformOperatorUserId } from "@/lib/platform-session";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";

export default async function SurfaceVisibilityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const publicSurfaceDependency = await loadPublicSurfaceDependency();
  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }

  return <PublicSurfaceVisibilityClient snapshot={publicSurfaceDependency.data} />;
}
