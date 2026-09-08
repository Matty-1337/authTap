import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-origin";
import { parseContinueInput, ssoIncomingPath } from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const request = parseContinueInput({
    client: req.nextUrl.searchParams.get("client") ?? "",
    return_to: req.nextUrl.searchParams.get("return_to") ?? "",
    state: req.nextUrl.searchParams.get("state") ?? "",
  });
  if (!request) {
    let returnHost = "";
    try {
      returnHost = new URL(req.nextUrl.searchParams.get("return_to") ?? "").host;
    } catch {
      returnHost = "";
    }
    console.info("[authtap-sso] incoming rejected", {
      client: req.nextUrl.searchParams.get("client") ?? "",
      returnHost,
    });
    return NextResponse.redirect(publicUrl("/account", req));
  }

  // Do not read at_session here. Product hops are cross-site (especially
  // core-tap.com → AuthTAP). Lax cookies often miss this first request.
  // Bounce to a same-site route that can read the cookie and set at_continue.
  return NextResponse.redirect(publicUrl(ssoIncomingPath(request), req));
}
