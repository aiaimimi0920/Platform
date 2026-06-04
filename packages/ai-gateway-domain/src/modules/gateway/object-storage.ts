import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/env";

let objectStorageClient: S3Client | null = null;

function getStorageRoot() {
  return path.resolve(process.cwd(), env.objectStorageLocalDir);
}

function ensureRemoteStorageConfigured() {
  if (
    !env.objectStorageBucket ||
    !env.objectStorageEndpoint ||
    !env.objectStorageAccessKeyId ||
    !env.objectStorageSecretAccessKey
  ) {
    throw new Error("AI gateway object storage is not fully configured");
  }
}

function getS3Client() {
  ensureRemoteStorageConfigured();
  if (objectStorageClient) {
    return objectStorageClient;
  }

  objectStorageClient = new S3Client({
    region: env.objectStorageRegion,
    endpoint: env.objectStorageEndpoint ?? undefined,
    forcePathStyle: env.objectStorageForcePathStyle,
    credentials: {
      accessKeyId: env.objectStorageAccessKeyId as string,
      secretAccessKey: env.objectStorageSecretAccessKey as string,
    },
  });
  return objectStorageClient;
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
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function putGatewayObject(objectKey: string, body: Buffer, contentType: string) {
  if (env.objectStorageDriver === "local") {
    const absolutePath = path.join(getStorageRoot(), ...objectKey.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return { objectKey };
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.objectStorageBucket as string,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { objectKey };
}

export async function readGatewayObject(objectKey: string) {
  if (env.objectStorageDriver === "local") {
    const absolutePath = path.join(getStorageRoot(), ...objectKey.split("/"));
    return readFile(absolutePath);
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.objectStorageBucket as string,
      Key: objectKey,
    }),
  );
  return toBuffer(response.Body);
}

export async function deleteGatewayObject(objectKey: string) {
  if (!objectKey) {
    return;
  }

  if (env.objectStorageDriver === "local") {
    const absolutePath = path.join(getStorageRoot(), ...objectKey.split("/"));
    await unlink(absolutePath).catch(() => undefined);
    return;
  }

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.objectStorageBucket as string,
      Key: objectKey,
    }),
  );
}

async function listLocalGatewayObjects(prefix: string) {
  const storageRoot = getStorageRoot();
  const absolutePrefixPath = path.join(storageRoot, ...prefix.split("/"));
  const discovered: string[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absoluteEntryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absoluteEntryPath);
        continue;
      }
      const relativePath = path.relative(storageRoot, absoluteEntryPath).split(path.sep).join("/");
      discovered.push(relativePath);
    }
  }

  await walk(absolutePrefixPath);
  return discovered.sort((left, right) => left.localeCompare(right));
}

export async function listGatewayObjects(prefix: string) {
  const normalizedPrefix = prefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalizedPrefix) {
    return [] as string[];
  }

  if (env.objectStorageDriver === "local") {
    return listLocalGatewayObjects(normalizedPrefix);
  }

  const client = getS3Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: env.objectStorageBucket as string,
        Prefix: normalizedPrefix.endsWith("/") ? normalizedPrefix : `${normalizedPrefix}/`,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of response.Contents ?? []) {
      if (typeof item.Key === "string" && item.Key.trim()) {
        keys.push(item.Key.trim());
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys.sort((left, right) => left.localeCompare(right));
}
