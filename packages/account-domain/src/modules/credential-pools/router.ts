import {
  credentialAssignmentModes,
  credentialProviderKeys,
  credentialScopes,
  credentialStorageModes,
} from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  claimCredentialRepairForOperator,
  createCredentialTerminalForOperator,
  importCredentialPoolForOperator,
  ingestCredentialPoolUpload,
  listOperatorCredentialPoolCatalog,
  markCredentialEntryCoolingForOperator,
  markCredentialEntryDeathForOperator,
  markCredentialEntryInvalidForOperator,
  releaseCredentialRepairClaimForOperator,
  resolveCredentialForUser,
  rotateCredentialForUser,
  revokeCredentialTerminalForOperator,
  rotateCredentialAssignmentForOperator,
} from "@/modules/credential-pools/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const terminalCreateSchema = z.object({
  providerKey: z.enum(credentialProviderKeys),
  label: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).nullable().optional(),
});

const operatorImportSchema = z.object({
  providerKey: z.enum(credentialProviderKeys),
  label: z.string().trim().min(1).max(120),
  importNote: z.string().trim().max(2000).nullable().optional(),
  entries: z
    .array(
      z.object({
        benefitServiceId: z.string().trim().min(1),
        entryLabel: z.string().trim().max(120).nullable().optional(),
        scope: z.enum(credentialScopes).optional(),
        privateUserId: z.string().trim().max(120).nullable().optional(),
        storageMode: z.enum(credentialStorageModes).nullable().optional(),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(1000),
});

const uploadSchema = operatorImportSchema;

const entryParamsSchema = z.object({
  entryId: z.string().trim().min(1),
});

const claimParamsSchema = z.object({
  claimId: z.string().trim().min(1),
});

const serviceCredentialParamsSchema = z.object({
  serviceId: z.string().trim().min(1),
});

const assignmentParamsSchema = z.object({
  serviceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

const coolingSchema = z.object({
  cooldownMinutes: z.number().int().min(1).max(60 * 24 * 30),
  reason: z.string().trim().max(2000).nullable().optional(),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

const terminalParamsSchema = z.object({
  terminalId: z.string().trim().min(1),
});

export const credentialPoolsRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/internal/credential-pools/catalog", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      catalog: await listOperatorCredentialPoolCatalog(userId, providerUserId),
    };
  });

  app.post<{ Body: z.infer<typeof terminalCreateSchema> }>(
    "/v1/internal/credential-pools/terminals",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = terminalCreateSchema.parse(request.body ?? {});
      return {
        issued: await createCredentialTerminalForOperator(userId, providerUserId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof terminalParamsSchema> }>(
    "/v1/internal/credential-pools/terminals/:terminalId/revoke",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { terminalId } = terminalParamsSchema.parse(request.params);
      return {
        terminal: await revokeCredentialTerminalForOperator(userId, providerUserId, terminalId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof operatorImportSchema> }>(
    "/v1/internal/credential-pools/import",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = operatorImportSchema.parse(request.body ?? {});
      return {
        batch: await importCredentialPoolForOperator(userId, providerUserId, payload),
      };
    },
  );

  app.post<{ Body: z.infer<typeof uploadSchema> }>("/v1/internal/credential-pools/upload", async (request) => {
    await requireModuleEnabled("benefits");
    const payload = uploadSchema.parse(request.body ?? {});
    return {
      batch: await ingestCredentialPoolUpload({
        terminalToken: request.headers["x-credential-terminal-token"] as string | undefined,
        sharedToken: request.headers["x-credential-super-token"] as string | undefined,
        payload,
      }),
    };
  });

  app.post<{ Params: z.infer<typeof entryParamsSchema> }>(
    "/v1/internal/credential-pools/repair/:entryId/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { entryId } = entryParamsSchema.parse(request.params);
      return {
        claim: await claimCredentialRepairForOperator(userId, providerUserId, entryId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof claimParamsSchema> }>(
    "/v1/internal/credential-pools/repair/claims/:claimId/release",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { claimId } = claimParamsSchema.parse(request.params);
      return {
        claim: await releaseCredentialRepairClaimForOperator(userId, providerUserId, claimId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof entryParamsSchema>; Body: z.infer<typeof coolingSchema> }>(
    "/v1/internal/credential-pools/entries/:entryId/cooling",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { entryId } = entryParamsSchema.parse(request.params);
      const payload = coolingSchema.parse(request.body ?? {});
      return {
        entry: await markCredentialEntryCoolingForOperator(userId, providerUserId, entryId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof entryParamsSchema>; Body: z.infer<typeof reasonSchema> }>(
    "/v1/internal/credential-pools/entries/:entryId/invalid",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { entryId } = entryParamsSchema.parse(request.params);
      const payload = reasonSchema.parse(request.body ?? {});
      return {
        entry: await markCredentialEntryInvalidForOperator(userId, providerUserId, entryId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof entryParamsSchema>; Body: z.infer<typeof reasonSchema> }>(
    "/v1/internal/credential-pools/entries/:entryId/death",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { entryId } = entryParamsSchema.parse(request.params);
      const payload = reasonSchema.parse(request.body ?? {});
      return {
        entry: await markCredentialEntryDeathForOperator(userId, providerUserId, entryId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof assignmentParamsSchema> }>(
    "/v1/internal/credential-pools/assignments/:serviceId/:userId/rotate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId: operatorUserId, providerUserId } = assertUserContext(request);
      const { serviceId, userId } = assignmentParamsSchema.parse(request.params);
      return {
        assignment: await rotateCredentialAssignmentForOperator(operatorUserId, providerUserId, serviceId, userId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof serviceCredentialParamsSchema> }>(
    "/v1/me/credential-pools/services/:serviceId/credential",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId } = assertUserContext(request);
      const { serviceId } = serviceCredentialParamsSchema.parse(request.params);
      return {
        credential: await resolveCredentialForUser(serviceId, userId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof serviceCredentialParamsSchema> }>(
    "/v1/me/credential-pools/services/:serviceId/credential/rotate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId } = assertUserContext(request);
      const { serviceId } = serviceCredentialParamsSchema.parse(request.params);
      return {
        credential: await rotateCredentialForUser(serviceId, userId),
      };
    },
  );
};
