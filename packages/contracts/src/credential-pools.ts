export const credentialProviderKeys = ["platform_a", "platform_b", "platform_c"] as const;

export type CredentialProviderKey = (typeof credentialProviderKeys)[number];

export const credentialStorageModes = ["inline", "r2"] as const;

export type CredentialStorageMode = (typeof credentialStorageModes)[number];

export const credentialScopes = ["public", "private"] as const;

export type CredentialScope = (typeof credentialScopes)[number];

export const credentialLifecycleStatuses = [
  "available",
  "repair",
  "cooling",
  "invalid",
  "death_pending",
  "deleted",
] as const;

export type CredentialLifecycleStatus = (typeof credentialLifecycleStatuses)[number];

export const credentialAssignmentModes = ["sticky", "ephemeral"] as const;

export type CredentialAssignmentMode = (typeof credentialAssignmentModes)[number];

export const credentialAssignmentRecordStatuses = ["active", "released", "revoked"] as const;

export type CredentialAssignmentRecordStatus = (typeof credentialAssignmentRecordStatuses)[number];

export const credentialTerminalStatuses = ["active", "disabled", "revoked"] as const;

export type CredentialTerminalStatus = (typeof credentialTerminalStatuses)[number];

export const credentialUploadTokenKinds = [
  "terminal",
  "shared",
  "operator_import",
  "legacy_benefit_pool",
] as const;

export type CredentialUploadTokenKind = (typeof credentialUploadTokenKinds)[number];

export const credentialRepairClaimStatuses = ["active", "released", "resolved", "expired"] as const;

export type CredentialRepairClaimStatus = (typeof credentialRepairClaimStatuses)[number];

export const credentialDeathJobStatuses = ["pending", "running", "deleted", "failed"] as const;

export type CredentialDeathJobStatus = (typeof credentialDeathJobStatuses)[number];

export type CredentialProviderConfig = {
  key: CredentialProviderKey;
  displayName: string;
  description: string | null;
  healthCheckStrategy: string;
  defaultAssignmentMode: CredentialAssignmentMode;
  payloadSchemaVersion: string;
  supportsRepair: boolean;
  supportsCooldown: boolean;
};

export type CredentialAssignmentSummaryView = {
  serviceId: string;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  credentialReady: boolean;
  credentialEntryId: string | null;
  scope: CredentialScope | null;
  lifecycleStatus: CredentialLifecycleStatus | null;
  maskedSummary: string | null;
  previewLabel: string | null;
  apiUrl: string | null;
  updatedAt: string | null;
};

export type CredentialResolvedPayloadView = {
  serviceId: string;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  credentialEntryId: string | null;
  scope: CredentialScope | null;
  storageMode: CredentialStorageMode | null;
  lifecycleStatus: CredentialLifecycleStatus | null;
  maskedSummary: string | null;
  payload: Record<string, unknown> | null;
  deliveredAt: string;
};

export type CredentialProviderView = CredentialProviderConfig & {
  serviceCount: number;
  terminalCount: number;
  activeEntryCount: number;
  activeAssignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CredentialTerminalView = {
  id: string;
  providerKey: CredentialProviderKey;
  label: string;
  status: CredentialTerminalStatus;
  note: string | null;
  lastSeenAt: string | null;
  lastUploadAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CredentialUploadBatchView = {
  id: string;
  providerKey: CredentialProviderKey;
  benefitServiceId: string | null;
  terminalId: string | null;
  tokenKind: CredentialUploadTokenKind;
  label: string;
  importNote: string | null;
  acceptedCount: number;
  rejectedCount: number;
  inlineCount: number;
  r2Count: number;
  createdByUserId: string | null;
  createdAt: string;
};

export type CredentialEntryView = {
  id: string;
  providerKey: CredentialProviderKey;
  benefitServiceId: string;
  uploadBatchId: string | null;
  sourceTerminalId: string | null;
  storageMode: CredentialStorageMode;
  scope: CredentialScope;
  lifecycleStatus: CredentialLifecycleStatus;
  entryLabel: string | null;
  maskedSummary: string;
  previewLabel: string | null;
  privateUserId: string | null;
  eligibleAfter: string | null;
  invalidReason: string | null;
  deathReason: string | null;
  failureCount: number;
  lastHealthCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CredentialAssignmentOperatorView = {
  id: string;
  benefitServiceId: string;
  userId: string;
  username: string | null;
  providerUserId: string | null;
  credentialEntryId: string | null;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  status: CredentialAssignmentRecordStatus;
  maskedSummary: string | null;
  updatedAt: string;
  assignedAt: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
};

export type CredentialRepairClaimView = {
  id: string;
  credentialEntryId: string;
  benefitServiceId: string;
  status: CredentialRepairClaimStatus;
  claimOwnerType: string;
  claimOwnerKey: string;
  claimedAt: string;
  staleAt: string;
  releasedAt: string | null;
  resolvedAt: string | null;
};

export type CredentialDeathJobView = {
  id: string;
  credentialEntryId: string;
  benefitServiceId: string;
  providerKey: CredentialProviderKey;
  objectKey: string | null;
  status: CredentialDeathJobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CredentialOperatorCatalogView = {
  providers: CredentialProviderView[];
  terminals: CredentialTerminalView[];
  uploadBatches: CredentialUploadBatchView[];
  entries: CredentialEntryView[];
  assignments: CredentialAssignmentOperatorView[];
  repairClaims: CredentialRepairClaimView[];
  deathJobs: CredentialDeathJobView[];
  summary: {
    providerCount: number;
    terminalCount: number;
    availableEntryCount: number;
    repairEntryCount: number;
    coolingEntryCount: number;
    invalidEntryCount: number;
    deathPendingEntryCount: number;
    deletedEntryCount: number;
    activeAssignmentCount: number;
  };
};

export type CredentialTerminalUploadEntryInput = {
  benefitServiceId: string;
  entryLabel?: string | null;
  scope?: CredentialScope;
  privateUserId?: string | null;
  storageMode?: CredentialStorageMode | null;
  payload: Record<string, unknown>;
};

export type CredentialTerminalUploadInput = {
  providerKey: CredentialProviderKey;
  label: string;
  importNote?: string | null;
  entries: CredentialTerminalUploadEntryInput[];
};

export type CredentialOperatorImportInput = CredentialTerminalUploadInput;
