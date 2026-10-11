import "@/lib/auth-url-bootstrap";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import type { LinuxDoUpsertInput } from "@neuro/contracts";

import { upsertLinuxDoUser, upsertRauthyUser } from "@/lib/account-client";
import {
  assertDevAuthConfiguration,
  getDevAuthBypassLabel,
  getDevAuthBypassProfile,
  isDevAuthBypassEnabled,
} from "@/lib/dev-auth";

import { getRauthyConfiguration } from "@/lib/identity-provider";
import { createRauthyIdTokenVerifier, createRauthyProvider, normalizeRauthyProfile } from "@/lib/rauthy-auth";

assertDevAuthConfiguration();
const rauthyConfiguration = getRauthyConfiguration();
const verifyRauthyToken = rauthyConfiguration ? createRauthyIdTokenVerifier(rauthyConfiguration) : null;

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
    ...(rauthyConfiguration ? [createRauthyProvider(rauthyConfiguration)] : [{
      id: "linuxdo",
      name: "Linux Do",
      type: "oauth" as const,
      authorization: "https://connect.linux.do/oauth2/authorize",
      token: "https://connect.linux.do/oauth2/token",
      userinfo: "https://connect.linux.do/api/user",
      issuer: "https://connect.linux.do/",
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      profile(profile: Record<string, unknown>) {
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
    }]),
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
      if (account?.provider === "rauthy") {
        if (!rauthyConfiguration || !verifyRauthyToken || !profile) return false;
        const verified = await verifyRauthyToken(account.id_token);
        const claims = normalizeRauthyProfile(profile as Record<string, unknown>, rauthyConfiguration.issuer);
        return verified.sub === claims.subject;
      }
      if (!profile?.id) return false;
      await upsertLinuxDoUser(normalizeProfile(profile as Record<string, unknown>));
      return true;
    },
    async jwt({ token, profile, account, user }) {
      if (account?.provider === "rauthy") {
        if (!rauthyConfiguration || !profile || !user) return null;
        const identityExpiresAt = (user as { identityExpiresAt?: number }).identityExpiresAt;
        if (typeof identityExpiresAt !== "number" || !Number.isFinite(identityExpiresAt)
            || identityExpiresAt <= Date.now() / 1000) return null;
        const claims = normalizeRauthyProfile(profile as Record<string, unknown>, rauthyConfiguration.issuer);
        const { user: localUser } = await upsertRauthyUser(claims);
        token.localUserId = localUser.id;
        token.providerUserId = claims.subject;
        token.identityProvider = "rauthy";
        token.identityIssuer = claims.issuer;
        token.identityExpiresAt = Math.min(identityExpiresAt, Math.floor(Date.now() / 1000) + 900);
        token.username = localUser.username;
        token.email = localUser.email;
        token.trustLevel = null;
        token.avatarUrl = null;
        return token;
      }
      if (!account && token.identityProvider === "rauthy" && (!rauthyConfiguration
          || token.identityIssuer !== rauthyConfiguration.issuer
          || typeof token.identityExpiresAt !== "number" || token.identityExpiresAt <= Date.now() / 1000)) {
        return null;
      }
      if (account?.provider === "local-dev" && user) {
        const localUser = user as {
          id: string;
          providerUserId?: string;
          username?: string;
          trustLevel?: number | null;
          avatarUrl?: string | null;
          image?: string | null;
        };
        delete token.identityProvider;
        delete token.identityIssuer;
        delete token.identityExpiresAt;
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
        delete token.identityProvider;
        delete token.identityIssuer;
        delete token.identityExpiresAt;
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
        // Legacy provider IDs participate in operator allowlists; never feed a bare OIDC sub there.
        session.user.providerUserId = token.identityProvider === "rauthy" ? undefined
          : typeof token.providerUserId === "string" ? token.providerUserId : undefined;
        session.user.identitySubject = token.identityProvider === "rauthy" ? token.providerUserId : undefined;
        session.user.identityIssuer = token.identityProvider === "rauthy" ? token.identityIssuer : undefined;
        session.user.username = String(token.username || session.user.name || "");
        session.user.trustLevel = typeof token.trustLevel === "number" ? token.trustLevel : null;
        session.user.avatarUrl = typeof token.avatarUrl === "string" ? token.avatarUrl : null;
        session.user.image = typeof token.avatarUrl === "string" ? token.avatarUrl : session.user.image;
      }
      return {
        ...session,
        expires: token.identityProvider === "rauthy" && typeof token.identityExpiresAt === "number"
          ? new Date(token.identityExpiresAt * 1000).toISOString() : session.expires,
      };
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.OAUTH_CLIENT_SECRET,
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
