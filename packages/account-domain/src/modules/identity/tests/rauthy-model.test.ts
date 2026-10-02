import assert from "node:assert/strict";
import test from "node:test";

import { parseRauthyUpsertInput, requireRauthyIssuer } from "../rauthy-model";

const issuer = "https://identity.example.test/auth/v1/";
const environment = { AUTH_PROVIDER: "rauthy", RAUTHY_ISSUER_URL: issuer, NODE_ENV: "production" };
const profile = { issuer, subject: "subject-1", emailVerified: false };

function expectRejected(input: unknown) {
  assert.throws(() => parseRauthyUpsertInput(input, environment), { statusCode: 400 });
}

test("requires explicit provider selection and a valid pinned HTTPS issuer", () => {
  for (const AUTH_PROVIDER of [undefined, "", "linuxdo", "Rauthy"]) {
    assert.throws(() => requireRauthyIssuer({ ...environment, AUTH_PROVIDER }), { statusCode: 503 });
  }
  for (const RAUTHY_ISSUER_URL of [
    undefined, "", "not-url", "https://id.test?", "https://id.test#", "https://id.test/#fragment",
    "https://id.test?query=1", "https://user:password@id.test", "https://id.test\\path",
    " https://id.test", "https://id.test\n", "http://id.test", "file:///tmp/identity",
    "https://id.test/" + "x".repeat(2048),
  ]) {
    assert.throws(() => requireRauthyIssuer({ ...environment, RAUTHY_ISSUER_URL }), { statusCode: 503 });
  }
  assert.equal(requireRauthyIssuer(environment), issuer);
});

test("HTTP requires explicit synthetic-development loopback opt-in", () => {
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
    const loopback = { ...environment, RAUTHY_ISSUER_URL: `http://${hostname}:33451/auth/v1/` };
    assert.throws(() => requireRauthyIssuer(loopback), { statusCode: 503 });
    assert.throws(() => requireRauthyIssuer({ ...loopback, RAUTHY_ALLOW_INSECURE_LOOPBACK: "true" }), { statusCode: 503 });
    for (const NODE_ENV of ["development", "test"]) {
      assert.equal(requireRauthyIssuer({ ...loopback, NODE_ENV, RAUTHY_ALLOW_INSECURE_LOOPBACK: "true" }), loopback.RAUTHY_ISSUER_URL);
    }
  }
  for (const hostname of ["localhost.evil.test", "10.0.0.1", "0.0.0.0", "example.test"]) {
    assert.throws(() => requireRauthyIssuer({
      ...environment, NODE_ENV: "test", RAUTHY_ALLOW_INSECURE_LOOPBACK: "true",
      RAUTHY_ISSUER_URL: `http://${hostname}/auth/v1/`,
    }), { statusCode: 503 });
  }
});

test("compares exact issuer, preserving subject and trailing slash", () => {
  for (const foreign of ["https://other.test/auth/v1/", issuer.slice(0, -1), issuer.replace("https", "http"), issuer.toUpperCase()]) {
    expectRejected({ ...profile, issuer: foreign });
  }
  assert.deepEqual(parseRauthyUpsertInput(profile, environment), profile);
  assert.equal(parseRauthyUpsertInput({ ...profile, subject: "SUBJECT-1" }, environment).subject, "SUBJECT-1");
});

test("optional email stays absent and missing verification defaults to false", () => {
  assert.deepEqual(parseRauthyUpsertInput({ issuer, subject: "no-email" }, environment), {
    issuer, subject: "no-email", emailVerified: false,
  });
  assert.equal(parseRauthyUpsertInput({ ...profile, email: "user@example.test" }, environment).emailVerified, false);
  assert.equal(parseRauthyUpsertInput({ ...profile, email: "user@example.test", emailVerified: true }, environment).emailVerified, true);
  expectRejected({ ...profile, emailVerified: true });
  expectRejected({ ...profile, email: null, emailVerified: true });
  for (const emailVerified of ["true", 1, null]) expectRejected({ ...profile, emailVerified });
});

test("rejects unbounded, malformed, extra, and control-bearing claims", () => {
  for (const input of [null, [], "claims", {}, { ...profile, userId: "legacy-user" }, { ...profile, email: "bad-address" }]) {
    expectRejected(input);
  }
  for (const subject of ["", "x".repeat(256), "with\nnewline", "with\u0000nul", "with\u007fdel"]) {
    expectRejected({ ...profile, subject });
  }
  for (const username of ["", "   ", "x".repeat(129), "name\nadmin"]) expectRejected({ ...profile, username });
  assert.equal(parseRauthyUpsertInput({ ...profile, username: "  Display Name  " }, environment).username, "Display Name");
});
