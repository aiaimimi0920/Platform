# Platform OpenTofu environments

This directory owns the Platform-only GCP network and compute resources plus
Cloudflare DNS records for `staging` and `production`. The two environments use
different resource prefixes, subnets, and GCS state prefixes.

## Toolchain and offline-safe validation

The supported OpenTofu version is pinned in `/.opentofu-version`. Run the same
format and provider-schema gate used by CI from the repository root:

```text
npm run infra:tofu:validate
```

The validator runs `tofu fmt -check`, then initializes each environment with
`-backend=false` and validates it against the locked provider schemas. It does
not contact the configured GCS backend, inspect cloud resources, produce a
plan, or apply infrastructure. Set `TOFU_BIN` when `tofu` is not on `PATH`.

## Remote state initialization

Each environment declares only a stable GCS object prefix in `backend.tf`.
Bucket selection remains an explicit operator input so staging and production
cannot silently share state.

1. Provision a dedicated GCS state bucket with versioning, retention, uniform
   bucket-level access, and the required encryption policy.
2. Copy `backend.hcl.example` to ignored `backend.hcl` in the selected
   environment and replace the bucket placeholder.
3. Initialize the selected environment explicitly:

```text
tofu -chdir=infra/tofu/environments/staging init -backend-config=backend.hcl
```

Do not commit `backend.hcl`, `terraform.tfvars`, state files, credentials, or
tokens. Supply the Cloudflare token through a protected runtime variable such
as `TF_VAR_cloudflare_api_token`; keep other deployment inputs in an ignored,
access-controlled variable file or an approved secret manager.

## Deployment boundary

Real `plan` and `apply` operations require reviewed GCP and Cloudflare
credentials and environment-specific non-placeholder values. They are
intentionally outside the CI validation gate. The environment outputs expose
the non-secret network, node, persistent-disk, service-account, and DNS values
needed by later k3s and deployment steps. DNS currently targets the declared
control-plane public address; it is not evidence that a live cluster ingress
or application endpoint exists.
