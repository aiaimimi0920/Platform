export type LinuxDoProfile = {
  id: string | number;
  username?: string;
  name?: string;
  email?: string | null;
  avatar_url?: string | null;
  trust_level?: number | null;
};

export type UserWallet = {
  obsidian: number;
  mira: number;
  opinionTickets: number;
};

export type UserRecord = {
  id: string;
  provider: "linuxdo";
  providerUserId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  trustLevel: number | null;
  wallet: UserWallet;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};
