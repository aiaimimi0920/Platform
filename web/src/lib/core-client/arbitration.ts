import {
  type AdvanceArbitrationReviewRoundInput,
  type ArbitrationCaseView,
  type ArbitrationEvidenceAttachmentUploadPlanView,
  type CreateArbitrationEvidenceInput,
  type CreateArbitrationCaseInput,
  type PrepareArbitrationEvidenceAttachmentUploadInput,
  type UploadArbitrationEvidenceAttachmentInput,
  type ArbitrationCaseSummaryView,
  type ArbitrationRemoteAttachmentCleanupQueueView,
  type ArbitrationWorkloadView,
  type InternalUserContext,
  type UpdateArbitrationCaseStatusInput,
} from "@neuro/contracts";

import { coreRequest } from "./request";

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

export async function listArbitrationCases(userContext: InternalUserContext) {
  const response = await coreRequest<{ cases: ArbitrationCaseView[] }>("/v1/arbitrations/cases", {
    userContext,
  });
  return response.cases;
}

export async function getArbitrationCaseSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: ArbitrationCaseSummaryView }>("/v1/arbitrations/cases/summary", {
    userContext,
  });
  return response.summary;
}

export async function getArbitrationCaseWorkload(userContext: InternalUserContext) {
  const response = await coreRequest<{ workload: ArbitrationWorkloadView }>("/v1/arbitrations/cases/workload", {
    userContext,
  });
  return response.workload;
}

export async function getArbitrationRemoteAttachmentCleanupQueue(
  userContext: InternalUserContext,
  args?: { limit?: number },
) {
  const params = new URLSearchParams();
  if (typeof args?.limit === "number") params.set("limit", String(args.limit));
  const response = await coreRequest<{ queue: ArbitrationRemoteAttachmentCleanupQueueView }>(
    `/v1/internal/arbitrations/attachments/cleanup-queue${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      userContext,
    },
  );
  return response.queue;
}

export async function createArbitrationCase(
  userContext: InternalUserContext,
  input: CreateArbitrationCaseInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>("/v1/arbitrations/cases", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.case;
}

export async function addArbitrationEvidence(
  userContext: InternalUserContext,
  caseId: string,
  input: CreateArbitrationEvidenceInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${encodePathSegment(caseId)}/evidences`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function addArbitrationEvidenceAttachment(
  userContext: InternalUserContext,
  evidenceId: string,
  input: UploadArbitrationEvidenceAttachmentInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/evidences/${encodePathSegment(evidenceId)}/attachments`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function prepareArbitrationEvidenceAttachmentUpload(
  userContext: InternalUserContext,
  evidenceId: string,
  input: PrepareArbitrationEvidenceAttachmentUploadInput,
) {
  const response = await coreRequest<{
    case: ArbitrationCaseView;
    upload: ArbitrationEvidenceAttachmentUploadPlanView;
  }>(`/v1/arbitrations/evidences/${encodePathSegment(evidenceId)}/attachments/prepare-upload`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response;
}

export async function completeArbitrationEvidenceAttachmentUpload(
  userContext: InternalUserContext,
  attachmentId: string,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/attachments/${encodePathSegment(attachmentId)}/complete-upload`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function archiveArbitrationEvidenceAttachment(userContext: InternalUserContext, attachmentId: string) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/attachments/${encodePathSegment(attachmentId)}/cleanup`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function requestArbitrationEvidenceAttachmentCleanup(
  userContext: InternalUserContext,
  attachmentId: string,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/attachments/${encodePathSegment(attachmentId)}/request-cleanup`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function updateArbitrationCaseStatus(
  userContext: InternalUserContext,
  caseId: string,
  input: UpdateArbitrationCaseStatusInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${encodePathSegment(caseId)}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function claimArbitrationCase(userContext: InternalUserContext, caseId: string) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${encodePathSegment(caseId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function assignArbitrationCase(
  userContext: InternalUserContext,
  caseId: string,
  input: { assigneeUserId: string },
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${encodePathSegment(caseId)}/assign`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function claimNextArbitrationCase(userContext: InternalUserContext) {
  const response = await coreRequest<{ case: ArbitrationCaseView | null }>("/v1/arbitrations/cases/claim-next", {
    method: "POST",
    userContext,
  });
  return response.case;
}

export async function releaseArbitrationCase(userContext: InternalUserContext, caseId: string) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${encodePathSegment(caseId)}/release`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function releaseStaleArbitrationCases(userContext: InternalUserContext, input?: { limit?: number }) {
  return coreRequest<{ result: { scannedCount: number; releasedCount: number; caseIds: string[] } }>(
    "/v1/internal/arbitrations/cases/release-stale",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
}

export async function cleanupResolvedRemoteArbitrationAttachments(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  return coreRequest<{
    result: {
      scannedCount: number;
      archivedCount: number;
      failedCount: number;
      failures: Array<{ attachmentId: string; message: string }>;
    };
  }>("/v1/internal/arbitrations/attachments/cleanup-remote", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function advanceArbitrationReviewRound(
  userContext: InternalUserContext,
  caseId: string,
  input: AdvanceArbitrationReviewRoundInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${encodePathSegment(caseId)}/review-rounds/advance`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}
