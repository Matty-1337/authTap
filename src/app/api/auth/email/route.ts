import { NextRequest, NextResponse } from "next/server";
import { attachPendingEmailCookie, pathFor } from "@/lib/auth-flow";
import { isValidEmail, normalizeEmail } from "@/lib/auth-sign-in";
import type { AuthMode } from "@/lib/auth-types";
import { publicUrl } from "@/lib/public-origin";
import {
  CONTINUE_COOKIE,
  applyContinueParams,
  attachContinueCookie,
  resolveContinue,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function modeFrom(form: FormData): AuthMode {
  return form.get("mode") === "register" ? "register" : "login";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const mode = modeFrom(form);
  const typedEmail = String(form.get("email") ?? "");
  const email = normalizeEmail(typedEmail);
  const continueRequest = await resolveContinue(
    {
      client: form.get("client"),
      return_to: form.get("return_to"),
      state: form.get("state"),
    },
    req.cookies.get(CONTINUE_COOKIE)?.value,
  );

  if (!isValidEmail(email)) {
    const dest = applyContinueParams(publicUrl(pathFor(mode, "Enter a valid email."), req), continueRequest);
    const res = NextResponse.redirect(dest, 303);
    if (continueRequest) await attachContinueCookie(res, continueRequest);
    return res;
  }

  /*
   * Real HTTP 303, same as /api/sso/incoming → /login. Do not use a server
   * action: writing at_pending_email through cookies() can drop at_continue
   * (client, returnTo, state), and redirect() from /login trips Turbopack.
   * Carry continue on the URL too — the password step must still know CoreTAP.
   */
  const dest = applyContinueParams(publicUrl(pathFor(mode), req), continueRequest);
  const res = NextResponse.redirect(dest, 303);
  attachPendingEmailCookie(res, mode, email);
  if (continueRequest) await attachContinueCookie(res, continueRequest);
  return res;
}
