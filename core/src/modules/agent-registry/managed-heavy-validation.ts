import { HttpError } from "../../platform/errors";

export type ManagedHeavyAgentValidationInput = {
  sourceType: string;
  hostingMode?: string | null;
  runtimeEndpoint?: string | null;
  authMode?: string | null;
  runtimeAuthToken?: string | null;
  managedServiceId?: string | null;
  managedProviderLabel?: string | null;
  managedApiBaseUrl?: string | null;
  managedModel?: string | null;
  managedApiKey?: string | null;
  managedSystemPrompt?: string | null;
  managedPromptTemplate?: string | null;
  managedTaskCategory?: string | null;
  managedCapabilitySummary?: string | null;
};

const managedHeavyExecutionFields = [
  "managedServiceId",
  "managedProviderLabel",
  "managedApiBaseUrl",
  "managedModel",
  "managedApiKey",
  "managedSystemPrompt",
  "managedPromptTemplate",
  "managedTaskCategory",
  "managedCapabilitySummary",
] as const;

export function validateManagedHeavyAgentInput(input: ManagedHeavyAgentValidationInput) {
  if (input.sourceType !== "platform" || input.hostingMode !== "managed_heavy") {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "managed_heavy agents must be Platform-owned and cannot use an external runtime",
    );
  }
  if (input.runtimeEndpoint?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "managed_heavy agent cannot set runtimeEndpoint");
  }
  if (input.authMode && input.authMode !== "none") {
    throw new HttpError(400, "BAD_REQUEST", "managed_heavy agent cannot set authMode to a runtime auth mode");
  }
  if (input.runtimeAuthToken?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "managed_heavy agent cannot set runtimeAuthToken");
  }
  for (const field of managedHeavyExecutionFields) {
    const value = input[field];
    if (typeof value === "string" && value.trim()) {
      throw new HttpError(400, "BAD_REQUEST", `managed_heavy agent cannot set ${field}`);
    }
  }
  return true;
}
