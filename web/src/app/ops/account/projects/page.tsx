import { redirect } from "next/navigation";

type LegacyProjectsOpsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyProjectsOpsPage({ searchParams }: LegacyProjectsOpsPageProps) {
  const params = (await searchParams) ?? {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.trim().length > 0) {
      query.set(key, value);
    }
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/ops/account/honor-projects${suffix}`);
}
