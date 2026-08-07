# Platform Migration Notes

## Independent repository phase

As of `2026-08-07`, this Platform tree is maintained as the independent GitHub
repository `https://github.com/aiaimimi0920/Platform` and is checked out by the
top-level Neuro workspace as the `Platform/` submodule. Platform owns its
repository metadata, CI, image publication, and Web release workflow. The Neuro
parent repository retains only cross-project orchestration and the pinned
submodule commit.

Source project:

`C:\Users\Public\nas_home\AI\GameEditor\NeuroPlatform`

Target project:

`C:\Users\Public\nas_home\AI\GameEditor\Neuro\Platform`

## Inclusion rule

Only website/Platform-owned content is migrated here. Platform owns the public
website, account and entitlement services, operator UI, local compose stack, and
Platform-side Gateway integration contracts.

## Migrated content

- Root Node/TypeScript workspace config.
- `web/`, `core/`, `worker/`, `executor/`.
- `packages/` and `services/` workspaces required by the website/account stack.
- Platform deployment files under `deploy/`, excluding Gateway-only build and release helpers.
  - Included Platform-owned helpers: local preview, account/core/worker/web
    Dockerfiles, heavy-task coordination scripts, local Gateway debug bootstrap
    scripts, and provider credential file materialization helpers that operate
    against Gateway APIs or `~/.neuro`.
  - Excluded Gateway-owned helpers: Gateway image build/push/rollout scripts,
    splitter binary release scripts, Gateway line validators, protocol matrix
    fixtures, and provider relay implementation test assets.
- `infra/`, `design-system/`, `rules/`, and Platform/product/engineering docs.
- A limited `docs/20-ai-gateway/` subset needed for Platform to understand Gateway integration contracts.

## Excluded content

- `gateway/` Rust Gateway source, manifests, provider relay code, and browser-worker runtime.
- Gateway-only scripts such as protocol matrix fixtures, Gateway image release helpers, and Gateway line validators.
- Generated output: `node_modules/`, `.next/`, `dist/`, `build/`, `.runtime/`, `output/`, `test-results/`, `__pycache__/`.
- Real secrets and local runtime env files: `.env`, `.env.*`, `.env.local`.
- Historical or external projects: `api-old/`, `AIRead/`, `jshook/`, `plans-old/`.

## Gateway boundary

`deploy/docker-compose.local.yml` keeps a local `gateway` service for integrated
Platform preview, but the service builds from sibling `../../Gateway` relative to
`Platform/deploy/`. Platform does not vendor or copy Gateway source.

When a Platform helper needs Gateway state, it must call the local Rust Gateway
management API, write canonical credential material under `~/.neuro`, or rely on
the compose `gateway` service. It must not reintroduce Gateway source, manifests,
line validators, release scripts, or provider relay internals into `Platform/`.
