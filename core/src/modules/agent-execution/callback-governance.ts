import type {
  AgentExecutionArtifactKind,
  AgentExecutionStoredReplayPayloadCompatibility,
  AgentExecutionStatus,
} from "@neuro/contracts";

type ExternalCallbackGovernanceAgent = {
  externalCallbackProtocolVersion: number;
  externalCallbackPreviousProtocolVersion: number | null;
  externalCallbackProtocolGraceUntil: Date | null;
  externalCallbackSecretVersion: number;
  externalCallbackPreviousSecretVersion: number | null;
  externalCallbackSecretGraceUntil: Date | null;
  externalCallbackSecret: string | null;
  externalCallbackPreviousSecret: string | null;
};

export type StoredExternalCallbackReplayEnvelope =
  | {
      type: "heartbeat";
      statusNote: string | null;
    }
  | {
      type: "status";
      status: AgentExecutionStatus;
      statusNote: string | null;
      resultSummary: string | null;
    }
  | {
      type: "artifact";
      artifact: {
        kind: AgentExecutionArtifactKind;
        title: string;
        url: string | null;
        summary: string | null;
      };
    };

export type StoredExternalCallbackReplayEnvelopeResolution = {
  envelope: StoredExternalCallbackReplayEnvelope | null;
  stored: boolean;
  replayable: boolean;
  compatibility: AgentExecutionStoredReplayPayloadCompatibility | null;
  schemaVersion: number | null;
};

const currentStoredExternalCallbackReplayEnvelopeSchemaVersion = 1;

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}

export function buildExternalCallbackSignatureMessage(args: {
  executionId: string;
  callbackId: string;
  timestamp: number;
  payload: unknown;
}) {
  const canonicalPayload = stableStringify(args.payload);
  return [args.executionId, args.callbackId, String(args.timestamp), canonicalPayload].join(".");
}

export function summarizeExternalCallbackPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "callback";
  }

  if ("type" in (payload as Record<string, unknown>)) {
    const type = String((payload as Record<string, unknown>).type);
    if (type === "artifact") {
      const artifact = (payload as { artifact?: { kind?: unknown; title?: unknown } }).artifact;
      return artifact ? `artifact:${String(artifact.kind ?? "unknown")}:${String(artifact.title ?? "")}` : "artifact";
    }
    if (type === "status") {
      return `status:${String((payload as { status?: unknown }).status ?? "unknown")}`;
    }
    if (type === "heartbeat") {
      return "heartbeat";
    }
    return type;
  }

  if ("status" in (payload as Record<string, unknown>)) {
    return `status:${String((payload as { status?: unknown }).status ?? "unknown")}`;
  }

  if ("kind" in (payload as Record<string, unknown>)) {
    return `artifact:${String((payload as { kind?: unknown }).kind ?? "unknown")}`;
  }

  return "callback";
}

export function classifyExternalCallbackRejection(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("secret")) {
    return "invalid_secret" as const;
  }
  if (normalized.includes("signature")) {
    return "invalid_signature" as const;
  }
  if (normalized.includes("timestamp") || normalized.includes("skew")) {
    return "invalid_timestamp" as const;
  }
  if (normalized.includes("version")) {
    return "invalid_version" as const;
  }
  if (normalized.includes("already being processed") || normalized.includes("conflict")) {
    return "processing_conflict" as const;
  }
  if (normalized.includes("not found") || normalized.includes("disabled") || normalized.includes("only external")) {
    return "unsupported_target" as const;
  }
  if (normalized.includes("invalid") || normalized.includes("bad request") || normalized.includes("payload")) {
    return "invalid_payload" as const;
  }
  return "unknown" as const;
}

export function getExternalCallbackRetryGuidance(
  rejectionCategory:
    | "invalid_secret"
    | "invalid_signature"
    | "invalid_timestamp"
    | "invalid_version"
    | "invalid_payload"
    | "processing_conflict"
    | "unsupported_target"
    | "unknown"
    | null,
) {
  switch (rejectionCategory) {
    case "invalid_timestamp":
      return {
        retryability: "retryable" as const,
        retryHint: "请使用新的时间戳重新签名并重试，同时确认外部运行时与平台时钟同步。",
      };
    case "processing_conflict":
      return {
        retryability: "retryable" as const,
        retryHint: "该回调当前正在被处理，请等待幂等窗口结束后重试同一 payload。",
      };
    case "invalid_version":
      return {
        retryability: "inspect" as const,
        retryHint: "回调版本与平台配置不一致，请核对当前协议版本与 grace window 后再重试。",
      };
    case "invalid_secret":
    case "invalid_signature":
      return {
        retryability: "inspect" as const,
        retryHint: "请核对 callback secret、签名串拼接和密钥轮换进度，再决定是否重试。",
      };
    case "invalid_payload":
    case "unsupported_target":
      return {
        retryability: "not_retryable" as const,
        retryHint: "当前 payload 或目标 execution 不可接受，应修正请求内容而不是直接重试。",
      };
    case "unknown":
      return {
        retryability: "inspect" as const,
        retryHint: "拒绝原因未被明确分类，请先检查审计详情和服务端日志。",
      };
    default:
      return {
        retryability: null,
        retryHint: null,
      };
  }
}

export function getRejectionCategoriesForRetryability(
  retryability: "retryable" | "inspect" | "not_retryable",
) {
  const categories = [
    "invalid_secret",
    "invalid_signature",
    "invalid_timestamp",
    "invalid_version",
    "invalid_payload",
    "processing_conflict",
    "unsupported_target",
    "unknown",
  ] as const;

  return categories.filter((category) => getExternalCallbackRetryGuidance(category).retryability === retryability);
}

export function buildStoredExternalCallbackReplayEnvelope(input: unknown): StoredExternalCallbackReplayEnvelope | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  if ("type" in candidate) {
    if (candidate.type === "heartbeat") {
      return {
        type: "heartbeat",
        statusNote: typeof candidate.statusNote === "string" && candidate.statusNote.trim().length > 0
          ? candidate.statusNote.trim()
          : null,
      };
    }

    if (candidate.type === "status") {
      const status = candidate.status;
      if (
        status !== "queued" &&
        status !== "running" &&
        status !== "submitted" &&
        status !== "completed" &&
        status !== "failed" &&
        status !== "cancelled"
      ) {
        return null;
      }

      return {
        type: "status",
        status,
        statusNote: typeof candidate.statusNote === "string" && candidate.statusNote.trim().length > 0
          ? candidate.statusNote.trim()
          : null,
        resultSummary:
          typeof candidate.resultSummary === "string" && candidate.resultSummary.trim().length > 0
            ? candidate.resultSummary.trim()
            : null,
      };
    }

    if (candidate.type === "artifact" && candidate.artifact && typeof candidate.artifact === "object") {
      const artifact = candidate.artifact as Record<string, unknown>;
      if (
        (artifact.kind !== "link" && artifact.kind !== "note") ||
        typeof artifact.title !== "string" ||
        artifact.title.trim().length < 3
      ) {
        return null;
      }

      return {
        type: "artifact",
        artifact: {
          kind: artifact.kind,
          title: artifact.title.trim(),
          url: typeof artifact.url === "string" && artifact.url.trim().length > 0 ? artifact.url.trim() : null,
          summary:
            typeof artifact.summary === "string" && artifact.summary.trim().length > 0
              ? artifact.summary.trim()
              : null,
        },
      };
    }

    return null;
  }

  const artifactInput = input as Record<string, unknown>;
  if (
    (artifactInput.kind !== "link" && artifactInput.kind !== "note") ||
    typeof artifactInput.title !== "string" ||
    artifactInput.title.trim().length < 3
  ) {
    return null;
  }

  return {
    type: "artifact",
    artifact: {
      kind: artifactInput.kind,
      title: artifactInput.title.trim(),
      url:
        typeof artifactInput.url === "string" && artifactInput.url.trim().length > 0
          ? artifactInput.url.trim()
          : null,
      summary:
        typeof artifactInput.summary === "string" && artifactInput.summary.trim().length > 0
          ? artifactInput.summary.trim()
          : null,
    },
  };
}

export function normalizeStoredExternalCallbackReplayEnvelope(
  payload: unknown,
): StoredExternalCallbackReplayEnvelope | null {
  return resolveStoredExternalCallbackReplayEnvelope(payload).envelope;
}

export function resolveStoredExternalCallbackReplayEnvelope(
  payload: unknown,
): StoredExternalCallbackReplayEnvelopeResolution {
  if (payload === null || payload === undefined) {
    return {
      envelope: null,
      stored: false,
      replayable: false,
      compatibility: null,
      schemaVersion: null,
    };
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    if (
      candidate.type === "heartbeat" ||
      candidate.type === "status" ||
      (candidate.type === "artifact" && candidate.artifact && typeof candidate.artifact === "object")
    ) {
      const envelope = buildStoredExternalCallbackReplayEnvelope(candidate);
      return {
        envelope,
        stored: true,
        replayable: Boolean(envelope),
        compatibility: envelope ? "current" : "invalid",
        schemaVersion: envelope ? currentStoredExternalCallbackReplayEnvelopeSchemaVersion : null,
      };
    }
  }

  const legacyEnvelope = buildStoredExternalCallbackReplayEnvelope(payload);
  if (legacyEnvelope) {
    return {
      envelope: legacyEnvelope,
      stored: true,
      replayable: true,
      compatibility: "legacy_normalized",
      schemaVersion: 0,
    };
  }

  return {
    envelope: null,
    stored: true,
    replayable: false,
    compatibility: "invalid",
    schemaVersion: null,
  };
}

export function resolveExternalCallbackMatch(
  agent: ExternalCallbackGovernanceAgent,
  args: {
    callbackSecret: string;
    callbackVersion: number;
    now: Date;
  },
): {
  matchedProtocolVersion: number;
  matchedSecretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
} | null {
  const protocolGraceUntil = agent.externalCallbackProtocolGraceUntil;
  const matchesCurrentProtocol = agent.externalCallbackProtocolVersion === args.callbackVersion;
  const matchesPreviousProtocol =
    agent.externalCallbackPreviousProtocolVersion === args.callbackVersion &&
    protocolGraceUntil !== null &&
    protocolGraceUntil.getTime() >= args.now.getTime();

  const secretGraceUntil = agent.externalCallbackSecretGraceUntil;
  const matchesCurrentSecret =
    Boolean(agent.externalCallbackSecret) && agent.externalCallbackSecret === args.callbackSecret;
  const matchesPreviousSecret =
    Boolean(agent.externalCallbackPreviousSecret) &&
    agent.externalCallbackPreviousSecret === args.callbackSecret &&
    secretGraceUntil !== null &&
    secretGraceUntil.getTime() >= args.now.getTime();

  if ((!matchesCurrentProtocol && !matchesPreviousProtocol) || (!matchesCurrentSecret && !matchesPreviousSecret)) {
    return null;
  }

  return {
    matchedProtocolVersion: matchesCurrentProtocol
      ? agent.externalCallbackProtocolVersion
      : agent.externalCallbackPreviousProtocolVersion ?? agent.externalCallbackProtocolVersion,
    usedPreviousProtocol: !matchesCurrentProtocol,
    matchedSecretVersion: matchesCurrentSecret
      ? agent.externalCallbackSecretVersion
      : agent.externalCallbackPreviousSecretVersion ?? agent.externalCallbackSecretVersion,
    usedPreviousSecret: !matchesCurrentSecret,
  };
}

export function resolveExternalCallbackCompatibility(
  agent: ExternalCallbackGovernanceAgent,
  args: {
    callbackSecret?: string | null;
    callbackVersion?: number | null;
    now: Date;
  },
) {
  const protocolGraceUntil = agent.externalCallbackProtocolGraceUntil;
  const secretGraceUntil = agent.externalCallbackSecretGraceUntil;

  const matchesCurrentProtocol =
    typeof args.callbackVersion === "number" && agent.externalCallbackProtocolVersion === args.callbackVersion;
  const matchesPreviousProtocol =
    typeof args.callbackVersion === "number" &&
    agent.externalCallbackPreviousProtocolVersion === args.callbackVersion &&
    protocolGraceUntil !== null &&
    protocolGraceUntil.getTime() >= args.now.getTime();

  const matchesCurrentSecret =
    Boolean(args.callbackSecret) &&
    Boolean(agent.externalCallbackSecret) &&
    agent.externalCallbackSecret === args.callbackSecret;
  const matchesPreviousSecret =
    Boolean(args.callbackSecret) &&
    Boolean(agent.externalCallbackPreviousSecret) &&
    agent.externalCallbackPreviousSecret === args.callbackSecret &&
    secretGraceUntil !== null &&
    secretGraceUntil.getTime() >= args.now.getTime();

  return {
    usedPreviousProtocol: matchesPreviousProtocol && !matchesCurrentProtocol,
    usedPreviousSecret: matchesPreviousSecret && !matchesCurrentSecret,
    matchedProtocolVersion: matchesCurrentProtocol
      ? agent.externalCallbackProtocolVersion
      : matchesPreviousProtocol
        ? agent.externalCallbackPreviousProtocolVersion
        : null,
    matchedSecretVersion: matchesCurrentSecret
      ? agent.externalCallbackSecretVersion
      : matchesPreviousSecret
        ? agent.externalCallbackPreviousSecretVersion
        : null,
  };
}
