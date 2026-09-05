import "server-only";

import { dkBackendUrl, ssoSecret } from "@/lib/env";

/** Revoke AuthTAP-connected product tokens and notify each product app (S2S). */
export async function logoutUserFromAuthTapProducts(userId: number): Promise<void> {
  const secret = ssoSecret();
  const base = dkBackendUrl();
  try {
    await fetch(`${base}/api/sso/authtap/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-AuthTAP-Logout-Secret": secret,
      },
      body: JSON.stringify({ sub: String(userId) }),
      cache: "no-store",
    });
  } catch {
    // Best-effort — AuthTAP local session is still cleared.
  }
}
