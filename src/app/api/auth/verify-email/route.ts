import { NextRequest, NextResponse } from "next/server";
import {
  attachPendingVerifyCookie,
  clearPendingVerifyCookie,
  parsePendingVerifyEmail,
  verifyEmailPath,
} from "@/lib/auth-flow";
import { clientContextFrom, dkVerifyEmail, isVerifiedAuth } from "@/lib/dk-auth";
import { publicOrigin, publicUrl } from "@/lib/public-origin";
import { completeVerifiedSession } from "@/lib/auth-verify";
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
  const code = String(form.get("code") ?? "").replace(/\D/g, "").slice(0, 6);

  if (!email || code.length !== 6) {
    const dest = applyContinueParams(publicUrl(verifyEmailPath("Enter the 6-digit code."), req), continueRequest);
    const res = NextResponse.redirect(dest, 303);
    if (email) attachPendingVerifyCookie(res, email);
    if (continueRequest) await attachContinueCookie(res, continueRequest);
    return res;
  }

  const result = await dkVerifyEmail(email, code, clientContextFrom(req));
  if (!isVerifiedAuth(result)) {
    const dest = applyContinueParams(
      publicUrl(verifyEmailPath(result.ok ? "Enter the 6-digit code." : result.error), req),
      continueRequest,
    );
    const res = NextResponse.redirect(dest, 303);
    attachPendingVerifyCookie(res, email);
    if (continueRequest) await attachContinueCookie(res, continueRequest);
    return res;
  }

  const finished = await completeVerifiedSession({
    token: result.token,
    user: result.user,
    continueRequest,
    origin: publicOrigin(req),
  });
  if (!finished.ok) {
    const dest = applyContinueParams(publicUrl(verifyEmailPath(finished.error), req), continueRequest);
    return NextResponse.redirect(dest, 303);
  }

  const res = NextResponse.redirect(finished.url, 303);
  finished.apply(res);
  clearPendingVerifyCookie(res);
  return res;
}
