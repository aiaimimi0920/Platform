import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

import {
  validateManagedHeavyAgentInput,
  type ManagedHeavyAgentValidationInput,
} from "./managed-heavy-validation";
import { HttpError } from "../../platform/errors";

function validManagedHeavy(
  overrides: Partial<ManagedHeavyAgentValidationInput> = {},
): ManagedHeavyAgentValidationInput {
  return {
    sourceType: "platform",
    hostingMode: "managed_heavy",
    runtimeEndpoint: null,
    authMode: "none",
    runtimeAuthToken: null,
    managedServiceId: null,
    managedProviderLabel: null,
    managedApiBaseUrl: null,
    managedModel: null,
    managedApiKey: null,
    managedSystemPrompt: null,
    managedPromptTemplate: null,
    managedTaskCategory: null,
    managedCapabilitySummary: null,
    ...overrides,
  };
}

function isBadRequest(error: unknown) {
  return error instanceof HttpError && error.statusCode === 400 && error.code === "BAD_REQUEST";
}

test("managed-heavy validation accepts only a Platform-owned heavy agent", () => {
  assert.doesNotThrow(() => validateManagedHeavyAgentInput(validManagedHeavy()));

  assert.throws(
    () => validateManagedHeavyAgentInput(validManagedHeavy({ sourceType: "external" })),
    (error: unknown) => isBadRequest(error) && /platform-owned/i.test((error as Error).message),
  );
});

test("managed-heavy validation rejects runtime auth and managed-light execution fields", () => {
  const forbiddenInputs: Array<[string, Partial<ManagedHeavyAgentValidationInput>]> = [
    ["runtimeEndpoint", { runtimeEndpoint: "https://runtime.invalid" }],
    ["authMode", { authMode: "bearer", runtimeAuthToken: "secret" }],
    ["runtimeAuthToken", { runtimeAuthToken: "secret" }],
    ["managedServiceId", { managedServiceId: "benefit-service" }],
    ["managedProviderLabel", { managedProviderLabel: "external-provider" }],
    ["managedApiBaseUrl", { managedApiBaseUrl: "https://api.invalid" }],
    ["managedModel", { managedModel: "external-model" }],
    ["managedApiKey", { managedApiKey: "secret" }],
    ["managedSystemPrompt", { managedSystemPrompt: "managed-light-system" }],
    ["managedPromptTemplate", { managedPromptTemplate: "managed-light-template" }],
    ["managedTaskCategory", { managedTaskCategory: "managed-light-task" }],
    ["managedCapabilitySummary", { managedCapabilitySummary: "managed-light-capability" }],
  ];

  for (const [field, override] of forbiddenInputs) {
    assert.throws(
      () => validateManagedHeavyAgentInput(validManagedHeavy(override)),
      (error: unknown) => isBadRequest(error) && (error as Error).message.includes(field),
      field,
    );
  }
});

test("agent registry service delegates managed-heavy creation validation", async () => {
  const serviceSource = await readFile(path.resolve(__dirname, "service.ts"), "utf8");
  assert.match(serviceSource, /managed-heavy-validation/);
  assert.match(serviceSource, /validateManagedHeavyAgentInput\(input\)/);
  assert.doesNotMatch(serviceSource, /Platform heavy agents are not available yet/);
});
