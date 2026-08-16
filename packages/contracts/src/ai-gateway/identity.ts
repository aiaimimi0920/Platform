import type {
  GatewayRoutePolicyView,
} from "./routing";

export const gatewayTenantStatuses = ["active", "archived"] as const;

export type GatewayTenantStatus = (typeof gatewayTenantStatuses)[number];

export const gatewayProjectStatuses = ["active", "archived"] as const;

export type GatewayProjectStatus = (typeof gatewayProjectStatuses)[number];

export const gatewayApiKeyStatuses = ["active", "revoked"] as const;

export type GatewayApiKeyStatus = (typeof gatewayApiKeyStatuses)[number];

export const gatewayAccessKeyOwnerTypes = ["user", "platform", "project"] as const;

export type GatewayAccessKeyOwnerType = (typeof gatewayAccessKeyOwnerTypes)[number];

export const gatewayAccessKeyKinds = ["normal", "auto_route"] as const;

export type GatewayAccessKeyKind = (typeof gatewayAccessKeyKinds)[number];

export const gatewayAccessKeyStatuses = ["active", "frozen", "revoked", "expired"] as const;

export type GatewayAccessKeyStatus = (typeof gatewayAccessKeyStatuses)[number];

export const gatewayAccessBalanceModes = ["time_pass", "token_prepaid", "message_prepaid"] as const;

export type GatewayAccessBalanceMode = (typeof gatewayAccessBalanceModes)[number];

export const gatewayAccessBundleBillingModes = ["time_pass", "token_prepaid", "message_prepaid"] as const;

export type GatewayAccessBundleBillingMode = (typeof gatewayAccessBundleBillingModes)[number];

export const gatewayPlatformTiers = ["low", "mid", "high"] as const;

export type GatewayPlatformTier = (typeof gatewayPlatformTiers)[number];

export const gatewayProjectSourceKinds = ["manual", "benefit_service_user"] as const;

export type GatewayProjectSourceKind = (typeof gatewayProjectSourceKinds)[number];

export const gatewayTenantSourceKinds = ["manual", "benefit_user"] as const;

export type GatewayTenantSourceKind = (typeof gatewayTenantSourceKinds)[number];

export type GatewayTenantView = {
  id: string;
  slug: string;
  displayName: string;
  status: GatewayTenantStatus;
  ownerUserId: string | null;
  sourceKind: GatewayTenantSourceKind;
  sourceKey: string;
  createdAt: string;
  updatedAt: string;
};

export type GatewayProjectView = {
  id: string;
  tenantId: string;
  slug: string;
  displayName: string;
  status: GatewayProjectStatus;
  sourceKind: GatewayProjectSourceKind;
  sourceKey: string;
  defaultRoutePolicyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayApiKeyView = {
  id: string;
  projectId: string;
  name: string;
  status: GatewayApiKeyStatus;
  issuedAt: string;
  revokedAt: string | null;
  rotatedFromApiKeyId: string | null;
};

export type GatewayProjectApiAccessView = {
  project: GatewayProjectView;
  tenant: GatewayTenantView;
  apiKey: GatewayApiKeyView;
  token: string;
};

export type GatewayBenefitProjectEnsureView = {
  tenant: GatewayTenantView;
  project: GatewayProjectView;
  routePolicy: GatewayRoutePolicyView;
};
