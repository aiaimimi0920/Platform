import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { ledgerAccounts, ledgerEntries } from "@/modules/wallet-ledger/schema";

export async function findLedgerAccount(
  userId: string,
  currency: string,
  tx: NodePgDatabase<typeof schema> = db,
) {
  const [account] = await tx
    .select()
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.currency, currency)));

  return account ?? null;
}

export async function listLedgerAccounts(
  userId: string,
  tx: NodePgDatabase<typeof schema> = db,
) {
  return tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.userId, userId));
}

export async function listRecentLedgerEntries(
  userId: string,
  tx: NodePgDatabase<typeof schema> = db,
) {
  return tx
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(10);
}
