import { readLoomNativeBody } from "./loom-native-request-body";

type ProjectionRequest = (path: string, options: { method: "POST"; body: unknown }) => Promise<unknown>;
const codes = new Set([
  "device_session_unavailable", "device_clock_skew", "device_proof_replayed", "invalid_device_proof",
  "projection_not_configured", "projection_invalid_request", "projection_invalid_invitation",
  "projection_invalid_endpoint", "projection_access_denied", "projection_source_mismatch",
  "projection_invitation_expired", "projection_not_found", "projection_stopped", "projection_conflict",
  "projection_already_linked", "projection_revision_conflict", "projection_retry_required", "projection_limit_reached",
  "projection_peer_unavailable",
]);

export async function handleLoomProjectionRequest(request: Request, send: ProjectionRequest): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const fail = (status: number, code: string) => Response.json({ error: { code } }, { status, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail(403, "origin_denied");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail(415, "json_required");
  let body: unknown;
  try { body = await readLoomNativeBody(request, 16 * 1024); }
  catch (error) {
    return fail(error instanceof Error && error.message === "request_too_large" ? 413 : 400, "projection_invalid_request");
  }
  try {
    const result = await send("/internal/loom-projections", { method: "POST", body });
    return Response.json(result, { headers });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    return fail(typeof status === "number" && [400, 401, 403, 404, 409, 429].includes(status) ? status : 503,
      typeof code === "string" && codes.has(code) ? code : "projection_request_failed");
  }
}
