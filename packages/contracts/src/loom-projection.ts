import type { LoomAccountProof } from "./loom-account";

// Central metadata only. PNG content travels between authenticated Loom peers.
export interface LoomProjectionProof extends LoomAccountProof {
  payload: string;
}

export interface LoomProjectionEnvelope {
  protocol: "neuro.qr-projection.v2";
  projectionId: string;
  serverOrigin: string;
  source: {
    deviceId: string;
    accountId: string;
    publicKey: string;
    sessionId: string;
    unitId: string;
    revision: number;
  };
  content: { kind: "sticker" | "art"; digest: string };
  expiresAtMs: number;
  nonce: string;
  signature: { algorithm: "ed25519"; keyId: string; value: string };
}

export interface LoomProjectionImageMetadata {
  revision: number;
  digest: string;
  width: number;
  height: number;
  byteLength: number;
}

export interface LoomProjectionEndpoint {
  endpointId: string;
  addresses: { ip: string; port: number }[];
  relayUrl: string | null;
}

export interface LoomProjectionPolicy {
  protocol: "neuro.qr-projection.v2";
  serverOrigin: string;
  relayUrls: string[];
  syncIntervalMs: number;
  authorizationLeaseMs: number;
  presenceTtlMs: number;
  maxRecords: number;
}

export interface LoomProjectionRecord extends LoomProjectionImageMetadata {
  envelope: LoomProjectionEnvelope;
  initialImage: { width: number; height: number; byteLength: number };
  status: "invited" | "linked" | "stopped";
  receiver: { deviceId: string; unitId: string; revision: number; digest: string } | null;
  expiresAtMs: number;
  updatedAtMs: number;
}

export interface LoomProjectionPeer {
  deviceId: string;
  publicKey: string;
  deviceName: string;
  endpoint: LoomProjectionEndpoint | null;
}

export interface LoomProjectionView {
  record: LoomProjectionRecord;
  available: boolean;
  authorizedUntilMs: number;
  peer: LoomProjectionPeer | null;
}

export type LoomProjectionOperation =
  | { kind: "configuration" }
  | { kind: "create"; envelope: LoomProjectionEnvelope; width: number; height: number; byteLength: number }
  | { kind: "inspect"; envelope: LoomProjectionEnvelope }
  | { kind: "accept"; envelope: LoomProjectionEnvelope; receiverUnitId: string; expectedRevision: number; expectedDigest: string; confirmed: true }
  | ({ kind: "publish"; projectionId: string; sourceSessionId: string; priorRevision: number } & LoomProjectionImageMetadata)
  | { kind: "read" | "unlink"; projectionId: string }
  | { kind: "sync"; endpoint: LoomProjectionEndpoint }
  | { kind: "peer"; projectionId: string; peerDeviceId: string; peerPublicKey: string; envelope?: LoomProjectionEnvelope };

export type LoomProjectionResult =
  | { kind: "configuration"; policy: LoomProjectionPolicy }
  | { kind: "projection"; view: LoomProjectionView }
  | { kind: "sync"; views: LoomProjectionView[] }
  | { kind: "peer"; peer: LoomProjectionPeer; authorizedUntilMs: number };
