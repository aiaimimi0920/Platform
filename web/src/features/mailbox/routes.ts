export const MAILBOX_ROUTE_PATH = "/mailbox";

export const MAILBOX_ROUTE_NOTICE = {
  title: "邮箱终端已切换为弹窗面板",
  description:
    "当前 `/mailbox` 用作邮箱弹窗的深链接入口。若面板尚未自动打开，请返回控制台后重新点击导航中的“邮箱”。",
} as const;

export function isMailboxRouteOpen(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  return pathname === MAILBOX_ROUTE_PATH || pathname.startsWith(`${MAILBOX_ROUTE_PATH}/`);
}
