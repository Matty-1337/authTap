import { NextRequest, NextResponse } from "next/server";
import { attachPendingVerifyCookie, parsePendingVerifyEmail, pathFor, verifyEmailPath } from "@/lib/auth-flow";
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

function wantsJson(req: NextRequest): boolean {
  return (req.headers.get("accept") ?? "").includes("application/json");
}

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
  const json = wantsJson(req);

  if (email) {
    const result = await dkResendVerification(email, clientContextFrom(req));
    if (!result.ok && result.alreadyVerified) {
      const dest = applyContinueParams(publicUrl(pathFor("login", result.error), req), continueRequest);
      if (json) {
        return NextResponse.json({ ok: false, alreadyVerified: true, error: result.error, url: dest.toString() });
      }
      return NextResponse.redirect(dest, 303);
    }
    if (json) {
      const res = NextResponse.json(
        result.ok ? { ok: true } : { ok: false, error: result.error },
        { status: result.ok ? 200 : 422 },
      );
      attachPendingVerifyCookie(res, email);
      return res;
    }
  }

  const dest = applyContinueParams(publicUrl(verifyEmailPath(), req), continueRequest);
  const res = NextResponse.redirect(dest, 303);
  if (email) attachPendingVerifyCookie(res, email);
  if (continueRequest) await attachContinueCookie(res, continueRequest);
  return res;
}
