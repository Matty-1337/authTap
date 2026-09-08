export const SESSION_COOKIE = "at_session";
export const CONTINUE_COOKIE = "at_continue";
export const ADDING_COOKIE = "at_adding";

const CONTINUE_PATHS = new Set(["/", "/login", "/register", "/account"]);

/**
 * Finish a product hop only when this request still carries the hop
 * (client/return_to/state). A leftover at_continue cookie must not yank a
 * direct AuthTAP visit — AuthTAP is the account warehouse.
 */
export function hasSsoQuery(search: URLSearchParams): boolean {
  const client = (search.get("client") ?? "").trim();
  const returnTo = (search.get("return_to") ?? "").trim();
  const state = (search.get("state") ?? "").trim();
  return Boolean(client && returnTo && state);
}

export function ssoCompletePath(input: {
  pathname: string;
  hasSession: boolean;
  hasContinue: boolean;
  adding: boolean;
  hasSsoQuery: boolean;
}): string | null {
  if (input.adding || !input.hasSession) return null;
  if (!input.hasSsoQuery) return null;
  if (!CONTINUE_PATHS.has(input.pathname)) return null;
  return "/api/sso/complete";
}
