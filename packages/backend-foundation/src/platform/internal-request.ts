type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type InternalRequestOptions = {
  timeoutMs: number;
  timeoutMessage?: string;
  fetchFn?: FetchLike;
  maxBodyBytes?: number;
};

export class InternalRequestTimeoutError extends Error {
  readonly code = "INTERNAL_REQUEST_TIMEOUT";

  constructor(message: string) {
    super(message);
    this.name = "InternalRequestTimeoutError";
  }
}

export class InternalResponseBodyTooLargeError extends Error {
  readonly code = "INTERNAL_RESPONSE_BODY_TOO_LARGE";

  constructor(readonly maxBodyBytes: number) {
    super(`Internal response body exceeded ${maxBodyBytes} bytes`);
    this.name = "InternalResponseBodyTooLargeError";
  }
}

async function readBoundedResponseBytes(response: Response, maxBodyBytes: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new InternalResponseBodyTooLargeError(maxBodyBytes);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        throw new InternalResponseBodyTooLargeError(maxBodyBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function requestInternalBody<T>(
  input: string | URL | Request,
  init: RequestInit,
  options: InternalRequestOptions,
  readBody: (response: Response) => Promise<T>,
): Promise<{ response: Response; body: T }> {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1) {
    throw new TypeError("Internal request timeout must be a positive number");
  }
  if (
    options.maxBodyBytes !== undefined &&
    (!Number.isInteger(options.maxBodyBytes) || options.maxBodyBytes < 1)
  ) {
    throw new TypeError("Internal response body limit must be a positive integer");
  }

  const timeoutMs = Math.floor(options.timeoutMs);
  const timeoutError = new InternalRequestTimeoutError(
    options.timeoutMessage?.trim() || `Internal request timed out after ${timeoutMs}ms`,
  );
  const timeoutController = new AbortController();
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;
  const fetchFn = options.fetchFn ?? fetch;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const operation = (async () => {
    const response = await fetchFn(input, { ...init, signal });
    const body = await readBody(response);
    return { response, body };
  })();
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timeoutController.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, deadline]);
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function requestInternalText(
  input: string | URL | Request,
  init: RequestInit,
  options: InternalRequestOptions,
): Promise<{ response: Response; text: string }> {
  const { response, body } = await requestInternalBody(input, init, options, async (value) =>
    options.maxBodyBytes === undefined
      ? value.text()
      : new TextDecoder().decode(await readBoundedResponseBytes(value, options.maxBodyBytes)),
  );
  return { response, text: body };
}

export async function requestInternalArrayBuffer(
  input: string | URL | Request,
  init: RequestInit,
  options: InternalRequestOptions,
): Promise<{ response: Response; arrayBuffer: ArrayBuffer }> {
  const { response, body } = await requestInternalBody(input, init, options, async (value) =>
    options.maxBodyBytes === undefined
      ? value.arrayBuffer()
      : (await readBoundedResponseBytes(value, options.maxBodyBytes)).buffer,
  );
  return { response, arrayBuffer: body };
}
