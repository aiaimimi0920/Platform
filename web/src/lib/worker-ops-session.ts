import crypto from "node:crypto";

export type WorkerOpsSessionFocus =
  | "archive-digest-queue"
  | "archive-failing-presets"
  | "archive-subscriptions"
  | "archive-cleanup-alert";

export type WorkerOpsSessionActionIntent =
  | "retry-digests"
  | "dismiss-digests"
  | "retry-archives"
  | "create-subscription"
  | "acknowledge-cleanup";

export type WorkerOpsSessionDigestStatus = "pending" | "flushed" | "dismissed" | "all";

export type WorkerOpsSessionPresetMode = "all" | "retryDue";

export type WorkerOpsSessionSubscriptionMode = "all" | "missing";

export type WorkerOpsSessionEventName =
  | "discountCodeHistory.archiveFailed"
  | "discountCodeHistory.archiveCleanupFailed";

export type WorkerOpsSessionDeliveryMode = "immediate" | "digest";

export type WorkerOpsSessionPayload = {
  focus: WorkerOpsSessionFocus;
  source: string | null;
  runWindow: string | null;
  actionIntent: WorkerOpsSessionActionIntent | null;
  playbookId?: string | null;
  playbookRunId?: string | null;
  reopenedFromRunId?: string | null;
  digestIds: string[];
  digestStatus: WorkerOpsSessionDigestStatus | null;
  digestEventName: WorkerOpsSessionEventName | null;
  presetMode: WorkerOpsSessionPresetMode | null;
  subscriptionMode: WorkerOpsSessionSubscriptionMode | null;
  subscriptionEventName: WorkerOpsSessionEventName | null;
  subscriptionDeliveryMode: WorkerOpsSessionDeliveryMode | null;
};

export type WorkerOpsRecentSessionEntry = {
  id: string;
  createdAt: string;
  payload: WorkerOpsSessionPayload;
};

type EncodedWorkerOpsSessionEnvelope = {
  v: 1;
  exp: number;
  kind: "workerOpsSession";
  payload: WorkerOpsSessionPayload;
};

type EncodedWorkerOpsRecentSessionsEnvelope = {
  v: 1;
  exp: number;
  kind: "workerOpsRecentSessions";
  payload: {
    sessions: WorkerOpsRecentSessionEntry[];
  };
};

const workerOpsSessionTtlSeconds = 30 * 60;
const workerOpsRecentSessionsTtlSeconds = 12 * 60 * 60;
const workerOpsRecentSessionsMaxEntries = 6;

export const WORKER_OPS_SESSION_COOKIE = "np_worker_ops_session";
export const WORKER_OPS_RECENT_SESSIONS_COOKIE = "np_worker_ops_recent_sessions";

function getWorkerOpsSessionSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.OAUTH_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET or OAUTH_CLIENT_SECRET for worker ops session tokens");
  }
  return secret;
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getWorkerOpsSessionSecret()).update(encodedPayload).digest("base64url");
}

function normalizeFocus(value: unknown): WorkerOpsSessionFocus | null {
  if (
    value === "archive-digest-queue" ||
    value === "archive-failing-presets" ||
    value === "archive-subscriptions" ||
    value === "archive-cleanup-alert"
  ) {
    return value;
  }
  return null;
}

function normalizeActionIntent(value: unknown): WorkerOpsSessionActionIntent | null {
  if (
    value === "retry-digests" ||
    value === "dismiss-digests" ||
    value === "retry-archives" ||
    value === "create-subscription" ||
    value === "acknowledge-cleanup"
  ) {
    return value;
  }
  return null;
}

function normalizeDigestStatus(value: unknown): WorkerOpsSessionDigestStatus | null {
  if (value === "pending" || value === "flushed" || value === "dismissed" || value === "all") {
    return value;
  }
  return null;
}

function normalizePresetMode(value: unknown): WorkerOpsSessionPresetMode | null {
  if (value === "all" || value === "retryDue") {
    return value;
  }
  return null;
}

function normalizeSubscriptionMode(value: unknown): WorkerOpsSessionSubscriptionMode | null {
  if (value === "all" || value === "missing") {
    return value;
  }
  return null;
}

function normalizeEventName(value: unknown): WorkerOpsSessionEventName | null {
  if (value === "discountCodeHistory.archiveFailed" || value === "discountCodeHistory.archiveCleanupFailed") {
    return value;
  }
  return null;
}

function normalizeDeliveryMode(value: unknown): WorkerOpsSessionDeliveryMode | null {
  if (value === "immediate" || value === "digest") {
    return value;
  }
  return null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function normalizeOptionalId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 160) : null;
}

function normalizeDigestIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, 24);
}

function normalizeWorkerOpsSessionPayload(payload: Partial<WorkerOpsSessionPayload>) {
  const focus = normalizeFocus(payload.focus);
  if (!focus) {
    return null;
  }

  return {
    focus,
    source: normalizeOptionalString(payload.source),
    runWindow: normalizeOptionalString(payload.runWindow),
    actionIntent: normalizeActionIntent(payload.actionIntent),
    playbookId: normalizeOptionalId(payload.playbookId),
    playbookRunId: normalizeOptionalId(payload.playbookRunId),
    reopenedFromRunId: normalizeOptionalId(payload.reopenedFromRunId),
    digestIds: normalizeDigestIds(payload.digestIds),
    digestStatus: normalizeDigestStatus(payload.digestStatus),
    digestEventName: normalizeEventName(payload.digestEventName),
    presetMode: normalizePresetMode(payload.presetMode),
    subscriptionMode: normalizeSubscriptionMode(payload.subscriptionMode),
    subscriptionEventName: normalizeEventName(payload.subscriptionEventName),
    subscriptionDeliveryMode: normalizeDeliveryMode(payload.subscriptionDeliveryMode),
  } satisfies WorkerOpsSessionPayload;
}

function normalizeRecentSessionEntry(entry: unknown) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const candidate = entry as Partial<WorkerOpsRecentSessionEntry>;
  if (typeof candidate.id !== "string" || typeof candidate.createdAt !== "string" || !candidate.payload) {
    return null;
  }

  const payload = normalizeWorkerOpsSessionPayload(candidate.payload as Partial<WorkerOpsSessionPayload>);
  if (!payload) {
    return null;
  }

  return {
    id: candidate.id,
    createdAt: candidate.createdAt,
    payload,
  } satisfies WorkerOpsRecentSessionEntry;
}

export async function createWorkerOpsSession(payload: WorkerOpsSessionPayload) {
  const envelope: EncodedWorkerOpsSessionEnvelope = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + workerOpsSessionTtlSeconds,
    kind: "workerOpsSession",
    payload,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(envelope));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function consumeWorkerOpsSession(token: string) {
  const [encodedPayload, providedSignature] = token.split(".", 2);
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<EncodedWorkerOpsSessionEnvelope>;
    if (
      envelope.v !== 1 ||
      typeof envelope.exp !== "number" ||
      envelope.kind !== "workerOpsSession" ||
      !envelope.payload
    ) {
      return null;
    }

    if (envelope.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return normalizeWorkerOpsSessionPayload(envelope.payload as Partial<WorkerOpsSessionPayload>);
  } catch {
    return null;
  }
}

export function getWorkerOpsSessionMaxAgeSeconds() {
  return workerOpsSessionTtlSeconds;
}

export async function createWorkerOpsRecentSessionsToken(sessions: WorkerOpsRecentSessionEntry[]) {
  const envelope: EncodedWorkerOpsRecentSessionsEnvelope = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + workerOpsRecentSessionsTtlSeconds,
    kind: "workerOpsRecentSessions",
    payload: {
      sessions: sessions.slice(0, workerOpsRecentSessionsMaxEntries),
    },
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(envelope));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function consumeWorkerOpsRecentSessionsToken(token: string) {
  const [encodedPayload, providedSignature] = token.split(".", 2);
  if (!encodedPayload || !providedSignature) {
    return [];
  }

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return [];
  }

  try {
    const envelope = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<EncodedWorkerOpsRecentSessionsEnvelope>;
    if (
      envelope.v !== 1 ||
      typeof envelope.exp !== "number" ||
      envelope.kind !== "workerOpsRecentSessions" ||
      !envelope.payload ||
      !Array.isArray(envelope.payload.sessions)
    ) {
      return [];
    }

    if (envelope.exp <= Math.floor(Date.now() / 1000)) {
      return [];
    }

    const normalizedEntries: WorkerOpsRecentSessionEntry[] = [];
    for (const entry of envelope.payload.sessions) {
      const normalizedEntry = normalizeRecentSessionEntry(entry);
      if (normalizedEntry) {
        normalizedEntries.push(normalizedEntry);
      }
      if (normalizedEntries.length >= workerOpsRecentSessionsMaxEntries) {
        break;
      }
    }
    return normalizedEntries;
  } catch {
    return [];
  }
}

export function rememberWorkerOpsRecentSession(
  sessions: WorkerOpsRecentSessionEntry[],
  payload: WorkerOpsSessionPayload,
  reusedId?: string | null,
) {
  const sessionFingerprint = JSON.stringify(payload);
  const existing = sessions.filter((entry) => entry.id !== reusedId);
  const deduped = existing.filter((entry) => JSON.stringify(entry.payload) !== sessionFingerprint);
  const nextEntry: WorkerOpsRecentSessionEntry = {
    id: reusedId || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };
  return [nextEntry, ...deduped].slice(0, workerOpsRecentSessionsMaxEntries);
}

export function getWorkerOpsRecentSessionsMaxAgeSeconds() {
  return workerOpsRecentSessionsTtlSeconds;
}
