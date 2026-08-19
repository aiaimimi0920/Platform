import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const walletSource = readFileSync(resolve(__dirname, "modules/wallet-ledger/service.ts"), "utf8");
const missionSource = readFileSync(resolve(__dirname, "modules/personal-missions/service.ts"), "utf8");

test("wallet mutations use conflict-safe initialization and a transaction row lock", () => {
  assert.match(walletSource, /\.onConflictDoNothing\(\{\s*target: \[ledgerAccounts\.userId, ledgerAccounts\.currency\]/s);
  assert.match(walletSource, /return db\.transaction\(\(tx\) => mutateAccount\(\{ \.\.\.args, tx \}\)\)/);
  assert.match(walletSource, /\.for\("update"\)/);
});

test("personal mission claim races preserve the public conflict contract", () => {
  assert.match(missionSource, /code\?: unknown \}\)\.code === "23505"/);
  assert.match(missionSource, /throw new ConflictError\("该任务奖励已经领取过了。"\)/);
});
