import type { NextRequest } from "next/server";

import { ensureAuthUrlEnvironment } from "./auth-url";

type RequestInitWithDuplex = RequestInit & { duplex?: "half" };

function requestCanHaveBody(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

export function resolveAuthCoreRequestUrl(request: Pick<NextRequest, "url">): string {
  const requestUrl = new URL(request.url);
  const authUrl = ensureAuthUrlEnvironment();
  if (!authUrl) {
    return requestUrl.toString();
  }

  const authOrigin = new URL(authUrl);
  requestUrl.protocol = authOrigin.protocol;
  requestUrl.host = authOrigin.host;
  return requestUrl.toString();
}

export function toAuthCoreRequest(request: NextRequest): Request {
  const init: RequestInitWithDuplex = {
    method: request.method,
    headers: request.headers,
  };

  if (requestCanHaveBody(request.method) && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  return new Request(resolveAuthCoreRequestUrl(request), init);
}
