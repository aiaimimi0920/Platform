import type { GatewayAnalysisExportAnomalyReportView, GatewayAnalysisExportBaselineReportView, GatewayAnalysisExportCleanupResult, GatewayAnalysisExportDiffView, GatewayAnalysisExportTextMode, GatewayAnalysisExportFilterView, GatewayAnalysisExportInventorySummaryView, GatewayAnalysisExportMetadataUpdateInput, GatewayAnalysisExportRowView, GatewayAnalysisExportTrendPointView, GatewayAnalysisExportTrendReportView, GatewayAnalysisExportView, GatewayAnalysisExportTimelinePairView, GatewayAnalysisExportTimelineReportView, GatewayAnalysisExportManifest, GatewayPersistedAnalysisExportView, GatewayStoredRequestArtifact, GatewayStoredResponseArtifact } from "@neuro/contracts";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { buildGatewayAnalysisExportAnomalyReport } from "@/modules/gateway/analysis-anomaly";
import { buildGatewayAnalysisExportBaselineReport } from "@/modules/gateway/analysis-baseline";
import { buildGatewayAnalysisExportDiff } from "@/modules/gateway/analysis-diff";
import { buildGatewayAnalysisExportInventorySummary } from "@/modules/gateway/analysis-inventory";
import { buildGatewayAnalysisExportTimelineReport } from "@/modules/gateway/analysis-timeline";
import { buildGatewayAnalysisExportTrendReport } from "@/modules/gateway/analysis-trend";
import { buildGatewayAnalysisDatasetJsonl, buildGatewayAnalysisExportFileView, buildGatewayAnalysisExportManifest, buildGatewayAnalysisExportRow } from "@/modules/gateway/analysis-export";
import { buildGatewayAnalysisExportDatasetObjectKey, buildGatewayAnalysisExportManifestObjectKey, buildGatewayAnalysisExportPrefix } from "@/modules/gateway/object-keys";
import { deleteGatewayObject, listGatewayObjects, putGatewayObject, readGatewayObject } from "@/modules/gateway/object-storage";
import { gatewayAnalysisExports } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";
import { mapWithConcurrency } from "@neuro/backend-foundation/async/map-with-concurrency";

import { ANALYSIS_EXPORT_READ_CONCURRENCY, assertPlatformOperator, normalizeStringList, now, parseFilterTimestamp, truncateErrorSummary } from "./shared";
import type { GatewayAnalysisExportAnomalyReportFilters, GatewayAnalysisExportBaselineReportFilters, GatewayAnalysisExportRow, GatewayAnalysisOperatorFilters, GatewayPersistedAnalysisExportFilters } from "./shared";
import { listGatewayAnalysisSamplesForOperator } from "./analysis-summary";
import { resolveGatewayAnalysisAnomalyEvaluationContextForOperator } from "./anomaly-policies";

export function normalizeAnalysisTextMode(value: string | null | undefined): GatewayAnalysisExportTextMode {
  const normalized = value?.trim() ?? "";
  if (normalized === "none" || normalized === "full" || normalized === "preview_redacted") {
    return normalized;
  }
  return "preview_redacted";
}

export function normalizeAnalysisExportLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 120);
}

export function normalizeAnalysisExportTags(values: string[] | null | undefined) {
  const normalized = normalizeStringList(values, { lowerCase: true }) ?? [];
  if (normalized.length > 32) {
    throw new ConflictError("tags 数量不能超过 32 个。");
  }
  for (const tag of normalized) {
    if (tag.length > 40) {
      throw new ConflictError("单个 tag 长度不能超过 40 个字符。");
    }
  }
  return normalized;
}

export function hasPinnedAnalysisExportTag(values: string[] | null | undefined) {
  return normalizeAnalysisExportTags(values).includes("pinned");
}

export function buildGatewayAnalysisExportFilterView(
  filters: GatewayAnalysisOperatorFilters,
  textMode: GatewayAnalysisExportTextMode,
  maxTextChars: number,
): GatewayAnalysisExportFilterView {
  return {
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    providerAccountId: filters.providerAccountId ?? null,
    sessionId: filters.sessionId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    responseId: filters.responseId ?? null,
    protocolFamily: filters.protocolFamily ?? null,
    status: filters.status ?? null,
    endpointKind: filters.endpointKind ?? null,
    stream: typeof filters.stream === "boolean" ? filters.stream : null,
    errorCode: filters.errorCode ?? null,
    fallbackEligible: typeof filters.fallbackEligible === "boolean" ? filters.fallbackEligible : null,
    createdFrom: filters.createdFrom?.trim() || null,
    createdTo: filters.createdTo?.trim() || null,
    artifactAvailable: typeof filters.artifactAvailable === "boolean" ? filters.artifactAvailable : null,
    limit: Math.max(1, Math.min(filters.limit ?? 200, 1000)),
    textMode,
    maxTextChars,
  };
}

export async function readGatewayAnalysisExportManifest(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayAnalysisExportManifest;
}

export async function readGatewayAnalysisExportDataset(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  const lines = buffer
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line) => JSON.parse(line) as GatewayAnalysisExportRowView);
}

export function buildSyntheticGatewayAnalysisExportManifest(
  row: Pick<
    GatewayAnalysisExportRow,
    | "id"
    | "label"
    | "tags"
    | "filters"
    | "sampleCount"
    | "requestArtifactCount"
    | "responseArtifactCount"
    | "retentionExpiresAt"
    | "createdAt"
  >,
): GatewayAnalysisExportManifest {
  return {
    schemaVersion: 1,
    exportId: row.id,
    label: row.label,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    retentionExpiresAt: row.retentionExpiresAt?.toISOString() ?? null,
    filters: row.filters,
    sampleCount: row.sampleCount,
    requestArtifactCount: row.requestArtifactCount,
    responseArtifactCount: row.responseArtifactCount,
    files: [],
  };
}

export function toGatewayPersistedAnalysisExportView(manifest: GatewayAnalysisExportManifest): GatewayPersistedAnalysisExportView {
  return {
    exportId: manifest.exportId,
    label: manifest.label,
    tags: [],
    status: "active",
    createdAt: manifest.createdAt,
    updatedAt: manifest.createdAt,
    objectPrefix: buildGatewayAnalysisExportPrefix(manifest.exportId),
    filters: manifest.filters,
    sampleCount: manifest.sampleCount,
    requestArtifactCount: manifest.requestArtifactCount,
    responseArtifactCount: manifest.responseArtifactCount,
    retentionExpiresAt: null,
    cleanedUpAt: null,
    lastCleanupError: null,
    files: manifest.files,
    manifest,
  };
}

export function toGatewayPersistedAnalysisExportViewFromRow(
  row: GatewayAnalysisExportRow,
  manifest: GatewayAnalysisExportManifest | null,
): GatewayPersistedAnalysisExportView {
  const resolvedManifest = manifest
    ? {
        ...manifest,
        label: row.label,
        tags: row.tags,
        filters: row.filters,
        sampleCount: row.sampleCount,
        requestArtifactCount: row.requestArtifactCount,
        responseArtifactCount: row.responseArtifactCount,
        retentionExpiresAt: row.retentionExpiresAt?.toISOString() ?? null,
      }
    : buildSyntheticGatewayAnalysisExportManifest(row);
  return {
    exportId: row.id,
    label: row.label,
    tags: row.tags,
    status: row.status as GatewayPersistedAnalysisExportView["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    objectPrefix: row.objectPrefix,
    filters: row.filters,
    sampleCount: row.sampleCount,
    requestArtifactCount: row.requestArtifactCount,
    responseArtifactCount: row.responseArtifactCount,
    retentionExpiresAt: row.retentionExpiresAt?.toISOString() ?? null,
    cleanedUpAt: row.cleanedUpAt?.toISOString() ?? null,
    lastCleanupError: row.lastCleanupError ?? null,
    files: resolvedManifest.files,
    manifest: resolvedManifest,
  };
}

export function matchesGatewayPersistedAnalysisExportFilters(
  item: Pick<GatewayPersistedAnalysisExportView, "label" | "tags" | "filters" | "createdAt" | "status">,
  filters: GatewayPersistedAnalysisExportFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = item.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.tag?.trim()) {
    const needle = filters.tag.trim().toLowerCase();
    if (!normalizeAnalysisExportTags(item.tags).includes(needle)) {
      return false;
    }
  }
  if (filters.projectId?.trim() && item.filters.projectId !== filters.projectId.trim()) {
    return false;
  }
  if (filters.status?.trim() && item.status !== filters.status.trim()) {
    return false;
  }
  if (filters.textMode && item.filters.textMode !== filters.textMode) {
    return false;
  }
  const createdAt = new Date(item.createdAt);
  if (createdFrom && createdAt < createdFrom) {
    return false;
  }
  if (createdTo && createdAt > createdTo) {
    return false;
  }
  return true;
}

export function buildGatewayPersistedAnalysisExportManifestArtifacts(args: {
  exportId: string;
  label: string | null;
  tags: string[];
  createdAt: string;
  retentionExpiresAt: string | null;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  datasetFile: GatewayPersistedAnalysisExportView["files"][number];
  manifestObjectKey: string;
}) {
  const manifest = buildGatewayAnalysisExportManifest({
    exportId: args.exportId,
    label: args.label,
    tags: args.tags,
    createdAt: args.createdAt,
    retentionExpiresAt: args.retentionExpiresAt,
    filters: args.filters,
    sampleCount: args.sampleCount,
    requestArtifactCount: args.requestArtifactCount,
    responseArtifactCount: args.responseArtifactCount,
    files: [
      args.datasetFile,
      {
        kind: "manifest",
        objectKey: args.manifestObjectKey,
        contentType: "application/json",
        sizeBytes: 0,
        sha256: "",
        lineCount: null,
      },
    ],
  });
  const manifestBody = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const manifestFile = buildGatewayAnalysisExportFileView({
    kind: "manifest",
    objectKey: args.manifestObjectKey,
    contentType: "application/json",
    body: manifestBody,
    lineCount: null,
  });
  const finalizedManifest = buildGatewayAnalysisExportManifest({
    ...manifest,
    files: [manifestFile, args.datasetFile],
  });
  const finalizedManifestBody = Buffer.from(JSON.stringify(finalizedManifest, null, 2), "utf8");
  const finalizedManifestFile = buildGatewayAnalysisExportFileView({
    kind: "manifest",
    objectKey: args.manifestObjectKey,
    contentType: "application/json",
    body: finalizedManifestBody,
    lineCount: null,
  });
  return {
    manifest: {
      ...finalizedManifest,
      files: [finalizedManifestFile, args.datasetFile],
    } satisfies GatewayAnalysisExportManifest,
    manifestBody: finalizedManifestBody,
    manifestFile: finalizedManifestFile,
  };
}

export async function exportGatewayAnalysisRowsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisOperatorFilters = {},
) {
  const rows = await listGatewayAnalysisSamplesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 200, 500)),
  });
  const textMode = normalizeAnalysisTextMode(filters.textMode);
  const maxTextChars = Math.max(0, Math.min(filters.maxTextChars ?? 4_000, 32_000));

  const exportedRows = await mapWithConcurrency(
    rows,
    ANALYSIS_EXPORT_READ_CONCURRENCY,
    async (row) => {
      const [requestArtifact, responseArtifact] = await Promise.all([
        row.requestArtifactObjectKey
          ? readGatewayObject(row.requestArtifactObjectKey)
              .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredRequestArtifact)
              .catch(() => null)
          : Promise.resolve(null),
        row.responseArtifactObjectKey
          ? readGatewayObject(row.responseArtifactObjectKey)
              .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredResponseArtifact)
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      return buildGatewayAnalysisExportRow({
        sample: row,
        requestArtifact,
        responseArtifact,
        textMode,
        maxTextChars,
      });
    },
  );

  return {
    textMode,
    maxTextChars,
    sampleCount: exportedRows.length,
    requestArtifactCount: exportedRows.filter((row) => row.requestArtifactAvailable).length,
    responseArtifactCount: exportedRows.filter((row) => row.responseArtifactAvailable).length,
    rows: exportedRows,
  } satisfies GatewayAnalysisExportView;
}

export async function persistGatewayAnalysisExportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayAnalysisOperatorFilters & {
    label?: string | null;
    tags?: string[] | null;
    retentionExpiresAt?: string | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const textMode = normalizeAnalysisTextMode(args.textMode);
  const maxTextChars = Math.max(0, Math.min(args.maxTextChars ?? 4_000, 32_000));
  const exportView = await exportGatewayAnalysisRowsForOperator(operatorUserId, providerUserId, {
    ...args,
    textMode,
    maxTextChars,
  });
  const exportId = randomUUID();
  const createdAt = now().toISOString();
  const label = normalizeAnalysisExportLabel(args.label);
  const tags = normalizeAnalysisExportTags(args.tags);
  const retentionExpiresAt = parseFilterTimestamp(args.retentionExpiresAt, "retentionExpiresAt");
  const filters = buildGatewayAnalysisExportFilterView(args, textMode, maxTextChars);
  const objectPrefix = buildGatewayAnalysisExportPrefix(exportId);

  const datasetBody = buildGatewayAnalysisDatasetJsonl(exportView.rows);
  const datasetObjectKey = buildGatewayAnalysisExportDatasetObjectKey(exportId);
  const datasetFile = buildGatewayAnalysisExportFileView({
    kind: "dataset_jsonl",
    objectKey: datasetObjectKey,
    contentType: "application/x-ndjson",
    body: datasetBody,
    lineCount: exportView.rows.length,
  });

  const manifestObjectKey = buildGatewayAnalysisExportManifestObjectKey(exportId);
  const { manifest: finalizedManifest, manifestBody: finalizedManifestBody, manifestFile: finalizedManifestFile } =
    buildGatewayPersistedAnalysisExportManifestArtifacts({
      exportId,
      label,
      tags,
      createdAt,
      retentionExpiresAt: retentionExpiresAt?.toISOString() ?? null,
      filters,
      sampleCount: exportView.sampleCount,
      requestArtifactCount: exportView.requestArtifactCount,
      responseArtifactCount: exportView.responseArtifactCount,
      datasetFile,
      manifestObjectKey,
    });

  await putGatewayObject(datasetObjectKey, datasetBody, datasetFile.contentType);
  await putGatewayObject(manifestObjectKey, finalizedManifestBody, finalizedManifestFile.contentType);

  const timestamp = new Date(createdAt);
  await db
    .insert(gatewayAnalysisExports)
    .values({
      id: exportId,
      projectId: filters.projectId,
      label,
      tags,
      status: "active",
      textMode,
      maxTextChars,
      filters,
      objectPrefix,
      manifestObjectKey,
      datasetObjectKey,
      sampleCount: exportView.sampleCount,
      requestArtifactCount: exportView.requestArtifactCount,
      responseArtifactCount: exportView.responseArtifactCount,
      retentionExpiresAt,
      cleanedUpAt: null,
      lastCleanupError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: gatewayAnalysisExports.id,
      set: {
        projectId: filters.projectId,
        label,
        tags,
        status: "active",
        textMode,
        maxTextChars,
        filters,
        objectPrefix,
        manifestObjectKey,
        datasetObjectKey,
        sampleCount: exportView.sampleCount,
        requestArtifactCount: exportView.requestArtifactCount,
        responseArtifactCount: exportView.responseArtifactCount,
        retentionExpiresAt,
        cleanedUpAt: null,
        lastCleanupError: null,
        updatedAt: timestamp,
      },
    });

  return {
    exportId,
    label,
    tags,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    objectPrefix,
    filters,
    sampleCount: exportView.sampleCount,
    requestArtifactCount: exportView.requestArtifactCount,
    responseArtifactCount: exportView.responseArtifactCount,
    retentionExpiresAt: retentionExpiresAt?.toISOString() ?? null,
    cleanedUpAt: null,
    lastCleanupError: null,
    files: [finalizedManifestFile, datasetFile],
    manifest: finalizedManifest,
  } satisfies GatewayPersistedAnalysisExportView;
}

export async function listGatewayPersistedAnalysisExportsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayPersistedAnalysisExportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }

  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const rows = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(
      and(
        filters.exportId?.trim() ? eq(gatewayAnalysisExports.id, filters.exportId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisExports.projectId, filters.projectId.trim()) : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisExports.status, filters.status.trim()) : undefined,
        filters.textMode ? eq(gatewayAnalysisExports.textMode, filters.textMode) : undefined,
        createdFrom ? gte(gatewayAnalysisExports.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayAnalysisExports.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisExports.createdAt))
    .limit(limit * 2);

  const matchedRows = rows.filter((row) => {
    return matchesGatewayPersistedAnalysisExportFilters(
      {
        label: row.label,
        tags: row.tags,
        filters: row.filters,
        createdAt: row.createdAt.toISOString(),
        status: row.status as GatewayPersistedAnalysisExportView["status"],
      },
      filters,
      createdFrom,
      createdTo,
    );
  });

  const persisted = await Promise.all(
    matchedRows.slice(0, limit).map(async (row) => {
      const manifest = await readGatewayAnalysisExportManifest(row.manifestObjectKey).catch(() => null);
      return toGatewayPersistedAnalysisExportViewFromRow(row, manifest);
    }),
  );
  const resolved = persisted.filter((item): item is GatewayPersistedAnalysisExportView => Boolean(item));
  if (resolved.length > 0 || matchedRows.length > 0) {
    return resolved;
  }

  if ((filters.status?.trim() && filters.status.trim() !== "active") || filters.tag?.trim()) {
    return [];
  }
  const manifestKeys = (await listGatewayObjects("ai-gateway/analysis-exports"))
    .filter((key) => key.endsWith("/manifest.json"));
  const fallbackManifests: GatewayPersistedAnalysisExportView[] = [];
  for (const manifestKey of manifestKeys) {
    const manifest = await readGatewayAnalysisExportManifest(manifestKey).catch(() => null);
    if (!manifest) {
      continue;
    }
    const fallbackItem = toGatewayPersistedAnalysisExportView(manifest);
    if (filters.exportId?.trim() && fallbackItem.exportId !== filters.exportId.trim()) {
      continue;
    }
    if (!matchesGatewayPersistedAnalysisExportFilters(fallbackItem, filters, createdFrom, createdTo)) {
      continue;
    }
    fallbackManifests.push(fallbackItem);
  }
  return fallbackManifests
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayPersistedAnalysisExportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  exportId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedExportId = exportId?.trim() ?? "";
  if (!normalizedExportId) {
    throw new ConflictError("exportId 不能为空。");
  }
  const [row] = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(eq(gatewayAnalysisExports.id, normalizedExportId))
    .limit(1);
  if (row) {
    const manifest = await readGatewayAnalysisExportManifest(row.manifestObjectKey).catch(() => null);
    return toGatewayPersistedAnalysisExportViewFromRow(row, manifest);
  }
  const manifest = await readGatewayAnalysisExportManifest(
    buildGatewayAnalysisExportManifestObjectKey(normalizedExportId),
  ).catch(() => null);
  if (!manifest) {
    throw new NotFoundError("Gateway analysis export 不存在。");
  }
  return toGatewayPersistedAnalysisExportView(manifest);
}

export async function getGatewayPersistedAnalysisExportInventorySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayPersistedAnalysisExportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }

  const rows = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(
      and(
        filters.exportId?.trim() ? eq(gatewayAnalysisExports.id, filters.exportId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisExports.projectId, filters.projectId.trim()) : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisExports.status, filters.status.trim()) : undefined,
        filters.textMode ? eq(gatewayAnalysisExports.textMode, filters.textMode) : undefined,
        createdFrom ? gte(gatewayAnalysisExports.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayAnalysisExports.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisExports.createdAt));

  const persisted = rows
    .filter((row) =>
      matchesGatewayPersistedAnalysisExportFilters(
        {
          label: row.label,
          tags: row.tags,
          filters: row.filters,
          createdAt: row.createdAt.toISOString(),
          status: row.status as GatewayPersistedAnalysisExportView["status"],
        },
        filters,
        createdFrom,
        createdTo,
      ),
    )
    .map((row) => toGatewayPersistedAnalysisExportViewFromRow(row, null));

  if (persisted.length > 0 || rows.length > 0 || filters.status?.trim() || filters.tag?.trim()) {
    return buildGatewayAnalysisExportInventorySummary({
      exports: persisted,
      nowIso: now().toISOString(),
    }) satisfies GatewayAnalysisExportInventorySummaryView;
  }

  const manifestKeys = (await listGatewayObjects("ai-gateway/analysis-exports")).filter((key) => key.endsWith("/manifest.json"));
  const fallbackItems: GatewayPersistedAnalysisExportView[] = [];
  for (const manifestKey of manifestKeys) {
    const manifest = await readGatewayAnalysisExportManifest(manifestKey).catch(() => null);
    if (!manifest) {
      continue;
    }
    const item = toGatewayPersistedAnalysisExportView(manifest);
    if (filters.exportId?.trim() && item.exportId !== filters.exportId.trim()) {
      continue;
    }
    if (!matchesGatewayPersistedAnalysisExportFilters(item, filters, createdFrom, createdTo)) {
      continue;
    }
    fallbackItems.push(item);
  }

  return buildGatewayAnalysisExportInventorySummary({
    exports: fallbackItems,
    nowIso: now().toISOString(),
  }) satisfies GatewayAnalysisExportInventorySummaryView;
}

export async function updateGatewayPersistedAnalysisExportMetadataForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  exportId?: string | null,
  input: GatewayAnalysisExportMetadataUpdateInput = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedExportId = exportId?.trim() ?? "";
  if (!normalizedExportId) {
    throw new ConflictError("exportId 不能为空。");
  }

  const [row] = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(eq(gatewayAnalysisExports.id, normalizedExportId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis export 不存在。");
  }
  if (row.status === "deleted") {
    throw new ConflictError("已删除的 export 不允许继续修改 metadata。");
  }

  const nextLabel = Object.prototype.hasOwnProperty.call(input, "label")
    ? normalizeAnalysisExportLabel(input.label)
    : row.label;
  const nextTags = Object.prototype.hasOwnProperty.call(input, "tags")
    ? normalizeAnalysisExportTags(input.tags)
    : normalizeAnalysisExportTags(row.tags);
  const nextRetentionExpiresAt = Object.prototype.hasOwnProperty.call(input, "retentionExpiresAt")
    ? parseFilterTimestamp(input.retentionExpiresAt, "retentionExpiresAt")
    : row.retentionExpiresAt;

  const manifest = await readGatewayAnalysisExportManifest(row.manifestObjectKey).catch(() => null);
  const datasetFile =
    manifest?.files.find((file) => file.kind === "dataset_jsonl") ??
    ({
      kind: "dataset_jsonl",
      objectKey: row.datasetObjectKey,
      contentType: "application/x-ndjson",
      sizeBytes: 0,
      sha256: "",
      lineCount: row.sampleCount,
    } as GatewayPersistedAnalysisExportView["files"][number]);
  const rebuilt = buildGatewayPersistedAnalysisExportManifestArtifacts({
    exportId: row.id,
    label: nextLabel,
    tags: nextTags,
    createdAt: row.createdAt.toISOString(),
    retentionExpiresAt: nextRetentionExpiresAt?.toISOString() ?? null,
    filters: row.filters,
    sampleCount: row.sampleCount,
    requestArtifactCount: row.requestArtifactCount,
    responseArtifactCount: row.responseArtifactCount,
    datasetFile,
    manifestObjectKey: row.manifestObjectKey,
  });
  await putGatewayObject(row.manifestObjectKey, rebuilt.manifestBody, rebuilt.manifestFile.contentType);

  const updatedAt = now();
  await db
    .update(gatewayAnalysisExports)
    .set({
      label: nextLabel,
      tags: nextTags,
      retentionExpiresAt: nextRetentionExpiresAt,
      updatedAt,
    })
    .where(eq(gatewayAnalysisExports.id, row.id));

  return toGatewayPersistedAnalysisExportViewFromRow(
    {
      ...row,
      label: nextLabel,
      tags: nextTags,
      retentionExpiresAt: nextRetentionExpiresAt,
      updatedAt,
    },
    rebuilt.manifest,
  );
}

export async function runGatewayPersistedAnalysisExportCleanupForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: { limit?: number | null; includePinned?: boolean | null; dryRun?: boolean | null } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(args.limit ?? 50, 500));
  const scanTime = now();
  const candidates = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(
      and(
        eq(gatewayAnalysisExports.status, "active"),
        lte(gatewayAnalysisExports.retentionExpiresAt, scanTime),
      ),
    )
    .orderBy(asc(gatewayAnalysisExports.retentionExpiresAt), asc(gatewayAnalysisExports.createdAt))
    .limit(limit);
  const rows = (args.includePinned ? candidates : candidates.filter((row) => !hasPinnedAnalysisExportTag(row.tags))).slice(
    0,
    limit,
  );

  const results: GatewayAnalysisExportCleanupResult["results"] = [];
  for (const row of rows) {
    try {
      const listedKeys = await listGatewayObjects(row.objectPrefix).catch(() => []);
      const keysToDelete = Array.from(
        new Set(
          [row.manifestObjectKey, row.datasetObjectKey, ...listedKeys].filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          ),
        ),
      );
      if (args.dryRun) {
        results.push({
          exportId: row.id,
          status: "deleted",
          deletedObjectCount: keysToDelete.length,
          errorMessage: null,
        });
        continue;
      }
      for (const objectKey of keysToDelete) {
        await deleteGatewayObject(objectKey);
      }

      await db
        .update(gatewayAnalysisExports)
        .set({
          status: "deleted",
          cleanedUpAt: scanTime,
          lastCleanupError: null,
          updatedAt: scanTime,
        })
        .where(eq(gatewayAnalysisExports.id, row.id));

      results.push({
        exportId: row.id,
        status: "deleted",
        deletedObjectCount: keysToDelete.length,
        errorMessage: null,
      });
    } catch (error) {
      const errorMessage = truncateErrorSummary(error instanceof Error ? error.message : String(error), 500);
      await db
        .update(gatewayAnalysisExports)
        .set({
          lastCleanupError: errorMessage,
          updatedAt: scanTime,
        })
        .where(eq(gatewayAnalysisExports.id, row.id));

      results.push({
        exportId: row.id,
        status: "failed",
        deletedObjectCount: 0,
        errorMessage,
      });
    }
  }

  return {
    scannedCount: rows.length,
    deletedCount: results.filter((entry) => entry.status === "deleted").length,
    failedCount: results.filter((entry) => entry.status === "failed").length,
    results,
  } satisfies GatewayAnalysisExportCleanupResult;
}

export async function buildGatewayAnalysisExportDiffForViews(args: {
  leftExport: GatewayPersistedAnalysisExportView;
  rightExport: GatewayPersistedAnalysisExportView;
}) {
  const leftDatasetObjectKey =
    args.leftExport.files.find((file) => file.kind === "dataset_jsonl")?.objectKey ??
    buildGatewayAnalysisExportDatasetObjectKey(args.leftExport.exportId);
  const rightDatasetObjectKey =
    args.rightExport.files.find((file) => file.kind === "dataset_jsonl")?.objectKey ??
    buildGatewayAnalysisExportDatasetObjectKey(args.rightExport.exportId);

  const [leftRows, rightRows] = await Promise.all([
    readGatewayAnalysisExportDataset(leftDatasetObjectKey).catch(() => null),
    readGatewayAnalysisExportDataset(rightDatasetObjectKey).catch(() => null),
  ]);
  if (!leftRows) {
    throw new ConflictError(`leftExportId=${args.leftExport.exportId} 的 dataset.jsonl 不可用，无法执行 diff。`);
  }
  if (!rightRows) {
    throw new ConflictError(`rightExportId=${args.rightExport.exportId} 的 dataset.jsonl 不可用，无法执行 diff。`);
  }

  return buildGatewayAnalysisExportDiff({
    leftExport: args.leftExport,
    rightExport: args.rightExport,
    leftRows,
    rightRows,
  }) satisfies GatewayAnalysisExportDiffView;
}

export async function buildGatewayAnalysisExportTrendPoint(exportView: GatewayPersistedAnalysisExportView) {
  const datasetObjectKey =
    exportView.files.find((file) => file.kind === "dataset_jsonl")?.objectKey ??
    buildGatewayAnalysisExportDatasetObjectKey(exportView.exportId);
  const rows = await readGatewayAnalysisExportDataset(datasetObjectKey).catch(() => null);
  if (!rows) {
    return {
      export: exportView,
      datasetAvailable: false,
      datasetUnavailableReason: "dataset_missing",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      streamSamples: null,
      completedSamples: null,
      failedSamples: null,
      cancelledSamples: null,
      toolRequestSamples: null,
      toolResponseSamples: null,
      systemPromptSamples: null,
      reasoningSamples: null,
      metadataSamples: null,
      explicitSessionSamples: null,
      previousResponseSamples: null,
    } satisfies GatewayAnalysisExportTrendPointView;
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let streamSamples = 0;
  let completedSamples = 0;
  let failedSamples = 0;
  let cancelledSamples = 0;
  let toolRequestSamples = 0;
  let toolResponseSamples = 0;
  let systemPromptSamples = 0;
  let reasoningSamples = 0;
  let metadataSamples = 0;
  let explicitSessionSamples = 0;
  let previousResponseSamples = 0;

  for (const row of rows) {
    promptTokens += row.promptTokens ?? 0;
    completionTokens += row.completionTokens ?? 0;
    totalTokens += row.totalTokens ?? 0;
    if (row.stream) {
      streamSamples += 1;
    }
    if (row.status === "completed") {
      completedSamples += 1;
    } else if (row.status === "failed") {
      failedSamples += 1;
    } else if (row.status === "cancelled") {
      cancelledSamples += 1;
    }
    if ((row.analysisProfile?.requestToolCount ?? 0) > 0 || (row.analysisProfile?.requestHistoricalToolCallCount ?? 0) > 0) {
      toolRequestSamples += 1;
    }
    if ((row.analysisProfile?.responseToolCallCount ?? 0) > 0) {
      toolResponseSamples += 1;
    }
    if (row.analysisProfile?.hasSystemPrompt) {
      systemPromptSamples += 1;
    }
    if (row.analysisProfile?.hasReasoning) {
      reasoningSamples += 1;
    }
    if (row.analysisProfile?.hasMetadata) {
      metadataSamples += 1;
    }
    if (row.analysisProfile?.hasExplicitSessionKey) {
      explicitSessionSamples += 1;
    }
    if (row.analysisProfile?.hasPreviousResponse) {
      previousResponseSamples += 1;
    }
  }

  return {
    export: exportView,
    datasetAvailable: true,
    datasetUnavailableReason: null,
    promptTokens,
    completionTokens,
    totalTokens,
    streamSamples,
    completedSamples,
    failedSamples,
    cancelledSamples,
    toolRequestSamples,
    toolResponseSamples,
    systemPromptSamples,
    reasoningSamples,
    metadataSamples,
    explicitSessionSamples,
    previousResponseSamples,
  } satisfies GatewayAnalysisExportTrendPointView;
}

export async function getGatewayPersistedAnalysisExportDiffForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: { leftExportId?: string | null; rightExportId?: string | null } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const leftExportId = args.leftExportId?.trim() ?? "";
  const rightExportId = args.rightExportId?.trim() ?? "";
  if (!leftExportId || !rightExportId) {
    throw new ConflictError("leftExportId 与 rightExportId 都不能为空。");
  }

  const [leftExport, rightExport] = await Promise.all([
    getGatewayPersistedAnalysisExportForOperator(operatorUserId, providerUserId, leftExportId),
    getGatewayPersistedAnalysisExportForOperator(operatorUserId, providerUserId, rightExportId),
  ]);
  return buildGatewayAnalysisExportDiffForViews({
    leftExport,
    rightExport,
  });
}

export async function getGatewayAnalysisExportBaselineReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportBaselineReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = {
    ...filters,
    status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
    limit: Math.max(2, Math.min(filters.limit ?? 10, 50)),
  };
  const [exports, inventorySummary] = await Promise.all([
    listGatewayPersistedAnalysisExportsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayPersistedAnalysisExportInventorySummaryForOperator(operatorUserId, providerUserId, normalizedFilters),
  ]);

  let diff: GatewayAnalysisExportDiffView | null = null;
  if (exports.length >= 2) {
    diff = await getGatewayPersistedAnalysisExportDiffForOperator(operatorUserId, providerUserId, {
      leftExportId: exports[1]?.exportId,
      rightExportId: exports[0]?.exportId,
    }).catch(() => null);
  }

  return buildGatewayAnalysisExportBaselineReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      tag: normalizedFilters.tag ?? null,
      projectId: normalizedFilters.projectId ?? null,
      status: normalizedFilters.status ?? null,
      textMode: normalizedFilters.textMode ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    exports,
    inventorySummary,
    diff,
  }) satisfies GatewayAnalysisExportBaselineReportView;
}

export async function getGatewayAnalysisExportTimelineReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportBaselineReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = {
    ...filters,
    status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
    limit: Math.max(2, Math.min(filters.limit ?? 5, 20)),
  };
  const [exports, inventorySummary] = await Promise.all([
    listGatewayPersistedAnalysisExportsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayPersistedAnalysisExportInventorySummaryForOperator(operatorUserId, providerUserId, normalizedFilters),
  ]);

  const pairComparisons: GatewayAnalysisExportTimelinePairView[] = [];
  for (let index = 0; index < exports.length - 1; index += 1) {
    const newerExport = exports[index];
    const olderExport = exports[index + 1];
    if (!newerExport || !olderExport) {
      continue;
    }
    try {
      const diff = await buildGatewayAnalysisExportDiffForViews({
        leftExport: olderExport,
        rightExport: newerExport,
      });
      pairComparisons.push({
        newerExport,
        olderExport,
        diff,
        diffUnavailableReason: null,
      });
    } catch (error) {
      pairComparisons.push({
        newerExport,
        olderExport,
        diff: null,
        diffUnavailableReason: truncateErrorSummary(error instanceof Error ? error.message : String(error), 240),
      });
    }
  }

  return buildGatewayAnalysisExportTimelineReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      tag: normalizedFilters.tag ?? null,
      projectId: normalizedFilters.projectId ?? null,
      status: normalizedFilters.status ?? null,
      textMode: normalizedFilters.textMode ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    exports,
    inventorySummary,
    pairComparisons,
  }) satisfies GatewayAnalysisExportTimelineReportView;
}

export async function getGatewayAnalysisExportTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportBaselineReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = {
    ...filters,
    status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
    limit: Math.max(1, Math.min(filters.limit ?? 10, 50)),
  };
  const [exports, inventorySummary] = await Promise.all([
    listGatewayPersistedAnalysisExportsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayPersistedAnalysisExportInventorySummaryForOperator(operatorUserId, providerUserId, normalizedFilters),
  ]);
  const points = await Promise.all(exports.map((item) => buildGatewayAnalysisExportTrendPoint(item)));

  return buildGatewayAnalysisExportTrendReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      tag: normalizedFilters.tag ?? null,
      projectId: normalizedFilters.projectId ?? null,
      status: normalizedFilters.status ?? null,
      textMode: normalizedFilters.textMode ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    inventorySummary,
    points,
  }) satisfies GatewayAnalysisExportTrendReportView;
}

export async function getGatewayAnalysisExportAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportAnomalyReportFilters = {},
) {
  const context = await resolveGatewayAnalysisAnomalyEvaluationContextForOperator(operatorUserId, providerUserId, filters);
  const trendReport = await getGatewayAnalysisExportTrendReportForOperator(operatorUserId, providerUserId, context.filters);
  return buildGatewayAnalysisExportAnomalyReport({
    trendReport,
    profileKey: context.profileKey,
    thresholds: context.thresholds,
  }) satisfies GatewayAnalysisExportAnomalyReportView;
}
