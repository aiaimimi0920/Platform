import { randomUUID } from "node:crypto";

import type { RauthyUpsertInput } from "@neuro/contracts";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { oidcIdentities, users } from "@/modules/identity/schema";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

export async function persistRauthyIdentity(profile: RauthyUpsertInput): Promise<string> {
  return db.transaction(async (tx) => {
    // Serialize this exact identity before reading, including the first login.
    // Hash collisions only serialize unrelated logins; uniqueness remains in SQL.
    const lockKey = JSON.stringify(["platform-oidc-login", profile.issuer, profile.subject]);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const [existing] = await tx.select({ identity: oidcIdentities, user: users })
      .from(oidcIdentities)
      .innerJoin(users, eq(oidcIdentities.userId, users.id))
      .where(and(eq(oidcIdentities.issuer, profile.issuer), eq(oidcIdentities.subject, profile.subject)))
      .limit(1);
    const currentTime = new Date();
    const email = profile.email ?? null;
    const metadata = { displayName: profile.username ?? null, email, emailVerified: profile.emailVerified, updatedAt: currentTime, lastLoginAt: currentTime };
    if (existing) {
      await tx.update(users).set({
        email,
        updatedAt: currentTime,
        lastLoginAt: currentTime,
      }).where(eq(users.id, existing.user.id));
      await tx.update(oidcIdentities).set(metadata).where(eq(oidcIdentities.id, existing.identity.id));
      return existing.user.id;
    }

    const userId = randomUUID();
    await tx.insert(users).values({
      id: userId,
      username: `rauthy_${userId}`,
      email,
      trustLevel: null,
      createdAt: currentTime,
      updatedAt: currentTime,
      lastLoginAt: currentTime,
    });
    await tx.insert(oidcIdentities).values({
      id: randomUUID(),
      userId,
      issuer: profile.issuer,
      subject: profile.subject,
      ...metadata,
      createdAt: currentTime,
    });
    await enqueueOutboxEvent("user.registered", { userId, provider: "rauthy" }, tx);
    return userId;
  });
}
