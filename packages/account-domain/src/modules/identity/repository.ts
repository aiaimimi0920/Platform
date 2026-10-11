import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { authIdentities, oidcIdentities, users } from "@/modules/identity/schema";

export async function findIdentityByProvider(provider: string, providerUserId: string) {
  const [row] = await db
    .select({
      user: users,
      identity: authIdentities,
    })
    .from(authIdentities)
    .innerJoin(users, eq(authIdentities.userId, users.id))
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, providerUserId)));

  return row ?? null;
}

export async function findUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}

export async function findLoginIdentityForUser(userId: string) {
  const [legacy] = await db.select({ user: users, identity: authIdentities })
    .from(authIdentities)
    .innerJoin(users, eq(authIdentities.userId, users.id))
    .where(and(eq(authIdentities.provider, "linuxdo"), eq(authIdentities.userId, userId)))
    .limit(1);
  if (legacy) {
    return { user: legacy.user, provider: "linuxdo" as const, providerUserId: legacy.identity.providerUserId };
  }
  const [oidc] = await db.select({ user: users, identity: oidcIdentities })
    .from(oidcIdentities)
    .innerJoin(users, eq(oidcIdentities.userId, users.id))
    .where(eq(oidcIdentities.userId, userId))
    .limit(1);
  return oidc ? {
    user: oidc.user,
    provider: "rauthy" as const,
    providerUserId: oidc.identity.subject,
    providerIssuer: oidc.identity.issuer,
    displayName: oidc.identity.displayName,
  } : null;
}
