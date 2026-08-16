import type {
  CredentialAssignmentOperatorView,
  CredentialEntryView,
  CredentialOperatorCatalogView,
  CredentialProviderKey,
  CredentialRepairClaimView,
  CredentialResolvedPayloadView,
  CredentialTerminalUploadInput,
  CredentialTerminalView,
  CredentialUploadBatchView,
  InternalUserContext,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function listOperatorCredentialPoolCatalog(userContext: InternalUserContext) {
  const response = await accountRequest<{ catalog: CredentialOperatorCatalogView }>(
    "/v1/internal/credential-pools/catalog",
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function createOperatorCredentialTerminal(
  userContext: InternalUserContext,
  input: { providerKey: CredentialProviderKey; label: string; note?: string | null },
) {
  const response = await accountRequest<{
    issued: {
      terminal: CredentialTerminalView;
      plainToken: string;
    };
  }>("/v1/internal/credential-pools/terminals", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.issued;
}

export async function revokeOperatorCredentialTerminal(userContext: InternalUserContext, terminalId: string) {
  const response = await accountRequest<{ terminal: CredentialTerminalView }>(
    `/v1/internal/credential-pools/terminals/${encodeURIComponent(terminalId)}/revoke`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.terminal;
}

export async function importOperatorCredentialPool(
  userContext: InternalUserContext,
  input: CredentialTerminalUploadInput,
) {
  const response = await accountRequest<{ batch: CredentialUploadBatchView }>(
    "/v1/internal/credential-pools/import",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.batch;
}

export async function claimOperatorCredentialRepair(userContext: InternalUserContext, entryId: string) {
  const response = await accountRequest<{ claim: CredentialRepairClaimView }>(
    `/v1/internal/credential-pools/repair/${encodeURIComponent(entryId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.claim;
}

export async function releaseOperatorCredentialRepair(userContext: InternalUserContext, claimId: string) {
  const response = await accountRequest<{ claim: CredentialRepairClaimView }>(
    `/v1/internal/credential-pools/repair/claims/${encodeURIComponent(claimId)}/release`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.claim;
}

export async function markOperatorCredentialCooling(
  userContext: InternalUserContext,
  entryId: string,
  input: { cooldownMinutes: number; reason?: string | null },
) {
  const response = await accountRequest<{ entry: CredentialEntryView }>(
    `/v1/internal/credential-pools/entries/${encodeURIComponent(entryId)}/cooling`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.entry;
}

export async function markOperatorCredentialInvalid(
  userContext: InternalUserContext,
  entryId: string,
  input: { reason: string },
) {
  const response = await accountRequest<{ entry: CredentialEntryView }>(
    `/v1/internal/credential-pools/entries/${encodeURIComponent(entryId)}/invalid`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.entry;
}

export async function markOperatorCredentialDeath(
  userContext: InternalUserContext,
  entryId: string,
  input: { reason: string },
) {
  const response = await accountRequest<{ entry: CredentialEntryView }>(
    `/v1/internal/credential-pools/entries/${encodeURIComponent(entryId)}/death`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.entry;
}

export async function rotateOperatorCredentialAssignment(
  userContext: InternalUserContext,
  serviceId: string,
  userId: string,
) {
  const response = await accountRequest<{ assignment: CredentialAssignmentOperatorView | null }>(
    `/v1/internal/credential-pools/assignments/${encodeURIComponent(serviceId)}/${encodeURIComponent(userId)}/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.assignment;
}

export async function resolveUserCredential(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ credential: CredentialResolvedPayloadView }>(
    `/v1/me/credential-pools/services/${encodeURIComponent(serviceId)}/credential`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.credential;
}

export async function rotateUserCredential(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ credential: CredentialResolvedPayloadView }>(
    `/v1/me/credential-pools/services/${encodeURIComponent(serviceId)}/credential/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.credential;
}
