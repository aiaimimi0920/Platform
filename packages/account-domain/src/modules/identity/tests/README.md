# Identity tests

- `rauthy-model.test.ts`: bounded claim parsing; exact issuer/provider gates;
  HTTPS and explicit synthetic loopback policy; truthful optional email metadata
- `rauthy.integration.test.ts`: isolated PostgreSQL transactions, concurrent
  first sign-in, repeat/rename, rollback, no email/username/legacy linking,
  old/new summary and profile paths, internal route auth and feature gates,
  uniqueness and foreign-key constraints

Run through `npm run test:integration:identity --workspace @neuro/account-domain`.
The fixture creates its own temporary database and uses synthetic identities only.
See `docs/40-engineering/rauthy-account-identity.md` for the trust boundary.
