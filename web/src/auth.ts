import "@/lib/auth-url-bootstrap";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import type { LinuxDoUpsertInput } from "@neuro/contracts";

import { upsertLinuxDoUser } from "@/lib/account-client";
import { getDevAuthBypassLabel, getDevAuthBypassProfile, isDevAuthBypassEnabled } from "@/lib/dev-auth";

function normalizeProfile(profile: Record<string, unknown>): LinuxDoUpsertInput {
  return {
    id: String(profile.id ?? ""),
    username: typeof profile.username === "string" ? profile.username : undefined,
    name: typeof profile.name === "string" ? profile.name : undefined,
    email: typeof profile.email === "string" ? profile.email : null,
    avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    trust_level: typeof profile.trust_level === "number" ? profile.trust_level : null,
  };
}

export const authConfig = {
  basePath: "/api/auth",
  providers: [
    {
      id: "linuxdo",
      name: "Linux Do",
      type: "oauth",
      authorization: "https://connect.linux.do/oauth2/authorize",
      token: "https://connect.linux.do/oauth2/token",
      userinfo: "https://connect.linux.do/api/user",
      issuer: "https://connect.linux.do/",
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      profile(profile) {
        const normalized = normalizeProfile(profile as Record<string, unknown>);
        return {
          id: String(normalized.id),
          providerUserId: String(normalized.id),
          name: normalized.username || normalized.name,
          email: normalized.email || null,
          image: normalized.avatar_url || null,
          username: normalized.username || normalized.name,
          trustLevel: normalized.trust_level ?? null,
          avatarUrl: normalized.avatar_url || null,
        };
      },
    },
    ...(isDevAuthBypassEnabled()
      ? [
          Credentials({
            id: "local-dev",
            name: getDevAuthBypassLabel(),
            credentials: {
              intent: { label: "intent", type: "text" },
            },
            async authorize() {
              const { user: localUser } = await upsertLinuxDoUser(getDevAuthBypassProfile());
              return {
                id: localUser.id,
                providerUserId: getDevAuthBypassProfile().id,
                name: localUser.username,
                email: localUser.email || null,
                image: localUser.avatarUrl || null,
                username: localUser.username,
                trustLevel: localUser.trustLevel,
                avatarUrl: localUser.avatarUrl,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "local-dev") {
        return true;
      }
      if (!profile?.id) return false;
      await upsertLinuxDoUser(normalizeProfile(profile as Record<string, unknown>));
      return true;
    },
    async jwt({ token, profile, account, user }) {
      if (account?.provider === "local-dev" && user) {
        const localUser = user as {
          id: string;
          providerUserId?: string;
          username?: string;
          trustLevel?: number | null;
          avatarUrl?: string | null;
          image?: string | null;
        };
        token.localUserId = localUser.id;
        token.providerUserId = localUser.providerUserId || getDevAuthBypassProfile().id;
        token.username = localUser.username || "";
        token.trustLevel = typeof localUser.trustLevel === "number" ? localUser.trustLevel : null;
        token.avatarUrl =
          typeof localUser.avatarUrl === "string"
            ? localUser.avatarUrl
            : typeof localUser.image === "string"
              ? localUser.image
              : null;
        return token;
      }
      if (profile?.id) {
        const { user: localUser } = await upsertLinuxDoUser(normalizeProfile(profile as Record<string, unknown>));
        token.localUserId = localUser.id;
        token.providerUserId = String(profile.id);
        token.username = localUser.username;
        token.trustLevel = localUser.trustLevel;
        token.avatarUrl = localUser.avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.localUserId || token.sub || "");
        session.user.providerUserId =
          typeof token.providerUserId === "string" ? token.providerUserId : undefined;
        session.user.username = String(token.username || session.user.name || "");
        session.user.trustLevel = typeof token.trustLevel === "number" ? token.trustLevel : null;
        session.user.avatarUrl = typeof token.avatarUrl === "string" ? token.avatarUrl : null;
        session.user.image = typeof token.avatarUrl === "string" ? token.avatarUrl : session.user.image;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.OAUTH_CLIENT_SECRET,
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
