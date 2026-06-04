import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getPublicSurfaceSnapshot } from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

import { HeavyAgentChatWorkspace } from "./chat-workspace";

type HeavyAgentChatPageProps = {
  searchParams?: Promise<{
    slotId?: string;
  }>;
};

export default async function HeavyAgentChatPage({ searchParams }: HeavyAgentChatPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const publicSurfaces = await getPublicSurfaceSnapshot();
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "heavyChat", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const displayName = session.user.username || session.user.name || "当前用户";

  return (
    <HeavyAgentChatWorkspace
      displayName={displayName}
      initialSlotId={resolvedSearchParams?.slotId ?? null}
      mailboxVisible={publicSurfaces.mailbox.enabled}
      storeVisible={publicSurfaces.store.enabled}
    />
  );
}
