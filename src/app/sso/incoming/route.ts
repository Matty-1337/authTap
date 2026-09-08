import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-origin";
import { SESSION_COOKIE, clearAddingCookie, verifyAccountStore } from "@/lib/session";
import { attachContinueCookie, parseContinueInput, pathAfterIncomingStore } from "@/lib/sso-continue";

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

  // Same-site hop after /api/sso/incoming. Read at_session from this request
  // (cookies() in a Route Handler can miss it). Write at_continue here — a
  // page cannot call cookies().set().
  const store = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(publicUrl(pathAfterIncomingStore(Boolean(store), request), req));
  await attachContinueCookie(res, request);
  clearAddingCookie(res);
  return res;
}
