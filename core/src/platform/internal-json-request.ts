import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";

import { parseJsonObjectResponseText } from "@/platform/json";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const CORE_INTERNAL_JSON_RESPONSE_MAX_BYTES = 1_048_576;

export async function requestInternalJson(
  input: string | URL | Request,
  init: RequestInit,
  options: {
    timeoutMs: number;
    timeoutMessage?: string;
    maxBodyBytes?: number;
    fetchFn?: FetchLike;
  },
): Promise<{ response: Response; payload: Record<string, unknown> | null }> {
  const { response, text } = await requestInternalText(input, init, {
    timeoutMs: options.timeoutMs,
    timeoutMessage: options.timeoutMessage,
    maxBodyBytes: options.maxBodyBytes ?? CORE_INTERNAL_JSON_RESPONSE_MAX_BYTES,
    fetchFn: options.fetchFn,
  });
  return { response, payload: parseJsonObjectResponseText(response, text) };
}
