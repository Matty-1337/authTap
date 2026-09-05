import { NextRequest, NextResponse } from "next/server";
import { readAccountStore } from "@/lib/session";
import { productHandoffUrl, readContinueRequest } from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const request = await readContinueRequest();
  if (!request) {
    return NextResponse.redirect(new URL("/account", req.url));
  }

  const store = await readAccountStore();
  if (!store) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (store.accounts.length !== 1) {
    return NextResponse.redirect(new URL("/continue", req.url));
  }

  const handoff = await handoffToProduct(store.accounts[0], request.client);
  if (!handoff.ok) {
    const dest = new URL("/continue", req.url);
    dest.searchParams.set("error", handoff.error);
    return NextResponse.redirect(dest);
  }

  const code = await signHandoffCode({ request, token: handoff.token, user: handoff.user });
  const dest = productHandoffUrl(request, code);
  const res = NextResponse.redirect(dest);
  res.cookies.delete("at_continue");
  return res;
}
