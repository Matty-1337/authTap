import { NextRequest, NextResponse } from "next/server";
import { attachPendingVerifyCookie, parsePendingVerifyEmail, verifyEmailPath } from "@/lib/auth-flow";
import { clientContextFrom, dkResendVerification } from "@/lib/dk-auth";
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

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const continueRequest =
    continueFromUnknown({
      client: form.get("client"),
      return_to: form.get("return_to"),
      state: form.get("state"),
    }) ?? (await parseContinueCookie(req.cookies.get(CONTINUE_COOKIE)?.value));
  const email =
    String(form.get("email") ?? "").trim().toLowerCase() ||
    parsePendingVerifyEmail(req.cookies.get("at_pending_verify")?.value);

  if (email) {
    await dkResendVerification(email, clientContextFrom(req));
  }

  const dest = applyContinueParams(publicUrl(verifyEmailPath(), req), continueRequest);
  const res = NextResponse.redirect(dest, 303);
  if (email) attachPendingVerifyCookie(res, email);
  if (continueRequest) await attachContinueCookie(res, continueRequest);
  return res;
}
