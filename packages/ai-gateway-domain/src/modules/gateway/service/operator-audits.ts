import type { GatewayRequestArtifactsView, GatewayRequestAuditSummaryView, GatewaySessionDetailView, GatewayStoredRequestArtifact, GatewayStoredResponseArtifact } from "@neuro/contracts";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { readGatewayObject } from "@/modules/gateway/object-storage";
import { gatewayRequestAudits, gatewaySessions } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { accumulateSummaryBucket, assertPlatformOperator, parseFilterTimestamp, toSummaryBuckets } from "./shared";
import type { GatewayRequestAuditOperatorFilters, GatewaySessionOperatorFilters } from "./shared";
import { toGatewayRequestAuditView, toGatewaySessionView } from "./views";

export async function listGatewayRequestAuditsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 1000));
  const rows = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        filters.projectId ? eq(gatewayRequestAudits.projectId, filters.projectId) : undefined,
        filters.routePolicyId ? eq(gatewayRequestAudits.routePolicyId, filters.routePolicyId) : undefined,
        filters.providerAccountId ? eq(gatewayRequestAudits.providerAccountId, filters.providerAccountId) : undefined,
        filters.sessionId ? eq(gatewayRequestAudits.sessionId, filters.sessionId) : undefined,
        filters.apiKeyId ? eq(gatewayRequestAudits.apiKeyId, filters.apiKeyId) : undefined,
        filters.userCredentialId ? eq(gatewayRequestAudits.userCredentialId, filters.userCredentialId) : undefined,
        filters.responseId ? eq(gatewayRequestAudits.responseId, filters.responseId) : undefined,
        filters.protocolFamily ? eq(gatewayRequestAudits.protocolFamily, filters.protocolFamily) : undefined,
        filters.status ? eq(gatewayRequestAudits.status, filters.status) : undefined,
        filters.endpointKind ? eq(gatewayRequestAudits.endpointKind, filters.endpointKind) : undefined,
        typeof filters.stream === "boolean" ? eq(gatewayRequestAudits.stream, filters.stream) : undefined,
        createdFrom ? gte(gatewayRequestAudits.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayRequestAudits.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(limit);

  return rows
    .filter((row) => {
      if (filters.errorCode && row.routeTrace?.errorCode !== filters.errorCode) {
        return false;
      }
      if (
        typeof filters.fallbackEligible === "boolean" &&
        (row.routeTrace?.fallbackEligible ?? false) !== filters.fallbackEligible
      ) {
        return false;
      }
      return true;
    })
    .map(toGatewayRequestAuditView);
}

export async function listGatewaySessionsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewaySessionOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  const rows = await db
    .select()
    .from(gatewaySessions)
    .where(
      and(
        filters.projectId ? eq(gatewaySessions.projectId, filters.projectId) : undefined,
        filters.providerAccountId ? eq(gatewaySessions.providerAccountId, filters.providerAccountId) : undefined,
        filters.protocolFamily ? eq(gatewaySessions.protocolFamily, filters.protocolFamily) : undefined,
        filters.activeOnly ? isNull(gatewaySessions.revokedAt) : undefined,
      ),
    )
    .orderBy(desc(gatewaySessions.lastUsedAt))
    .limit(limit);
  return rows.map(toGatewaySessionView);
}

export async function getGatewayRequestAuditForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args?: { requestAuditId?: string | null; responseId?: string | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const requestAuditId = args?.requestAuditId?.trim() ?? "";
  const responseId = args?.responseId?.trim() ?? "";
  if (!requestAuditId && !responseId) {
    throw new ConflictError("必须提供 requestAuditId 或 responseId。");
  }

  const [row] = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      requestAuditId
        ? eq(gatewayRequestAudits.id, requestAuditId)
        : eq(gatewayRequestAudits.responseId, responseId),
    )
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway request audit 不存在。");
  }
  return toGatewayRequestAuditView(row);
}

export async function getGatewayRequestArtifactsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args?: { requestAuditId?: string | null; responseId?: string | null },
) {
  const requestAudit = await getGatewayRequestAuditForOperator(operatorUserId, providerUserId, args);

  const [requestArtifact, responseArtifact] = await Promise.all([
    requestAudit.requestArtifactObjectKey
      ? readGatewayObject(requestAudit.requestArtifactObjectKey)
          .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredRequestArtifact)
          .catch(() => null)
      : Promise.resolve(null),
    requestAudit.responseArtifactObjectKey
      ? readGatewayObject(requestAudit.responseArtifactObjectKey)
          .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredResponseArtifact)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    requestAudit,
    requestArtifact,
    responseArtifact,
  } satisfies GatewayRequestArtifactsView;
}

export async function getGatewaySessionDetailForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  sessionId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSessionId = sessionId?.trim() ?? "";
  if (!normalizedSessionId) {
    throw new ConflictError("sessionId 不能为空。");
  }

  const [session] = await db.select().from(gatewaySessions).where(eq(gatewaySessions.id, normalizedSessionId)).limit(1);
  if (!session) {
    throw new NotFoundError("Gateway session 不存在。");
  }

  const recentAudits = await db
    .select()
    .from(gatewayRequestAudits)
    .where(eq(gatewayRequestAudits.sessionId, session.id))
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(10);

  const activeRequestAudit =
    session.activeRequestAuditId?.trim()
      ? recentAudits.find((row) => row.id === session.activeRequestAuditId) ??
        (
          await db
            .select()
            .from(gatewayRequestAudits)
            .where(eq(gatewayRequestAudits.id, session.activeRequestAuditId))
            .limit(1)
        )[0] ??
        null
      : null;

  return {
    session: toGatewaySessionView(session),
    activeRequestAudit: activeRequestAudit ? toGatewayRequestAuditView(activeRequestAudit) : null,
    latestRequestAudit: recentAudits[0] ? toGatewayRequestAuditView(recentAudits[0]) : null,
    recentRequestAudits: recentAudits.map(toGatewayRequestAuditView),
  } satisfies GatewaySessionDetailView;
}

export async function listGatewayRequestAuditSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 1000, 1000)),
  });

  const byStatus = new Map<string, number>();
  const byProviderAccount = new Map<string, number>();
  const byEndpointKind = new Map<string, number>();
  const byErrorCode = new Map<string, number>();

  let completedCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let runningCount = 0;
  let fallbackEligibleFailures = 0;
  let fallbackExhaustedFailures = 0;

  for (const row of rows) {
    accumulateSummaryBucket(byStatus, row.status);
    accumulateSummaryBucket(byProviderAccount, row.providerAccountId);
    accumulateSummaryBucket(byEndpointKind, row.endpointKind);
    accumulateSummaryBucket(byErrorCode, row.routeTrace?.errorCode ?? null);

    if (row.status === "completed") {
      completedCount += 1;
    } else if (row.status === "failed") {
      failedCount += 1;
      if (row.routeTrace?.fallbackEligible) {
        fallbackEligibleFailures += 1;
      } else {
        fallbackExhaustedFailures += 1;
      }
    } else if (row.status === "cancelled") {
      cancelledCount += 1;
    } else if (row.status === "running") {
      runningCount += 1;
    }
  }

  return {
    totalRequests: rows.length,
    completedCount,
    failedCount,
    cancelledCount,
    runningCount,
    fallbackEligibleFailures,
    fallbackExhaustedFailures,
    byStatus: toSummaryBuckets(byStatus),
    byProviderAccount: toSummaryBuckets(byProviderAccount),
    byEndpointKind: toSummaryBuckets(byEndpointKind),
    byErrorCode: toSummaryBuckets(byErrorCode),
  } satisfies GatewayRequestAuditSummaryView;
}
