import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isPlatformOperatorUserId } from "@/lib/platform-session";

type MyArbitrationsPageProps = {
  searchParams?: Promise<{
    message?: string;
    status?: string;
  }>;
};

export default async function MyArbitrationsPage({ searchParams }: MyArbitrationsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = (searchParams ? await searchParams : undefined) ?? {};
  const status = params.status === "success" || params.status === "error" ? params.status : null;
  const message = params.message?.trim();
  const redirectParams = new URLSearchParams();

  if (status) {
    redirectParams.set("status", status);
  }
  if (message) {
    redirectParams.set("message", message);
  }

  if (isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    const target = redirectParams.size > 0
      ? `/ops/account/arbitrations?${redirectParams.toString()}`
      : "/ops/account/arbitrations";
    redirect(target);
  }

  const fallbackMessage = "仲裁入口当前已收口到运维中心。";
  redirect(
    `/dashboard?status=error&message=${encodeURIComponent(message || fallbackMessage)}`,
  );
}
