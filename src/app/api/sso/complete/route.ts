import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-origin";
import { SESSION_COOKIE, verifyAccountStore } from "@/lib/session";
import {
  CONTINUE_COOKIE,
  parseContinueCookie,
  parseContinueInput,
  productHandoffUrl,
} from "@/lib/sso-continue";
import { isStaleHandoff } from "@/lib/sso-handoff-error";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";
import { redirectToLoginAfterStaleHandoff } from "@/lib/sso-reauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function finish(req: NextRequest, userId?: number) {
  const fromCookie = await parseContinueCookie(req.cookies.get(CONTINUE_COOKIE)?.value);
  const fromQuery = parseContinueInput({
    client: req.nextUrl.searchParams.get("client") ?? "",
    return_to: req.nextUrl.searchParams.get("return_to") ?? "",
    state: req.nextUrl.searchParams.get("state") ?? "",
  });
  const request = fromCookie ?? fromQuery;
  if (!request) {
    return NextResponse.redirect(publicUrl("/account", req));
  }

  const store = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);
  if (!store) {
    return NextResponse.redirect(publicUrl("/login", req));
  }

  const account =
    userId && Number.isFinite(userId)
      ? store.accounts.find((entry) => entry.user.id === userId)
      : store.accounts.length === 1
        ? store.accounts[0]
        : null;
  if (!account) {
    return NextResponse.redirect(publicUrl("/continue", req));
  }

  const handoff = await handoffToProduct(account, request.client);
  if (!handoff.ok) {
    if (isStaleHandoff(handoff)) {
      return redirectToLoginAfterStaleHandoff(req, request);
    }
    const dest = publicUrl("/continue", req);
    dest.searchParams.set("error", handoff.error);
    return NextResponse.redirect(dest);
  }

  const code = await signHandoffCode({ request, token: handoff.token, user: handoff.user });
  const res = NextResponse.redirect(productHandoffUrl(request, code), 303);
  res.cookies.delete("at_continue");
  return res;
}

export async function GET(req: NextRequest) {
  return finish(req);
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const userId = Number(form?.get("userId"));
  return finish(req, Number.isFinite(userId) && userId > 0 ? userId : undefined);
}
