const DEFAULT_ACCOUNT_HONOR_CACHE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
} as const;

export async function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export function isLocalPreviewRequest(request: Request) {
  try {
    const url = new URL(request.url);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function withNoCacheJson(body: unknown, init?: ResponseInit) {
  const headers: Record<string, string> = { ...DEFAULT_ACCOUNT_HONOR_CACHE_HEADERS };
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }

  return Response.json(body, {
    ...init,
    headers,
  });
}

export function resolveHonorAuthAwareStatus(message: string, fallbackStatus: number) {
  return message === "Authentication required" ? 401 : fallbackStatus;
}
