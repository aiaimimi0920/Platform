import assert from "node:assert/strict";
import test from "node:test";

import { discoverGatewayProviderModelIds } from "./provider-model-discovery";

test("provider model discovery preserves provider order while bounding active requests", async () => {
  let active = 0;
  let maxActive = 0;
  const providers = [30, 5, 20, 10];

  const results = await discoverGatewayProviderModelIds({
    providers,
    concurrency: 2,
    async discover(delayMs) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      active -= 1;
      return [`model-${delayMs}`];
    },
    async fallback() {
      return [];
    },
  });

  assert.equal(maxActive, 2);
  assert.deepEqual(results, providers.map((delayMs) => [`model-${delayMs}`]));
});

test("provider model discovery uses the provider fallback after discovery failure", async () => {
  const fallbackProviders: string[] = [];

  const results = await discoverGatewayProviderModelIds({
    providers: ["primary", "fallback"],
    concurrency: 2,
    async discover(provider) {
      if (provider === "fallback") throw new Error("models endpoint unavailable");
      return ["primary-model"];
    },
    async fallback(provider) {
      fallbackProviders.push(provider);
      return [`${provider}-default`];
    },
  });

  assert.deepEqual(results, [["primary-model"], ["fallback-default"]]);
  assert.deepEqual(fallbackProviders, ["fallback"]);
});
