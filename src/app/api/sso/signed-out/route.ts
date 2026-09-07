import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/public-origin";
import { afterLastAccountSignOutUrl } from "@/lib/sso-frontchannel";
import { clearContinueRequest } from "@/lib/sso-continue";

export const dynamic = "force-dynamic";

/** Last-account sign-out hop: expire product cookies, then return to AuthTAP login. */
export async function GET(request: Request) {
  const dest = afterLastAccountSignOutUrl(publicOrigin(request));
  await clearContinueRequest();
  return NextResponse.redirect(dest, 303);
}
