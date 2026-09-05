import { NextRequest, NextResponse } from "next/server";
import { clearPendingEmailCookie, pathFor, type AuthMode } from "@/lib/auth-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode: AuthMode = request.nextUrl.searchParams.get("mode") === "register" ? "register" : "login";
  const res = NextResponse.redirect(new URL(pathFor(mode), request.url), 303);
  clearPendingEmailCookie(res);
  return res;
}
