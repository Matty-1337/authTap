import { NextRequest, NextResponse } from "next/server";
import {
  attachPendingVerifyCookie,
  clearPendingVerifyCookie,
  parsePendingVerifyEmail,
  pathFor,
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
  const code = String(form.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  const json = wantsJson(req);

  if (!email || code.length !== 6) {
    const dest = applyContinueParams(publicUrl(verifyEmailPath("Enter the 6-digit code."), req), continueRequest);
    if (json) {
      const res = NextResponse.json({ ok: false, error: "Enter the 6-digit code." });
      if (email) attachPendingVerifyCookie(res, email);
      return res;
    }
    const res = NextResponse.redirect(dest, 303);
    if (email) attachPendingVerifyCookie(res, email);
    if (continueRequest) await attachContinueCookie(res, continueRequest);
    return res;
  }

  const result = await dkVerifyEmail(email, code, clientContextFrom(req));
  if (!isVerifiedAuth(result)) {
    if (result.ok === false && result.alreadyVerified) {
      const dest = applyContinueParams(publicUrl(pathFor("login", result.error), req), continueRequest);
      if (json) {
        return NextResponse.json({ ok: false, alreadyVerified: true, error: result.error, url: dest.toString() });
      }
      return NextResponse.redirect(dest, 303);
    }
    const dest = applyContinueParams(
      publicUrl(verifyEmailPath(result.ok ? "Enter the 6-digit code." : result.error), req),
      continueRequest,
    );
    if (json) {
      const res = NextResponse.json({
        ok: false,
        error: result.ok ? "Enter the 6-digit code." : result.error,
      });
      attachPendingVerifyCookie(res, email);
      return res;
    }
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
    if (json) return NextResponse.json({ ok: false, error: finished.error });
    return NextResponse.redirect(dest, 303);
  }

  if (json) {
    const res = NextResponse.json({ ok: true, url: finished.url });
    await finished.apply(res);
    clearPendingVerifyCookie(res);
    return res;
  }

  const res = NextResponse.redirect(finished.url, 303);
  await finished.apply(res);
  clearPendingVerifyCookie(res);
  return res;
}
