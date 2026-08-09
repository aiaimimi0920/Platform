import { expect, test } from "@playwright/test";

import {
  dismissAnnouncement,
  ensureAcceptanceProgression,
  expectHeading,
  expectLocalLogin,
  loginAsAcceptanceUser,
} from "../fixtures";

function acceptanceCode(projectName: string, purpose: string) {
  const attemptId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `ACCEPT-${projectName}-${purpose}-${attemptId}`.replace(/[^A-Z0-9-]/gi, "-").toUpperCase();
}

async function fundAcceptanceWallet(page: Parameters<typeof loginAsAcceptanceUser>[0], code: string) {
  await page.goto("/ops/account/redemption-codes");
  await expect(page.getByRole("heading", { name: "兑换码管理" })).toBeVisible();
  const createCard = page.getByRole("heading", { name: "创建兑换码" }).locator("..");
  const form = createCard.locator("form");
  await form.locator('input[name="code"]').fill(code);
  await form.getByPlaceholder("数量").fill("20");
  await form.getByRole("button", { name: "创建兑换码" }).click();
  await expect(page.getByText("兑换码已创建", { exact: true })).toBeVisible();

  await page.goto("/redeem");
  await expect(page.getByRole("dialog", { name: "兑换码" })).toBeVisible();
  await page.getByPlaceholder("输入兑换码").fill(code);
  await page.getByRole("button", { name: "立即兑换" }).click();
  await expect(page.locator(".app-redeem__result--success")).toBeVisible();
  await expect(page.locator(".app-redeem__result--success")).toContainText(/20|曜石|obsidian/i);
}

test("O-AUTH protects owner routes and supports login, logout, and idempotent re-login", async ({ page }) => {
  await page.goto("/dashboard");
  await expectLocalLogin(page);

  await page.getByRole("button", { name: /Local Dev/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
  await expect(page.getByRole("heading", { name: "账户终端" })).toBeVisible();
  await expect(page.getByText("acceptance-user", { exact: true }).first()).toBeVisible();
  await dismissAnnouncement(page);

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/(?:[?#].*)?$/);
  await expectLocalLogin(page);

  await page.getByRole("button", { name: /Local Dev/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
  await expect(page.getByText("acceptance-user", { exact: true }).first()).toBeVisible();
  await dismissAnnouncement(page);
});

test("O-COMMERCE creates and redeems a wallet grant while keeping an invalid redemption failed", async ({ page }, testInfo) => {
  await loginAsAcceptanceUser(page);
  await expectHeading(page, "/wallet", "正式钱包与账本");
  await expectHeading(page, "/products", /商城终端|官方货架|商城入口/);
  await expectHeading(page, "/marketplace", /玩家小集市|小集市/);
  await expectHeading(page, "/benefits", "我的权益");
  await expectHeading(page, "/inventory", "我的商品与资产");

  await fundAcceptanceWallet(page, acceptanceCode(testInfo.project.name, "commerce"));
  await page.getByPlaceholder("输入兑换码").fill("ACCEPTANCE-NOT-A-REAL-CODE");
  await page.getByRole("button", { name: "立即兑换" }).click();
  await expect(page.locator(".app-redeem__result--error")).toBeVisible();
  await expect(page.locator(".app-redeem__result--success")).toHaveCount(0);
});

test("O-TASK persists a newly published task across refresh", async ({ page }, testInfo) => {
  await loginAsAcceptanceUser(page);
  await fundAcceptanceWallet(page, acceptanceCode(testInfo.project.name, "task"));
  await expectHeading(page, "/my-tasks", "我的任务");
  const taskTitle = `Acceptance task ${testInfo.project.name}`;
  await page.getByPlaceholder("任务标题").fill(taskTitle);
  await page.getByPlaceholder("任务说明").fill("Browser acceptance task persisted through the Platform task domain.");
  await page.getByPlaceholder("奖励数量").fill("1");
  await page.getByPlaceholder("保证金数量（曜石）").fill("0");
  await page.getByRole("button", { name: "发布到任务集会" }).click();
  await expect(page.getByText("任务发布成功。", { exact: true })).toBeVisible();
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
});

test("O-AGENT-CHAT binds a real managed-heavy agent and persists a Gateway response", async ({ page }, testInfo) => {
  await loginAsAcceptanceUser(page);
  await ensureAcceptanceProgression(page);
  await page.goto("/agents?role=heavy");
  const createLink = page.getByRole("link", { name: "新建", exact: true });
  if (await createLink.isVisible().catch(() => false)) {
    await createLink.click();
    await expect(page.getByRole("heading", { name: "新建重度槽位" })).toBeVisible();
    await page.getByPlaceholder("名称").fill(`Acceptance Heavy ${testInfo.project.name}`);
    await page
      .getByPlaceholder("描述这个重度槽位负责承接的长期上下文、人格边界或任务类型。")
      .fill("Managed-heavy browser acceptance binding.");
    await page.getByRole("button", { name: "创建重度槽位" }).click();
    await expect(page.getByText("重度智能体已创建。", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("自创建槽位", { exact: true }).first()).toBeVisible();
  }

  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: /嗨，我是觅觅/ })).toBeVisible();
  const message = `Browser acceptance ${testInfo.project.name} ${Date.now()}`;
  await page.locator(".nt-chat-app-composer textarea").fill(message);
  await page.locator(".nt-chat-app-composer button.nt-btn--primary").click();
  const latestGatewayResponse = page.locator(".nt-chat-app-message--assistant .nt-chat-app-message__text").last();
  await expect(latestGatewayResponse).toHaveText("Gateway fixture response");
  await page.reload();
  const mobileConversationDirectory = page.getByRole("button", { name: "打开会话目录" });
  if (await mobileConversationDirectory.isVisible().catch(() => false)) {
    await mobileConversationDirectory.click();
  }
  await page.getByRole("button", { name: /Gateway fixture response/ }).first().click();
  await expect(page.locator(".nt-chat-app-message--user .nt-chat-app-message__text").last()).toHaveText(message);
  await expect(page.locator(".nt-chat-app-message--assistant .nt-chat-app-message__text").last()).toHaveText(
    "Gateway fixture response",
  );
});

test("O-PROJECT-GOV exposes project, mailbox, arbitration, and opinion workspaces", async ({ page }) => {
  await loginAsAcceptanceUser(page);
  await expectHeading(page, "/projects", "项目");
  await expectHeading(page, "/mailbox", "邮箱");
  await expectHeading(page, "/my-arbitrations", "我的仲裁与证据");
  await expectHeading(page, "/opinions", /议题/);
});
