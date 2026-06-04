import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PublicSurfaceVisibilityClient } from "@/app/ops/account/surface-visibility/client";
import { getPublicSurfaceSnapshot } from "@/lib/core-client";
import { isPlatformOperatorUserId } from "@/lib/platform-session";

export default async function SurfaceVisibilityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const snapshot = await getPublicSurfaceSnapshot();

  return <PublicSurfaceVisibilityClient snapshot={snapshot} />;
}
