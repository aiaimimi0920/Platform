import { auth } from "@/auth";
import { LandingGate } from "@/components/home/landing-gate";
import { SignInButton } from "@/components/sign-in-button";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { cookies } from "next/headers";

type HomePageProps = {
  searchParams?: Promise<{
    auth?: string;
  }>;
};

function normalizeTerminalUid(source: string): string {
  if (/^\d{6,}$/.test(source)) {
    return source;
  }

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 9000000000;
  }

  return String(hash + 1000000000);
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const terminalUid = session?.user?.id
    ? normalizeTerminalUid(session.user.providerUserId || session.user.id)
    : "-";
  const resumeFromReady =
    params?.auth === "success" || cookieStore.get("nl_landing_resume")?.value === "1";

  return (
    <LandingGate
      authenticated={Boolean(session?.user?.id)}
      terminalUid={terminalUid}
      resumeFromReady={resumeFromReady}
      successTarget="/dashboard"
      actionSlot={
        <>
          <SignInButton
            className="app-entry__login-button"
            label="使用 Linux.do 授权登录"
          />
          {isDevAuthBypassEnabled() ? (
            <SignInButton
              className="app-entry__login-button app-entry__login-button--secondary"
              label="使用 Local Dev 登录"
              mode="local-dev"
            />
          ) : null}
        </>
      }
    />
  );
}
