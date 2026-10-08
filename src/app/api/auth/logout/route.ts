import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-origin";
import { strayUrl } from "@/lib/sso-account-continue";
import { removeActiveAccount } from "@/lib/session";
import { clearContinueRequest } from "@/lib/sso-continue";

export async function POST(request: Request) {
  const stillSignedIn = await removeActiveAccount();
  if (stillSignedIn) {
    await clearContinueRequest();
    return NextResponse.redirect(strayUrl(), 303);
  }
  return NextResponse.redirect(publicUrl("/api/sso/signed-out", request), 303);
}
