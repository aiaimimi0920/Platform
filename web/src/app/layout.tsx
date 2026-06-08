import type { Metadata } from "next";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getFeatureSnapshot, getPublicSurfaceSnapshot } from "@/lib/core-client";
import { applyPublicSurfaceVisibilityForViewer } from "@/lib/public-surface-visibility";
import "@/app/globals.css";
import "@/features/account-announcement-center/styles.css";
import "@/features/account-benefit-center/styles.css";
import "@/features/account-commerce-center/styles.css";
import "@/features/account-mission-center/styles.css";
import "@/features/account-project-center/styles.css";
import "@/features/account-task-market/styles.css";

export const metadata: Metadata = {
  title: "NeuroLoom",
  description: "Linux.do-only account access terminal for NeuroLoom.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const [features, rawPublicSurfaces] = await Promise.all([getFeatureSnapshot(), getPublicSurfaceSnapshot()]);
  const publicSurfaces = applyPublicSurfaceVisibilityForViewer(
    rawPublicSurfaces,
    session?.user?.id,
    session?.user?.providerUserId,
  );

  return (
    <html lang="zh-CN">
      <body>
        {process.env.ENABLE_FIGMA_CAPTURE === "true" || process.env.NODE_ENV !== "production" ? (
          <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        ) : null}
        <AppShell
          authActionSlot={session?.user?.id ? <SignOutButton /> : <SignInButton />}
          currentUserId={session?.user?.id ?? null}
          features={features}
          publicSurfaces={publicSurfaces}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
