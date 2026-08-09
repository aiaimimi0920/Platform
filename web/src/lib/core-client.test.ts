import assert from "node:assert/strict";
import test from "node:test";

import type { InternalUserContext } from "@neuro/contracts";

import { listSuppliedAgentMarketplaceExecutions } from "./core-client";

const userContext: InternalUserContext = {
  userId: "user-1",
  providerUserId: "provider-1",
  username: "alice",
};

test("supplier execution requests clamp their limit to the Core contract maximum", async () => {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return Response.json({ executions: [] });
  }) as typeof fetch;

  try {
    assert.deepEqual(await listSuppliedAgentMarketplaceExecutions(userContext, 200), []);
    assert.equal(requests.length, 1);
    assert.match(requests[0] ?? "", /\/v1\/agents\/marketplace\/supplier-executions\?limit=100$/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
