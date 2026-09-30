// Native device proofs cross the public BFF; Web cookies authorize only the approval page.
import { readLoomNativeBody } from "./loom-native-request-body";
export type LoomAccountAction = "exchange" | "status" | "revoke";
type AccountRequest = (path: string, options: { method: "POST"; body: unknown }) => Promise<unknown>;

export async function handleLoomAccountRequest(request: Request, action: string, send: AccountRequest) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const fail = (status: number, code: string) => Response.json({ error: { code } }, { status, headers });
  if (!["exchange", "status", "revoke"].includes(action)) return fail(404, "not_found");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail(403, "origin_denied");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return fail(415, "json_required");
  }
  let payload: unknown;
  try { payload = await readLoomNativeBody(request, 4096); }
  catch (error) {
    return fail(error instanceof Error && error.message === "request_too_large" ? 413 : 400, "invalid_request");
  }
  try {
    const result = await send(`/internal/loom-account/${action}`, { method: "POST", body: payload });
    return Response.json(result, { headers });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    return fail(typeof status === "number" && [400, 401, 409, 429].includes(status) ? status : 503,
      code === "device_session_unavailable" || code === "device_clock_skew" ? code : "account_request_failed");
  }
}
