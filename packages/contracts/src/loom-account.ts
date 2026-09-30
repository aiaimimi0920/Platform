// Platform account authorization for the Loom runtime, separate from Hook pairing.
export interface LoomAccountGrant {
  protocol: "neuro.loom-account.v1";
  requestId: string;
  codeChallenge: string;
  publicKey: string;
  deviceName: string;
  expiresAtMs: number;
}

export interface LoomAccountExchange {
  requestId: string;
  codeVerifier: string;
  signature: string;
}

export interface LoomAccountProof {
  deviceId: string;
  timestampMs: number;
  nonce: string;
  signature: string;
}

export interface LoomAccountSession {
  protocol: "neuro.loom-account.v1";
  deviceId: string;
  accountId: string;
  username: string;
  deviceName: string;
  publicKey: string;
  expiresAtMs: number;
}

export type LoomAccountExchangeResult =
  | { status: "pending" }
  | { status: "signed_in"; session: LoomAccountSession };
