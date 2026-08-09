import { expect, test } from "@playwright/test";

import { expectNoSecretExposure, loginAsAcceptanceUser } from "../fixtures";

test("ERR-DEPENDENCY shows correlation, retry, and unavailable state without fake success or secrets", async ({ page }) => {
  await loginAsAcceptanceUser(page);
  await page.goto("/ops/products");

  const dependency = page.locator('[data-dependency-state="unavailable"]');
  await expect(dependency).toBeVisible();
  await expect(dependency.getByRole("heading", { name: "Gateway bundle 目录暂不可用" })).toBeVisible();
  await expect(dependency).toContainText("关联 ID");
  await expect(dependency).toContainText(/web-gateway-[0-9a-f-]{36}/i);
  await expect(dependency.getByText("可重试，等待时间未提供", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "重试 Gateway bundle 目录" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "商品库存" })).toBeVisible();
  await expect(page.locator(".ops-alert--success")).toHaveCount(0);
  await expectNoSecretExposure(page);
});
