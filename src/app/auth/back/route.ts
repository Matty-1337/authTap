import { NextRequest, NextResponse } from "next/server";
import { clearPendingEmailCookie, pathFor, type AuthMode } from "@/lib/auth-flow";
import { publicUrl } from "@/lib/public-origin";
import {
  CONTINUE_COOKIE,
  applyContinueParams,
  attachContinueCookie,
  continueFromUnknown,
  parseContinueCookie,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode: AuthMode = request.nextUrl.searchParams.get("mode") === "register" ? "register" : "login";
  const continueRequest =
    continueFromUnknown({
      client: request.nextUrl.searchParams.get("client"),
      return_to: request.nextUrl.searchParams.get("return_to"),
      state: request.nextUrl.searchParams.get("state"),
    }) ?? (await parseContinueCookie(request.cookies.get(CONTINUE_COOKIE)?.value));
  const dest = applyContinueParams(publicUrl(pathFor(mode), request), continueRequest);
  const res = NextResponse.redirect(dest, 303);
  clearPendingEmailCookie(res);
  if (continueRequest) await attachContinueCookie(res, continueRequest);
  return res;
}
