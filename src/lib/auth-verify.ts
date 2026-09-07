import "server-only";

import { NextResponse } from "next/server";
import { attachSessionStore, mergeAccountIntoStore, type SessionData } from "@/lib/session";
import { destinationAfterSignIn } from "@/lib/sso-complete";
import { clearContinueCookie, type ContinueRequest } from "@/lib/sso-continue";
import { redirectLocation } from "@/lib/auth-sign-in";

export async function completeVerifiedSession(input: {
  token: string;
  user: SessionData["user"];
  continueRequest: ContinueRequest | null;
  origin: string;
}): Promise<
  | { ok: false; error: string }
  | { ok: true; url: string; apply: (res: NextResponse) => Promise<void> }
> {
  const account = { token: input.token, user: input.user };
  const merged = mergeAccountIntoStore(account, null);
  if (!merged.ok) return { ok: false, error: merged.error };

  const dest = await destinationAfterSignIn(account, input.continueRequest);
  return {
    ok: true,
    url: redirectLocation(dest.url, input.origin),
    apply: async (res) => {
      await attachSessionStore(res, merged.store);
      if (dest.clearContinue) clearContinueCookie(res);
    },
  };
}
