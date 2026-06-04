import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function AgentExecutionsPage() {
  const session = await auth();
  redirect(session?.user?.id ? "/dashboard" : "/login");
}
