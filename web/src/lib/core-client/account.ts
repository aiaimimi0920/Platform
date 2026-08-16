import {
  type ReputationBreakdown,
  type ReputationHistoryPoint,
  type InternalUserContext,
  type LinuxDoUpsertInput,
  type LinuxDoUpsertResult,
  type ReputationSummary,
  type UserSummary,
  type WalletSummary,
  type WalletExchangeInput,
  type WalletExchangeResult,
} from "@neuro/contracts";

import { coreRequest } from "./request";

export async function upsertLinuxDoUser(profile: LinuxDoUpsertInput): Promise<LinuxDoUpsertResult> {
  return coreRequest<LinuxDoUpsertResult>("/internal/identity/linuxdo-upsert", {
    method: "POST",
    body: profile,
  });
}

export async function getCurrentUser(userContext: InternalUserContext) {
  const response = await coreRequest<{ user: UserSummary | null }>("/v1/me", {
    userContext,
  });
  return response.user;
}

export async function getWalletSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ wallet: WalletSummary }>("/v1/wallet", {
    userContext,
  });
  return response.wallet;
}

export async function exchangeWallet(userContext: InternalUserContext, payload: WalletExchangeInput) {
  const response = await coreRequest<{ exchange: WalletExchangeResult }>("/v1/wallet/exchange", {
    method: "POST",
    userContext,
    body: payload,
  });
  return response.exchange;
}

export async function getReputationSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ reputation: ReputationSummary | null }>("/v1/reputation", {
    userContext,
  });
  return response.reputation;
}

export async function getReputationBreakdown(userContext: InternalUserContext) {
  const response = await coreRequest<{ breakdown: ReputationBreakdown | null }>("/v1/reputation/breakdown", {
    userContext,
  });
  return response.breakdown;
}

export async function listReputationHistory(userContext: InternalUserContext, limit = 10) {
  const response = await coreRequest<{ history: ReputationHistoryPoint[] }>(`/v1/reputation/history?limit=${limit}`, {
    userContext,
  });
  return response.history;
}
