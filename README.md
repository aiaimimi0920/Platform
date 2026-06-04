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
