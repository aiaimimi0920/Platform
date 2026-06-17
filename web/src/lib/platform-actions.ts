"use server";

import {
  createAgentExecutionAction as createAgentExecutionActionImpl,
  updateAgentExecutionCallbackRemediationPolicyAction as updateAgentExecutionCallbackRemediationPolicyActionImpl,
} from "@/lib/platform-agent-execution-create-actions";
import {
  applyAgentExecutionLaunchPresetSuggestedRuntimeProfileAction as applyAgentExecutionLaunchPresetSuggestedRuntimeProfileActionImpl,
  deleteAgentExecutionLaunchPresetAction as deleteAgentExecutionLaunchPresetActionImpl,
  saveAgentExecutionLaunchPresetAction as saveAgentExecutionLaunchPresetActionImpl,
  setAgentExecutionLaunchPresetDefaultAction as setAgentExecutionLaunchPresetDefaultActionImpl,
} from "@/lib/platform-agent-execution-preset-actions";
import {
  recoverStalePlatformExecutionsAction as recoverStalePlatformExecutionsActionImpl,
  recoverThenRunPlatformExecutorAction as recoverThenRunPlatformExecutorActionImpl,
  retryAgentExecutionSettlementAction as retryAgentExecutionSettlementActionImpl,
  runPlatformExecutorNowAction as runPlatformExecutorNowActionImpl,
  sweepRuntimeSessionsAction as sweepRuntimeSessionsActionImpl,
} from "@/lib/platform-agent-execution-runtime-actions";
import {
  addAgentExecutionArtifactAction as addAgentExecutionArtifactActionImpl,
  advanceArbitrationReviewRoundAction as advanceArbitrationReviewRoundActionImpl,
  createAgentExecutionSubtaskAction as createAgentExecutionSubtaskActionImpl,
  requeueAgentExecutionAction as requeueAgentExecutionActionImpl,
  updateAgentExecutionStatusAction as updateAgentExecutionStatusActionImpl,
  updateAgentExecutionSubtaskStatusAction as updateAgentExecutionSubtaskStatusActionImpl,
} from "@/lib/platform-agent-execution-support-actions";
import {
  claimMailboxAttachmentAction as claimMailboxAttachmentActionImpl,
  claimMissionAction as claimMissionActionImpl,
  exchangeObsidianToMiraAction as exchangeObsidianToMiraActionImpl,
  redeemCodeAction as redeemCodeActionImpl,
} from "@/lib/platform-account-economy-actions";
import {
  rotateAgentCallbackSecretAction as rotateAgentCallbackSecretActionImpl,
  updateAgentCallbackProtocolVersionAction as updateAgentCallbackProtocolVersionActionImpl,
  updateAgentCallbackRemediationPolicyAction as updateAgentCallbackRemediationPolicyActionImpl,
} from "@/lib/platform-agent-callback-actions";
import {
  autoRemediateRejectedCallbackPayloadsAction as autoRemediateRejectedCallbackPayloadsActionImpl,
  cleanupExpiredAgentCallbackCompatibilityAction as cleanupExpiredAgentCallbackCompatibilityActionImpl,
  emitCallbackRemediationAlertsAction as emitCallbackRemediationAlertsActionImpl,
  emitRuntimePressureAlertsAction as emitRuntimePressureAlertsActionImpl,
  replayRejectedCallbackPayloadAction as replayRejectedCallbackPayloadActionImpl,
  requestRejectedCallbackRetryAction as requestRejectedCallbackRetryActionImpl,
  requestRejectedCallbackRetryBatchAction as requestRejectedCallbackRetryBatchActionImpl,
} from "@/lib/platform-agent-callback-remediation-actions";
import {
  addAgentCapabilityAction as addAgentCapabilityActionImpl,
  applyManagedCloudAgentBatchAction as applyManagedCloudAgentBatchActionImpl,
  applyManagedHeavyAgentBatchAction as applyManagedHeavyAgentBatchActionImpl,
  applyManagedLightAgentBatchAction as applyManagedLightAgentBatchActionImpl,
  bulkImportAgentsAction as bulkImportAgentsActionImpl,
  createAgentAction as createAgentActionImpl,
  saveManagedCloudAgentAction as saveManagedCloudAgentActionImpl,
  saveManagedHeavyAgentAction as saveManagedHeavyAgentActionImpl,
  saveManagedLightAgentAction as saveManagedLightAgentActionImpl,
} from "@/lib/platform-managed-agent-actions";
import {
  acknowledgeNotificationWebhookIncidentAction as acknowledgeNotificationWebhookIncidentActionImpl,
  acknowledgeNotificationWebhookIncidentBatchAction as acknowledgeNotificationWebhookIncidentBatchActionImpl,
  clearNotificationWebhookIncidentSilenceAction as clearNotificationWebhookIncidentSilenceActionImpl,
  clearNotificationWebhookIncidentSilenceBatchAction as clearNotificationWebhookIncidentSilenceBatchActionImpl,
  deleteNotificationWebhookIncidentViewAction as deleteNotificationWebhookIncidentViewActionImpl,
  overwriteNotificationWebhookIncidentViewAction as overwriteNotificationWebhookIncidentViewActionImpl,
  runNotificationWebhookIncidentSavedViewPlaybookAction as runNotificationWebhookIncidentSavedViewPlaybookActionImpl,
  saveNotificationWebhookIncidentViewAction as saveNotificationWebhookIncidentViewActionImpl,
  setDefaultNotificationWebhookIncidentViewAction as setDefaultNotificationWebhookIncidentViewActionImpl,
  silenceNotificationWebhookIncidentAction as silenceNotificationWebhookIncidentActionImpl,
  silenceNotificationWebhookIncidentBatchAction as silenceNotificationWebhookIncidentBatchActionImpl,
} from "@/lib/platform-notification-webhook-incident-actions";
import {
  invokeAgentMarketplaceListingAction as invokeAgentMarketplaceListingActionImpl,
  invokeAgentMarketplaceListingBatchAction as invokeAgentMarketplaceListingBatchActionImpl,
  runAgentMarketplaceAutoProposalSweepAction as runAgentMarketplaceAutoProposalSweepActionImpl,
  updateAgentMarketplaceListingStatusAction as updateAgentMarketplaceListingStatusActionImpl,
  upsertAgentMarketplaceListingAction as upsertAgentMarketplaceListingActionImpl,
} from "@/lib/platform-agent-marketplace-actions";
import {
  applyOperatorDiscountCodeBatchAction as applyOperatorDiscountCodeBatchActionImpl,
  createListingAction as createListingActionImpl,
  deleteOperatorProductAction as deleteOperatorProductActionImpl,
  importOperatorDiscountCodesCsvAction as importOperatorDiscountCodesCsvActionImpl,
  previewOperatorDiscountCodesCsvAction as previewOperatorDiscountCodesCsvActionImpl,
  purchaseListingAction as purchaseListingActionImpl,
  submitOrderAction as submitOrderActionImpl,
  upsertOperatorDiscountCodeAction as upsertOperatorDiscountCodeActionImpl,
  upsertOperatorProductAction as upsertOperatorProductActionImpl,
} from "@/lib/platform-commerce-actions";
import {
  assignBalancedManualReviewAction as assignBalancedManualReviewActionImpl,
  assignManualReviewAction as assignManualReviewActionImpl,
  claimItemManualReviewAction as claimItemManualReviewActionImpl,
  claimNextManualReviewAction as claimNextManualReviewActionImpl,
  escalateFulfillmentAnomaliesAction as escalateFulfillmentAnomaliesActionImpl,
  rebalanceManualReviewQueueAction as rebalanceManualReviewQueueActionImpl,
  reconcileItemAction as reconcileItemActionImpl,
  releaseItemManualReviewAction as releaseItemManualReviewActionImpl,
  releaseStaleItemManualReviewsAction as releaseStaleItemManualReviewsActionImpl,
  reportItemUnitIssueAction as reportItemUnitIssueActionImpl,
  resolveItemManualReviewAction as resolveItemManualReviewActionImpl,
  triggerManualReviewAutoAssignSlaAction as triggerManualReviewAutoAssignSlaActionImpl,
  triggerManualReviewAutoRebalanceAction as triggerManualReviewAutoRebalanceActionImpl,
} from "@/lib/platform-fulfillment-actions";
import {
  adoptOpinionTopicAction as adoptOpinionTopicActionImpl,
  archiveOpinionTopicAction as archiveOpinionTopicActionImpl,
  batchExcludeOpinionMonthlySettlementItemsAction as batchExcludeOpinionMonthlySettlementItemsActionImpl,
  batchRestoreOpinionMonthlySettlementItemsAction as batchRestoreOpinionMonthlySettlementItemsActionImpl,
  createOpinionTopicAction as createOpinionTopicActionImpl,
  createOpinionTopicCommentAction as createOpinionTopicCommentActionImpl,
  moderateOpinionTopicAction as moderateOpinionTopicActionImpl,
  opposeOpinionTopicAction as opposeOpinionTopicActionImpl,
  runOpinionMonthlyLeaderSettlementAction as runOpinionMonthlyLeaderSettlementActionImpl,
  supportOpinionTopicAction as supportOpinionTopicActionImpl,
  updateOpinionHubSettingsAction as updateOpinionHubSettingsActionImpl,
  updateOpinionMonthlySettlementItemDecisionAction as updateOpinionMonthlySettlementItemDecisionActionImpl,
} from "@/lib/platform-opinion-actions";
import {
  emitOutboxAlertsAction as emitOutboxAlertsActionImpl,
  retryOutboxEventAction as retryOutboxEventActionImpl,
  retryOutboxEventsBatchAction as retryOutboxEventsBatchActionImpl,
} from "@/lib/platform-outbox-actions";
import {
  clearAgentExecutionOwnerReliefHandoffDefaultAction as clearAgentExecutionOwnerReliefHandoffDefaultActionImpl,
  finalizeAgentExecutionOwnerReliefRunAction as finalizeAgentExecutionOwnerReliefRunActionImpl,
  openAgentExecutionOwnerReliefRunHandoffAction as openAgentExecutionOwnerReliefRunHandoffActionImpl,
  reopenAgentExecutionOwnerReliefRunAction as reopenAgentExecutionOwnerReliefRunActionImpl,
  resolveAgentExecutionOwnerReliefHandoffAction as resolveAgentExecutionOwnerReliefHandoffActionImpl,
  saveAgentExecutionOwnerReliefHandoffDefaultAction as saveAgentExecutionOwnerReliefHandoffDefaultActionImpl,
} from "@/lib/platform-owner-relief-actions";
import {
  acceptTaskAgentProposalAction as acceptTaskAgentProposalActionImpl,
  applyTaskAction as applyTaskActionImpl,
  createTaskAction as createTaskActionImpl,
  createTaskAgentProposalAction as createTaskAgentProposalActionImpl,
  dispatchTaskAction as dispatchTaskActionImpl,
  rejectTaskAgentProposalAction as rejectTaskAgentProposalActionImpl,
  taskLifecycleAction as taskLifecycleActionImpl,
  updateDevelopmentQueueStatusAction as updateDevelopmentQueueStatusActionImpl,
} from "@/lib/platform-task-actions";

export async function saveAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  return saveAgentExecutionOwnerReliefHandoffDefaultActionImpl(formData);
}

export async function clearAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  return clearAgentExecutionOwnerReliefHandoffDefaultActionImpl(formData);
}

export async function openAgentExecutionOwnerReliefRunHandoffAction(formData: FormData) {
  return openAgentExecutionOwnerReliefRunHandoffActionImpl(formData);
}

export async function resolveAgentExecutionOwnerReliefHandoffAction(formData: FormData) {
  return resolveAgentExecutionOwnerReliefHandoffActionImpl(formData);
}

export async function submitOrderAction(formData: FormData) {
  return submitOrderActionImpl(formData);
}

export async function upsertOperatorProductAction(formData: FormData) {
  return upsertOperatorProductActionImpl(formData);
}

export async function deleteOperatorProductAction(formData: FormData) {
  return deleteOperatorProductActionImpl(formData);
}

export async function upsertOperatorDiscountCodeAction(formData: FormData) {
  return upsertOperatorDiscountCodeActionImpl(formData);
}

export async function applyOperatorDiscountCodeBatchAction(formData: FormData) {
  return applyOperatorDiscountCodeBatchActionImpl(formData);
}

export async function importOperatorDiscountCodesCsvAction(formData: FormData) {
  return importOperatorDiscountCodesCsvActionImpl(formData);
}

export async function previewOperatorDiscountCodesCsvAction(formData: FormData) {
  return previewOperatorDiscountCodesCsvActionImpl(formData);
}

export async function createListingAction(formData: FormData) {
  return createListingActionImpl(formData);
}

export async function purchaseListingAction(formData: FormData) {
  return purchaseListingActionImpl(formData);
}



export async function redeemCodeAction(formData: FormData) {
  return redeemCodeActionImpl(formData);
}


export async function reportItemUnitIssueAction(formData: FormData) {
  return reportItemUnitIssueActionImpl(formData);
}

export async function reconcileItemAction(formData: FormData) {
  return reconcileItemActionImpl(formData);
}

export async function resolveItemManualReviewAction(formData: FormData) {
  return resolveItemManualReviewActionImpl(formData);
}


export async function updateAgentCallbackRemediationPolicyAction(formData: FormData) {
  return updateAgentCallbackRemediationPolicyActionImpl(formData);
}

export async function claimItemManualReviewAction(formData: FormData) {
  return claimItemManualReviewActionImpl(formData);
}

export async function releaseItemManualReviewAction(formData: FormData) {
  return releaseItemManualReviewActionImpl(formData);
}

export async function triggerManualReviewAutoRebalanceAction(formData: FormData) {
  return triggerManualReviewAutoRebalanceActionImpl(formData);
}

export async function triggerManualReviewAutoAssignSlaAction(formData: FormData) {
  return triggerManualReviewAutoAssignSlaActionImpl(formData);
}

export async function releaseStaleItemManualReviewsAction(formData: FormData) {
  return releaseStaleItemManualReviewsActionImpl(formData);
}

export async function claimNextManualReviewAction(formData: FormData) {
  return claimNextManualReviewActionImpl(formData);
}

export async function escalateFulfillmentAnomaliesAction(formData: FormData) {
  return escalateFulfillmentAnomaliesActionImpl(formData);
}

export async function assignBalancedManualReviewAction(formData: FormData) {
  return assignBalancedManualReviewActionImpl(formData);
}

export async function rebalanceManualReviewQueueAction(formData: FormData) {
  return rebalanceManualReviewQueueActionImpl(formData);
}

export async function assignManualReviewAction(formData: FormData) {
  return assignManualReviewActionImpl(formData);
}

export async function retryOutboxEventAction(formData: FormData) {
  return retryOutboxEventActionImpl(formData);
}

export async function retryOutboxEventsBatchAction(formData: FormData) {
  return retryOutboxEventsBatchActionImpl(formData);
}

export async function emitOutboxAlertsAction(formData: FormData) {
  return emitOutboxAlertsActionImpl(formData);
}

export async function claimMailboxAttachmentAction(formData: FormData) {
  return claimMailboxAttachmentActionImpl(formData);
}

export async function claimMissionAction(formData: FormData) {
  return claimMissionActionImpl(formData);
}

export async function exchangeObsidianToMiraAction(formData: FormData) {
  return exchangeObsidianToMiraActionImpl(formData);
}


export async function createOpinionTopicAction(formData: FormData) {
  return createOpinionTopicActionImpl(formData);
}

export async function supportOpinionTopicAction(formData: FormData) {
  return supportOpinionTopicActionImpl(formData);
}

export async function opposeOpinionTopicAction(formData: FormData) {
  return opposeOpinionTopicActionImpl(formData);
}

export async function archiveOpinionTopicAction(formData: FormData) {
  return archiveOpinionTopicActionImpl(formData);
}

export async function adoptOpinionTopicAction(formData: FormData) {
  return adoptOpinionTopicActionImpl(formData);
}

export async function createOpinionTopicCommentAction(formData: FormData) {
  return createOpinionTopicCommentActionImpl(formData);
}

export async function updateOpinionHubSettingsAction(formData: FormData) {
  return updateOpinionHubSettingsActionImpl(formData);
}

export async function moderateOpinionTopicAction(formData: FormData) {
  return moderateOpinionTopicActionImpl(formData);
}

export async function runOpinionMonthlyLeaderSettlementAction(formData: FormData) {
  return runOpinionMonthlyLeaderSettlementActionImpl(formData);
}

export async function updateOpinionMonthlySettlementItemDecisionAction(formData: FormData) {
  return updateOpinionMonthlySettlementItemDecisionActionImpl(formData);
}

export async function batchExcludeOpinionMonthlySettlementItemsAction(formData: FormData) {
  return batchExcludeOpinionMonthlySettlementItemsActionImpl(formData);
}

export async function batchRestoreOpinionMonthlySettlementItemsAction(formData: FormData) {
  return batchRestoreOpinionMonthlySettlementItemsActionImpl(formData);
}


export async function createTaskAction(formData: FormData) {
  return createTaskActionImpl(formData);
}

export async function applyTaskAction(formData: FormData) {
  return applyTaskActionImpl(formData);
}

export async function dispatchTaskAction(formData: FormData) {
  return dispatchTaskActionImpl(formData);
}

export async function createTaskAgentProposalAction(formData: FormData) {
  return createTaskAgentProposalActionImpl(formData);
}

export async function acceptTaskAgentProposalAction(formData: FormData) {
  return acceptTaskAgentProposalActionImpl(formData);
}

export async function rejectTaskAgentProposalAction(formData: FormData) {
  return rejectTaskAgentProposalActionImpl(formData);
}

export async function updateDevelopmentQueueStatusAction(formData: FormData) {
  return updateDevelopmentQueueStatusActionImpl(formData);
}

export async function taskLifecycleAction(formData: FormData) {
  return taskLifecycleActionImpl(formData);
}


export async function createAgentAction(formData: FormData) {
  return createAgentActionImpl(formData);
}

export async function saveManagedLightAgentAction(formData: FormData) {
  return saveManagedLightAgentActionImpl(formData);
}

export async function saveManagedCloudAgentAction(formData: FormData) {
  return saveManagedCloudAgentActionImpl(formData);
}

export async function saveManagedHeavyAgentAction(formData: FormData) {
  return saveManagedHeavyAgentActionImpl(formData);
}

export async function applyManagedLightAgentBatchAction(formData: FormData) {
  return applyManagedLightAgentBatchActionImpl(formData);
}

export async function applyManagedCloudAgentBatchAction(formData: FormData) {
  return applyManagedCloudAgentBatchActionImpl(formData);
}

export async function applyManagedHeavyAgentBatchAction(formData: FormData) {
  return applyManagedHeavyAgentBatchActionImpl(formData);
}

export async function bulkImportAgentsAction(formData: FormData) {
  return bulkImportAgentsActionImpl(formData);
}

export async function addAgentCapabilityAction(formData: FormData) {
  return addAgentCapabilityActionImpl(formData);
}
export async function upsertAgentMarketplaceListingAction(formData: FormData) {
  return upsertAgentMarketplaceListingActionImpl(formData);
}

export async function updateAgentMarketplaceListingStatusAction(formData: FormData) {
  return updateAgentMarketplaceListingStatusActionImpl(formData);
}

export async function runAgentMarketplaceAutoProposalSweepAction(formData: FormData) {
  return runAgentMarketplaceAutoProposalSweepActionImpl(formData);
}

export async function invokeAgentMarketplaceListingAction(formData: FormData) {
  return invokeAgentMarketplaceListingActionImpl(formData);
}

export async function invokeAgentMarketplaceListingBatchAction(formData: FormData) {
  return invokeAgentMarketplaceListingBatchActionImpl(formData);
}

export async function rotateAgentCallbackSecretAction(formData: FormData) {
  return rotateAgentCallbackSecretActionImpl(formData);
}

export async function updateAgentCallbackProtocolVersionAction(formData: FormData) {
  return updateAgentCallbackProtocolVersionActionImpl(formData);
}

export async function createAgentExecutionAction(formData: FormData) {
  return createAgentExecutionActionImpl(formData);
}
export async function saveAgentExecutionLaunchPresetAction(formData: FormData) {
  return saveAgentExecutionLaunchPresetActionImpl(formData);
}

export async function setAgentExecutionLaunchPresetDefaultAction(formData: FormData) {
  return setAgentExecutionLaunchPresetDefaultActionImpl(formData);
}

export async function applyAgentExecutionLaunchPresetSuggestedRuntimeProfileAction(formData: FormData) {
  return applyAgentExecutionLaunchPresetSuggestedRuntimeProfileActionImpl(formData);
}

export async function deleteAgentExecutionLaunchPresetAction(formData: FormData) {
  return deleteAgentExecutionLaunchPresetActionImpl(formData);
}

export async function updateAgentExecutionCallbackRemediationPolicyAction(formData: FormData) {
  return updateAgentExecutionCallbackRemediationPolicyActionImpl(formData);
}
export async function advanceArbitrationReviewRoundAction(formData: FormData) {
  return advanceArbitrationReviewRoundActionImpl(formData);
}

export async function createAgentExecutionSubtaskAction(formData: FormData) {
  return createAgentExecutionSubtaskActionImpl(formData);
}

export async function updateAgentExecutionStatusAction(formData: FormData) {
  return updateAgentExecutionStatusActionImpl(formData);
}

export async function updateAgentExecutionSubtaskStatusAction(formData: FormData) {
  return updateAgentExecutionSubtaskStatusActionImpl(formData);
}

export async function requeueAgentExecutionAction(formData: FormData) {
  return requeueAgentExecutionActionImpl(formData);
}

export async function recoverStalePlatformExecutionsAction(formData: FormData) {
  return recoverStalePlatformExecutionsActionImpl(formData);
}

export async function runPlatformExecutorNowAction(formData: FormData) {
  return runPlatformExecutorNowActionImpl(formData);
}

export async function retryAgentExecutionSettlementAction(formData: FormData) {
  return retryAgentExecutionSettlementActionImpl(formData);
}

export async function sweepRuntimeSessionsAction(formData: FormData) {
  return sweepRuntimeSessionsActionImpl(formData);
}

export async function recoverThenRunPlatformExecutorAction(formData: FormData) {
  return recoverThenRunPlatformExecutorActionImpl(formData);
}

export async function finalizeAgentExecutionOwnerReliefRunAction(formData: FormData) {
  return finalizeAgentExecutionOwnerReliefRunActionImpl(formData);
}

export async function reopenAgentExecutionOwnerReliefRunAction(formData: FormData) {
  return reopenAgentExecutionOwnerReliefRunActionImpl(formData);
}
export async function requestRejectedCallbackRetryAction(formData: FormData) {
  return requestRejectedCallbackRetryActionImpl(formData);
}

export async function cleanupExpiredAgentCallbackCompatibilityAction(formData: FormData) {
  return cleanupExpiredAgentCallbackCompatibilityActionImpl(formData);
}

export async function autoRemediateRejectedCallbackPayloadsAction(formData: FormData) {
  return autoRemediateRejectedCallbackPayloadsActionImpl(formData);
}

export async function emitCallbackRemediationAlertsAction(formData: FormData) {
  return emitCallbackRemediationAlertsActionImpl(formData);
}

export async function emitRuntimePressureAlertsAction(formData: FormData) {
  return emitRuntimePressureAlertsActionImpl(formData);
}

export async function acknowledgeNotificationWebhookIncidentAction(formData: FormData) {
  return acknowledgeNotificationWebhookIncidentActionImpl(formData);
}

export async function silenceNotificationWebhookIncidentAction(formData: FormData) {
  return silenceNotificationWebhookIncidentActionImpl(formData);
}

export async function clearNotificationWebhookIncidentSilenceAction(formData: FormData) {
  return clearNotificationWebhookIncidentSilenceActionImpl(formData);
}

export async function acknowledgeNotificationWebhookIncidentBatchAction(formData: FormData) {
  return acknowledgeNotificationWebhookIncidentBatchActionImpl(formData);
}

export async function silenceNotificationWebhookIncidentBatchAction(formData: FormData) {
  return silenceNotificationWebhookIncidentBatchActionImpl(formData);
}

export async function clearNotificationWebhookIncidentSilenceBatchAction(formData: FormData) {
  return clearNotificationWebhookIncidentSilenceBatchActionImpl(formData);
}

export async function runNotificationWebhookIncidentSavedViewPlaybookAction(formData: FormData) {
  return runNotificationWebhookIncidentSavedViewPlaybookActionImpl(formData);
}

export async function saveNotificationWebhookIncidentViewAction(formData: FormData) {
  return saveNotificationWebhookIncidentViewActionImpl(formData);
}

export async function overwriteNotificationWebhookIncidentViewAction(formData: FormData) {
  return overwriteNotificationWebhookIncidentViewActionImpl(formData);
}

export async function setDefaultNotificationWebhookIncidentViewAction(formData: FormData) {
  return setDefaultNotificationWebhookIncidentViewActionImpl(formData);
}

export async function deleteNotificationWebhookIncidentViewAction(formData: FormData) {
  return deleteNotificationWebhookIncidentViewActionImpl(formData);
}

export async function requestRejectedCallbackRetryBatchAction(formData: FormData) {
  return requestRejectedCallbackRetryBatchActionImpl(formData);
}

export async function replayRejectedCallbackPayloadAction(formData: FormData) {
  return replayRejectedCallbackPayloadActionImpl(formData);
}

export async function addAgentExecutionArtifactAction(formData: FormData) {
  return addAgentExecutionArtifactActionImpl(formData);
}
