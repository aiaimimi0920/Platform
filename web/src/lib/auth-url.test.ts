import assert from "node:assert/strict";
import test from "node:test";

import { ensureAuthUrlEnvironment } from "./auth-url";

const authUrlEnvKeys = ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"] as const;

function withAuthUrlEnv(values: Partial<Record<(typeof authUrlEnvKeys)[number], string | undefined>>, run: () => void) {
  const previous = new Map<(typeof authUrlEnvKeys)[number], string | undefined>();
  for (const key of authUrlEnvKeys) {
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
    for (const key of authUrlEnvKeys) {
      const value = previous.get(key);
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
}

test("auth url environment keeps an explicit AUTH_URL", () => {
  withAuthUrlEnv(
    {
      AUTH_URL: "http://auth.example.test",
      NEXTAUTH_URL: "http://nextauth.example.test",
      NEXT_PUBLIC_APP_URL: "http://public.example.test",
    },
    () => {
      assert.equal(ensureAuthUrlEnvironment(), "http://auth.example.test");
      assert.equal(process.env.AUTH_URL, "http://auth.example.test");
    },
  );
});

test("auth url environment falls back to NEXTAUTH_URL for Auth.js v5", () => {
  withAuthUrlEnv(
    {
      NEXTAUTH_URL: "http://127.0.0.1:30000",
      NEXT_PUBLIC_APP_URL: "http://localhost:30000",
    },
    () => {
      assert.equal(ensureAuthUrlEnvironment(), "http://127.0.0.1:30000");
      assert.equal(process.env.AUTH_URL, "http://127.0.0.1:30000");
    },
  );
});

test("auth url environment can fall back to NEXT_PUBLIC_APP_URL", () => {
  withAuthUrlEnv(
    {
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
    },
    () => {
      assert.equal(ensureAuthUrlEnvironment(), "https://app.example.test");
      assert.equal(process.env.AUTH_URL, "https://app.example.test");
    },
  );
});
