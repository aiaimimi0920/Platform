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
  packages/Platform-<versionId>-container-images.json       # tagged workflow only
  packages/Platform-<versionId>-container-images.json.sha256 # tagged workflow only
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

The builder derives a reproducible timestamp from `-SourceDateEpoch`,
`SOURCE_DATE_EPOCH`, or the current Git commit time, in that order. It uses that
timestamp for release metadata and every ZIP entry, and uses `versionId` as the
Next.js build ID. Rebuilding the same source with the same version and source
timestamp must produce identical ZIP, manifest, and checksum-list hashes.

## GitHub Release

Tags matching `V*.*.*` are built from a checkout pinned to the tag's resolved
commit. A release is published only after quick repository validation, required
integration suites, package verification, runtime smoke, and an unchanged-tag
check pass.

The tagged release must also resolve exactly one successful `Container Images`
push run whose `head_sha` and tag ref match that pinned commit. It downloads the
aggregate artifact named with that run ID and run attempt, then revalidates the lock schema,
canonical six-image order, immutable GHCR references, repository, revision, tag,
run ID, run attempt, and `linux/amd64` platform. Missing, failed, ambiguous,
cross-revision, cross-tag, or cross-run results block publication.

Published assets are the Web zip and SHA-256 sidecar, the validated immutable
container lock and SHA-256 sidecar, `manifest.json`, and `checksums.sha256`. The
container lock is added by the tagged GitHub workflow after the standalone Web
package has passed its verifier and runtime smoke; generated non-tag builds do
not synthesize container provenance.
