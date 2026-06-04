import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGatewayProjectApiKey,
  parseGatewayProjectApiKey,
  verifyGatewayProjectApiKey,
} from "./api-key";

describe("ai-gateway api key codec", () => {
  it("builds, parses, and verifies a gateway project api key", () => {
    const token = buildGatewayProjectApiKey({
      apiKeyId: "api-key-1",
      projectId: "project-1",
      tenantId: "tenant-1",
      secret: "unit-test-secret",
    });

    const parsed = parseGatewayProjectApiKey(token);
    assert.ok(parsed);
    assert.equal(parsed?.apiKeyId, "api-key-1");
    assert.equal(
      verifyGatewayProjectApiKey(token, {
        apiKeyId: "api-key-1",
        projectId: "project-1",
        tenantId: "tenant-1",
        secret: "unit-test-secret",
      }),
      true,
    );
  });

  it("rejects a mismatched signature payload", () => {
    const token = buildGatewayProjectApiKey({
      apiKeyId: "api-key-1",
      projectId: "project-1",
      tenantId: "tenant-1",
      secret: "unit-test-secret",
    });

    assert.equal(
      verifyGatewayProjectApiKey(token, {
        apiKeyId: "api-key-1",
        projectId: "project-2",
        tenantId: "tenant-1",
        secret: "unit-test-secret",
      }),
      false,
    );
  });
});
