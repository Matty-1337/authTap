import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-origin";
import { SESSION_COOKIE, verifyAccountStore } from "@/lib/session";
import { attachContinueCookie, parseContinueInput } from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const request = parseContinueInput({
    client: req.nextUrl.searchParams.get("client") ?? "",
    return_to: req.nextUrl.searchParams.get("return_to") ?? "",
    state: req.nextUrl.searchParams.get("state") ?? "",
  });
  if (!request) {
    return NextResponse.redirect(publicUrl("/account", req));
  }

  // Read at_session from this request. cookies() in a Route Handler can miss
  // it, which sent an already-signed-in user to /login and then /account.
  const store = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);
  if (!store) {
    const login = publicUrl("/login", req);
    login.searchParams.set("client", request.client);
    login.searchParams.set("return_to", request.returnTo);
    login.searchParams.set("state", request.state);
    const res = NextResponse.redirect(login);
    await attachContinueCookie(res, request);
    return res;
  }

  if (store.accounts.length !== 1) {
    const res = NextResponse.redirect(publicUrl("/continue", req));
    await attachContinueCookie(res, request);
    return res;
  }

  const handoff = await handoffToProduct(store.accounts[0], request.client);
  if (!handoff.ok) {
    const res = NextResponse.redirect(
      publicUrl(`/continue?error=${encodeURIComponent(handoff.error)}`, req),
    );
    await attachContinueCookie(res, request);
    return res;
  }

  const code = await signHandoffCode({ request, token: handoff.token, user: handoff.user });
  const dest = new URL(request.returnTo);
  dest.searchParams.set("code", code);
  dest.searchParams.set("state", request.state);
  return NextResponse.redirect(dest);
}
