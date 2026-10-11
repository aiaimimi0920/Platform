/** Transfer the request deadline to the response stream until EOF or cancellation. */
export function retainResponseDeadline(
  response: Response,
  signal: AbortSignal,
  clearDeadline: () => void,
  timeoutError: () => Error,
): Response {
  if (!response.body) {
    clearDeadline();
    return response;
  }

  const reader = response.body.getReader();
  let finished = false;
  let abort: () => void;
  function finish() {
    finished = true;
    clearDeadline();
    signal.removeEventListener("abort", abort);
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => {
        if (finished) return;
        finish();
        const error = timeoutError();
        controller.error(error);
        void reader.cancel(error).catch(() => {}).finally(() => reader.releaseLock());
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (finished) return;
        if (result.done) {
          finish();
          reader.releaseLock();
          controller.close();
        } else {
          controller.enqueue(result.value);
        }
      } catch (error) {
        if (finished) return;
        finish();
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      if (finished) return;
      finish();
      try {
        await reader.cancel(reason);
      } finally {
        reader.releaseLock();
      }
    },
  });
  const wrapped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  return preserveFetchMetadata(wrapped, response);
}

function preserveFetchMetadata(wrapped: Response, response: Response): Response {
  // Response reconstruction and native clone otherwise lose fetch URL metadata.
  for (const key of ["url", "redirected", "type"] as const) {
    Object.defineProperty(wrapped, key, { value: response[key] });
  }
  const clone = wrapped.clone.bind(wrapped);
  Object.defineProperty(wrapped, "clone", { value: () => preserveFetchMetadata(clone(), response) });
  return wrapped;
}
