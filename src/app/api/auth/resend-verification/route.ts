import { NextRequest, NextResponse } from "next/server";
import { attachPendingVerifyCookie, parsePendingVerifyEmail, verifyEmailPath } from "@/lib/auth-flow";
import { clientContextFrom, dkResendVerification } from "@/lib/dk-auth";
import { publicUrl } from "@/lib/public-origin";
import { SESSION_COOKIE, verifyAccountStore } from "@/lib/session";
import {
  CONTINUE_COOKIE,
  applyContinueParams,
  attachContinueCookie,
  destinationWhenAlreadyVerified,
  resolveContinue,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wantsJson(req: NextRequest): boolean {
  return (req.headers.get("accept") ?? "").includes("application/json");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const continueRequest = await resolveContinue(
    {
      client: form.get("client"),
      return_to: form.get("return_to"),
      state: form.get("state"),
    },
    req.cookies.get(CONTINUE_COOKIE)?.value,
  );
  const email =
    String(form.get("email") ?? "").trim().toLowerCase() ||
    parsePendingVerifyEmail(req.cookies.get("at_pending_verify")?.value);
  const json = wantsJson(req);

  if (email) {
    const result = await dkResendVerification(email, clientContextFrom(req));
    if (!result.ok && result.alreadyVerified) {
      const store = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);
      const dest = publicUrl(destinationWhenAlreadyVerified(continueRequest, Boolean(store)), req);
      const res = json
        ? NextResponse.json({ ok: true, alreadyVerified: true, url: dest.toString() })
        : NextResponse.redirect(dest, 303);
      if (continueRequest) await attachContinueCookie(res, continueRequest);
      return res;
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
