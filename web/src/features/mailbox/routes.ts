export const MAILBOX_ROUTE_PATH = "/mailbox";

export function isMailboxRouteOpen(pathname: string | null | undefined) {
  return isMailboxWorkspaceRoute(pathname);
}

export function isMailboxWorkspaceRoute(pathname: string | null | undefined) {
  return Boolean(pathname && (pathname === MAILBOX_ROUTE_PATH || pathname.startsWith(`${MAILBOX_ROUTE_PATH}/`)));
}

export function buildMailboxRouteHref(
  currentSearchParams: { toString(): string } | null | undefined,
  messageId?: string | null,
) {
  const params = new URLSearchParams(currentSearchParams?.toString() ?? "");
  if (messageId?.trim()) {
    params.set("messageId", messageId.trim());
  } else {
    params.delete("messageId");
  }
  const query = params.toString();
  return query ? `${MAILBOX_ROUTE_PATH}?${query}` : MAILBOX_ROUTE_PATH;
}
