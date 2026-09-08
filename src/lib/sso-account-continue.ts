export const SESSION_COOKIE = "at_session";
export const CONTINUE_COOKIE = "at_continue";
export const ADDING_COOKIE = "at_adding";

const CONTINUE_PATHS = new Set(["/", "/login", "/register", "/account"]);

/**
 * Request cookies, not cookies(). Next Route Handlers / Server Components
 * can miss at_continue after writing at_session, which left CoreTAP SSO
 * users stuck on /account.
 */
export function ssoCompletePath(input: {
  pathname: string;
  hasSession: boolean;
  hasContinue: boolean;
  adding: boolean;
}): string | null {
  if (input.adding || !input.hasSession || !input.hasContinue) return null;
  if (!CONTINUE_PATHS.has(input.pathname)) return null;
  return "/api/sso/complete";
}
