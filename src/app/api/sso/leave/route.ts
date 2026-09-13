import { NextResponse } from "next/server";
import { clearPendingEmailCookie } from "@/lib/auth-flow";
import { publicOrigin, publicUrl } from "@/lib/public-origin";
import { removeAccount, removeActiveAccount } from "@/lib/session";
import { afterLastAccountSignOutUrl } from "@/lib/sso-frontchannel";
import { clearContinueRequest } from "@/lib/sso-continue";

export const dynamic = "force-dynamic";

/**
 * Native form POST so the browser can hop through each product to expire
 * cookies, then return to AuthTAP /login.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const userId = Number(form?.get("userId"));
  const stillSignedIn =
    Number.isFinite(userId) && userId > 0 ? await removeAccount(userId) : await removeActiveAccount();

  if (stillSignedIn) {
    await clearContinueRequest();
    return NextResponse.redirect(publicUrl("/account", request), 303);
  }

  const dest = afterLastAccountSignOutUrl(publicOrigin(request));
  await clearContinueRequest();
  const res = NextResponse.redirect(dest, 303);
  // Do not resurrect the just-signed-out email at the password step on the
  // next visit to /login — start fresh at the email entry step.
  clearPendingEmailCookie(res);
  return res;
}
