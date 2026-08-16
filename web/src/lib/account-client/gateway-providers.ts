import type {
  InternalUserContext,
  GatewayProviderInventoryView,
  GatewayProviderModelTieringView,
  GatewayProviderAccountView,
  GatewayProviderCredentialFolderSyncStatusView,
  GatewayProviderCredentialView,
  GatewayProviderQuotaView,
  GatewayProviderSourceProfile,
  GatewayProviderSourceProfileBackfillResult,
  PatchGatewayProviderCredentialInput,
  PatchGatewayProviderModelPricingInput,
  PatchGatewayProviderSourceProfileInput,
  UpsertGatewayProviderCredentialInput,
  UpsertGatewayProviderAccountInput,
} from "@neuro/contracts";

import { gatewayRequest } from "@/lib/gateway-request";

export async function getOperatorGatewayProviderInventory(userContext: InternalUserContext) {
  const response = await gatewayRequest<{ inventory: GatewayProviderInventoryView }>(
    "/v1/internal/gateway/provider-inventory",
    {
      userContext,
    },
  );
  return response.inventory;
}

export async function getOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{
    providerAccount: GatewayProviderAccountView;
    providerQuota: GatewayProviderQuotaView | null;
  }>(`/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}`, {
    userContext,
  });
  return response;
}

export async function getOperatorGatewayProviderModelTiering(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{ result: GatewayProviderModelTieringView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/model-tiering`,
    {
      userContext,
    },
  );
  return response.result;
}

export async function getOperatorGatewayProviderQuota(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/quota`,
    {
      userContext,
    },
  );
  return response.providerQuota;
}

export async function refreshOperatorGatewayProviderQuota(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/quota`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.providerQuota;
}

type RustGatewayProviderAccountBody = Omit<UpsertGatewayProviderAccountInput, "sourceProfile"> & {
  sourceKind?: GatewayProviderSourceProfile["sourceKind"];
  aggregatorApiMode?: GatewayProviderSourceProfile["aggregatorApiMode"];
  webReverseAccessMode?: GatewayProviderSourceProfile["webReverseAccessMode"];
  sourceNotes?: GatewayProviderSourceProfile["notes"];
};

function toRustGatewayProviderAccountBody(input: UpsertGatewayProviderAccountInput): RustGatewayProviderAccountBody {
  const { sourceProfile, ...rest } = input;
  if (!sourceProfile) {
    return rest;
  }
  return {
    ...rest,
    sourceKind: sourceProfile.sourceKind,
    aggregatorApiMode: sourceProfile.aggregatorApiMode ?? null,
    webReverseAccessMode: sourceProfile.webReverseAccessMode ?? null,
    sourceNotes: sourceProfile.notes ?? null,
  };
}

export async function createOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  input: UpsertGatewayProviderAccountInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    "/v1/internal/gateway/provider-accounts",
    {
      method: "POST",
      userContext,
      body: toRustGatewayProviderAccountBody(input),
    },
  );
  return response.providerAccount;
}

export async function updateOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: UpsertGatewayProviderAccountInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}`,
    {
      method: "POST",
      userContext,
      body: toRustGatewayProviderAccountBody(input),
    },
  );
  return response.providerAccount;
}

export async function updateOperatorGatewayProviderModelPricing(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: PatchGatewayProviderModelPricingInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/model-pricing`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.providerAccount;
}

export async function deleteOperatorGatewayProviderAccount(
  userContext: InternalUserContext,
  providerAccountId: string,
) {
  const response = await gatewayRequest<{
    deleted: true;
    providerAccountId: string;
    label: string;
    deletedCredentialCount: number;
  }>(`/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}`, {
    method: "DELETE",
    userContext,
  });
  return response;
}

export async function listOperatorGatewayProviderCredentials(
  userContext: InternalUserContext,
  providerAccountId: string,
  input?: { maskSecrets?: boolean },
) {
  const params = new URLSearchParams();
  if (typeof input?.maskSecrets === "boolean") {
    params.set("maskSecrets", input.maskSecrets ? "true" : "false");
  }
  const pathname = params.size
    ? `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/credentials?${params.toString()}`
    : `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/credentials`;
  const response = await gatewayRequest<{
    providerAccount: GatewayProviderAccountView;
    credentials: GatewayProviderCredentialView[];
  }>(pathname, {
    userContext,
  });
  return response;
}

export async function createOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: UpsertGatewayProviderCredentialInput,
) {
  const response = await gatewayRequest<{ providerCredential: GatewayProviderCredentialView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/credentials`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.providerCredential;
}

export async function getOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerCredentialId: string,
  input?: { maskSecrets?: boolean },
) {
  const params = new URLSearchParams();
  if (typeof input?.maskSecrets === "boolean") {
    params.set("maskSecrets", input.maskSecrets ? "true" : "false");
  }
  const pathname = params.size
    ? `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}?${params.toString()}`
    : `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}`;
  const response = await gatewayRequest<{ providerCredential: GatewayProviderCredentialView }>(
    pathname,
    {
      userContext,
    },
  );
  return response.providerCredential;
}

export async function patchOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerCredentialId: string,
  input: PatchGatewayProviderCredentialInput,
) {
  const response = await gatewayRequest<{ providerCredential: GatewayProviderCredentialView }>(
    `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}`,
    {
      method: "PUT",
      userContext,
      body: input,
    },
  );
  return response.providerCredential;
}

export async function deleteOperatorGatewayProviderCredential(
  userContext: InternalUserContext,
  providerCredentialId: string,
) {
  const response = await gatewayRequest<{
    success: true;
    providerCredentialId: string;
    providerAccountId: string;
    message: string;
  }>(`/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}`, {
    method: "DELETE",
    userContext,
  });
  return response;
}

export async function getOperatorGatewayProviderCredentialQuota(
  userContext: InternalUserContext,
  providerCredentialId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}/quota`,
    {
      userContext,
    },
  );
  return response.providerQuota;
}

export async function refreshOperatorGatewayProviderCredentialQuota(
  userContext: InternalUserContext,
  providerCredentialId: string,
) {
  const response = await gatewayRequest<{ providerQuota: GatewayProviderQuotaView | null }>(
    `/v1/internal/gateway/provider-credentials/${encodeURIComponent(providerCredentialId)}/quota`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.providerQuota;
}

export async function getOperatorGatewayProviderCredentialFolderSyncStatus(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/status",
    {
      userContext,
    },
  );
  return response.status;
}

export async function setOperatorGatewayProviderCredentialFolderSyncEnabled(
  userContext: InternalUserContext,
  enabled: boolean,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/status",
    {
      method: "PUT",
      userContext,
      body: { enabled },
    },
  );
  return response.status;
}

export async function importOperatorGatewayProviderCredentialsFromFolder(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/import",
    {
      method: "POST",
      userContext,
    },
  );
  return response.status;
}

export async function exportOperatorGatewayProviderCredentialsToFolder(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ status: GatewayProviderCredentialFolderSyncStatusView }>(
    "/v1/internal/gateway/provider-credentials/folder-sync/export",
    {
      method: "POST",
      userContext,
    },
  );
  return response.status;
}

export async function patchOperatorGatewayProviderSourceProfile(
  userContext: InternalUserContext,
  providerAccountId: string,
  input: PatchGatewayProviderSourceProfileInput,
) {
  const response = await gatewayRequest<{ providerAccount: GatewayProviderAccountView }>(
    `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/source-profile`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.providerAccount;
}

export async function backfillOperatorGatewayProviderSourceProfiles(
  userContext: InternalUserContext,
  input?: { providerAccountIds?: string[]; onlyMissing?: boolean },
) {
  const response = await gatewayRequest<{ result: GatewayProviderSourceProfileBackfillResult }>(
    "/v1/internal/gateway/provider-accounts/source-profile/backfill",
    {
      method: "POST",
      userContext,
      body: {
        providerAccountIds: input?.providerAccountIds ?? null,
        onlyMissing: input?.onlyMissing ?? true,
      },
    },
  );
  return response.result;
}
