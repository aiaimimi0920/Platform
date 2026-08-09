import { expect, test } from "@playwright/test";

import {
  expectLocalLogin,
  expectNoHorizontalPageOverflow,
  expectNoSecretExposure,
} from "../fixtures";

test("V-PUBLIC serves a responsive public profile without owner-only data", async ({ page }) => {
  await page.goto("/u/acceptance-user");
  await expect(page.getByRole("heading", { name: "acceptance-user" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("正式钱包与账本");
  await expect(page.locator("body")).not.toContainText("订单历史");
  await expect(page.locator("body")).not.toContainText("站内邮箱待领");
  await expectNoSecretExposure(page);
  await expectNoHorizontalPageOverflow(page);

  await page.goto("/wallet");
  await expectLocalLogin(page);
});
