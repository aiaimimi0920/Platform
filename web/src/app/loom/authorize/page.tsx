import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { accountRequest } from "@/lib/account-request";
import { getIdentityProvider } from "@/lib/identity-provider";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { loomAuthorizationPath, parseLoomAccountAuthorization } from "@/lib/loom-account-authorization";
import { requirePlatformUserContext } from "@/lib/platform-session";

export const metadata = { title: "Loom 设备登录", referrer: "no-referrer" };

export default async function LoomAuthorizePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const grant = parseLoomAccountAuthorization(await searchParams);
  if (!grant || grant.expiresAtMs <= Date.now() || grant.expiresAtMs > Date.now() + 600_000) {
    return <main className="nt-panel"><h1>Loom 登录请求已失效</h1><p>请回到 Loom 重新发起登录。</p></main>;
  }
  const session = await auth();
  const returnPath = loomAuthorizationPath(grant);
  const fingerprint = createHash("sha256").update(Buffer.from(grant.publicKey, "base64")).digest("hex").slice(0, 16);
  async function login() {
    "use server";
    await signIn(getIdentityProvider(), { redirectTo: returnPath });
  }
  async function localLogin() {
    "use server";
    if (!isDevAuthBypassEnabled()) throw new Error("Local login unavailable");
    await signIn("local-dev", { redirectTo: returnPath, intent: "dev-bypass" });
  }
  async function approve() {
    "use server";
    const userContext = await requirePlatformUserContext();
    // A changed browser account requires a new confirmation page, not a stale form.
    if (userContext.userId !== session?.user?.id) redirect(returnPath);
    await accountRequest("/internal/loom-account/approve", { method: "POST", body: grant, userContext });
    redirect("/loom/authorize/complete");
  }
  return (
    <main className="nt-panel" style={{ maxWidth: 640, margin: "48px auto", padding: 24 }}>
      <h1>Loom 设备登录</h1>
      <p>仅确认你刚刚在 Loom 中发起的请求，并核对设备名称与校验码。</p>
      <dl><dt>设备</dt><dd>{grant.deviceName}</dd><dt>校验码</dt><dd><code>{fingerprint}</code></dd></dl>
      {session?.user?.id ? <>
        <p>使用账号：{session.user.username || session.user.name}</p>
        <p>允许此设备通过 Loom 建立跨设备连接。设备授权最长保留 30 天，可从 Loom 退出登录。</p>
        <form action={approve}><button className="nt-btn nt-btn--primary" type="submit">确认登录此设备</button></form>
      </> : <>
        <form action={login}><button className="nt-btn nt-btn--primary" type="submit">{getIdentityProvider() === "rauthy" ? "使用 Rauthy 登录" : "使用 Linux.do 登录"}</button></form>
        {isDevAuthBypassEnabled() && <form action={localLogin}><button className="nt-btn" type="submit">使用 Local Dev 登录</button></form>}
      </>}
      <p>如果不是你发起的请求，请关闭此页面。</p>
    </main>
  );
}
