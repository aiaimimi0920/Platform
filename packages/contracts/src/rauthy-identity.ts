import type { UserSummary } from "./index";

export type RauthyUpsertInput = {
  issuer: string;
  subject: string;
  username?: string;
  email?: string | null;
  emailVerified: boolean;
};

export type RauthyUpsertResult = {
  user: UserSummary;
};
