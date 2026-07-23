import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./opinion-center-page.tsx", import.meta.url), "utf8");

test("P3-02: opinion center exposes typed dependency states instead of silent empty fallbacks", () => {
  assert.match(pageSource, /DependencyState/);
  assert.match(pageSource, /createDependencyFailureResult/);
  assert.match(pageSource, /getPublicSurfaceSnapshotStrict/);
  assert.match(pageSource, /combineDependencyResults/);
  assert.match(pageSource, /dependency\.state === "partial"/);
  assert.match(pageSource, /dependency\.state === "unavailable"/);
  assert.match(pageSource, /dependency\.state === "unauthorized"/);
  assert.doesNotMatch(pageSource, /\.catch\(\(\) => (?:null|\[\])/);
  assert.match(pageSource, /walletDependency\.state === "ready"/);
  assert.doesNotMatch(pageSource, /wallet\?\.balances\.opinionTickets\.available \?\? 0/);
  assert.match(pageSource, /isDependencyFailure\(walletDependency\)/);
  assert.match(pageSource, /isDependencyFailure\(supportDependency\)/);
  assert.match(pageSource, /isDependencyFailure\(opposeDependency\)/);
  assert.match(pageSource, /isDependencyFailure\(currentUserDependency\)/);
  assert.match(pageSource, /topicFilterDetailDependency/);
  assert.match(pageSource, /topicFilterDetailDependencyBlocksList/);
  assert.match(pageSource, /activeTopicVoteUnavailable = walletDependency\.state !== "ready"/);
  assert.match(
    pageSource,
    /disabled=\{activeTopicVoteUnavailable \|\| !detail\.topic\.canSupport \|\| activeTopicVoteLockedToday\}/,
  );
  assert.match(
    pageSource,
    /disabled=\{activeTopicVoteUnavailable \|\| !detail\.topic\.canOppose \|\| activeTopicVoteLockedToday\}/,
  );
  assert.match(pageSource, /账户等级信息暂无数据/);
  assert.match(pageSource, /当前还没有议题/);
});
