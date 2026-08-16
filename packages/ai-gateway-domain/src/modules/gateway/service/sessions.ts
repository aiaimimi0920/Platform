import type { GatewayProtocolFamily, GatewayRequestAnalysisProfile, GatewayRequestRouteTrace, GatewayRequestStatus } from "@neuro/contracts";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { gatewayRequestAudits, gatewaySessions } from "@/modules/gateway/schema";
import { NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { now } from "./shared";
import { toGatewayRequestAuditView, toGatewaySessionView } from "./views";

export async function resolveGatewaySession(args: {
  projectId: string;
  sessionKey: string | null;
  previousResponseId: string | null;
}) {
  if (args.sessionKey) {
    const [session] = await db
      .select()
      .from(gatewaySessions)
      .where(and(eq(gatewaySessions.projectId, args.projectId), eq(gatewaySessions.sessionKey, args.sessionKey)))
      .limit(1);
    return session ? toGatewaySessionView(session) : null;
  }

  if (!args.previousResponseId) {
    return null;
  }

  const [audit] = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        eq(gatewayRequestAudits.projectId, args.projectId),
        eq(gatewayRequestAudits.responseId, args.previousResponseId),
      ),
    )
    .limit(1);

  if (!audit?.sessionId) {
    return null;
  }

  const [session] = await db.select().from(gatewaySessions).where(eq(gatewaySessions.id, audit.sessionId)).limit(1);
  return session ? toGatewaySessionView(session) : null;
}

export async function upsertGatewaySession(args: {
  projectId: string;
  sessionKey: string;
  protocolFamily: GatewayProtocolFamily;
  providerAccountId: string;
  upstreamSessionId?: string | null;
  runtimeStateObjectKey?: string | null;
  latestResponseId?: string | null;
  activeRequestAuditId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const timestamp = now();
    const [existing] = await tx
      .select()
      .from(gatewaySessions)
      .where(and(eq(gatewaySessions.projectId, args.projectId), eq(gatewaySessions.sessionKey, args.sessionKey)))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(gatewaySessions)
        .set({
          protocolFamily: args.protocolFamily,
          providerAccountId: args.providerAccountId,
          upstreamSessionId: args.upstreamSessionId ?? existing.upstreamSessionId,
          runtimeStateObjectKey: args.runtimeStateObjectKey ?? existing.runtimeStateObjectKey,
          latestResponseId: args.latestResponseId ?? existing.latestResponseId,
          activeRequestAuditId: args.activeRequestAuditId ?? existing.activeRequestAuditId,
          updatedAt: timestamp,
          lastUsedAt: timestamp,
          revokedAt: null,
        })
        .where(eq(gatewaySessions.id, existing.id))
        .returning();
      return toGatewaySessionView(updated ?? existing);
    }

    const [created] = await tx
      .insert(gatewaySessions)
      .values({
        id: randomUUID(),
        projectId: args.projectId,
        sessionKey: args.sessionKey,
        protocolFamily: args.protocolFamily,
        providerAccountId: args.providerAccountId,
        latestResponseId: args.latestResponseId ?? null,
        upstreamSessionId: args.upstreamSessionId ?? null,
        runtimeStateObjectKey: args.runtimeStateObjectKey ?? null,
        activeRequestAuditId: args.activeRequestAuditId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastUsedAt: timestamp,
        revokedAt: null,
      })
      .returning();

    return toGatewaySessionView(created);
  });
}

export async function createGatewayRequestAudit(args: {
  projectId: string;
  apiKeyId: string;
  sessionId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  modelAlias: string | null;
  stream: boolean;
  routeAttemptCount: number;
  responseId: string;
  previousResponseId: string | null;
  clientHasCacheControl?: boolean | null;
  autoCacheApplied?: boolean | null;
  routeTrace?: GatewayRequestRouteTrace | null;
  analysisProfile?: GatewayRequestAnalysisProfile | null;
  requestArtifactObjectKey?: string | null;
}) {
  const timestamp = now();
  const [created] = await db
    .insert(gatewayRequestAudits)
    .values({
      id: randomUUID(),
      projectId: args.projectId,
      apiKeyId: args.apiKeyId,
      sessionId: args.sessionId,
      routePolicyId: args.routePolicyId,
      providerAccountId: args.providerAccountId,
      protocolFamily: args.protocolFamily,
      endpointKind: args.endpointKind,
      requestedModel: args.requestedModel,
      resolvedModel: args.resolvedModel,
      modelAlias: args.modelAlias,
      stream: args.stream,
      routeAttemptCount: Math.max(1, args.routeAttemptCount),
      status: "running",
      upstreamStatus: null,
      durationMs: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      clientHasCacheControl: args.clientHasCacheControl ?? false,
      autoCacheApplied: args.autoCacheApplied ?? false,
      errorSummary: null,
      routeTrace: args.routeTrace ?? null,
      analysisProfile: args.analysisProfile ?? null,
      requestArtifactObjectKey: args.requestArtifactObjectKey ?? null,
      responseArtifactObjectKey: null,
      responseId: args.responseId,
      previousResponseId: args.previousResponseId,
      clientDisconnectedAt: null,
      createdAt: timestamp,
      completedAt: null,
      updatedAt: timestamp,
    })
    .returning();
  return toGatewayRequestAuditView(created);
}

export async function finalizeGatewayRequestAudit(
  requestAuditId: string,
  args: {
    status: GatewayRequestStatus;
    upstreamStatus: number | null;
    durationMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    cacheCreationInputTokens?: number | null;
    cacheReadInputTokens?: number | null;
    clientHasCacheControl?: boolean | null;
    autoCacheApplied?: boolean | null;
    errorSummary: string | null;
    sessionId?: string | null;
    providerAccountId?: string | null;
    resolvedModel?: string | null;
    routeTrace?: GatewayRequestRouteTrace | null;
    analysisProfile?: GatewayRequestAnalysisProfile | null;
    requestArtifactObjectKey?: string | null;
    responseArtifactObjectKey?: string | null;
  },
) {
  const timestamp = now();
  const [updated] = await db
    .update(gatewayRequestAudits)
    .set({
      status: args.status,
      upstreamStatus: args.upstreamStatus,
      durationMs: args.durationMs,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      cacheCreationInputTokens: args.cacheCreationInputTokens ?? undefined,
      cacheReadInputTokens: args.cacheReadInputTokens ?? undefined,
      clientHasCacheControl: args.clientHasCacheControl ?? undefined,
      autoCacheApplied: args.autoCacheApplied ?? undefined,
      errorSummary: args.errorSummary,
      routeTrace: args.routeTrace ?? undefined,
      analysisProfile: args.analysisProfile ?? undefined,
      requestArtifactObjectKey: args.requestArtifactObjectKey ?? undefined,
      responseArtifactObjectKey: args.responseArtifactObjectKey ?? undefined,
      sessionId: args.sessionId ?? undefined,
      providerAccountId: args.providerAccountId ?? undefined,
      resolvedModel: args.resolvedModel ?? undefined,
      completedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayRequestAudits.id, requestAuditId))
    .returning();
  if (!updated) {
    throw new NotFoundError("AI gateway request audit 不存在。");
  }
  return toGatewayRequestAuditView(updated);
}

export async function markGatewayRequestAuditDisconnected(requestAuditId: string) {
  await db
    .update(gatewayRequestAudits)
    .set({
      clientDisconnectedAt: now(),
      updatedAt: now(),
    })
    .where(eq(gatewayRequestAudits.id, requestAuditId));
}

export async function recordGatewaySessionOutcome(args: {
  sessionId: string;
  latestResponseId: string | null;
  upstreamSessionId?: string | null;
  runtimeStateObjectKey?: string | null;
  activeRequestAuditId?: string | null;
}) {
  const [updated] = await db
    .update(gatewaySessions)
    .set({
      latestResponseId: args.latestResponseId,
      upstreamSessionId: args.upstreamSessionId ?? undefined,
      runtimeStateObjectKey: args.runtimeStateObjectKey ?? undefined,
      activeRequestAuditId: args.activeRequestAuditId ?? undefined,
      updatedAt: now(),
      lastUsedAt: now(),
    })
    .where(eq(gatewaySessions.id, args.sessionId))
    .returning();
  return updated ? toGatewaySessionView(updated) : null;
}
