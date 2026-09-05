import { NextRequest, NextResponse } from "next/server";
import { attachPendingEmailCookie, pathFor } from "@/lib/auth-flow";
import { isValidEmail, normalizeEmail } from "@/lib/auth-sign-in";
import type { AuthMode } from "@/lib/auth-types";

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

  if (!isValidEmail(email)) {
    return NextResponse.redirect(new URL(pathFor(mode, "Enter a valid email."), req.url), 303);
  }

  /*
   * Real HTTP 303, same as /api/sso/incoming → /login. Do not use a server
   * action: writing at_pending_email through cookies() can drop at_continue
   * (client, returnTo, state), and redirect() from /login trips Turbopack.
   */
  const res = NextResponse.redirect(new URL(pathFor(mode), req.url), 303);
  attachPendingEmailCookie(res, mode, email);
  return res;
}
