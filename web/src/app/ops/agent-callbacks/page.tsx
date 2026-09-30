import { redirect } from "next/navigation";

type LegacyAgentCallbacksOpsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyAgentCallbacksOpsPage({
  searchParams,
}: LegacyAgentCallbacksOpsPageProps) {
  const params = (await searchParams) ?? {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (typeof entry === "string" && entry.trim()) {
        query.append(key, entry);
      }
    }
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  redirect(`/ops/account/agents${suffix}`);
}
