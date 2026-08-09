# AI Gateway Domain Migrations

This directory contains the Platform-side transitional AI Gateway domain schema migrations.
The long-term Gateway runtime remains owned by the independent sibling Gateway repository.

Rules:

- Run with `npm run db:migrate --workspace @neuro/ai-gateway-domain`.
- Applied files are recorded in `gateway_schema_migrations`.
- Concurrent Gateway-domain runner instances serialize through the database-scoped `neuro-gateway-schema-migrations` session advisory lock.
- The lock is held by the same PostgreSQL client for the complete runner and released before the pool closes.
- Each ordinary migration executes in its own transaction and records its file name only after the SQL succeeds.
- Do not edit an already applied historical migration to repair a deployment. Add a forward migration instead.
- Do not add `CREATE INDEX CONCURRENTLY` until the shared runner defines an explicit no-transaction migration contract.
