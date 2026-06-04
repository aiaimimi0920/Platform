export const ACCOUNT_HONOR_PANEL_API_PATH = "/api/account-honor/panel";
export const ACCOUNT_HONOR_PROFILE_API_PATH = "/api/account-honor/profile";

export function isAccountHonorApiPath(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  return (
    pathname === ACCOUNT_HONOR_PANEL_API_PATH ||
    pathname === ACCOUNT_HONOR_PROFILE_API_PATH ||
    pathname.startsWith(`${ACCOUNT_HONOR_PANEL_API_PATH}/`) ||
    pathname.startsWith(`${ACCOUNT_HONOR_PROFILE_API_PATH}/`)
  );
}
