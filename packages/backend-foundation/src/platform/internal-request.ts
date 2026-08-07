type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class InternalRequestTimeoutError extends Error {
  readonly code = "INTERNAL_REQUEST_TIMEOUT";

  constructor(message: string) {
    super(message);
    this.name = "InternalRequestTimeoutError";
  }
}

export async function requestInternalText(
  input: string | URL | Request,
  init: RequestInit,
  options: {
    timeoutMs: number;
    timeoutMessage?: string;
    fetchFn?: FetchLike;
  },
): Promise<{ response: Response; text: string }> {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1) {
    throw new TypeError("Internal request timeout must be a positive number");
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
    const text = await response.text();
    return { response, text };
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
