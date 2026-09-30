import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayRequestAuditView } from "@neuro/contracts";

import { normalizeGatewayRequestAuditView } from "./gateway-audits";

test("legacy Gateway request audits receive an empty candidate queue", () => {
  const selectedCandidate = { providerAccountId: "provider-a" };
  const legacyRequest = {
    id: "legacy-request",
    routeTrace: {
      selectedCandidate,
    },
  } as unknown as GatewayRequestAuditView;

  const normalized = normalizeGatewayRequestAuditView(legacyRequest);

  assert.deepEqual(normalized.routeTrace?.candidateQueue, []);
  assert.equal(normalized.routeTrace?.selectedCandidate, selectedCandidate);
});

test("complete Gateway request audits retain their candidate queue and identity", () => {
  const request = {
    id: "current-request",
    routeTrace: {
      candidateQueue: [{ providerAccountId: "provider-a" }],
    },
  } as unknown as GatewayRequestAuditView;

  assert.equal(normalizeGatewayRequestAuditView(request), request);
});

test("legacy Gateway request audits preserve a null selected candidate without crashing normalization", () => {
  const legacyRequest = {
    id: "legacy-failed-request",
    routeTrace: {
      candidateQueue: null,
      selectedCandidate: null,
    },
  } as unknown as GatewayRequestAuditView;

  const normalized = normalizeGatewayRequestAuditView(legacyRequest);

  assert.deepEqual(normalized.routeTrace?.candidateQueue, []);
  assert.equal(normalized.routeTrace?.selectedCandidate, null);
});
