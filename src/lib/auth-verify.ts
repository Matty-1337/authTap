import "server-only";

import { NextResponse } from "next/server";
import { attachSessionStore, mergeAccountIntoStore, type AccountStore, type SessionData } from "@/lib/session";
import {
  attachContinueCookie,
  destinationAfterVerify,
  type ContinueRequest,
} from "@/lib/sso-continue";
import { redirectLocation } from "@/lib/auth-sign-in";

export async function completeVerifiedSession(input: {
  token: string;
  user: SessionData["user"];
  continueRequest: ContinueRequest | null;
  origin: string;
  existingStore?: AccountStore | null;
}): Promise<
  | { ok: false; error: string }
  | { ok: true; url: string; apply: (res: NextResponse) => Promise<void> }
> {
  const account = { token: input.token, user: input.user };
  // Merge into the caller's current store so a fresh signup is added to the
  // account list instead of replacing it. Falls back to a new store.
  const merged = mergeAccountIntoStore(account, input.existingStore ?? null);
  if (!merged.ok) return { ok: false, error: merged.error };

  const dest = destinationAfterVerify(input.continueRequest);
  return {
    ok: true,
    url: redirectLocation(dest, input.origin),
    apply: async (res) => {
      await attachSessionStore(res, merged.store);
      if (input.continueRequest) await attachContinueCookie(res, input.continueRequest);
    },
  };
}
