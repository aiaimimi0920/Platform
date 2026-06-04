export { db, pgPool } from "./db/client";
export { redis } from "./db/redis";
export { env } from "./env";

export { identityRouter } from "./modules/identity/router";
export { getUserSummary, upsertLinuxDoUser } from "./modules/identity/service";
export {
  acceptMailgunInboundWebhook,
  getEmailProviderInboundMessageById,
  getEmailProviderInboundMessageViewById,
  listRecentEmailProviderInboundMessages,
  listRecentEmailProviderInboundMessageViews,
  processEmailProviderInboundMessage,
  retryEmailProviderInboundMessage,
} from "./modules/email-ingress/service";
export { emailProviderInboundMessages } from "./modules/email-ingress/schema";
export { verifyMailgunWebhookSignature } from "./modules/email-ingress/model";
export { emailNativeRouter } from "./modules/email-native/router";
export {
  confirmEmailIdentityVerification,
  getEmailDeliveryJobById,
  getEmailNativePanel,
  ingestEmailNativeInboundMessage,
  markEmailDeliveryJobAttempt,
  markEmailDeliveryJobFailed,
  markEmailDeliveryJobSent,
  queueEmailNativeExecutionLifecycleDelivery,
  queueEmailNativeTaskLifecycleDelivery,
  removeEmailIdentity,
  setPrimaryEmailIdentity,
  startEmailIdentityVerification,
} from "./modules/email-native/service";
export {
  emailDeliveryJobs,
  emailIdentityVerifications,
  emailNativeInboundMessages,
} from "./modules/email-native/schema";

export { walletLedgerRouter } from "./modules/wallet-ledger/router";
export {
  deductBalance,
  ensureUserWallet,
  exchangeObsidianToMira,
  freezeBalance,
  getUserWalletSnapshot,
  getWalletSummary,
  grantBalance,
  refundBalance,
  transferBalance,
  unfreezeBalance,
} from "./modules/wallet-ledger/service";
export { ledgerAccounts, ledgerEntries } from "./modules/wallet-ledger/schema";

export { reputationRouter } from "./modules/reputation/router";
export {
  getDispatchReputationProfilesInTx,
  getReputationBreakdown,
  getReputationHistory,
  getReputationSummary,
  refreshReputationSummaryInTx,
  refreshReputationUsersInTx,
} from "./modules/reputation/service";
export { reputationHistory, reputationSnapshots } from "./modules/reputation/schema";

export { personalMissionsRouter } from "./modules/personal-missions/router";
export {
  archiveOperatorMissionDefinition,
  claimMission,
  createOperatorMissionDefinition,
  deleteOperatorMissionDefinition,
  ensurePersonalMissionCatalogSeeded,
  getMissionPanel,
  listOperatorMissionDefinitions,
  placeCheckinWager,
  updateOperatorMissionDefinition,
} from "./modules/personal-missions/service";
export {
  personalMissionCheckinWagers,
  personalMissionClaims,
  personalMissionDefinitions,
} from "./modules/personal-missions/schema";

export { benefitsRouter } from "./modules/benefits/router";
export {
  buildBenefitServiceApiAccessKey,
  parseBenefitServiceApiAccessKey,
  resolveBenefitServiceApiAccessPublicBaseUrl,
  verifyBenefitServiceApiAccessKey,
} from "./modules/benefits/api-access";
export {
  archiveBenefitServiceForOperator,
  createBenefitGrantForOperator,
  createBenefitProductBindingForOperator,
  createBenefitServiceForOperator,
  deleteBenefitProductBindingForOperator,
  deleteBenefitServiceForOperator,
  ensureBenefitCatalogSeeded,
  getBenefitPanel,
  importBenefitCredentialPoolForOperator,
  listOperatorBenefitAssignments,
  listOperatorBenefitCatalog,
  listOperatorBenefitCredentialPools,
  listOperatorBenefitGrants,
  listOperatorBenefitProductBindings,
  resolveBenefitServiceApiAccessForUser,
  revokeBenefitGrantForOperator,
  rotateBenefitServiceApiAccessForUser,
  rotateBenefitAssignmentForOperator,
  searchBenefitUsersForOperator,
  syncBenefitPurchaseGrants,
  updateBenefitFamilyForOperator,
  updateBenefitServiceForOperator,
} from "./modules/benefits/service";
export {
  benefitCredentialEntries,
  benefitCredentialPools,
  benefitFamilies,
  benefitProductBindings,
  benefitServiceApiAccessKeys,
  benefitServiceProxyBindings,
  benefitServiceProxyRequests,
  benefitServices,
  benefitUserAssignments,
  benefitUserGrants,
} from "./modules/benefits/schema";

export { credentialPoolsRouter } from "./modules/credential-pools/router";
export {
  claimCredentialRepairForOperator,
  createCredentialTerminalForOperator,
  ensureCredentialProviderCatalogSeeded,
  getCredentialAssignmentSummariesForUser,
  importCredentialPoolForOperator,
  ingestCredentialPoolUpload,
  listOperatorCredentialPoolCatalog,
  markCredentialEntryCoolingForOperator,
  markCredentialEntryDeathForOperator,
  markCredentialEntryInvalidForOperator,
  readBenefitCredentialConfig,
  releaseCredentialRepairClaimForOperator,
  resolveCredentialForUser,
  rotateCredentialForUser,
  revokeCredentialTerminalForOperator,
  rotateCredentialAssignmentForOperator,
  runCredentialPoolLifecycleSweep,
} from "./modules/credential-pools/service";
export {
  deleteCredentialObject,
  putCredentialObject,
  readCredentialObject,
} from "./modules/credential-pools/object-storage";
export {
  credentialAssignments,
  credentialDeathJobs,
  credentialEntries,
  credentialProviders,
  credentialRepairClaims,
  credentialTerminals,
  credentialUploadBatches,
} from "./modules/credential-pools/schema";

export { mailboxRouter } from "./modules/mailbox/router";
export {
  cancelMailboxOpsCampaignForOperator,
  dispatchDueMailboxOpsCampaigns,
  dispatchMailboxOpsCampaignForOperator,
  createMailboxMessage,
  getMailboxSnapshot,
  listMailbox,
  listMailboxOpsCampaignDeliveriesForOperator,
  listMailboxOpsCampaignsForOperator,
  saveMailboxOpsCampaignForOperator,
} from "./modules/mailbox/service";
export {
  mailboxAttachments,
  mailboxMessages,
  mailboxOpsCampaignDeliveries,
  mailboxOpsCampaigns,
} from "./modules/mailbox/schema";

export { announcementsRouter } from "./modules/announcements/router";
export {
  createOperatorAccountAnnouncement,
  deleteOperatorAccountAnnouncement,
  ensureAnnouncementCatalogSeeded,
  listOperatorAccountAnnouncements,
  listPublishedAccountAnnouncements,
  updateOperatorAccountAnnouncement,
} from "./modules/announcements/service";
export { accountAnnouncements } from "./modules/announcements/schema";

export { honorProjectsRouter } from "./modules/honor-projects/router";
export {
  archiveOperatorHonorProject,
  createOperatorHonorProject,
  deleteOperatorHonorProject,
  deleteOperatorHonorProjectInvestment,
  ensureHonorProjectCatalogSeeded,
  getHonorProjectPanel,
  joinHonorProjectForUser,
  listOperatorHonorProjectCatalog,
  sponsorHonorProjectForUser,
  updateOperatorHonorProject,
  upsertOperatorHonorProjectInvestment,
} from "./modules/honor-projects/service";
export { honorProjectInvestments, honorProjectMemberships, honorProjects } from "./modules/honor-projects/schema";

export { productShadowRouter } from "./modules/product-order-item/router";
export {
  deleteProductSnapshotInTx,
  ensureProductSnapshotInTx,
  refreshProductSnapshotInTx,
  syncDedicatedProductShadowFromCore,
  upsertProductSnapshotInTx,
} from "./modules/product-order-item/service";
export { itemUnits, items, orders, products } from "./modules/product-order-item/schema";

export {
  buildUserProgressionSnapshot,
  getUserProgressionAccessRule,
  getUserProgressionSnapshot,
} from "./modules/user-progression/service";
export type { UserProgressionMetricValues } from "./modules/user-progression/model";

export { authIdentities, users } from "./modules/identity/schema";
export { agentExecutionRouter } from "./modules/agent-execution/router";
export {
  clearAgentExecutionOwnerReliefHandoffDefaultForOperator,
  finalizeAgentExecutionOwnerReliefRunForOperator,
  listAgentExecutionOwnerReliefHandoffDefaultsForOperator,
  listAgentExecutionOwnerReliefRunsForOperator,
  openAgentExecutionOwnerReliefRunHandoffForOperator,
  recordAgentExecutionOwnerReliefRunActionForOperator,
  reopenAgentExecutionOwnerReliefRunForOperator,
  resolveAgentExecutionOwnerReliefRunHandoffForOperator,
  saveAgentExecutionOwnerReliefHandoffDefaultForOperator,
  startAgentExecutionOwnerReliefRunForOperator,
} from "./modules/agent-execution/service";
export {
  agentExecutions,
  agentExecutionOwnerReliefHandoffDefaults,
  agentExecutionOwnerReliefRunHandoffs,
  agentExecutionOwnerReliefRunActions,
  agentExecutionOwnerReliefRuns,
  notificationWebhookIncidentDefaultViews,
  notificationWebhookIncidentSavedViews,
} from "./modules/agent-execution/schema";
