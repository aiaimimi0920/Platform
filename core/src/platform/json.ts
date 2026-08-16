export class JsonResponseProtocolError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, detail: string) {
    super(`Successful HTTP ${statusCode} response violated the JSON object contract: ${detail}`);
    this.name = "JsonResponseProtocolError";
    this.statusCode = statusCode;
  }
}

export function safeJsonStringify(value: unknown) {
  if (value == null) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export function parseJsonObjectResponseText(
  response: Response,
  rawText: string,
): Record<string, unknown> | null {
  if (!rawText.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    if (response.ok) {
      throw new JsonResponseProtocolError(response.status, "body is not valid JSON");
    }
    return { rawText };
  }

  if (parsed === null) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  if (response.ok) {
    throw new JsonResponseProtocolError(response.status, "body is not a JSON object");
  }
  return { rawText };
}
