# Platform Release Artifact Standard

## Scope and output boundary

This document defines the complete standalone Platform release. The only
permitted product output root is the sibling workspace directory
`../release/Platform/`; the complete release builder rejects the historical
repository-local `Platform/release/Platform/` path and every other override.

The Web-only PowerShell builder remains a component packaging primitive and a
tag-workflow compatibility contract. A complete release is produced only by
`npm run release:build` after a clean, current Platform acceptance run.

## Complete layout

Each successful build atomically publishes one immutable version directory:

```text
../release/Platform/<versionId>/
  release-manifest.json
  manifest.json                         # Web component manifest
  BUILD_INFO.txt
  checksums.sha256
  packages/Platform-<versionId>-web-next.zip
  packages/Platform-<versionId>-web-next.zip.sha256
  web/
  images/inventory.json
  oci/<image>/                          # offline OCI mode only, six layouts
  migrations/
    migration-order.json
    core/*.sql
    ai-gateway-domain/*.sql
    account-domain/*.sql
  deployment/
    docker-compose.yml
    k8s/
    tofu/
  environment/*.env.example
  sbom/dependency-inventory.json
  evidence/acceptance-manifest.json
  evidence/<referenced-redacted-artifacts>
```

`versionId` is one safe path segment containing letters, numbers, dots,
underscores, or dashes. Existing destinations are never replaced. The builder
assembles a unique staging directory under the canonical root, validates and
scans it, writes the final checksum inventory, and only then renames it to the
version directory. Failure removes only that staging directory.

## Required inputs and commands

Run acceptance from the exact clean commit to be released:

```powershell
npm run acceptance:ci -- --run-id release-<versionId>
```

Then provide exactly one immutable six-image source.

Offline OCI layouts (no registry push):

```powershell
npm run release:build -- `
  --version-id <versionId> `
  --acceptance-manifest .runtime/acceptance/release-<versionId>/acceptance-manifest.json `
  --oci-layout-root .runtime/release-images/<versionId>
```

Already-published and validated image lock:

```powershell
npm run release:build -- `
  --version-id <versionId> `
  --acceptance-manifest .runtime/acceptance/release-<versionId>/acceptance-manifest.json `
  --image-lock .runtime/release-image-lock/image-lock.json
```

`--output-root` is optional and exists for explicit automation; when supplied it
must resolve to the same canonical `../release/Platform` directory. The builder
does not push images or modify a registry.

## Gates

The builder blocks publication unless all of the following are true:

- current Git is clean and its commit matches clean acceptance metadata;
- acceptance status is `passed`, all required suites passed, and every external
  boundary suite either passed or has an evidence-backed `not-applicable`
  classification;
- acceptance counters match individual result records and every copied evidence
  path stays under the declared evidence directory;
- all six Platform-owned images exist in canonical order for `linux/amd64` and
  have either a verified fixed digest or a digest-verified OCI manifest blob;
- Web package provenance matches the same clean commit;
- Core, AI Gateway domain, and Account domain migrations are copied in runtime
  execution order, with files listed in ordinal lexical filename order;
- Compose has immutable images and contains neither `build:` nor a source bind
  mount; Kustomize uses the actual `neuro-platform-*` published repositories and
  release image digests;
- OpenTofu state, `.terraform`, backend credentials, and real environment files
  are excluded;
- only manifest-referenced UTF-8 text evidence is copied and redacted; credential
  canaries, GitHub tokens, bearer values, and private-key material fail the scan;
- dependency inventory and a SHA-256 record for every release file are present.

Gateway and Traefik images, PostgreSQL, Valkey, object storage, Tea, OAuth, and
public DNS/TLS remain explicit external deployment dependencies. Their source
code and credentials are not copied into the Platform release and Platform does
not claim ownership of their artifacts.

## Component Web package and GitHub tags

The component builder, verifier, and runtime smoke remain available on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-platform-web-release.ps1 -VersionId <versionId>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>
```

The tag workflow pins the tag commit, validates the six-image lock from the exact
Container Images run, and publishes the Web component assets. That hosted asset
publication does not by itself prove the complete release or artifact-only full
stack smoke; those are the P5-03 and P5-04 contracts respectively.

## Artifact-only runtime smoke

Run the complete package smoke outside the immutable release directory:

```powershell
npm run acceptance:release -- `
  --package-dir ../release/Platform/<versionId> `
  --run-id release-smoke-<versionId> `
  --evidence-path .runtime/acceptance/release-smoke-<versionId>/release-smoke.json
```

The smoke rejects incomplete checksum coverage, modified files, inconsistent
release/image manifests, mutable or missing Platform image references, extra
services, source build contexts, bind mounts, Compose includes/extends, and
develop watches before startup. Fixed-digest mode consumes the published
immutable references. Offline OCI mode imports each packaged layout through a
BuildKit `oci-layout://` context into an exact run-scoped temporary tag; it never
uses the Platform checkout or a sibling repository as a build context.
On Windows, the client URI is relative to the run-owned smoke resources so a
drive letter cannot be misparsed as an image reference; the canonical sibling
release and smoke resources therefore must remain on the same drive.

Runtime dependencies are an isolated, generated Compose override containing
digest-pinned PostgreSQL, Valkey, MinIO, MinIO Client, and a minimal Gateway
fixture. Runtime configuration is generated outside the package with restrictive
file permissions. The smoke runs the packaged migration jobs, waits for the six
Platform services, verifies semantic Core/Account/Web readiness plus the formal
Linux.do login entry, captures process inventory, and writes secret-free JSON
evidence. Cleanup always addresses the exact hashed Compose project, exact named
volumes, and exact temporary OCI tags; an owner record and runtime configuration
are retained if cleanup cannot complete so recovery can remain narrowly scoped.

`P5-04` is complete only after this command passes against the final release
package and the evidence reports `status: passed` with `cleanup.completed: true`.
