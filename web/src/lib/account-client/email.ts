import type {
  EmailIdentityView,
  EmailNativePanelView,
  EmailProviderInboundMessageView,
  InternalUserContext,
  StartEmailIdentityVerificationInput,
  StartEmailIdentityVerificationResult,
  ConfirmEmailIdentityVerificationInput,
  ConfirmEmailIdentityVerificationResult,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function getEmailNativePanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: EmailNativePanelView }>("/v1/me/email-native", {
    userContext,
  });
  return response.panel;
}

export async function startEmailIdentityVerification(
  userContext: InternalUserContext,
  payload: StartEmailIdentityVerificationInput,
) {
  return accountRequest<StartEmailIdentityVerificationResult>("/v1/me/email-native/verify/start", {
    method: "POST",
    userContext,
    body: payload,
  });
}

export async function confirmEmailIdentityVerification(
  userContext: InternalUserContext,
  payload: ConfirmEmailIdentityVerificationInput,
) {
  return accountRequest<ConfirmEmailIdentityVerificationResult>("/v1/me/email-native/verify/confirm", {
    method: "POST",
    userContext,
    body: payload,
  });
}

export async function setPrimaryEmailIdentity(userContext: InternalUserContext, identityId: string) {
  const response = await accountRequest<{ identity: EmailIdentityView }>(
    `/v1/me/email-native/identities/${encodeURIComponent(identityId)}/primary`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.identity;
}

export async function removeEmailIdentity(userContext: InternalUserContext, identityId: string) {
  return accountRequest<{ removed: true }>(
    `/v1/me/email-native/identities/${encodeURIComponent(identityId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorEmailProviderInboundMessages(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/email-ingress/provider-messages?${params.toString()}`
    : "/v1/internal/email-ingress/provider-messages";
  const response = await accountRequest<{ messages: EmailProviderInboundMessageView[] }>(pathname, {
    userContext,
  });
  return response.messages;
}

export async function retryOperatorEmailProviderInboundMessage(
  userContext: InternalUserContext,
  providerInboundMessageId: string,
) {
  const response = await accountRequest<{ message: EmailProviderInboundMessageView }>(
    `/v1/internal/email-ingress/provider-messages/${encodeURIComponent(providerInboundMessageId)}/retry`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.message;
}
