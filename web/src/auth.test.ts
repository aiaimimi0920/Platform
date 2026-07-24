import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { Auth } from "@auth/core";

function installAuthTestEnvironment() {
  const previous = {
    AUTH_URL: process.env.AUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    CORE_INTERNAL_URL: process.env.CORE_INTERNAL_URL,
    INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN,
  };
  process.env.AUTH_URL = "http://127.0.0.1:3000";
  process.env.NEXTAUTH_SECRET = "acceptance-nextauth-secret";
  process.env.OAUTH_CLIENT_ID = "acceptance-client-id";
  process.env.OAUTH_CLIENT_SECRET = "acceptance-client-secret";
  process.env.CORE_INTERNAL_URL = "http://127.0.0.1:4000";
  process.env.INTERNAL_API_TOKEN = "acceptance-internal-token";

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

async function loadAuthConfig() {
  const authModuleUrl =
    `${pathToFileURL(path.resolve(process.cwd(), "src/auth.ts")).href}?t=${Date.now()}-${Math.random()}`;
  const authModule = await import(authModuleUrl);
  const authConfig =
    authModule?.default?.authConfig ??
    authModule?.authConfig ??
    authModule?.default?.default?.authConfig ??
    null;
  assert.ok(authConfig, "authConfig must be exported from src/auth.ts");
  return authConfig;
}

function createLinuxDoProfile(overrides = {}) {
  return {
    id: "linuxdo-user-1",
    username: "alice",
    name: "Alice",
    email: "alice@example.com",
    avatar_url: "https://cdn.example.test/alice.png",
    trust_level: 3,
    ...overrides,
  };
}

function createUserSummary(overrides = {}) {
  const timestamp = new Date("2026-07-24T09:00:00.000Z").toISOString();
  return {
    id: "local-user-1",
    provider: "linuxdo",
    providerUserId: "linuxdo-user-1",
    username: "alice",
    email: "alice@example.com",
    avatarUrl: "https://cdn.example.test/alice.png",
    profileTagline: null,
    honorShowcasedAgentIds: null,
    honorShowcasedProjectIds: null,
    honorShowcasedInvestmentProjectIds: null,
    honorShowcasedIssueIds: null,
    honorShowcasedInvestmentIssueIds: null,
    trustLevel: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: timestamp,
    snapshot: {
      wallet: null,
      mailbox: null,
      agents: null,
      assets: null,
      progression: null,
    },
    ...overrides,
  };
}

function resolveFetchUrl(input) {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

test("OAuth callback rejects missing callback state before reaching token exchange", async () => {
  const restoreEnvironment = installAuthTestEnvironment();
  const previousFetch = globalThis.fetch;
  const fetches = [];
  globalThis.fetch = async (input) => {
    fetches.push(resolveFetchUrl(input));
    return new Response("unexpected", { status: 500 });
  };

  try {
    const authConfig = await loadAuthConfig();
    const response = await Auth(
      new Request("http://127.0.0.1:3000/api/auth/callback/linuxdo?code=callback-code"),
      authConfig,
    );

    assert.equal(response.status, 302);
    assert.match(response.headers.get("location") ?? "", /\/api\/auth\/error\?error=Configuration$/);
    assert.deepEqual(fetches, []);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironment();
  }
});

test("OAuth callback identity mapping persists the Linux.do identity into JWT and session", async () => {
  const restoreEnvironment = installAuthTestEnvironment();
  const previousFetch = globalThis.fetch;
  const fetches = [];
  globalThis.fetch = async (input) => {
    const url = resolveFetchUrl(input);
    fetches.push(url);
    if (url.endsWith("/internal/identity/linuxdo-upsert")) {
      return Response.json({
        user: createUserSummary(),
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const authConfig = await loadAuthConfig();
    const signInHandler = authConfig.callbacks?.signIn;
    const jwtHandler = authConfig.callbacks?.jwt;
    const sessionHandler = authConfig.callbacks?.session;
    assert.ok(signInHandler);
    assert.ok(jwtHandler);
    assert.ok(sessionHandler);

    const profile = createLinuxDoProfile();
    const signInResult = await signInHandler({
      account: { provider: "linuxdo" },
      profile,
    });
    assert.equal(signInResult, true);

    const token = await jwtHandler({
      token: {},
      account: { provider: "linuxdo" },
      profile,
      user: undefined,
    });
    assert.equal(token.localUserId, "local-user-1");
    assert.equal(token.providerUserId, "linuxdo-user-1");
    assert.equal(token.username, "alice");
    assert.equal(token.trustLevel, 3);
    assert.equal(token.avatarUrl, "https://cdn.example.test/alice.png");

    const session = await sessionHandler({
      session: {
        user: {
          name: null,
          email: null,
          image: null,
        },
        expires: "2099-01-01T00:00:00.000Z",
      },
      token,
    });
    assert.equal(session.user.id, "local-user-1");
    assert.equal(session.user.providerUserId, "linuxdo-user-1");
    assert.equal(session.user.username, "alice");
    assert.equal(session.user.trustLevel, 3);
    assert.equal(session.user.avatarUrl, "https://cdn.example.test/alice.png");
    assert.equal(session.user.image, "https://cdn.example.test/alice.png");
    assert.deepEqual(fetches, [
      "http://127.0.0.1:4000/internal/identity/linuxdo-upsert",
      "http://127.0.0.1:4000/internal/identity/linuxdo-upsert",
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironment();
  }
});

test("repeated account linking keeps the same local user id across Linux.do re-logins", async () => {
  const restoreEnvironment = installAuthTestEnvironment();
  const previousFetch = globalThis.fetch;
  const responses = [
    createUserSummary(),
    createUserSummary({
      username: "alice-renamed",
      trustLevel: 4,
      avatarUrl: "https://cdn.example.test/alice-renamed.png",
    }),
  ];
  let callIndex = 0;
  globalThis.fetch = async (input) => {
    const url = resolveFetchUrl(input);
    if (!url.endsWith("/internal/identity/linuxdo-upsert")) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    const user = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return Response.json({ user });
  };

  try {
    const authConfig = await loadAuthConfig();
    const jwtHandler = authConfig.callbacks?.jwt;
    assert.ok(jwtHandler);

    const firstToken = await jwtHandler({
      token: {},
      account: { provider: "linuxdo" },
      profile: createLinuxDoProfile(),
      user: undefined,
    });
    const secondToken = await jwtHandler({
      token: firstToken,
      account: { provider: "linuxdo" },
      profile: createLinuxDoProfile({
        username: "alice-renamed",
        name: "Alice Renamed",
        trust_level: 4,
        avatar_url: "https://cdn.example.test/alice-renamed.png",
      }),
      user: undefined,
    });

    assert.equal(firstToken.localUserId, "local-user-1");
    assert.equal(secondToken.localUserId, "local-user-1");
    assert.equal(secondToken.providerUserId, "linuxdo-user-1");
    assert.equal(secondToken.username, "alice-renamed");
    assert.equal(secondToken.trustLevel, 4);
    assert.equal(secondToken.avatarUrl, "https://cdn.example.test/alice-renamed.png");
    assert.equal(callIndex, 2);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironment();
  }
});

test("auth session route returns null for unauthenticated access", async () => {
  const restoreEnvironment = installAuthTestEnvironment();
  try {
    const authConfig = await loadAuthConfig();
    const response = await Auth(new Request("http://127.0.0.1:3000/api/auth/session"), authConfig);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(await response.text(), "null");
  } finally {
    restoreEnvironment();
  }
});
