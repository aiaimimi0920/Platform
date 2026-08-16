import type {
  GatewayAccessBalanceMode,
  GatewayAccessBundleBillingMode,
  GatewayAccessKeyKind,
  GatewayAccessKeyOwnerType,
  GatewayAccessKeyStatus,
  GatewayPlatformTier,
} from "./identity";

import type {
  GatewayProviderCapabilityView,
} from "./provider";

export type GatewayPlatformAccessView = {
  id: string;
  providerCapabilityId: string;
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel: string | null;
  platformTier: GatewayPlatformTier;
  status: string;
  operatorWeight: number;
  routingPriority: number;
  enabledForSale: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAccessBundleView = {
  id: string;
  projectId: string | null;
  slug: string;
  displayName: string;
  billingMode: GatewayAccessBundleBillingMode | string;
  status: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAccessBundleItemView = {
  bundleId: string;
  platformAccessId: string;
  createdAt: string;
};

export type GatewayAccessKeyView = {
  id: string;
  ownerType: GatewayAccessKeyOwnerType;
  ownerId: string;
  resolvedProjectId: string;
  resolvedTenantId: string;
  keyKind: GatewayAccessKeyKind;
  status: GatewayAccessKeyStatus | string;
  publicKeyPrefix: string;
  displayName: string;
  token: string | null;
  externalKey: string | null;
  rotatedFromAccessKeyId: string | null;
  legacyGatewayApiKeyId: string | null;
  legacyUserCredentialId: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  metadata: Record<string, unknown> | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAccessKeyBalanceView = {
  accessKeyId: string;
  balanceMode: GatewayAccessBalanceMode | string;
  status: string;
  unlimitedUntil: string | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  totalTokens: number | null;
  remainingTokens: number | null;
  totalMessages: number | null;
  remainingMessages: number | null;
  updatedAt: string;
};

export type GatewayAccessKeyBundleBindingView = {
  accessKeyId: string;
  bundleId: string;
  createdAt: string;
};

export type GatewayAccessKeyAggregateMembershipView = {
  aggregateAccessKeyId: string;
  memberAccessKeyId: string;
  priority: number;
  createdAt: string;
};

export type GatewayAccessCatalogView = {
  providerCapabilities: GatewayProviderCapabilityView[];
  platformAccessRows: GatewayPlatformAccessView[];
  bundles: GatewayAccessBundleView[];
  bundleItems: GatewayAccessBundleItemView[];
  accessKeys: GatewayAccessKeyView[];
  keyBundleBindings: GatewayAccessKeyBundleBindingView[];
  balances: GatewayAccessKeyBalanceView[];
  aggregateMemberships: GatewayAccessKeyAggregateMembershipView[];
};


export type UpsertGatewayPlatformAccessInput = {
  providerCapabilityId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel?: string | null;
  platformTier: GatewayPlatformTier;
  status?: string;
  operatorWeight?: number;
  routingPriority?: number;
  enabledForSale?: boolean;
  notes?: string | null;
};

export type UpsertGatewayAccessBundleInput = {
  projectId?: string | null;
  slug: string;
  displayName: string;
  billingMode: GatewayAccessBundleBillingMode | string;
  status?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ReplaceGatewayAccessBundleItemsInput = {
  platformAccessIds: string[];
};

export type UpsertGatewayAccessKeyInput = {
  ownerType: GatewayAccessKeyOwnerType;
  ownerId: string;
  resolvedProjectId: string;
  resolvedTenantId: string;
  keyKind?: GatewayAccessKeyKind;
  publicKeyPrefix: string;
  displayName: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  bundleIds?: string[] | null;
};

export type GatewayAccessKeyRotateInput = {
  displayName?: string | null;
  expiresAt?: string | null;
};

export type GatewayAccessKeyRevokeInput = {
  reason?: string | null;
};

export type GatewayAccessKeyBalanceAdjustInput = {
  balanceMode?: GatewayAccessBalanceMode;
  unlimitedUntil?: string | null;
  periodStartsAt?: string | null;
  periodEndsAt?: string | null;
  tokenDelta?: number | null;
  messageDelta?: number | null;
  totalTokens?: number | null;
  totalMessages?: number | null;
  status?: string | null;
};

export type ReplaceGatewayAccessKeyAggregateMembershipsInput = {
  memberAccessKeyIds: Array<{
    accessKeyId: string;
    priority?: number | null;
  }>;
};

export type GatewayAccessCandidatePreviewView = {
  requestingAccessKeyId: string;
  sourceAccessKeyId: string;
  platformAccessId: string;
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel: string | null;
  platformTier: GatewayPlatformTier;
  operatorWeight: number;
  routingPriority: number;
  stickyMatched: boolean;
  availableByBalance: boolean;
  balanceMode: string | null;
  remainingTokens: number | null;
  remainingMessages: number | null;
};

export type GatewayRouteDecisionPreviewView = {
  requestingAccessKeyId: string;
  requestedModel: string;
  endpointKind: string;
  stickyMatched: boolean;
  selected: GatewayAccessCandidatePreviewView | null;
  candidates: GatewayAccessCandidatePreviewView[];
};

export type GatewayAccessStickyAffinityView = {
  scope: string;
  model: string;
  requestingAccessKeyId: string;
  sourceAccessKeyId: string;
  platformAccessId: string;
  providerAccountId: string;
  realCredentialRef: string | null;
  expiresAt: string | null;
};
