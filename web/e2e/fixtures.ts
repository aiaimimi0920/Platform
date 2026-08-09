import { expect, type Page } from "@playwright/test";

export async function expectLocalLogin(page: Page) {
  await expect(page.getByRole("button", { name: /Local Dev/i })).toBeVisible();
}

export async function dismissAnnouncement(page: Page) {
  const closeButton = page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭公告面板" })
    .last();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}

export async function loginAsAcceptanceUser(page: Page) {
  await page.goto("/");
  await expectLocalLogin(page);
  await page.getByRole("button", { name: /Local Dev/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
  await expect(page.getByRole("heading", { name: "账户终端" })).toBeVisible();
  await expect(page.getByText("acceptance-user", { exact: true }).first()).toBeVisible();
  await dismissAnnouncement(page);
}

export async function ensureAcceptanceProgression(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /福利中心/ }).click();
  const dialog = page.getByRole("dialog", { name: "福利中心" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "每日签到" })).toBeVisible();

  const checkinButton = dialog.getByRole("button", { name: "签到", exact: true });
  if (await checkinButton.isVisible().catch(() => false)) {
    await checkinButton.click();
    await expect(page.getByText("签到完成", { exact: true })).toBeVisible();
  } else {
    const wagerButton = dialog.getByRole("button", { name: "押注", exact: true });
    if (await wagerButton.isVisible().catch(() => false)) {
      await expect(wagerButton).toBeVisible();
    } else {
      await expect(dialog.getByText("已签到", { exact: true }).first()).toBeVisible();
    }
  }

  await dialog.getByRole("button", { name: "关闭福利中心面板" }).last().click();
  await expect(dialog).toHaveCount(0);
}

export async function expectHeading(page: Page, pathname: string, name: string | RegExp) {
  await page.goto(pathname);
  await expect(page.getByRole("heading", { name }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
}

export async function expectNoHorizontalPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= Math.max(root.clientWidth, window.innerWidth) + 1;
      }),
    )
    .toBe(true);
}

export async function expectNoSecretExposure(page: Page) {
  const body = await page.locator("body").innerText();
  for (const pattern of [
    /authorization\s*[:=]\s*bearer\s+\S+/i,
    /postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i,
    /(?:api[_ -]?key|password|client[_ -]?secret)\s*[:=]\s*[^\s,;]+/i,
    /\bsk-[a-z0-9._-]{8,}\b/i,
  ]) {
    expect(body).not.toMatch(pattern);
  }
}
