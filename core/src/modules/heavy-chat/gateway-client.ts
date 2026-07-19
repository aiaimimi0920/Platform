import { randomUUID } from "node:crypto";

export type HeavyChatGatewayErrorCode =
  | "provider_rejected"
  | "provider_timeout"
  | "unavailable"
  | "protocol_error"
  | "correlation_mismatch";

export type HeavyChatGatewayMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type HeavyChatGatewayClientOptions = {
  baseUrl: string;
  managementToken: string;
  serviceId: string;
  serviceTitle?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: (input: string | URL, init?: RequestInit) => Promise<Response>;
};

export type HeavyChatGatewayCompletionInput = {
  ownerUserId: string;
  messages: HeavyChatGatewayMessage[];
  model?: string;
  requestId?: string;
  correlationId?: string;
  stream?: boolean;
  onChunk?: (delta: string) => Promise<void> | void;
};

export type HeavyChatGatewayCompletionResult = {
  content: string;
  requestId: string;
  statusCode: number;
  finishReason: string | null;
};

export class GatewayClientError extends Error {
  readonly code: HeavyChatGatewayErrorCode;
  readonly correlationId: string;
  readonly providerCode: string | null;
  readonly requestId: string;
  readonly responseRequestId: string | null;
  readonly statusCode: number | null;

  constructor(args: {
    code: HeavyChatGatewayErrorCode;
    message: string;
    correlationId: string;
    providerCode?: string | null;
    requestId: string;
    responseRequestId?: string | null;
    statusCode?: number | null;
  }) {
    super(args.message);
    this.name = "GatewayClientError";
    this.code = args.code;
    this.correlationId = args.correlationId;
    this.providerCode = args.providerCode ?? null;
    this.requestId = args.requestId;
    this.responseRequestId = args.responseRequestId ?? null;
    this.statusCode = args.statusCode ?? null;
  }
}

class GatewayDeadlineError extends Error {
  override name = "GatewayDeadlineError";
}

class GatewayBodyReadError extends Error {
  override name = "GatewayBodyReadError";
}

class GatewayProtocolBodyError extends Error {
  override name = "GatewayProtocolBodyError";
}

type ResponseTrace = {
  requestId: string | null;
  correlationId: string | null;
};

type ParsedResponse = {
  body: unknown;
  rawBody: string;
  parseError: boolean;
  responseRequestId: string | null;
  responseCorrelationId: string | null;
};

type GatewayDeadline = {
  signal: AbortSignal;
  timeoutError: GatewayDeadlineError;
  throwIfExpired(): void;
  dispose(): void;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) throw new TypeError("Gateway base URL is required");
  return normalized;
}

function requireToken(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}

function normalizeTimeout(value: number | undefined) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value < 1) throw new TypeError("Gateway timeout must be a positive number");
  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createDeadline(timeoutMs: number): GatewayDeadline {
  const controller = new AbortController();
  const timeoutError = new GatewayDeadlineError("Gateway request timed out");
  const timeoutHandle = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  return {
    signal: controller.signal,
    timeoutError,
    throwIfExpired() {
      if (controller.signal.aborted) throw timeoutError;
    },
    dispose() {
      clearTimeout(timeoutHandle);
    },
  };
}

function awaitWithDeadline<T>(
  operation: Promise<T>,
  deadline: GatewayDeadline,
  onLateValue?: (value: T) => void,
): Promise<T> {
  deadline.throwIfExpired();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => deadline.signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(deadline.timeoutError);
    };
    deadline.signal.addEventListener("abort", onAbort, { once: true });
    if (deadline.signal.aborted) onAbort();
    operation.then(
      (value) => {
        if (settled) {
          onLateValue?.(value);
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

async function readByteStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline: GatewayDeadline,
): Promise<{ done: boolean; value?: Uint8Array }> {
  try {
    const chunk = await awaitWithDeadline(reader.read(), deadline, () => {
      void reader.cancel(deadline.signal.reason).catch(() => undefined);
    });
    deadline.throwIfExpired();
    return { done: chunk.done, value: chunk.value };
  } catch (error) {
    if (error instanceof GatewayDeadlineError) throw error;
    throw new GatewayBodyReadError("Gateway response body could not be read");
  }
}

async function fetchWithDeadline(
  fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>,
  url: string,
  init: RequestInit,
  deadline: GatewayDeadline,
): Promise<Response> {
  deadline.throwIfExpired();
  let response: Response | undefined;
  try {
    response = await awaitWithDeadline<Response>(
      Promise.resolve().then(() => fetchFn(url, { ...init, signal: deadline.signal })),
      deadline,
      (lateResponse) => {
        if (lateResponse.body) void lateResponse.body.cancel().catch(() => undefined);
      },
    );
    deadline.throwIfExpired();
    return response;
  } catch (error) {
    if (deadline.signal.aborted) {
      if (response?.body) void response.body.cancel().catch(() => undefined);
      throw deadline.timeoutError;
    }
    throw error;
  }
}

async function readResponseText(response: Response, deadline: GatewayDeadline): Promise<string> {
  const body = response.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let completed = false;
  const cancelReader = () => {
    void reader.cancel(deadline.signal.reason).catch(() => undefined);
  };
  deadline.signal.addEventListener("abort", cancelReader, { once: true });
  try {
    while (true) {
      deadline.throwIfExpired();
      const chunk = await readByteStreamChunk(reader, deadline);
      if (chunk.done) {
        completed = true;
        break;
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    return raw;
  } finally {
    deadline.signal.removeEventListener("abort", cancelReader);
    if (!completed) await reader.cancel(deadline.signal.reason).catch(() => undefined);
    reader.releaseLock();
  }
}

function responseTrace(response: Response): ResponseTrace {
  return {
    requestId: response.headers.get("x-request-id")?.trim() || null,
    correlationId: response.headers.get("x-correlation-id")?.trim() || null,
  };
}

function redactSecrets(value: string, secrets: Array<string | null | undefined>) {
  let redacted = value;
  for (const secret of secrets) {
    const normalized = secret?.trim();
    if (normalized) redacted = redacted.split(normalized).join("[REDACTED]");
  }
  return redacted
    .replace(/(Bearer\s+)[^\s,;)}\]]+/gi, "$1[REDACTED]")
    .replace(/((?:token|api[-_ ]?key|authorization)\s*[=:]\s*)(?!Bearer\b)[^\s,;)}\]]+/gi, "$1[REDACTED]");
}

function providerErrorBody(body: unknown) {
  if (typeof body === "string") {
    return { providerCode: null, message: body.trim().slice(0, 2_000) || null };
  }
  if (!isRecord(body)) return { providerCode: null, message: null };
  const nested = isRecord(body.error) ? body.error : null;
  const rawCode = nested?.code ?? body.code;
  const rawMessage = nested?.message ?? body.message ?? (typeof body.error === "string" ? body.error : null);
  return {
    providerCode: typeof rawCode === "string" && rawCode.trim() ? rawCode.trim().slice(0, 200) : null,
    message: typeof rawMessage === "string" && rawMessage.trim() ? rawMessage.trim().slice(0, 2_000) : null,
  };
}

function extractFinishReason(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const reason = isRecord(body.choices[0]) ? body.choices[0].finish_reason : null;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function parseCompletionPayload(body: unknown): { content: string; finishReason: string | null } {
  if (!isRecord(body)) throw new GatewayProtocolBodyError("Gateway completion response was not an object");
  if ("error" in body) throw new GatewayProtocolBodyError("Gateway returned an error payload with a successful status");

  if ("output_text" in body) {
    if (typeof body.output_text !== "string" || !body.output_text.trim()) {
      throw new GatewayProtocolBodyError("Gateway completion response contained empty assistant content");
    }
    return { content: body.output_text, finishReason: extractFinishReason(body) };
  }

  if (!Array.isArray(body.choices) || body.choices.length === 0 || !isRecord(body.choices[0])) {
    throw new GatewayProtocolBodyError("Gateway completion response did not include choices");
  }
  const choice = body.choices[0];
  const message = isRecord(choice.message) ? choice.message : null;
  const content = message?.content ?? choice.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new GatewayProtocolBodyError("Gateway completion response contained empty assistant content");
  }
  return { content, finishReason: extractFinishReason(body) };
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof GatewayDeadlineError) return true;
  const name = error && typeof error === "object" && "name" in error ? (error as { name?: unknown }).name : null;
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    code === "ABORT_ERR" ||
    code === "UND_ERR_ABORTED" ||
    /(?:timed?\s*out|timeout)/i.test(message)
  );
}

function createError(args: {
  code: HeavyChatGatewayErrorCode;
  message: string;
  correlationId: string;
  requestId: string;
  responseRequestId?: string | null;
  statusCode?: number | null;
  providerCode?: string | null;
  secrets?: Array<string | null | undefined>;
}) {
  const secrets = args.secrets ?? [];
  return new GatewayClientError({
    code: args.code,
    message: redactSecrets(args.message, secrets),
    correlationId: args.correlationId,
    requestId: args.requestId,
    responseRequestId: args.responseRequestId,
    statusCode: args.statusCode,
    providerCode: args.providerCode ? redactSecrets(args.providerCode, secrets) : null,
  });
}

function assertResponseCorrelation(args: {
  requestId: string;
  response: ResponseTrace;
  correlationId: string;
  statusCode: number;
  secrets?: Array<string | null | undefined>;
}) {
  if (!args.response.requestId) {
    throw createError({
      code: "protocol_error",
      message: "Gateway response did not include request tracing",
      correlationId: args.correlationId,
      requestId: args.requestId,
      responseRequestId: null,
      statusCode: args.statusCode,
      secrets: args.secrets,
    });
  }
  if (!args.response.correlationId) {
    throw createError({
      code: "protocol_error",
      message: "Gateway response did not include correlation tracing",
      correlationId: args.correlationId,
      requestId: args.requestId,
      responseRequestId: args.response.requestId,
      statusCode: args.statusCode,
      secrets: args.secrets,
    });
  }
  if (args.response.requestId !== args.requestId) {
    throw createError({
      code: "correlation_mismatch",
      message: "Gateway response request id did not match the sent request id",
      correlationId: args.correlationId,
      requestId: args.requestId,
      responseRequestId: args.response.requestId,
      statusCode: args.statusCode,
      secrets: args.secrets,
    });
  }
  if (args.response.correlationId !== args.correlationId) {
    throw createError({
      code: "correlation_mismatch",
      message: "Gateway response correlation id did not match the sent correlation id",
      correlationId: args.correlationId,
      requestId: args.requestId,
      responseRequestId: args.response.requestId,
      statusCode: args.statusCode,
      secrets: args.secrets,
    });
  }
}

async function parseResponse(response: Response, deadline: GatewayDeadline): Promise<ParsedResponse> {
  const rawBody = await readResponseText(response, deadline);
  if (!rawBody.trim()) {
    const trace = responseTrace(response);
    return { body: null, rawBody, parseError: false, ...traceToParsed(trace) };
  }
  try {
    const body = JSON.parse(rawBody) as unknown;
    const trace = responseTrace(response);
    return { body, rawBody, parseError: false, ...traceToParsed(trace) };
  } catch {
    const trace = responseTrace(response);
    return { body: rawBody, rawBody, parseError: true, ...traceToParsed(trace) };
  }
}

function traceToParsed(trace: ResponseTrace) {
  return {
    responseRequestId: trace.requestId,
    responseCorrelationId: trace.correlationId,
  };
}

function parseSseEventData(raw: string) {
  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
  return dataLines.length > 0 ? dataLines.join("\n").trim() : null;
}

function parseSsePayload(data: string): { delta: string | null; finishReason: string | null } {
  let payload: unknown;
  try {
    payload = JSON.parse(data) as unknown;
  } catch {
    throw new GatewayProtocolBodyError("Gateway returned malformed SSE data");
  }
  if (!isRecord(payload)) throw new GatewayProtocolBodyError("Gateway returned an invalid SSE event");
  if ("error" in payload) throw new GatewayProtocolBodyError("Gateway returned an SSE error event");
  if (!Array.isArray(payload.choices) || payload.choices.length === 0 || !isRecord(payload.choices[0])) {
    throw new GatewayProtocolBodyError("Gateway returned an SSE event without choices");
  }
  const choice = payload.choices[0];
  const deltaRecord = isRecord(choice.delta) ? choice.delta : null;
  if (choice.delta !== undefined && !deltaRecord) {
    throw new GatewayProtocolBodyError("Gateway returned an invalid SSE delta");
  }
  const delta = deltaRecord?.content;
  if (delta !== undefined && typeof delta !== "string") {
    throw new GatewayProtocolBodyError("Gateway returned an invalid SSE content delta");
  }
  const finish = choice.finish_reason;
  if (finish !== undefined && finish !== null && typeof finish !== "string") {
    throw new GatewayProtocolBodyError("Gateway returned an invalid SSE finish reason");
  }
  return {
    delta: typeof delta === "string" && delta ? delta : null,
    finishReason: typeof finish === "string" && finish.trim() ? finish.trim() : null,
  };
}

async function consumeSse(args: {
  response: Response;
  deadline: GatewayDeadline;
  onChunk?: (delta: string) => Promise<void> | void;
}) {
  let content = "";
  let finishReason: string | null = null;
  const body = args.response.body;
  if (!body) throw new GatewayProtocolBodyError("Gateway SSE response body was empty");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  let sawDoneFrame = false;
  const cancelReader = () => {
    void reader.cancel(args.deadline.signal.reason).catch(() => undefined);
  };
  args.deadline.signal.addEventListener("abort", cancelReader, { once: true });

  const processData = async (data: string) => {
    if (data === "[DONE]") {
      sawDoneFrame = true;
      done = true;
      await reader.cancel();
      return;
    }
    if (!data) return;
    const parsed = parseSsePayload(data);
    if (parsed.delta) {
      args.deadline.throwIfExpired();
      await args.onChunk?.(parsed.delta);
      args.deadline.throwIfExpired();
      content += parsed.delta;
    }
    if (parsed.finishReason) finishReason = parsed.finishReason;
  };

  let streamCompleted = false;
  try {
    while (!done) {
      args.deadline.throwIfExpired();
      const chunk = await readByteStreamChunk(reader, args.deadline);
      done = chunk.done;
      buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = parseSseEventData(frame);
        await processData(data ?? "");
        if (sawDoneFrame) break;
      }
    }

    if (!sawDoneFrame) {
      const trailing = parseSseEventData(buffer);
      if (trailing) await processData(trailing);
    }
    if (!sawDoneFrame) throw new GatewayProtocolBodyError("Gateway SSE stream ended without a DONE frame");
    if (!content.trim()) throw new GatewayProtocolBodyError("Gateway SSE stream contained no assistant content");
    streamCompleted = true;
    return { content, finishReason };
  } finally {
    args.deadline.signal.removeEventListener("abort", cancelReader);
    if (!streamCompleted) await reader.cancel(args.deadline.signal.reason).catch(() => undefined);
    reader.releaseLock();
  }
}

function responseTraceFromParsed(parsed: ParsedResponse): ResponseTrace {
  return {
    requestId: parsed.responseRequestId,
    correlationId: parsed.responseCorrelationId,
  };
}

function transportErrorCode(error: unknown): "provider_timeout" | "unavailable" {
  return isTimeoutError(error) ? "provider_timeout" : "unavailable";
}

function responseStatusErrorCode(
  statusCode: number,
  boundary: "management" | "completion",
): HeavyChatGatewayErrorCode {
  if (statusCode === 408 || statusCode === 504) return "provider_timeout";
  if (statusCode >= 500 || statusCode === 401 || statusCode === 403) return "unavailable";
  if (boundary === "management" && statusCode === 429) return "unavailable";
  if (statusCode >= 400) return boundary === "completion" ? "provider_rejected" : "protocol_error";
  return "protocol_error";
}

export function createHeavyChatGatewayClient(options: HeavyChatGatewayClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const managementToken = requireToken(options.managementToken, "Gateway management token");
  const serviceId = requireToken(options.serviceId, "Gateway service id");
  const serviceTitle = options.serviceTitle?.trim() || null;
  const defaultModel = options.model?.trim() || null;
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const fetchFn = options.fetchFn ?? fetch;

  async function requestJson(args: {
    url: string;
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: unknown;
    requestId: string;
    correlationId: string;
    deadline: GatewayDeadline;
    secrets: Array<string | null | undefined>;
  }) {
    let response: Response | undefined;
    let parsed: ParsedResponse | undefined;
    try {
      response = await fetchWithDeadline(
        fetchFn,
        args.url,
        {
          method: args.method,
          headers: args.headers,
          body: args.body === undefined ? undefined : JSON.stringify(args.body),
        },
        args.deadline,
      );
      parsed = await parseResponse(response, args.deadline);
    } catch (error) {
      if (error instanceof GatewayClientError) throw error;
      const trace = response ? responseTrace(response) : { requestId: null, correlationId: null };
      throw createError({
        code: transportErrorCode(error),
        message: isTimeoutError(error) ? "Gateway request timed out" : "Gateway request was unavailable",
        correlationId: args.correlationId,
        requestId: args.requestId,
        responseRequestId: trace.requestId,
        statusCode: response?.status ?? null,
        secrets: args.secrets,
      });
    }

    const trace = responseTraceFromParsed(parsed);
    assertResponseCorrelation({
      requestId: args.requestId,
      response: trace,
      correlationId: args.correlationId,
      statusCode: response.status,
      secrets: args.secrets,
    });
    if (!response.ok) {
      const error = providerErrorBody(parsed.body);
      throw createError({
        code: responseStatusErrorCode(response.status, "management"),
        message: error.message || `Gateway request failed with ${response.status}`,
        correlationId: args.correlationId,
        requestId: args.requestId,
        responseRequestId: trace.requestId,
        statusCode: response.status,
        providerCode: error.providerCode,
        secrets: args.secrets,
      });
    }
    if (parsed.parseError || parsed.body === null) {
      throw createError({
        code: "protocol_error",
        message: "Gateway returned an empty or malformed JSON response",
        correlationId: args.correlationId,
        requestId: args.requestId,
        responseRequestId: trace.requestId,
        statusCode: response.status,
        secrets: args.secrets,
      });
    }
    return { response, parsed, trace };
  }

  async function complete(input: HeavyChatGatewayCompletionInput): Promise<HeavyChatGatewayCompletionResult> {
    const ownerUserId = requireToken(input.ownerUserId, "Gateway owner user id");
    const correlationId = input.correlationId?.trim() || randomUUID();
    const requestId = input.requestId?.trim() || randomUUID();
    const model = input.model?.trim() || defaultModel;
    const deadline = createDeadline(timeoutMs);
    let projectToken: string | null = null;
    try {
      const tracingHeaders = {
        accept: "application/json",
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-correlation-id": correlationId,
      };
      const managementSecrets = [managementToken];
      const ensureBody: Record<string, string> = { serviceId, userId: ownerUserId };
      if (serviceTitle) ensureBody.serviceTitle = serviceTitle;
      const ensured = await requestJson({
        url: `${baseUrl}/v1/internal/gateway/benefit-projects/ensure`,
        method: "POST",
        headers: { ...tracingHeaders, "x-internal-api-key": managementToken },
        body: ensureBody,
        requestId,
        correlationId,
        deadline,
        secrets: managementSecrets,
      });
      const ensuredBody = isRecord(ensured.parsed.body) ? ensured.parsed.body : null;
      const project = isRecord(ensuredBody?.project) ? ensuredBody.project : null;
      const projectId = project?.id;
      if (typeof projectId !== "string" || !projectId.trim()) {
        throw createError({
          code: "protocol_error",
          message: "Gateway project ensure response did not include a project id",
          correlationId,
          requestId,
          responseRequestId: ensured.trace.requestId,
          statusCode: ensured.response.status,
          secrets: managementSecrets,
        });
      }

      const access = await requestJson({
        url: `${baseUrl}/v1/internal/gateway/projects/${encodeURIComponent(projectId)}/api-access`,
        method: "GET",
        headers: { ...tracingHeaders, "x-internal-api-key": managementToken },
        requestId,
        correlationId,
        deadline,
        secrets: managementSecrets,
      });
      const accessBody = isRecord(access.parsed.body) ? access.parsed.body : null;
      const rawProjectToken = accessBody?.token;
      projectToken = typeof rawProjectToken === "string" ? rawProjectToken.trim() : null;
      if (!projectToken) {
        throw createError({
          code: "protocol_error",
          message: "Gateway project access response did not include a project token",
          correlationId,
          requestId,
          responseRequestId: access.trace.requestId,
          statusCode: access.response.status,
          secrets: managementSecrets,
        });
      }

      const secrets = [managementToken, projectToken];
      const completionBody: Record<string, unknown> = { messages: input.messages };
      if (model) completionBody.model = model;
      if (input.stream !== undefined) completionBody.stream = input.stream;
      let response: Response;
      try {
        response = await fetchWithDeadline(
          fetchFn,
          `${baseUrl}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              ...tracingHeaders,
              accept: input.stream ? "text/event-stream" : "application/json",
              authorization: `Bearer ${projectToken}`,
            },
            body: JSON.stringify(completionBody),
          },
          deadline,
        );
      } catch (error) {
        throw createError({
          code: transportErrorCode(error),
          message: isTimeoutError(error) ? "Gateway completion timed out" : "Gateway completion was unavailable",
          correlationId,
          requestId,
          statusCode: null,
          secrets,
        });
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("text/event-stream") && response.ok) {
        const trace = responseTrace(response);
        assertResponseCorrelation({
          requestId,
          response: trace,
          correlationId,
          statusCode: response.status,
          secrets,
        });
        try {
          const streamed = await consumeSse({ response, deadline, onChunk: input.onChunk });
          return {
            content: streamed.content,
            finishReason: streamed.finishReason,
            requestId,
            statusCode: response.status,
          };
        } catch (error) {
          if (error instanceof GatewayDeadlineError) {
            throw createError({
              code: "provider_timeout",
              message: "Gateway completion stream timed out",
              correlationId,
              requestId,
              responseRequestId: trace.requestId,
              statusCode: response.status,
              secrets,
            });
          }
          if (error instanceof GatewayProtocolBodyError) {
            throw createError({
              code: "protocol_error",
              message: error.message,
              correlationId,
              requestId,
              responseRequestId: trace.requestId,
              statusCode: response.status,
              secrets,
            });
          }
          if (error instanceof GatewayBodyReadError) {
            throw createError({
              code: "unavailable",
              message: error.message,
              correlationId,
              requestId,
              responseRequestId: trace.requestId,
              statusCode: response.status,
              secrets,
            });
          }
          throw error;
        }
      }

      let parsed: ParsedResponse;
      try {
        parsed = await parseResponse(response, deadline);
      } catch (error) {
        throw createError({
          code: transportErrorCode(error),
          message: isTimeoutError(error) ? "Gateway completion response timed out" : "Gateway response body was unavailable",
          correlationId,
          requestId,
          responseRequestId: responseTrace(response).requestId,
          statusCode: response.status,
          secrets,
        });
      }
      const trace = responseTraceFromParsed(parsed);
      assertResponseCorrelation({
        requestId,
        response: trace,
        correlationId,
        statusCode: response.status,
        secrets,
      });
      if (!response.ok) {
        const error = providerErrorBody(parsed.body);
        throw createError({
          code: responseStatusErrorCode(response.status, "completion"),
          message: error.message || `Gateway completion failed with ${response.status}`,
          correlationId,
          requestId,
          responseRequestId: trace.requestId,
          statusCode: response.status,
          providerCode: error.providerCode,
          secrets,
        });
      }
      if (parsed.parseError || parsed.body === null) {
        throw createError({
          code: "protocol_error",
          message: "Gateway completion response was empty or malformed",
          correlationId,
          requestId,
          responseRequestId: trace.requestId,
          statusCode: response.status,
          secrets,
        });
      }
      let completion: { content: string; finishReason: string | null };
      try {
        completion = parseCompletionPayload(parsed.body);
      } catch (error) {
        if (!(error instanceof GatewayProtocolBodyError)) throw error;
        throw createError({
          code: "protocol_error",
          message: error.message,
          correlationId,
          requestId,
          responseRequestId: trace.requestId,
          statusCode: response.status,
          secrets,
        });
      }
      deadline.throwIfExpired();
      await input.onChunk?.(completion.content);
      deadline.throwIfExpired();
      return {
        content: completion.content,
        finishReason: completion.finishReason,
        requestId,
        statusCode: response.status,
      };
    } finally {
      deadline.dispose();
      projectToken = null;
    }
  }

  return { complete };
}
