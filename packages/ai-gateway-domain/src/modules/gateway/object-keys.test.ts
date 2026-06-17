import assert from "node:assert/strict";
import test from "node:test";

import { buildGatewayProviderAccountObjectKey } from "./object-keys";

test("provider account payload object keys use the canonical ai-gateway namespace", () => {
  assert.equal(
    buildGatewayProviderAccountObjectKey("provider-123"),
    "ai-gateway/provider-account/provider-123.json",
  );
});
