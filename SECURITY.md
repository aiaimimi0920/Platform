# Security Policy

## Reporting

Report suspected vulnerabilities through GitHub's private security advisory
flow for `aiaimimi0920/Platform`. Do not open a public issue containing tokens,
credentials, private endpoints, customer data, or exploit details.

If private advisory access is unavailable, open a minimal issue that requests a
private contact channel without including sensitive technical details.

## Secret Handling

- Never commit real `.env` files, provider credentials, GitHub tokens, private
  keys, browser state, cookies, database dumps, or runtime evidence.
- Values such as `local-internal-token` are development-only fixtures and must
  be replaced in every non-local deployment.
- Revoke exposed credentials before removing them from source. Redaction alone
  does not invalidate an already disclosed credential.
