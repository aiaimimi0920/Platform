import type {
  CredentialAssignmentMode,
  CredentialAssignmentSummaryView,
  CredentialProviderKey,
} from "./credential-pools";
import type {
  GatewayClaudeCodeProviderPayload,
  GatewayCodexCliProviderPayload,
  GatewayOpenAiCompatibleProviderPayload,
  GatewayPromptCacheSummaryView,
  GatewayPromptCacheTrendReportView,
  GatewayProviderAccountPayload,
} from "./ai-gateway";

export const benefitFamilyKeys = ["artificial_intelligence", "network_search", "network_proxy"] as const;

export type BenefitFamilyKey = (typeof benefitFamilyKeys)[number];

export const benefitFamilyTones = ["signal", "cyan", "ink"] as const;

export type BenefitFamilyTone = (typeof benefitFamilyTones)[number];

export const benefitServiceKinds = ["credential_service_v1"] as const;

export type BenefitServiceKind = (typeof benefitServiceKinds)[number];

export const benefitServiceStatuses = ["draft", "active", "archived"] as const;

export type BenefitServiceStatus = (typeof benefitServiceStatuses)[number];

export const benefitGrantSourceTypes = ["purchase", "manual"] as const;

export type BenefitGrantSourceType = (typeof benefitGrantSourceTypes)[number];

export const benefitGrantStatuses = ["active", "revoked"] as const;

export type BenefitGrantStatus = (typeof benefitGrantStatuses)[number];

export const benefitCredentialEntryStatuses = ["available", "assigned", "revoked"] as const;

export type BenefitCredentialEntryStatus = (typeof benefitCredentialEntryStatuses)[number];

export const benefitAssignmentStatuses = ["active", "revoked", "pending"] as const;

export type BenefitAssignmentStatus = (typeof benefitAssignmentStatuses)[number];

export const benefitRefillDeliveryModes = ["direct_credential"] as const;

export type BenefitRefillDeliveryMode = (typeof benefitRefillDeliveryModes)[number];

export const benefitApiDeliveryModes = ["service_proxy", "direct_credential"] as const;

export type BenefitApiDeliveryMode = (typeof benefitApiDeliveryModes)[number];

export type BenefitCredentialServiceConfig = {
  title: string;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  payloadSchemaVersion: string;
  refillDeliveryMode: BenefitRefillDeliveryMode;
  refillModeText: string;
  availabilityLabel: string;
  availabilityText: string;
  apiDeliveryMode: BenefitApiDeliveryMode;
  apiModeText: string;
  apiUrl: string;
  downloadEnabled: boolean;
  downloadUrl: string | null;
  autoGenerateKey?: boolean;
};

export type BenefitProxyCodexPayload = GatewayCodexCliProviderPayload;

export type BenefitProxyClaudeCodePayload = GatewayClaudeCodeProviderPayload;

export type BenefitProxyOpenAiCompatiblePayload = GatewayOpenAiCompatibleProviderPayload;

export type BenefitProxyRelayPayload = GatewayProviderAccountPayload;

export type UpsertBenefitFamilyInput = {
  title: string;
  tone: BenefitFamilyTone;
  description: string | null;
  sortOrder: number;
};

export type UpsertBenefitProductLineInput = {
  familyKey: BenefitFamilyKey;
  name: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  status: string;
};

export type UpsertBenefitServiceInput = {
  familyKey: BenefitFamilyKey;
  productLineId?: string | null;
  serviceKind: BenefitServiceKind;
  status: BenefitServiceStatus;
  title: string;
  sortOrder: number;
  config: BenefitCredentialServiceConfig;
};

export type BenefitFamilyView = {
  key: BenefitFamilyKey;
  title: string;
  tone: BenefitFamilyTone;
  description: string | null;
  sortOrder: number;
  serviceCount: number;
  actionableServiceCount: number;
};

export type BenefitProductLineView = {
  id: string;
  familyKey: BenefitFamilyKey;
  name: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  status: string;
  serviceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BenefitServiceView = {
  id: string;
  familyKey: BenefitFamilyKey;
  productLineId: string | null;
  serviceKind: BenefitServiceKind;
  status: BenefitServiceStatus;
  title: string;
  sortOrder: number;
  config: BenefitCredentialServiceConfig;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type BenefitProductBindingView = {
  id: string;
  serviceId: string;
  productId: string;
  productTitle: string;
  createdByUserId: string | null;
  createdAt: string;
};

export type BenefitProductOptionView = {
  id: string;
  title: string;
  fulfillmentMode: string;
  active: boolean;
};

export type BenefitGrantView = {
  id: string;
  serviceId: string;
  userId: string;
  username: string | null;
  providerUserId: string | null;
  sourceType: BenefitGrantSourceType;
  status: BenefitGrantStatus;
  sourceItemId: string | null;
  sourceOrderId: string | null;
  grantedByUserId: string | null;
  grantedAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  expiresAt: string | null;
  durationDays: number | null;
};

export type BenefitAssignmentView = {
  id: string;
  serviceId: string;
  userId: string;
  username: string | null;
  providerUserId: string | null;
  status: BenefitAssignmentStatus;
  credentialEntryId: string | null;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  credentialSummary: CredentialAssignmentSummaryView | null;
  updatedAt: string;
  assignedAt: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
};

export type BenefitCredentialPoolView = {
  id: string;
  serviceId: string;
  label: string;
  importNote: string | null;
  entryCount: number;
  availableCount: number;
  assignedCount: number;
  revokedCount: number;
  createdByUserId: string | null;
  createdAt: string;
};

export type BenefitUserSearchResult = {
  userId: string;
  username: string;
  providerUserId: string | null;
  email: string | null;
};

export type BenefitServiceCardView = {
  id: string;
  familyKey: BenefitFamilyKey;
  productLineId: string | null;
  serviceKind: BenefitServiceKind;
  status: BenefitServiceStatus;
  title: string;
  sortOrder: number;
  config: BenefitCredentialServiceConfig;
  assignmentStatus: BenefitAssignmentStatus;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  credentialReady: boolean;
  credentialSummary: CredentialAssignmentSummaryView | null;
  downloadEnabled: boolean;
  downloadUrl: string | null;
  grantedSourceTypes: BenefitGrantSourceType[];
  granted: boolean;
  grantExpiresAt: string | null;
};

export type BenefitServiceApiAccessView = {
  serviceId: string;
  apiUrl: string;
  apiKey: string;
  issuedAt: string;
  deliveryMode: Extract<BenefitApiDeliveryMode, "service_proxy">;
};

export type BenefitServicePromptCacheSummaryView = {
  serviceId: string;
  projectId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  summary: GatewayPromptCacheSummaryView;
};

export type BenefitServicePromptCacheTrendReportView = {
  serviceId: string;
  projectId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  report: GatewayPromptCacheTrendReportView;
};

export type BenefitPanelProductLineView = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  services: BenefitServiceCardView[];
};

export type BenefitPanelFamilyView = {
  key: BenefitFamilyKey;
  title: string;
  tone: BenefitFamilyTone;
  description: string | null;
  services: BenefitServiceCardView[];
  productLines: BenefitPanelProductLineView[];
  actionableServiceCount: number;
};

export type BenefitPanelView = {
  families: BenefitPanelFamilyView[];
  summary: {
    actionableFamilyCount: number;
    actionableServiceCount: number;
  };
  generatedAt: string;
};

export type CreateBenefitGrantInput = {
  serviceId: string;
  userId: string;
  durationDays?: number | null;
};

export type BenefitCredentialImportEntryInput = {
  entryLabel: string | null;
  refillCode: string | null;
  apiKey: string | null;
  apiUrl: string | null;
};

export type ImportBenefitCredentialPoolInput = {
  serviceId: string;
  label: string;
  importNote: string | null;
  entries: BenefitCredentialImportEntryInput[];
};

export type BenefitCatalogView = {
  families: BenefitFamilyView[];
  productLines: BenefitProductLineView[];
  services: BenefitServiceView[];
  products: BenefitProductOptionView[];
  productBindings: BenefitProductBindingView[];
  grants: BenefitGrantView[];
  assignments: BenefitAssignmentView[];
  credentialPools: BenefitCredentialPoolView[];
};
