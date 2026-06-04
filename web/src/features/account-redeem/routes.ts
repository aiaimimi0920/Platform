export const REDEEM_API_PATH = "/api/redemptions/redeem";

export function isRedeemRouteOpen(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/redeem" || pathname.startsWith("/redeem/");
}
