export const SESSION_COOKIE = "at_session";
export const CONTINUE_COOKIE = "at_continue";
export const ADDING_COOKIE = "at_adding";

const CONTINUE_PATHS = new Set(["/", "/login", "/register", "/account"]);

/**
 * AuthTAP is the sign-in step between a product and its client, not a site
 * of its own. A visit that no product sent here goes to the Delta Kinetics
 * site instead of an AuthTAP page.
 */
export function strayUrl(): string {
  return (process.env.AUTHTAP_STRAY_URL ?? "").trim().replace(/\/$/, "") || "https://deltakinetics.io";
}

/**
 * A request is part of a product hop when it carries client/return_to/state
 * or the at_continue cookie that /sso/incoming wrote for it. Anything else on
 * an AuthTAP page is a direct visit. /account was the old account warehouse
 * and is no longer a destination at all.
 */
export function isStrayVisit(input: { pathname: string; hasSsoQuery: boolean; hasContinue: boolean }): boolean {
  if (input.pathname === "/account") return true;
  return !input.hasSsoQuery && !input.hasContinue;
}

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
