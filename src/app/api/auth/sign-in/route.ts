import { NextRequest, NextResponse } from "next/server";
import {
  PENDING_EMAIL_COOKIE,
  clearPendingEmailCookie,
  parsePendingEmail,
  pathFor,
} from "@/lib/auth-flow";
import { completePasswordSignIn, redirectLocation } from "@/lib/auth-sign-in";
import type { AuthMode } from "@/lib/auth-types";
import { clientContextFrom } from "@/lib/dk-auth";
import { turnstileTokenFromForm } from "@/lib/turnstile";
import {
  SESSION_COOKIE,
  attachSessionStore,
  verifyAccountStore,
} from "@/lib/session";
import { publicOrigin, publicUrl } from "@/lib/public-origin";
import {
  CONTINUE_COOKIE,
  clearContinueCookie,
  applyContinueParams,
  parseContinueCookie,
  continueFromUnknown,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function modeFrom(form: FormData): AuthMode {
  return form.get("mode") === "register" ? "register" : "login";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const mode = modeFrom(form);
  /*
   * Read continue + pending email from the incoming request before any
   * Set-Cookie. Incoming already-signed-in SSO works because it 303s from
   * this same Request/NextResponse pair. First-time sign-in must match that.
   */
  const continueRequest =
    continueFromUnknown({
      client: form.get("client"),
      return_to: form.get("return_to"),
      state: form.get("state"),
    }) ?? (await parseContinueCookie(req.cookies.get(CONTINUE_COOKIE)?.value));
  const pendingEmail = parsePendingEmail(req.cookies.get(PENDING_EMAIL_COOKIE)?.value, mode);
  const existingStore = await verifyAccountStore(req.cookies.get(SESSION_COOKIE)?.value);

  const result = await completePasswordSignIn({
    mode,
    password: String(form.get("password") ?? ""),
    pendingEmail,
    continueRequest,
    existingStore,
    client: clientContextFrom(req, turnstileTokenFromForm(form)),
  });

  if (!result.ok) {
    const dest = applyContinueParams(publicUrl(pathFor(mode, result.error), req), continueRequest);
    return NextResponse.redirect(dest, 303);
  }

  const res = NextResponse.redirect(redirectLocation(result.dest.url, publicOrigin(req)), 303);
  await attachSessionStore(res, result.store);
  clearPendingEmailCookie(res);
  if (result.dest.clearContinue) clearContinueCookie(res);
  return res;
}
