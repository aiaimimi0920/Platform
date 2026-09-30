import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { z } from "zod";
import type { LoomAccountGrant, LoomAccountProof, LoomProjectionProof } from "@neuro/contracts";

export const PROTOCOL = "neuro.loom-account.v1" as const;
export const GRANT_TTL_MS = 10 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
export const PROOF_WINDOW_MS = 60_000;

const signature = z.string().regex(/^[A-Za-z0-9+/]{86}==$/);
export const grantSchema = z.object({
  protocol: z.literal(PROTOCOL),
  requestId: z.string().regex(/^[a-f0-9]{64}$/),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  publicKey: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  deviceName: z.string().trim().min(1).max(80).regex(/^[^\x00-\x1f\x7f]+$/),
  expiresAtMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const exchangeSchema = z.object({
  requestId: grantSchema.shape.requestId,
  codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  signature,
}).strict();
export const proofSchema = z.object({
  deviceId: z.string().uuid(),
  timestampMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
  signature,
}).strict();

export const projectionProofSchema = proofSchema.extend({
  payload: z.string().max(12 * 1024).refine((value) => Buffer.byteLength(value, "utf8") <= 12 * 1024),
});

export class LoomAccountError extends Error {
  constructor(readonly statusCode: number, readonly code: string) {
    super(code);
  }
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function publicKeyFor(encoded: string) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== encoded) {
    throw new LoomAccountError(400, "invalid_device_key");
  }
  return createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), bytes]),
    format: "der",
    type: "spki",
  });
}

export function verifySignature(key: string, message: string, encoded: string): void {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== 64 || bytes.toString("base64") !== encoded
      || !verify(null, Buffer.from(message, "utf8"), publicKeyFor(key), bytes)) {
    throw new LoomAccountError(401, "invalid_device_proof");
  }
}

export function exchangeMessage(grant: LoomAccountGrant, verifier: string): string {
  const actual = challengeFor(verifier);
  if (!timingSafeEqual(Buffer.from(actual), Buffer.from(grant.codeChallenge))) {
    throw new LoomAccountError(401, "invalid_code_verifier");
  }
  return `${PROTOCOL}\nexchange\n${grant.requestId}\n${grant.codeChallenge}`;
}

export function proofMessage(action: "status" | "revoke", proof: LoomAccountProof): string {
  return `${PROTOCOL}\n${action}\n${proof.deviceId}\n${proof.timestampMs}\n${proof.nonce}`;
}

export function projectionProofMessage(proof: LoomProjectionProof): string {
  const digest = createHash("sha256").update(proof.payload, "utf8").digest("hex");
  return `${PROTOCOL}\nprojection\n${proof.deviceId}\n${proof.timestampMs}\n${proof.nonce}\n${digest}`;
}
