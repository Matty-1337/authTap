import { NextResponse } from "next/server";
import { removeActiveAccount } from "@/lib/session";
import { clearContinueRequest } from "@/lib/sso-continue";

export async function POST(request: Request) {
  const stillSignedIn = await removeActiveAccount();
  if (stillSignedIn) {
    await clearContinueRequest();
    return NextResponse.redirect(new URL("/account", request.url), 303);
  }
  return NextResponse.redirect(new URL("/api/sso/signed-out", request.url), 303);
}
