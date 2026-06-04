import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  addArbitrationEvidence,
  addArbitrationEvidenceAttachment,
  completeArbitrationEvidenceAttachmentUpload,
  advanceArbitrationReviewRound,
  autoAdvanceStaleArbitrationReviewRounds,
  archiveArbitrationEvidenceAttachment,
  assignArbitrationCase,
  claimNextArbitrationCase,
  claimArbitrationCase,
  cleanupResolvedRemoteArbitrationAttachments,
  createArbitrationCase,
  escalateTerminalArbitrationReviewRounds,
  rebalanceArbitrationReviewRounds,
  expirePreparedArbitrationEvidenceUploads,
  getArbitrationEvidenceAttachmentContent,
  getArbitrationEvidenceAttachmentAccess,
  getArbitrationCaseWorkload,
  listArbitrationEvidenceStoragePolicies,
  getArbitrationRemoteAttachmentCleanupQueue,
  getVisibleArbitrationCaseSummary,
  listVisibleArbitrationCases,
  prepareArbitrationEvidenceAttachmentUpload,
  requestArbitrationEvidenceAttachmentCleanup,
  releaseArbitrationCase,
  releaseStaleArbitrationClaims,
  updateArbitrationCaseStatus,
} from "@/modules/arbitration/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";

const createArbitrationCaseSchema = z.object({
  entityType: z.literal("task"),
  entityId: z.string().min(1),
  reason: z.string().min(10).max(4000),
  evidenceSummary: z.string().max(4000).nullable().optional(),
});

const updateArbitrationCaseStatusSchema = z.object({
  status: z.enum(["under_review", "resolved", "rejected"]),
  resolutionSummary: z.string().max(4000).nullable().optional(),
  taskResolutionAction: z.enum(["none", "accept", "default", "cancel"]).optional(),
});

const createArbitrationEvidenceSchema = z.object({
  kind: z.enum(["text_note", "external_link", "log_excerpt", "screenshot_ref"]),
  title: z.string().min(1).max(160),
  content: z.string().max(8000).nullable().optional(),
  url: z.string().url().max(2000).nullable().optional(),
});

const uploadArbitrationEvidenceAttachmentSchema = z.object({
  fileName: z.string().min(1).max(160),
  contentType: z.string().min(1).max(120),
  base64Content: z.string().min(1),
});

const prepareArbitrationEvidenceAttachmentUploadSchema = z.object({
  fileName: z.string().min(1).max(160),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1),
});

const advanceReviewRoundSchema = z.object({
  summary: z.string().max(4000).optional(),
  assignToOperatorUserId: z.string().trim().min(1).optional(),
});

const assignArbitrationCaseSchema = z.object({
  assigneeUserId: z.string().trim().min(1),
});

const cleanupRemoteAttachmentSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  policyKey: z.string().trim().min(1).optional(),
  bucketKey: z.string().trim().min(1).optional(),
  cleanupState: z.enum(["due_now", "cleanup_requested", "retry_waiting", "exhausted", "failed"]).optional(),
});

const expirePreparedAttachmentSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const rebalanceArbitrationReviewRoundsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const autoAdvanceArbitrationReviewRoundsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const arbitrationRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/arbitrations/cases", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("arbitration");
    const { userId } = assertUserContext(request);
    return {
      cases: await listVisibleArbitrationCases(userId),
    };
  });

  app.get("/v1/arbitrations/cases/summary", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("arbitration");
    const { userId } = assertUserContext(request);
    return {
      summary: await getVisibleArbitrationCaseSummary(userId),
    };
  });

  app.get("/v1/arbitrations/cases/workload", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("arbitration");
    const { userId } = assertUserContext(request);
    return {
      workload: await getArbitrationCaseWorkload(userId),
    };
  });

  app.get<{ Querystring: z.infer<typeof cleanupRemoteAttachmentSchema> }>(
    "/v1/internal/arbitrations/attachments/cleanup-queue",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        queue: await getArbitrationRemoteAttachmentCleanupQueue(
          userId,
          cleanupRemoteAttachmentSchema.parse(request.query ?? {}),
        ),
      };
    },
  );

  app.get("/v1/internal/arbitrations/storage-policies", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("arbitration");
    const { userId } = assertUserContext(request);
    return {
      policies: await listArbitrationEvidenceStoragePolicies(userId),
    };
  });

  app.post<{ Body: z.infer<typeof createArbitrationCaseSchema> }>(
    "/v1/arbitrations/cases",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await createArbitrationCase(userId, createArbitrationCaseSchema.parse(request.body)),
      };
    },
  );

  app.post<{ Params: { caseId: string }; Body: z.infer<typeof updateArbitrationCaseStatusSchema> }>(
    "/v1/arbitrations/cases/:caseId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await updateArbitrationCaseStatus(
          userId,
          request.params.caseId,
          updateArbitrationCaseStatusSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { caseId: string }; Body: z.infer<typeof createArbitrationEvidenceSchema> }>(
    "/v1/arbitrations/cases/:caseId/evidences",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await addArbitrationEvidence(
          userId,
          request.params.caseId,
          createArbitrationEvidenceSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { evidenceId: string }; Body: z.infer<typeof uploadArbitrationEvidenceAttachmentSchema> }>(
    "/v1/arbitrations/evidences/:evidenceId/attachments",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await addArbitrationEvidenceAttachment(
          userId,
          request.params.evidenceId,
          uploadArbitrationEvidenceAttachmentSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { evidenceId: string }; Body: z.infer<typeof prepareArbitrationEvidenceAttachmentUploadSchema> }>(
    "/v1/arbitrations/evidences/:evidenceId/attachments/prepare-upload",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return prepareArbitrationEvidenceAttachmentUpload(
        userId,
        request.params.evidenceId,
        prepareArbitrationEvidenceAttachmentUploadSchema.parse(request.body),
      );
    },
  );

  app.get<{ Params: { attachmentId: string } }>(
    "/v1/arbitrations/attachments/:attachmentId/access",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        access: await getArbitrationEvidenceAttachmentAccess(userId, request.params.attachmentId),
      };
    },
  );

  app.get<{ Params: { attachmentId: string } }>(
    "/v1/arbitrations/attachments/:attachmentId/content",
    { preHandler: withInternalRequest },
    async (request, reply) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      const attachment = await getArbitrationEvidenceAttachmentContent(userId, request.params.attachmentId);
      reply.header("content-type", attachment.contentType);
      reply.header("content-disposition", `inline; filename="${attachment.fileName.replace(/"/g, "")}"`);
      return reply.send(attachment.content);
    },
  );

  app.post<{ Params: { attachmentId: string } }>(
    "/v1/arbitrations/attachments/:attachmentId/request-cleanup",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await requestArbitrationEvidenceAttachmentCleanup(userId, request.params.attachmentId),
      };
    },
  );

  app.post<{ Params: { attachmentId: string } }>(
    "/v1/arbitrations/attachments/:attachmentId/complete-upload",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await completeArbitrationEvidenceAttachmentUpload(userId, request.params.attachmentId),
      };
    },
  );

  app.post<{ Params: { attachmentId: string } }>(
    "/v1/arbitrations/attachments/:attachmentId/cleanup",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await archiveArbitrationEvidenceAttachment(userId, request.params.attachmentId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof cleanupRemoteAttachmentSchema> }>(
    "/v1/internal/arbitrations/attachments/cleanup-remote",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        const { userId } = assertUserContext(request);
        assertPlatformOperator(userId);
      }
      return {
        result: await cleanupResolvedRemoteArbitrationAttachments(cleanupRemoteAttachmentSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof rebalanceArbitrationReviewRoundsSchema> }>(
    "/v1/internal/arbitrations/cases/rebalance-rounds",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await rebalanceArbitrationReviewRounds(rebalanceArbitrationReviewRoundsSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof autoAdvanceArbitrationReviewRoundsSchema> }>(
    "/v1/internal/arbitrations/cases/advance-stale-rounds",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await autoAdvanceStaleArbitrationReviewRounds(
          autoAdvanceArbitrationReviewRoundsSchema.parse(request.body ?? {}),
        ),
      };
    },
  );

  app.post<{ Body: z.infer<typeof autoAdvanceArbitrationReviewRoundsSchema> }>(
    "/v1/internal/arbitrations/cases/escalate-final-rounds",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await escalateTerminalArbitrationReviewRounds(
          autoAdvanceArbitrationReviewRoundsSchema.parse(request.body ?? {}),
        ),
      };
    },
  );

  app.post<{ Body: z.infer<typeof expirePreparedAttachmentSchema> }>(
    "/v1/internal/arbitrations/attachments/expire-prepared",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        const { userId } = assertUserContext(request);
        assertPlatformOperator(userId);
      }
      return {
        result: await expirePreparedArbitrationEvidenceUploads(
          expirePreparedAttachmentSchema.parse(request.body ?? {}),
        ),
      };
    },
  );

  app.post<{ Params: { caseId: string } }>(
    "/v1/arbitrations/cases/:caseId/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await claimArbitrationCase(userId, request.params.caseId),
      };
    },
  );

  app.post<{ Params: { caseId: string }; Body: z.infer<typeof assignArbitrationCaseSchema> }>(
    "/v1/arbitrations/cases/:caseId/assign",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      const payload = assignArbitrationCaseSchema.parse(request.body ?? {});
      return {
        case: await assignArbitrationCase(userId, request.params.caseId, payload.assigneeUserId),
      };
    },
  );

  app.post(
    "/v1/arbitrations/cases/claim-next",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await claimNextArbitrationCase(userId),
      };
    },
  );

  app.post<{ Params: { caseId: string } }>(
    "/v1/arbitrations/cases/:caseId/release",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await releaseArbitrationCase(userId, request.params.caseId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof cleanupRemoteAttachmentSchema> }>(
    "/v1/internal/arbitrations/cases/release-stale",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        const { userId } = assertUserContext(request);
        assertPlatformOperator(userId);
      }
      return {
        result: await releaseStaleArbitrationClaims(cleanupRemoteAttachmentSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Params: { caseId: string }; Body: z.infer<typeof advanceReviewRoundSchema> }>(
    "/v1/arbitrations/cases/:caseId/review-rounds/advance",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("arbitration");
      const { userId } = assertUserContext(request);
      return {
        case: await advanceArbitrationReviewRound(
          userId,
          request.params.caseId,
          advanceReviewRoundSchema.parse(request.body ?? {}),
        ),
      };
    },
  );
};
