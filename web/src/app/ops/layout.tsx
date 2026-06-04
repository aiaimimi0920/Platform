import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OpsShell } from "@/components/ops-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { isPlatformOperatorUserId } from "@/lib/platform-session";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  return (
    <OpsShell authActionSlot={<SignOutButton />}>
      {children}
    </OpsShell>
  );
}
