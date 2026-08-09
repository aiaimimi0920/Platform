# NeuroLoom Platform

[![Platform CI](https://github.com/aiaimimi0920/Platform/actions/workflows/ci.yml/badge.svg)](https://github.com/aiaimimi0920/Platform/actions/workflows/ci.yml)
[![Container Images](https://github.com/aiaimimi0920/Platform/actions/workflows/container-images.yml/badge.svg)](https://github.com/aiaimimi0920/Platform/actions/workflows/container-images.yml)

NeuroLoom Platform is the website and public service layer for the Neuro system.

It owns the official web surface, account flows, product/benefit surfaces,
operator pages, account-domain services, quota and entitlement policy, and the
website-side integration points used to call Neuro Gateway.

## Repository

The canonical source repository is:

`https://github.com/aiaimimi0920/Platform`

Clone it as a standalone workspace with:

```powershell
git clone https://github.com/aiaimimi0920/Platform.git
cd Platform
npm ci
npm run ci
```

The top-level Neuro workspace checks this repository out at `Platform/` as a Git
submodule. Platform remains independently buildable; integrated local compose
expects compatible `Gateway/`, `Loom/`, and `Tea/` sibling checkouts when their
real services are enabled.

## Project boundary

Platform is an independent project that participates in the top-level Neuro workspace:

- `../Gateway/` owns the independently runnable AI API gateway runtime.
- `../Loom/` owns the AI brain and orchestration runtime.
- `../Hook/` owns foreground interaction such as screenshot and voice input.
- `Platform/` owns the website, account, quota, operator, and service-policy
  layer.

Platform should call or manage Gateway through Gateway APIs and shared contracts.
It must not contain the Rust Gateway source tree or provider relay internals.

## Migrated workspace layout

- `web/` - Next.js website and operator UI.
- `core/` - core backend service.
- `worker/` - platform worker service.
- `executor/` - task executor service.
- `packages/contracts/` - shared TypeScript contracts.
- `packages/backend-foundation/` - backend infrastructure primitives.
- `packages/account-domain/` - account, quota, entitlement, and product domain.
- `packages/ai-gateway-domain/` - Platform-side transitional Gateway/account data layer and operator integration helpers.
- `services/account-api/` - account API service.
- `services/account-worker/` - account/domain worker service.
- `deploy/` - Platform-local Docker Compose, Dockerfiles, env examples, and local stack helpers.
- `docs/` - Platform/product/engineering docs plus the subset of Gateway integration contract docs needed by Platform.

## Gateway integration

The local compose stack includes a `gateway` service, but it builds from the
sibling project at `../Gateway`, not from a `Platform/gateway` folder.

Important local environment keys include:

- `AI_GATEWAY_INTERNAL_URL`
- `AI_GATEWAY_MANAGEMENT_TOKEN`
- `AI_GATEWAY_PUBLIC_BASE_URL`
- `AI_GATEWAY_COMPATIBILITY_BASE_URL`

Platform account and operator flows may use these values to call Gateway. Gateway
runtime implementation remains owned by `../Gateway`.

## Tea integration

Platform Core exposes Tea through internal-only proxy routes under
`/internal/tea/*`. Browser code and public clients should call Platform/Core with
the existing internal/user context rules; they should not hold the Tea daemon
token or call Tea directly.

Important local environment keys include:

- `TEA_SERVER_URL` - Tea daemon base URL used by Platform Core, for example
  `http://tea:48910` in compose or `http://127.0.0.1:48910` in local smoke
  tests.
- `TEA_AUTH_TOKEN` - bearer token Platform Core uses when calling Tea.
- `INTERNAL_API_TOKEN` - token required by Platform's `/internal/tea/*` routes.

The local compose stack wires Core to the sibling Tea service:

```yaml
TEA_SERVER_URL: http://tea:48910
TEA_AUTH_TOKEN: ${TEA_AUTH_TOKEN:-local-internal-token}
```

To prove Platform Core can operate against a real `tea-daemon` through its
internal Tea proxy, run the root smoke harness from the Neuro workspace root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-tea-real.ps1
```

The harness starts an isolated Tea daemon on a free loopback port with a
temporary SQLite store, runs `core/src/modules/tea/real-daemon-smoke.test.ts`
with `TEA_PLATFORM_REAL_SMOKE=1`, verifies ticket lifecycle operations through
Platform Core, including cancel terminal-state behavior, and writes artifacts under
`.tmp/tea-smoke/platform-tea-real-<timestamp>/`.

Platform Web now exposes an authenticated Tea work-order desk at `/tea`, a
ticket detail/review page at `/tea/[ticketId]`, and browser-facing JSON routes
under `/api/tea/tickets/*`. Detail pages read ticket comments, ticket events,
Loom run evidence, JSON export, and Markdown export through the same
backend-mediated boundary. JSON and Markdown exports include persisted human
review comments so review notes are not write-only after submission.
Operators can add review comments, reject tickets with a reason, stop/retry the
latest run, accept/close completed work, cancel active work, and download
JSON/Markdown evidence without receiving the Tea daemon token. The call chain is:

Review/action routes currently exposed by Platform Web include:

- `POST /api/tea/tickets` for human ticket creation.
- `GET /api/tea/tickets/:ticketId` for detail plus comments and event timeline.
- `GET /api/tea/tickets/:ticketId/comments` for persisted review comments.
- `POST /api/tea/tickets/:ticketId/comments` for human review comments.
- `POST /api/tea/tickets/:ticketId/analyze`, `/plan`, `/approve`, `/reject`,
  `/run`, `/stop`, `/retry`, `/accept`, `/close`, and `/cancel` for ticket lifecycle
  controls.
- `GET /api/tea/tickets/:ticketId/runs` for Loom run evidence.
- `GET /api/tea/tickets/:ticketId/export/json` and `/export/markdown` for
  browser JSON envelopes.
- `GET /api/tea/tickets/:ticketId/export/json/download` and
  `/export/markdown/download` for raw attachment downloads.

1. browser/page forms call Platform Web routes or server actions;
2. Platform Web uses `CORE_INTERNAL_URL` plus `INTERNAL_API_TOKEN` to call
   Platform Core `/internal/tea/*`;
3. Platform Core uses `TEA_SERVER_URL` and `TEA_AUTH_TOKEN` to call the Tea
   daemon;
4. the browser never receives or stores `TEA_AUTH_TOKEN`.

Focused Web Tea tests:

```powershell
node --test --import tsx web/src/lib/tea-client.test.ts web/src/lib/tea-route-utils.test.ts web/src/lib/tea-api-handlers.test.ts web/src/lib/tea-detail-controls.test.ts web/src/lib/tea-settings-page-contract.test.ts
```

The cross-product Tea smoke harnesses are owned by the parent Neuro repository
because they build and start both Platform and Tea. When Platform is checked out
as `Neuro/Platform`, run these commands from the Neuro repository root.

To prove the browser-facing Platform Web handlers can operate through Platform
Core HTTP against a real `tea-daemon`, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-web-tea-real.ps1
```

The harness starts an isolated Tea daemon, starts an in-process Platform Core
HTTP server for `/internal/tea/*`, then drives the Platform Web Tea handlers for
create, comment, reject, cancel, approve, run, detail/comments/events, comments, runs,
JSON export, Markdown export, raw JSON/Markdown downloads, stop, retry, close,
and terminal-ticket conflict checks. It also asserts that review comments appear
in detail responses and both export formats, that Platform Web does not send
`authorization` to Core, and that Platform Core does send the Tea bearer token
to the Tea daemon.

To prove the actual Next.js Tea UI still works through Local Dev auth, server
actions, redirects, downloads, and the same Web -> Core -> Tea boundary, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-web-tea-ui-real.ps1 -KeepArtifacts
```

The UI harness starts an isolated `tea-daemon`, a minimal Platform Core helper
for `/internal/tea/*`, `/internal/features`, `/internal/public-surfaces`, and
Local Dev identity upsert, then starts `next dev` and drives real Chrome or Edge
through `playwright-core`. It logs in with `DEV_AUTH_BYPASS_ENABLED`, creates a
ticket from `/tea`, opens `/tea/[ticketId]`, submits a human comment, approves,
runs, downloads Markdown/JSON evidence, stops and retries the latest run, then
reads helper-captured evidence to assert that Web -> Core requests do not carry
`authorization` while Core -> Tea requests do carry the Tea bearer token.
Artifacts are written under
`.tmp/tea-smoke/platform-web-tea-ui-real-<guid>/`. Because Next dev uses a
single `.next/dev/lock`, stop any already-running `next dev` for
`Platform/web` before running this smoke, or let the harness fail before it
touches unknown processes.

## Local validation

```powershell
npm ci
npm run ci
docker compose -f deploy/docker-compose.local.yml config --quiet
```

`npm run ci` runs repository contracts, production dependency auditing,
workspace unit tests, AI Gateway Vitest suites, and workspace type checking.
The compose command renders the integrated developer topology without starting
services. Building or starting that topology requires the sibling repositories
described above. Acceptance runs use Platform-local doubles and allocate their
required environment through `scripts/acceptance/cli.mjs`.

The full acceptance inventory remains available through `npm run smoke`. It is a
larger policy gate than hosted quick CI and may require Docker, browser suites,
and explicit external-surface evidence depending on the selected mode.

## Release and images

Build and verify a versioned Platform Web release on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-platform-web-release.ps1 -VersionId <versionId>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>
```

Version tags matching `V*.*.*` run the release workflow and publish the verified
Web zip, SHA-256 sidecar, manifest, checksum inventory, six-image immutable
container lock, and the lock's SHA-256 sidecar to GitHub Releases. The tag
workflow pins the tag commit, runs all required integration suites, waits for the
successful `Container Images` push run for that exact tag and revision, and
rejects a missing, failed, ambiguous, cross-revision, or cross-run image lock.
The container workflow builds six Platform-owned images:

- `ghcr.io/aiaimimi0920/neuro-platform-core`
- `ghcr.io/aiaimimi0920/neuro-platform-account-api`
- `ghcr.io/aiaimimi0920/neuro-platform-account-worker`
- `ghcr.io/aiaimimi0920/neuro-platform-worker`
- `ghcr.io/aiaimimi0920/neuro-platform-executor`
- `ghcr.io/aiaimimi0920/neuro-platform-web`

Production deployments must select an immutable `sha-*` tag or registry digest
for every image. Do not deploy the mutable branch tag as a rollback target. Run
the matching database migrations before switching long-running services, retain
the previous image digests for rollback, and keep the sibling Gateway, Loom, and
Tea revisions compatible with the selected Platform commit.

Core, AI Gateway domain, and Account domain migration runners serialize
concurrent instances with database-scoped PostgreSQL advisory locks held on the
same session for the complete run. Ordinary migration files remain individually
transactional. Online index creation requires a future explicit no-transaction
contract; do not place `CREATE INDEX CONCURRENTLY` in the current migration files.

The production Dockerfiles pin the Node base image by digest through the
`NODE_IMAGE` build argument. Base-image upgrades must update that digest
deliberately and pass all six image builds. BuildKit/buildx is required because
the Dockerfiles use cache mounts.

The local `local-internal-token` values in compose and bootstrap helpers are
development-only defaults. Production deployments must inject independent
database, Redis, internal API, Gateway, Tea, OAuth, Auth.js, and object-storage
secrets and must not reuse those values. The local integrated compose also mounts
the host `.neuro` directory read-write for Gateway development; do not reuse that
mount in production or on hosts containing unrelated credentials.

## Migration note

This directory was migrated from:

`C:\Users\Public\nas_home\AI\GameEditor\NeuroPlatform`

Excluded from this Platform copy:

- `gateway/` Rust Gateway source and Gateway-only release scripts.
- `node_modules/`, `.next/`, `dist/`, build outputs, caches, logs, and test output.
- real runtime environment files such as `.env` and `.env.local`.
- unrelated historical or external project folders such as `api-old/`, `AIRead/`, `jshook/`, and `plans-old/`.
