import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { getFeatureSnapshot } from "@/lib/core-client";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

import { resolveChatActionAvailability } from "./action-availability";
import { HeavyAgentChatWorkspace } from "./chat-workspace";
import { loadHeavyChatWorkspace } from "./server";

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

  const [publicSurfaceDependency, features] = await Promise.all([
    loadPublicSurfaceDependency(),
    getFeatureSnapshot(),
  ]);
  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "heavyChat", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }
  const actionAvailability = resolveChatActionAvailability(
    features,
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const displayName = session.user.username || session.user.name || "当前用户";
  const workspace = await loadHeavyChatWorkspace({
    userId: session.user.id,
    providerUserId: session.user.providerUserId || undefined,
    username: session.user.username || session.user.name || undefined,
  });

  return (
    <HeavyAgentChatWorkspace
      displayName={displayName}
      initialError={workspace.error}
      initialSnapshot={workspace.workspace}
      initialSlotId={resolvedSearchParams?.slotId ?? null}
      mailboxVisible={actionAvailability.mailbox}
      storeVisible={publicSurfaces.store.enabled}
      taskVisible={actionAvailability.task}
    />
  );
}
