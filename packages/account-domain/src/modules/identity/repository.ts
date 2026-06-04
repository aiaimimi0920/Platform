import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { authIdentities, users } from "@/modules/identity/schema";

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
