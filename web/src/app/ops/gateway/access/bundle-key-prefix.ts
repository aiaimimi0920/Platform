export type BundleBillingMode = "token_prepaid" | "time_pass" | "message_prepaid";
export type BundleCostTypeCode = "tk" | "tm" | "rq";

export function resolveBundleCostTypeCode(billingMode: string): BundleCostTypeCode {
  switch (billingMode) {
    case "time_pass":
      return "tm";
    case "message_prepaid":
      return "rq";
    default:
      return "tk";
  }
}

export function buildBundleDefaultKeyPrefix(bundleId: string, billingMode: string) {
  return `nl_${resolveBundleCostTypeCode(billingMode)}_${bundleId}_`;
}

export function buildBundleDefaultKeyPrefixPreview(billingMode: string) {
  return `nl_${resolveBundleCostTypeCode(billingMode)}_<bundleId>_`;
}
