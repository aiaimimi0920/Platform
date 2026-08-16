// Evidence attachment storage helpers: storage policy resolution, object
// key/metadata/tag directives, filename normalization, and remote object
// storage IO (store/prepare/read/delete/verify). Moved verbatim from
// service.ts.
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  ArbitrationEvidenceAttachmentUploadPlanView,
  ArbitrationEvidenceStoragePolicyView,
  ArbitrationEvidenceView,
  PrepareArbitrationEvidenceAttachmentUploadInput,
  UploadArbitrationEvidenceAttachmentInput,
} from "@neuro/contracts";
import {
  requestInternalArrayBuffer,
  requestInternalText,
} from "@neuro/backend-foundation/platform/internal-request";

import { arbitrationEvidenceAttachments } from "@/modules/arbitration/schema";
import { env } from "@/env";
import { ConflictError, NotFoundError } from "@/platform/errors";
import {
  createSignedWriteUrl,
  deleteObject,
  getObjectMetadata,
  putObject,
  readObject,
} from "@/platform/object-storage/service";

export function getPreparedUploadExpiresAt(
  preparedAt: Date,
  args?: { evidenceKind?: ArbitrationEvidenceView["kind"] | null; policyKey?: string | null },
) {
  const policy = resolveArbitrationEvidenceStoragePolicy(args?.evidenceKind ?? null, args?.policyKey ?? null);
  return new Date(preparedAt.getTime() + policy.uploadPlanTtlSeconds * 1000);
}

export function resolveArbitrationEvidenceStoragePolicy(
  evidenceKind?: ArbitrationEvidenceView["kind"] | null,
  policyKey?: string | null,
) {
  if (policyKey && env.arbitrationEvidenceStoragePolicies[policyKey]) {
    return {
      key: policyKey,
      ...env.arbitrationEvidenceStoragePolicies[policyKey],
    };
  }
  if (evidenceKind) {
    const matchedEntry = Object.entries(env.arbitrationEvidenceStoragePolicies).find(([, policy]) =>
      policy.evidenceKinds.includes(evidenceKind),
    );
    if (matchedEntry) {
      return {
        key: matchedEntry[0],
        ...matchedEntry[1],
      };
    }
  }
  const fallbackKey =
    env.arbitrationEvidenceStoragePolicies[env.arbitrationEvidenceStoragePolicyKey]
      ? env.arbitrationEvidenceStoragePolicyKey
      : env.arbitrationEvidenceStoragePolicies.default
        ? "default"
        : Object.keys(env.arbitrationEvidenceStoragePolicies)[0] ?? env.arbitrationEvidenceStoragePolicyKey;
  return {
    key: fallbackKey,
    ...env.arbitrationEvidenceStoragePolicies[fallbackKey],
  };
}

export function getArbitrationRemoteRetentionExpiresAt(referenceTime: Date, policyKey?: string | null) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  return new Date(referenceTime.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000);
}

export function getNextArbitrationCleanupAttemptAt(attemptCount: number, referenceTime: Date, policyKey?: string | null) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  const backoffMinutes = policy.cleanupBaseBackoffMinutes * Math.max(1, 2 ** Math.max(0, attemptCount - 1));
  return new Date(referenceTime.getTime() + backoffMinutes * 60 * 1000);
}

export function getArbitrationEvidenceStoragePolicy(policyKey?: string | null): ArbitrationEvidenceStoragePolicyView {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  return {
    policyKey: policy.key,
    storageMode: env.arbitrationEvidenceStorageMode,
    bucketKey: policy.bucketKey,
    cleanupMode: policy.cleanupMode,
    evidenceKinds: [...policy.evidenceKinds],
    remoteProviderKey:
      env.arbitrationEvidenceStorageMode === "remote" ? env.arbitrationEvidenceRemoteProviderKey : null,
    remoteUploadStrategy: env.arbitrationEvidenceRemoteUploadStrategy,
    remoteBaseUrlConfigured: Boolean(env.arbitrationEvidenceRemoteBaseUrl),
    remoteUploadBaseUrlConfigured: Boolean(env.arbitrationEvidenceRemoteUploadBaseUrl),
    remoteAuthConfigured: Boolean(env.arbitrationEvidenceRemoteAuthToken),
    prepareUploadSupported:
      env.arbitrationEvidenceStorageMode === "remote" &&
      env.arbitrationEvidenceRemoteUploadStrategy === "prepared_remote_put",
    uploadPlanTtlSeconds: policy.uploadPlanTtlSeconds,
    retentionDays: policy.retentionDays,
    cleanupMaxAttempts: policy.cleanupMaxAttempts,
    cleanupBaseBackoffMinutes: policy.cleanupBaseBackoffMinutes,
  };
}

export function shouldDeleteArbitrationAttachmentOnCleanup(policyKey?: string | null) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  return policy.cleanupMode === "delete_object";
}

export function getRemoteAttachmentCleanupState(args: {
  attachment: typeof arbitrationEvidenceAttachments.$inferSelect;
  referenceTime: Date;
}) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, args.attachment.storagePolicyKey ?? null);
  if (args.attachment.cleanupRequestedAt) return "cleanup_requested" as const;
  if ((args.attachment.cleanupAttemptCount ?? 0) >= policy.cleanupMaxAttempts) return "exhausted" as const;
  if (args.attachment.lastCleanupError) {
    if (args.attachment.nextCleanupAttemptAt && args.attachment.nextCleanupAttemptAt.getTime() > args.referenceTime.getTime()) {
      return "retry_waiting" as const;
    }
    return "failed" as const;
  }
  if (args.attachment.retentionExpiresAt && args.attachment.retentionExpiresAt.getTime() <= args.referenceTime.getTime()) {
    return "due_now" as const;
  }
  return "pending" as const;
}

export function getArbitrationAttachmentStorageRoot() {
  return path.resolve(process.cwd(), env.arbitrationEvidenceStorageDir);
}

export function buildRemoteAttachmentObjectKey(caseId: string, evidenceId: string, attachmentId: string, fileName: string) {
  return `${caseId}/${evidenceId}/${attachmentId}-${fileName}`;
}

export function buildArbitrationAttachmentObjectStorageDirectives(args: {
  storagePolicyKey: string;
  bucketKey: string | null;
  evidenceKind?: ArbitrationEvidenceView["kind"] | null;
  preparedUploadExpiresAt?: Date | null;
  retentionExpiresAt?: Date | null;
  cleanupRequestedAt?: Date | null;
  verifiedAt?: Date | null;
  verifiedSizeBytes?: number | null;
  state: "prepared" | "uploaded" | "cleanup_requested" | "archived";
}) {
  const policy = resolveArbitrationEvidenceStoragePolicy(args.evidenceKind ?? null, args.storagePolicyKey);
  const metadata = {
    "policy-key": policy.key,
    "bucket-key": args.bucketKey ?? policy.bucketKey ?? "",
    "cleanup-mode": policy.cleanupMode,
    "retention-days": String(policy.retentionDays),
    "evidence-kind": args.evidenceKind ?? "",
    "prepared-upload-expires-at": args.preparedUploadExpiresAt?.toISOString() ?? "",
    "retention-expires-at": args.retentionExpiresAt?.toISOString() ?? "",
    "cleanup-requested-at": args.cleanupRequestedAt?.toISOString() ?? "",
    "verified-at": args.verifiedAt?.toISOString() ?? "",
    "verified-size-bytes":
      typeof args.verifiedSizeBytes === "number" && Number.isFinite(args.verifiedSizeBytes)
        ? String(args.verifiedSizeBytes)
        : "",
    state: args.state,
  };
  const tags = {
    nl_policy: policy.key,
    nl_bucket: args.bucketKey ?? policy.bucketKey ?? "default",
    nl_cleanup_mode: policy.cleanupMode,
    nl_retention_days: policy.retentionDays,
    nl_state: args.state,
    nl_prepare_exp_epoch:
      args.preparedUploadExpiresAt ? Math.floor(args.preparedUploadExpiresAt.getTime() / 1000) : undefined,
    nl_retention_exp_epoch:
      args.retentionExpiresAt ? Math.floor(args.retentionExpiresAt.getTime() / 1000) : undefined,
    nl_cleanup_requested_epoch:
      args.cleanupRequestedAt ? Math.floor(args.cleanupRequestedAt.getTime() / 1000) : undefined,
    nl_verified_epoch: args.verifiedAt ? Math.floor(args.verifiedAt.getTime() / 1000) : undefined,
    nl_verified_size_bytes:
      typeof args.verifiedSizeBytes === "number" && Number.isFinite(args.verifiedSizeBytes)
        ? args.verifiedSizeBytes
        : undefined,
  };
  return {
    metadata,
    tags,
  };
}

export function joinRemoteAttachmentUrl(baseUrl: string, objectKey: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedPath = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizedBase}/${encodedPath}`;
}

export function sanitizeFileName(input: string) {
  return input.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "attachment.bin";
}

export async function ensureArbitrationAttachmentDirectory(caseId: string, evidenceId: string) {
  const directory = path.join(getArbitrationAttachmentStorageRoot(), caseId, evidenceId);
  await mkdir(directory, { recursive: true });
  return directory;
}

export function decodeArbitrationAttachmentBase64(input: string) {
  const normalized = input.trim();
  if (normalized.length === 0) {
    return Buffer.alloc(0);
  }

  const firstPaddingIndex = normalized.indexOf("=");
  const hasInvalidAlphabet = !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized);
  const hasInvalidLength = normalized.length % 4 === 1;
  const hasInvalidPadding = firstPaddingIndex >= 0 && normalized.length % 4 !== 0;
  if (hasInvalidAlphabet || hasInvalidLength || hasInvalidPadding) {
    throw new ConflictError("Attachment payload is not valid base64");
  }

  const buffer = Buffer.from(normalized, "base64");
  const canonicalWithoutPadding = buffer.toString("base64").replace(/=+$/, "");
  const inputWithoutPadding = normalized.replace(/=+$/, "");
  if (canonicalWithoutPadding !== inputWithoutPadding) {
    throw new ConflictError("Attachment payload is not valid base64");
  }
  return buffer;
}

export function normalizeAttachmentUpload(input: UploadArbitrationEvidenceAttachmentInput) {
  const fileName = sanitizeFileName(input.fileName.trim());
  const contentType = input.contentType.trim().toLowerCase();
  if (!fileName) {
    throw new ConflictError("Attachment filename is required");
  }
  if (!contentType || !env.arbitrationEvidenceAllowedContentTypes.includes(contentType)) {
    throw new ConflictError("Attachment content type is not allowed");
  }
  const buffer = decodeArbitrationAttachmentBase64(input.base64Content);
  if (buffer.length === 0) {
    throw new ConflictError("Attachment payload is empty");
  }
  if (buffer.length > env.arbitrationEvidenceMaxBytes) {
    throw new ConflictError("Attachment exceeds the configured size limit");
  }
  return {
    fileName,
    contentType,
    buffer,
  };
}

export function normalizeAttachmentPrepareInput(input: PrepareArbitrationEvidenceAttachmentUploadInput) {
  const fileName = sanitizeFileName(input.fileName.trim());
  const contentType = input.contentType.trim().toLowerCase();
  const sizeBytes = Math.max(0, Math.floor(input.sizeBytes));
  if (!fileName) {
    throw new ConflictError("Attachment filename is required");
  }
  if (!contentType || !env.arbitrationEvidenceAllowedContentTypes.includes(contentType)) {
    throw new ConflictError("Attachment content type is not allowed");
  }
  if (sizeBytes <= 0) {
    throw new ConflictError("Attachment size must be greater than zero");
  }
  if (sizeBytes > env.arbitrationEvidenceMaxBytes) {
    throw new ConflictError("Attachment exceeds the configured size limit");
  }
  return {
    fileName,
    contentType,
    sizeBytes,
  };
}

export async function storeRemoteArbitrationAttachment(args: {
  objectKey: string;
  contentType: string;
  buffer: Buffer;
  bucketKey: string | null;
  storagePolicyKey: string;
  evidenceKind?: ArbitrationEvidenceView["kind"] | null;
}) {
  const storageDirectives = buildArbitrationAttachmentObjectStorageDirectives({
    storagePolicyKey: args.storagePolicyKey,
    bucketKey: args.bucketKey,
    evidenceKind: args.evidenceKind ?? null,
    state: "uploaded",
  });
  if (env.objectStorageDriver === "s3-compatible") {
    const result = await putObject({
      objectKey: args.objectKey,
      contentType: args.contentType,
      body: args.buffer,
      bucketKey: args.bucketKey,
      metadata: storageDirectives.metadata,
      tags: storageDirectives.tags,
    });
    return {
      remoteUrl: result.publicUrl,
    };
  }

  const uploadBaseUrl = env.arbitrationEvidenceRemoteUploadBaseUrl ?? env.arbitrationEvidenceRemoteBaseUrl;
  if (!uploadBaseUrl) {
    throw new ConflictError("Remote arbitration evidence storage is not configured");
  }

  const uploadUrl = joinRemoteAttachmentUrl(uploadBaseUrl, args.objectKey);
  const { response } = await requestInternalText(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        "content-type": args.contentType,
        ...(env.arbitrationEvidenceRemoteAuthToken
          ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
          : {}),
      },
      body: args.buffer,
    },
    {
      timeoutMs: env.objectStorageFetchTimeoutMs,
      timeoutMessage: "Remote arbitration attachment upload timed out",
    },
  );
  if (!response.ok) {
    throw new ConflictError(`Remote arbitration attachment upload failed with status ${response.status}`);
  }

  return {
    remoteUrl: env.arbitrationEvidenceRemoteBaseUrl
      ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
      : uploadUrl,
  };
}

export async function buildPreparedRemoteAttachmentUploadPlan(args: {
  attachmentId: string;
  evidenceId: string;
  caseId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  bucketKey: string | null;
  storagePolicyKey: string;
  preparedAt: Date;
}): Promise<ArbitrationEvidenceAttachmentUploadPlanView> {
  const expiresAt = getPreparedUploadExpiresAt(args.preparedAt, { policyKey: args.storagePolicyKey }).toISOString();
  const storageDirectives = buildArbitrationAttachmentObjectStorageDirectives({
    storagePolicyKey: args.storagePolicyKey,
    bucketKey: args.bucketKey,
    preparedUploadExpiresAt: new Date(expiresAt),
    state: "prepared",
  });
  if (env.objectStorageDriver === "s3-compatible") {
    const signedUpload = await createSignedWriteUrl({
      objectKey: args.objectKey,
      contentType: args.contentType,
      bucketKey: args.bucketKey,
      metadata: storageDirectives.metadata,
      tags: storageDirectives.tags,
    });
    return {
      attachmentId: args.attachmentId,
      evidenceId: args.evidenceId,
      caseId: args.caseId,
      fileName: args.fileName,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      storageMode: "remote",
      uploadStrategy: "prepared_remote_put",
      storagePolicyKey: args.storagePolicyKey,
      bucketKey: args.bucketKey,
      uploadUrl: signedUpload.url,
      uploadMethod: "PUT",
      requiredHeaders: signedUpload.requiredHeaders,
      objectKey: args.objectKey,
      remoteUrl: env.objectStoragePublicBaseUrl
        ? joinRemoteAttachmentUrl(env.objectStoragePublicBaseUrl, args.objectKey)
        : null,
      expiresAt: signedUpload.expiresAt ?? expiresAt,
      completeUploadRequired: true,
    };
  }

  const uploadBaseUrl = env.arbitrationEvidenceRemoteUploadBaseUrl ?? env.arbitrationEvidenceRemoteBaseUrl;
  if (!uploadBaseUrl) {
    throw new ConflictError("Remote arbitration evidence upload target is not configured");
  }
  const uploadUrl = joinRemoteAttachmentUrl(uploadBaseUrl, args.objectKey);
  const remoteUrl = env.arbitrationEvidenceRemoteBaseUrl
    ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
    : uploadUrl;
  return {
    attachmentId: args.attachmentId,
    evidenceId: args.evidenceId,
    caseId: args.caseId,
    fileName: args.fileName,
    contentType: args.contentType,
    sizeBytes: args.sizeBytes,
    storageMode: "remote",
    uploadStrategy: "prepared_remote_put",
    storagePolicyKey: args.storagePolicyKey,
    bucketKey: args.bucketKey,
    uploadUrl,
    uploadMethod: "PUT",
    requiredHeaders: {
      "content-type": args.contentType,
      ...(env.arbitrationEvidenceRemoteAuthToken
        ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
        : {}),
    },
    objectKey: args.objectKey,
    remoteUrl,
    expiresAt,
    completeUploadRequired: true,
  };
}

export async function readRemoteArbitrationAttachment(args: {
  objectKey: string | null;
  remoteUrl: string | null;
  bucketKey: string | null;
}) {
  if (env.objectStorageDriver === "s3-compatible" && args.objectKey) {
    return readObject({
      objectKey: args.objectKey,
      bucketKey: args.bucketKey,
    });
  }

  const targetUrl =
    args.remoteUrl ??
    (args.objectKey && env.arbitrationEvidenceRemoteBaseUrl
      ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
      : null);
  if (!targetUrl) {
    throw new NotFoundError("Remote arbitration attachment URL is unavailable");
  }

  const { response, arrayBuffer } = await requestInternalArrayBuffer(
    targetUrl,
    {
      headers: env.arbitrationEvidenceRemoteAuthToken
        ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
        : undefined,
    },
    {
      timeoutMs: env.objectStorageFetchTimeoutMs,
      timeoutMessage: "Remote arbitration attachment download timed out",
    },
  );
  if (!response.ok) {
    throw new NotFoundError("Remote arbitration attachment could not be fetched");
  }

  return Buffer.from(arrayBuffer);
}

export async function deleteRemoteArbitrationAttachment(args: {
  objectKey: string | null;
  remoteUrl: string | null;
  bucketKey: string | null;
}) {
  if (env.objectStorageDriver === "s3-compatible" && args.objectKey) {
    await deleteObject({
      objectKey: args.objectKey,
      bucketKey: args.bucketKey,
    });
    return;
  }

  const targetUrl =
    args.remoteUrl ??
    (args.objectKey && env.arbitrationEvidenceRemoteBaseUrl
      ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
      : null);
  if (!targetUrl) {
    throw new ConflictError("Remote arbitration attachment URL is unavailable");
  }

  const { response } = await requestInternalText(
    targetUrl,
    {
      method: "DELETE",
      headers: env.arbitrationEvidenceRemoteAuthToken
        ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
        : undefined,
    },
    {
      timeoutMs: env.objectStorageFetchTimeoutMs,
      timeoutMessage: "Remote arbitration attachment cleanup timed out",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new ConflictError(`Remote arbitration attachment cleanup failed with status ${response.status}`);
  }
}

export async function verifyRemoteArbitrationAttachmentUpload(args: {
  attachment: typeof arbitrationEvidenceAttachments.$inferSelect;
}) {
  if (!args.attachment.objectKey) {
    throw new ConflictError("Prepared remote arbitration attachment is missing object key");
  }

  const metadata = await getObjectMetadata({
    objectKey: args.attachment.objectKey,
    bucketKey: args.attachment.bucketKey,
  });
  if (!metadata.exists) {
    throw new ConflictError("Prepared remote arbitration attachment was not uploaded to object storage");
  }

  if (typeof metadata.sizeBytes === "number" && metadata.sizeBytes !== args.attachment.sizeBytes) {
    throw new ConflictError(
      `Prepared remote arbitration attachment size mismatch: expected ${args.attachment.sizeBytes}, got ${metadata.sizeBytes}`,
    );
  }

  const expectedContentType = args.attachment.contentType.trim().toLowerCase();
  const actualContentType = metadata.contentType?.trim().toLowerCase() ?? null;
  if (actualContentType && actualContentType !== expectedContentType) {
    throw new ConflictError(
      `Prepared remote arbitration attachment content type mismatch: expected ${args.attachment.contentType}, got ${metadata.contentType}`,
    );
  }

  return metadata;
}
