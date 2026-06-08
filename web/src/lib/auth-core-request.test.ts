import assert from "node:assert/strict";
import test from "node:test";
import type { NextRequest } from "next/server";

import { resolveAuthCoreRequestUrl, toAuthCoreRequest } from "./auth-core-request";

const authUrlEnvKeys = ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"] as const;

function withAuthUrlEnv(values: Partial<Record<(typeof authUrlEnvKeys)[number], string>>, run: () => void) {
  const previous = Object.fromEntries(authUrlEnvKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of authUrlEnvKeys) {
      const value = values[key];
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
    run();
  } finally {
    for (const key of authUrlEnvKeys) {
      const value = previous[key];
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
}

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

test("auth core request URL uses AUTH_URL origin while preserving auth path and query", () => {
  withAuthUrlEnv({ AUTH_URL: "http://127.0.0.1:30000" }, () => {
    const request = makeRequest("http://localhost:30000/api/auth/providers?from=browser", {
      headers: {
        host: "127.0.0.1:30000",
        "x-forwarded-host": "127.0.0.1:30000",
      },
    });

    assert.equal(
      resolveAuthCoreRequestUrl(request),
      "http://127.0.0.1:30000/api/auth/providers?from=browser",
    );
  });
});

test("auth core request URL falls back to NEXTAUTH_URL when AUTH_URL is not explicit", () => {
  withAuthUrlEnv({ NEXTAUTH_URL: "http://127.0.0.1:30000" }, () => {
    const request = makeRequest("http://localhost:30000/api/auth/csrf");

    assert.equal(resolveAuthCoreRequestUrl(request), "http://127.0.0.1:30000/api/auth/csrf");
    assert.equal(process.env.AUTH_URL, "http://127.0.0.1:30000");
  });
});

test("auth core request keeps the original URL when no auth app URL is configured", () => {
  withAuthUrlEnv({}, () => {
    const request = makeRequest("http://localhost:30000/api/auth/session");

    assert.equal(resolveAuthCoreRequestUrl(request), "http://localhost:30000/api/auth/session");
  });
});

test("toAuthCoreRequest returns a standard Request with rewritten URL and original headers", () => {
  withAuthUrlEnv({ AUTH_URL: "http://127.0.0.1:30000" }, () => {
    const request = makeRequest("http://localhost:30000/api/auth/providers", {
      headers: {
        host: "127.0.0.1:30000",
        "x-forwarded-proto": "http",
      },
    });

    const authRequest = toAuthCoreRequest(request);

    assert.equal(authRequest.url, "http://127.0.0.1:30000/api/auth/providers");
    assert.equal(authRequest.headers.get("host"), "127.0.0.1:30000");
    assert.equal(authRequest.headers.get("x-forwarded-proto"), "http");
  });
});
