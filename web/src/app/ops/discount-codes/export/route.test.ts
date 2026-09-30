import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
const legacyRouteSource = readFileSync(
  new URL("../../products/discount-codes/export/route.ts", import.meta.url),
  "utf8",
);

test("discount-code export routes forward provider identity to Core", () => {
  for (const source of [routeSource, legacyRouteSource]) {
    assert.match(source, /providerUserId:\s*session\.user\.providerUserId/);
  }
});

test("discount-code export controls use download anchors instead of RSC-prefetched links", () => {
  assert.match(pageSource, /<a className="ops-inline-action" download href=\{exportHref\}>导出当前筛选 CSV<\/a>/);
  assert.match(pageSource, /<a className="ops-inline-action" download href=\{exportHref\}>下载当前筛选 CSV<\/a>/);
  assert.doesNotMatch(pageSource, /<Link className="ops-inline-action" href=\{exportHref\}>/);
});

test("discount-code operations keep labels localized and date rendering deterministic", () => {
  assert.match(pageSource, /formatPlatformDateTime\(v, "未设置"\)/);
  assert.doesNotMatch(pageSource, /toLocaleString\("zh-CN"\)/);
  for (const label of ["命名空间", "批次标签", "已启用", "已停用", "CSV 预览（试运行）", "总行数", "变更前", "变更后"]) {
    assert.match(pageSource, new RegExp(label));
  }
});
