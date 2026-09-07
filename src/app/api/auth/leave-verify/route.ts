import { NextRequest, NextResponse } from "next/server";
import { clearPendingEmailCookie, clearPendingVerifyCookie } from "@/lib/auth-flow";
import { publicUrl } from "@/lib/public-origin";
import { clearSessionCookies } from "@/lib/session";
import {
  applyContinueParams,
  clearContinueCookie,
  continueFromUnknown,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function leave(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "register" ? "register" : "login";
  const continueRequest = continueFromUnknown({
    client: req.nextUrl.searchParams.get("client"),
    return_to: req.nextUrl.searchParams.get("return_to"),
    state: req.nextUrl.searchParams.get("state"),
  });
  const dest = applyContinueParams(publicUrl(`/${mode}`, req), continueRequest);
  const res = NextResponse.redirect(dest, 303);
  clearPendingVerifyCookie(res);
  clearPendingEmailCookie(res);
  clearSessionCookies(res);
  clearContinueCookie(res);
  return res;
}

export async function GET(req: NextRequest) {
  return leave(req);
}

export async function POST(req: NextRequest) {
  return leave(req);
}
