import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/env";

let objectStorageClient: S3Client | null = null;

function getStorageRoot() {
  return path.resolve(process.cwd(), env.credentialObjectStorageLocalDir);
}

function ensureRemoteStorageConfigured() {
  if (
    !env.credentialObjectStorageBucket ||
    !env.credentialObjectStorageEndpoint ||
    !env.credentialObjectStorageAccessKeyId ||
    !env.credentialObjectStorageSecretAccessKey
  ) {
    throw new Error("Credential object storage is not fully configured");
  }
}

function getS3Client() {
  ensureRemoteStorageConfigured();
  if (objectStorageClient) {
    return objectStorageClient;
  }

  objectStorageClient = new S3Client({
    region: env.credentialObjectStorageRegion,
    endpoint: env.credentialObjectStorageEndpoint ?? undefined,
    forcePathStyle: env.credentialObjectStorageForcePathStyle,
    credentials: {
      accessKeyId: env.credentialObjectStorageAccessKeyId as string,
      secretAccessKey: env.credentialObjectStorageSecretAccessKey as string,
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

export async function putCredentialObject(objectKey: string, body: Buffer, contentType: string) {
  if (env.credentialObjectStorageDriver === "local") {
    const absolutePath = path.join(getStorageRoot(), ...objectKey.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return { objectKey };
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.credentialObjectStorageBucket as string,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { objectKey };
}

export async function readCredentialObject(objectKey: string) {
  if (env.credentialObjectStorageDriver === "local") {
    const absolutePath = path.join(getStorageRoot(), ...objectKey.split("/"));
    return readFile(absolutePath);
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.credentialObjectStorageBucket as string,
      Key: objectKey,
    }),
  );
  return toBuffer(response.Body);
}

export async function deleteCredentialObject(objectKey: string) {
  if (!objectKey) {
    return;
  }

  if (env.credentialObjectStorageDriver === "local") {
    const absolutePath = path.join(getStorageRoot(), ...objectKey.split("/"));
    await unlink(absolutePath).catch(() => undefined);
    return;
  }

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.credentialObjectStorageBucket as string,
      Key: objectKey,
    }),
  );
}
