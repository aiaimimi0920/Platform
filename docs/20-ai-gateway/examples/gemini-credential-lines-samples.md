# Gemini second-line and third-line credential samples

These files are sample **raw import payloads** for the Gemini provider lines.

They are meant to show what an external program can produce **before** the gateway normalizes the payload into its internal provider-credential row shape.

## Files

- Second line, Gemini Web Reverse:
  - `docs/20-ai-gateway/examples/gemini-web-reverse-credential.raw.sample.json`
- Third line, Gemini Canvas Web Reverse bootstrap form:
  - `docs/20-ai-gateway/examples/gemini-canvas-program-credential.bootstrap.raw.sample.json`
- Third line, Gemini Canvas Web Reverse fully materialized inspection sample:
  - `docs/20-ai-gateway/examples/gemini-canvas-program-credential.materialized.raw.sample.json`

## What program B should create

### If program B is only responsible for line 2

Program B should emit the second-line sample shape:

- required:
  - `__Secure-1PSID`
- strongly recommended:
  - `__Secure-1PSIDTS`
  - `cookieHeader`
  - `credentialMaterialKey`
- optional bootstrap helpers:
  - `defaultModel`
  - `accessToken`
  - `buildLabel`
  - `sessionId`
  - `language`
  - `requestContextHeader`

### If program B wants to bootstrap line 3

The minimal useful third-line bootstrap payload is the bootstrap sample shape:

- required:
  - `runtimeStateObjectKey`
- strongly recommended:
  - `shareId`
  - `shareUrl`
  - `cookieHeader`
  - `credentialMaterialKey`
- optional:
  - `apiBaseUrl`
  - `canvasProgramOperation`

However, when the gateway already owns a canonical Gemini Canvas bootstrap configuration, the preferred long-term split is:

- program B still only outputs the line 2 source credential
- `shareId/shareUrl` are provided by gateway-side bootstrap config
- the gateway materializes the concrete Canvas app at request time

Current repo baseline example:

- `shareId = fe24c455a570`
- `shareUrl = https://gemini.google.com/share/fe24c455a570`

This is the key point:

- third line does **not** need an official Google API key
- third line **can** reuse the same Gemini web session family as line 2
- but it must additionally provide enough material for:
  - `share -> app` bootstrap
  - then derive:
    - `canvasProgramUrl`
    - `appPath`
    - `conversationId`
    - `responseId`
    - `canvasProgramInvokeContract`

### If program B can already materialize the Canvas app

Then it can emit the fully materialized third-line sample shape:

- `runtimeStateObjectKey`
- `shareId`
- `canvasProgramUrl`
- `appPath`
- `conversationId`
- `responseId`
- `canvasProgramInvokeContract`
- optional history and hint fields such as:
  - `candidatePairs`
  - `aggregateHints`
  - `lastSeenConversationId`
  - `lastSeenResponseId`
  - `capturedAt`
  - `lastValidatedAt`

## Important boundary

Second line and third line may share the same underlying Gemini web session material, but they are still different lines:

- line 2 owner = generic Gemini web chatbox
- line 3 owner = concrete Canvas app / program contract

So:

- line 2 session material may be reused as line 3 bootstrap auth material
- `shareId/shareUrl` are better understood as bootstrap config than as per-user secret credential fields
- but once line 3 has materialized the Canvas app, steady-state invocation must stay on the Canvas program contract
- it must not fall back to chatbox mode selection or prompt submission
