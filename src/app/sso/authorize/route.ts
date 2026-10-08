import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-origin";
import { SESSION_COOKIE, clearAddingCookie, verifyAccountStore } from "@/lib/session";
import { strayUrl } from "@/lib/sso-account-continue";
import {
  OIDC_BRIDGE_PATH,
  attachContinueCookie,
  loginContinuePath,
  parseContinueInput,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * dk-backend's /oauth/authorize bounces a signed-out browser here with the
 * original authorize URL as ?return=. This is a product hop like /sso/incoming,
 * except it ends by bridging a dk-backend web session rather than redeeming a
 * handoff code: one account goes straight to the bridge, several get the
 * picker, none gets the sign-in form first.
 */
function randomState(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
}

export async function GET(req: NextRequest) {
  const request = parseContinueInput({
    client: "oidc",
    return_to: req.nextUrl.searchParams.get("return") ?? "",
    state: randomState(),
  });
  if (!request) {
    let returnHost = "";
    try {
      returnHost = new URL(req.nextUrl.searchParams.get("return") ?? "").host;
    } catch {
      returnHost = "";
    }
    console.info("[authtap-sso] oidc authorize rejected", { returnHost });
    return NextResponse.redirect(strayUrl());
  }

  const store = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);
  const count = store?.accounts.length ?? 0;
  const path = count === 0 ? loginContinuePath(request) : count === 1 ? OIDC_BRIDGE_PATH : "/continue";

  const res = NextResponse.redirect(publicUrl(path, req));
  await attachContinueCookie(res, request);
  clearAddingCookie(res);
  return res;
}
