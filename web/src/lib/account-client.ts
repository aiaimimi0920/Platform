import type {
  AccountAnnouncementStatus,
  AccountAnnouncementTone,
  AccountAnnouncementSection,
  AccountAnnouncementView,
  BenefitAssignmentStatus,
  BenefitAssignmentView,
  BenefitApiDeliveryMode,
  BenefitCatalogView,
  BenefitCredentialServiceConfig,
  BenefitCredentialImportEntryInput,
  BenefitCredentialPoolView,
  BenefitFamilyKey,
  BenefitPanelFamilyView,
  BenefitPanelView,
  BenefitProductBindingView,
  BenefitRefillDeliveryMode,
  BenefitServiceApiAccessView,
  BenefitServicePromptCacheSummaryView,
  BenefitServicePromptCacheTrendReportView,
  BenefitServiceStatus,
  BenefitServiceView,
  BenefitUserSearchResult,
  CreateBenefitGrantInput,
  CredentialAssignmentMode,
  CredentialAssignmentOperatorView,
  CredentialAssignmentSummaryView,
  CredentialDeathJobView,
  CredentialEntryView,
  CredentialOperatorCatalogView,
  CredentialProviderKey,
  CredentialProviderView,
  CredentialRepairClaimView,
  CredentialResolvedPayloadView,
  CredentialScope,
  CredentialStorageMode,
  CredentialTerminalUploadInput,
  CredentialTerminalView,
  CredentialUploadBatchView,
  ImportBenefitCredentialPoolInput,
  AgentExecutionOwnerReliefRunActionView,
  AgentExecutionOwnerReliefHandoffDefaultView,
  AgentExecutionOwnerReliefRunHandoffView,
  AgentExecutionOwnerReliefRunHandoffTargetType,
  AgentExecutionOwnerReliefRunView,
  ArchiveReadMailboxMessagesResult,
  ClaimAllMailboxAttachmentsResult,
  ClaimMailboxAttachmentInput,
  ClaimMailboxMessageAttachmentsResult,
  DeleteMailboxMessageResult,
  EmailIdentityView,
  EmailIdentityVerificationView,
  EmailNativeInboundMessageView,
  EmailNativePanelView,
  EmailProviderInboundMessageView,
  InternalUserContext,
  LinuxDoUpsertInput,
  LinuxDoUpsertResult,
  ListAgentExecutionOwnerReliefRunsInput,
  PublicUserProfile,
  MailboxOpsAttachmentInput,
  MailboxOpsRecipientBatchView,
  MailboxMessageView,
  MailboxOpsCampaignDeliveryView,
  MailboxOpsCampaignDispatchResult,
  MailboxOpsCampaignView,
  MailboxOpsTemplateView,
  ListMailboxOpsCampaignsInput,
  ListMailboxOpsRecipientBatchesInput,
  ListMailboxOpsTemplatesInput,
  NotificationWebhookIncidentBatchActionResult,
  NotificationWebhookCatalogView,
  NotificationWebhookIncidentControlResult,
  NotificationWebhookIncidentListView,
  NotificationWebhookIncidentSavedView,
  CreateNotificationWebhookIncidentSavedViewInput,
  ListNotificationWebhookIncidentSavedViewsInput,
  MissionCardView,
  MissionClaimResult,
  MissionCheckinWagerResult,
  MissionDefinitionView,
  MissionPanelView,
  MissionTabKey,
  HonorProjectCatalogView,
  HonorProjectInvestmentView,
  HonorProjectMembershipStatus,
  HonorProjectMembershipView,
  HonorProjectPanelView,
  HonorProjectShowcaseView,
  HonorProjectStatus,
  HonorProjectView,
  JoinHonorProjectInput,
  SponsorHonorProjectInput,
  UpsertHonorProjectInput,
  UpsertHonorProjectInvestmentInput,
  ReputationBreakdown,
  ReputationHistoryPoint,
  ReputationSummary,
  RecordAgentExecutionOwnerReliefRunActionInput,
  OpenAgentExecutionOwnerReliefRunHandoffInput,
  StartEmailIdentityVerificationInput,
  StartEmailIdentityVerificationResult,
  ConfirmEmailIdentityVerificationInput,
  ConfirmEmailIdentityVerificationResult,
  ResolveAgentExecutionOwnerReliefRunHandoffInput,
  FinalizeAgentExecutionOwnerReliefRunInput,
  SetMailboxMessageFavoriteResult,
  StartAgentExecutionOwnerReliefRunInput,
  UpsertMailboxOpsRecipientBatchInput,
  UpsertMailboxOpsCampaignInput,
  UpsertMailboxOpsTemplateInput,
  UpsertAccountAnnouncementInput,
  UpsertBenefitFamilyInput,
  UpsertBenefitProductLineInput,
  BenefitProductLineView,
  UpsertBenefitServiceInput,
  UpsertMissionDefinitionInput,
  UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
  UserSummary,
  UpdateUserProfileInput,
  GatewayProviderInventoryEntryView,
  GatewayProviderInventorySummaryView,
  GatewayProviderInventoryView,
  GatewayProviderModelTieringCardView,
  GatewayProviderModelTieringSource,
  GatewayProviderModelTieringView,
  GatewayProviderAccountView,
  GatewayProviderCredentialFolderSyncStatusView,
  GatewayProviderCredentialView,
  GatewayProviderQuotaView,
  GatewayProviderQuotaWindowView,
  GatewayProviderSourceView,
  GatewayProviderSourceProfile,
  GatewayProviderSourceProfileBackfillResult,
  GatewayRouteTraceCandidate,
  GatewayRequestStatus,
  GatewayRequestAuditView,
  GatewayRequestArtifactsView,
  GatewayRequestAuditSummaryView,
  GatewayConversationArchiveView,
  GatewayConversationArchiveArtifactsView,
  GatewayConversationArchiveExportView,
  GatewayConversationDatasetExportView,
  GatewayProviderCredentialModelStateView,
  GatewayUsageAggregateBucketView,
  GatewayUsageAggregateSummaryView,
  GatewayModelAliasView,
  GatewayModelAssociationMatrixView,
  GatewayCostOverviewView,
  GatewayAccessCatalogView,
  GatewayAccessCandidatePreviewView,
  GatewayRouteDecisionPreviewView,
  GatewayAccessStickyAffinityView,
  GatewayAccessBundleItemView,
  GatewayAccessBundleView,
  GatewayAccessKeyAggregateMembershipView,
  GatewayAccessKeyBundleBindingView,
  GatewayAccessKeyBalanceView,
  GatewayAccessKeyView,
  GatewayPlatformAccessView,
  GatewayProviderCapabilityView,
  PatchGatewayProviderCredentialInput,
  PatchGatewayProviderModelPricingInput,
  PatchGatewayProviderSourceProfileInput,
  UpsertGatewayModelAliasInput,
  UpsertGatewayProviderCredentialInput,
  UpsertGatewayProviderAccountInput,
  WalletExchangeInput,
  WalletExchangeResult,
  WalletPanelView,
  WalletSummary,
} from "@neuro/contracts";
import { accountRequest } from "@/lib/account-request";
import { gatewayRequest } from "@/lib/gateway-request";

export type {
  AccountAnnouncementSection,
  AccountAnnouncementStatus,
  AccountAnnouncementTone,
  AccountAnnouncementView,
  BenefitAssignmentStatus,
  BenefitAssignmentView,
  BenefitApiDeliveryMode,
  BenefitCatalogView,
  BenefitCredentialServiceConfig,
  BenefitCredentialImportEntryInput,
  BenefitCredentialPoolView,
  BenefitFamilyKey,
  BenefitPanelFamilyView,
  BenefitPanelView,
  BenefitProductBindingView,
  BenefitRefillDeliveryMode,
  BenefitServiceApiAccessView,
  BenefitServicePromptCacheSummaryView,
  BenefitServicePromptCacheTrendReportView,
  BenefitServiceStatus,
  BenefitServiceView,
  BenefitUserSearchResult,
  CreateBenefitGrantInput,
  CredentialAssignmentMode,
  CredentialAssignmentOperatorView,
  CredentialAssignmentSummaryView,
  CredentialDeathJobView,
  CredentialEntryView,
  CredentialOperatorCatalogView,
  CredentialProviderKey,
  CredentialProviderView,
  CredentialRepairClaimView,
  CredentialResolvedPayloadView,
  CredentialScope,
  CredentialStorageMode,
  CredentialTerminalUploadInput,
  CredentialTerminalView,
  CredentialUploadBatchView,
  ImportBenefitCredentialPoolInput,
  AgentExecutionOwnerReliefRunActionView,
  AgentExecutionOwnerReliefHandoffDefaultView,
  AgentExecutionOwnerReliefRunView,
  MailboxOpsAttachmentInput,
  MailboxOpsRecipientBatchView,
  MailboxOpsCampaignDeliveryView,
  MailboxOpsCampaignDispatchResult,
  MailboxOpsCampaignView,
  MailboxOpsTemplateView,
  NotificationWebhookIncidentBatchActionResult,
  NotificationWebhookCatalogView,
  NotificationWebhookIncidentControlResult,
  NotificationWebhookIncidentListView,
  NotificationWebhookIncidentSavedView,
  CreateNotificationWebhookIncidentSavedViewInput,
  ListAgentExecutionOwnerReliefRunsInput,
  ListMailboxOpsCampaignsInput,
  ListMailboxOpsRecipientBatchesInput,
  ListMailboxOpsTemplatesInput,
  ListNotificationWebhookIncidentSavedViewsInput,
  MissionCardView,
  MissionClaimResult,
  MissionCheckinWagerResult,
  MissionDefinitionView,
  MissionPanelView,
  MissionTabKey,
  HonorProjectCatalogView,
  HonorProjectInvestmentView,
  HonorProjectMembershipStatus,
  HonorProjectMembershipView,
  HonorProjectPanelView,
  HonorProjectShowcaseView,
  HonorProjectStatus,
  HonorProjectView,
  JoinHonorProjectInput,
  SponsorHonorProjectInput,
  UpsertHonorProjectInput,
  UpsertHonorProjectInvestmentInput,
  RecordAgentExecutionOwnerReliefRunActionInput,
  EmailIdentityView,
  EmailIdentityVerificationView,
  EmailNativeInboundMessageView,
  EmailNativePanelView,
  EmailProviderInboundMessageView,
  FinalizeAgentExecutionOwnerReliefRunInput,
  StartEmailIdentityVerificationInput,
  StartEmailIdentityVerificationResult,
  ConfirmEmailIdentityVerificationInput,
  ConfirmEmailIdentityVerificationResult,
  StartAgentExecutionOwnerReliefRunInput,
  UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
  UpsertAccountAnnouncementInput,
  UpsertBenefitFamilyInput,
  UpsertBenefitServiceInput,
  UpsertMailboxOpsRecipientBatchInput,
  UpsertMailboxOpsCampaignInput,
  UpsertMailboxOpsTemplateInput,
  UpsertMissionDefinitionInput,
  WalletPanelView,
  GatewayProviderInventoryEntryView,
  GatewayProviderInventorySummaryView,
  GatewayProviderInventoryView,
  GatewayProviderModelTieringCardView,
  GatewayProviderModelTieringSource,
  GatewayProviderModelTieringView,
  GatewayProviderAccountView,
  GatewayProviderCredentialFolderSyncStatusView,
  GatewayProviderCredentialView,
  GatewayProviderQuotaView,
  GatewayProviderQuotaWindowView,
  GatewayProviderSourceView,
  GatewayProviderSourceProfile,
  GatewayProviderSourceProfileBackfillResult,
  GatewayRouteTraceCandidate,
  GatewayRequestStatus,
  GatewayRequestAuditView,
  GatewayRequestArtifactsView,
  GatewayRequestAuditSummaryView,
  GatewayConversationArchiveView,
  GatewayConversationArchiveArtifactsView,
  GatewayConversationArchiveExportView,
  GatewayConversationDatasetExportView,
  GatewayProviderCredentialModelStateView,
  GatewayUsageAggregateBucketView,
  GatewayUsageAggregateSummaryView,
  GatewayModelAliasView,
  GatewayModelAssociationMatrixView,
  GatewayCostOverviewView,
  GatewayAccessCatalogView,
  GatewayAccessCandidatePreviewView,
  GatewayRouteDecisionPreviewView,
  GatewayAccessStickyAffinityView,
  GatewayAccessBundleItemView,
  GatewayAccessBundleView,
  GatewayAccessKeyAggregateMembershipView,
  GatewayAccessKeyBundleBindingView,
  GatewayAccessKeyBalanceView,
  GatewayAccessKeyView,
  GatewayPlatformAccessView,
  GatewayProviderCapabilityView,
  PatchGatewayProviderCredentialInput,
  PatchGatewayProviderModelPricingInput,
  PatchGatewayProviderSourceProfileInput,
  UpsertGatewayModelAliasInput,
  UpsertGatewayProviderCredentialInput,
  UpsertGatewayProviderAccountInput,
} from "@neuro/contracts";

export async function getPublicUserProfile(username: string) {
  const response = await accountRequest<{ profile: PublicUserProfile | null }>(`/v1/public/users/${encodeURIComponent(username)}`);
  return response.profile;
}

export async function upsertLinuxDoUser(profile: LinuxDoUpsertInput): Promise<LinuxDoUpsertResult> {
  return accountRequest<LinuxDoUpsertResult>("/internal/identity/linuxdo-upsert", {
    method: "POST",
    body: profile,
  });
}

export async function getCurrentUser(userContext: InternalUserContext) {
  const response = await accountRequest<{ user: UserSummary | null }>("/v1/me", {
    userContext,
  });
  return response.user;
}

export async function getWalletPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: WalletPanelView }>("/v1/me/wallet/panel", {
    userContext,
  });
  return response.panel;
}

export async function getEmailNativePanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: EmailNativePanelView }>("/v1/me/email-native", {
    userContext,
  });
  return response.panel;
}

export async function startEmailIdentityVerification(
  userContext: InternalUserContext,
  payload: StartEmailIdentityVerificationInput,
) {
  return accountRequest<StartEmailIdentityVerificationResult>("/v1/me/email-native/verify/start", {
    method: "POST",
    userContext,
    body: payload,
  });
}

export async function confirmEmailIdentityVerification(
  userContext: InternalUserContext,
  payload: ConfirmEmailIdentityVerificationInput,
) {
  return accountRequest<ConfirmEmailIdentityVerificationResult>("/v1/me/email-native/verify/confirm", {
    method: "POST",
    userContext,
    body: payload,
  });
}

export async function setPrimaryEmailIdentity(userContext: InternalUserContext, identityId: string) {
  const response = await accountRequest<{ identity: EmailIdentityView }>(
    `/v1/me/email-native/identities/${encodeURIComponent(identityId)}/primary`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.identity;
}

export async function removeEmailIdentity(userContext: InternalUserContext, identityId: string) {
  return accountRequest<{ removed: true }>(
    `/v1/me/email-native/identities/${encodeURIComponent(identityId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorEmailProviderInboundMessages(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/email-ingress/provider-messages?${params.toString()}`
    : "/v1/internal/email-ingress/provider-messages";
  const response = await accountRequest<{ messages: EmailProviderInboundMessageView[] }>(pathname, {
    userContext,
  });
  return response.messages;
}

export async function retryOperatorEmailProviderInboundMessage(
  userContext: InternalUserContext,
  providerInboundMessageId: string,
) {
  const response = await accountRequest<{ message: EmailProviderInboundMessageView }>(
    `/v1/internal/email-ingress/provider-messages/${encodeURIComponent(providerInboundMessageId)}/retry`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.message;
}

export async function getOperatorGatewayProviderInventory(userContext: InternalUserContext) {
  const response = await gatewayRequest<{ inventory: GatewayProviderInventoryView }>(
    "/v1/internal/gateway/provider-inventory",
    {
      userContext,
    },
  );
  return response.inventory;
}

export async function getOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{
    providerAccount: GatewayProviderAccountView;
    providerQuota: GatewayProviderQuotaView | null;
  }>(`/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}`, {
    userContext,
  });
  return response;
}

export async function getOperatorGatewayProviderModelTiering(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{ result: GatewayProviderModelTieringView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/model-tiering`,
    {
      userContext,
    },
  );
  return response.result;
}

export async function getOperatorGatewayProviderQuota(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/quota`,
    {
      userContext,
    },
  );
  return response.providerQuota;
}

export async function refreshOperatorGatewayProviderQuota(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/quota`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.providerQuota;
}

type GatewayRequestAuditFilterInput = {
  projectId?: string | null;
  routePolicyId?: string | null;
  providerAccountId?: string | null;
  sessionId?: string | null;
  apiKeyId?: string | null;
  responseId?: string | null;
  protocolFamily?: string | null;
  status?: string | null;
  endpointKind?: string | null;
  errorCode?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  fallbackEligible?: boolean | null;
  limit?: number | null;
};

function buildGatewayRequestAuditFilterParams(input?: GatewayRequestAuditFilterInput) {
  const params = new URLSearchParams();
  if (!input) {
    return params;
  }
  const stringEntries = [
    ["projectId", input.projectId],
    ["routePolicyId", input.routePolicyId],
    ["providerAccountId", input.providerAccountId],
    ["sessionId", input.sessionId],
    ["apiKeyId", input.apiKeyId],
    ["responseId", input.responseId],
    ["protocolFamily", input.protocolFamily],
    ["status", input.status],
    ["endpointKind", input.endpointKind],
    ["errorCode", input.errorCode],
    ["createdFrom", input.createdFrom],
    ["createdTo", input.createdTo],
  ] as const;
  for (const [key, value] of stringEntries) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }
  if (typeof input.fallbackEligible === "boolean") {
    params.set("fallbackEligible", input.fallbackEligible ? "true" : "false");
  }
  if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  return params;
}

export async function listOperatorGatewayRequestAudits(
  userContext: InternalUserContext,
  filters?: GatewayRequestAuditFilterInput,
) {
  const params = buildGatewayRequestAuditFilterParams(filters);
  const pathname = params.size ? `/v1/internal/gateway/requests?${params.toString()}` : "/v1/internal/gateway/requests";
  const response = await gatewayRequest<{ requests: GatewayRequestAuditView[] }>(pathname, {
    userContext,
  });
  return response.requests;
}

export async function getOperatorGatewayRequestAuditSummary(
  userContext: InternalUserContext,
  filters?: GatewayRequestAuditFilterInput,
) {
  const params = buildGatewayRequestAuditFilterParams(filters);
  const pathname = params.size
    ? `/v1/internal/gateway/requests/summary?${params.toString()}`
    : "/v1/internal/gateway/requests/summary";
  const response = await gatewayRequest<{ summary: GatewayRequestAuditSummaryView }>(pathname, {
    userContext,
  });
  return response.summary;
}

export async function getOperatorGatewayRequestAudit(
  userContext: InternalUserContext,
  requestAuditId: string,
) {
  const response = await gatewayRequest<{ requestAudit: GatewayRequestAuditView }>(
    `/v1/internal/gateway/requests/${encodeURIComponent(requestAuditId)}`,
    {
      userContext,
    },
  );
  return response.requestAudit;
}

export async function getOperatorGatewayRequestArtifacts(
  userContext: InternalUserContext,
  requestAuditId: string,
) {
  const response = await gatewayRequest<{ artifacts: GatewayRequestArtifactsView }>(
    `/v1/internal/gateway/requests/${encodeURIComponent(requestAuditId)}/artifacts`,
    {
      userContext,
    },
  );
  return response.artifacts;
}

type GatewayConversationArchiveFilterInput = {
  projectId?: string | null;
  userId?: string | null;
  providerAccountId?: string | null;
  providerCredentialRef?: string | null;
  protocolFamily?: string | null;
  protocolProfile?: string | null;
  endpointKind?: string | null;
  requestedModel?: string | null;
  resolvedModel?: string | null;
  status?: string | null;
  failureClass?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number | null;
};

function buildGatewayConversationArchiveFilterParams(input?: GatewayConversationArchiveFilterInput) {
  const params = new URLSearchParams();
  if (!input) {
    return params;
  }
  const stringEntries = [
    ["projectId", input.projectId],
    ["userId", input.userId],
    ["providerAccountId", input.providerAccountId],
    ["providerCredentialRef", input.providerCredentialRef],
    ["protocolFamily", input.protocolFamily],
    ["protocolProfile", input.protocolProfile],
    ["endpointKind", input.endpointKind],
    ["requestedModel", input.requestedModel],
    ["resolvedModel", input.resolvedModel],
    ["status", input.status],
    ["failureClass", input.failureClass],
    ["createdFrom", input.createdFrom],
    ["createdTo", input.createdTo],
  ] as const;
  for (const [key, value] of stringEntries) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }
  if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  return params;
}

export async function listOperatorGatewayConversationArchives(
  userContext: InternalUserContext,
  filters?: GatewayConversationArchiveFilterInput,
) {
  const params = buildGatewayConversationArchiveFilterParams(filters);
  const pathname = params.size
    ? `/v1/internal/gateway/conversation-archives?${params.toString()}`
    : "/v1/internal/gateway/conversation-archives";
  const response = await gatewayRequest<{ archives: GatewayConversationArchiveView[] }>(pathname, {
    userContext,
  });
  return response.archives;
}

export async function getOperatorGatewayConversationArchive(
  userContext: InternalUserContext,
  archiveId: string,
) {
  const response = await gatewayRequest<{ archive: GatewayConversationArchiveView }>(
    `/v1/internal/gateway/conversation-archives/${encodeURIComponent(archiveId)}`,
    {
      userContext,
    },
  );
  return response.archive;
}

export async function getOperatorGatewayConversationArchiveArtifacts(
  userContext: InternalUserContext,
  archiveId: string,
) {
  const response = await gatewayRequest<GatewayConversationArchiveArtifactsView>(
    `/v1/internal/gateway/conversation-archives/${encodeURIComponent(archiveId)}/artifacts`,
    {
      userContext,
    },
  );
  return response;
}

export async function exportOperatorGatewayConversationArchives(
  userContext: InternalUserContext,
  filters?: GatewayConversationArchiveFilterInput,
) {
  const response = await gatewayRequest<{ export: GatewayConversationArchiveExportView }>(
    "/v1/internal/gateway/conversation-archives/export",
    {
      method: "POST",
      body: filters ?? {},
      userContext,
    },
  );
  return response.export;
}

export async function createOperatorGatewayConversationDatasetExport(
  userContext: InternalUserContext,
  input: GatewayConversationArchiveFilterInput & {
    sampleSize?: number | null;
    createdBy?: string | null;
  },
) {
  const response = await gatewayRequest<{ dataset: GatewayConversationDatasetExportView }>(
    "/v1/internal/gateway/conversation-archives/datasets",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.dataset;
}

export async function listOperatorGatewayConversationDatasetExports(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ datasets: GatewayConversationDatasetExportView[] }>(
    "/v1/internal/gateway/conversation-archives/datasets",
    {
      userContext,
    },
  );
  return response.datasets;
}

export async function reviewOperatorGatewayConversationDatasetExport(
  userContext: InternalUserContext,
  datasetId: string,
  input: { action: "approve" | "reject"; reviewerId?: string | null; note?: string | null },
) {
  const response = await gatewayRequest<{ dataset: GatewayConversationDatasetExportView }>(
    `/v1/internal/gateway/conversation-archives/datasets/${encodeURIComponent(datasetId)}/review`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.dataset;
}

export async function publishOperatorGatewayConversationDatasetExport(
  userContext: InternalUserContext,
  datasetId: string,
) {
  const response = await gatewayRequest<{ dataset: GatewayConversationDatasetExportView }>(
    `/v1/internal/gateway/conversation-archives/datasets/${encodeURIComponent(datasetId)}/publish`,
    {
      method: "POST",
      body: {},
      userContext,
    },
  );
  return response.dataset;
}

type GatewayProviderCredentialModelStateFilterInput = {
  providerAccountId?: string | null;
  providerCredentialId?: string | null;
  providerCredentialRef?: string | null;
  protocolProfile?: string | null;
  model?: string | null;
  status?: string | null;
  limit?: number | null;
};

export async function listOperatorGatewayProviderCredentialModelStates(
  userContext: InternalUserContext,
  filters?: GatewayProviderCredentialModelStateFilterInput,
) {
  const params = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }
    if (typeof filters.limit === "number" && Number.isFinite(filters.limit)) {
      params.set("limit", String(Math.max(1, Math.floor(filters.limit))));
    }
  }
  const pathname = params.size
    ? `/v1/internal/gateway/provider-credential-model-states?${params.toString()}`
    : "/v1/internal/gateway/provider-credential-model-states";
  const response = await gatewayRequest<{ states: GatewayProviderCredentialModelStateView[] }>(
    pathname,
    { userContext },
  );
  return response.states;
}

type GatewayUsageAggregateFilterInput = {
  projectId?: string | null;
  userId?: string | null;
  provider?: string | null;
  providerCredentialRef?: string | null;
  model?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number | null;
};

export async function listOperatorGatewayUsageAggregates(
  userContext: InternalUserContext,
  filters?: GatewayUsageAggregateFilterInput,
) {
  const params = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }
    if (typeof filters.limit === "number" && Number.isFinite(filters.limit)) {
      params.set("limit", String(Math.max(1, Math.floor(filters.limit))));
    }
  }
  const pathname = params.size
    ? `/v1/internal/gateway/usage-aggregates?${params.toString()}`
    : "/v1/internal/gateway/usage-aggregates";
  const response = await gatewayRequest<{ buckets: GatewayUsageAggregateBucketView[] }>(pathname, {
    userContext,
  });
  return response.buckets;
}

export async function flushOperatorGatewayUsageAggregates(
  userContext: InternalUserContext,
  input?: { batchSize?: number | null; bucketSeconds?: number | null },
) {
  const response = await gatewayRequest<{
    dequeued: number;
    bucketCount: number;
    buckets: unknown[];
  }>("/v1/internal/gateway/usage-aggregates/flush", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
  return response;
}

export async function summarizeOperatorGatewayUsageAggregates(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ summary: GatewayUsageAggregateSummaryView }>(
    "/v1/internal/gateway/usage-aggregates/summary",
    { userContext },
  );
  return response.summary;
}

export async function getOperatorGatewayModelAssociations(userContext: InternalUserContext) {
  const response = await gatewayRequest<{ matrix: GatewayModelAssociationMatrixView }>(
    "/v1/internal/gateway/model-associations",
    {
      userContext,
    },
  );
  return response.matrix;
}

export async function listOperatorGatewayModelAliases(userContext: InternalUserContext, input?: { projectId?: string | null }) {
  const params = new URLSearchParams();
  if (typeof input?.projectId === "string" && input.projectId.trim()) {
    params.set("projectId", input.projectId.trim());
  }
  const pathname = params.size
    ? `/v1/internal/gateway/model-aliases?${params.toString()}`
    : "/v1/internal/gateway/model-aliases";
  const response = await gatewayRequest<{ modelAliases: GatewayModelAliasView[] }>(pathname, {
    userContext,
  });
  return response.modelAliases;
}

export async function createOperatorGatewayModelAlias(
  userContext: InternalUserContext,
  input: UpsertGatewayModelAliasInput,
) {
  const response = await gatewayRequest<{ modelAlias: GatewayModelAliasView }>(
    "/v1/internal/gateway/model-aliases",
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.modelAlias;
}

export async function updateOperatorGatewayModelAlias(
  userContext: InternalUserContext,
  aliasId: string,
  input: UpsertGatewayModelAliasInput,
) {
  const response = await gatewayRequest<{ modelAlias: GatewayModelAliasView }>(
    `/v1/internal/gateway/model-aliases/${encodeURIComponent(aliasId)}`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.modelAlias;
}

export async function deleteOperatorGatewayModelAlias(
  userContext: InternalUserContext,
  aliasId: string,
) {
  const response = await gatewayRequest<{ deleted: true; modelAlias: GatewayModelAliasView }>(
    `/v1/internal/gateway/model-aliases/${encodeURIComponent(aliasId)}`,
    {
      method: "DELETE",
      userContext,
    },
  );
  return response.modelAlias;
}

export async function getOperatorGatewayCosts(userContext: InternalUserContext) {
  const response = await gatewayRequest<{ overview: GatewayCostOverviewView }>("/v1/internal/gateway/costs", {
    userContext,
  });
  return response.overview;
}

type RustGatewayProviderAccountBody = Omit<UpsertGatewayProviderAccountInput, "sourceProfile"> & {
  sourceKind?: GatewayProviderSourceProfile["sourceKind"];
  aggregatorApiMode?: GatewayProviderSourceProfile["aggregatorApiMode"];
  webReverseAccessMode?: GatewayProviderSourceProfile["webReverseAccessMode"];
  sourceNotes?: GatewayProviderSourceProfile["notes"];
};

function toRustGatewayProviderAccountBody(input: UpsertGatewayProviderAccountInput): RustGatewayProviderAccountBody {
  const { sourceProfile, ...rest } = input;
  if (!sourceProfile) {
    return rest;
  }
  return {
    ...rest,
    sourceKind: sourceProfile.sourceKind,
    aggregatorApiMode: sourceProfile.aggregatorApiMode ?? null,
    webReverseAccessMode: sourceProfile.webReverseAccessMode ?? null,
    sourceNotes: sourceProfile.notes ?? null,
  };
}

export async function createOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  input: UpsertGatewayProviderAccountInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    "/v1/internal/gateway/provider-accounts",
    {
      method: "POST",
      userContext,
      body: toRustGatewayProviderAccountBody(input),
    },
  );
  return response.providerAccount;
}

export async function updateOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: UpsertGatewayProviderAccountInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}`,
    {
      method: "POST",
      userContext,
      body: toRustGatewayProviderAccountBody(input),
    },
  );
  return response.providerAccount;
}

export async function updateOperatorGatewayProviderModelPricing(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: PatchGatewayProviderModelPricingInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/model-pricing`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.providerAccount;
}

export async function deleteOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{
    deleted: true;
    providerAccountId: string;
    label: string;
    deletedCredentialCount: number;
  }>(`/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}`, {
    method: "DELETE",
    userContext,
  });
  return response;
}

export async function listOperatorGatewayProviderCredentials(
  userContext: InternalUserContext,
  providerAccountId: string,
  input?: { maskSecrets?: boolean },
) {
  const params = new URLSearchParams();
  if (typeof input?.maskSecrets === "boolean") {
    params.set("maskSecrets", input.maskSecrets ? "true" : "false");
  }
  const pathname = params.size
    ? `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/credentials?${params.toString()}`
    : `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/credentials`;
  const response = await gatewayRequest<{
    providerAccount: GatewayProviderAccountView;
    credentials: GatewayProviderCredentialView[];
  }>(pathname, {
    userContext,
  });
  return response;
}

export async function createOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: UpsertGatewayProviderCredentialInput,
) {
  const response = await gatewayRequest<{ providerCredential: GatewayProviderCredentialView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/credentials`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.providerCredential;
}

export async function getOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerCredentialId: string,
  input?: { maskSecrets?: boolean },
) {
  const params = new URLSearchParams();
  if (typeof input?.maskSecrets === "boolean") {
    params.set("maskSecrets", input.maskSecrets ? "true" : "false");
  }
  const pathname = params.size
    ? `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}?${params.toString()}`
    : `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}`;
  const response = await gatewayRequest<{ providerCredential: GatewayProviderCredentialView }>(
    pathname,
    {
      userContext,
    },
  );
  return response.providerCredential;
}

export async function patchOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerCredentialId: string,
  input: PatchGatewayProviderCredentialInput,
) {
  const response = await gatewayRequest<{ providerCredential: GatewayProviderCredentialView }>(
    `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}`,
    {
      method: "PUT",
      userContext,
      body: input,
    },
  );
  return response.providerCredential;
}

export async function deleteOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerCredentialId: string,
) {
  const response = await gatewayRequest<{
    success: true;
    providerCredentialId: string;
    providerAccountId: string;
    message: string;
  }>(`/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}`, {
    method: "DELETE",
    userContext,
  });
  return response;
}

export async function getOperatorGatewayProviderCredentialQuota(
  userContext: InternalUserContext,
  providerCredentialId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}/quota`,
    {
      userContext,
    },
  );
  return response.providerQuota;
}

export async function refreshOperatorGatewayProviderCredentialQuota(
  userContext: InternalUserContext,
  providerCredentialId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}/quota`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.providerQuota;
}

export async function getOperatorGatewayProviderCredentialFolderSyncStatus(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/status",
    {
      userContext,
    },
  );
  return response.status;
}

export async function setOperatorGatewayProviderCredentialFolderSyncEnabled(
  userContext: InternalUserContext,
  enabled: boolean,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/status",
    {
      method: "PUT",
      userContext,
      body: { enabled },
    },
  );
  return response.status;
}

export async function importOperatorGatewayProviderCredentialsFromFolder(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/import",
    {
      method: "POST",
      userContext,
    },
  );
  return response.status;
}

export async function exportOperatorGatewayProviderCredentialsToFolder(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/export",
    {
      method: "POST",
      userContext,
    },
  );
  return response.status;
}

export async function patchOperatorGatewayProviderSourceProfile(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: PatchGatewayProviderSourceProfileInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/source-profile`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.providerAccount;
}

export async function backfillOperatorGatewayProviderSourceProfiles(
  userContext: InternalUserContext,
  input?: { providerAccountIds?: string[]; onlyMissing?: boolean },
) {
  const response = await gatewayRequest<{ result: GatewayProviderSourceProfileBackfillResult }>(
    "/v1/internal/gateway/provider-accounts/source-profile/backfill",
    {
      method: "POST",
      userContext,
      body: {
        providerAccountIds: input?.providerAccountIds ?? null,
        onlyMissing: input?.onlyMissing ?? true,
      },
    },
  );
  return response.result;
}

export async function updateCurrentUserProfile(userContext: InternalUserContext, payload: UpdateUserProfileInput) {
  const response = await accountRequest<{ user: UserSummary | null }>("/v1/me/profile", {
    method: "POST",
    userContext,
    body: payload,
  });
  return response.user;
}

export async function getWalletSummary(userContext: InternalUserContext) {
  const response = await accountRequest<{ wallet: WalletSummary }>("/v1/me/wallet", {
    userContext,
  });
  return response.wallet;
}

export async function exchangeWallet(userContext: InternalUserContext, payload: WalletExchangeInput) {
  const response = await accountRequest<{ exchange: WalletExchangeResult }>("/v1/me/wallet/exchange", {
    method: "POST",
    userContext,
    body: payload,
  });
  return response.exchange;
}

export async function getReputationSummary(userContext: InternalUserContext) {
  const response = await accountRequest<{ reputation: ReputationSummary | null }>("/v1/me/reputation", {
    userContext,
  });
  return response.reputation;
}

export async function getReputationBreakdown(userContext: InternalUserContext) {
  const response = await accountRequest<{ breakdown: ReputationBreakdown | null }>("/v1/me/reputation/breakdown", {
    userContext,
  });
  return response.breakdown;
}

export async function listReputationHistory(userContext: InternalUserContext, limit = 10) {
  const response = await accountRequest<{ history: ReputationHistoryPoint[] }>(`/v1/me/reputation/history?limit=${limit}`, {
    userContext,
  });
  return response.history;
}

export async function getMissionPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: MissionPanelView }>("/v1/me/missions/panel", {
    userContext,
  });
  return response.panel;
}

export async function getBenefitPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: BenefitPanelView }>("/v1/me/benefits/panel", {
    userContext,
  });
  return response.panel;
}

export async function getHonorProjectPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: HonorProjectPanelView }>("/v1/internal/honor-projects/panel", {
    userContext,
  });
  return response.panel;
}

export async function sponsorHonorProject(userContext: InternalUserContext, projectId: string, input: SponsorHonorProjectInput) {
  const response = await accountRequest<{
    sponsorship: {
      amount: number;
      currencyLabel: string;
      projectId: string;
      projectName: string;
    };
  }>(`/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/sponsor`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.sponsorship;
}

export async function joinHonorProject(userContext: InternalUserContext, projectId: string, input: JoinHonorProjectInput) {
  const response = await accountRequest<{
    membership: {
      projectId: string;
      projectName: string;
      roleLabel: string;
      status: "pending";
      username: string;
    };
  }>(`/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/join`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.membership;
}

export async function listOperatorBenefitCatalog(userContext: InternalUserContext) {
  const response = await accountRequest<{ catalog: BenefitCatalogView }>("/v1/internal/benefits/catalog", {
    userContext,
  });
  return response.catalog;
}

export async function updateOperatorBenefitFamily(
  userContext: InternalUserContext,
  familyKey: string,
  input: UpsertBenefitFamilyInput,
) {
  const response = await accountRequest<{ family: BenefitCatalogView["families"][number] }>(
    `/v1/internal/benefits/families/${encodeURIComponent(familyKey)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.family;
}

export async function createOperatorBenefitProductLine(
  userContext: InternalUserContext,
  input: UpsertBenefitProductLineInput,
) {
  return accountRequest<{ productLine: BenefitProductLineView }>("/v1/internal/benefits/product-lines", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function updateOperatorBenefitProductLine(
  userContext: InternalUserContext,
  productLineId: string,
  input: Partial<UpsertBenefitProductLineInput>,
) {
  return accountRequest<{ productLine: BenefitProductLineView }>(
    `/v1/internal/benefits/product-lines/${encodeURIComponent(productLineId)}`,
    { method: "POST", body: input, userContext },
  );
}

export async function deleteOperatorBenefitProductLine(
  userContext: InternalUserContext,
  productLineId: string,
) {
  return accountRequest<{ ok: boolean }>(
    `/v1/internal/benefits/product-lines/${encodeURIComponent(productLineId)}/delete`,
    { method: "POST", userContext },
  );
}

export async function createOperatorBenefitService(
  userContext: InternalUserContext,
  input: UpsertBenefitServiceInput,
) {
  const response = await accountRequest<{ service: BenefitServiceView }>("/v1/internal/benefits/services", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.service;
}

export async function updateOperatorBenefitService(
  userContext: InternalUserContext,
  serviceId: string,
  input: UpsertBenefitServiceInput,
) {
  const response = await accountRequest<{ service: BenefitServiceView }>(
    `/v1/internal/benefits/services/${encodeURIComponent(serviceId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.service;
}

export async function archiveOperatorBenefitService(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ service: BenefitServiceView }>(
    `/v1/internal/benefits/services/${encodeURIComponent(serviceId)}/archive`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.service;
}

export async function deleteOperatorBenefitService(userContext: InternalUserContext, serviceId: string) {
  await accountRequest<{ ok: true }>(`/v1/internal/benefits/services/${encodeURIComponent(serviceId)}/delete`, {
    method: "POST",
    userContext,
  });
}

export async function createOperatorBenefitProductBinding(
  userContext: InternalUserContext,
  input: { serviceId: string; productId: string },
) {
  const response = await accountRequest<{ productBinding: BenefitProductBindingView }>(
    "/v1/internal/benefits/product-bindings",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.productBinding;
}

export async function deleteOperatorBenefitProductBinding(userContext: InternalUserContext, bindingId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/benefits/product-bindings/${encodeURIComponent(bindingId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function createOperatorBenefitGrant(
  userContext: InternalUserContext,
  input: CreateBenefitGrantInput,
) {
  await accountRequest<{ ok: true }>("/v1/internal/benefits/grants", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function revokeOperatorBenefitGrant(userContext: InternalUserContext, grantId: string) {
  await accountRequest<{ ok: true }>(`/v1/internal/benefits/grants/${encodeURIComponent(grantId)}/revoke`, {
    method: "POST",
    userContext,
  });
}

export async function importOperatorBenefitCredentialPool(
  userContext: InternalUserContext,
  input: ImportBenefitCredentialPoolInput,
) {
  await accountRequest<{ ok: true }>("/v1/internal/benefits/credential-pools/import", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function rotateOperatorBenefitAssignment(
  userContext: InternalUserContext,
  serviceId: string,
  userId: string,
) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/benefits/assignments/${encodeURIComponent(serviceId)}/${encodeURIComponent(userId)}/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function searchOperatorBenefitUsers(userContext: InternalUserContext, query: string) {
  const params = new URLSearchParams({ q: query });
  const response = await accountRequest<{ users: BenefitUserSearchResult[] }>(
    `/v1/internal/benefits/users/search?${params.toString()}`,
    {
      userContext,
    },
  );
  return response.users;
}

export async function listOperatorCredentialPoolCatalog(userContext: InternalUserContext) {
  const response = await accountRequest<{ catalog: CredentialOperatorCatalogView }>(
    "/v1/internal/credential-pools/catalog",
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function createOperatorCredentialTerminal(
  userContext: InternalUserContext,
  input: { providerKey: CredentialProviderKey; label: string; note?: string | null },
) {
  const response = await accountRequest<{
    issued: {
      terminal: CredentialTerminalView;
      plainToken: string;
    };
  }>("/v1/internal/credential-pools/terminals", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.issued;
}

export async function revokeOperatorCredentialTerminal(userContext: InternalUserContext, terminalId: string) {
  const response = await accountRequest<{ terminal: CredentialTerminalView }>(
    `/v1/internal/credential-pools/terminals/${encodeURIComponent(terminalId)}/revoke`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.terminal;
}

export async function importOperatorCredentialPool(
  userContext: InternalUserContext,
  input: CredentialTerminalUploadInput,
) {
  const response = await accountRequest<{ batch: CredentialUploadBatchView }>(
    "/v1/internal/credential-pools/import",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.batch;
}

export async function claimOperatorCredentialRepair(userContext: InternalUserContext, entryId: string) {
  const response = await accountRequest<{ claim: CredentialRepairClaimView }>(
    `/v1/internal/credential-pools/repair/${encodeURIComponent(entryId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.claim;
}

export async function releaseOperatorCredentialRepair(userContext: InternalUserContext, claimId: string) {
  const response = await accountRequest<{ claim: CredentialRepairClaimView }>(
    `/v1/internal/credential-pools/repair/claims/${encodeURIComponent(claimId)}/release`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.claim;
}

export async function markOperatorCredentialCooling(
  userContext: InternalUserContext,
  entryId: string,
  input: { cooldownMinutes: number; reason?: string | null },
) {
  const response = await accountRequest<{ entry: CredentialEntryView }>(
    `/v1/internal/credential-pools/entries/${encodeURIComponent(entryId)}/cooling`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.entry;
}

export async function markOperatorCredentialInvalid(
  userContext: InternalUserContext,
  entryId: string,
  input: { reason: string },
) {
  const response = await accountRequest<{ entry: CredentialEntryView }>(
    `/v1/internal/credential-pools/entries/${encodeURIComponent(entryId)}/invalid`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.entry;
}

export async function markOperatorCredentialDeath(
  userContext: InternalUserContext,
  entryId: string,
  input: { reason: string },
) {
  const response = await accountRequest<{ entry: CredentialEntryView }>(
    `/v1/internal/credential-pools/entries/${encodeURIComponent(entryId)}/death`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.entry;
}

export async function rotateOperatorCredentialAssignment(
  userContext: InternalUserContext,
  serviceId: string,
  userId: string,
) {
  const response = await accountRequest<{ assignment: CredentialAssignmentOperatorView | null }>(
    `/v1/internal/credential-pools/assignments/${encodeURIComponent(serviceId)}/${encodeURIComponent(userId)}/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.assignment;
}

export async function resolveUserCredential(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ credential: CredentialResolvedPayloadView }>(
    `/v1/me/credential-pools/services/${encodeURIComponent(serviceId)}/credential`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.credential;
}

export async function rotateUserCredential(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ credential: CredentialResolvedPayloadView }>(
    `/v1/me/credential-pools/services/${encodeURIComponent(serviceId)}/credential/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.credential;
}

export async function resolveBenefitServiceApiAccess(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ access: BenefitServiceApiAccessView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/api-access`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.access;
}

export async function rotateBenefitServiceApiAccess(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ access: BenefitServiceApiAccessView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/api-access/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.access;
}

export async function getBenefitServicePromptCacheSummary(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ summary: BenefitServicePromptCacheSummaryView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/prompt-cache-summary`,
    {
      userContext,
    },
  );
  return response.summary;
}

export async function getBenefitServicePromptCacheTrendReport(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ report: BenefitServicePromptCacheTrendReportView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/prompt-cache-trend-report`,
    {
      userContext,
    },
  );
  return response.report;
}

function buildBenefitServiceModelsUrl(apiUrl: string) {
  const internalBaseUrl = process.env.AI_GATEWAY_INTERNAL_URL?.trim() || "";
  const normalizedBaseUrl = (internalBaseUrl || apiUrl).trim().replace(/\/+$/, "");
  if (normalizedBaseUrl.endsWith("/v1") || normalizedBaseUrl.endsWith("/v1/new-api")) {
    return `${normalizedBaseUrl}/models`;
  }
  return `${normalizedBaseUrl}/v1/models`;
}

export async function listBenefitServiceModels(userContext: InternalUserContext, serviceId: string) {
  const access = await resolveBenefitServiceApiAccess(userContext, serviceId);
  const response = await fetch(buildBenefitServiceModelsUrl(access.apiUrl), {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${access.apiKey}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        data?: Array<{
          id?: string | null;
        }>;
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Benefit service models unavailable");
  }

  const seen = new Set<string>();
  return (payload?.data ?? [])
    .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}

export async function claimMission(userContext: InternalUserContext, missionId: string) {
  const response = await accountRequest<{ reward: MissionClaimResult }>(
    `/v1/me/missions/${encodeURIComponent(missionId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.reward;
}

export async function placeCheckinWager(userContext: InternalUserContext, missionId: string) {
  const response = await accountRequest<{ wager: MissionCheckinWagerResult }>(
    `/v1/me/missions/${encodeURIComponent(missionId)}/checkin-wager`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.wager;
}

export async function listOperatorMissionDefinitions(userContext: InternalUserContext) {
  const response = await accountRequest<{ missions: MissionDefinitionView[] }>(
    "/v1/internal/missions",
    {
      userContext,
    },
  );
  return response.missions;
}

export async function createOperatorMissionDefinition(
  userContext: InternalUserContext,
  input: UpsertMissionDefinitionInput,
) {
  const response = await accountRequest<{ mission: MissionDefinitionView }>(
    "/v1/internal/missions",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.mission;
}

export async function updateOperatorMissionDefinition(
  userContext: InternalUserContext,
  missionId: string,
  input: UpsertMissionDefinitionInput,
) {
  const response = await accountRequest<{ mission: MissionDefinitionView }>(
    `/v1/internal/missions/${encodeURIComponent(missionId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.mission;
}

export async function archiveOperatorMissionDefinition(
  userContext: InternalUserContext,
  missionId: string,
) {
  const response = await accountRequest<{ mission: MissionDefinitionView }>(
    `/v1/internal/missions/${encodeURIComponent(missionId)}/archive`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.mission;
}

export async function deleteOperatorMissionDefinition(userContext: InternalUserContext, missionId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/missions/${encodeURIComponent(missionId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorHonorProjectCatalog(
  userContext: InternalUserContext,
  input?: {
    investmentUserId?: string | null;
    query?: string | null;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  if (input?.investmentUserId?.trim()) {
    params.set("investmentUserId", input.investmentUserId.trim());
  }
  if (input?.query?.trim()) {
    params.set("query", input.query.trim());
  }
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await accountRequest<{ catalog: HonorProjectCatalogView }>(
    `/v1/internal/honor-projects/catalog${suffix}`,
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function createOperatorHonorProject(
  userContext: InternalUserContext,
  input: UpsertHonorProjectInput,
) {
  const response = await accountRequest<{ project: HonorProjectView }>(
    "/v1/internal/honor-projects/projects",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.project;
}

export async function updateOperatorHonorProject(
  userContext: InternalUserContext,
  projectId: string,
  input: UpsertHonorProjectInput,
) {
  const response = await accountRequest<{ project: HonorProjectView }>(
    `/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.project;
}

export async function archiveOperatorHonorProject(userContext: InternalUserContext, projectId: string) {
  const response = await accountRequest<{ project: HonorProjectView }>(
    `/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/archive`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.project;
}

export async function deleteOperatorHonorProject(userContext: InternalUserContext, projectId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function upsertOperatorHonorProjectInvestment(
  userContext: InternalUserContext,
  input: UpsertHonorProjectInvestmentInput,
) {
  const response = await accountRequest<{ investment: HonorProjectInvestmentView }>(
    "/v1/internal/honor-projects/investments",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.investment;
}

export async function deleteOperatorHonorProjectInvestment(
  userContext: InternalUserContext,
  investmentId: string,
) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/honor-projects/investments/${encodeURIComponent(investmentId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listMailbox(userContext: InternalUserContext) {
  const response = await accountRequest<{ messages: MailboxMessageView[] }>("/v1/me/mailbox/messages", {
    userContext,
  });
  return response.messages;
}

export async function listPublishedAccountAnnouncements() {
  const response = await accountRequest<{ announcements: AccountAnnouncementView[] }>("/v1/announcements");
  return response.announcements;
}

export async function listOperatorAccountAnnouncements(userContext: InternalUserContext) {
  const response = await accountRequest<{ announcements: AccountAnnouncementView[] }>(
    "/v1/internal/announcements",
    {
      userContext,
    },
  );
  return response.announcements;
}

export async function createOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await accountRequest<{ announcement: AccountAnnouncementView }>(
    "/v1/internal/announcements",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.announcement;
}

export async function updateOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  announcementId: string,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await accountRequest<{ announcement: AccountAnnouncementView }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.announcement;
}

export async function deleteOperatorAccountAnnouncement(userContext: InternalUserContext, announcementId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function claimMailboxAttachment(userContext: InternalUserContext, input: ClaimMailboxAttachmentInput) {
  return accountRequest("/v1/me/mailbox/claim", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function markMailboxMessageRead(userContext: InternalUserContext, messageId: string) {
  const response = await accountRequest<{ message: { messageId: string; readAt: string } }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/read`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.message;
}

export async function setMailboxMessageFavorite(
  userContext: InternalUserContext,
  messageId: string,
  favorited: boolean,
) {
  const response = await accountRequest<{ result: SetMailboxMessageFavoriteResult }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/favorite`,
    {
      method: "POST",
      body: {
        favorited,
      },
      userContext,
    },
  );
  return response.result;
}

export async function deleteMailboxMessage(userContext: InternalUserContext, messageId: string) {
  const response = await accountRequest<{ result: DeleteMailboxMessageResult }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function claimMailboxMessageAttachments(userContext: InternalUserContext, messageId: string) {
  const response = await accountRequest<{ result: ClaimMailboxMessageAttachmentsResult }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/claim-all`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function claimAllMailboxAttachments(userContext: InternalUserContext) {
  const response = await accountRequest<{ result: ClaimAllMailboxAttachmentsResult }>("/v1/me/mailbox/claim-all", {
    method: "POST",
    userContext,
  });
  return response.result;
}

export async function archiveReadMailboxMessages(userContext: InternalUserContext) {
  const response = await accountRequest<{ result: ArchiveReadMailboxMessagesResult }>("/v1/me/mailbox/archive-read", {
    method: "POST",
    userContext,
  });
  return response.result;
}

export async function listOperatorMailboxOpsCampaigns(
  userContext: InternalUserContext,
  input?: ListMailboxOpsCampaignsInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  if (input?.status) {
    params.set("status", input.status);
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-campaigns?${params.toString()}`
    : "/v1/internal/mailbox/ops-campaigns";
  const response = await accountRequest<{ campaigns: MailboxOpsCampaignView[] }>(pathname, {
    userContext,
  });
  return response.campaigns;
}

export async function listOperatorMailboxOpsCampaignDeliveries(
  userContext: InternalUserContext,
  campaignId: string,
  input?: { limit?: number | null },
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/deliveries?${params.toString()}`
    : `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/deliveries`;
  const response = await accountRequest<{ deliveries: MailboxOpsCampaignDeliveryView[] }>(pathname, {
    userContext,
  });
  return response.deliveries;
}

export async function createOperatorMailboxOpsCampaign(
  userContext: InternalUserContext,
  input: UpsertMailboxOpsCampaignInput,
) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>("/v1/internal/mailbox/ops-campaigns", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.campaign;
}

export async function updateOperatorMailboxOpsCampaign(
  userContext: InternalUserContext,
  campaignId: string,
  input: UpsertMailboxOpsCampaignInput,
) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.campaign;
}

export async function dispatchOperatorMailboxOpsCampaign(userContext: InternalUserContext, campaignId: string) {
  const response = await accountRequest<{ result: MailboxOpsCampaignDispatchResult }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/dispatch`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function cancelOperatorMailboxOpsCampaign(userContext: InternalUserContext, campaignId: string) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/cancel`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.campaign;
}

export async function duplicateOperatorMailboxOpsCampaign(userContext: InternalUserContext, campaignId: string) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/duplicate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.campaign;
}

export async function listOperatorMailboxOpsTemplates(
  userContext: InternalUserContext,
  input?: ListMailboxOpsTemplatesInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-templates?${params.toString()}`
    : "/v1/internal/mailbox/ops-templates";
  const response = await accountRequest<{ templates: MailboxOpsTemplateView[] }>(pathname, {
    userContext,
  });
  return response.templates;
}

export async function saveOperatorMailboxOpsTemplate(
  userContext: InternalUserContext,
  input: UpsertMailboxOpsTemplateInput,
) {
  const response = await accountRequest<{ template: MailboxOpsTemplateView }>("/v1/internal/mailbox/ops-templates", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.template;
}

export async function deleteOperatorMailboxOpsTemplate(userContext: InternalUserContext, templateId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/mailbox/ops-templates/${encodeURIComponent(templateId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorMailboxOpsRecipientBatches(
  userContext: InternalUserContext,
  input?: ListMailboxOpsRecipientBatchesInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-recipient-batches?${params.toString()}`
    : "/v1/internal/mailbox/ops-recipient-batches";
  const response = await accountRequest<{ batches: MailboxOpsRecipientBatchView[] }>(pathname, {
    userContext,
  });
  return response.batches;
}

export async function saveOperatorMailboxOpsRecipientBatch(
  userContext: InternalUserContext,
  input: UpsertMailboxOpsRecipientBatchInput,
) {
  const response = await accountRequest<{ batch: MailboxOpsRecipientBatchView }>(
    "/v1/internal/mailbox/ops-recipient-batches",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.batch;
}

export async function deleteOperatorMailboxOpsRecipientBatch(userContext: InternalUserContext, batchId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/mailbox/ops-recipient-batches/${encodeURIComponent(batchId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorAgentExecutionOwnerReliefRuns(
  userContext: InternalUserContext,
  input?: ListAgentExecutionOwnerReliefRunsInput,
) {
  const params = new URLSearchParams();
  if (input?.ownerUserId) {
    params.set("ownerUserId", input.ownerUserId);
  }
  if (input?.agentId) {
    params.set("agentId", input.agentId);
  }
  if (input?.resultStatus) {
    params.set("resultStatus", input.resultStatus);
  }
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/agent-executions/owner-relief-runs?${params.toString()}`
    : "/v1/internal/agent-executions/owner-relief-runs";
  const response = await accountRequest<{
    runs: Array<AgentExecutionOwnerReliefRunView & { recentActions: AgentExecutionOwnerReliefRunActionView[] }>;
  }>(pathname, {
    userContext,
  });
  return response.runs;
}

export async function listOperatorAgentExecutionOwnerReliefHandoffDefaults(
  userContext: InternalUserContext,
) {
  const response = await accountRequest<{ defaults: AgentExecutionOwnerReliefHandoffDefaultView[] }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults",
    {
      userContext,
    },
  );
  return response.defaults;
}

export async function startOperatorAgentExecutionOwnerReliefRun(
  userContext: InternalUserContext,
  input: StartAgentExecutionOwnerReliefRunInput,
) {
  const response = await accountRequest<{ run: AgentExecutionOwnerReliefRunView }>(
    "/v1/internal/agent-executions/owner-relief-runs/start",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.run;
}

export async function recordOperatorAgentExecutionOwnerReliefRunAction(
  userContext: InternalUserContext,
  runId: string,
  input: RecordAgentExecutionOwnerReliefRunActionInput,
) {
  const response = await accountRequest<{ action: AgentExecutionOwnerReliefRunActionView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/actions`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.action;
}

export async function finalizeOperatorAgentExecutionOwnerReliefRun(
  userContext: InternalUserContext,
  runId: string,
  input: FinalizeAgentExecutionOwnerReliefRunInput,
) {
  const response = await accountRequest<{ run: AgentExecutionOwnerReliefRunView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/finalize`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.run;
}

export async function reopenOperatorAgentExecutionOwnerReliefRun(
  userContext: InternalUserContext,
  runId: string,
) {
  const response = await accountRequest<{ run: AgentExecutionOwnerReliefRunView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/reopen`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.run;
}

export async function openOperatorAgentExecutionOwnerReliefRunHandoff(
  userContext: InternalUserContext,
  runId: string,
  input: OpenAgentExecutionOwnerReliefRunHandoffInput,
) {
  const response = await accountRequest<{ handoff: AgentExecutionOwnerReliefRunHandoffView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/handoff/open`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.handoff;
}

export async function resolveOperatorAgentExecutionOwnerReliefRunHandoff(
  userContext: InternalUserContext,
  runId: string,
  input: ResolveAgentExecutionOwnerReliefRunHandoffInput,
) {
  const response = await accountRequest<{ handoff: AgentExecutionOwnerReliefRunHandoffView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/handoff/resolve`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.handoff;
}

export async function saveOperatorAgentExecutionOwnerReliefHandoffDefault(
  userContext: InternalUserContext,
  input: UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
) {
  const response = await accountRequest<{ profile: AgentExecutionOwnerReliefHandoffDefaultView }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.profile;
}

export async function clearOperatorAgentExecutionOwnerReliefHandoffDefault(
  userContext: InternalUserContext,
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType,
) {
  await accountRequest<{ ok: true }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults/clear",
    {
      method: "POST",
      body: { handoffTargetType },
      userContext,
    },
  );
}


export async function getOperatorNotificationWebhookCatalog(userContext: InternalUserContext) {
  const response = await accountRequest<{ catalog: NotificationWebhookCatalogView }>(
    "/v1/internal/notification-webhooks/catalog",
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function listOperatorNotificationWebhookIncidentSavedViews(
  userContext: InternalUserContext,
  input?: ListNotificationWebhookIncidentSavedViewsInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/notification-webhooks/incidents/views?${params.toString()}`
    : "/v1/internal/notification-webhooks/incidents/views";
  const response = await accountRequest<{ views: NotificationWebhookIncidentSavedView[] }>(pathname, {
    userContext,
  });
  return response.views;
}

export async function getOperatorDefaultNotificationWebhookIncidentSavedView(userContext: InternalUserContext) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView | null }>(
    "/v1/internal/notification-webhooks/incidents/views/default",
    {
      userContext,
    },
  );
  return response.view;
}

export async function createOperatorNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  input: CreateNotificationWebhookIncidentSavedViewInput,
) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView }>(
    "/v1/internal/notification-webhooks/incidents/views",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.view;
}

export async function setOperatorDefaultNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  viewId: string,
) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView }>(
    `/v1/internal/notification-webhooks/incidents/views/${encodeURIComponent(viewId)}/default`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.view;
}

export async function updateOperatorNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  viewId: string,
  input: CreateNotificationWebhookIncidentSavedViewInput,
) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView }>(
    `/v1/internal/notification-webhooks/incidents/views/${encodeURIComponent(viewId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.view;
}

export async function deleteOperatorNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  viewId: string,
) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/notification-webhooks/incidents/views/${encodeURIComponent(viewId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorNotificationWebhookIncidents(
  userContext: InternalUserContext,
  options?: {
    limit?: number;
    historyLimit?: number;
    agentId?: string;
    callbackType?: string;
    policyKey?: string;
    reasonCategory?: string;
    reasonDisposition?: string;
    alertLevel?: number;
    governanceState?: "active" | "acknowledged" | "silenced";
    projectId?: string;
    incidentId?: string;
    routePolicyId?: string;
    snapshotId?: string;
  },
) {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(options.limit))));
  }
  if (typeof options?.historyLimit === "number" && Number.isFinite(options.historyLimit)) {
    params.set("historyLimit", String(Math.max(1, Math.floor(options.historyLimit))));
  }
  if (options?.agentId) params.set("agentId", options.agentId);
  if (options?.callbackType) params.set("callbackType", options.callbackType);
  if (options?.policyKey) params.set("policyKey", options.policyKey);
  if (options?.reasonCategory) params.set("reasonCategory", options.reasonCategory);
  if (options?.reasonDisposition) params.set("reasonDisposition", options.reasonDisposition);
  if (typeof options?.alertLevel === "number" && Number.isFinite(options.alertLevel) && options.alertLevel > 0) {
    params.set("alertLevel", String(Math.floor(options.alertLevel)));
  }
  if (options?.governanceState) params.set("governanceState", options.governanceState);
  if (options?.projectId) params.set("projectId", options.projectId);
  if (options?.incidentId) params.set("incidentId", options.incidentId);
  if (options?.routePolicyId) params.set("routePolicyId", options.routePolicyId);
  if (options?.snapshotId) params.set("snapshotId", options.snapshotId);

  const pathname = params.size
    ? `/v1/internal/notification-webhooks/incidents?${params.toString()}`
    : "/v1/internal/notification-webhooks/incidents";
  const response = await accountRequest<{ incidents: NotificationWebhookIncidentListView }>(pathname, {
    userContext,
  });
  return response.incidents;
}

export async function acknowledgeOperatorNotificationWebhookIncident(
  userContext: InternalUserContext,
  incidentKey: string,
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentControlResult }>(
    `/v1/internal/notification-webhooks/incidents/${encodeURIComponent(incidentKey)}/acknowledge`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function getGatewayAccessCatalog(userContext: InternalUserContext) {
  const response = await gatewayRequest<GatewayAccessCatalogView>(`/v1/internal/gateway/access/catalog`, {
    userContext,
  });
  return response;
}

export async function previewGatewayAccessCandidates(
  userContext: InternalUserContext,
  input: {
    accessKeyId: string;
    model: string;
    endpointKind: string;
    estimatedTokens?: number | null;
    explicitSessionKey?: string | null;
  },
) {
  const params = new URLSearchParams({
    accessKeyId: input.accessKeyId,
    model: input.model,
    endpointKind: input.endpointKind,
  });
  if (typeof input.estimatedTokens === "number") {
    params.set("estimatedTokens", String(input.estimatedTokens));
  }
  if (input.explicitSessionKey) {
    params.set("explicitSessionKey", input.explicitSessionKey);
  }
  return gatewayRequest<GatewayAccessCandidatePreviewView[]>(
    `/v1/internal/gateway/access/preview/candidates?${params.toString()}`,
    { userContext },
  );
}

export async function previewGatewayAccessRouteDecision(
  userContext: InternalUserContext,
  input: {
    accessKeyId: string;
    model: string;
    endpointKind: string;
    estimatedTokens?: number | null;
    explicitSessionKey?: string | null;
  },
) {
  const params = new URLSearchParams({
    accessKeyId: input.accessKeyId,
    model: input.model,
    endpointKind: input.endpointKind,
  });
  if (typeof input.estimatedTokens === "number") {
    params.set("estimatedTokens", String(input.estimatedTokens));
  }
  if (input.explicitSessionKey) {
    params.set("explicitSessionKey", input.explicitSessionKey);
  }
  return gatewayRequest<GatewayRouteDecisionPreviewView>(
    `/v1/internal/gateway/access/preview/route-decision?${params.toString()}`,
    { userContext },
  );
}

export async function inspectGatewayAccessAffinity(
  userContext: InternalUserContext,
  input: {
    accessKeyId: string;
    model: string;
    explicitSessionKey?: string | null;
  },
) {
  const params = new URLSearchParams({
    accessKeyId: input.accessKeyId,
    model: input.model,
  });
  if (input.explicitSessionKey) {
    params.set("explicitSessionKey", input.explicitSessionKey);
  }
  const response = await gatewayRequest<{ affinity: GatewayAccessStickyAffinityView | null }>(
    `/v1/internal/gateway/access/affinity?${params.toString()}`,
    { userContext },
  );
  return response.affinity;
}

export async function silenceOperatorNotificationWebhookIncident(
  userContext: InternalUserContext,
  incidentKey: string,
  input: {
    durationMinutes: number;
    reason?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentControlResult }>(
    `/v1/internal/notification-webhooks/incidents/${encodeURIComponent(incidentKey)}/silence`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function clearOperatorNotificationWebhookIncidentSilence(
  userContext: InternalUserContext,
  incidentKey: string,
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentControlResult }>(
    `/v1/internal/notification-webhooks/incidents/${encodeURIComponent(incidentKey)}/clear-silence`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function acknowledgeOperatorNotificationWebhookIncidentsBatch(
  userContext: InternalUserContext,
  input: {
    limit: number;
    agentId?: string | null;
    callbackType?: string | null;
    policyKey?: string | null;
    reasonCategory?: string | null;
    reasonDisposition?: string | null;
    alertLevel?: number | null;
    governanceState?: "active" | "acknowledged" | "silenced" | null;
    projectId?: string | null;
    incidentId?: string | null;
    routePolicyId?: string | null;
    snapshotId?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentBatchActionResult }>(
    "/v1/internal/notification-webhooks/incidents/acknowledge-batch",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function silenceOperatorNotificationWebhookIncidentsBatch(
  userContext: InternalUserContext,
  input: {
    limit: number;
    durationMinutes: number;
    reason?: string | null;
    agentId?: string | null;
    callbackType?: string | null;
    policyKey?: string | null;
    reasonCategory?: string | null;
    reasonDisposition?: string | null;
    alertLevel?: number | null;
    governanceState?: "active" | "acknowledged" | "silenced" | null;
    projectId?: string | null;
    incidentId?: string | null;
    routePolicyId?: string | null;
    snapshotId?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentBatchActionResult }>(
    "/v1/internal/notification-webhooks/incidents/silence-batch",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function clearOperatorNotificationWebhookIncidentSilencesBatch(
  userContext: InternalUserContext,
  input: {
    limit: number;
    agentId?: string | null;
    callbackType?: string | null;
    policyKey?: string | null;
    reasonCategory?: string | null;
    reasonDisposition?: string | null;
    alertLevel?: number | null;
    governanceState?: "active" | "acknowledged" | "silenced" | null;
    projectId?: string | null;
    incidentId?: string | null;
    routePolicyId?: string | null;
    snapshotId?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentBatchActionResult }>(
    "/v1/internal/notification-webhooks/incidents/clear-silence-batch",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}
