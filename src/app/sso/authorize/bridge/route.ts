import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifyAccountStore } from "@/lib/session";
import { strayUrl } from "@/lib/sso-account-continue";
import { CONTINUE_COOKIE, clearContinueCookie, isOidcHop, oidcBridgePostUrl, parseContinueCookie } from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Finish an OIDC hop. A top-level form POST carries the active account's
 * dk-backend token to /sso/session/bridge on the host the authorize URL names,
 * so the web session cookie lands first-party there and the token never
 * appears in a URL. dk-backend then redirects back to /oauth/authorize, now
 * signed in, and issues the product its code.
 */
export async function GET(req: NextRequest) {
  const request = await parseContinueCookie(req.cookies.get(CONTINUE_COOKIE)?.value);
  const store = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);
  const account = store?.accounts.find((entry) => entry.user.id === store.activeUserId) ?? store?.accounts[0];

  if (!isOidcHop(request) || !account) {
    const res = NextResponse.redirect(strayUrl());
    clearContinueCookie(res);
    return res;
  }

  const action = escapeAttr(oidcBridgePostUrl(request));
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>AuthTAP</title></head>
<body style="margin:0;background:#161826;color:#F2F2F5;font-family:system-ui,sans-serif">
<form id="bridge" method="post" action="${action}">
<input type="hidden" name="token" value="${escapeAttr(account.token)}">
<input type="hidden" name="return" value="${escapeAttr(request.returnTo)}">
<noscript><button type="submit">Continue</button></noscript>
</form>
<div style="display:grid;place-items:center;height:100vh"><p>Signing you in</p></div>
<script>document.getElementById("bridge").submit();</script>
</body></html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
  clearContinueCookie(res);
  return res;
}
