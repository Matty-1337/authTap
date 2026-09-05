import { NextRequest, NextResponse } from "next/server";
import { readAccountStore } from "@/lib/session";
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
    return NextResponse.redirect(new URL("/account", req.url));
  }

  const store = await readAccountStore();
  if (!store) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    await attachContinueCookie(res, request);
    return res;
  }

  if (store.accounts.length !== 1) {
    const res = NextResponse.redirect(new URL("/continue", req.url));
    await attachContinueCookie(res, request);
    return res;
  }

  const handoff = await handoffToProduct(store.accounts[0], request.client);
  if (!handoff.ok) {
    const res = NextResponse.redirect(
      new URL(`/continue?error=${encodeURIComponent(handoff.error)}`, req.url),
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
