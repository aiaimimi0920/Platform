import type {
  InternalUserContext,
  LinuxDoUpsertInput,
  LinuxDoUpsertResult,
  PublicUserProfile,
  ReputationBreakdown,
  ReputationHistoryPoint,
  ReputationSummary,
  UserSummary,
  UpdateUserProfileInput,
  WalletExchangeInput,
  WalletExchangeResult,
  WalletPanelView,
  WalletSummary,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function getPublicUserProfile(username: string) {
  const response = await accountRequest<{ profile: PublicUserProfile | null }>(`/v1/public/users/${encodeURIComponent(username)}`);
  return response.profile;
}

export async function upsertLinuxDoUser(profile: LinuxDoUpsertInput): Promise<LinuxDoUpsertResult> {
  return accountRequest<LinuxDoUpsertResult>("/internal/identity/linuxdo-upsert", {
    method: "POST",
    body: profile,
  });
}

export async function getCurrentUser(userContext: InternalUserContext) {
  const response = await accountRequest<{ user: UserSummary | null }>("/v1/me", {
    userContext,
  });
  return response.user;
}

export async function getWalletPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: WalletPanelView }>("/v1/me/wallet/panel", {
    userContext,
  });
  return response.panel;
}

export async function updateCurrentUserProfile(userContext: InternalUserContext, payload: UpdateUserProfileInput) {
  const response = await accountRequest<{ user: UserSummary | null }>("/v1/me/profile", {
    method: "POST",
    userContext,
    body: payload,
  });
  return response.user;
}

export async function getWalletSummary(userContext: InternalUserContext) {
  const response = await accountRequest<{ wallet: WalletSummary }>("/v1/me/wallet", {
    userContext,
  });
  return response.wallet;
}

export async function exchangeWallet(userContext: InternalUserContext, payload: WalletExchangeInput) {
  const response = await accountRequest<{ exchange: WalletExchangeResult }>("/v1/me/wallet/exchange", {
    method: "POST",
    userContext,
    body: payload,
  });
  return response.exchange;
}

export async function getReputationSummary(userContext: InternalUserContext) {
  const response = await accountRequest<{ reputation: ReputationSummary | null }>("/v1/me/reputation", {
    userContext,
  });
  return response.reputation;
}

export async function getReputationBreakdown(userContext: InternalUserContext) {
  const response = await accountRequest<{ breakdown: ReputationBreakdown | null }>("/v1/me/reputation/breakdown", {
    userContext,
  });
  return response.breakdown;
}

export async function listReputationHistory(userContext: InternalUserContext, limit = 10) {
  const response = await accountRequest<{ history: ReputationHistoryPoint[] }>(`/v1/me/reputation/history?limit=${limit}`, {
    userContext,
  });
  return response.history;
}
