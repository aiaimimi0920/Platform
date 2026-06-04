import { redirect } from "next/navigation";

export default function GatewayPromptCachePage() {
  redirect("/ops/gateway/traces");
}
