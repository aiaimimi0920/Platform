import type { AccountWorkerHealthResponse, AccountWorkerHealthView } from "@neuro/contracts";

const accountWorkerInternalUrl = process.env.ACCOUNT_WORKER_INTERNAL_URL || "http://127.0.0.1:7303";
const internalApiToken = process.env.INTERNAL_API_TOKEN || "";

export async function getAccountWorkerHealth(): Promise<AccountWorkerHealthView> {
  const response = await fetch(`${accountWorkerInternalUrl}/health`, {
    headers: internalApiToken
      ? {
          "x-internal-api-token": internalApiToken,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Account worker health request failed: ${response.status}`);
  }

  const payload = (await response.json()) as AccountWorkerHealthResponse;
  return payload.state;
}
