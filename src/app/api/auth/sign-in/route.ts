import { NextRequest, NextResponse } from "next/server";
import {
  PENDING_EMAIL_COOKIE,
  attachPendingVerifyCookie,
  clearPendingEmailCookie,
  parsePendingEmail,
  pathFor,
  verifyEmailPath,
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
  attachContinueCookie,
  clearContinueCookie,
  applyContinueParams,
  continueFromUnknown,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function modeFrom(form: FormData): AuthMode {
  return form.get("mode") === "register" ? "register" : "login";
}

function destKind(url: string): string {
  if (url.includes("/auth/authtap/callback")) return "product-callback";
  if (url.startsWith("/account")) return "account";
  if (url.startsWith("/continue")) return "continue";
  return "other";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const mode = modeFrom(form);
  /*
   * Read continue + pending email from the incoming request before any
   * Set-Cookie. Incoming already-signed-in SSO works because it 303s from
   * this same Request/NextResponse pair. First-time sign-in must match that.
   */
  const continueRequest = continueFromUnknown({
    client: form.get("client"),
    return_to: form.get("return_to"),
    state: form.get("state"),
  });
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
  console.info("[authtap-sso] sign-in dest", {
    formClient: typeof form.get("client") === "string" ? form.get("client") : "",
    hasContinue: Boolean(continueRequest),
    dest: result.ok ? (result.needsVerification ? "verify-email" : destKind(result.dest.url)) : "error",
  });

  if (!result.ok) {
    const dest = applyContinueParams(publicUrl(pathFor(mode, result.error), req), continueRequest);
    return NextResponse.redirect(dest, 303);
  }

  if (result.needsVerification) {
    const dest = applyContinueParams(publicUrl(verifyEmailPath(), req), continueRequest);
    const res = NextResponse.redirect(dest, 303);
    attachPendingVerifyCookie(res, result.email);
    clearPendingEmailCookie(res);
    if (continueRequest) await attachContinueCookie(res, continueRequest);
    return res;
  }

  const res = NextResponse.redirect(redirectLocation(result.dest.url, publicOrigin(req)), 303);
  await attachSessionStore(res, result.store);
  clearPendingEmailCookie(res);
  if (result.dest.clearContinue) clearContinueCookie(res);
  return res;
}
