import {
  currencyKeys,
  type CurrencyKey,
  type LedgerEntryType,
  type UserWalletSnapshot,
  type WalletAssetView,
  type WalletExchangeInput,
  type WalletExchangeResult,
  type WalletPanelView,
  type WalletSummary,
  type WalletBalance,
} from "@neuro/contracts";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { ledgerAccounts, ledgerEntries } from "@/modules/wallet-ledger/schema";
import { listLedgerAccounts, listRecentLedgerEntries } from "@/modules/wallet-ledger/repository";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { env } from "@/env";
import { BadRequestError } from "@/platform/errors";

type DbTx = NodePgDatabase<any>;

function now() {
  return new Date();
}

const walletAssetCatalog: Array<
  Omit<WalletAssetView, "available" | "frozen">
> = [
  {
    key: "mira",
    displayName: "米拉",
    shortLabel: "ML",
    accent: "cyan",
    category: "free",
    summary: "平台免费循环资源，用于签到、任务和轻量互动的日常消耗。",
    acquisition: "通过签到、任务、活动或运营补偿获得，不以充值为主。",
    usage: "用于免费层兑换、日常互动与平台内轻量消费。",
    rule: "米拉必须保持持续免费产出，不与付费充值形成直接映射。",
  },
  {
    key: "obsidian",
    displayName: "耀晶",
    shortLabel: "YJ",
    accent: "violet",
    category: "premium",
    summary: "平台核心高价值消费货币，承接充值后的高级消费与结算行为。",
    acquisition: "通过充值、专项补偿或高价值活动奖励获得。",
    usage: "用于高价值商品、服务包、智能体消费与单向兑换米拉。",
    rule: "内部 canonical key 继续保持 obsidian，展示层正式名称统一为耀晶。",
  },
  {
    key: "opinionTickets",
    displayName: "投票券",
    shortLabel: "TPQ",
    accent: "fuchsia",
    category: "governance",
    summary: "面向议题治理和开发优先级排序的专用治理资源。",
    acquisition: "通过社区贡献、官方发放或治理活动奖励获得。",
    usage: "用于发起议题、支持议题和推动开发队列排序。",
    rule: "投票券不是常规消费币，只能用于治理与议题推进相关流程。",
  },
];

async function ensureWalletAccounts(
  userId: string,
  tx: DbTx = db,
) {
  const current = await tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.userId, userId));
  const existing = new Set(current.map((item) => item.currency));
  const createdAt = now();

  for (const currency of currencyKeys) {
    if (existing.has(currency)) continue;
    await tx.insert(ledgerAccounts).values({
      id: crypto.randomUUID(),
      userId,
      currency,
      availableBalance: 0,
      frozenBalance: 0,
      createdAt,
      updatedAt: createdAt,
    });
  }
}

async function appendLedgerEntry(args: {
  tx: DbTx;
  account: typeof ledgerAccounts.$inferSelect;
  entryType: LedgerEntryType;
  amount: number;
  nextAvailableBalance: number;
  nextFrozenBalance: number;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}) {
  await args.tx.insert(ledgerEntries).values({
    id: crypto.randomUUID(),
    userId: args.account.userId,
    accountId: args.account.id,
    currency: args.account.currency,
    entryType: args.entryType,
    amount: args.amount,
    balanceAfterAvailable: args.nextAvailableBalance,
    balanceAfterFrozen: args.nextFrozenBalance,
    note: args.note ?? null,
    referenceType: args.referenceType ?? null,
    referenceId: args.referenceId ?? null,
    createdAt: now(),
  });
}

async function mutateAccount(args: {
  tx?: DbTx;
  userId: string;
  currency: CurrencyKey;
  entryType: LedgerEntryType;
  availableDelta?: number;
  frozenDelta?: number;
  amount: number;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}) {
  const tx = args.tx ?? db;
  await ensureWalletAccounts(args.userId, tx);

  const [account] = await tx
    .select()
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.userId, args.userId), eq(ledgerAccounts.currency, args.currency)))
    .limit(1);

  if (!account) {
    throw new Error(`Ledger account missing for ${args.userId}/${args.currency}`);
  }

  const nextAvailable = account.availableBalance + (args.availableDelta ?? 0);
  const nextFrozen = account.frozenBalance + (args.frozenDelta ?? 0);

  if (nextAvailable < 0 || nextFrozen < 0) {
    throw new Error(`Insufficient balance for ${args.userId}/${args.currency}`);
  }

  const [updatedAccount] = await tx
    .update(ledgerAccounts)
    .set({
      availableBalance: nextAvailable,
      frozenBalance: nextFrozen,
      updatedAt: now(),
    })
    .where(eq(ledgerAccounts.id, account.id))
    .returning();

  await appendLedgerEntry({
    tx,
    account,
    entryType: args.entryType,
    amount: args.amount,
    nextAvailableBalance: nextAvailable,
    nextFrozenBalance: nextFrozen,
    note: args.note,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
  });

  await enqueueOutboxEvent(
    "wallet.changed",
    {
      userId: args.userId,
      currency: args.currency,
      entryType: args.entryType,
      amount: args.amount,
    },
    tx,
  );

  return updatedAccount;
}

export async function ensureUserWallet(userId: string) {
  await db.transaction(async (tx) => {
    await ensureWalletAccounts(userId, tx);
  });
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  await ensureUserWallet(userId);
  const accounts = await listLedgerAccounts(userId);
  const entries = await listRecentLedgerEntries(userId);

  const balances: WalletSummary["balances"] = {
    obsidian: { available: 0, frozen: 0 },
    mira: { available: 0, frozen: 0 },
    opinionTickets: { available: 0, frozen: 0 },
  };

  for (const account of accounts) {
    if (account.currency in balances) {
      balances[account.currency as CurrencyKey] = {
        available: account.availableBalance,
        frozen: account.frozenBalance,
      };
    }
  }

  return {
    balances,
    recentEntries: entries.map((entry) => ({
      id: entry.id,
      currency: entry.currency as CurrencyKey,
      entryType: entry.entryType as LedgerEntryType,
      amount: entry.amount,
      balanceAfterAvailable: entry.balanceAfterAvailable,
      balanceAfterFrozen: entry.balanceAfterFrozen,
      note: entry.note,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function getWalletPanel(userId: string): Promise<WalletPanelView> {
  const summary = await getWalletSummary(userId);
  return {
    assets: walletAssetCatalog.map((asset) => ({
      ...asset,
      available: summary.balances[asset.key].available,
      frozen: summary.balances[asset.key].frozen,
    })),
    recentEntries: summary.recentEntries,
    exchangeDirections: ["obsidian_to_mira"],
  };
}

export async function getUserWalletSnapshot(userId: string): Promise<UserWalletSnapshot> {
  await ensureUserWallet(userId);
  const accounts = await listLedgerAccounts(userId);
  const entries = await listRecentLedgerEntries(userId);
  const balances: Record<CurrencyKey, WalletBalance> = {
    obsidian: { available: 0, frozen: 0 },
    mira: { available: 0, frozen: 0 },
    opinionTickets: { available: 0, frozen: 0 },
  };

  for (const account of accounts) {
    if (account.currency in balances) {
      balances[account.currency as CurrencyKey] = {
        available: account.availableBalance,
        frozen: account.frozenBalance,
      };
    }
  }

  return {
    balances,
    recentEntryCount: entries.length,
  };
}

export async function exchangeObsidianToMira(userId: string, payload: WalletExchangeInput): Promise<WalletExchangeResult> {
  if (payload.direction !== "obsidian_to_mira") {
    throw new BadRequestError("当前只支持曜石兑换米拉，米拉不能反向兑换为曜石");
  }
  const amount = payload.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestError("兑换数量必须大于 0");
  }

  const rate = env.obsidianToMiraRate;
  const miraAmount = Math.floor(amount * rate);
  if (miraAmount <= 0) {
    throw new BadRequestError("兑换比例配置错误");
  }

  const exchangeId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await mutateAccount({
      tx,
      userId,
      currency: "obsidian",
      entryType: "exchange",
      availableDelta: -amount,
      amount,
      note: `兑换米拉：${amount} 曜石 -> ${miraAmount} 米拉`,
      referenceType: "walletExchange",
      referenceId: exchangeId,
    });

    await mutateAccount({
      tx,
      userId,
      currency: "mira",
      entryType: "exchange",
      availableDelta: miraAmount,
      amount: miraAmount,
      note: `兑换自曜石：${amount} 曜石 -> ${miraAmount} 米拉`,
      referenceType: "walletExchange",
      referenceId: exchangeId,
    });

    await enqueueOutboxEvent(
      "wallet.exchanged",
      {
        userId,
        obsidian: amount,
        mira: miraAmount,
        rate,
        exchangeId,
      },
      tx,
    );
  });

  return {
    direction: "obsidian_to_mira",
    sourceCurrency: "obsidian",
    sourceAmount: amount,
    targetCurrency: "mira",
    targetAmount: miraAmount,
    rate,
    exchangedAt: now().toISOString(),
  };
}

export async function grantBalance(
  userId: string,
  currency: CurrencyKey,
  amount: number,
  note?: string,
  referenceType?: string,
  referenceId?: string,
  tx?: DbTx,
) {
  return mutateAccount({
    tx,
    userId,
    currency,
    entryType: "grant",
    availableDelta: amount,
    amount,
    note,
    referenceType,
    referenceId,
  });
}

export async function refundBalance(
  userId: string,
  currency: CurrencyKey,
  amount: number,
  note?: string,
  referenceType?: string,
  referenceId?: string,
  tx?: DbTx,
) {
  return mutateAccount({
    tx,
    userId,
    currency,
    entryType: "refund",
    availableDelta: amount,
    amount,
    note,
    referenceType,
    referenceId,
  });
}

export async function deductBalance(
  userId: string,
  currency: CurrencyKey,
  amount: number,
  note?: string,
  referenceType?: string,
  referenceId?: string,
  tx?: DbTx,
) {
  return mutateAccount({
    tx,
    userId,
    currency,
    entryType: "deduct",
    availableDelta: -amount,
    amount,
    note,
    referenceType,
    referenceId,
  });
}

export async function freezeBalance(
  userId: string,
  currency: CurrencyKey,
  amount: number,
  note?: string,
  referenceType?: string,
  referenceId?: string,
  tx?: DbTx,
) {
  return mutateAccount({
    tx,
    userId,
    currency,
    entryType: "freeze",
    availableDelta: -amount,
    frozenDelta: amount,
    amount,
    note,
    referenceType,
    referenceId,
  });
}

export async function unfreezeBalance(
  userId: string,
  currency: CurrencyKey,
  amount: number,
  note?: string,
  referenceType?: string,
  referenceId?: string,
  tx?: DbTx,
) {
  return mutateAccount({
    tx,
    userId,
    currency,
    entryType: "unfreeze",
    availableDelta: amount,
    frozenDelta: -amount,
    amount,
    note,
    referenceType,
    referenceId,
  });
}

export async function transferBalance(args: {
  fromUserId: string;
  toUserId: string;
  currency: CurrencyKey;
  amount: number;
  note: string;
  referenceType?: string;
  referenceId?: string;
  tx?: DbTx;
}) {
  const run = async (tx: DbTx) => {
    await deductBalance(args.fromUserId, args.currency, args.amount, args.note, args.referenceType, args.referenceId, tx);
    await grantBalance(args.toUserId, args.currency, args.amount, args.note, args.referenceType, args.referenceId, tx);
  };

  if (args.tx) {
    await run(args.tx);
    return;
  }

  await db.transaction(run);
}
