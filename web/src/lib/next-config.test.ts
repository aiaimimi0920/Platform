import assert from "node:assert/strict";
import { describe, it } from "node:test";

import nextConfig from "../../next.config";

describe("Next development origin configuration", () => {
  it("allows the loopback host used by the acceptance browser", () => {
    assert.ok(
      Array.isArray(nextConfig.allowedDevOrigins),
      "allowedDevOrigins must be configured for the acceptance dev server",
    );
    assert.ok(
      nextConfig.allowedDevOrigins.includes("127.0.0.1"),
      "127.0.0.1 must be an allowed development origin",
    );
  });
});
