import "server-only";

import { dkLogin, dkRegister, type DkClientContext } from "@/lib/dk-auth";
import type { AuthMode } from "@/lib/auth-types";
import {
  mergeAccountIntoStore,
  type AccountStore,
  type SessionData,
} from "@/lib/session";
import { destinationAfterSignIn, type SignInDestination } from "@/lib/sso-complete";
import type { ContinueRequest } from "@/lib/sso-continue";

export type PasswordSignInInput = {
  mode: AuthMode;
  password: string;
  pendingEmail: string;
  continueRequest: ContinueRequest | null;
  existingStore: AccountStore | null;
  client?: DkClientContext;
};

export type PasswordSignInResult =
  | { ok: false; error: string }
  | {
      ok: true;
      account: SessionData;
      store: AccountStore;
      dest: SignInDestination;
    };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

export async function completePasswordSignIn(input: PasswordSignInInput): Promise<PasswordSignInResult> {
  const email = normalizeEmail(input.pendingEmail);
  const password = input.password;

  if (!email) return { ok: false, error: "Enter your email first." };
  if (!password) return { ok: false, error: "Enter your password." };
  if (input.mode === "register" && password.length < 8) {
    return { ok: false, error: "Use at least 8 characters." };
  }

  const result =
    input.mode === "login"
      ? await dkLogin(email, password, input.client)
      : await dkRegister(email, password, input.client);
  if (!result.ok) return { ok: false, error: result.error };

  const account = { token: result.token, user: result.user };
  const merged = mergeAccountIntoStore(account, input.existingStore);
  if (!merged.ok) return { ok: false, error: merged.error };

  return {
    ok: true,
    account,
    store: merged.store,
    dest: await destinationAfterSignIn(account, input.continueRequest),
  };
}

export function redirectLocation(url: string, origin: string): string {
  return url.startsWith("http://") || url.startsWith("https://") ? url : new URL(url, origin).toString();
}
