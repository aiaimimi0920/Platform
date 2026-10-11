import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { getIdentityProvider, getRauthyConfiguration } from "./identity-provider";
import { createRauthyProvider, fetchRauthyEndpoint, normalizeRauthyProfile, verifyRauthyIdToken } from "./rauthy-auth";

const environment = {
  AUTH_PROVIDER: "rauthy", RAUTHY_ISSUER_URL: "https://id.example.invalid/auth/v1/",
  RAUTHY_CLIENT_ID: "synthetic-platform", RAUTHY_CLIENT_SECRET: "synthetic-client-secret",
  NEXTAUTH_SECRET: "synthetic-independent-session-secret-for-tests", NODE_ENV: "production",
};
const config = getRauthyConfiguration(environment)!;

test("Rauthy is opt-in, independently configured, and keeps its exact trailing-slash issuer", () => {
  assert.equal(getIdentityProvider({}), "linuxdo");
  assert.equal(getRauthyConfiguration({}), null);
  assert.equal(config.issuer, environment.RAUTHY_ISSUER_URL);
  assert.equal(config.jwksUrl.href, "https://id.example.invalid/auth/v1/oidc/certs");
  assert.throws(() => getIdentityProvider({ AUTH_PROVIDER: "typo" }));
  for (const name of ["RAUTHY_ISSUER_URL", "RAUTHY_CLIENT_ID", "RAUTHY_CLIENT_SECRET", "NEXTAUTH_SECRET"]) {
    assert.throws(() => getRauthyConfiguration({ ...environment, [name]: "" }));
  }
  assert.throws(() => getRauthyConfiguration({ ...environment, NEXTAUTH_SECRET: "short" }));
});

test("production issuer URLs cannot downgrade to HTTP or contain credentials/query/fragment", () => {
  for (const issuer of ["http://id.example.invalid/auth/v1/", "http://127.0.0.1:8080/auth/v1/",
    "https://user:secret@id.example.invalid/auth/v1/", "https://id.example.invalid/auth/v1/?x=1",
    "https://id.example.invalid/auth/v1/#x", "ftp://id.example.invalid/auth/v1/",
    " https://id.example.invalid/auth/v1/", "https://id.example.invalid/auth/v1/?"]) {
    assert.throws(() => getRauthyConfiguration({ ...environment, RAUTHY_ISSUER_URL: issuer }));
  }
});

test("HTTP requires explicit loopback-only synthetic development opt-in", () => {
  const local = { ...environment, NODE_ENV: "test", RAUTHY_ISSUER_URL: "http://127.0.0.1:8080/auth/v1/" };
  assert.throws(() => getRauthyConfiguration(local));
  assert.ok(getRauthyConfiguration({ ...local, RAUTHY_ALLOW_INSECURE_LOOPBACK: "true" }));
  assert.throws(() => getRauthyConfiguration({ ...local, RAUTHY_ALLOW_INSECURE_LOOPBACK: "true",
    NODE_ENV: "production" }));
  assert.throws(() => getRauthyConfiguration({ ...local, RAUTHY_ALLOW_INSECURE_LOOPBACK: "true",
    RAUTHY_ISSUER_URL: "http://remote.example.invalid/auth/v1/" }));
});

test("profile mapping uses issuer and subject without inventing email or verification", () => {
  const profile = { iss: config.issuer, sub: "synthetic-subject" };
  assert.deepEqual(normalizeRauthyProfile(profile, config.issuer), {
    issuer: config.issuer, subject: "synthetic-subject", username: undefined, email: null, emailVerified: false,
  });
  assert.equal(normalizeRauthyProfile({ ...profile, preferred_username: " ", name: " 张三 " }, config.issuer).username, "张三");
  assert.equal(normalizeRauthyProfile({ ...profile, preferred_username: " " }, config.issuer).username, undefined);
  assert.equal(normalizeRauthyProfile({ ...profile, email: "test@example.invalid" }, config.issuer).emailVerified, false);
  assert.equal(normalizeRauthyProfile({ ...profile, email_verified: true }, config.issuer).emailVerified, false);
  assert.equal(normalizeRauthyProfile({ ...profile, email: "test@example.invalid", email_verified: true }, config.issuer).emailVerified, true);
  for (const override of [{ iss: "https://other.invalid/" }, { sub: 900001 }, { sub: "" },
    { sub: "x".repeat(256) }, { sub: "a\nb" }, { email_verified: "true" }, { email: {} },
    { preferred_username: "x".repeat(129) }]) {
    assert.throws(() => normalizeRauthyProfile({ ...profile, ...override }, config.issuer));
  }
});

test("provider enables PKCE, state and nonce without email-based account linking", () => {
  const provider = createRauthyProvider(config);
  assert.deepEqual(provider.checks, ["pkce", "state", "nonce"]);
  assert.equal(provider.type, "oidc");
  assert.equal(provider.allowDangerousEmailAccountLinking, false);
  assert.equal(provider.client?.token_endpoint_auth_method, "client_secret_basic");
});

test("ID-token signature, issuer, audience, expiry, authorized party and algorithm are enforced", async (t) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "fixture-rsa", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: config.issuer, sub: "fixture-subject", aud: config.clientId, iat: now, exp: now + 300 };
  const token = (overrides = {}) => new SignJWT({ ...claims, ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid }).sign(privateKey);
  assert.equal((await verifyRauthyIdToken(await token(), config, keys)).sub, claims.sub);
  for (const [name, overrides] of Object.entries({
    issuer: { iss: "https://other.invalid/" }, audience: { aud: "other-client" },
    expiry: { exp: now - 1 }, subject: { sub: "" }, authorizedParty: { azp: "other-client" },
    multiAudience: { aud: [config.clientId, "other-client"] },
  })) {
    await t.test(name, async () => assert.rejects(verifyRauthyIdToken(await token(overrides), config, keys)));
  }
  assert.ok(await verifyRauthyIdToken(await token({ aud: [config.clientId, "other"], azp: config.clientId }), config, keys));
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).sign(other.privateKey);
  await assert.rejects(verifyRauthyIdToken(forged, config, keys));
  const symmetric = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("x".repeat(32)));
  await assert.rejects(verifyRauthyIdToken(symmetric, config, keys));
  await assert.rejects(verifyRauthyIdToken(undefined, config, keys));
});

test("Rauthy EdDSA and ES256 keys remain supported with real signatures", async () => {
  for (const alg of ["EdDSA", "ES256"]) {
    const { publicKey, privateKey } = await generateKeyPair(alg);
    const jwk = { ...await exportJWK(publicKey), kid: `fixture-${alg}`, alg };
    const token = await new SignJWT({}).setProtectedHeader({ alg, kid: jwk.kid })
      .setIssuer(config.issuer).setSubject("synthetic-subject").setAudience(config.clientId)
      .setIssuedAt().setExpirationTime("5m").sign(privateKey);
    assert.equal((await verifyRauthyIdToken(token, config, createLocalJWKSet({ keys: [jwk] }))).sub, "synthetic-subject");
  }
});


test("upstream requests reject cross-origin/downgrade/credentials before forwarding secrets", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json({});
  };
  try {
    for (const url of ["https://other.invalid/token", "http://id.example.invalid/token",
      "https://user:password@id.example.invalid/token"]) {
      await assert.rejects(fetchRauthyEndpoint(config, url, {
        headers: { authorization: "Basic synthetic-only" },
      }));
    }
    assert.equal(calls, 0);
    await fetchRauthyEndpoint(config, `${config.issuer}oidc/token`, {
      headers: { authorization: "Basic synthetic-only" },
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
