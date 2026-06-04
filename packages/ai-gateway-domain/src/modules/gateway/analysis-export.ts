import type {
  GatewayAnalysisExportFileView,
  GatewayAnalysisExportFilterView,
  GatewayAnalysisExportManifest,
  GatewayAnalysisExportMessageView,
  GatewayAnalysisExportRowView,
  GatewayAnalysisSampleView,
  GatewayAnalysisExportTextMode,
  GatewayStoredRequestArtifact,
  GatewayStoredResponseArtifact,
} from "@neuro/contracts";
import { createHash } from "node:crypto";

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function truncateText(text: string, maxTextChars: number) {
  if (text.length <= maxTextChars) {
    return {
      text,
      truncated: false,
    };
  }
  return {
    text: text.slice(0, Math.max(0, maxTextChars)),
    truncated: true,
  };
}

export function redactSensitiveText(text: string) {
  let result = text;
  result = result.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
  result = result.replace(/\b(new_api_[A-Za-z0-9._-]+)\b/g, "[REDACTED_API_KEY]");
  result = result.replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_SECRET]");
  result = result.replace(/\b(Bearer)\s+[A-Za-z0-9._=-]{12,}\b/gi, "$1 [REDACTED_TOKEN]");
  result = result.replace(
    /([?&](?:token|key|auth|signature|sig|password)=)[^&\s]+/gi,
    "$1[REDACTED]",
  );
  result = result.replace(/\b(?:token|secret|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, (match) => {
    const separatorIndex = Math.max(match.indexOf(":"), match.indexOf("="));
    if (separatorIndex < 0) {
      return "[REDACTED_SECRET_FIELD]";
    }
    return `${match.slice(0, separatorIndex + 1)} [REDACTED]`;
  });
  return result;
}

function coerceTextFromPart(part: unknown) {
  if (!part || typeof part !== "object") {
    return "";
  }
  const record = part as Record<string, unknown>;
  if (typeof record.text === "string") {
    return record.text;
  }
  if (typeof record.value === "string") {
    return record.value;
  }
  if (typeof record.imageUrl === "string") {
    return `[image] ${record.imageUrl}`;
  }
  if (typeof record.image_url === "string") {
    return `[image] ${record.image_url}`;
  }
  if (record.image_url && typeof record.image_url === "object") {
    const image = record.image_url as Record<string, unknown>;
    if (typeof image.url === "string") {
      return `[image] ${image.url}`;
    }
  }
  if (record.type === "json" || record.type === "raw") {
    try {
      return JSON.stringify(record.value ?? record);
    } catch {
      return "";
    }
  }
  return "";
}

function coerceMessageText(message: unknown) {
  if (!message || typeof message !== "object") {
    return "";
  }
  const record = message as Record<string, unknown>;
  const content = Array.isArray(record.content) ? record.content : [];
  return content.map(coerceTextFromPart).filter((item) => item.trim().length > 0).join("\n");
}

function coerceMessageExport(message: unknown): GatewayAnalysisExportMessageView | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const record = message as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role.trim() : "";
  if (role !== "system" && role !== "user" && role !== "assistant" && role !== "tool") {
    return null;
  }
  const toolCalls = Array.isArray(record.toolCalls)
    ? record.toolCalls
    : Array.isArray(record.tool_calls)
      ? record.tool_calls
      : [];
  return {
    role,
    name: typeof record.name === "string" ? record.name : null,
    toolCallId:
      typeof record.toolCallId === "string"
        ? record.toolCallId
        : typeof record.tool_call_id === "string"
          ? record.tool_call_id
          : null,
    text: coerceMessageText(record),
    toolCallCount: toolCalls.length,
  };
}

function coerceRequestToolNames(artifact: GatewayStoredRequestArtifact | null) {
  const tools = Array.isArray(artifact?.canonicalRequest.tools) ? artifact.canonicalRequest.tools : [];
  return Array.from(
    new Set(
      tools
        .map((tool) => {
          if (!tool || typeof tool !== "object") {
            return "";
          }
          const record = tool as Record<string, unknown>;
          return typeof record.name === "string" ? record.name.trim() : "";
        })
        .filter((name) => name.length > 0),
    ),
  );
}

function coerceResponseToolNames(artifact: GatewayStoredResponseArtifact | null) {
  const toolCalls = Array.isArray(artifact?.result.toolCalls) ? artifact.result.toolCalls : [];
  return Array.from(
    new Set(
      toolCalls
        .map((toolCall) => {
          if (!toolCall || typeof toolCall !== "object") {
            return "";
          }
          const record = toolCall as Record<string, unknown>;
          return typeof record.name === "string" ? record.name.trim() : "";
        })
        .filter((name) => name.length > 0),
    ),
  );
}

function applyTextMode(text: string, textMode: GatewayAnalysisExportTextMode, maxTextChars: number) {
  const normalized = normalizeText(text);
  if (!normalized || textMode === "none") {
    return {
      text: null,
      truncated: false,
    };
  }

  const candidate = textMode === "preview_redacted" ? redactSensitiveText(normalized) : normalized;
  const truncated = truncateText(candidate, maxTextChars);
  return {
    text: truncated.text,
    truncated: truncated.truncated,
  };
}

export function buildGatewayAnalysisExportRow(args: {
  sample: GatewayAnalysisSampleView;
  requestArtifact: GatewayStoredRequestArtifact | null;
  responseArtifact: GatewayStoredResponseArtifact | null;
  textMode: GatewayAnalysisExportTextMode;
  maxTextChars: number;
}): GatewayAnalysisExportRowView {
  const requestMessages = Array.isArray(args.requestArtifact?.canonicalRequest.messages)
    ? args.requestArtifact.canonicalRequest.messages
        .map(coerceMessageExport)
        .filter((message): message is GatewayAnalysisExportMessageView => Boolean(message))
    : [];
  const requestTextSource = requestMessages.map((message) => message.text).filter((item) => item.trim().length > 0).join("\n\n");
  const responseTextSource = normalizeText(args.responseArtifact?.result.text ?? "");
  const requestText = applyTextMode(requestTextSource, args.textMode, args.maxTextChars);
  const responseText = applyTextMode(responseTextSource, args.textMode, args.maxTextChars);

  return {
    requestAuditId: args.sample.requestAuditId,
    responseId: args.sample.responseId,
    projectId: args.sample.projectId,
    sessionId: args.sample.sessionId,
    providerAccountId: args.sample.providerAccountId,
    protocolFamily: args.sample.protocolFamily,
    endpointKind: args.sample.endpointKind,
    requestedModel: args.sample.requestedModel,
    resolvedModel: args.sample.resolvedModel,
    status: args.sample.status,
    stream: args.sample.stream,
    createdAt: args.sample.createdAt,
    completedAt: args.sample.completedAt,
    promptTokens: args.sample.promptTokens,
    completionTokens: args.sample.completionTokens,
    totalTokens: args.sample.totalTokens,
    requestArtifactAvailable: Boolean(args.sample.requestArtifactObjectKey),
    responseArtifactAvailable: Boolean(args.sample.responseArtifactObjectKey),
    analysisProfile: args.sample.analysisProfile,
    routeTrace: args.sample.routeTrace,
    requestText: requestText.text,
    responseText: responseText.text,
    requestTextTruncated: requestText.truncated,
    responseTextTruncated: responseText.truncated,
    requestMessages,
    requestToolNames: coerceRequestToolNames(args.requestArtifact),
    responseToolNames: coerceResponseToolNames(args.responseArtifact),
  };
}

export function buildGatewayAnalysisDatasetJsonl(rows: GatewayAnalysisExportRowView[]) {
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  return Buffer.from(body.length > 0 ? `${body}\n` : "", "utf8");
}

export function buildGatewayAnalysisExportFileView(args: {
  kind: GatewayAnalysisExportFileView["kind"];
  objectKey: string;
  contentType: string;
  body: Buffer;
  lineCount: number | null;
}): GatewayAnalysisExportFileView {
  return {
    kind: args.kind,
    objectKey: args.objectKey,
    contentType: args.contentType,
    sizeBytes: args.body.byteLength,
    sha256: sha256Buffer(args.body),
    lineCount: args.lineCount,
  };
}

export function buildGatewayAnalysisExportManifest(args: {
  exportId: string;
  label: string | null;
  tags?: string[];
  createdAt: string;
  retentionExpiresAt?: string | null;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  files: GatewayAnalysisExportFileView[];
}): GatewayAnalysisExportManifest {
  return {
    schemaVersion: 1,
    exportId: args.exportId,
    label: args.label,
    tags: args.tags ?? [],
    createdAt: args.createdAt,
    retentionExpiresAt: args.retentionExpiresAt ?? null,
    filters: args.filters,
    sampleCount: args.sampleCount,
    requestArtifactCount: args.requestArtifactCount,
    responseArtifactCount: args.responseArtifactCount,
    files: args.files,
  };
}
