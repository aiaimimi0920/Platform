import { expect, test } from "@playwright/test";

import { expectHeading, expectNoSecretExposure, loginAsAcceptanceUser } from "../fixtures";

test("OP-CONTROL exposes the operator control plane and audited dependency surfaces", async ({ page }) => {
  await loginAsAcceptanceUser(page);
  await expectHeading(page, "/ops/gateway/providers", "服务商");
  await expect(page.locator("body")).toContainText("运维控制台");
  await expectHeading(page, "/ops/products", "商品管理");
  await expectHeading(page, "/ops/account/issues", /议题运维/);
  await expectHeading(page, "/arbitrations", /仲裁/);
  await expectNoSecretExposure(page);
});
