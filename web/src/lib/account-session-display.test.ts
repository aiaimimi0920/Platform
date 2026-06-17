import assert from "node:assert/strict";
import test from "node:test";

import { resolveAccountLoginSourceLabel } from "./account-session-display";

const devAuthEnvKeys = [
  "DEV_AUTH_BYPASS_ENABLED",
  "DEV_AUTH_BYPASS_PROVIDER_USER_ID",
] as const;

function withDevAuthEnv(
  values: Partial<Record<(typeof devAuthEnvKeys)[number], string | undefined>>,
  run: () => void,
) {
  const previous = new Map<(typeof devAuthEnvKeys)[number], string | undefined>();
  for (const key of devAuthEnvKeys) {
    previous.set(key, process.env[key]);
    const nextValue = values[key];
    if (typeof nextValue === "string") {
      process.env[key] = nextValue;
    } else {
      delete process.env[key];
    }
  }

  try {
    run();
  } finally {
    for (const key of devAuthEnvKeys) {
      const value = previous.get(key);
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
}

test("login source label shows local-dev for a dev bypass session even when the account provider is linuxdo", () => {
  withDevAuthEnv(
    {
      DEV_AUTH_BYPASS_ENABLED: "true",
      DEV_AUTH_BYPASS_PROVIDER_USER_ID: "local-dev-account",
    },
    () => {
      assert.equal(
        resolveAccountLoginSourceLabel({
          accountProvider: "linuxdo",
          sessionProviderUserId: "local-dev-account",
        }),
        "local-dev",
      );
    },
  );
});

test("login source label falls back to the persisted account provider for regular sessions", () => {
  withDevAuthEnv(
    {
      DEV_AUTH_BYPASS_ENABLED: "true",
      DEV_AUTH_BYPASS_PROVIDER_USER_ID: "local-dev-account",
    },
    () => {
      assert.equal(
        resolveAccountLoginSourceLabel({
          accountProvider: "linuxdo",
          sessionProviderUserId: "linuxdo-user-1",
        }),
        "linuxdo",
      );
    },
  );
});
