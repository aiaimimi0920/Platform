import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyUpstreamError,
  formatStandardError,
  isRetryableError,
  shouldFallbackToNextProvider,
  suggestedRetryDelay,
} from "./standard-error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHttpError(status: number, message?: string) {
  return { status, message: message ?? `HTTP ${status}` };
}

function makeCodedError(code: string, message?: string) {
  return Object.assign(new Error(message ?? `Error code ${code}`), { code });
}

// ---------------------------------------------------------------------------
// HTTP status code classification
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — HTTP status codes", () => {
  it("classifies 400 as bad_request", () => {
    const err = classifyUpstreamError(makeHttpError(400));
    assert.equal(err.kind, "bad_request");
    assert.equal(err.httpStatus, 400);
    assert.equal(err.retryable, false);
  });

  it("classifies 401 as authentication", () => {
    const err = classifyUpstreamError(makeHttpError(401));
    assert.equal(err.kind, "authentication");
    assert.equal(err.retryable, false);
  });

  it("classifies 403 as authentication", () => {
    const err = classifyUpstreamError(makeHttpError(403));
    assert.equal(err.kind, "authentication");
    assert.equal(err.retryable, false);
  });

  it("classifies 404 as model_not_found", () => {
    const err = classifyUpstreamError(makeHttpError(404));
    assert.equal(err.kind, "model_not_found");
    assert.equal(err.retryable, false);
  });

  it("classifies 429 as rate_limit", () => {
    const err = classifyUpstreamError(makeHttpError(429));
    assert.equal(err.kind, "rate_limit");
    assert.equal(err.retryable, true);
  });

  it("classifies 500 as server_error", () => {
    const err = classifyUpstreamError(makeHttpError(500));
    assert.equal(err.kind, "server_error");
    assert.equal(err.retryable, true);
  });

  it("classifies 502 as server_error", () => {
    const err = classifyUpstreamError(makeHttpError(502));
    assert.equal(err.kind, "server_error");
    assert.equal(err.retryable, true);
  });

  it("classifies 503 as server_error", () => {
    const err = classifyUpstreamError(makeHttpError(503));
    assert.equal(err.kind, "server_error");
    assert.equal(err.retryable, true);
  });

  it("classifies 504 as timeout", () => {
    const err = classifyUpstreamError(makeHttpError(504));
    assert.equal(err.kind, "timeout");
    assert.equal(err.retryable, true);
  });

  it("falls back to unknown for unrecognised status", () => {
    const err = classifyUpstreamError(makeHttpError(418));
    assert.equal(err.kind, "unknown");
  });
});

// ---------------------------------------------------------------------------
// Node.js error codes
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — Node.js error codes", () => {
  it("classifies ECONNRESET as network", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNRESET"));
    assert.equal(err.kind, "network");
    assert.equal(err.retryable, true);
    assert.equal(err.code, "ECONNRESET");
  });

  it("classifies ETIMEDOUT as network", () => {
    const err = classifyUpstreamError(makeCodedError("ETIMEDOUT"));
    assert.equal(err.kind, "network");
    assert.equal(err.retryable, true);
  });

  it("classifies ECONNREFUSED as network", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNREFUSED"));
    assert.equal(err.kind, "network");
    assert.equal(err.retryable, true);
  });

  it("does not classify an unrecognised code as network", () => {
    const err = classifyUpstreamError(makeCodedError("ENOENT", "no such file"));
    assert.notEqual(err.kind, "network");
  });
});

// ---------------------------------------------------------------------------
// Keyword-based classification
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — message keywords", () => {
  it("detects rate limit keyword", () => {
    const err = classifyUpstreamError(new Error("You have exceeded the rate limit."));
    assert.equal(err.kind, "rate_limit");
  });

  it("detects context length keyword — 'context length'", () => {
    const err = classifyUpstreamError(new Error("This model's maximum context length is 4096 tokens."));
    assert.equal(err.kind, "context_length");
  });

  it("detects context length keyword — 'too long'", () => {
    const err = classifyUpstreamError(new Error("The prompt is too long for this model."));
    assert.equal(err.kind, "context_length");
  });

  it("detects content filter keyword — 'content filter'", () => {
    const err = classifyUpstreamError(new Error("Request blocked by content filter."));
    assert.equal(err.kind, "content_filter");
  });

  it("detects content filter keyword — 'safety'", () => {
    const err = classifyUpstreamError(new Error("Response rejected due to safety policy."));
    assert.equal(err.kind, "content_filter");
  });

  it("detects quota keyword — 'quota'", () => {
    const err = classifyUpstreamError(new Error("You have exceeded your quota."));
    assert.equal(err.kind, "insufficient_quota");
  });

  it("detects quota keyword — 'credits'", () => {
    const err = classifyUpstreamError(new Error("Insufficient credits to complete request."));
    assert.equal(err.kind, "insufficient_quota");
  });

  it("detects service unavailable keyword", () => {
    const err = classifyUpstreamError(new Error("Service temporarily unavailable."));
    assert.equal(err.kind, "service_unavailable");
  });

  it("detects timeout keyword", () => {
    const err = classifyUpstreamError(new Error("The request timed out."));
    assert.equal(err.kind, "timeout");
  });

  it("detects authentication keyword — 'invalid api key'", () => {
    const err = classifyUpstreamError(new Error("Invalid API key supplied."));
    assert.equal(err.kind, "authentication");
  });

  it("detects model not found keyword", () => {
    const err = classifyUpstreamError(new Error("The model gpt-99 does not exist."));
    assert.equal(err.kind, "model_not_found");
  });

  it("falls back to unknown for an unrecognised message", () => {
    const err = classifyUpstreamError(new Error("Something went wrong."));
    assert.equal(err.kind, "unknown");
  });
});

// ---------------------------------------------------------------------------
// HTTP status takes priority over keywords
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — priority: HTTP status > code > keyword", () => {
  it("HTTP status 429 wins over a non-rate-limit message", () => {
    const err = classifyUpstreamError({ status: 429, message: "Unknown error" });
    assert.equal(err.kind, "rate_limit");
  });

  it("HTTP status 401 wins over a keyword-matched message", () => {
    const err = classifyUpstreamError({ status: 401, message: "rate limit exceeded" });
    assert.equal(err.kind, "authentication");
  });

  it("Node.js code wins over keyword when no HTTP status present", () => {
    const err = classifyUpstreamError(
      Object.assign(new Error("rate limit exceeded"), { code: "ECONNRESET" }),
    );
    assert.equal(err.kind, "network");
  });
});

// ---------------------------------------------------------------------------
// FallbackHint resolution per error kind
// ---------------------------------------------------------------------------

describe("FallbackHint resolution", () => {
  it("rate_limit → retry with delayMs", () => {
    const err = classifyUpstreamError(makeHttpError(429));
    assert.equal(err.fallbackHint.action, "retry");
    if (err.fallbackHint.action === "retry") {
      assert.ok(err.fallbackHint.delayMs > 0);
    }
  });

  it("context_length → downgrade_model", () => {
    const err = classifyUpstreamError(new Error("context length exceeded"));
    assert.equal(err.fallbackHint.action, "downgrade_model");
  });

  it("authentication → abort", () => {
    const err = classifyUpstreamError(makeHttpError(401));
    assert.equal(err.fallbackHint.action, "abort");
  });

  it("server_error → fallback_provider", () => {
    const err = classifyUpstreamError(makeHttpError(500));
    assert.equal(err.fallbackHint.action, "fallback_provider");
  });

  it("network → fallback_provider", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNRESET"));
    assert.equal(err.fallbackHint.action, "fallback_provider");
  });

  it("content_filter → abort", () => {
    const err = classifyUpstreamError(new Error("Request blocked by content filter."));
    assert.equal(err.fallbackHint.action, "abort");
  });

  it("bad_request → abort", () => {
    const err = classifyUpstreamError(makeHttpError(400));
    assert.equal(err.fallbackHint.action, "abort");
  });

  it("model_not_found → downgrade_model", () => {
    const err = classifyUpstreamError(makeHttpError(404));
    assert.equal(err.fallbackHint.action, "downgrade_model");
  });

  it("service_unavailable → retry", () => {
    const err = classifyUpstreamError(new Error("Service temporarily unavailable."));
    assert.equal(err.fallbackHint.action, "retry");
  });

  it("timeout → retry", () => {
    const err = classifyUpstreamError(makeHttpError(504));
    assert.equal(err.fallbackHint.action, "retry");
  });

  it("unknown → fallback_provider", () => {
    const err = classifyUpstreamError(new Error("Something unexplained happened."));
    assert.equal(err.fallbackHint.action, "fallback_provider");
  });

  it("insufficient_quota → fallback_provider", () => {
    const err = classifyUpstreamError(new Error("You have exceeded your quota."));
    assert.equal(err.fallbackHint.action, "fallback_provider");
  });
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe("isRetryableError", () => {
  it("returns true for rate_limit", () => {
    const err = classifyUpstreamError(makeHttpError(429));
    assert.equal(isRetryableError(err), true);
  });

  it("returns true for server_error", () => {
    const err = classifyUpstreamError(makeHttpError(500));
    assert.equal(isRetryableError(err), true);
  });

  it("returns true for network errors", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNRESET"));
    assert.equal(isRetryableError(err), true);
  });

  it("returns false for authentication errors", () => {
    const err = classifyUpstreamError(makeHttpError(401));
    assert.equal(isRetryableError(err), false);
  });

  it("returns false for bad_request", () => {
    const err = classifyUpstreamError(makeHttpError(400));
    assert.equal(isRetryableError(err), false);
  });

  it("returns false for content_filter", () => {
    const err = classifyUpstreamError(new Error("blocked by content filter"));
    assert.equal(isRetryableError(err), false);
  });
});

// ---------------------------------------------------------------------------
// shouldFallbackToNextProvider
// ---------------------------------------------------------------------------

describe("shouldFallbackToNextProvider", () => {
  it("returns true for server_error", () => {
    const err = classifyUpstreamError(makeHttpError(500));
    assert.equal(shouldFallbackToNextProvider(err), true);
  });

  it("returns true for network error", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNREFUSED"));
    assert.equal(shouldFallbackToNextProvider(err), true);
  });

  it("returns true for unknown", () => {
    const err = classifyUpstreamError(new Error("Something unexplained."));
    assert.equal(shouldFallbackToNextProvider(err), true);
  });

  it("returns false for rate_limit (retry instead)", () => {
    const err = classifyUpstreamError(makeHttpError(429));
    assert.equal(shouldFallbackToNextProvider(err), false);
  });

  it("returns false for authentication (abort instead)", () => {
    const err = classifyUpstreamError(makeHttpError(401));
    assert.equal(shouldFallbackToNextProvider(err), false);
  });
});

// ---------------------------------------------------------------------------
// suggestedRetryDelay
// ---------------------------------------------------------------------------

describe("suggestedRetryDelay", () => {
  it("returns a positive delay for rate_limit", () => {
    const err = classifyUpstreamError(makeHttpError(429));
    assert.ok(suggestedRetryDelay(err) > 0);
  });

  it("returns a positive delay for timeout", () => {
    const err = classifyUpstreamError(makeHttpError(504));
    assert.ok(suggestedRetryDelay(err) > 0);
  });

  it("returns 0 for non-retryable abort errors", () => {
    const err = classifyUpstreamError(makeHttpError(401));
    assert.equal(suggestedRetryDelay(err), 0);
  });

  it("returns 0 for fallback_provider errors", () => {
    const err = classifyUpstreamError(makeHttpError(500));
    assert.equal(suggestedRetryDelay(err), 0);
  });
});

// ---------------------------------------------------------------------------
// providerName propagation
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — providerName", () => {
  it("propagates providerName when supplied", () => {
    const err = classifyUpstreamError(makeHttpError(429), "openai");
    assert.equal(err.providerName, "openai");
  });

  it("sets providerName to null when omitted", () => {
    const err = classifyUpstreamError(makeHttpError(429));
    assert.equal(err.providerName, null);
  });

  it("sets providerName to null for blank string", () => {
    const err = classifyUpstreamError(makeHttpError(429), "  ");
    assert.equal(err.providerName, null);
  });
});

// ---------------------------------------------------------------------------
// raw error is preserved
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — raw field", () => {
  it("preserves the original error object", () => {
    const original = makeHttpError(500, "Internal server error");
    const err = classifyUpstreamError(original);
    assert.strictEqual(err.raw, original);
  });

  it("handles null/undefined error gracefully", () => {
    const errNull = classifyUpstreamError(null);
    assert.equal(errNull.kind, "unknown");
    assert.strictEqual(errNull.raw, null);

    const errUndef = classifyUpstreamError(undefined);
    assert.equal(errUndef.kind, "unknown");
  });

  it("handles plain string errors", () => {
    const err = classifyUpstreamError("rate limit exceeded");
    // string has no extractable status/code, but keyword matches
    assert.equal(err.kind, "rate_limit");
  });
});

// ---------------------------------------------------------------------------
// nested error.error.message extraction (common in provider SDKs)
// ---------------------------------------------------------------------------

describe("classifyUpstreamError — nested provider error shape", () => {
  it("reads message from error.error.message", () => {
    const raw = {
      status: 400,
      error: { message: "context length exceeded in the prompt", type: "invalid_request_error" },
    };
    // HTTP status 400 → bad_request wins; message extraction still works
    const err = classifyUpstreamError(raw);
    assert.equal(err.httpStatus, 400);
    assert.equal(err.message, "context length exceeded in the prompt");
  });

  it("reads statusCode as fallback for httpStatus", () => {
    const raw = { statusCode: 503, message: "overloaded" };
    const err = classifyUpstreamError(raw);
    assert.equal(err.httpStatus, 503);
    assert.equal(err.kind, "server_error");
  });
});

// ---------------------------------------------------------------------------
// formatStandardError
// ---------------------------------------------------------------------------

describe("formatStandardError", () => {
  it("includes all key fields in the output string", () => {
    const err = classifyUpstreamError(makeHttpError(429, "Rate limit exceeded"), "anthropic");
    const formatted = formatStandardError(err);
    assert.ok(formatted.includes("[anthropic]"), "should include provider name");
    assert.ok(formatted.includes("kind=rate_limit"), "should include kind");
    assert.ok(formatted.includes("status=429"), "should include http status");
    assert.ok(formatted.includes("retryable=true"), "should include retryable flag");
    assert.ok(formatted.includes("hint=retry"), "should include hint action");
    assert.ok(formatted.includes("Rate limit exceeded"), "should include message text");
  });

  it("omits provider name bracket when providerName is null", () => {
    const err = classifyUpstreamError(makeHttpError(500));
    const formatted = formatStandardError(err);
    assert.ok(!formatted.startsWith("["), "should not start with bracket when no provider");
  });

  it("includes error code when present", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNRESET"));
    const formatted = formatStandardError(err);
    assert.ok(formatted.includes("code=ECONNRESET"));
  });

  it("omits http status segment when httpStatus is null", () => {
    const err = classifyUpstreamError(makeCodedError("ECONNRESET"));
    const formatted = formatStandardError(err);
    assert.ok(!formatted.includes("status="), "should not include status= when null");
  });
});
