import type {
  ArbitrationCaseView,
  ArbitrationCaseSummaryView,
  ArbitrationRemoteAttachmentCleanupQueueView,
  ArbitrationWorkloadView,
  CreateArbitrationEvidenceInput,
  InternalUserContext,
  UpdateArbitrationCaseStatusInput,
} from "@neuro/contracts";
import * as coreClient from "./core-client";

export type ArbitrationCoreClient = {
  listArbitrationCases?: (userContext: InternalUserContext) => Promise<ArbitrationCaseView[]>;
  createArbitrationCase?: (
    userContext: InternalUserContext,
    input: {
      entityType: "task";
      entityId: string;
      reason: string;
      evidenceSummary?: string | null;
    },
  ) => Promise<ArbitrationCaseView>;
  updateArbitrationCaseStatus?: (
    userContext: InternalUserContext,
    caseId: string,
    input: UpdateArbitrationCaseStatusInput,
  ) => Promise<ArbitrationCaseView>;
  addArbitrationEvidence?: (
    userContext: InternalUserContext,
    caseId: string,
    input: CreateArbitrationEvidenceInput,
  ) => Promise<ArbitrationCaseView>;
  claimArbitrationCase?: (userContext: InternalUserContext, caseId: string) => Promise<ArbitrationCaseView>;
  releaseArbitrationCase?: (userContext: InternalUserContext, caseId: string) => Promise<ArbitrationCaseView>;
  assignArbitrationCase?: (
    userContext: InternalUserContext,
    caseId: string,
    input: { assigneeUserId: string },
  ) => Promise<ArbitrationCaseView>;
  advanceArbitrationReviewRound?: (
    userContext: InternalUserContext,
    caseId: string,
    input: { summary?: string | null; assignToOperatorUserId?: string | null },
  ) => Promise<ArbitrationCaseView>;
  getArbitrationCaseSummary?: (userContext: InternalUserContext) => Promise<ArbitrationCaseSummaryView>;
  getArbitrationCaseWorkload?: (userContext: InternalUserContext) => Promise<ArbitrationWorkloadView>;
  getArbitrationRemoteAttachmentCleanupQueue?: (
    userContext: InternalUserContext,
    args?: { limit?: number },
  ) => Promise<ArbitrationRemoteAttachmentCleanupQueueView>;
  claimNextArbitrationCase?: (userContext: InternalUserContext) => Promise<ArbitrationCaseView | null>;
  archiveArbitrationEvidenceAttachment?: (
    userContext: InternalUserContext,
    attachmentId: string,
  ) => Promise<ArbitrationCaseView>;
  requestArbitrationEvidenceAttachmentCleanup?: (
    userContext: InternalUserContext,
    attachmentId: string,
  ) => Promise<ArbitrationCaseView>;
  releaseStaleArbitrationCases?: (
    userContext: InternalUserContext,
    input?: { limit?: number },
  ) => Promise<{ result: { scannedCount: number; releasedCount: number; caseIds: string[] } }>;
  cleanupResolvedRemoteArbitrationAttachments?: (
    userContext: InternalUserContext,
    input?: { limit?: number },
  ) => Promise<{
    result: {
      scannedCount: number;
      archivedCount: number;
      failedCount: number;
      failures: Array<{ attachmentId: string; message: string }>;
    };
  }>;
};

export const arbitrationClient = coreClient as unknown as ArbitrationCoreClient;
