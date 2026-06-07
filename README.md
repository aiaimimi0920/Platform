# Neuro Platform

Neuro Platform is the website and public service layer for the Neuro system.

It owns the official web surface, account flows, product/benefit surfaces,
operator pages, account-domain services, quota and entitlement policy, and the
website-side integration points used to call Neuro Gateway.

## Project boundary

Platform is one project inside the top-level Neuro workspace:

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
Platform Core, and writes artifacts under
`.tmp/tea-smoke/platform-tea-real-<timestamp>/`.

Platform Web now exposes an authenticated Tea work-order desk at `/tea`, a
ticket detail/review page at `/tea/[ticketId]`, and browser-facing JSON routes
under `/api/tea/tickets/*`. Detail pages read ticket events, Loom run evidence,
JSON export, and Markdown export through the same backend-mediated boundary.
Operators can add review comments, reject tickets with a reason, stop/retry the
latest run, and download JSON/Markdown evidence without receiving the Tea daemon
token. The call chain is:

Review/action routes currently exposed by Platform Web include:

- `POST /api/tea/tickets` for human ticket creation.
- `GET /api/tea/tickets/:ticketId` for detail plus event timeline.
- `POST /api/tea/tickets/:ticketId/comments` for human review comments.
- `POST /api/tea/tickets/:ticketId/analyze`, `/plan`, `/approve`, `/reject`,
  `/run`, `/stop`, `/retry`, `/accept`, and `/close` for ticket lifecycle
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
cd Platform
node --test --import tsx web/src/lib/tea-client.test.ts web/src/lib/tea-route-utils.test.ts web/src/lib/tea-api-handlers.test.ts web/src/lib/tea-detail-controls.test.ts web/src/lib/tea-real-core-smoke.test.ts
```

To prove the browser-facing Platform Web handlers can operate through Platform
Core HTTP against a real `tea-daemon`, run the root smoke harness:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-web-tea-real.ps1
```

The harness starts an isolated Tea daemon, starts an in-process Platform Core
HTTP server for `/internal/tea/*`, then drives the Platform Web Tea handlers for
create, comment, reject, approve, run, detail/events, runs, JSON export,
Markdown export, raw JSON/Markdown downloads, stop, retry, close, and
terminal-ticket conflict checks. It also asserts that Platform Web does not
send `authorization` to Core while Platform Core does send the Tea bearer token
to the Tea daemon.

## Local validation

```powershell
npm install
npm run build --workspace @neuro/contracts
npm run typecheck -ws --if-present
npm test
node --test scripts/smoke.mjs
docker compose -f deploy/docker-compose.local.yml config
```

The full build/test set can be slow on this Windows/network-drive workspace. For
migration validation, start with `node --test scripts/smoke.mjs`, workspace
package discovery, and `docker compose ... config`, then expand to typecheck/build
when needed.

## Migration note

This directory was migrated from:

`C:\Users\Public\nas_home\AI\GameEditor\NeuroPlatform`

Excluded from this Platform copy:

- `gateway/` Rust Gateway source and Gateway-only release scripts.
- `node_modules/`, `.next/`, `dist/`, build outputs, caches, logs, and test output.
- real runtime environment files such as `.env` and `.env.local`.
- unrelated historical or external project folders such as `api-old/`, `AIRead/`, `jshook/`, and `plans-old/`.
