import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { RedemptionCodeView, RedemptionCodeUsageView, ProductOperatorView } from "@neuro/contracts";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { listOperatorRedemptionCodes, listOperatorRedemptionCodeUsages, listOperatorProducts } from "@/lib/core-client";

import { RedemptionCodesOpsClient } from "./client";

type PageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    usages?: string;
    edit?: string;
  }>;
};

export default async function RedemptionCodesOpsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) redirect("/dashboard");

  const userContext = await requirePlatformOperatorUserContext();
  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const usagesCodeId = params?.usages ?? null;
  const editCodeId = params?.edit ?? null;

  let codes: RedemptionCodeView[] = [];
  let usages: RedemptionCodeUsageView[] = [];
  let products: ProductOperatorView[] = [];
  let loadError: string | null = null;

  try {
    const [codesRes, productsRes] = await Promise.all([
      listOperatorRedemptionCodes(userContext),
      listOperatorProducts(userContext).catch(() => [] as ProductOperatorView[]),
    ]);
    codes = codesRes.codes;
    products = Array.isArray(productsRes) ? productsRes : (productsRes as { products: ProductOperatorView[] }).products ?? [];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "加载失败";
  }

  if (usagesCodeId) {
    try {
      const response = await listOperatorRedemptionCodeUsages(userContext, usagesCodeId);
      usages = response.usages;
    } catch { /* keep empty */ }
  }

  return (
    <RedemptionCodesOpsClient
      codes={codes}
      usages={usages}
      usagesCodeId={usagesCodeId}
      editCodeId={editCodeId}
      status={status}
      message={message}
      loadError={loadError}
      products={products}
    />
  );
}
