# Contributing

## Prerequisites

- Node.js 22 or newer
- npm with lockfile support
- Docker with Compose v2 for topology and acceptance checks
- PowerShell 7 or Windows PowerShell for release packaging

## Validation

Install exactly from the lockfile and run the standalone repository gate:

```powershell
npm ci
npm run ci
docker compose -f deploy/docker-compose.local.yml config --quiet
```

Run focused workspace tests while developing, then run the smallest complete
gate that covers the changed boundary. Do not claim external provider or browser
surfaces are complete without the evidence required by `AGENTS.md` and `rules/`.

## Pull Requests

- Keep Platform-owned code inside this repository. Gateway relay/runtime code
  belongs in the independent Gateway repository.
- Update canonical documentation in the same change as architecture, deployment,
  product-rule, or workflow changes.
- Do not include local runtime output, generated build trees, or credentials.
- Describe the commands actually run and any validation that was not feasible.
