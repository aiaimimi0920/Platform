# Rauthy OIDC account identity boundary

## Account authority

`users.id` remains the Platform business-account identifier. Rauthy supplies an
OIDC identity; it does not own wallets, balances, entitlements, mailbox messages,
orders, progression, or internal user IDs. New sign-ins create fresh Platform
accounts. There is no legacy-account migration, email linking, username linking,
or deletion of historical data.

The web backend verifies the OIDC login (including signature, issuer, audience,
expiry, state, nonce and PKCE) before calling
`POST /internal/identity/rauthy-upsert`. The account service accepts only the
existing internal-service authentication and enabled `identity` feature module.
The endpoint is disabled unless `AUTH_PROVIDER=rauthy`; deployments must set this
on both web and account-api. This is an internal trust boundary, not a public JWT
validation endpoint. Do not expose the internal service token to browsers.

`RAUTHY_ISSUER_URL` is the exact issuer, including any trailing slash. Do not
normalize it, derive identity from an email, or accept an issuer supplied by a
browser instead of trusted configuration. HTTPS is mandatory except for explicit
synthetic development: `RAUTHY_ALLOW_INSECURE_LOOPBACK=true`, `NODE_ENV=test` or
`development`, and hostname `localhost`, `127.0.0.1`, or `[::1]`. Credential-bearing
URLs, queries, fragments, whitespace and backslashes are rejected. Production
cannot opt into HTTP through the loopback flag.

## Persistence and concurrency

The append-only `20261002_00_oidc_identities.sql` migration creates a dedicated
`oidc_identities` table with a user foreign key and unique `(issuer, subject)`.
Existing `auth_identities` is unchanged. Apply via the normal account migration
runner with its database-scoped session advisory lock and per-file transaction;
this implementation does not run migrations against production.

First login acquires a transaction-scoped advisory lock for the exact identity,
then creates the user, OIDC identity and one `user.registered` account-consumer
outbox event in the same transaction. Concurrent/repeated logins return the same
internal ID. A write or outbox failure rolls everything back. Hash collisions in
the advisory-lock key can serialize unrelated logins but cannot merge identities.
The SQL unique index is the final identity invariant.

Subsequent logins update OIDC display name, email metadata and login timestamps.
Issuer and subject are immutable account keys. Subject values are not lowercased
or trimmed. The public profile handle `users.username` is always the stable
`rauthy_${users.id}`, never a mutable or duplicate upstream display name. The
optional username claim is stored as `oidc_identities.display_name` and returned
as `UserSummary.displayName`; renaming it cannot change or collide with another
account’s public profile URL. Missing display claims clear the display metadata.

OIDC email and `email_verified` are current claims only. Missing verification is
false; missing email clears metadata, and verification without an email is
rejected. No synthetic verification timestamp is written. These fields never
create a verified Email-Native identity and never grant invocation or delivery
rights. Those continue to require the existing independent verification flow.

`UserSummary` uses provider `rauthy`, provider user ID equal to the subject, and
`providerIssuer` equal to the exact issuer. Existing Linux.do summaries remain
supported. Summary lookup and profile editing both support fresh OIDC users.

## Checks

- `npm run test --workspace @neuro/account-domain --ignore-scripts` includes
  pure provider/issuer/claim validation tests
- `npm run test:integration:identity --workspace @neuro/account-domain` uses the
  isolated embedded PostgreSQL harness and synthetic claims; covers concurrent
  first login, repeat login, rollback, same-email isolation, metadata truthfulness,
  old/new summary lookup, profile updates, internal authentication, feature/provider
  gates, payload bounds, uniqueness and foreign keys
- The fixture does not contact a real identity provider, use real credentials,
  migrate production data, or deploy services

## Operator authorization

A Rauthy subject must never be interpreted as a legacy Linux.do operator ID.
`UserSummary.providerUserId` is display/identity metadata only. The web backend
forwards the new internal `users.id` for Rauthy sessions and omits the legacy
`x-neuro-provider-user-id` authorization header. Operator allowlists for fresh
accounts must explicitly use their new internal IDs. An OIDC subject colliding
with a historical allowlist entry does not gain operator rights.

Verification on 2026-10-02: account-domain unit tests passed 16/16; the isolated
Rauthy PostgreSQL suite passed 9/9 (eight cases plus the containing test), including
16 simultaneous first sign-ins and same-subject/different-issuer separation.
Existing reputation and mailbox-player PostgreSQL suites also passed. Contracts,
Backend Foundation and account-domain builds/typechecks passed. This is synthetic
local evidence; it does not assert a production identity-provider rollout.

## Rauthy upsert request budgets

Only the new Rauthy upsert route uses `@fastify/rate-limit` and its official Redis
store. Existing account routes and Loom budgets are unchanged. After internal
service authentication and bounded claim/provider/issuer validation, a shared
Redis budget allows 240 Rauthy upsert attempts per 60-second window per deployment.
A second budget allows 30 attempts per exact issuer/subject tuple. Tuple keys are
SHA-256 hashes of the JSON pair; raw issuer, subject and email are not Redis keys.

The deployment budget executes first. When exhausted it returns 429 without
allocating a new identity key. An identity-budget rejection still consumes the
shared attempt budget; this is deliberately conservative. Both official Redis
operations are atomic independently. `continueExceeding` and `exponentialBackoff`
are false, so rejected attempts never extend the TTL. Both rejection paths return
Redis-derived `Retry-After`, and neither reaches the feature lookup or account DB.

The route owns a lazy Redis duplicate; Linux.do-only deployments and rejected
requests do not open this connection. Valid first requests await one shared
connection attempt. Connect, command and socket deadlines are one second, retries
and offline queuing are disabled, and app shutdown closes the owned duplicate.
Redis connection failures, command failures and blackholed sockets fail closed;
there is no local-memory or allow-on-error fallback.

Local HTTP tests inject an explicit command-boundary fixture. The PostgreSQL
suite uses that same fixture only to isolate DB invariants; neither proves Redis
Lua behavior. The required non-daemon `run-loom-account.mjs` suite additionally
runs `rauthy-rate-limit.integration.test.ts` against its disposable real Redis,
covering first use, 31st/241st request rejection, concurrent instances, key
cardinality, expiry without renewal, command failures and connection cleanup.
Local connection tests separately exercise a TCP blackhole before and after the
real ioredis handshake. Production rollout still requires these CI gates.
