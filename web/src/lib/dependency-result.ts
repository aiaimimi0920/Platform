export type DependencyResultState =
  | "ready"
  | "empty"
  | "partial"
  | "unavailable"
  | "unauthorized";

export type DependencyRetryMetadata =
  | { retryable: true; retryAfterMs: number | null }
  | { retryable: false; retryAfterMs: null };

export type DependencyFailureInput = {
  message: string;
  source?: string | null;
  code?: string | null;
  diagnostics?: string | null;
};

export type DependencyFailure = {
  message: string;
  source: string | null;
  code: string | null;
  diagnostics: string | null;
};

export type DependencyFailureInputs = readonly [
  DependencyFailureInput,
  ...DependencyFailureInput[],
];

export type DependencyFailures = readonly [DependencyFailure, ...DependencyFailure[]];

type DependencyCorrelationInput = {
  correlationId?: string | null;
};

export type DependencyResultInput<T> =
  | (DependencyCorrelationInput & { state: "ready"; data: T })
  | (DependencyCorrelationInput & { state: "empty" })
  | (DependencyCorrelationInput & {
      state: "partial";
      data: T;
      failures: DependencyFailureInputs;
      retry: DependencyRetryMetadata;
    })
  | (DependencyCorrelationInput & {
      state: "unavailable";
      failures: DependencyFailureInputs;
      retry: DependencyRetryMetadata;
    })
  | (DependencyCorrelationInput & {
      state: "unauthorized";
      failures: DependencyFailureInputs;
      retry: DependencyRetryMetadata;
    });

export type ReadyDependencyResult<T> = {
  state: "ready";
  data: T;
  failures: readonly [];
  correlationId: string | null;
  retry: null;
};

export type EmptyDependencyResult = {
  state: "empty";
  data: null;
  failures: readonly [];
  correlationId: string | null;
  retry: null;
};

export type PartialDependencyResult<T> = {
  state: "partial";
  data: T;
  failures: DependencyFailures;
  correlationId: string | null;
  retry: DependencyRetryMetadata;
};

export type UnavailableDependencyResult = {
  state: "unavailable";
  data: null;
  failures: DependencyFailures;
  correlationId: string | null;
  retry: DependencyRetryMetadata;
};

export type UnauthorizedDependencyResult = {
  state: "unauthorized";
  data: null;
  failures: DependencyFailures;
  correlationId: string | null;
  retry: DependencyRetryMetadata;
};

export type DependencyResult<T> =
  | ReadyDependencyResult<T>
  | EmptyDependencyResult
  | PartialDependencyResult<T>
  | UnavailableDependencyResult
  | UnauthorizedDependencyResult;

const redactedValue = "[REDACTED]";
const secretValuePattern = String.raw`(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)`;
const authorizationPattern = new RegExp(
  String.raw`\bauthorization\b\s*[:=]\s*(?:bearer\s+)?${secretValuePattern}`,
  "gi",
);
const bearerPattern = new RegExp(String.raw`\bbearer\s+${secretValuePattern}`, "gi");
const namedSecretPattern = new RegExp(
  String.raw`\b((?:(?:access|refresh|id)[_-]?)?token|api[_ -]?key|apikey|password)\b(\s*[:=]\s*)${secretValuePattern}`,
  "gi",
);
const skSecretPattern = /\bsk-[a-z0-9._-]+/gi;

function redactDependencyText(value: string) {
  return value
    .replace(authorizationPattern, `Authorization: ${redactedValue}`)
    .replace(bearerPattern, `Bearer ${redactedValue}`)
    .replace(namedSecretPattern, (_match, name: string, separator: string) => {
      return `${name}${separator}${redactedValue}`;
    })
    .replace(skSecretPattern, redactedValue);
}

function normalizeCorrelationId(correlationId: string | null | undefined) {
  if (correlationId === undefined || correlationId === null) {
    return null;
  }
  if (typeof correlationId !== "string") {
    throw new TypeError("dependency correlationId must be a string or null");
  }
  return redactDependencyText(correlationId);
}

function normalizeOptionalFailureText(value: string | null | undefined, field: string) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new TypeError(`dependency failure ${field} must be a string or null`);
  }
  const normalized = redactDependencyText(value).trim();
  return normalized || null;
}

function normalizeFailure(failure: DependencyFailureInput): DependencyFailure {
  if (typeof failure !== "object" || failure === null) {
    throw new TypeError("dependency failure must be an object");
  }
  if (typeof failure.message !== "string" || !failure.message.trim()) {
    throw new TypeError("dependency failure message must be a non-empty string");
  }

  return {
    message: redactDependencyText(failure.message).trim(),
    source: normalizeOptionalFailureText(failure.source, "source"),
    code: normalizeOptionalFailureText(failure.code, "code"),
    diagnostics: normalizeOptionalFailureText(failure.diagnostics, "diagnostics"),
  };
}

function normalizeFailures(
  failures: DependencyFailureInputs,
  state: "partial" | "unavailable" | "unauthorized",
): DependencyFailures {
  if (!Array.isArray(failures) || failures.length === 0) {
    throw new TypeError(`${state} dependency results require at least one failure`);
  }

  const [first, ...remaining] = failures;
  return [normalizeFailure(first), ...remaining.map(normalizeFailure)];
}

function normalizeRetry(retry: DependencyRetryMetadata): DependencyRetryMetadata {
  if (typeof retry !== "object" || retry === null || typeof retry.retryable !== "boolean") {
    throw new TypeError("dependency retry metadata must declare retryable");
  }

  if (!retry.retryable && retry.retryAfterMs !== null) {
    throw new TypeError("non-retryable dependency failures cannot include retryAfterMs");
  }

  if (
    retry.retryAfterMs !== null &&
    (typeof retry.retryAfterMs !== "number" ||
      !Number.isFinite(retry.retryAfterMs) ||
      retry.retryAfterMs < 0)
  ) {
    throw new TypeError("dependency retryAfterMs must be a non-negative finite number or null");
  }

  if (retry.retryable) {
    return { retryable: true, retryAfterMs: retry.retryAfterMs };
  }
  return { retryable: false, retryAfterMs: null };
}

export function normalizeDependencyResult<T>(input: DependencyResultInput<T>): DependencyResult<T> {
  const correlationId = normalizeCorrelationId(input.correlationId);

  switch (input.state) {
    case "ready":
      return { state: "ready", data: input.data, failures: [], correlationId, retry: null };
    case "empty":
      return { state: "empty", data: null, failures: [], correlationId, retry: null };
    case "partial":
      return {
        state: "partial",
        data: input.data,
        failures: normalizeFailures(input.failures, input.state),
        correlationId,
        retry: normalizeRetry(input.retry),
      };
    case "unavailable":
      return {
        state: "unavailable",
        data: null,
        failures: normalizeFailures(input.failures, input.state),
        correlationId,
        retry: normalizeRetry(input.retry),
      };
    case "unauthorized":
      return {
        state: "unauthorized",
        data: null,
        failures: normalizeFailures(input.failures, input.state),
        correlationId,
        retry: normalizeRetry(input.retry),
      };
  }
}

export function createDependencyResult<T>(input: DependencyResultInput<T>): DependencyResult<T> {
  return normalizeDependencyResult(input);
}

export function createDependencyFailureResult<T>(args: {
  error: unknown;
  message: string;
  source: string;
  unauthorizedMessage?: string;
}): DependencyResult<T> {
  const errorRecord = typeof args.error === "object" && args.error !== null ? args.error : null;
  const code = errorRecord && "code" in errorRecord && typeof errorRecord.code === "string" ? errorRecord.code : null;
  const statusCode =
    errorRecord && "statusCode" in errorRecord && typeof errorRecord.statusCode === "number"
      ? errorRecord.statusCode
      : errorRecord && "status" in errorRecord && typeof errorRecord.status === "number"
        ? errorRecord.status
        : null;
  const errorMessage = args.error instanceof Error ? args.error.message : "";
  const correlationId =
    errorRecord && "correlationId" in errorRecord && (typeof errorRecord.correlationId === "string" || errorRecord.correlationId === null)
      ? errorRecord.correlationId
      : null;
  const unauthorized =
    code === "UNAUTHORIZED" ||
    code === "FORBIDDEN" ||
    code === "AUTHENTICATION_REQUIRED" ||
    statusCode === 401 ||
    statusCode === 403 ||
    errorMessage === "Authentication required";
  const retryable = !unauthorized && code !== "MODULE_DISABLED" && code !== "NOT_FOUND" && code !== "BAD_REQUEST";

  return createDependencyResult({
    state: unauthorized ? "unauthorized" : "unavailable",
    correlationId,
    failures: [
      {
        message: unauthorized ? args.unauthorizedMessage ?? args.message : args.message,
        source: args.source,
        code,
        diagnostics: null,
      },
    ],
    retry: retryable ? { retryable: true, retryAfterMs: null } : { retryable: false, retryAfterMs: null },
  });
}

export function combineDependencyResults<T>(args: {
  data: T;
  empty: boolean;
  results: readonly DependencyResult<unknown>[];
}): DependencyResult<T> {
  const failures = args.results.flatMap((result) => [...result.failures]);
  const correlationId = args.results.find((result) => result.correlationId !== null)?.correlationId ?? null;

  if (failures.length === 0) {
    return args.empty
      ? createDependencyResult({ state: "empty", correlationId })
      : createDependencyResult({ state: "ready", data: args.data, correlationId });
  }

  const failureInputs = failures as [
    (typeof failures)[number],
    ...(typeof failures)[number][],
  ];
  let retryable = false;
  let retryAfterMs: number | null = null;
  for (const result of args.results) {
    if (result.state === "ready" || result.state === "empty" || !result.retry.retryable) {
      continue;
    }
    retryable = true;
    retryAfterMs ??= result.retry.retryAfterMs;
  }
  const retry: DependencyRetryMetadata = retryable
    ? { retryable: true, retryAfterMs }
    : { retryable: false, retryAfterMs: null };
  const allSourcesFailed =
    args.results.length > 0 &&
    args.results.every(
      (result) => result.state === "unavailable" || result.state === "unauthorized",
    );

  if (allSourcesFailed) {
    const state = args.results.every((result) => result.state === "unauthorized")
      ? "unauthorized"
      : "unavailable";
    return createDependencyResult({ state, correlationId, failures: failureInputs, retry });
  }

  return createDependencyResult({
    state: "partial",
    data: args.data,
    correlationId,
    failures: failureInputs,
    retry,
  });
}
