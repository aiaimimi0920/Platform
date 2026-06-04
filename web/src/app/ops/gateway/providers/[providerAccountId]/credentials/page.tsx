import { redirect } from "next/navigation";

import { buildQueryString } from "../../provider-inventory-ui";

type ProviderCredentialOpsPageProps = {
  params: Promise<{ providerAccountId: string }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
    returnTo?: string;
  }>;
};

function resolveReturnTo(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw.startsWith("/ops/gateway/providers") || raw.startsWith("//")) {
    return "/ops/gateway/providers";
  }
  return raw;
}

export default async function ProviderCredentialOpsPage({
  params,
  searchParams,
}: ProviderCredentialOpsPageProps) {
  const { providerAccountId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const returnTo = resolveReturnTo(query?.returnTo);

  redirect(
    `/ops/gateway/providers/${encodeURIComponent(providerAccountId)}${buildQueryString({
      returnTo,
      status: query?.status,
      message: query?.message,
    })}#credentials`,
  );
}
