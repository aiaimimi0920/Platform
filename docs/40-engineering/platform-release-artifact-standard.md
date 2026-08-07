# Platform Release Artifact Standard

## Scope

This document defines the standalone Platform repository's Web release package.
Cross-application release aggregation remains owned by the parent Neuro
workspace, but it must consume the Platform-owned package and verifier contract.

## Layout

Each build writes an immutable version directory:

```text
release/Platform/<versionId>/
  BUILD_INFO.txt
  checksums.sha256
  manifest.json
  logs/
  packages/Platform-<versionId>-web-next.zip
  packages/Platform-<versionId>-web-next.zip.sha256
  web/
  packages/contracts/
```

`versionId` may be an explicit release tag or a generated
`yyyyMMdd-HHmmss-<shortSha>` identifier. It must contain only letters, numbers,
dot, underscore, and dash.

## Commands

Build, verify, and runtime-smoke the package on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-platform-web-release.ps1 -VersionId <versionId>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>
```

The builder compiles `@neuro/contracts` before `web`, records both command logs,
copies the production Next.js server/static output plus the required workspace
metadata, and generates SHA-256 records. The verifier rejects missing payload,
hash drift, and excluded generated/runtime directories. The smoke script extracts
the zip, installs production dependencies from the lockfile, starts the packaged
Web workspace on an isolated loopback port, probes `/ready`, records evidence,
and stops only the process tree it created.

## GitHub Release

Tags matching `V*.*.*` are built from the tagged commit. A release is published
only after quick repository validation, package verification, and runtime smoke
pass. Published assets are the Web zip, its SHA-256 sidecar, `manifest.json`, and
`checksums.sha256`.
