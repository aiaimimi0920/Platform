import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.resolve(process.cwd(), "src/modules/redemption-mailbox-marketplace/service.ts"),
  "utf8",
);

test("redemption business rejections use typed HTTP errors instead of server faults", () => {
  assert.match(source, /throw new BadRequestError\("兑换码不存在或已失效"\)/);
  assert.match(source, /throw new ConflictError\("兑换码已存在，请使用新的编码"\)/);
  assert.match(source, /throw new ConflictError\("该兑换码已被使用"\)/);
  assert.doesNotMatch(source, /throw new Error\("兑换码不存在或已失效"\)/);
});
