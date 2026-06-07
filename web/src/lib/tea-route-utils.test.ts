import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTeaCommentPayload,
  parseCreateTeaTicketPayload,
  parseTeaRejectPayload,
  teaJson,
  teaRouteErrorResponse,
  TeaRouteInputError,
} from "./tea-route-utils";
import { TeaWebClientError } from "./tea-client";

test("parseCreateTeaTicketPayload trims and validates title and description", () => {
  assert.deepEqual(
    parseCreateTeaTicketPayload({
      title: "  Implement Tea Web  ",
      description: "  Create a minimal Platform Web Tea work-order entry.  ",
    }),
    {
      title: "Implement Tea Web",
      description: "Create a minimal Platform Web Tea work-order entry.",
    },
  );

  assert.throws(
    () => parseCreateTeaTicketPayload({ title: "AI", description: "too short" }),
    (error: unknown) => {
      assert.ok(error instanceof TeaRouteInputError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /title/i);
      return true;
    },
  );
});

test("review payload parsers trim and validate comments and rejection reasons", () => {
  assert.deepEqual(parseTeaCommentPayload({ body: "  Please add run evidence.  " }), {
    body: "Please add run evidence.",
  });
  assert.deepEqual(parseTeaRejectPayload({ reason: "  Validation evidence is incomplete.  " }), {
    reason: "Validation evidence is incomplete.",
  });

  assert.throws(
    () => parseTeaCommentPayload({ body: "" }),
    (error: unknown) => {
      assert.ok(error instanceof TeaRouteInputError);
      assert.match(error.message, /comment/i);
      return true;
    },
  );

  assert.throws(
    () => parseTeaRejectPayload({ reason: "  " }),
    (error: unknown) => {
      assert.ok(error instanceof TeaRouteInputError);
      assert.match(error.message, /rejection/i);
      return true;
    },
  );
});

test("teaJson always disables browser/proxy caching", async () => {
  const response = teaJson({ ok: true }, 201);

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  assert.deepEqual(await response.json(), { ok: true });
});

test("teaRouteErrorResponse maps authentication, validation, and Core Tea errors", async () => {
  const auth = teaRouteErrorResponse(new Error("Authentication required"), "fallback");
  assert.equal(auth.status, 401);
  assert.deepEqual(await auth.json(), { error: "Authentication required" });

  const validation = teaRouteErrorResponse(new TeaRouteInputError("Invalid payload"), "fallback");
  assert.equal(validation.status, 400);
  assert.deepEqual(await validation.json(), { error: "Invalid payload" });

  const upstream = teaRouteErrorResponse(
    new TeaWebClientError(409, "invalid ticket transition", "TEA_UPSTREAM_ERROR", {
      error: { code: "TEA_UPSTREAM_ERROR", message: "invalid ticket transition" },
    }),
    "fallback",
  );
  assert.equal(upstream.status, 409);
  assert.deepEqual(await upstream.json(), {
    error: "invalid ticket transition",
    code: "TEA_UPSTREAM_ERROR",
  });
});
