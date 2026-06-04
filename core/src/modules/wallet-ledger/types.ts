import type { CurrencyKey, WalletSummary } from "@neuro/contracts";

export type WalletMutationInput = {
  userId: string;
  currency: CurrencyKey;
  amount: number;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
};

export type WalletSummaryView = WalletSummary;
