import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Auth, type AuthConfig } from "@auth/core";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { decode, encode } from "next-auth/jwt";

test("real Auth.js OIDC callback with synthetic discovery, signed tokens, and business-account boundary", async (t) => {
  const issuer = "https://id.example.invalid/auth/v1/";
  const origin = "https://app.business.example";
  const accountOrigin = "https://accounts.business.example";
  assert.notEqual(new URL(issuer).origin, origin);
  assert.notEqual(new URL(issuer).origin, accountOrigin);
  const environment = {
    NODE_ENV: "test", AUTH_PROVIDER: "rauthy", AUTH_URL: origin,
    RAUTHY_ISSUER_URL: issuer, RAUTHY_CLIENT_ID: "synthetic-platform",
    RAUTHY_CLIENT_SECRET: "synthetic-client-secret",
    NEXTAUTH_SECRET: "synthetic-independent-session-secret-for-tests",
    ACCOUNT_INTERNAL_URL: accountOrigin, INTERNAL_API_TOKEN: "synthetic-internal-token",
    PLATFORM_OPERATOR_USER_IDS: "synthetic-subject",
  };
  const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
  Object.assign(process.env, environment);
  const originalFetch = globalThis.fetch;
  const keys = await generateKeyPair("RS256");
  const wrongKeys = await generateKeyPair("RS256");
  const publicJwk = { ...await exportJWK(keys.publicKey), kid: "synthetic-rsa", alg: "RS256", use: "sig" };
  const persisted: Record<string, unknown>[] = [];
  const codes = new Map<string, { nonce: string; challenge: string; scenario: string }>();
  let sequence = 0;
  let jwksFetched = false;
  let identityAvailable = true;
  let identityRequests = 0;
  let config: AuthConfig;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (new URL(url).origin === new URL(issuer).origin) {
      identityRequests++;
      if (!identityAvailable) throw new TypeError("Synthetic identity service unavailable");
    }
    if (url === `${issuer}.well-known/openid-configuration`) {
      return Response.json({ issuer, authorization_endpoint: `${issuer}oidc/authorize`,
        token_endpoint: `${issuer}oidc/token`, userinfo_endpoint: `${issuer}oidc/userinfo`,
        jwks_uri: `${issuer}oidc/certs`, response_types_supported: ["code"],
        subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_basic"] });
    }
    if (url === `${issuer}oidc/certs`) {
      jwksFetched = true;
      return Response.json({ keys: [publicJwk] });
    }
    if (url === `${issuer}oidc/token`) {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("redirect_uri"), `${origin}/api/auth/callback/rauthy`);
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.ok(new Headers(init?.headers).get("authorization")?.startsWith("Basic "));
      const pending = codes.get(body.get("code") || "");
      codes.delete(body.get("code") || "");
      if (!pending) return Response.json({ error: "invalid_grant" }, { status: 400 });
      assert.equal(createHash("sha256").update(body.get("code_verifier") || "").digest("base64url"), pending.challenge);
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: pending.scenario === "issuer" ? "https://wrong.invalid/" : issuer,
        sub: "synthetic-subject", aud: pending.scenario === "audience" ? "wrong-client" : "synthetic-platform",
        nonce: pending.scenario === "nonce" ? "wrong-nonce" : pending.nonce,
        iat: now, exp: pending.scenario === "expired" ? now - 120 : now + 300,
        preferred_username: "合成账号 张三 😀",
      };
      const signingKey = pending.scenario === "signature" ? wrongKeys.privateKey : keys.privateKey;
      const idToken = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: publicJwk.kid }).sign(signingKey);
      return Response.json({ token_type: "Bearer", access_token: "synthetic-access-token", expires_in: 300, id_token: idToken });
    }
    if (url === accountOrigin + "/internal/identity/rauthy-upsert") {
      assert.equal(new Headers(init?.headers).get("x-internal-api-token"), environment.INTERNAL_API_TOKEN);
      const claims = JSON.parse(String(init?.body));
      persisted.push(claims);
      return Response.json({ user: { id: "synthetic-platform-user", provider: "rauthy",
        providerIssuer: issuer, providerUserId: claims.subject, username: "rauthy_synthetic-platform-user",
        displayName: claims.username,
        email: claims.email, trustLevel: null, avatarUrl: null } });
    }
    throw new Error(`Unexpected synthetic request: ${url}`);
  };
  const updateCookies = (jar: Map<string, string>, response: Response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  };
  const call = async (jar: Map<string, string>, route: string, body?: URLSearchParams) => {
    const response = await Auth(new Request(`${origin}/api/auth/${route}`, {
      method: body ? "POST" : "GET", body,
      headers: { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
        ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    }), config);
    updateCookies(jar, response);
    return response;
  };
  const start = async (scenario = "valid") => {
    const jar = new Map<string, string>();
    const csrf = await (await call(jar, "csrf")).json();
    const response = await call(jar, "signin/rauthy", new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: origin }));
    assert.equal(response.status, 302);
    const authorization = new URL(response.headers.get("location")!);
    assert.equal(authorization.origin, new URL(issuer).origin);
    const params = authorization.searchParams;
    assert.equal(params.get("code_challenge_method"), "S256");
    assert.ok(params.get("nonce")); assert.ok(params.get("state"));
    const code = `synthetic-code-${++sequence}`;
    codes.set(code, { nonce: params.get("nonce")!, challenge: params.get("code_challenge")!, scenario });
    return { jar, route: `callback/rauthy?${new URLSearchParams({ code, state: params.get("state")! })}` };
  };
  try {
    const url = `${pathToFileURL(path.resolve(process.cwd(), "src/auth.ts")).href}?rauthy-callback-fixture`;
    const module = await import(url);
    config = module.authConfig ?? module.default?.authConfig;
    config.logger = { error() {}, warn() {}, debug() {} };
    await t.test("new account accepts missing email, signature-verified subject, and creates one business call", async () => {
      const flow = await start();
      const oldCookies = new Map(flow.jar);
      const response = await call(flow.jar, flow.route);
      assert.equal(response.headers.get("location"), origin);
      assert.equal(persisted.length, 1);
      assert.deepEqual(persisted[0], { issuer, subject: "synthetic-subject", username: "合成账号 张三 😀", email: null, emailVerified: false });
      assert.ok(jwksFetched, "must validate the ID-token signature against the JWKS");
      const session = await (await call(flow.jar, "session")).json();
      assert.equal(session.user.id, "synthetic-platform-user");
      assert.equal(session.user.providerUserId, undefined);
      assert.equal(session.user.identitySubject, "synthetic-subject");
      assert.equal(session.user.identityIssuer, issuer);
      const { isPlatformOperatorUserId } = await import("./lib/platform-session");
      assert.equal(isPlatformOperatorUserId(session.user.id, session.user.providerUserId), false,
        "an OIDC subject must not inherit a legacy provider-id operator allowlist entry");
      assert.ok(new Date(session.expires).getTime() <= Date.now() + 300_000);
      assert.equal(session.user.email, null);
      assert.equal(session.user.name, "合成账号 张三 😀");
      assert.equal(session.user.username, "rauthy_synthetic-platform-user");
      assert.equal(new Headers({ "x-neuro-username": session.user.username }).get("x-neuro-username"),
        "rauthy_synthetic-platform-user", "Unicode display name must not enter ByteString request headers");
      assert.ok(!JSON.stringify(session).includes("synthetic-access-token"));
      const replay = await call(oldCookies, flow.route);
      assert.match(replay.headers.get("location")!, /error=/);
      assert.equal(persisted.length, 1);
    });
    await t.test("existing sessions stay local during an IdP outage; expiry and new login fail closed", async () => {
      const flow = await start();
      await call(flow.jar, flow.route);
      const pendingLogin = await start();
      const accountsBefore = persisted.length, requestsBefore = identityRequests;
      identityAvailable = false;
      try {
        for (let n = 0; n < 3; n++) {
          const session = await (await call(flow.jar, "session")).json();
          assert.equal(session.user.id, "synthetic-platform-user");
        }
        assert.equal(identityRequests, requestsBefore);
        assert.equal(persisted.length, accountsBefore);
        const cookieName = [...flow.jar.keys()].find((key) => key.endsWith("session-token"))!;
        const token = await decode({ token: flow.jar.get(cookieName), secret: environment.NEXTAUTH_SECRET, salt: cookieName });
        flow.jar.set(cookieName, await encode({ token: { ...token, identityExpiresAt: Math.floor(Date.now() / 1000) - 1 },
          secret: environment.NEXTAUTH_SECRET, salt: cookieName }));
        assert.equal(await (await call(flow.jar, "session")).json(), null);
        assert.equal(identityRequests, requestsBefore);
        const failedLogin = await call(pendingLogin.jar, pendingLogin.route);
        assert.match(failedLogin.headers.get("location")!, /error=/);
        assert.ok(identityRequests > requestsBefore);
        assert.equal(persisted.length, accountsBefore);
        assert.equal(await (await call(pendingLogin.jar, "session")).json(), null);
      } finally {
        identityAvailable = true;
      }
    });
    await t.test("local logout clears the platform session and expiry fails closed", async () => {
      const flow = await start();
      await call(flow.jar, flow.route);
      const csrf = await (await call(flow.jar, "csrf")).json();
      await call(flow.jar, "signout", new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: origin }));
      assert.equal(await (await call(flow.jar, "session")).json(), null);
      const expired = await config.callbacks!.jwt!({ token: { identityProvider: "rauthy",
        identityIssuer: issuer, identityExpiresAt: Math.floor(Date.now() / 1000) - 1 },
        user: { id: "synthetic" }, account: null });
      assert.equal(expired, null);
      const wrongIssuer = await config.callbacks!.jwt!({ token: { identityProvider: "rauthy",
        identityIssuer: "https://wrong.invalid/", identityExpiresAt: Math.floor(Date.now() / 1000) + 300 },
        user: { id: "synthetic" }, account: null });
      assert.equal(wrongIssuer, null);
    });
    await t.test("an encrypted cookie with expired identity is rejected by the real session endpoint", async () => {
      const flow = await start();
      await call(flow.jar, flow.route);
      const name = [...flow.jar.keys()].find((key) => key.endsWith("session-token"));
      assert.ok(name);
      const decoded = await decode({ token: flow.jar.get(name), secret: environment.NEXTAUTH_SECRET, salt: name });
      assert.ok(decoded);
      flow.jar.set(name, await encode({ token: { ...decoded, identityExpiresAt: Math.floor(Date.now() / 1000) - 1 },
        secret: environment.NEXTAUTH_SECRET, salt: name }));
      assert.equal(await (await call(flow.jar, "session")).json(), null);
    });
    for (const scenario of ["issuer", "audience", "nonce", "expired", "signature"]) {
      await t.test(`${scenario} failure never creates a business account`, async () => {
        const count = persisted.length;
        const flow = await start(scenario);
        const response = await call(flow.jar, flow.route);
        assert.match(response.headers.get("location")!, /error=/);
        assert.equal(persisted.length, count);
        assert.equal(await (await call(flow.jar, "session")).json(), null);
      });
    }
    await t.test("state mismatch and missing PKCE cookie cannot create a business account", async () => {
      for (const failure of ["state", "pkce"]) {
        const count = persisted.length;
        const flow = await start();
        if (failure === "pkce") {
          for (const key of flow.jar.keys()) if (key.includes("pkce")) flow.jar.delete(key);
        }
        const response = await call(flow.jar, failure === "state" ? flow.route.replace(/state=[^&]+/, "state=wrong") : flow.route);
        assert.match(response.headers.get("location")!, /error=/);
        assert.equal(persisted.length, count);
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
