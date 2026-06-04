import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { MailboxRoutePlaceholder } from "@/features/mailbox";
import { getPublicSurfaceSnapshot } from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export default async function MailboxPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const publicSurfaces = await getPublicSurfaceSnapshot();
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "mailbox", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  return <MailboxRoutePlaceholder />;
}
