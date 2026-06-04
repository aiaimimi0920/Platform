export type RedeemResponsePayload = {
  error?: string;
  result?: {
    code: string;
    message: string;
    outcome: "walletGrant" | "itemGrant";
  };
};
