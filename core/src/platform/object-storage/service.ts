import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/env";
import { resolveObjectStoragePath } from "./path";

type PutObjectArgs = {
  objectKey: string;
  contentType: string;
  body: Buffer;
  bucketKey?: string | null;
  metadata?: Record<string, string | null | undefined>;
  tags?: Record<string, string | number | boolean | null | undefined>;
};

type ReadObjectArgs = {
  objectKey: string;
  bucketKey?: string | null;
};

type DeleteObjectArgs = {
  objectKey: string;
  bucketKey?: string | null;
};

type SetObjectTagsArgs = {
  objectKey: string;
  bucketKey?: string | null;
  tags: Record<string, string | number | boolean | null | undefined>;
};

type SignedReadUrlArgs = {
  objectKey: string;
  fileName?: string | null;
  contentType?: string | null;
  bucketKey?: string | null;
};

type SignedReadUrlResult = {
  url: string;
  expiresAt: string | null;
};

type SignedWriteUrlArgs = {
  objectKey: string;
  contentType: string;
  bucketKey?: string | null;
  metadata?: Record<string, string | null | undefined>;
  tags?: Record<string, string | number | boolean | null | undefined>;
};

type SignedWriteUrlResult = {
  url: string;
  expiresAt: string | null;
  requiredHeaders: Record<string, string>;
};

type ObjectMetadataArgs = {
  objectKey: string;
  bucketKey?: string | null;
};

export type ObjectMetadataView = {
  exists: boolean;
  sizeBytes: number | null;
  contentType: string | null;
  lastModifiedAt: string | null;
};

let objectStorageClient: S3Client | null = null;

function getObjectStorageRoot() {
  return path.resolve(process.cwd(), env.objectStorageLocalDir);
}

function ensureS3CompatibleConfigured() {
  if (!env.objectStorageBucket || !env.objectStorageEndpoint || !env.objectStorageAccessKeyId || !env.objectStorageSecretAccessKey) {
    throw new Error("S3-compatible object storage is not fully configured");
  }
}

function getS3CompatibleClient() {
  ensureS3CompatibleConfigured();
  if (objectStorageClient) return objectStorageClient;

  objectStorageClient = new S3Client({
    region: env.objectStorageRegion,
    endpoint: env.objectStorageEndpoint ?? undefined,
    forcePathStyle: env.objectStorageForcePathStyle,
    credentials: {
      accessKeyId: env.objectStorageAccessKeyId as string,
      secretAccessKey: env.objectStorageSecretAccessKey as string,
    },
    requestHandler: new NodeHttpHandler({
      connectionTimeout: env.objectStorageFetchTimeoutMs,
      requestTimeout: env.objectStorageFetchTimeoutMs,
      socketTimeout: env.objectStorageFetchTimeoutMs,
    }),
  });

  return objectStorageClient;
}

function buildPublicObjectUrl(objectKey: string) {
  if (!env.objectStoragePublicBaseUrl) return null;
  const normalizedBase = env.objectStoragePublicBaseUrl.replace(/\/+$/, "");
  const encodedPath = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizedBase}/${encodedPath}`;
}

function resolveBucketKey(bucketKey?: string | null) {
  return bucketKey?.trim() || env.objectStorageBucket;
}

function normalizeObjectMetadata(metadata?: Record<string, string | null | undefined>) {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata)
    .map(([key, value]) => [key.trim().toLowerCase(), value?.trim() ?? ""] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function normalizeObjectTags(tags?: Record<string, string | number | boolean | null | undefined>) {
  if (!tags) return undefined;
  const entries = Object.entries(tags)
    .map(([key, value]) => [key.trim(), value == null ? "" : String(value).trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function buildS3TaggingHeader(tags?: Record<string, string>) {
  if (!tags) return undefined;
  const entries = Object.entries(tags);
  if (entries.length === 0) return undefined;
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function toBuffer(stream: unknown) {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;
  if (
    typeof stream === "object" &&
    "transformToByteArray" in stream &&
    typeof stream.transformToByteArray === "function"
  ) {
    return Buffer.from(await stream.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function putObject(args: PutObjectArgs) {
  const metadata = normalizeObjectMetadata(args.metadata);
  const tags = normalizeObjectTags(args.tags);
  if (env.objectStorageDriver === "local") {
    const absolutePath = resolveObjectStoragePath(getObjectStorageRoot(), args.objectKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, args.body);
    return {
      objectKey: args.objectKey,
      publicUrl: buildPublicObjectUrl(args.objectKey),
    };
  }

  const client = getS3CompatibleClient();
  await client.send(
    new PutObjectCommand({
      Bucket: resolveBucketKey(args.bucketKey) as string,
      Key: args.objectKey,
      Body: args.body,
      ContentType: args.contentType,
      Metadata: metadata,
      Tagging: buildS3TaggingHeader(tags),
    }),
  );
  return {
    objectKey: args.objectKey,
    publicUrl: buildPublicObjectUrl(args.objectKey),
  };
}

export async function readObject(args: ReadObjectArgs) {
  if (env.objectStorageDriver === "local") {
    const absolutePath = resolveObjectStoragePath(getObjectStorageRoot(), args.objectKey);
    return readFile(absolutePath);
  }

  const client = getS3CompatibleClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: resolveBucketKey(args.bucketKey) as string,
      Key: args.objectKey,
    }),
  );
  return toBuffer(response.Body);
}

export async function deleteObject(args: DeleteObjectArgs) {
  if (env.objectStorageDriver === "local") {
    const absolutePath = resolveObjectStoragePath(getObjectStorageRoot(), args.objectKey);
    await unlink(absolutePath).catch(() => undefined);
    return;
  }

  const client = getS3CompatibleClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: resolveBucketKey(args.bucketKey) as string,
      Key: args.objectKey,
    }),
  );
}

export async function setObjectTags(args: SetObjectTagsArgs) {
  const tags = normalizeObjectTags(args.tags);
  if (!tags) {
    return;
  }

  if (env.objectStorageDriver === "local") {
    return;
  }

  const client = getS3CompatibleClient();
  await client.send(
    new PutObjectTaggingCommand({
      Bucket: resolveBucketKey(args.bucketKey) as string,
      Key: args.objectKey,
      Tagging: {
        TagSet: Object.entries(tags)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([Key, Value]) => ({ Key, Value })),
      },
    }),
  );
}

export async function createSignedReadUrl(args: SignedReadUrlArgs): Promise<SignedReadUrlResult> {
  if (env.objectStorageDriver === "local") {
    throw new Error("Signed read URLs are unavailable for local object storage");
  }

  const client = getS3CompatibleClient();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: resolveBucketKey(args.bucketKey) as string,
      Key: args.objectKey,
      ResponseContentDisposition: args.fileName
        ? `inline; filename="${args.fileName.replace(/"/g, "")}"`
        : undefined,
      ResponseContentType: args.contentType ?? undefined,
    }),
    { expiresIn: env.objectStorageSignedUrlTtlSeconds },
  );

  return {
    url,
    expiresAt: new Date(Date.now() + env.objectStorageSignedUrlTtlSeconds * 1000).toISOString(),
  };
}

export async function createSignedWriteUrl(args: SignedWriteUrlArgs): Promise<SignedWriteUrlResult> {
  if (env.objectStorageDriver === "local") {
    throw new Error("Signed write URLs are unavailable for local object storage");
  }

  const client = getS3CompatibleClient();
  const metadata = normalizeObjectMetadata(args.metadata);
  const tags = normalizeObjectTags(args.tags);
  const taggingHeader = buildS3TaggingHeader(tags);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: resolveBucketKey(args.bucketKey) as string,
      Key: args.objectKey,
      ContentType: args.contentType,
      Metadata: metadata,
      Tagging: taggingHeader,
    }),
    { expiresIn: env.objectStorageSignedUrlTtlSeconds },
  );

  return {
    url,
    expiresAt: new Date(Date.now() + env.objectStorageSignedUrlTtlSeconds * 1000).toISOString(),
    requiredHeaders: {
      "content-type": args.contentType,
      ...Object.fromEntries(
        Object.entries(metadata ?? {}).map(([key, value]) => [`x-amz-meta-${key}`, value]),
      ),
      ...(taggingHeader ? { "x-amz-tagging": taggingHeader } : {}),
    },
  };
}

export async function getObjectMetadata(args: ObjectMetadataArgs): Promise<ObjectMetadataView> {
  if (env.objectStorageDriver === "local") {
    const absolutePath = resolveObjectStoragePath(getObjectStorageRoot(), args.objectKey);
    try {
      const file = await stat(absolutePath);
      return {
        exists: true,
        sizeBytes: Number.isFinite(file.size) ? file.size : null,
        contentType: null,
        lastModifiedAt: file.mtime ? file.mtime.toISOString() : null,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return {
          exists: false,
          sizeBytes: null,
          contentType: null,
          lastModifiedAt: null,
        };
      }
      throw error;
    }
  }

  const client = getS3CompatibleClient();
  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: resolveBucketKey(args.bucketKey) as string,
        Key: args.objectKey,
      }),
    );

    return {
      exists: true,
      sizeBytes: typeof response.ContentLength === "number" ? response.ContentLength : null,
      contentType: response.ContentType ?? null,
      lastModifiedAt: response.LastModified ? response.LastModified.toISOString() : null,
    };
  } catch (error) {
    const metadata = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata;
    const name = (error as { name?: string })?.name;
    if (metadata?.httpStatusCode === 404 || name === "NotFound" || name === "NoSuchKey") {
      return {
        exists: false,
        sizeBytes: null,
        contentType: null,
        lastModifiedAt: null,
      };
    }
    throw error;
  }
}
