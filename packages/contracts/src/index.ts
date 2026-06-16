export * from "./account-announcements";
export * from "./ai-gateway";
export * from "./benefits";
export * from "./credential-pools";
export * from "./personal-missions";
export * from "./honor-projects";

export const featureModuleKeys = [
  "identity",
  "userProgression",
  "reputation",
  "arbitration",
  "wallet",
  "ledger",
  "personalMissions",
  "opinionHub",
  "developmentQueue",
  "agentExecution",
  "product",
  "discountCode",
  "item",
  "marketplace",
  "redemption",
  "mailbox",
  "benefits",
  "taskHub",
  "agentRegistry",
] as const;

export type FeatureModuleKey = (typeof featureModuleKeys)[number];

export const publicSurfaceKeys = [
  "announcements",
  "store",
  "marketplace",
  "redemption",
  "mailbox",
  "benefits",
  "missions",
  "opinions",
  "projects",
  "honor",
  "heavyChat",
  "agents",
  "tasks",
  "wallet",
  "growth",
  "reputation",
  "inventory",
  "arbitrations",
] as const;

export type PublicSurfaceKey = (typeof publicSurfaceKeys)[number];

export const currencyKeys = ["obsidian", "mira", "opinionTickets"] as const;

export type CurrencyKey = (typeof currencyKeys)[number];

export type FeatureModuleState = {
  moduleKey: FeatureModuleKey;
  enabled: boolean;
  rolloutNote: string | null;
  updatedAt: string;
};

export type FeatureSnapshot = Record<FeatureModuleKey, FeatureModuleState>;

export type PublicSurfaceState = {
  surfaceKey: PublicSurfaceKey;
  enabled: boolean;
  updatedAt: string;
};

export type PublicSurfaceSnapshot = Record<PublicSurfaceKey, PublicSurfaceState>;

export type InternalUserContext = {
  userId: string;
  providerUserId?: string;
  username?: string;
};

export type ApiErrorCode =
  | "MODULE_DISABLED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "CONTENT_FILTERED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_SERVER_ERROR";

export type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
  moduleKey?: FeatureModuleKey;
};

export type OutboxEventStatus = "pending" | "processing" | "processed" | "dead_letter";

export type OutboxEventView = {
  id: string;
  eventName: EventName;
  status: OutboxEventStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  availableAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutboxSummaryBucket = {
  key: string;
  count: number;
};

export type OutboxOpsRecommendationSeverity = "info" | "warning" | "danger";

export type OutboxAlertKind = "dead_letter_backlog" | "pending_backlog" | "stale_processing";

export type OutboxOpsRecommendationKind =
  | "retry_dead_letter_batch"
  | "inspect_pending_backlog"
  | "recover_stale_processing_queue"
  | "inspect_processing_queue";

export type OutboxOpsRecommendationView = {
  kind: OutboxOpsRecommendationKind;
  severity: OutboxOpsRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  status: OutboxEventStatus | null;
  eventName: EventName | null;
  suggestedLimit: number | null;
};

export type OutboxAlertView = {
  kind: OutboxAlertKind;
  count: number;
  alertLevel: number;
  severity: OutboxOpsRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  status: OutboxEventStatus;
  eventName: EventName | null;
  suggestedLimit: number | null;
};

export type OutboxAlertDispatchView = OutboxAlertView & {
  dispatched: boolean;
  skippedReason: string | null;
};

export type OutboxSummaryView = {
  pendingCount: number;
  processingCount: number;
  processedCount: number;
  deadLetterCount: number;
  processingLeaseTimeoutMinutes: number;
  oldestPendingAt: string | null;
  oldestPendingAgeHours: number | null;
  oldestProcessingAt: string | null;
  oldestProcessingAgeMinutes: number | null;
  staleProcessingCount: number;
  oldestStaleProcessingAt: string | null;
  oldestStaleProcessingAgeMinutes: number | null;
  lastDeadLetterAt: string | null;
  topDeadLetterEvents: OutboxSummaryBucket[];
  maxAlertLevel: number;
  alerts: OutboxAlertView[];
  recommendations: OutboxOpsRecommendationView[];
};

export type OutboxRetryAttemptView = {
  id: string;
  eventId: string;
  eventName: EventName;
  actorUserId: string;
  previousStatus: OutboxEventStatus;
  previousAttempts: number;
  lastError: string | null;
  retriedAt: string;
};

export type OutboxRetryBatchResult = {
  retriedCount: number;
  eventName: EventName | null;
  events: OutboxEventView[];
};

export type OutboxAlertDispatchResult = {
  dispatchedCount: number;
  skippedCount: number;
  minimumAlertLevel: number;
  alerts: OutboxAlertDispatchView[];
};

export type ReputationUpdatedEventPayload = {
  trigger: "task_lifecycle" | "arbitration";
  action: "accept" | "default" | "cancel" | "none";
  taskId: string;
  actorUserId: string;
  userIds: string[];
  arbitrationCaseId?: string | null;
};

export type UserWalletSnapshot = {
  balances: Record<CurrencyKey, WalletBalance>;
  recentEntryCount: number;
};

export type MailboxSnapshot = {
  totalMessages: number;
  unreadMessages: number;
  pendingAttachments: number;
};

export type AgentSnapshot = {
  totalAgents: number;
  enabledAgents: number;
  externalAgents: number;
  capabilityCount: number;
  activeExecutions: number;
};

export type AssetSnapshot = {
  totalItems: number;
  activeItems: number;
  listedItems: number;
};

export type UserProgressionSourceKey =
  | "registration"
  | "trustLevel"
  | "dailyReward"
  | "dailyMission"
  | "weeklyMission"
  | "taskApplication"
  | "taskCreated"
  | "taskCompleted"
  | "itemOwned"
  | "opinionCreated"
  | "opinionParticipated"
  | "agentCreated"
  | "agentCapability";

export type UserProgressionBenefitKind = "discount" | "qualification" | "access" | "governance";

export type UserProgressionBenefit = {
  key: string;
  kind: UserProgressionBenefitKind;
  title: string;
  description: string;
};

export type UserProgressionAccessKey = "createOpinionTopic" | "createPlatformAgent" | "createExternalAgent";

export type UserProgressionAccessRule = {
  key: UserProgressionAccessKey;
  title: string;
  minLevel: number;
  minLevelTitle: string;
  satisfied: boolean;
  note: string;
};

export type UserProgressionExperienceSource = {
  key: UserProgressionSourceKey;
  label: string;
  experience: number;
  metricValue: number;
};

export type UserProgressionLevelPreview = {
  level: number;
  title: string;
  minExperience: number;
  rewardDiscountRate: number;
  benefits: UserProgressionBenefit[];
};

export type UserProgressionSnapshot = {
  level: number;
  title: string;
  experience: number;
  currentLevelMinExperience: number;
  nextLevelExperience: number | null;
  experienceToNextLevel: number | null;
  progressRate: number;
  rewardDiscountRate: number;
  benefits: UserProgressionBenefit[];
  access: UserProgressionAccessRule[];
  nextLevelPreview: UserProgressionLevelPreview | null;
  sources: UserProgressionExperienceSource[];
};

export type UserSnapshot = {
  wallet?: UserWalletSnapshot | null;
  mailbox?: MailboxSnapshot | null;
  agents?: AgentSnapshot | null;
  assets?: AssetSnapshot | null;
  progression?: UserProgressionSnapshot | null;
};

export type UserSummary = {
  id: string;
  provider: "linuxdo";
  providerUserId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  profileTagline: string | null;
  honorShowcasedAgentIds: string[] | null;
  honorShowcasedProjectIds: string[] | null;
  honorShowcasedInvestmentProjectIds: string[] | null;
  honorShowcasedIssueIds: string[] | null;
  honorShowcasedInvestmentIssueIds: string[] | null;
  trustLevel: number | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  snapshot?: UserSnapshot | null;
};

export type EmailDeliveryMode = "console" | "smtp";

export type EmailIdentityView = {
  id: string;
  email: string;
  normalizedEmail: string;
  isPrimary: boolean;
  invocationEnabled: boolean;
  deliveryEnabled: boolean;
  verifiedAt: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailIdentityVerificationStatus = "pending" | "verified" | "expired" | "canceled";

export type EmailIdentityVerificationView = {
  id: string;
  email: string;
  normalizedEmail: string;
  status: EmailIdentityVerificationStatus;
  markAsPrimary: boolean;
  requestedAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type StartEmailIdentityVerificationInput = {
  email: string;
  makePrimary?: boolean | null;
};

export type StartEmailIdentityVerificationResult = {
  verification: EmailIdentityVerificationView;
  debugCode: string | null;
};

export type ConfirmEmailIdentityVerificationInput = {
  email: string;
  code: string;
};

export type ConfirmEmailIdentityVerificationResult = {
  identity: EmailIdentityView;
};

export type EmailNativeRouteKind = "agent_execution" | "task_create";

export type EmailNativeInboundStatus = "accepted" | "rejected" | "duplicate";

export type EmailNativeInboundMessageView = {
  id: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  routeKind: EmailNativeRouteKind | null;
  status: EmailNativeInboundStatus;
  rejectionReason: string | null;
  createdTaskId: string | null;
  createdExecutionId: string | null;
  receivedAt: string;
  createdAt: string;
};

export type EmailNativeRouteInstructionView = {
  routeKind: EmailNativeRouteKind;
  title: string;
  addressPattern: string;
  description: string;
  metadataKeys: string[];
};

export type EmailNativeRouteCatalogView = {
  ingressDomain: string;
  deliveryMode: EmailDeliveryMode;
  taskDefaults: {
    rewardCurrency: Extract<CurrencyKey, "obsidian" | "mira">;
    rewardAmount: number;
    requiredBondAmount: number;
    pricingMode: "flat_task" | "token_metered" | "property_metered";
    operationMode: "manual" | "automatic";
  };
  instructions: EmailNativeRouteInstructionView[];
};

export type EmailNativePanelView = {
  deliveryMode: EmailDeliveryMode;
  identities: EmailIdentityView[];
  pendingVerifications: EmailIdentityVerificationView[];
  recentInboundMessages: EmailNativeInboundMessageView[];
  routeCatalog: EmailNativeRouteCatalogView;
};

export type EmailProviderInboundProcessingState = "received" | "processed" | "failed";

export type EmailProviderInboundMessageView = {
  id: string;
  provider: string;
  processingState: EmailProviderInboundProcessingState;
  providerEventId: string | null;
  providerMessageId: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  attachmentCount: number;
  canonicalInboundMessageId: string | null;
  canonicalInboundStatus: EmailNativeInboundStatus | null;
  canonicalRejectionReason: string | null;
  lastError: string | null;
  receivedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUserProfile = {
  username: string;
  avatarUrl: string | null;
  profileTagline: string | null;
  trustLevel: number | null;
  createdAt: string;
  reputation: {
    score: number;
    tier: ReputationTier;
    completionRate: number;
  } | null;
  progression: {
    level: number;
    experience: number;
    nextLevelExperience: number | null;
  } | null;
  showcasedAgentIds: string[] | null;
  showcasedProjectIds: string[] | null;
  showcasedIssueIds: string[] | null;
};

export type UpdateUserProfileInput = {
  profileTagline?: string | null;
  honorShowcasedAgentIds?: string[] | null;
  honorShowcasedProjectIds?: string[] | null;
  honorShowcasedInvestmentProjectIds?: string[] | null;
  honorShowcasedIssueIds?: string[] | null;
  honorShowcasedInvestmentIssueIds?: string[] | null;
};

export type ReputationTier = "bronze" | "silver" | "gold" | "platinum";

export type ReputationSummary = {
  userId: string;
  reputationScore: number;
  completedTaskCount: number;
  defaultedTaskCount: number;
  cancelledTaskCount: number;
  activeTaskCount: number;
  favorableArbitrationCount: number;
  unfavorableArbitrationCount: number;
  completionRate: number;
  defaultRate: number;
  tier: ReputationTier;
  updatedAt: string;
};

export type ReputationScoreFactors = {
  baseScore: number;
  trustBonus: number;
  completedContribution: number;
  defaultedPenalty: number;
  cancelledPenalty: number;
  activeContribution: number;
  arbitrationWinBonus: number;
  arbitrationLossPenalty: number;
};

export type ReputationBreakdown = {
  userId: string;
  factors: ReputationScoreFactors;
  inputs: {
    completedTaskCount: number;
    defaultedTaskCount: number;
    cancelledTaskCount: number;
    activeTaskCount: number;
    favorableArbitrationCount: number;
    unfavorableArbitrationCount: number;
    trustLevel: number | null;
  };
  completionRate: number;
  defaultRate: number;
  reputationScore: number;
  tier: ReputationTier;
  updatedAt: string;
};

export type ReputationHistoryPoint = {
  id: string;
  userId: string;
  reputationScore: number;
  tier: ReputationTier;
  completionRate: number;
  defaultRate: number;
  completedTaskCount: number;
  defaultedTaskCount: number;
  cancelledTaskCount: number;
  activeTaskCount: number;
  favorableArbitrationCount: number;
  unfavorableArbitrationCount: number;
  trustLevel: number;
  factors: ReputationScoreFactors;
  recordedAt: string;
};

export type DailyRewardStatus = {
  rewardCurrency: Extract<CurrencyKey, "mira">;
  rewardAmount: number;
  streakDays: number;
  todayClaimed: boolean;
  lastClaimedAt: string | null;
  nextEligibleAt: string | null;
};

export type DailyRewardClaimResult = {
  rewardCurrency: Extract<CurrencyKey, "mira">;
  claimedAmount: number;
  streakDays: number;
  claimedAt: string;
};

export const dailyMissionKeys = ["taskApply", "mailClaim", "productPurchase"] as const;

export type DailyMissionKey = (typeof dailyMissionKeys)[number];

export type DailyMissionView = {
  key: DailyMissionKey;
  title: string;
  description: string;
  rewardCurrency: Extract<CurrencyKey, "mira">;
  rewardAmount: number;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  claimed: boolean;
};

export type DailyMissionClaimResult = {
  missionKey: DailyMissionKey;
  rewardCurrency: Extract<CurrencyKey, "mira">;
  claimedAmount: number;
  claimedAt: string;
};

export const weeklyMissionKeys = ["dailyCheckIn", "taskApply", "productPurchase", "opinionSupport"] as const;

export type WeeklyMissionKey = (typeof weeklyMissionKeys)[number];

export type WeeklyMissionView = {
  key: WeeklyMissionKey;
  title: string;
  description: string;
  rewardCurrency: Extract<CurrencyKey, "mira">;
  rewardAmount: number;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  claimed: boolean;
  weekKey: string;
};

export type WeeklyMissionClaimResult = {
  missionKey: WeeklyMissionKey;
  rewardCurrency: Extract<CurrencyKey, "mira">;
  claimedAmount: number;
  claimedAt: string;
  weekKey: string;
};

export type OpinionTopicStatus = "collecting" | "qualified" | "archived";
export type OpinionDifficultyLevel = 1 | 2 | 3 | 4 | 5;
export const opinionTopicTagKeys = [
  "uiOptimization",
  "newFeature",
  "channelExpansion",
  "flowOptimization",
  "performance",
  "other",
] as const;
export type OpinionTopicTag = (typeof opinionTopicTagKeys)[number];
export type OpinionTopicReviewStatus =
  | "published"
  | "pending_review"
  | "rejected"
  | "banned"
  | "deleted";
export type OpinionTopicDiscussionStatus = "open" | "closed";
export type OpinionTopicSortMode = "governance" | "supportRate" | "createdAt";
export type OpinionModerationReasonCategory =
  | "clean"
  | "pre_moderation"
  | "invalid"
  | "political"
  | "abuse"
  | "manual";

export type OpinionTopicView = {
  id: string;
  title: string;
  summary: string;
  description: string;
  requirements: string | null;
  tags: OpinionTopicTag[];
  creatorUserId: string;
  creatorUsername: string;
  difficultyLevel: OpinionDifficultyLevel;
  creationTicketCost: number;
  targetSupportCount: number;
  supportTicketTotal: number;
  opposeTicketTotal: number;
  uniqueSupporterCount: number;
  uniqueOpposerCount: number;
  supportProgressRate: number;
  supportRate: number;
  supportRateThreshold: number;
  status: OpinionTopicStatus;
  reviewStatus: OpinionTopicReviewStatus;
  discussionStatus: OpinionTopicDiscussionStatus;
  moderationReasonCategory: OpinionModerationReasonCategory | null;
  moderationReasonDetail: string | null;
  moderationNote: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  commentCount: number;
  lastCommentedAt: string | null;
  adoptedAt: string | null;
  adoptedByUserId: string | null;
  archivedAt: string | null;
  bannedAt: string | null;
  deletedAt: string | null;
  canArchive: boolean;
  canAdopt: boolean;
  canSupport: boolean;
  canOppose: boolean;
  canComment: boolean;
  rankingScore: number;
  createdAt: string;
  updatedAt: string;
};

export type OpinionTopicCommentView = {
  id: string;
  topicId: string;
  authorUserId: string;
  authorUsername: string;
  parentCommentId: string | null;
  replyToCommentId: string | null;
  replyToUserId: string | null;
  replyToUsername: string | null;
  content: string;
  ticketCost: number;
  createdAt: string;
  updatedAt: string;
};

export type OpinionTopicMonthlyLeaderView = {
  rank: number;
  topicId: string;
  title: string;
  supportRate: number;
  supportTicketTotal: number;
  uniqueSupporterCount: number;
};

export type OpinionMonthlySettlementItemStatus = "selected" | "standby" | "excluded";

export type OpinionMonthlySettlementItemView = {
  id: string;
  monthKey: string;
  rank: number;
  topicId: string;
  title: string;
  supportRate: number;
  supportTicketTotal: number;
  uniqueSupporterCount: number;
  queueItemId: string | null;
  selectionStatus: OpinionMonthlySettlementItemStatus;
  selectedOrder: number | null;
  operatorNote: string | null;
  operatorActionedAt: string | null;
  operatorActionedByUserId: string | null;
};

export type OpinionMonthlySettlementRunView = {
  monthKey: string;
  candidateCount: number;
  selectedCount: number;
  selectionLimit: number;
  settledAt: string;
  updatedAt: string;
};

export type OpinionMonthlySettlementRunDetailView = {
  run: OpinionMonthlySettlementRunView;
  items: OpinionMonthlySettlementItemView[];
};

export type OpinionTopicListView = {
  topics: OpinionTopicView[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sort: OpinionTopicSortMode;
  monthlyLeaders: OpinionTopicMonthlyLeaderView[];
};

export type OpinionTopicDetailView = {
  topic: OpinionTopicView;
  comments: OpinionTopicCommentView[];
};

export type OpinionTopicSupportSummaryView = {
  topicId: string;
  ticketAmount: number;
  supportCount: number;
  lastSupportedAt: string;
};

export type OpinionTopicOpposeSummaryView = {
  topicId: string;
  ticketAmount: number;
  opposeCount: number;
  lastOpposedAt: string;
};

export type CreateOpinionTopicInput = {
  title: string;
  description: string;
  tag: OpinionTopicTag;
};

export type SupportOpinionTopicInput = {
  topicId: string;
  ticketAmount: number;
};

export type OpposeOpinionTopicInput = {
  topicId: string;
  ticketAmount: number;
};

export type CreateOpinionTopicCommentInput = {
  topicId: string;
  content: string;
  replyToCommentId?: string | null;
};

export type OpinionHubSettingsView = {
  preModerationEnabled: boolean;
  commentTicketCost: number;
  updatedAt: string;
  updatedByUserId: string | null;
};

export type OpinionMonthlySettlementResultView = {
  monthKey: string;
  settledCount: number;
  queuedCount: number;
  skipped: boolean;
  queueItemIds: string[];
};

export type UpdateOpinionMonthlySettlementItemInput = {
  action: "exclude" | "restore";
  note?: string | null;
};

export type UpdateOpinionHubSettingsInput = {
  preModerationEnabled: boolean;
};

export type ModerateOpinionTopicInput = {
  action:
    | "approve"
    | "reject"
    | "ban"
    | "stopDiscussion"
    | "resumeDiscussion"
    | "delete";
  note?: string | null;
};

export type AgentSourceType = "platform" | "external";
export type AgentAuthMode = "none" | "apiKey" | "bearer";
export type AgentCallbackCompatibilityWindowState = "none" | "active" | "expired";
export const agentCallbackRemediationPolicyKeys = ["manual_only", "safe_retry", "balanced", "aggressive"] as const;
export type AgentCallbackRemediationPolicyKey = (typeof agentCallbackRemediationPolicyKeys)[number];

export const agentExecutionCallbackReplayFallbackProfileKeys = [
  "none",
  "safe_structural",
  "extended_structural",
  "custom",
] as const;
export type AgentExecutionCallbackReplayFallbackProfileKey =
  (typeof agentExecutionCallbackReplayFallbackProfileKeys)[number];

export const agentExecutionCallbackReplayFailureClasses = [
  "stored_payload_unavailable",
  "callback_secret_unavailable",
  "duplicate_replay_cooldown",
  "agent_disabled",
  "callback_not_retryable",
  "unsupported_target",
  "callback_protocol_mismatch",
] as const;
export type AgentExecutionCallbackReplayFailureClass =
  (typeof agentExecutionCallbackReplayFailureClasses)[number];

export const agentExecutionCallbackReplayCompatibilityPolicyKeys = [
  "current_only",
  "allow_legacy_payload",
  "allow_compat_window",
] as const;
export type AgentExecutionCallbackReplayCompatibilityPolicyKey =
  (typeof agentExecutionCallbackReplayCompatibilityPolicyKeys)[number];

export type AgentCallbackRemediationPolicyView = {
  key: AgentCallbackRemediationPolicyKey;
  label: string;
  autoRemediationEnabled: boolean;
  autoReplayStoredPayload: boolean;
  fallbackRetryRequestEnabled: boolean;
  replayCompatibilityPolicyKey: AgentExecutionCallbackReplayCompatibilityPolicyKey;
  allowedReplayPayloadCompatibilities: Array<"current" | "legacy_normalized">;
  allowReplayFromPreviousProtocolWindow: boolean;
  allowReplayFromPreviousSecretWindow: boolean;
  fallbackRetryRequestReplayFailureProfileKey: AgentExecutionCallbackReplayFallbackProfileKey;
  fallbackRetryRequestReplayFailureClasses: AgentExecutionCallbackReplayFailureClass[];
  maxAttempts: number;
  baseBackoffSeconds: number;
  allowedRejectionCategories: AgentExecutionCallbackRejectionCategory[];
  fallbackRetryRequestCategories: AgentExecutionCallbackRejectionCategory[];
  note: string;
};

export const canonicalAgentHostingModes = ["managed_light", "managed_heavy", "open_protocol"] as const;
export type CanonicalAgentHostingMode = (typeof canonicalAgentHostingModes)[number];

export const legacyAgentHostingModes = ["registry_only", "external_runtime", "managed_api"] as const;
export type LegacyAgentHostingMode = (typeof legacyAgentHostingModes)[number];

export const agentHostingModes = [
  "managed_light",
  "managed_heavy",
  "open_protocol",
  "registry_only",
  "external_runtime",
  "managed_api",
] as const;
export type AgentHostingMode = (typeof agentHostingModes)[number];

export const agentMarketplaceListingStatuses = ["draft", "published", "paused"] as const;
export type AgentMarketplaceListingStatus = (typeof agentMarketplaceListingStatuses)[number];

export const agentMarketplaceBillingModes = ["flat_task", "token_metered", "property_metered"] as const;
export type AgentMarketplaceBillingMode = (typeof agentMarketplaceBillingModes)[number];

export type AgentView = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  sourceType: AgentSourceType;
  hostingMode: AgentHostingMode;
  runtimeEndpoint: string | null;
  authMode: AgentAuthMode;
  runtimeAuthTokenPreview: string | null;
  managedServiceId: string | null;
  managedProviderLabel: string | null;
  managedApiBaseUrl: string | null;
  managedModel: string | null;
  managedApiKeyPreview: string | null;
  managedSystemPrompt: string | null;
  managedPromptTemplate: string | null;
  managedTaskCategory: string | null;
  managedCapabilitySummary: string | null;
  externalCallbackConfigured: boolean;
  externalCallbackSecretPreview: string | null;
  externalCallbackRotatedAt: string | null;
  externalCallbackProtocolVersion: number;
  externalCallbackPreviousProtocolVersion: number | null;
  externalCallbackProtocolGraceUntil: string | null;
  externalCallbackProtocolWindowState: AgentCallbackCompatibilityWindowState;
  externalCallbackSecretVersion: number;
  externalCallbackPreviousSecretVersion: number | null;
  externalCallbackSecretGraceUntil: string | null;
  externalCallbackSecretWindowState: AgentCallbackCompatibilityWindowState;
  externalCallbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey;
  externalCallbackRemediationPolicy: AgentCallbackRemediationPolicyView;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentCallbackConfigChangeType =
  | "agent_created"
  | "secret_rotated"
  | "protocol_updated"
  | "remediation_policy_updated"
  | "compatibility_cleaned";

export type AgentCallbackConfigHistoryView = {
  id: string;
  agentId: string;
  actorUserId: string;
  changeType: AgentCallbackConfigChangeType;
  previousProtocolVersion: number | null;
  nextProtocolVersion: number | null;
  previousSecretVersion: number | null;
  nextSecretVersion: number | null;
  graceUntil: string | null;
  note: string | null;
  createdAt: string;
};

export type AgentCallbackHealthSummaryBucket = {
  key: string;
  count: number;
};

export type AgentCallbackHealthSummaryView = {
  agentId: string;
  windowHours: number;
  totalCallbacks: number;
  acceptedCallbacks: number;
  duplicateCallbacks: number;
  rejectedCallbacks: number;
  currentProtocolHits: number;
  previousProtocolHits: number;
  currentSecretHits: number;
  previousSecretHits: number;
  lastReceivedAt: string | null;
  byCallbackType: AgentCallbackHealthSummaryBucket[];
};

export type AgentCallbackCompatibilitySummaryView = {
  totalExternalAgents: number;
  activeProtocolWindowCount: number;
  expiredProtocolWindowCount: number;
  expiringProtocolWindowCount: number;
  activeSecretWindowCount: number;
  expiredSecretWindowCount: number;
  expiringSecretWindowCount: number;
  latestActiveGraceUntil: string | null;
  latestExpiredAt: string | null;
};

export type AgentCallbackCompatibilityCleanupResult = {
  cleanedCount: number;
  protocolClearedCount: number;
  secretClearedCount: number;
  cleanedAgents: Array<{
    agentId: string;
    ownerUserId: string;
    protocolCleared: boolean;
    secretCleared: boolean;
  }>;
};

export type AgentRecentCallbackView = {
  id: string;
  agentId: string;
  executionId: string;
  executionTitle: string;
  executionStatus: AgentExecutionStatus;
  callbackId: string;
  callbackType: AgentExecutionCallbackType;
  auditStatus: AgentExecutionCallbackAuditStatus;
  callbackVersion: number;
  secretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  callbackTimestamp: string | null;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  retryability: AgentExecutionCallbackRetryability | null;
  retryHint: string | null;
  payloadSummary: string | null;
  receivedAt: string;
  lastRemediationMode: AgentExecutionCallbackRemediationMode | null;
  lastRemediationStatus: AgentExecutionCallbackRemediationAttemptStatus | null;
  lastRemediationAt: string | null;
};

export type AgentCapabilityView = {
  id: string;
  agentId: string;
  code: string;
  title: string;
  description: string | null;
  routingSummary: string | null;
  routingTags: string[];
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  resourceNormalizationPrompt: string | null;
  pricingNote: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentMarketplaceListingView = {
  id: string;
  ownerUserId: string;
  agentId: string;
  agentName: string;
  agentHostingMode: AgentHostingMode;
  capabilityId: string;
  capabilityCode: string;
  capabilityTitle: string;
  routingSummary: string | null;
  routingTags: string[];
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  publicTitle: string;
  publicDescription: string | null;
  billingMode: AgentMarketplaceBillingMode;
  billingUnit: string | null;
  meterKey: string | null;
  priceCurrency: ProductCurrency;
  priceAmount: number;
  status: AgentMarketplaceListingStatus;
  externalInvocationEnabled: boolean;
  autoTakeEnabled: boolean;
  autoTakeStatementTemplate: string | null;
  lastAutoProposalSweepAt: string | null;
  lastAutoProposalCreatedCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertAgentMarketplaceListingInput = {
  capabilityId: string;
  publicTitle: string;
  publicDescription?: string | null;
  billingMode?: AgentMarketplaceBillingMode;
  billingUnit?: string | null;
  meterKey?: string | null;
  priceCurrency: ProductCurrency;
  priceAmount: number;
  status?: AgentMarketplaceListingStatus;
  externalInvocationEnabled?: boolean;
  autoTakeEnabled?: boolean;
  autoTakeStatementTemplate?: string | null;
};

export type UpdateAgentMarketplaceListingStatusInput = {
  status: AgentMarketplaceListingStatus;
};

export type AgentMarketplaceAutoProposalSweepResult = {
  scannedListingCount: number;
  matchedTaskCount: number;
  createdProposalCount: number;
  skippedTaskCount: number;
  proposalTaskIds: string[];
  skippedTaskIds: string[];
};

export type AgentMarketplaceInvocationSnapshotView = {
  listingId: string;
  supplierUserId: string;
  capabilityId: string;
  capabilityCode: string;
  capabilityTitle: string;
  publicTitle: string;
  billingMode: AgentMarketplaceBillingMode;
  billingUnit: string | null;
  meterKey: string | null;
  meterQuantity: number;
  priceCurrency: ProductCurrency;
  unitPriceAmount: number;
  quotedAmount: number;
  invokedAt: string;
};

export type InvokeAgentMarketplaceListingInput = {
  title: string;
  objective: string;
  inputResourcePayload?: Record<string, unknown> | null;
  meterQuantity?: number | null;
  runtimeProfileKey?: AgentExecutionRuntimeProfileKey | null;
};

export type InvokeAgentMarketplaceListingResult = {
  execution: AgentExecutionView;
  dispatchState: "queued" | "running" | "completed" | "failed" | "cancelled";
  dispatchMessage: string | null;
};

export type TaskAgentProposalView = {
  id: string;
  taskId: string;
  proposerUserId: string;
  agentId: string;
  statement: string;
  proposedEtaHours: number;
  proposedCostNote: string | null;
  status: "pending" | "accepted" | "rejected";
  executionId: string | null;
  matchedCapabilityCodes: string[];
  matchedCapabilityCount: number;
  canAccept: boolean;
  canReject: boolean;
  createdAt: string;
};

export type CreateTaskAgentProposalInput = {
  agentId: string;
  statement: string;
  proposedEtaHours: number;
  proposedCostNote?: string;
};

export type AgentExecutionStatus =
  | "queued"
  | "running"
  | "submitted"
  | "completed"
  | "failed"
  | "cancelled";
export type PlatformExecutionPhase = "queued" | "prepare" | "produce_artifact" | "finalize" | "done";

export type AgentExecutionCallbackType = "heartbeat" | "status" | "artifact" | "callback";
export type AgentExecutionCallbackAuditStatus = "accepted" | "duplicate" | "rejected";
export type AgentExecutionCallbackRejectionCategory =
  | "invalid_secret"
  | "invalid_signature"
  | "invalid_timestamp"
  | "invalid_version"
  | "invalid_payload"
  | "processing_conflict"
  | "unsupported_target"
  | "unknown";
export type AgentExecutionCallbackRetryability = "retryable" | "inspect" | "not_retryable";

export type AgentExecutionArtifactKind = "link" | "note";

export type AgentExecutionOutputKind = "status_report" | "artifact_bundle" | "runtime_result";

export type AgentExecutionOutputEnvelope = {
  version: number;
  kind: AgentExecutionOutputKind;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  generatedAt: string | null;
};

export type AgentExecutionArtifactView = {
  id: string;
  executionId: string;
  kind: AgentExecutionArtifactKind;
  title: string;
  url: string | null;
  summary: string | null;
  createdAt: string;
};

export type AgentExecutionStepKind = "phase" | "artifact" | "status";
export type AgentExecutionStepStatus = "info" | "completed" | "failed";

export type AgentExecutionStepView = {
  id: string;
  executionId: string;
  kind: AgentExecutionStepKind;
  phase: PlatformExecutionPhase | null;
  title: string;
  detail: string | null;
  status: AgentExecutionStepStatus;
  progressPercent: number | null;
  costUnits: number;
  createdAt: string;
};

export type AgentExecutionSubtaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type AgentExecutionRuntimeProfileKey = "baseline" | "iterative" | "deep_runtime";

export type AgentExecutionRuntimeProfileView = {
  key: AgentExecutionRuntimeProfileKey;
  label: string;
  description: string;
  targetArtifactCount: number;
  artifactsPerAdvance: number;
  nearLimitArtifactsPerAdvanceCap: number;
  maxAutoRecoveryCount: number;
  maxConcurrentExecutions: number | null;
  maxConcurrentExecutionsPerOwner: number | null;
  nearLimitPhaseAdvancesPerRunCap: number;
  nearLimitPreparePassesCap: number;
  nearLimitFinalizePassesCap: number;
  preparePassesRequired: number;
  finalizePassesRequired: number;
  phaseAdvancesPerRun: number;
  budgetCostUnits: number | null;
  budgetResourceMinutes: number | null;
  pricingPolicyKey: string;
  pricingPolicyVersion: number;
  revenueContractKey: string;
  revenueContractVersion: number;
  artifactMode: "single_bundle" | "checklist_progressive";
  runtimePlanVersion: number;
};

export const agentExecutionRuntimePressureLevels = ["healthy", "watch", "critical"] as const;

export type AgentExecutionRuntimePressureLevel = (typeof agentExecutionRuntimePressureLevels)[number];

export const agentExecutionRuntimeSchedulingDecisionClasses = [
  "within_capacity",
  "queue_backlog",
  "profile_saturated",
  "owner_hotspot",
  "profile_and_owner_saturated",
] as const;

export type AgentExecutionRuntimeSchedulingDecisionClass =
  (typeof agentExecutionRuntimeSchedulingDecisionClasses)[number];

export type AgentExecutionRuntimeProfileUtilizationView = {
  key: AgentExecutionRuntimeProfileKey;
  maxConcurrentExecutions: number | null;
  maxConcurrentExecutionsPerOwner: number | null;
  runningExecutionCount: number;
  queuedExecutionCount: number;
  claimableQueuedExecutionCount: number;
  blockedQueuedExecutionCount: number;
  blockedByProfileCount: number;
  blockedByOwnerCount: number;
  blockedOwnerCount: number;
  availableExecutionSlots: number | null;
  busiestOwnerUserId: string | null;
  busiestOwnerRunningCount: number | null;
  busiestBlockedOwnerUserId: string | null;
  busiestBlockedOwnerQueuedCount: number | null;
  saturatedOwnerCount: number;
  pressureLevel: AgentExecutionRuntimePressureLevel;
  schedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass;
  pressureDetail: string;
};

export type AgentExecutionRuntimeSummaryBucket = {
  key: string;
  count: number;
};

export type AgentExecutionPricingPolicyView = {
  key: string;
  label: string;
  version: number;
  currency: CurrencyKey;
  costUnitsPerCurrency: number;
  includedCostUnits: number;
  minimumBilledAmount: number;
  maxBilledAmount: number | null;
  allowPartialFinalize: boolean;
  minimumArtifactsBeforePartialFinalize: number;
  revenueSharePercent: number;
  treasuryUserId: string;
};

export type AgentExecutionRevenueContractView = {
  key: string;
  label: string;
  version: number;
  revenueSharePercent: number;
  minimumPayoutAmount: number;
  treasuryUserId: string;
  revenueRecipientMode: "agent_owner" | "platform_only";
};

export type AgentExecutionRuntimeCatalogView = {
  runtimeProfiles: AgentExecutionRuntimeProfileView[];
  pricingPolicies: AgentExecutionPricingPolicyView[];
  revenueContracts: AgentExecutionRevenueContractView[];
  utilization: AgentExecutionRuntimeProfileUtilizationView[];
};

export const agentExecutionLaunchPresetFocusSections = [
  "active-preset",
  "launch-presets",
  "create-execution",
  "runtime-sessions",
  "cost-overview",
  "execution-list",
] as const;

export type AgentExecutionLaunchPresetFocusSection =
  (typeof agentExecutionLaunchPresetFocusSections)[number];

export type AgentExecutionLaunchPresetView = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  preferredAgentId: string | null;
  preferredAgentName: string | null;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  runtimeProfile: AgentExecutionRuntimeProfileView;
  callbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey | null;
  callbackRemediationPolicy: AgentCallbackRemediationPolicyView | null;
  titleTemplate: string | null;
  objectiveTemplate: string | null;
  launchGuidance: string | null;
  followUpExecutionStatus: AgentExecutionStatus | null;
  followUpRunKind: AgentExecutionRunKind | null;
  followUpRunStatus: AgentExecutionRunStatus | null;
  followUpFailureCategory: AgentExecutionRunFailureCategory | null;
  followUpRecentWindow: AgentExecutionRecentWindowKey | null;
  followUpCallbackStatus: AgentExecutionCallbackAuditStatus | null;
  followUpCallbackRetryability: AgentExecutionCallbackRetryability | null;
  followUpCallbackType: AgentExecutionCallbackType | null;
  followUpCallbackRejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  followUpReplayPayloadCompatibility: AgentExecutionStoredReplayPayloadCompatibility | null;
  followUpReplayPayloadReplayable: boolean | null;
  followUpDecisionClass: AgentExecutionCallbackRemediationDecisionClass | null;
  followUpReplayFailureClass: AgentExecutionCallbackReplayFailureClass | null;
  followUpRuntimeDecisionClass: AgentExecutionRuntimeDecisionClass | null;
  followUpRuntimeDecisionSeverity: AgentExecutionRuntimeDecisionSeverity | null;
  followUpPressureLevel: AgentExecutionRuntimePressureLevel | null;
  followUpSchedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
  followUpRuntimeSessionKind: AgentExecutionRuntimeSessionKind | null;
  followUpRuntimeSessionState: AgentExecutionRuntimeSessionState | null;
  focusSection: AgentExecutionLaunchPresetFocusSection | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionBudgetStatus = "no_budget" | "within_budget" | "near_limit" | "exceeded";

export type AgentExecutionCostSummaryView = {
  totalCostUnits: number;
  totalStepCostUnits: number;
  totalResourceMinutes: number;
  totalEstimatedAmount: number;
  estimatedRemainingCostUnits: number;
  budgetCostUnits: number | null;
  budgetResourceMinutes: number | null;
  budgetStatus: AgentExecutionBudgetStatus;
};

export type AgentExecutionRuntimeDecisionSeverity = "info" | "warning" | "critical";

export type AgentExecutionRuntimeDecisionClass =
  | "prepare_continue"
  | "prepare_near_limit_cap"
  | "prepare_timeout_accelerated"
  | "artifact_batch_continue"
  | "artifact_batch_downshift_near_limit"
  | "artifact_finalize_early_near_limit"
  | "artifact_finalize_early_timeout"
  | "artifact_finalize_early_headroom"
  | "artifact_partial_finalize_blocked"
  | "finalize_continue"
  | "finalize_near_limit_cap"
  | "finalize_timeout_accelerated"
  | "finalize_completed";

export type AgentExecutionRuntimeDecisionView = {
  phase: PlatformExecutionPhase;
  decisionClass: AgentExecutionRuntimeDecisionClass;
  severity: AgentExecutionRuntimeDecisionSeverity;
  title: string;
  detail: string;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey | null;
  pricingPolicyKey: string | null;
  budgetStatus: AgentExecutionBudgetStatus | null;
  nearLimit: boolean;
  pricingNearLimit: boolean | null;
  phaseTimeoutApproaching: boolean;
  adaptiveFinalize: boolean;
  partialArtifactCompletion: boolean;
  artifactCount: number | null;
  targetArtifactCount: number | null;
  requestedArtifactsToProduce: number | null;
  plannedArtifactsToProduce: number | null;
  nearLimitArtifactsPerAdvanceCap: number | null;
  preparePassNumber: number | null;
  preparePassesRequired: number | null;
  finalizePassNumber: number | null;
  finalizePassesRequired: number | null;
};

export type AgentExecutionSubtaskView = {
  id: string;
  executionId: string;
  parentSubtaskId: string | null;
  title: string;
  detail: string | null;
  status: AgentExecutionSubtaskStatus;
  managedByRuntime: boolean;
  runtimePhase: PlatformExecutionPhase | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canUpdateStatus: boolean;
};

export type AgentExecutionObjectiveChecklistEntry = {
  order: number;
  text: string;
  runtimePhase: PlatformExecutionPhase | null;
};

export type AgentExecutionView = {
  id: string;
  ownerUserId: string;
  agentId: string;
  capabilityId: string | null;
  agentSourceType: AgentSourceType;
  taskId: string | null;
  title: string;
  objective: string;
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  inputResourcePayload: Record<string, unknown> | null;
  normalizedResourcePayload: Record<string, unknown> | null;
  outputResourcePayload: Record<string, unknown> | null;
  status: AgentExecutionStatus;
  statusNote: string | null;
  resultSummary: string | null;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  runtimeProfile: AgentExecutionRuntimeProfileView;
  callbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey;
  callbackRemediationPolicy: AgentCallbackRemediationPolicyView;
  callbackRemediationPolicySource: "agent" | "execution";
  callbackRemediationPolicyOverrideKey: AgentCallbackRemediationPolicyKey | null;
  targetArtifactCount: number;
  executorPhase: PlatformExecutionPhase | null;
  progressPercent: number | null;
  phaseTimeoutSeconds: number | null;
  phaseAgeSeconds: number | null;
  phaseOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  lastExternalCallbackAt: string | null;
  lastHeartbeatAt: string | null;
  autoRecoveryCount: number;
  maxAutoRecoveryCount: number;
  recoveryExhaustedAt: string | null;
  totalCostUnits: number;
  costByRunKind: AgentExecutionCostBucket[];
  totalStepCostUnits: number;
  costByStepKind: AgentExecutionCostBucket[];
  estimatedRemainingCostUnits: number;
  costSummary: AgentExecutionCostSummaryView;
  settlement: AgentExecutionSettlementView | null;
  marketplaceInvocation: AgentMarketplaceInvocationSnapshotView | null;
  output: AgentExecutionOutputEnvelope | null;
  runtimeDecision: AgentExecutionRuntimeDecisionView | null;
  artifacts: AgentExecutionArtifactView[];
  steps: AgentExecutionStepView[];
  subtasks: AgentExecutionSubtaskView[];
  runtimeSessions: AgentExecutionRuntimeSessionView[];
  callbacks: AgentExecutionCallbackAuditView[];
  runs: AgentExecutionRunView[];
  canUpdateStatus: boolean;
  canRequeue: boolean;
};

export type AgentExecutionSettlementStatus = "pending" | "settled" | "pending_insufficient_balance" | "skipped";

export type AgentExecutionSettlementLineItemKind =
  | "owner_charge"
  | "revenue_share"
  | "run_cost"
  | "step_cost";

export type AgentExecutionSettlementLineItemView = {
  id: string;
  settlementId: string;
  executionId: string;
  ownerUserId: string;
  agentId: string;
  lineKind: AgentExecutionSettlementLineItemKind;
  title: string;
  scopeType: "run" | "step" | "settlement" | null;
  scopeId: string | null;
  costUnits: number;
  amount: number;
  createdAt: string;
};

export type AgentExecutionSettlementView = {
  id: string;
  executionId: string;
  ownerUserId: string;
  agentId: string;
  currency: CurrencyKey;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  pricingPolicyKey: string;
  pricingPolicyVersion: number;
  revenueContractKey: string;
  revenueContractVersion: number;
  revenueRecipientMode: "agent_owner" | "platform_only";
  costUnitsPerCurrency: number;
  revenueSharePercent: number;
  treasuryUserId: string;
  measuredCostUnits: number;
  includedCostUnits: number;
  billedCostUnits: number;
  minimumBilledAmount: number;
  billedAmount: number;
  revenueRecipientUserId: string | null;
  minimumPayoutAmount: number;
  revenueAmount: number;
  status: AgentExecutionSettlementStatus;
  note: string | null;
  lastError: string | null;
  lastAttemptAt: string | null;
  settledAt: string | null;
  lineItems: AgentExecutionSettlementLineItemView[];
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionSettlementAttemptStatus =
  | "settled"
  | "pending"
  | "pending_insufficient_balance"
  | "skipped";

export type AgentExecutionSettlementAttemptView = {
  id: string;
  settlementId: string;
  executionId: string;
  ownerUserId: string;
  agentId: string;
  currency: CurrencyKey;
  billedAmount: number;
  revenueAmount: number;
  status: AgentExecutionSettlementAttemptStatus;
  note: string | null;
  error: string | null;
  createdAt: string;
};

export type AgentExecutionSettlementSummaryView = {
  pendingCount: number;
  pendingInsufficientBalanceCount: number;
  settledCount: number;
  skippedCount: number;
  totalBilledAmount: number;
  totalRevenueAmount: number;
  recentAttempts: AgentExecutionSettlementAttemptView[];
};

export type AgentExecutionRunStatus = "running" | "completed" | "failed";

export type AgentExecutionRunKind =
  | "platform_executor"
  | "requeue"
  | "recovery"
  | "callback_retry_request"
  | "callback_payload_replay"
  | "callback_auto_remediation";

export type AgentExecutionRunView = {
  id: string;
  executionId: string;
  agentId: string;
  ownerUserId: string;
  runKind: AgentExecutionRunKind;
  status: AgentExecutionRunStatus;
  failureCategory: AgentExecutionRunFailureCategory | null;
  summary: string | null;
  errorMessage: string | null;
  artifactCount: number;
  costUnits: number;
  resourceMinutes: number;
  estimatedAmount: number;
  createdAt: string;
  finishedAt: string | null;
};

export type AgentExecutionCostBucket = {
  key: string;
  costUnits: number;
};

export type AgentExecutionOperatorRunView = AgentExecutionRunView & {
  executionTitle: string;
  executionStatus: AgentExecutionStatus;
  executionUpdatedAt: string;
  executorPhase: PlatformExecutionPhase | null;
  progressPercent: number | null;
  agentName: string;
  agentSourceType: AgentSourceType;
  callbackAuditId: string | null;
  failureCategory: AgentExecutionRunFailureCategory | null;
  runtimeDecision: AgentExecutionRuntimeDecisionView | null;
};

export type AgentExecutionRunFailureCategory =
  | "stale_timeout"
  | "executor_failure"
  | "requeue_failure"
  | "unknown_failure";

export type AgentExecutionRunSummaryBucket = {
  key: string;
  count: number;
};

export type AgentExecutionRecentWindowKey = "15m" | "1h" | "24h";

export type AgentExecutionRecentWindowView = {
  key: AgentExecutionRecentWindowKey;
  totalCount: number;
  failedCount: number;
};

export type AgentExecutionOperatorRecommendationSeverity = "info" | "warning" | "danger";

export type AgentExecutionRuntimePressureAlertView = {
  profileKey: AgentExecutionRuntimeProfileKey;
  pressureLevel: AgentExecutionRuntimePressureLevel;
  schedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass;
  alertLevel: number;
  severity: AgentExecutionOperatorRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  runningExecutionCount: number;
  queuedExecutionCount: number;
  claimableQueuedExecutionCount: number;
  blockedQueuedExecutionCount: number;
  blockedByProfileCount: number;
  blockedByOwnerCount: number;
  blockedOwnerCount: number;
  availableExecutionSlots: number | null;
  maxConcurrentExecutions: number | null;
  maxConcurrentExecutionsPerOwner: number | null;
  busiestOwnerUserId: string | null;
  busiestOwnerRunningCount: number | null;
  busiestBlockedOwnerUserId: string | null;
  busiestBlockedOwnerQueuedCount: number | null;
  saturatedOwnerCount: number;
};

export type AgentExecutionRuntimePressureAlertDispatchView = AgentExecutionRuntimePressureAlertView & {
  dispatched: boolean;
  skippedReason: string | null;
};

export type AgentExecutionRuntimePressureAlertSummaryView = {
  profileCount: number;
  queuedExecutionCount: number;
  claimableQueuedExecutionCount: number;
  blockedQueuedExecutionCount: number;
  blockedByProfileCount: number;
  blockedByOwnerCount: number;
  blockedOwnerCount: number;
  criticalProfileCount: number;
  watchProfileCount: number;
  saturatedOwnerCount: number;
  byPressureLevel: AgentExecutionRuntimeSummaryBucket[];
  bySchedulingDecisionClass: AgentExecutionRuntimeSummaryBucket[];
  byAlertLevel: AgentExecutionRuntimeSummaryBucket[];
  maxAlertLevel: number;
  alerts: AgentExecutionRuntimePressureAlertView[];
};

export type AgentExecutionRuntimePressureAlertDispatchResult = {
  dispatchedCount: number;
  skippedCount: number;
  minimumAlertLevel: number;
  alerts: AgentExecutionRuntimePressureAlertDispatchView[];
};

export type AgentExecutionOperatorRecommendationKind =
  | "recover_then_run"
  | "recover_stale"
  | "run_executor"
  | "inspect_failures";

export type AgentExecutionOperatorRecommendationView = {
  kind: AgentExecutionOperatorRecommendationKind;
  severity: AgentExecutionOperatorRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  suggestedLimit: number | null;
  suggestedExecutorLimit: number | null;
  suggestedStaleSeconds: number | null;
  failureCategory: AgentExecutionRunFailureCategory | null;
  recentWindow: AgentExecutionRecentWindowKey | null;
  runStatus: AgentExecutionRunStatus | null;
};

export type AgentExecutionOperatorRunSummaryView = {
  totalCount: number;
  failedCount: number;
  totalCostUnits: number;
  newestCreatedAt: string | null;
  byRunKind: AgentExecutionRunSummaryBucket[];
  byRunKindCost: AgentExecutionCostBucket[];
  byRunStatus: AgentExecutionRunSummaryBucket[];
  byExecutionStatus: AgentExecutionRunSummaryBucket[];
  byExecutionPhase: AgentExecutionRunSummaryBucket[];
  byFailureCategory: AgentExecutionRunSummaryBucket[];
  recentWindows: AgentExecutionRecentWindowView[];
  recommendations: AgentExecutionOperatorRecommendationView[];
};

export type PlatformExecutionRecoveryResult = {
  recoveredCount: number;
  exhaustedCount: number;
  staleSeconds: number;
  results: Array<{
    executionId: string;
    ownerUserId: string;
    action: "requeued" | "exhausted";
    runId: string;
  }>;
};

export type PlatformExecutionRunResult = {
  processedCount: number;
  failedCount: number;
  results: Array<{
    executionId: string;
    ownerUserId: string;
    phase: PlatformExecutionPhase | null;
    runId: string | null;
  }>;
  failures: Array<{
    executionId: string;
    message: string;
    runId: string | null;
  }>;
};

export type AgentExecutionCallbackRetryRequestResult = {
  auditId: string;
  executionId: string;
  agentId: string;
  callbackId: string;
  runId: string;
  operatorUserId: string;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  note: string | null;
  requestedAt: string;
};

export type AgentExecutionCallbackRetryBatchResult = {
  requestedCount: number;
  skippedCount: number;
  retryability: AgentExecutionCallbackRetryability | null;
  results: AgentExecutionCallbackRetryRequestResult[];
  skippedAuditIds: string[];
};

export type AgentExecutionCallbackReplayResult = {
  auditId: string;
  executionId: string;
  agentId: string;
  callbackId: string;
  replayCallbackId: string;
  callbackType: AgentExecutionCallbackType;
  replayPayloadCompatibility: AgentExecutionStoredReplayPayloadCompatibility | null;
  runId: string;
  operatorUserId: string;
  replayedAt: string;
};

export type AgentExecutionCallbackAutoRemediationResult = {
  remediatedCount: number;
  requestedRetryCount: number;
  skippedCount: number;
  failedCount: number;
  results: AgentExecutionCallbackReplayResult[];
  requestedRetryAuditIds: string[];
  skippedAuditIds: string[];
  failedAuditIds: string[];
};

export type AgentExecutionCallbackAutoRemediationState = "idle" | "scheduled" | "exhausted";

export type AgentExecutionCallbackAutoRemediationReasonCategory =
  | "policy_disabled"
  | "missing_rejection_category"
  | "policy_budget_exhausted"
  | "missing_agent"
  | "missing_payload"
  | "incompatible_payload"
  | "compatibility_policy_blocked"
  | "compat_window_blocked"
  | "policy_not_covered"
  | "duplicate_cooldown"
  | "target_unavailable"
  | "attempt_failed";

export type AgentExecutionCallbackAutoRemediationReasonDisposition = "skipped" | "failed";

export type AgentExecutionCallbackRemediationMode =
  | "retry_request"
  | "auto_retry_request"
  | "manual_payload_replay"
  | "auto_payload_replay";

export type AgentExecutionCallbackRemediationAttemptStatus = "running" | "completed" | "failed";

export type AgentExecutionCallbackRemediationAttemptView = {
  id: string;
  callbackAuditId: string;
  executionId: string;
  agentId: string;
  runId: string | null;
  actorUserId: string;
  mode: AgentExecutionCallbackRemediationMode;
  status: AgentExecutionCallbackRemediationAttemptStatus;
  plannedDecisionClass: AgentExecutionCallbackRemediationDecisionClass | null;
  plannedPrimaryAction: AgentExecutionCallbackRemediationPlannedAction | null;
  plannedFallbackAction: Extract<AgentExecutionCallbackRemediationPlannedAction, "request_retry"> | null;
  planReasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory | null;
  planReason: string | null;
  fallbackFailureClass: AgentExecutionCallbackReplayFailureClass | null;
  fallbackReason: string | null;
  note: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type AgentExecutionStoredReplayPayloadCompatibility = "current" | "legacy_normalized" | "invalid";

export type AgentExecutionCallbackRemediationPlannedAction = "replay_payload" | "request_retry" | "skip";

export type AgentExecutionCallbackRemediationDecisionClass =
  | "replay_current_payload"
  | "replay_legacy_payload"
  | "retry_missing_payload"
  | "retry_incompatible_payload"
  | "retry_compatibility_policy"
  | "retry_compat_window"
  | "retry_policy_preferred"
  | "skip_policy_disabled"
  | "skip_missing_rejection_category"
  | "skip_policy_budget_exhausted"
  | "skip_missing_payload"
  | "skip_incompatible_payload"
  | "skip_compatibility_policy"
  | "skip_compat_window"
  | "skip_policy_not_covered"
  | "skip_target_unavailable";

export type AgentExecutionCallbackRemediationPlanView = {
  primaryAction: AgentExecutionCallbackRemediationPlannedAction;
  fallbackAction: Extract<AgentExecutionCallbackRemediationPlannedAction, "request_retry"> | null;
  decisionClass: AgentExecutionCallbackRemediationDecisionClass;
  reasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory | null;
  reason: string;
  trace: string[];
};

export type AgentExecutionCallbackRuntimeContextView = {
  runtimeProfileKey: AgentExecutionRuntimeProfileKey | null;
  ownerUserId: string | null;
  runtimeDecisionClass: AgentExecutionRuntimeDecisionClass | null;
  runtimeDecisionSeverity: AgentExecutionRuntimeDecisionSeverity | null;
  runtimePressureLevel: AgentExecutionRuntimePressureLevel | null;
  runtimeSchedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
};

export type AgentExecutionCallbackAuditView = {
  id: string;
  executionId: string;
  agentId: string;
  remediationPolicyKey: AgentCallbackRemediationPolicyKey;
  callbackId: string;
  callbackType: AgentExecutionCallbackType;
  status: AgentExecutionCallbackAuditStatus;
  callbackVersion: number;
  secretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  callbackTimestamp: string | null;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  retryability: AgentExecutionCallbackRetryability | null;
  retryHint: string | null;
  payloadSummary: string | null;
  replayPayloadStored: boolean;
  replayPayloadReplayable: boolean;
  replayPayloadCompatibility: AgentExecutionStoredReplayPayloadCompatibility | null;
  replayPayloadSchemaVersion: number | null;
  remediationPlan: AgentExecutionCallbackRemediationPlanView;
  autoRemediationAttempts: number;
  lastAutoRemediationAt: string | null;
  nextAutoRemediationAt: string | null;
  autoRemediationExhaustedAt: string | null;
  autoRemediationLastError: string | null;
  autoRemediationState: AgentExecutionCallbackAutoRemediationState;
  autoRemediationReasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory | null;
  autoRemediationReasonDisposition: AgentExecutionCallbackAutoRemediationReasonDisposition | null;
  runtimeContext: AgentExecutionCallbackRuntimeContextView | null;
  receivedAt: string;
  remediationAttempts: AgentExecutionCallbackRemediationAttemptView[];
};

export type AgentExecutionCallbackAuditSummaryBucket = {
  key: string;
  count: number;
};

export type AgentExecutionCallbackAuditRecommendationKind =
  | "inspect_previous_protocol"
  | "inspect_previous_secret"
  | "inspect_duplicates"
  | "inspect_rejected";

export type AgentExecutionCallbackAuditRecommendationView = {
  kind: AgentExecutionCallbackAuditRecommendationKind;
  severity: AgentExecutionOperatorRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  protocolMatch: "current" | "previous" | null;
  secretMatch: "current" | "previous" | null;
  status: AgentExecutionCallbackAuditStatus | null;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  retryability: AgentExecutionCallbackRetryability | null;
};

export type AgentExecutionCallbackAuditSummaryView = {
  totalCount: number;
  newestReceivedAt: string | null;
  byCallbackType: AgentExecutionCallbackAuditSummaryBucket[];
  byStatus: AgentExecutionCallbackAuditSummaryBucket[];
  byCallbackVersion: AgentExecutionCallbackAuditSummaryBucket[];
  bySecretVersion: AgentExecutionCallbackAuditSummaryBucket[];
  byProtocolMatch: AgentExecutionCallbackAuditSummaryBucket[];
  bySecretMatch: AgentExecutionCallbackAuditSummaryBucket[];
  byRejectionCategory: AgentExecutionCallbackAuditSummaryBucket[];
  byRetryability: AgentExecutionCallbackAuditSummaryBucket[];
  byRemediationPolicyKey: AgentExecutionCallbackAuditSummaryBucket[];
  byAutoRemediationState: AgentExecutionCallbackAuditSummaryBucket[];
  recommendations: AgentExecutionCallbackAuditRecommendationView[];
};

export type AgentExecutionCallbackRemediationRecommendationKind = "inspect_reason";

export type AgentExecutionCallbackRemediationRecommendationView = {
  kind: AgentExecutionCallbackRemediationRecommendationKind;
  severity: AgentExecutionOperatorRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  reasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory | null;
  reasonDisposition: AgentExecutionCallbackAutoRemediationReasonDisposition | null;
  policyKey: AgentCallbackRemediationPolicyKey | null;
};

export type AgentExecutionCallbackRemediationAlertView = {
  count: number;
  alertLevel: number;
  severity: AgentExecutionOperatorRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  reasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory | null;
  reasonDisposition: AgentExecutionCallbackAutoRemediationReasonDisposition | null;
  policyKey: AgentCallbackRemediationPolicyKey | null;
};

export type AgentExecutionCallbackRemediationAlertDispatchView = AgentExecutionCallbackRemediationAlertView & {
  dispatched: boolean;
  skippedReason: string | null;
};

export type AgentExecutionCallbackRemediationSummaryView = {
  candidateCount: number;
  replayPayloadStoredCount: number;
  replayPayloadReplayableCount: number;
  replayPayloadLegacyCompatibleCount: number;
  replayPayloadInvalidCount: number;
  latestFailureAt: string | null;
  nextDueAt: string | null;
  runtimeDecisionPresentCount: number;
  runtimePressureContextCount: number;
  byDecisionClass: AgentExecutionCallbackAuditSummaryBucket[];
  byPlannedAction: AgentExecutionCallbackAuditSummaryBucket[];
  byFallbackAction: AgentExecutionCallbackAuditSummaryBucket[];
  byReplayFailureClass: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimeDecisionClass: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimeDecisionSeverity: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimePressureLevel: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimeSchedulingDecisionClass: AgentExecutionCallbackAuditSummaryBucket[];
  byCallbackType: AgentExecutionCallbackAuditSummaryBucket[];
  byRejectionCategory: AgentExecutionCallbackAuditSummaryBucket[];
  byRetryability: AgentExecutionCallbackAuditSummaryBucket[];
  byPolicyKey: AgentExecutionCallbackAuditSummaryBucket[];
  byAutoRemediationState: AgentExecutionCallbackAuditSummaryBucket[];
  byAlertLevel: AgentExecutionCallbackAuditSummaryBucket[];
  maxAlertLevel: number;
  bySkipReason: AgentExecutionCallbackAuditSummaryBucket[];
  byFailureReason: AgentExecutionCallbackAuditSummaryBucket[];
  alerts: AgentExecutionCallbackRemediationAlertView[];
  recommendations: AgentExecutionCallbackRemediationRecommendationView[];
};

export type AgentExecutionCallbackRemediationAlertDispatchResult = {
  dispatchedCount: number;
  skippedCount: number;
  minimumAlertLevel: number;
  alerts: AgentExecutionCallbackRemediationAlertDispatchView[];
};

export type AgentExecutionRuntimeSessionKind = "platform_executor" | "stale_recovery" | "owner_requeue";
export type AgentExecutionRuntimeSessionState = "running" | "completed" | "failed" | "requeued";

export type AgentExecutionRuntimeSessionView = {
  id: string;
  executionId: string;
  ownerUserId: string;
  agentId: string;
  executionTitle: string;
  executionStatus: AgentExecutionStatus;
  runId: string | null;
  kind: AgentExecutionRuntimeSessionKind;
  state: AgentExecutionRuntimeSessionState;
  trigger: "worker_loop" | "auto_recovery" | "owner_requeue";
  startedPhase: PlatformExecutionPhase | null;
  endedPhase: PlatformExecutionPhase | null;
  executorPhase: PlatformExecutionPhase | null;
  progressPercent: number | null;
  phaseTimeoutSeconds: number | null;
  phaseAgeSeconds: number | null;
  phaseOverdue: boolean;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
};

export type AgentExecutionRuntimeSessionSummaryView = {
  totalCount: number;
  openCount: number;
  staleOpenCount: number;
  terminalExecutionOpenCount: number;
  oldestOpenStartedAt: string | null;
  oldestStaleStartedAt: string | null;
  byKind: AgentExecutionCallbackAuditSummaryBucket[];
  byState: AgentExecutionCallbackAuditSummaryBucket[];
  openByKind: AgentExecutionCallbackAuditSummaryBucket[];
  openByState: AgentExecutionCallbackAuditSummaryBucket[];
  recommendations: AgentExecutionRuntimeSessionRecommendationView[];
};

export type AgentExecutionRuntimeSessionRecommendationKind =
  | "inspect_stale_open_sessions"
  | "sweep_terminal_open_sessions"
  | "inspect_owner_requeue_sessions"
  | "inspect_stale_recovery_sessions"
  | "inspect_failed_runtime_sessions";

export const agentExecutionRuntimeSessionRecommendationActionKinds = [
  "inspect_runtime_session_slice",
  "sweep_runtime_sessions",
] as const;

export type AgentExecutionRuntimeSessionRecommendationActionKind =
  (typeof agentExecutionRuntimeSessionRecommendationActionKinds)[number];

export type AgentExecutionRuntimeSessionRecommendationView = {
  kind: AgentExecutionRuntimeSessionRecommendationKind;
  severity: AgentExecutionOperatorRecommendationSeverity;
  title: string;
  detail: string;
  actionKind: AgentExecutionRuntimeSessionRecommendationActionKind;
  actionLabel: string;
  runtimeState: AgentExecutionRuntimeSessionState | null;
  runtimeKind: AgentExecutionRuntimeSessionKind | null;
  staleOnly: boolean | null;
  suggestedLimit: number | null;
  suggestedStaleSeconds: number | null;
};

export type AgentExecutionRuntimeSessionSweepResult = {
  closedCount: number;
  skippedCount: number;
  staleSeconds: number;
  latestSweepAt: string;
  closedSessionIds: string[];
};

export type AgentExecutionOwnerReliefRunSummary = {
  sweepClosedCount: number;
  sweepSkippedCount: number;
  recoveredCount: number;
  exhaustedCount: number;
  processedCount: number;
  failedCount: number;
  recoveryExecutionIds: string[];
  recoveryRunIds: string[];
  executorExecutionIds: string[];
  executorRunIds: string[];
};

export const agentExecutionOwnerReliefRunActionKinds = [
  "open_session",
  "open_handoff",
  "resolve_handoff",
  "reopen_session",
  "sweep",
  "recover",
  "run",
  "recover_then_run",
  "finalize_closeout",
] as const;

export type AgentExecutionOwnerReliefRunActionKind =
  (typeof agentExecutionOwnerReliefRunActionKinds)[number];

export type AgentExecutionOwnerReliefRunActionStatus = "success" | "error";

export const agentExecutionOwnerReliefRunHandoffTargetTypes = [
  "runtime_pressure",
  "execution_run_watch",
  "runtime_session_watch",
  "callback_audits",
  "external_note",
] as const;

export type AgentExecutionOwnerReliefRunHandoffTargetType =
  (typeof agentExecutionOwnerReliefRunHandoffTargetTypes)[number];

export type AgentExecutionOwnerReliefHandoffDefaultView = {
  operatorUserId: string;
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType;
  handoffTarget: string;
  noteTemplate: string | null;
  followUpFocusSection: AgentExecutionOwnerReliefHandoffFocusSection | null;
  followUpProfile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null;
  createdAt: string;
  updatedAt: string;
};

export const agentExecutionOwnerReliefHandoffFocusSections = [
  "runtime-pressure",
  "execution-run-watch",
  "runtime-session-watch",
  "callback-audits",
] as const;

export type AgentExecutionOwnerReliefHandoffFocusSection =
  (typeof agentExecutionOwnerReliefHandoffFocusSections)[number];

export const agentExecutionOwnerReliefHandoffFollowUpProfiles = [
  "inspect_only",
  "resolve_after_review",
  "reopen_after_review",
] as const;

export type AgentExecutionOwnerReliefHandoffFollowUpProfile =
  (typeof agentExecutionOwnerReliefHandoffFollowUpProfiles)[number];

export const agentExecutionOwnerReliefRunHandoffStatuses = [
  "pending",
  "opened",
  "resolved",
  "reopened",
] as const;

export type AgentExecutionOwnerReliefRunHandoffStatus =
  (typeof agentExecutionOwnerReliefRunHandoffStatuses)[number];

export type AgentExecutionOwnerReliefRunHandoffView = {
  id: string;
  runId: string;
  operatorUserId: string;
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType;
  handoffTarget: string;
  followUpFocusSection: AgentExecutionOwnerReliefHandoffFocusSection | null;
  followUpProfile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null;
  status: AgentExecutionOwnerReliefRunHandoffStatus;
  latestFollowUpHref: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  resultNote: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  reopenedRunId: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const agentExecutionOwnerReliefRunResultStatuses = [
  "active",
  "continue",
  "observe",
  "escalate",
  "handed_off",
] as const;

export type AgentExecutionOwnerReliefRunResultStatus =
  (typeof agentExecutionOwnerReliefRunResultStatuses)[number];

export type AgentExecutionOwnerReliefRunView = {
  id: string;
  operatorUserId: string;
  ownerUserId: string;
  agentId: string | null;
  triggerAction: Exclude<
    AgentExecutionOwnerReliefRunActionKind,
    "open_session" | "reopen_session" | "finalize_closeout"
  > | null;
  source: string | null;
  runtimePressureLevel: AgentExecutionRuntimePressureLevel | null;
  runtimeSchedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
  actionCount: number;
  openingSummary: AgentExecutionOwnerReliefRunSummary;
  latestSummary: AgentExecutionOwnerReliefRunSummary;
  resultStatus: AgentExecutionOwnerReliefRunResultStatus;
  resultNote: string | null;
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType | null;
  handoffTarget: string | null;
  reopenedFromRunId: string | null;
  supersededByRunId: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  startedAt: string;
  lastActionAt: string | null;
  updatedAt: string;
  handoffSession: AgentExecutionOwnerReliefRunHandoffView | null;
};

export type AgentExecutionOwnerReliefRunActionView = {
  id: string;
  runId: string;
  operatorUserId: string;
  actionKind: AgentExecutionOwnerReliefRunActionKind;
  status: AgentExecutionOwnerReliefRunActionStatus;
  title: string;
  detail: string | null;
  summary: AgentExecutionOwnerReliefRunSummary;
  createdAt: string;
};

export type StartAgentExecutionOwnerReliefRunInput = {
  ownerUserId: string;
  agentId?: string | null;
  triggerAction?: Exclude<
    AgentExecutionOwnerReliefRunActionKind,
    "open_session" | "reopen_session" | "finalize_closeout"
  > | null;
  source?: string | null;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel | null;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass | null;
};

export type RecordAgentExecutionOwnerReliefRunActionInput = {
  actionKind: Exclude<
    AgentExecutionOwnerReliefRunActionKind,
    "open_session" | "reopen_session" | "finalize_closeout"
  >;
  status?: AgentExecutionOwnerReliefRunActionStatus;
  title: string;
  detail?: string | null;
  summary: AgentExecutionOwnerReliefRunSummary;
};

export type FinalizeAgentExecutionOwnerReliefRunInput = {
  resultStatus: Exclude<AgentExecutionOwnerReliefRunResultStatus, "active">;
  note?: string | null;
  handoffTargetType?: AgentExecutionOwnerReliefRunHandoffTargetType | null;
  handoffTarget?: string | null;
};

export type UpsertAgentExecutionOwnerReliefHandoffDefaultInput = {
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType;
  handoffTarget: string;
  noteTemplate?: string | null;
  followUpFocusSection?: AgentExecutionOwnerReliefHandoffFocusSection | null;
  followUpProfile?: AgentExecutionOwnerReliefHandoffFollowUpProfile | null;
};

export type OpenAgentExecutionOwnerReliefRunHandoffInput = {
  followUpHref?: string | null;
};

export type ResolveAgentExecutionOwnerReliefRunHandoffInput = {
  note?: string | null;
};

export type ListAgentExecutionOwnerReliefRunsInput = {
  ownerUserId?: string | null;
  agentId?: string | null;
  resultStatus?: AgentExecutionOwnerReliefRunResultStatus | null;
  limit?: number | null;
};

export type ArbitrationViewerImpact = "favorable" | "unfavorable" | "neutral";

export type CreateAgentExecutionInput = {
  agentId: string;
  title: string;
  objective: string;
  capabilityId?: string | null;
  inputResourcePayload?: Record<string, unknown> | null;
  runtimeProfileKey?: AgentExecutionRuntimeProfileKey | null;
  callbackRemediationPolicyKey?: AgentCallbackRemediationPolicyKey | null;
};

export type CreateAgentExecutionLaunchPresetInput = {
  name: string;
  description?: string | null;
  isDefault?: boolean;
  preferredAgentId?: string | null;
  runtimeProfileKey?: AgentExecutionRuntimeProfileKey | null;
  callbackRemediationPolicyKey?: AgentCallbackRemediationPolicyKey | null;
  titleTemplate?: string | null;
  objectiveTemplate?: string | null;
  launchGuidance?: string | null;
  followUpExecutionStatus?: AgentExecutionStatus | null;
  followUpRunKind?: AgentExecutionRunKind | null;
  followUpRunStatus?: AgentExecutionRunStatus | null;
  followUpFailureCategory?: AgentExecutionRunFailureCategory | null;
  followUpRecentWindow?: AgentExecutionRecentWindowKey | null;
  followUpCallbackStatus?: AgentExecutionCallbackAuditStatus | null;
  followUpCallbackRetryability?: AgentExecutionCallbackRetryability | null;
  followUpCallbackType?: AgentExecutionCallbackType | null;
  followUpCallbackRejectionCategory?: AgentExecutionCallbackRejectionCategory | null;
  followUpReplayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility | null;
  followUpReplayPayloadReplayable?: boolean | null;
  followUpDecisionClass?: AgentExecutionCallbackRemediationDecisionClass | null;
  followUpReplayFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
  followUpRuntimeDecisionClass?: AgentExecutionRuntimeDecisionClass | null;
  followUpRuntimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity | null;
  followUpPressureLevel?: AgentExecutionRuntimePressureLevel | null;
  followUpSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass | null;
  followUpRuntimeSessionKind?: AgentExecutionRuntimeSessionKind | null;
  followUpRuntimeSessionState?: AgentExecutionRuntimeSessionState | null;
  focusSection?: AgentExecutionLaunchPresetFocusSection | null;
};

export type UpdateAgentExecutionLaunchPresetInput = {
  name: string;
  description?: string | null;
  isDefault?: boolean;
  preferredAgentId?: string | null;
  runtimeProfileKey?: AgentExecutionRuntimeProfileKey | null;
  callbackRemediationPolicyKey?: AgentCallbackRemediationPolicyKey | null;
  titleTemplate?: string | null;
  objectiveTemplate?: string | null;
  launchGuidance?: string | null;
  followUpExecutionStatus?: AgentExecutionStatus | null;
  followUpRunKind?: AgentExecutionRunKind | null;
  followUpRunStatus?: AgentExecutionRunStatus | null;
  followUpFailureCategory?: AgentExecutionRunFailureCategory | null;
  followUpRecentWindow?: AgentExecutionRecentWindowKey | null;
  followUpCallbackStatus?: AgentExecutionCallbackAuditStatus | null;
  followUpCallbackRetryability?: AgentExecutionCallbackRetryability | null;
  followUpCallbackType?: AgentExecutionCallbackType | null;
  followUpCallbackRejectionCategory?: AgentExecutionCallbackRejectionCategory | null;
  followUpReplayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility | null;
  followUpReplayPayloadReplayable?: boolean | null;
  followUpDecisionClass?: AgentExecutionCallbackRemediationDecisionClass | null;
  followUpReplayFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
  followUpRuntimeDecisionClass?: AgentExecutionRuntimeDecisionClass | null;
  followUpRuntimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity | null;
  followUpPressureLevel?: AgentExecutionRuntimePressureLevel | null;
  followUpSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass | null;
  followUpRuntimeSessionKind?: AgentExecutionRuntimeSessionKind | null;
  followUpRuntimeSessionState?: AgentExecutionRuntimeSessionState | null;
  focusSection?: AgentExecutionLaunchPresetFocusSection | null;
};

export type ListAgentExecutionLaunchPresetsInput = {
  limit?: number | null;
};

export type AddAgentExecutionArtifactInput = {
  kind: AgentExecutionArtifactKind;
  title: string;
  url?: string | null;
  summary?: string | null;
};

export type CreateAgentExecutionSubtaskInput = {
  title: string;
  detail?: string | null;
  parentSubtaskId?: string | null;
};

export type UpdateAgentExecutionSubtaskStatusInput = {
  status: AgentExecutionSubtaskStatus;
  detail?: string | null;
};

export type UpdateAgentExecutionStatusInput = {
  status: AgentExecutionStatus;
  statusNote?: string;
  resultSummary?: string;
};

export type UpdateAgentExecutionCallbackRemediationPolicyInput = {
  policyKey?: AgentCallbackRemediationPolicyKey | null;
};

export type UpdateAgentCallbackRemediationPolicyInput = {
  policyKey: AgentCallbackRemediationPolicyKey;
};

export type RotateAgentCallbackSecretResult = {
  agent: AgentView;
  callbackSecret: string;
};

export type ExternalAgentHeartbeatInput = {
  type: "heartbeat";
  statusNote?: string;
};

export type ExternalAgentStatusCallbackInput = {
  type: "status";
  status: AgentExecutionStatus;
  statusNote?: string;
  resultSummary?: string;
};

export type ExternalAgentArtifactCallbackInput = {
  type: "artifact";
  artifact: AddAgentExecutionArtifactInput;
};

export type ExternalAgentCallbackInput =
  | ExternalAgentHeartbeatInput
  | ExternalAgentStatusCallbackInput
  | ExternalAgentArtifactCallbackInput;

export type DevelopmentQueueSourceType = "opinionTopic";
export type DevelopmentQueueStatus = "queued" | "planned" | "in_progress" | "completed" | "archived";

export type DevelopmentQueueItemView = {
  id: string;
  sourceType: DevelopmentQueueSourceType;
  sourceId: string;
  ownerUserId: string;
  title: string;
  description: string;
  difficultyLevel: OpinionDifficultyLevel | null;
  supportTicketTotal: number;
  opposeTicketTotal: number;
  supportRate: number;
  priorityScore: number;
  status: DevelopmentQueueStatus;
  queuedAt: string;
  startedAt: string | null;
  deliveredAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
  canUpdateStatus: boolean;
};

export type UpdateDevelopmentQueueStatusInput = {
  status: DevelopmentQueueStatus;
};

export type CreateAgentInput = {
  name: string;
  description?: string | null;
  sourceType: AgentSourceType;
  hostingMode?: AgentHostingMode;
  runtimeEndpoint?: string | null;
  authMode?: AgentAuthMode;
  runtimeAuthToken?: string | null;
  managedServiceId?: string | null;
  managedProviderLabel?: string | null;
  managedApiBaseUrl?: string | null;
  managedModel?: string | null;
  managedApiKey?: string | null;
  managedSystemPrompt?: string | null;
  managedPromptTemplate?: string | null;
  managedTaskCategory?: string | null;
  managedCapabilitySummary?: string | null;
  enabled?: boolean;
};

export type UpdateAgentInput = {
  name: string;
  description?: string | null;
  runtimeEndpoint?: string | null;
  authMode?: AgentAuthMode;
  runtimeAuthToken?: string | null;
  managedServiceId?: string | null;
  managedProviderLabel?: string | null;
  managedApiBaseUrl?: string | null;
  managedModel?: string | null;
  managedApiKey?: string | null;
  managedSystemPrompt?: string | null;
  managedPromptTemplate?: string | null;
  managedTaskCategory?: string | null;
  managedCapabilitySummary?: string | null;
  enabled?: boolean;
};

export type AddAgentCapabilityInput = {
  code: string;
  title: string;
  description?: string | null;
  routingSummary?: string | null;
  routingTags?: string[] | null;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  resourceNormalizationPrompt?: string | null;
  pricingNote?: string | null;
  enabled?: boolean;
};

export type UpdateAgentCapabilityInput = {
  title: string;
  description?: string | null;
  routingSummary?: string | null;
  routingTags?: string[] | null;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  resourceNormalizationPrompt?: string | null;
  pricingNote?: string | null;
  enabled?: boolean;
};

export type ArbitrationEntityType = "task";
export type ArbitrationStatus = "open" | "under_review" | "resolved" | "rejected";
export type ArbitrationTaskResolutionAction = "none" | "accept" | "default" | "cancel";

export type ArbitrationCaseTimelineEventKind =
  | "created"
  | "evidence"
  | "under_review"
  | "resolved"
  | "rejected"
  | "effects_applied";

export type ArbitrationCaseTimelineEntryView = {
  kind: ArbitrationCaseTimelineEventKind;
  title: string;
  detail: string | null;
  occurredAt: string;
};

export type ArbitrationCaseSummaryBucket = {
  key: string;
  count: number;
};

export type ArbitrationCaseSummaryView = {
  totalCount: number;
  awaitingOperatorCount: number;
  resolvedWithEffectsCount: number;
  evidenceCount: number;
  casesWithEvidenceCount: number;
  casesWithoutEvidenceCount: number;
  claimedCount: number;
  unclaimedCount: number;
  remoteAttachmentCount: number;
  cleanupRequestedRemoteAttachmentCount: number;
  archivedRemoteAttachmentCount: number;
  byStatus: ArbitrationCaseSummaryBucket[];
  byEntityType: ArbitrationCaseSummaryBucket[];
  byEvidenceKind: ArbitrationCaseSummaryBucket[];
  byTaskResolutionAction: ArbitrationCaseSummaryBucket[];
  byReputationImpact: ArbitrationCaseSummaryBucket[];
};

export type ArbitrationEvidenceKind = "text_note" | "external_link" | "log_excerpt" | "screenshot_ref";

export type ArbitrationEvidenceView = {
  id: string;
  caseId: string;
  creatorUserId: string;
  kind: ArbitrationEvidenceKind;
  title: string;
  content: string | null;
  url: string | null;
  attachments: ArbitrationEvidenceAttachmentView[];
  createdAt: string;
};

export type ArbitrationEvidenceAttachmentView = {
  id: string;
  evidenceId: string;
  caseId: string;
  uploaderUserId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageMode: "local" | "remote";
  uploadState: ArbitrationEvidenceAttachmentUploadState;
  storagePolicyKey: string | null;
  bucketKey: string | null;
  objectKey: string | null;
  remoteUrl: string | null;
  uploadPreparedAt: string | null;
  preparedUploadExpiresAt: string | null;
  uploadCompletedAt: string | null;
  verifiedAt: string | null;
  verifiedSizeBytes: number | null;
  verifiedContentType: string | null;
  retentionExpiresAt: string | null;
  cleanupRequestedAt: string | null;
  cleanupAttemptCount: number;
  lastCleanupAttemptAt: string | null;
  lastCleanupError: string | null;
  nextCleanupAttemptAt: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
};

export type ArbitrationEvidenceAttachmentAccessView = {
  attachmentId: string;
  url: string;
  expiresAt: string | null;
  direct: boolean;
};

export type ArbitrationEvidenceStoragePolicyView = {
  policyKey: string;
  storageMode: "local" | "remote";
  bucketKey: string | null;
  cleanupMode: "delete_object" | "bucket_lifecycle";
  evidenceKinds: ArbitrationEvidenceKind[];
  remoteProviderKey: string | null;
  remoteUploadStrategy: "local_filesystem" | "server_proxy_put" | "prepared_remote_put";
  remoteBaseUrlConfigured: boolean;
  remoteUploadBaseUrlConfigured: boolean;
  remoteAuthConfigured: boolean;
  prepareUploadSupported: boolean;
  uploadPlanTtlSeconds: number;
  retentionDays: number;
  cleanupMaxAttempts: number;
  cleanupBaseBackoffMinutes: number;
};

export type ArbitrationRemoteAttachmentCleanupCandidateView = {
  attachmentId: string;
  caseId: string;
  evidenceId: string;
  fileName: string;
  caseStatus: ArbitrationStatus;
  storagePolicyKey: string | null;
  bucketKey: string | null;
  retentionExpiresAt: string | null;
  cleanupRequestedAt: string | null;
  cleanupAttemptCount: number;
  lastCleanupAttemptAt: string | null;
  lastCleanupError: string | null;
  nextCleanupAttemptAt: string | null;
  cleanupExhausted: boolean;
  archivedAt: string | null;
  hoursPastRetention: number | null;
  createdAt: string;
};

export type ArbitrationRemoteAttachmentCleanupQueueView = {
  policy: ArbitrationEvidenceStoragePolicyView;
  pendingCount: number;
  dueNowCount: number;
  cleanupRequestedCount: number;
  retryWaitingCount: number;
  exhaustedCount: number;
  failedCount: number;
  oldestRetentionExpiresAt: string | null;
  byCaseStatus: ArbitrationCaseSummaryBucket[];
  byPolicyKey: ArbitrationCaseSummaryBucket[];
  byBucketKey: ArbitrationCaseSummaryBucket[];
  candidates: ArbitrationRemoteAttachmentCleanupCandidateView[];
};

export type ArbitrationCaseView = {
  id: string;
  entityType: ArbitrationEntityType;
  entityId: string;
  requesterUserId: string;
  respondentUserId: string;
  status: ArbitrationStatus;
  reason: string;
  evidenceSummary: string | null;
  resolutionSummary: string | null;
  taskResolutionAction: ArbitrationTaskResolutionAction | null;
  reputationImpactForViewer: ArbitrationViewerImpact;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  effectsAppliedAt: string | null;
  assignedOperatorUserId: string | null;
  claimedAt: string | null;
  claimAgeHours: number | null;
  isStaleClaim: boolean;
  currentReviewRoundNumber: number;
  canUpdateStatus: boolean;
  canAddEvidence: boolean;
  canClaim: boolean;
  canRelease: boolean;
  canAdvanceReviewRound: boolean;
  evidences: ArbitrationEvidenceView[];
  reviewRounds: ArbitrationReviewRoundView[];
  timeline: ArbitrationCaseTimelineEntryView[];
};

export type ArbitrationReviewRoundStatus = "open" | "completed";

export type ArbitrationReviewRoundView = {
  id: string;
  caseId: string;
  roundNumber: number;
  status: ArbitrationReviewRoundStatus;
  summary: string | null;
  assignedOperatorUserId: string | null;
  startedByUserId: string | null;
  endedByUserId: string | null;
  startedAt: string;
  endedAt: string | null;
  roundAgeHours: number | null;
  isRoundStale: boolean;
};

export type ArbitrationWorkloadAssigneeBucket = {
  key: string;
  claimedCount: number;
  openRoundCount: number;
  avgClaimAgeHours: number | null;
  staleClaimCount: number;
};

export type ArbitrationWorkloadRoundAssigneeBucket = {
  key: string;
  openRoundCount: number;
  staleRoundCount: number;
  avgRoundAgeHours: number | null;
};

export type ArbitrationWorkloadCandidate = {
  caseId: string;
  status: ArbitrationStatus;
  currentReviewRoundNumber: number;
  evidenceCount: number;
  createdAt: string;
};

export type ArbitrationWorkloadView = {
  claimedCount: number;
  unclaimedCount: number;
  unassignedOpenRoundCount: number;
  staleClaimedCount: number;
  staleRoundCount: number;
  oldestStaleRoundAgeHours: number | null;
  mineCount: number;
  byAssignee: ArbitrationWorkloadAssigneeBucket[];
  byRoundAssignee: ArbitrationWorkloadRoundAssigneeBucket[];
  byRoundAgeBucket: ArbitrationCaseSummaryBucket[];
  byStatus: ArbitrationCaseSummaryBucket[];
  byReviewRoundStatus: ArbitrationCaseSummaryBucket[];
  nextClaimCandidate: ArbitrationWorkloadCandidate | null;
  recommendedAssigneeUserId: string | null;
  autoReleaseEnabled: boolean;
  autoReleaseIntervalMinutes: number | null;
};

export type CreateArbitrationCaseInput = {
  entityType: ArbitrationEntityType;
  entityId: string;
  reason: string;
  evidenceSummary?: string | null;
};

export type AdvanceArbitrationReviewRoundInput = {
  summary?: string | null;
  assignToOperatorUserId?: string | null;
};

export type AssignArbitrationCaseInput = {
  assigneeUserId: string;
};

export type ReleaseStaleArbitrationCasesInput = {
  limit?: number;
};

export type UpdateArbitrationCaseStatusInput = {
  status: Exclude<ArbitrationStatus, "open">;
  resolutionSummary?: string | null;
  taskResolutionAction?: ArbitrationTaskResolutionAction;
};

export type CreateArbitrationEvidenceInput = {
  kind: ArbitrationEvidenceKind;
  title: string;
  content?: string | null;
  url?: string | null;
};

export type UploadArbitrationEvidenceAttachmentInput = {
  fileName: string;
  contentType: string;
  base64Content: string;
};

export type PrepareArbitrationEvidenceAttachmentUploadInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type ArbitrationEvidenceAttachmentUploadState = "prepared" | "uploaded" | "archived";

export type ArbitrationEvidenceAttachmentUploadPlanView = {
  attachmentId: string;
  evidenceId: string;
  caseId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageMode: "remote";
  uploadStrategy: "prepared_remote_put";
  storagePolicyKey: string;
  bucketKey: string | null;
  uploadUrl: string;
  uploadMethod: "PUT";
  requiredHeaders: Record<string, string>;
  objectKey: string;
  remoteUrl: string | null;
  expiresAt: string;
  completeUploadRequired: boolean;
};

export type WalletBalance = {
  available: number;
  frozen: number;
};

export type WalletSummary = {
  balances: Record<CurrencyKey, WalletBalance>;
  recentEntries: LedgerEntryView[];
};

export type WalletExchangeDirection = "obsidian_to_mira";

export type WalletAssetCategory = "premium" | "free" | "governance";

export type WalletAssetView = {
  key: CurrencyKey;
  displayName: string;
  shortLabel: string;
  accent: "violet" | "fuchsia" | "cyan";
  category: WalletAssetCategory;
  available: number;
  frozen: number;
  summary: string;
  acquisition: string;
  usage: string;
  rule: string;
};

export type WalletPanelView = {
  assets: WalletAssetView[];
  recentEntries: LedgerEntryView[];
  exchangeDirections: WalletExchangeDirection[];
};

export type WalletExchangeInput = {
  direction: WalletExchangeDirection;
  amount: number;
};

export type WalletExchangeResult = {
  direction: WalletExchangeDirection;
  sourceCurrency: Extract<CurrencyKey, "obsidian">;
  sourceAmount: number;
  targetCurrency: Extract<CurrencyKey, "mira">;
  targetAmount: number;
  rate: number;
  exchangedAt: string;
};

export type LedgerEntryType =
  | "grant"
  | "deduct"
  | "freeze"
  | "unfreeze"
  | "transfer"
  | "refund"
  | "exchange";

export type LedgerEntryView = {
  id: string;
  currency: CurrencyKey;
  entryType: LedgerEntryType;
  amount: number;
  balanceAfterAvailable: number;
  balanceAfterFrozen: number;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type ProductKind = "limitedTime" | "limitedPurchase" | "unlimited";
export type ProductCurrency = Extract<CurrencyKey, "obsidian" | "mira">;
export type FulfillmentMode =
  | "one_time_delivery"
  | "duration_pass"
  | "maintained_pool"
  | "warranty_delivery";
export type GatewayAccessGrantMode = "time_pass" | "token_prepaid" | "message_prepaid";
export type ProductTargetedAudienceGroupKey = "trusted_users" | "new_users";

export type ProductListItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  kind: ProductKind;
  currency: ProductCurrency;
  price: number;
  fulfillmentMode: FulfillmentMode;
  transferable: boolean;
  active: boolean;
  allowDiscountCodes: boolean;
  moduleEnabled: boolean;
  limitScope: "global" | "targeted";
  eligibleToPurchase: boolean;
  purchaseEligibilityNote: string | null;
  unitCount: number | null;
  warrantyDays: number | null;
  tags: string[];
};

export type ProductDetail = ProductListItem & {
  durationDays: number | null;
  stockLabel: string;
};

export type UpsertProductInput = {
  slug: string;
  title: string;
  description: string;
  category: string;
  kind: ProductKind;
  currency: ProductCurrency;
  price: number;
  fulfillmentMode: FulfillmentMode;
  transferable: boolean;
  active: boolean;
  allowDiscountCodes: boolean;
  limitScope: "global" | "targeted";
  targetedAudienceGroupKey: ProductTargetedAudienceGroupKey | null;
  durationDays: number | null;
  unitCount: number | null;
  warrantyDays: number | null;
  stockLabel: string;
  tags: string[];
  gatewayAccessBundleId: string | null;
  gatewayAccessGrantMode: GatewayAccessGrantMode | null;
  gatewayAccessGrantQuantity: number | null;
};

export type ProductOperatorView = UpsertProductInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductOperatorMutationResult = {
  product: ProductOperatorView;
  created: boolean;
  eventName: "product.updated" | "product.deactivated" | null;
  changedFields: string[];
};

export type CreateOrderInput = {
  productId: string;
  discountCode?: string;
};

export type OrderDiscountSource = "none" | "code";

export type OrderView = {
  id: string;
  productId: string;
  productTitle: string;
  currency: ProductCurrency;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  discountCode: string | null;
  discountSource: OrderDiscountSource;
  discountLabel: string | null;
  status: "created" | "fulfilled" | "rolled_back";
  rolledBackAt: string | null;
  rolledBackByUserId: string | null;
  rollbackReason: string | null;
  rollbackNote: string | null;
  createdAt: string;
};

export type RollbackOrderInput = {
  reason?: string | null;
  note?: string | null;
};

export type RollbackOrderResult = {
  order: OrderView;
  items: ItemView[];
  refundedAmount: number;
};

export type DiscountCodeScope = "allProducts" | "productCategory" | "specificProduct";
export type DiscountAudienceScope = "allUsers" | "userGroup" | "specificUser";
export type DiscountValueKind = "fixedAmount" | "percentage";

export type DiscountCodeView = {
  id: string;
  code: string;
  enabled: boolean;
  scope: DiscountCodeScope;
  audienceScope: DiscountAudienceScope;
  valueKind: DiscountValueKind;
  valueAmount: number;
  startsAt: string | null;
  expiresAt: string | null;
  totalMaxUses: number | null;
  totalUsedCount: number;
  perUserLimit: number | null;
};

export type UpsertDiscountCodeInput = {
  code: string;
  namespace: string | null;
  batchLabel: string | null;
  enabled: boolean;
  scope: DiscountCodeScope;
  targetProductCategory: string | null;
  targetProductId: string | null;
  audienceScope: DiscountAudienceScope;
  audienceGroupKey: string | null;
  audienceUserId: string | null;
  valueKind: DiscountValueKind;
  valueAmount: number;
  totalMaxUses: number | null;
  perUserLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
};

export type DiscountCodeOperatorView = UpsertDiscountCodeInput & {
  id: string;
  totalUsedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DiscountCodeOperatorMutationResult = {
  discountCode: DiscountCodeOperatorView;
  created: boolean;
  changedFields: string[];
};

export type DiscountCodeOperatorState =
  | "all"
  | "enabled"
  | "disabled"
  | "expired"
  | "expiring"
  | "activeWindow"
  | "scheduled";

export type ListOperatorDiscountCodesInput = {
  productId?: string | null;
  state?: DiscountCodeOperatorState;
  scope?: DiscountCodeScope | "all";
  audienceScope?: DiscountAudienceScope | "all";
  namespace?: string | null;
  batchLabel?: string | null;
  windowDays?: number | null;
};

export type DiscountCodeBatchAction = "enable" | "disable" | "extendExpiry" | "disableExpired" | "setQuota";

export type ApplyDiscountCodeBatchInput = {
  discountCodeIds: string[];
  action: DiscountCodeBatchAction;
  extendDays: number | null;
  totalMaxUses?: number | null;
  perUserLimit?: number | null;
};

export type DiscountCodeBatchMutationResult = {
  action: DiscountCodeBatchAction;
  requestedCount: number;
  affectedCount: number;
  skippedCount: number;
  discountCodes: DiscountCodeOperatorView[];
};

export type DiscountCodeOperationBatchKind = "generatedTemplate" | "csvImport" | "batchAction";

export type ApplyTaskInput = {
  statement: string;
  proposedEtaHours: number;
};

export type TaskLifecycleAction = "start" | "submit" | "accept" | "default" | "cancel";

export type ItemView = {
  id: string;
  productId: string;
  productTitle: string;
  fulfillmentMode: FulfillmentMode;
  transferable: boolean;
  status: "active" | "listed" | "consumed" | "revoked";
  remainingUses: number | null;
  totalUnits: number | null;
  activeUnits: number | null;
  replacementCount: number;
  warrantyExpiresAt: string | null;
  issueReportingEnabled: boolean;
  units: ItemUnitView[];
  issueReports: ItemIssueReportView[];
  manualReviews: ItemManualReviewView[];
  replacementLogs: ItemReplacementLogView[];
  fulfillmentRuns: ItemFulfillmentRunView[];
  lastReconciledAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  createdAt: string;
};

export type ItemUnitIssueReason = "invalidated" | "expired" | "quota_exhausted" | "normal_exhaustion";

export type ItemIssueReportOutcome = "replaced" | "rejected" | "manual_review";
export type ItemIssueRejectionCode =
  | "warranty_expired"
  | "reason_not_covered"
  | "manual_review_required"
  | "quota_exhausted_not_replaceable"
  | "normal_exhaustion_not_replaceable";
export type ItemReplacementLogTrigger = "issue_report" | "manual_reconcile" | "scheduled_reconcile" | "manual_review";
export type ItemFulfillmentRunTrigger = "manual" | "scheduled";
export type ItemFulfillmentRunStatus = "completed" | "noop";
export type ItemManualReviewStatus = "open" | "approved" | "rejected";
export type ItemManualReviewAction = "approve_replacement" | "reject_report";
export type ItemManualReviewRoutingCode = "high_replacement_frequency" | "usage_audit_required";
export type ItemManualReviewSuggestedAction =
  | "approve_replacement"
  | "reject_report"
  | "inspect_pool_health"
  | "audit_usage";
export type ItemManualReviewPriority = "normal" | "high" | "urgent";
export type ItemManualReviewSlaBucket = "on_track" | "due_soon" | "breached";

export type ItemUnitView = {
  id: string;
  code: string;
  status: "active" | "inactive" | "replaced" | "consumed";
  issueReason: ItemUnitIssueReason | null;
  activatedAt: string | null;
  expiresAt: string | null;
  replacedByUnitId: string | null;
};

export type ItemIssueReportView = {
  id: string;
  itemId: string;
  unitId: string;
  reason: ItemUnitIssueReason;
  outcome: ItemIssueReportOutcome;
  rejectionCode: ItemIssueRejectionCode | null;
  rejectionCategory: "manual_review" | "warranty_window" | "policy_restriction" | "usage_exhaustion" | null;
  rejectionSummary: string | null;
  operatorHint: string | null;
  appealable: boolean;
  replacementUnitId: string | null;
  createdAt: string;
};

export type ItemManualReviewView = {
  id: string;
  itemId: string;
  unitId: string;
  reportId: string;
  slotNumber: number;
  status: ItemManualReviewStatus;
  reason: ItemUnitIssueReason;
  routingCode: ItemManualReviewRoutingCode;
  routingSummary: string;
  suggestedAction: ItemManualReviewSuggestedAction;
  rejectionCode: ItemIssueRejectionCode | null;
  rejectionCategory: "manual_review" | "warranty_window" | "policy_restriction" | "usage_exhaustion" | null;
  rejectionSummary: string | null;
  operatorHint: string | null;
  appealable: boolean;
  assigneeUserId: string | null;
  claimedAt: string | null;
  claimAgeHours: number | null;
  isStaleClaim: boolean;
  lastClaimReleasedAt: string | null;
  lastClaimReleaseReason: "operator_release" | "stale_timeout_release" | null;
  autoAssignmentCount: number;
  lastAutoAssignedAt: string | null;
  escalationLevel: number;
  slaEscalatedAt: string | null;
  priority: ItemManualReviewPriority;
  ageHours: number;
  slaBucket: ItemManualReviewSlaBucket;
  slaBreached: boolean;
  resolutionAction: ItemManualReviewAction | null;
  resolutionNote: string | null;
  reviewerUserId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  canClaim: boolean;
  canRelease: boolean;
  assignmentHistory: ItemManualReviewAssignmentEventView[];
};

export type ItemManualReviewSummaryBucket = {
  key: string;
  count: number;
};

export type ItemFulfillmentAnomalyKind =
  | "manual_review_routed"
  | "reconcile_failure"
  | "stale_manual_review"
  | "sla_due_soon_unclaimed"
  | "sla_breach_unclaimed";

export type ItemFulfillmentAnomalySeverity = "warning" | "critical";

export type ItemFulfillmentAnomalyView = {
  id: string;
  itemId: string;
  reportId: string | null;
  reviewId: string | null;
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  status: "open" | "resolved";
  routingCode: ItemManualReviewRoutingCode | null;
  policyKey: string | null;
  escalationStrategy: string | null;
  autoAction: "none" | "assign_template" | "rebalance_queue";
  autoActionTemplateKey: string | null;
  summary: string;
  detail: string | null;
  detectedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  alertLevel: number;
  alertedAt: string | null;
  lastAlertReason: string | null;
  nextAlertEligibleAt: string | null;
  nextEscalationAt: string | null;
  lastAutoAction: string | null;
  lastAutoActionAt: string | null;
  autoActionAttemptCount: number;
  lastAutoActionStatus: "applied" | "noop" | "failed" | null;
  lastAutoActionError: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export type FulfillmentAnomalyPolicyTemplateView = {
  key: string;
  scope: "routing" | "kind" | "severity" | "default";
  thresholds: number[];
  escalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
  failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
  autoAction: "none" | "assign_template" | "rebalance_queue";
  autoActionTemplateKey: string | null;
  cooldownMinutes: number;
  maxAlertLevel: number;
  maxAutoActionFailures: number;
  anomalyStages: Array<{
    key: string;
    minAgeHours: number;
    appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
    routingCodes: ItemManualReviewRoutingCode[] | null;
    severity: ItemFulfillmentAnomalySeverity | null;
    alertLevel: number | null;
    anomalyPolicyKey: string | null;
    anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
    anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
    autoActionTemplateKey: string | null;
    cooldownMinutes: number | null;
  }>;
  matchingAnomalyCount: number;
};

export type ItemManualReviewSummaryView = {
  openCount: number;
  oldestOpenAt: string | null;
  oldestOpenAgeHours: number | null;
  claimedCount: number;
  unclaimedCount: number;
  staleClaimedCount: number;
  autoReleasedLast24h: number;
  byReason: ItemManualReviewSummaryBucket[];
  byRoutingCode: ItemManualReviewSummaryBucket[];
  bySuggestedAction: ItemManualReviewSummaryBucket[];
  byPriority: ItemManualReviewSummaryBucket[];
  byAgeBucket: ItemManualReviewSummaryBucket[];
  byClaimState: ItemManualReviewSummaryBucket[];
  byClaimAgeBucket: ItemManualReviewSummaryBucket[];
  byAssignee: ItemManualReviewSummaryBucket[];
};

export type ManualReviewWorkloadAssigneeBucket = {
  key: string;
  claimedCount: number;
  processingCount: number;
  avgClaimAgeHours: number | null;
  capacity: number;
  remainingCapacity: number;
  atCapacity: boolean;
};

export type ManualReviewWorkloadCandidate = {
  reviewId: string;
  priority: ItemManualReviewPriority | null;
  slaBucket: ItemManualReviewSlaBucket | null;
  routingCode: ItemManualReviewRoutingCode | null;
  ageHours: number | null;
  templateKey: string | null;
};

export type ManualReviewSlaTemplateView = {
  key: string;
  scope: "routing" | "priority" | "default";
  strategy: "least_loaded" | "priority_first";
  maxAssignments: number;
  assigneePool: string[];
  matchingReviewCount: number;
  anomalyReviewCount: number;
};

export type ManualReviewWorkloadView = {
  byAssignee: ManualReviewWorkloadAssigneeBucket[];
  bySlaBucket: ItemManualReviewSummaryBucket[];
  byPolicy: ItemManualReviewSummaryBucket[];
  unclaimedCount: number;
  breachedUnclaimedCount: number;
  slaBreachedCount: number;
  atCapacityCount: number;
  autoRebalanceEnabled: boolean;
  autoRebalancePool: string[];
  autoRebalanceMaxAssignments: number;
  autoRebalanceIntervalMinutes: number | null;
  recommendedAssigneeUserId: string | null;
  claimNextEta: string | null;
  nextClaimCandidate: ManualReviewWorkloadCandidate | null;
  recommendedAutoAssignments: ManualReviewRebalanceAssignmentView[];
  recentAssignments: ItemManualReviewAssignmentEventView[];
  history: ManualReviewWorkloadSnapshotView[];
  templates: ManualReviewSlaTemplateView[];
  slaPolicies: ManualReviewSlaPolicyTemplateView[];
};

export type ManualReviewWorkloadSnapshotView = {
  id: string;
  source: "manual" | "auto";
  openCount: number;
  unclaimedCount: number;
  breachedUnclaimedCount: number;
  slaBreachedCount: number;
  atCapacityCount: number;
  recommendedAssigneeUserId: string | null;
  claimNextEta: string | null;
  createdAt: string;
};

export type ManualReviewSlaAssigneeBucket = {
  key: string;
  openCount: number;
  breachedCount: number;
  dueSoonCount: number;
  avgAgeHours: number | null;
};

export type ManualReviewSlaSummaryView = {
  openCount: number;
  onTrackCount: number;
  dueSoonCount: number;
  breachedCount: number;
  escalatedCount: number;
  autoAssignedLast24h: number;
  oldestBreachedAgeHours: number | null;
  bySlaBucket: ItemManualReviewSummaryBucket[];
  byPriority: ItemManualReviewSummaryBucket[];
  byPolicy: ItemManualReviewSummaryBucket[];
  byAssignee: ManualReviewSlaAssigneeBucket[];
};

export type ManualReviewSlaPolicyTemplateView = {
  key: string;
  scope: "routing" | "priority" | "default";
  slaHours: number;
  dueSoonLeadHours: number;
  criticalAfterHours: number | null;
  urgentAfterHours: number | null;
  assignAfterHours: number | null;
  rebalanceAfterHours: number | null;
  autoAssignTemplateKey: string | null;
  autoAssignEnabled: boolean;
  maxAutoAssignmentsPerRun: number;
  anomalyPolicyKey: string | null;
  anomalySeverity: ItemFulfillmentAnomalySeverity | null;
  anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
  anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
  anomalyCooldownMinutes: number | null;
  anomalyStages: Array<{
    key: string;
    minAgeHours: number;
    appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
    routingCodes: ItemManualReviewRoutingCode[] | null;
    priorities: ItemManualReviewPriority[] | null;
    severity: ItemFulfillmentAnomalySeverity | null;
    alertLevel: number | null;
    anomalyPolicyKey: string | null;
    anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
    anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
    autoActionTemplateKey: string | null;
    cooldownMinutes: number | null;
  }>;
  matchingReviewCount: number;
  dueSoonCount: number;
  breachedCount: number;
  unclaimedCount: number;
  escalatedCount: number;
};

export type ArbitrationReviewRoundRebalanceAssignmentView = {
  caseId: string;
  roundId: string;
  roundNumber: number;
  assigneeUserId: string;
  previousAssigneeUserId: string | null;
  roundAgeHours: number;
  action: "assign" | "reassign";
};

export type ArbitrationReviewRoundRebalanceResult = {
  scannedCount: number;
  assignedCount: number;
  reassignedCount: number;
  skippedCount: number;
  assignments: ArbitrationReviewRoundRebalanceAssignmentView[];
};

export type ManualReviewRebalanceAssignmentView = {
  reviewId: string;
  assigneeUserId: string;
  priority: ItemManualReviewPriority;
  slaBucket: ItemManualReviewSlaBucket;
  routingCode: ItemManualReviewRoutingCode;
  policySource:
    | "routing_pool"
    | "explicit_pool"
    | "global_pool"
    | "template_routing"
    | "template_priority"
    | "template_default";
  templateKey: string | null;
};

export type ManualReviewRebalanceResult = {
  assignedCount: number;
  skippedCount: number;
  assignments: ManualReviewRebalanceAssignmentView[];
};

export type FulfillmentOpsSummaryBucket = {
  key: string;
  count: number;
};

export type FulfillmentOpsRecentRunWindowKey = "24h" | "7d";

export type FulfillmentOpsRecentRunWindowView = {
  key: FulfillmentOpsRecentRunWindowKey;
  totalCount: number;
  manualCount: number;
  scheduledCount: number;
  replacementRunCount: number;
  replacementsCreated: number;
};

export type FulfillmentOpsRecentRunView = {
  id: string;
  itemId: string;
  trigger: ItemFulfillmentRunTrigger;
  status: ItemFulfillmentRunStatus;
  scannedUnits: number;
  replacementsCreated: number;
  note: string | null;
  createdAt: string;
};

export type FulfillmentOpsRecommendationSeverity = "info" | "warning" | "danger";

export type FulfillmentOpsRecommendationKind =
  | "focus_urgent_queue"
  | "inspect_usage_queue"
  | "inspect_pool_health"
  | "inspect_sweep_activity";

export type FulfillmentOpsRecommendationView = {
  kind: FulfillmentOpsRecommendationKind;
  severity: FulfillmentOpsRecommendationSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  priority: ItemManualReviewPriority | null;
  routingCode: ItemManualReviewRoutingCode | null;
  suggestedAction: ItemManualReviewSuggestedAction | null;
  reviewStatus: ItemManualReviewStatus | null;
  runTrigger: ItemFulfillmentRunTrigger | null;
  runStatus: ItemFulfillmentRunStatus | null;
  recentWindow: FulfillmentOpsRecentRunWindowKey | null;
};

export type FulfillmentOpsSummaryView = {
  manualReviews: ItemManualReviewSummaryView;
  anomalies: {
    openCount: number;
    criticalCount: number;
    alertedCount: number;
    autoActionedCount: number;
    latestDetectedAt: string | null;
    latestResolvedAt: string | null;
    lastAlertedAt: string | null;
    lastAutoActionAt: string | null;
    byKind: FulfillmentOpsSummaryBucket[];
    bySeverity: FulfillmentOpsSummaryBucket[];
    byAlertLevel: FulfillmentOpsSummaryBucket[];
    byPolicyKey: FulfillmentOpsSummaryBucket[];
    byAutoActionStatus: FulfillmentOpsSummaryBucket[];
    policies: FulfillmentAnomalyPolicyTemplateView[];
  };
  byRejectionCode: FulfillmentOpsSummaryBucket[];
  byRejectionCategory: FulfillmentOpsSummaryBucket[];
  appealableCount: number;
  resolvedLast7Days: number;
  byResolutionAction: FulfillmentOpsSummaryBucket[];
  byAssignmentAction: FulfillmentOpsSummaryBucket[];
  latestAssignmentAt: string | null;
  byRunTrigger: FulfillmentOpsSummaryBucket[];
  byRunStatus: FulfillmentOpsSummaryBucket[];
  latestRunAt: string | null;
  recentRunWindows: FulfillmentOpsRecentRunWindowView[];
  recentRuns: FulfillmentOpsRecentRunView[];
  recentAnomalies: ItemFulfillmentAnomalyView[];
  recommendations: FulfillmentOpsRecommendationView[];
};

export type ItemManualReviewAssignmentAction =
  | "claim"
  | "claim_next"
  | "assign_balanced"
  | "assign_explicit"
  | "assign_auto_sla"
  | "rebalance_manual"
  | "rebalance_auto"
  | "release"
  | "stale_release";

export type ItemManualReviewAssignmentEventView = {
  id: string;
  reviewId: string;
  itemId: string;
  reportId: string;
  actorUserId: string;
  action: ItemManualReviewAssignmentAction;
  fromAssigneeUserId: string | null;
  toAssigneeUserId: string | null;
  note: string | null;
  createdAt: string;
};

export type ItemReplacementLogView = {
  id: string;
  itemId: string;
  previousUnitId: string | null;
  replacementUnitId: string;
  reason: ItemUnitIssueReason | null;
  trigger: ItemReplacementLogTrigger;
  createdAt: string;
};

export type ItemFulfillmentRunView = {
  id: string;
  itemId: string;
  trigger: ItemFulfillmentRunTrigger;
  status: ItemFulfillmentRunStatus;
  scannedUnits: number;
  replacementsCreated: number;
  note: string | null;
  createdAt: string;
};

export type CreateMarketplaceListingInput = {
  itemId: string;
  price: number;
  currency?: ProductCurrency;
};

export type PurchaseMarketplaceListingInput = {
  listingId: string;
};

export type MarketplaceListingView = {
  id: string;
  itemId: string;
  sellerUserId: string;
  productTitle: string;
  currency: ProductCurrency;
  price: number;
  status: "active" | "sold" | "cancelled";
  createdAt: string;
};

export type RedeemCodeInput = {
  code: string;
};

export type RedeemResult = {
  code: string;
  outcome: "walletGrant" | "itemGrant";
  message: string;
};

export type RedemptionRewardEntry =
  | { kind: "walletGrant"; currency: string; amount: number }
  | { kind: "itemGrant"; productId: string };

export type RedemptionEligibility = {
  minTrustLevel?: number | null;
  userGroup?: string | null;
  userIds?: string[] | null;
};

export type RedemptionCodeView = {
  id: string;
  code: string;
  active: boolean;
  exclusionGroup: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  eligibility: RedemptionEligibility | null;
  rewards: RedemptionRewardEntry[];
  rewardKind: "walletGrant" | "itemGrant";
  currency: string | null;
  amount: number | null;
  productId: string | null;
  maxUses: number;
  usedCount: number;
  mailTitle: string | null;
  mailBody: string | null;
  batchLabel: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type UpsertRedemptionCodeInput = {
  code: string;
  active: boolean;
  exclusionGroup?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  eligibility?: RedemptionEligibility | null;
  rewards: RedemptionRewardEntry[];
  maxUses: number;
  mailTitle?: string | null;
  mailBody?: string | null;
  batchLabel?: string | null;
  description?: string | null;
};

export type GenerateRedemptionCodeBatchInput = {
  count: number;
  codePrefix: string;
  template: Omit<UpsertRedemptionCodeInput, "code">;
};

export type RedemptionCodeUsageView = {
  id: string;
  redemptionCodeId: string;
  userId: string;
  username: string | null;
  createdAt: string;
};

export type MailboxAttachmentView = {
  id: string;
  kind: "currency" | "item";
  currency: CurrencyKey | null;
  amount: number | null;
  productId: string | null;
  itemId: string | null;
  title: string | null;
  claimedAt: string | null;
};

export const mailboxFolderKeys = ["stash", "inbox"] as const;

export type MailboxFolderKey = (typeof mailboxFolderKeys)[number];

export type MailboxMessageView = {
  id: string;
  folder: MailboxFolderKey;
  title: string;
  summary: string;
  body: string;
  sourceLabel: string;
  type: "system" | "reward" | "compensation";
  readAt: string | null;
  favoritedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  attachments: MailboxAttachmentView[];
  pendingAttachmentCount: number;
  claimedAttachmentCount: number;
};

export const mailboxOpsRecipientModes = ["allUsers", "userIds", "usernames", "providerUserIds"] as const;

export type MailboxOpsRecipientMode = (typeof mailboxOpsRecipientModes)[number];

export const mailboxOpsCampaignStatuses = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "partial",
  "failed",
  "canceled",
] as const;

export type MailboxOpsCampaignStatus = (typeof mailboxOpsCampaignStatuses)[number];

export type MailboxOpsAttachmentInput =
  | {
      kind: "currency";
      currency: CurrencyKey;
      amount: number;
      title?: string | null;
    }
  | {
      kind: "item";
      productId: string;
      title?: string | null;
    };

export type MailboxOpsCampaignView = {
  id: string;
  operatorLabel: string;
  title: string;
  summary: string | null;
  body: string;
  type: "system" | "reward" | "compensation";
  sourceLabel: string | null;
  recipientMode: MailboxOpsRecipientMode;
  recipientInput: string | null;
  attachments: MailboxOpsAttachmentInput[];
  attachmentCount: number;
  previewRecipientCount: number;
  previewUnresolvedCount: number;
  previewUnresolvedTargets: string[];
  targetCount: number;
  sentCount: number;
  failedCount: number;
  status: MailboxOpsCampaignStatus;
  expiresAt: string | null;
  scheduledAt: string | null;
  lastDispatchedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  dispatchedByUserId: string | null;
  canceledByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertMailboxOpsCampaignInput = {
  operatorLabel: string;
  title: string;
  summary?: string | null;
  body: string;
  type: "system" | "reward" | "compensation";
  sourceLabel?: string | null;
  recipientMode: MailboxOpsRecipientMode;
  recipientInput?: string | null;
  attachments?: MailboxOpsAttachmentInput[];
  expiresAt?: string | null;
  scheduledAt?: string | null;
  status?: Extract<MailboxOpsCampaignStatus, "draft" | "scheduled">;
};

export type MailboxOpsCampaignDispatchResult = {
  campaign: MailboxOpsCampaignView;
  dispatchedCount: number;
  failedCount: number;
  unresolvedCount: number;
  errorMessage: string | null;
};

export type MailboxOpsCampaignDeliveryView = {
  id: string;
  campaignId: string;
  userId: string;
  usernameSnapshot: string | null;
  providerUserIdSnapshot: string | null;
  messageId: string | null;
  status: "sent" | "failed";
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type ListMailboxOpsCampaignsInput = {
  limit?: number | null;
  status?: MailboxOpsCampaignStatus | "all" | null;
};

export type MailboxOpsTemplateView = {
  id: string;
  operatorUserId: string;
  name: string;
  description: string | null;
  operatorLabel: string;
  title: string;
  summary: string | null;
  body: string;
  type: "system" | "reward" | "compensation";
  sourceLabel: string | null;
  attachments: MailboxOpsAttachmentInput[];
  attachmentCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertMailboxOpsTemplateInput = {
  name: string;
  description?: string | null;
  operatorLabel: string;
  title: string;
  summary?: string | null;
  body: string;
  type: "system" | "reward" | "compensation";
  sourceLabel?: string | null;
  attachments?: MailboxOpsAttachmentInput[];
  expiresAt?: string | null;
};

export type ListMailboxOpsTemplatesInput = {
  limit?: number | null;
};

export type MailboxOpsRecipientBatchView = {
  id: string;
  operatorUserId: string;
  name: string;
  description: string | null;
  recipientMode: MailboxOpsRecipientMode;
  recipientInput: string | null;
  previewRecipientCount: number;
  previewUnresolvedCount: number;
  previewUnresolvedTargets: string[];
  createdAt: string;
  updatedAt: string;
};

export type UpsertMailboxOpsRecipientBatchInput = {
  name: string;
  description?: string | null;
  recipientMode: MailboxOpsRecipientMode;
  recipientInput?: string | null;
};

export type ListMailboxOpsRecipientBatchesInput = {
  limit?: number | null;
};

export type SetMailboxMessageFavoriteResult = {
  messageId: string;
  favoritedAt: string | null;
};

export type DeleteMailboxMessageResult = {
  messageId: string;
  deleted: boolean;
};

export type AccountWorkerHealthView = {
  startedAt: string;
  lastCycleAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastProductShadowSyncAt: string | null;
  lastProductShadowSyncStatus: "success" | "error" | null;
  lastProductShadowSyncError: string | null;
  lastGatewayAnomalySweepAt: string | null;
  lastGatewayAnomalySweepStatus: "success" | "error" | null;
  lastGatewayAnomalySweepError: string | null;
  lastGatewayAnomalySweepAttemptedCount: number | null;
  lastGatewayAnomalySweepOkCount: number | null;
  lastGatewayAnomalySweepErrorCount: number | null;
  lastGatewayAnomalySweepSkippedCount: number | null;
  lastGatewayAnomalySweepLockSkippedAt: string | null;
  lastGatewayAnomalySweepLockSkipReason: string | null;
  lastGatewayAnomalyAlertDispatchAt: string | null;
  lastGatewayAnomalyAlertDispatchStatus: "success" | "error" | null;
  lastGatewayAnomalyAlertDispatchError: string | null;
  lastGatewayAnomalyAlertDispatchAttemptedCount: number | null;
  lastGatewayAnomalyAlertDispatchDeliveredCount: number | null;
  lastGatewayAnomalyAlertDispatchErrorCount: number | null;
  lastGatewayAnomalyAlertDispatchSkippedCount: number | null;
  lastGatewayAnomalyAlertDispatchLockSkippedAt: string | null;
  lastGatewayAnomalyAlertDispatchLockSkipReason: string | null;
  lastGatewayAnomalyAutoRemediationAt: string | null;
  lastGatewayAnomalyAutoRemediationStatus: "success" | "error" | null;
  lastGatewayAnomalyAutoRemediationError: string | null;
  lastGatewayAnomalyAutoRemediationAttemptedCount: number | null;
  lastGatewayAnomalyAutoRemediationDryRunCount: number | null;
  lastGatewayAnomalyAutoRemediationAppliedCount: number | null;
  lastGatewayAnomalyAutoRemediationErrorCount: number | null;
  lastGatewayAnomalyAutoRemediationSkippedCount: number | null;
  lastGatewayAnomalyAutoRemediationLockSkippedAt: string | null;
  lastGatewayAnomalyAutoRemediationLockSkipReason: string | null;
  lastGatewayAnomalyRemediationImpactCaptureAt: string | null;
  lastGatewayAnomalyRemediationImpactCaptureStatus: "success" | "error" | null;
  lastGatewayAnomalyRemediationImpactCaptureError: string | null;
  lastGatewayAnomalyRemediationImpactCaptureAttemptedCount: number | null;
  lastGatewayAnomalyRemediationImpactCaptureCapturedCount: number | null;
  lastGatewayAnomalyRemediationImpactCaptureErrorCount: number | null;
  lastGatewayAnomalyRemediationImpactCaptureSkippedCount: number | null;
  lastGatewayAnomalyRemediationImpactCaptureLockSkippedAt: string | null;
  lastGatewayAnomalyRemediationImpactCaptureLockSkipReason: string | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotAt: string | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotStatus: "success" | "error" | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotError: string | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotSnapshotId: string | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotRunCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotImpactedRunCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotUnavailableRunCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotLockSkippedAt: string | null;
  lastGatewayAnomalyRemediationEffectivenessSnapshotLockSkipReason: string | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt: string | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotStatus: "success" | "error" | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotError: string | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotSnapshotId: string | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotAnomalyCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotCriticalCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotDeliveredCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotErrorCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotSkippedCount: number | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkippedAt: string | null;
  lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkipReason: string | null;
  lastGatewayRateLimitHotspotSnapshotAt: string | null;
  lastGatewayRateLimitHotspotSnapshotStatus: "success" | "error" | null;
  lastGatewayRateLimitHotspotSnapshotError: string | null;
  lastGatewayRateLimitHotspotSnapshotSnapshotId: string | null;
  lastGatewayRateLimitHotspotSnapshotRateLimitedRequestCount: number | null;
  lastGatewayRateLimitHotspotSnapshotLockSkippedAt: string | null;
  lastGatewayRateLimitHotspotSnapshotLockSkipReason: string | null;
  lastGatewayRateLimitHotspotAnomalySnapshotAt: string | null;
  lastGatewayRateLimitHotspotAnomalySnapshotStatus: "success" | "error" | null;
  lastGatewayRateLimitHotspotAnomalySnapshotError: string | null;
  lastGatewayRateLimitHotspotAnomalySnapshotSnapshotId: string | null;
  lastGatewayRateLimitHotspotAnomalySnapshotAnomalyCount: number | null;
  lastGatewayRateLimitHotspotAnomalySnapshotCriticalCount: number | null;
  lastGatewayRateLimitHotspotAnomalySnapshotDeliveredCount: number | null;
  lastGatewayRateLimitHotspotAnomalySnapshotErrorCount: number | null;
  lastGatewayRateLimitHotspotAnomalySnapshotSkippedCount: number | null;
  lastGatewayRateLimitHotspotAnomalySnapshotLockSkippedAt: string | null;
  lastGatewayRateLimitHotspotAnomalySnapshotLockSkipReason: string | null;
};

export type AccountWorkerHealthResponse = {
  ok: true;
  service: "account-worker";
  role: string;
  state: AccountWorkerHealthView;
};

export type ClaimMailboxAttachmentInput = {
  messageId: string;
  attachmentId: string;
};

export type ClaimMailboxMessageAttachmentsResult = {
  messageId: string;
  claimedCount: number;
  attachments: MailboxAttachmentView[];
};

export type ClaimAllMailboxAttachmentsResult = {
  claimedCount: number;
  attachments: MailboxAttachmentView[];
  messageIds: string[];
};

export type ArchiveReadMailboxMessagesResult = {
  archivedCount: number;
  messageIds: string[];
};

export type TaskStatus =
  | "open"
  | "applying"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "defaulted";

export const taskPricingModes = ["flat_task", "token_metered", "property_metered"] as const;
export type TaskPricingMode = (typeof taskPricingModes)[number];

export const taskOperationModes = ["manual", "automatic"] as const;
export type TaskOperationMode = (typeof taskOperationModes)[number];

export type TaskView = {
  id: string;
  title: string;
  description: string;
  preferredCapabilityCodes: string[];
  pricingMode: TaskPricingMode;
  billingUnit: string | null;
  meterKey: string | null;
  meterQuantity: number | null;
  operationMode: TaskOperationMode;
  rewardCurrency: ProductCurrency;
  rewardAmount: number;
  requiredBondAmount: number;
  status: TaskStatus;
  creatorUserId: string;
  assignedUserId: string | null;
  arbitrationCaseCount: number;
  applicationCount: number;
  createdAt: string;
};

export type CreateTaskInput = {
  title: string;
  description: string;
  preferredCapabilityCodes?: string[];
  pricingMode?: TaskPricingMode;
  billingUnit?: string | null;
  meterKey?: string | null;
  meterQuantity?: number | null;
  operationMode?: TaskOperationMode;
  rewardCurrency: ProductCurrency;
  rewardAmount: number;
  requiredBondAmount: number;
};

export type TaskApplicationView = {
  id: string;
  taskId: string;
  applicantUserId: string;
  statement: string;
  proposedEtaHours: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type DispatchDecisionView = {
  taskId: string;
  assignedApplicationId: string | null;
  assignedProposalId: string | null;
  assignedUserId: string;
  assignmentMode: "application" | "agentProposal";
  decidedAt: string;
};

export type LinuxDoUpsertInput = {
  id: string;
  username?: string;
  name?: string;
  email?: string | null;
  avatar_url?: string | null;
  trust_level?: number | null;
};

export type LinuxDoUpsertResult = {
  user: UserSummary;
};

export const eventNames = [
  "user.registered",
  "email.delivery.requested",
  "email.inbound.received",
  "mission.claimed",
  "dailyReward.claimed",
  "dailyMission.claimed",
  "weeklyMission.claimed",
  "opinionTopic.created",
  "opinionTopic.supported",
  "opinionTopic.opposed",
  "opinionTopic.qualified",
  "opinionTopic.archived",
  "opinionTopic.adopted",
  "developmentQueue.queued",
  "developmentQueue.planned",
  "developmentQueue.started",
  "developmentQueue.completed",
  "developmentQueue.archived",
  "agentExecution.created",
  "agentExecution.started",
  "agentExecution.requeued",
  "agentExecution.submitted",
  "agentExecution.completed",
  "agentExecution.failed",
  "agentExecution.cancelled",
  "agentExecution.artifactAdded",
  "agentExecution.callbackRemediationAlerted",
  "agentExecution.runtimePressureAlerted",
  "aiGateway.anomalyIncidentAlerted",
  "aiGateway.remediationEffectivenessAnomalyAlerted",
  "aiGateway.rateLimitHotspotAnomalyAlerted",
  "outbox.alerted",
  "arbitration.created",
  "arbitration.evidenceAdded",
  "arbitration.reviewing",
  "arbitration.resolved",
  "arbitration.rejected",
  "wallet.changed",
  "wallet.exchanged",
  "product.updated",
  "product.deactivated",
  "product.deleted",
  "product.orderRolledBack",
  "product.purchased",
  "item.granted",
  "item.issueReported",
  "item.manualReviewRequested",
  "item.manualReviewResolved",
  "item.manualReviewReleased",
  "item.anomalyEscalated",
  "item.anomalyAutoActionApplied",
  "item.replaced",
  "item.reconciled",
  "redemption.used",
  "mail.sent",
  "mail.claimed",
  "wallet.exchanged",
  "task.created",
  "task.applied",
  "task.assigned",
  "task.started",
  "task.submitted",
  "task.accepted",
  "task.defaulted",
  "task.cancelled",
  "reputation.updated",
] as const;

export type EventName = (typeof eventNames)[number];

export type NotificationWebhookFormat = "generic" | "slack" | "discord" | "feishu";

export const defaultNotificationWebhookEventNames = [
  "agentExecution.callbackRemediationAlerted",
  "agentExecution.runtimePressureAlerted",
  "aiGateway.anomalyIncidentAlerted",
  "aiGateway.remediationEffectivenessAnomalyAlerted",
  "aiGateway.rateLimitHotspotAnomalyAlerted",
] as const satisfies readonly EventName[];

export type NotificationWebhookRouteCriteriaConfig = {
  eventNames: EventName[];
  minAlertLevel: number | null;
  maxAlertLevel: number | null;
  minCount: number | null;
  maxCount: number | null;
  minCandidateCount: number | null;
  maxCandidateCount: number | null;
  policyKeys: string[];
  reasonCategories: string[];
  reasonDispositions: string[];
  callbackTypes: string[];
  stopAfterMatch: boolean;
  minActiveMinutes: number | null;
  cooldownMinutes: number | null;
  maxDeliveriesPerIncident: number | null;
};

export type NotificationWebhookRouteProfileConfig = NotificationWebhookRouteCriteriaConfig & {
  key: string;
  format: NotificationWebhookFormat;
  timeoutMs: number;
};

export type NotificationWebhookRouteConfig = NotificationWebhookRouteCriteriaConfig & {
  name: string;
  url: string;
  profileKey: string | null;
  format: NotificationWebhookFormat;
  authToken: string | null;
  signingSecret: string | null;
  timeoutMs: number;
};

export type NotificationWebhookTargetDestinationView = {
  destinationLabel: string;
  destinationHost: string | null;
  destinationPathHint: string | null;
};

export type NotificationWebhookDefaultTargetView = NotificationWebhookTargetDestinationView & {
  format: NotificationWebhookFormat;
  eventNames: EventName[];
  hasAuthToken: boolean;
  hasSigningSecret: boolean;
  timeoutMs: number;
};

export type NotificationWebhookRouteProfileView = NotificationWebhookRouteCriteriaConfig & {
  key: string;
  format: NotificationWebhookFormat;
  timeoutMs: number;
  routeCount: number;
};

export type NotificationWebhookRouteView = NotificationWebhookRouteCriteriaConfig &
  NotificationWebhookTargetDestinationView & {
    name: string;
    profileKey: string | null;
    format: NotificationWebhookFormat;
    hasAuthToken: boolean;
    hasSigningSecret: boolean;
    timeoutMs: number;
  };

export type NotificationWebhookCatalogView = {
  enabled: boolean;
  enabledEventNames: EventName[];
  defaultTarget: NotificationWebhookDefaultTargetView | null;
  profileCount: number;
  routeCount: number;
  profiles: NotificationWebhookRouteProfileView[];
  routes: NotificationWebhookRouteView[];
};

export type NotificationWebhookIncidentDeliveryState =
  | "eligible"
  | "silenced"
  | "min_active_not_reached"
  | "cooldown_active"
  | "max_deliveries_reached";

export type NotificationWebhookIncidentGovernanceState = "active" | "acknowledged" | "silenced";

export type NotificationWebhookRoutePolicyState = {
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  lastSentAt: Date | null;
  sendCount: number;
  silencedUntil?: Date | null;
};

export type NotificationWebhookRoutePolicyDecision = {
  allowed: boolean;
  reason: Exclude<NotificationWebhookIncidentDeliveryState, "eligible"> | null;
  activeMinutes: number;
  cooldownRemainingMinutes: number | null;
  deliveriesRemaining: number | null;
  silenceRemainingMinutes: number | null;
};

export type NotificationWebhookIncidentControlState = {
  acknowledgedAt: Date | null;
  acknowledgedByUserId: string | null;
  silencedAt: Date | null;
  silencedUntil: Date | null;
  silencedByUserId: string | null;
  silenceReason: string | null;
};

export const notificationWebhookIncidentHistoryKinds = [
  "delivered",
  "acknowledged",
  "silenced",
  "silence_cleared",
] as const;

export type NotificationWebhookIncidentHistoryKind = (typeof notificationWebhookIncidentHistoryKinds)[number];

export type NotificationWebhookIncidentHistoryEntryView = {
  id: string;
  incidentKey: string;
  kind: NotificationWebhookIncidentHistoryKind;
  occurredAt: string;
  actorUserId: string | null;
  routeName: string | null;
  profileKey: string | null;
  format: NotificationWebhookFormat | null;
  silencedUntil: string | null;
  reason: string | null;
};

export type NotificationWebhookIncidentSummaryBucket = {
  key: string;
  count: number;
};

export type NotificationWebhookIncidentRouteStateView = {
  routeName: string;
  profileKey: string | null;
  format: NotificationWebhookFormat;
  isDefaultTarget: boolean;
  lastSentAt: string | null;
  sendCount: number;
  activeMinutes: number;
  cooldownRemainingMinutes: number | null;
  deliveriesRemaining: number | null;
  currentState: NotificationWebhookIncidentDeliveryState;
};

export type NotificationWebhookIncidentView = {
  incidentKey: string;
  eventName:
    | "agentExecution.callbackRemediationAlerted"
    | "agentExecution.runtimePressureAlerted"
    | "aiGateway.anomalyIncidentAlerted"
    | "aiGateway.remediationEffectivenessAnomalyAlerted"
    | "aiGateway.rateLimitHotspotAnomalyAlerted";
  governanceState: NotificationWebhookIncidentGovernanceState;
  alertLevel: number;
  reasonCategory: string | null;
  reasonDisposition: string | null;
  policyKey: string | null;
  agentId: string | null;
  callbackType: string | null;
  profileKey: string | null;
  pressureLevel: AgentExecutionRuntimePressureLevel | null;
  schedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
  ownerUserId: string | null;
  projectId: string | null;
  incidentId: string | null;
  routePolicyId: string | null;
  snapshotId: string | null;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  silencedAt: string | null;
  silencedUntil: string | null;
  silencedByUserId: string | null;
  silenceReason: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  history: NotificationWebhookIncidentHistoryEntryView[];
  routeStates: NotificationWebhookIncidentRouteStateView[];
};

export type NotificationWebhookIncidentListView = {
  limit: number;
  incidentCount: number;
  newestSeenAt: string | null;
  activeCount: number;
  acknowledgedCount: number;
  silencedCount: number;
  byAlertLevel: NotificationWebhookIncidentSummaryBucket[];
  byReasonCategory: NotificationWebhookIncidentSummaryBucket[];
  incidents: NotificationWebhookIncidentView[];
};

export type NotificationWebhookIncidentSavedViewFilters = {
  agentId: string | null;
  callbackType: string | null;
  policyKey: string | null;
  reasonCategory: string | null;
  reasonDisposition: string | null;
  projectId: string | null;
  incidentId: string | null;
  routePolicyId: string | null;
  snapshotId: string | null;
  alertLevel: number | null;
  governanceState: NotificationWebhookIncidentGovernanceState | null;
};

export const notificationWebhookIncidentSavedViewPlaybookActionKinds = [
  "acknowledge",
  "silence",
  "clear_silence",
] as const;

export type NotificationWebhookIncidentSavedViewPlaybookActionKind =
  (typeof notificationWebhookIncidentSavedViewPlaybookActionKinds)[number];

export const notificationWebhookIncidentSavedViewFocusSections = [
  "paging-catalog",
  "paging-incidents",
  "incident-saved-views",
  "incident-batch",
  "gateway-anomalies",
  "gateway-remediation-effectiveness",
  "gateway-rate-limit-hotspots",
  "runtime-sessions",
  "callback-audits",
  "operator-runs",
] as const;

export type NotificationWebhookIncidentSavedViewFocusSection =
  (typeof notificationWebhookIncidentSavedViewFocusSections)[number];

export type NotificationWebhookIncidentSavedViewPlaybookDefaults = {
  batchLimit: number;
  silenceDurationMinutes: number;
  preferredAction: NotificationWebhookIncidentSavedViewPlaybookActionKind;
  silenceReasonTemplate: string | null;
  operatorGuidance: string | null;
  followUpIncidentState: NotificationWebhookIncidentGovernanceState | null;
  focusSection: NotificationWebhookIncidentSavedViewFocusSection | null;
};

export type NotificationWebhookIncidentSavedView = {
  id: string;
  operatorUserId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  filters: NotificationWebhookIncidentSavedViewFilters;
  playbookDefaults: NotificationWebhookIncidentSavedViewPlaybookDefaults;
  createdAt: string;
  updatedAt: string;
};

export type CreateNotificationWebhookIncidentSavedViewInput = {
  name: string;
  description?: string | null;
  isDefault?: boolean;
  filters: NotificationWebhookIncidentSavedViewFilters;
  playbookDefaults?: Partial<NotificationWebhookIncidentSavedViewPlaybookDefaults>;
};

export type ListNotificationWebhookIncidentSavedViewsInput = {
  limit?: number | null;
};

export type NotificationWebhookIncidentControlResult = {
  incidentKey: string;
  governanceState: NotificationWebhookIncidentGovernanceState;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  silencedAt: string | null;
  silencedUntil: string | null;
  silencedByUserId: string | null;
  silenceReason: string | null;
};

export const notificationWebhookIncidentBatchActionKinds = [
  "acknowledge",
  "silence",
  "clear_silence",
] as const;

export type NotificationWebhookIncidentBatchActionKind =
  (typeof notificationWebhookIncidentBatchActionKinds)[number];

export type NotificationWebhookIncidentBatchActionResult = {
  action: NotificationWebhookIncidentBatchActionKind;
  limit: number;
  matchedCount: number;
  actedCount: number;
  incidentKeys: string[];
  silencedUntil: string | null;
  byGovernanceState: NotificationWebhookIncidentSummaryBucket[];
};

export const notificationWebhookIncidentStateKeyPrefix = "notification:webhook:incident:";
export const notificationWebhookIncidentHistoryKeyPrefix = "notification:webhook:incident-history:";
export const notificationWebhookIncidentHistoryMaxEntries = 25;
export const notificationWebhookDefaultTargetRouteName = "default";
export const notificationWebhookIncidentAcknowledgedAtField = "acknowledgedAt";
export const notificationWebhookIncidentAcknowledgedByUserIdField = "acknowledgedByUserId";
export const notificationWebhookIncidentSilencedAtField = "silencedAt";
export const notificationWebhookIncidentSilencedUntilField = "silencedUntil";
export const notificationWebhookIncidentSilencedByUserIdField = "silencedByUserId";
export const notificationWebhookIncidentSilenceReasonField = "silenceReason";

function parseOptionalWebhookNumber(value: unknown, minimum: number) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return null;
  return Math.floor(parsed);
}

function parseWebhookBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function parseWebhookStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0),
    ),
  );
}

function parseWebhookEventNameArray(value: unknown): EventName[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<EventName>(eventNames);
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item): item is EventName => allowed.has(item as EventName)),
    ),
  );
}

function parseWebhookIsoDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildNotificationWebhookDestinationView(url: string): NotificationWebhookTargetDestinationView {
  try {
    const parsed = new URL(url);
    const segmentCount = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0).length;
    const destinationHost = parsed.host || null;
    const destinationPathHint =
      segmentCount > 0 ? `${segmentCount} path segment${segmentCount === 1 ? "" : "s"}` : "root";

    return {
      destinationLabel: destinationHost ? `${destinationHost} (${destinationPathHint})` : "configured webhook target",
      destinationHost,
      destinationPathHint,
    };
  } catch {
    return {
      destinationLabel: "configured webhook target",
      destinationHost: null,
      destinationPathHint: null,
    };
  }
}

export function parseNotificationWebhookFormat(value: string | undefined): NotificationWebhookFormat {
  if (!value) return "generic";
  const normalized = value.trim().toLowerCase();
  if (normalized === "slack" || normalized === "discord" || normalized === "feishu") {
    return normalized;
  }
  return "generic";
}

export function parseNotificationWebhookEventNames(
  value: string | undefined,
  fallback: readonly EventName[] = defaultNotificationWebhookEventNames,
): EventName[] {
  if (!value) return [...fallback];
  const allowed = new Set<EventName>(eventNames);
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is EventName => allowed.has(item as EventName));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...fallback];
}

export function resolveNotificationWebhookRouteCriteria(args: {
  source: Record<string, unknown>;
  defaults: {
    eventNames: EventName[];
    format: NotificationWebhookFormat;
    timeoutMs: number;
  };
  profile?: NotificationWebhookRouteProfileConfig | null;
}): NotificationWebhookRouteCriteriaConfig & {
  format: NotificationWebhookFormat;
  timeoutMs: number;
} {
  const { source, defaults, profile } = args;
  const configuredEventNames = parseWebhookEventNameArray(source.eventNames);
  const eventNames =
    configuredEventNames.length > 0
      ? configuredEventNames
      : profile?.eventNames.length
        ? profile.eventNames
        : defaults.eventNames;

  const format =
    typeof source.format === "string"
      ? parseNotificationWebhookFormat(source.format)
      : profile?.format ?? defaults.format;

  const timeoutMs =
    parseOptionalWebhookNumber(source.timeoutMs, 250) ??
    (typeof source.timeoutMs === "string"
      ? Math.floor(Number(source.timeoutMs))
      : profile?.timeoutMs ?? defaults.timeoutMs);

  return {
    eventNames,
    format,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 250 ? timeoutMs : profile?.timeoutMs ?? defaults.timeoutMs,
    minAlertLevel:
      "minAlertLevel" in source ? parseOptionalWebhookNumber(source.minAlertLevel, 0) : profile?.minAlertLevel ?? null,
    maxAlertLevel:
      "maxAlertLevel" in source ? parseOptionalWebhookNumber(source.maxAlertLevel, 0) : profile?.maxAlertLevel ?? null,
    minCount: "minCount" in source ? parseOptionalWebhookNumber(source.minCount, 0) : profile?.minCount ?? null,
    maxCount: "maxCount" in source ? parseOptionalWebhookNumber(source.maxCount, 0) : profile?.maxCount ?? null,
    minCandidateCount:
      "minCandidateCount" in source
        ? parseOptionalWebhookNumber(source.minCandidateCount, 0)
        : profile?.minCandidateCount ?? null,
    maxCandidateCount:
      "maxCandidateCount" in source
        ? parseOptionalWebhookNumber(source.maxCandidateCount, 0)
        : profile?.maxCandidateCount ?? null,
    policyKeys:
      "policyKeys" in source ? parseWebhookStringArray(source.policyKeys) : profile?.policyKeys ?? [],
    reasonCategories:
      "reasonCategories" in source
        ? parseWebhookStringArray(source.reasonCategories)
        : profile?.reasonCategories ?? [],
    reasonDispositions:
      "reasonDispositions" in source
        ? parseWebhookStringArray(source.reasonDispositions)
        : profile?.reasonDispositions ?? [],
    callbackTypes:
      "callbackTypes" in source ? parseWebhookStringArray(source.callbackTypes) : profile?.callbackTypes ?? [],
    stopAfterMatch:
      "stopAfterMatch" in source
        ? parseWebhookBoolean(source.stopAfterMatch, false)
        : profile?.stopAfterMatch ?? false,
    minActiveMinutes:
      "minActiveMinutes" in source
        ? parseOptionalWebhookNumber(source.minActiveMinutes, 0)
        : profile?.minActiveMinutes ?? null,
    cooldownMinutes:
      "cooldownMinutes" in source
        ? parseOptionalWebhookNumber(source.cooldownMinutes, 0)
        : profile?.cooldownMinutes ?? null,
    maxDeliveriesPerIncident:
      "maxDeliveriesPerIncident" in source
        ? parseOptionalWebhookNumber(source.maxDeliveriesPerIncident, 1)
        : profile?.maxDeliveriesPerIncident ?? null,
  };
}

export function parseNotificationWebhookRouteProfiles(
  value: string | undefined,
  defaultEvents: readonly EventName[],
  defaultFormat: NotificationWebhookFormat,
  defaultTimeoutMs: number,
): NotificationWebhookRouteProfileConfig[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const profile = entry as Record<string, unknown>;
      const key = typeof profile.key === "string" ? profile.key.trim() : "";
      if (!key) {
        return [];
      }

      const resolved = resolveNotificationWebhookRouteCriteria({
        source: profile,
        defaults: {
          eventNames: [...defaultEvents],
          format: defaultFormat,
          timeoutMs: defaultTimeoutMs,
        },
      });

      return [
        {
          key,
          ...resolved,
        } satisfies NotificationWebhookRouteProfileConfig,
      ];
    });
  } catch {
    return [];
  }
}

export function parseNotificationWebhookRoutes(
  value: string | undefined,
  profiles: NotificationWebhookRouteProfileConfig[],
  defaultEvents: readonly EventName[],
  defaultFormat: NotificationWebhookFormat,
  defaultTimeoutMs: number,
): NotificationWebhookRouteConfig[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const route = entry as Record<string, unknown>;
      const url = typeof route.url === "string" ? route.url.trim() : "";
      if (!url) {
        return [];
      }

      const profileKey =
        typeof route.profileKey === "string" && route.profileKey.trim().length > 0 ? route.profileKey.trim() : null;
      const profile = profileKey ? profiles.find((candidate) => candidate.key === profileKey) ?? null : null;
      const resolved = resolveNotificationWebhookRouteCriteria({
        source: route,
        defaults: {
          eventNames: [...defaultEvents],
          format: defaultFormat,
          timeoutMs: defaultTimeoutMs,
        },
        profile,
      });

      return [
        {
          name:
            typeof route.name === "string" && route.name.trim().length > 0
              ? route.name.trim()
              : `${profileKey ?? "route"}-${index + 1}`,
          url,
          profileKey,
          ...resolved,
          authToken:
            typeof route.authToken === "string" && route.authToken.trim().length > 0
              ? route.authToken.trim()
              : null,
          signingSecret:
            typeof route.signingSecret === "string" && route.signingSecret.trim().length > 0
              ? route.signingSecret.trim()
              : null,
        } satisfies NotificationWebhookRouteConfig,
      ];
    });
  } catch {
    return [];
  }
}

export function buildNotificationWebhookCatalogView(args: {
  enabledEventNames: readonly EventName[];
  defaultTarget:
    | {
        url: string;
        format: NotificationWebhookFormat;
        authToken: string | null;
        signingSecret: string | null;
        timeoutMs: number;
      }
    | null;
  profiles: NotificationWebhookRouteProfileConfig[];
  routes: NotificationWebhookRouteConfig[];
}): NotificationWebhookCatalogView {
  const enabledEventNames = [...args.enabledEventNames];
  const profiles = args.profiles.map((profile) => ({
    ...profile,
    routeCount: args.routes.filter((route) => route.profileKey === profile.key).length,
  }));
  const routes = args.routes.map((route) => ({
    name: route.name,
    profileKey: route.profileKey,
    format: route.format,
    hasAuthToken: Boolean(route.authToken),
    hasSigningSecret: Boolean(route.signingSecret),
    timeoutMs: route.timeoutMs,
    ...buildNotificationWebhookDestinationView(route.url),
    eventNames: route.eventNames,
    minAlertLevel: route.minAlertLevel,
    maxAlertLevel: route.maxAlertLevel,
    minCount: route.minCount,
    maxCount: route.maxCount,
    minCandidateCount: route.minCandidateCount,
    maxCandidateCount: route.maxCandidateCount,
    policyKeys: route.policyKeys,
    reasonCategories: route.reasonCategories,
    reasonDispositions: route.reasonDispositions,
    callbackTypes: route.callbackTypes,
    stopAfterMatch: route.stopAfterMatch,
    minActiveMinutes: route.minActiveMinutes,
    cooldownMinutes: route.cooldownMinutes,
    maxDeliveriesPerIncident: route.maxDeliveriesPerIncident,
  })) satisfies NotificationWebhookRouteView[];

  return {
    enabled: Boolean(args.defaultTarget) || routes.length > 0,
    enabledEventNames,
    defaultTarget: args.defaultTarget
      ? {
          format: args.defaultTarget.format,
          eventNames: enabledEventNames,
          hasAuthToken: Boolean(args.defaultTarget.authToken),
          hasSigningSecret: Boolean(args.defaultTarget.signingSecret),
          timeoutMs: args.defaultTarget.timeoutMs,
          ...buildNotificationWebhookDestinationView(args.defaultTarget.url),
        }
      : null,
    profileCount: profiles.length,
    routeCount: routes.length,
    profiles,
    routes,
  };
}

export function buildNotificationWebhookIncidentStateKey(incidentKey: string) {
  return `${notificationWebhookIncidentStateKeyPrefix}${incidentKey}`;
}

export function buildNotificationWebhookIncidentHistoryKey(incidentKey: string) {
  return `${notificationWebhookIncidentHistoryKeyPrefix}${incidentKey}`;
}

export function buildNotificationWebhookRouteLastSentField(routeName: string) {
  return `route:${routeName}:lastSentAt`;
}

export function buildNotificationWebhookRouteSendCountField(routeName: string) {
  return `route:${routeName}:sendCount`;
}

export function buildNotificationWebhookIncidentHistoryEntry(args: {
  id?: string | null;
  incidentKey: string;
  kind: NotificationWebhookIncidentHistoryKind;
  occurredAt: string | Date;
  actorUserId?: string | null;
  routeName?: string | null;
  profileKey?: string | null;
  format?: NotificationWebhookFormat | null;
  silencedUntil?: string | Date | null;
  reason?: string | null;
}): NotificationWebhookIncidentHistoryEntryView {
  const normalizeString = (value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const occurredAt = parseWebhookIsoDate(args.occurredAt);
  if (!occurredAt) {
    throw new Error("Invalid notification webhook incident history occurredAt");
  }

  const id =
    normalizeString(args.id) ??
    `${args.kind}:${occurredAt.toISOString()}:${normalizeString(args.routeName) ?? normalizeString(args.actorUserId) ?? "system"}`;

  return {
    id,
    incidentKey: args.incidentKey,
    kind: args.kind,
    occurredAt: occurredAt.toISOString(),
    actorUserId: normalizeString(args.actorUserId),
    routeName: normalizeString(args.routeName),
    profileKey: normalizeString(args.profileKey),
    format: args.format ?? null,
    silencedUntil: parseWebhookIsoDate(args.silencedUntil)?.toISOString() ?? null,
    reason: normalizeString(args.reason),
  };
}

export function parseNotificationWebhookIncidentHistoryEntry(
  value: unknown,
): NotificationWebhookIncidentHistoryEntryView | null {
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const incidentKey = typeof entry.incidentKey === "string" ? entry.incidentKey.trim() : "";
  const kind =
    typeof entry.kind === "string" &&
    notificationWebhookIncidentHistoryKinds.includes(entry.kind as NotificationWebhookIncidentHistoryKind)
      ? (entry.kind as NotificationWebhookIncidentHistoryKind)
      : null;

  if (!incidentKey || !kind || !parseNotificationWebhookIncidentKey(incidentKey)) {
    return null;
  }

  const occurredAt = parseWebhookIsoDate(
    typeof entry.occurredAt === "string" || entry.occurredAt instanceof Date ? entry.occurredAt : null,
  );
  if (!occurredAt) {
    return null;
  }

  const format =
    typeof entry.format === "string" &&
    ["generic", "slack", "discord", "feishu"].includes(entry.format)
      ? (entry.format as NotificationWebhookFormat)
      : null;

  return buildNotificationWebhookIncidentHistoryEntry({
    id: typeof entry.id === "string" ? entry.id : null,
    incidentKey,
    kind,
    occurredAt,
    actorUserId: typeof entry.actorUserId === "string" ? entry.actorUserId : null,
    routeName: typeof entry.routeName === "string" ? entry.routeName : null,
    profileKey: typeof entry.profileKey === "string" ? entry.profileKey : null,
    format,
    silencedUntil:
      typeof entry.silencedUntil === "string" || entry.silencedUntil instanceof Date ? entry.silencedUntil : null,
    reason: typeof entry.reason === "string" ? entry.reason : null,
  });
}

export function buildNotificationWebhookIncidentControlState(args: {
  acknowledgedAt: string | Date | null | undefined;
  acknowledgedByUserId: string | null | undefined;
  silencedAt: string | Date | null | undefined;
  silencedUntil: string | Date | null | undefined;
  silencedByUserId: string | null | undefined;
  silenceReason: string | null | undefined;
}): NotificationWebhookIncidentControlState {
  const normalizeString = (value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  };

  return {
    acknowledgedAt: parseWebhookIsoDate(args.acknowledgedAt),
    acknowledgedByUserId: normalizeString(args.acknowledgedByUserId),
    silencedAt: parseWebhookIsoDate(args.silencedAt),
    silencedUntil: parseWebhookIsoDate(args.silencedUntil),
    silencedByUserId: normalizeString(args.silencedByUserId),
    silenceReason: normalizeString(args.silenceReason),
  };
}

export function resolveNotificationWebhookIncidentGovernanceState(args: {
  control: NotificationWebhookIncidentControlState;
  referenceTime: Date;
}): NotificationWebhookIncidentGovernanceState {
  if (args.control.silencedUntil && args.control.silencedUntil.getTime() > args.referenceTime.getTime()) {
    return "silenced";
  }
  if (args.control.acknowledgedAt) {
    return "acknowledged";
  }
  return "active";
}

export function parseNotificationWebhookIncidentKey(incidentKey: string): NotificationWebhookIncidentView | null {
  const parts = incidentKey.split(":");
  if (parts[0] === "callback-remediation") {
    if (parts.length !== 7) {
      return null;
    }

    const alertLevel = Number(parts[1]);
    if (!Number.isFinite(alertLevel) || alertLevel < 0) {
      return null;
    }

    return {
      incidentKey,
      eventName: "agentExecution.callbackRemediationAlerted",
      governanceState: "active",
      alertLevel: Math.floor(alertLevel),
      reasonCategory: parts[2] && parts[2] !== "none" ? parts[2] : null,
      reasonDisposition: parts[3] && parts[3] !== "none" ? parts[3] : null,
      policyKey: parts[4] && parts[4] !== "none" ? parts[4] : null,
      agentId: parts[5] && parts[5] !== "global" ? parts[5] : null,
      callbackType: parts[6] && parts[6] !== "all" ? parts[6] : null,
      profileKey: null,
      pressureLevel: null,
      schedulingDecisionClass: null,
      ownerUserId: null,
      projectId: null,
      incidentId: null,
      routePolicyId: null,
      snapshotId: null,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      silencedAt: null,
      silencedUntil: null,
      silencedByUserId: null,
      silenceReason: null,
      firstSeenAt: null,
      lastSeenAt: null,
      history: [],
      routeStates: [],
    };
  }

  if (parts[0] === "runtime-pressure") {
    if (parts.length !== 6) {
      return null;
    }

    const alertLevel = Number(parts[1]);
    const pressureLevel = parts[3];
    const schedulingDecisionClass = parts[4];
    if (!Number.isFinite(alertLevel) || alertLevel < 0) {
      return null;
    }
    if (!agentExecutionRuntimePressureLevels.includes(pressureLevel as AgentExecutionRuntimePressureLevel)) {
      return null;
    }
    if (
      !agentExecutionRuntimeSchedulingDecisionClasses.includes(
        schedulingDecisionClass as AgentExecutionRuntimeSchedulingDecisionClass,
      )
    ) {
      return null;
    }

    return {
      incidentKey,
      eventName: "agentExecution.runtimePressureAlerted",
      governanceState: "active",
      alertLevel: Math.floor(alertLevel),
      reasonCategory: null,
      reasonDisposition: null,
      policyKey: null,
      agentId: null,
      callbackType: null,
      profileKey: parts[2] && parts[2] !== "baseline" ? parts[2] : parts[2] || null,
      pressureLevel: pressureLevel as AgentExecutionRuntimePressureLevel,
      schedulingDecisionClass: schedulingDecisionClass as AgentExecutionRuntimeSchedulingDecisionClass,
      ownerUserId: parts[5] && parts[5] !== "none" ? parts[5] : null,
      projectId: null,
      incidentId: null,
      routePolicyId: null,
      snapshotId: null,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      silencedAt: null,
      silencedUntil: null,
      silencedByUserId: null,
      silenceReason: null,
      firstSeenAt: null,
      lastSeenAt: null,
      history: [],
      routeStates: [],
    };
  }

  if (parts[0] === "gateway-anomaly") {
    if (parts.length !== 7) {
      return null;
    }

    const alertLevel = Number(parts[1]);
    if (!Number.isFinite(alertLevel) || alertLevel < 0) {
      return null;
    }

    return {
      incidentKey,
      eventName: "aiGateway.anomalyIncidentAlerted",
      governanceState: "active",
      alertLevel: Math.floor(alertLevel),
      reasonCategory: parts[2] && parts[2] !== "none" ? parts[2] : null,
      reasonDisposition: parts[3] && parts[3] !== "none" ? parts[3] : null,
      policyKey: parts[4] && parts[4] !== "none" ? parts[4] : null,
      agentId: null,
      callbackType: null,
      profileKey: null,
      pressureLevel: null,
      schedulingDecisionClass: null,
      ownerUserId: null,
      projectId: parts[5] && parts[5] !== "global" ? parts[5] : null,
      incidentId: parts[6] && parts[6] !== "none" ? parts[6] : null,
      routePolicyId: null,
      snapshotId: null,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      silencedAt: null,
      silencedUntil: null,
      silencedByUserId: null,
      silenceReason: null,
      firstSeenAt: null,
      lastSeenAt: null,
      history: [],
      routeStates: [],
    };
  }

  if (parts[0] === "gateway-remediation-effectiveness-anomaly") {
    if (parts.length !== 7) {
      return null;
    }

    const alertLevel = Number(parts[1]);
    if (!Number.isFinite(alertLevel) || alertLevel < 0) {
      return null;
    }

    return {
      incidentKey,
      eventName: "aiGateway.remediationEffectivenessAnomalyAlerted",
      governanceState: "active",
      alertLevel: Math.floor(alertLevel),
      reasonCategory: parts[2] && parts[2] !== "none" ? parts[2] : null,
      reasonDisposition: parts[6] && parts[6] !== "none" ? parts[6] : null,
      policyKey: parts[3] && parts[3] !== "none" ? parts[3] : null,
      agentId: null,
      callbackType: null,
      profileKey: parts[3] && parts[3] !== "none" ? parts[3] : null,
      pressureLevel: null,
      schedulingDecisionClass: null,
      ownerUserId: null,
      projectId: null,
      incidentId: null,
      routePolicyId: parts[4] && parts[4] !== "global" ? parts[4] : null,
      snapshotId: parts[5] && parts[5] !== "none" ? parts[5] : null,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      silencedAt: null,
      silencedUntil: null,
      silencedByUserId: null,
      silenceReason: null,
      firstSeenAt: null,
      lastSeenAt: null,
      history: [],
      routeStates: [],
    };
  }

  if (parts[0] === "gateway-rate-limit-hotspot-anomaly") {
    if (parts.length !== 7) {
      return null;
    }

    const alertLevel = Number(parts[1]);
    if (!Number.isFinite(alertLevel) || alertLevel < 0) {
      return null;
    }

    return {
      incidentKey,
      eventName: "aiGateway.rateLimitHotspotAnomalyAlerted",
      governanceState: "active",
      alertLevel: Math.floor(alertLevel),
      reasonCategory: parts[2] && parts[2] !== "none" ? parts[2] : null,
      reasonDisposition: parts[3] && parts[3] !== "none" ? parts[3] : null,
      policyKey: parts[3] && parts[3] !== "none" ? parts[3] : null,
      agentId: null,
      callbackType: null,
      profileKey: parts[3] && parts[3] !== "none" ? parts[3] : null,
      pressureLevel: null,
      schedulingDecisionClass: null,
      ownerUserId: null,
      projectId: parts[5] && parts[5] !== "global" ? parts[5] : null,
      incidentId: null,
      routePolicyId: parts[4] && parts[4] !== "global" ? parts[4] : null,
      snapshotId: parts[6] && parts[6] !== "none" ? parts[6] : null,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      silencedAt: null,
      silencedUntil: null,
      silencedByUserId: null,
      silenceReason: null,
      firstSeenAt: null,
      lastSeenAt: null,
      history: [],
      routeStates: [],
    };
  }

  return null;
}

export function evaluateNotificationWebhookRoutePolicy(args: {
  route: Pick<
    NotificationWebhookRouteConfig,
    "minActiveMinutes" | "cooldownMinutes" | "maxDeliveriesPerIncident"
  >;
  state: NotificationWebhookRoutePolicyState;
  referenceTime: Date;
}): NotificationWebhookRoutePolicyDecision {
  const { route, state, referenceTime } = args;
  const firstSeenAt = state.firstSeenAt ?? referenceTime;
  const activeMinutes = Math.max(0, Math.floor((referenceTime.getTime() - firstSeenAt.getTime()) / (60 * 1000)));
  const lastSentAt = state.lastSentAt;
  const silenceRemainingMinutes =
    state.silencedUntil && state.silencedUntil.getTime() > referenceTime.getTime()
      ? Math.max(0, Math.ceil((state.silencedUntil.getTime() - referenceTime.getTime()) / (60 * 1000)))
      : null;
  const cooldownRemainingMinutes =
    route.cooldownMinutes !== null && lastSentAt
      ? Math.max(
          0,
          route.cooldownMinutes - Math.floor((referenceTime.getTime() - lastSentAt.getTime()) / (60 * 1000)),
        )
      : null;
  const deliveriesRemaining =
    route.maxDeliveriesPerIncident !== null
      ? Math.max(0, route.maxDeliveriesPerIncident - state.sendCount)
      : null;

  if (silenceRemainingMinutes !== null && silenceRemainingMinutes > 0) {
    return {
      allowed: false,
      reason: "silenced",
      activeMinutes,
      cooldownRemainingMinutes,
      deliveriesRemaining,
      silenceRemainingMinutes,
    };
  }

  if (route.minActiveMinutes !== null && activeMinutes < route.minActiveMinutes) {
    return {
      allowed: false,
      reason: "min_active_not_reached",
      activeMinutes,
      cooldownRemainingMinutes,
      deliveriesRemaining,
      silenceRemainingMinutes,
    };
  }

  if (route.maxDeliveriesPerIncident !== null && state.sendCount >= route.maxDeliveriesPerIncident) {
    return {
      allowed: false,
      reason: "max_deliveries_reached",
      activeMinutes,
      cooldownRemainingMinutes,
      deliveriesRemaining,
      silenceRemainingMinutes,
    };
  }

  if (route.cooldownMinutes !== null && lastSentAt && cooldownRemainingMinutes !== null && cooldownRemainingMinutes > 0) {
    return {
      allowed: false,
      reason: "cooldown_active",
      activeMinutes,
      cooldownRemainingMinutes,
      deliveriesRemaining,
      silenceRemainingMinutes,
    };
  }

  return {
    allowed: true,
    reason: null,
    activeMinutes,
    cooldownRemainingMinutes,
    deliveriesRemaining,
    silenceRemainingMinutes,
  };
}

export function buildNotificationWebhookRoutePolicyState(args: {
  firstSeenAt: string | Date | null | undefined;
  lastSeenAt: string | Date | null | undefined;
  lastSentAt: string | Date | null | undefined;
  sendCount: number;
  silencedUntil?: string | Date | null | undefined;
}): NotificationWebhookRoutePolicyState {
  return {
    firstSeenAt: parseWebhookIsoDate(args.firstSeenAt),
    lastSeenAt: parseWebhookIsoDate(args.lastSeenAt),
    lastSentAt: parseWebhookIsoDate(args.lastSentAt),
    sendCount: Math.max(0, Math.floor(args.sendCount)),
    silencedUntil: parseWebhookIsoDate(args.silencedUntil),
  };
}
