import "server-only";

import { redirect } from "next/navigation";
import {
  OIDC_BRIDGE_PATH,
  clearContinueRequest,
  isOidcHop,
  productHandoffUrl,
  productLoginUrl,
  readContinueRequest,
  type ContinueRequest,
} from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";
import { strayUrl } from "@/lib/sso-account-continue";

type ContinueAccount = {
  token: string;
  user: { id: number; name: string; email: string };
};

export async function denyContinue(request: ContinueRequest | null): Promise<never> {
  await clearContinueRequest();
  if (request) redirect(productLoginUrl(request, "sso_denied"));
  redirect(strayUrl());
}

export type SignInDestination = {
  url: string;
  clearContinue: boolean;
};

/**
 * Finish an in-flight SSO continue. Pass the already-parsed at_continue
 * payload — never re-read cookies() after writing at_session, which can
 * hide other request cookies in a server action.
 */
export async function destinationAfterSignIn(
  account: ContinueAccount,
  request: ContinueRequest | null,
): Promise<SignInDestination> {
  if (!request) return { url: strayUrl(), clearContinue: false };
  // The bridge page reads the account from at_session and clears at_continue itself.
  if (isOidcHop(request)) return { url: OIDC_BRIDGE_PATH, clearContinue: false };

  const handoff = await handoffToProduct(account, request.client);
  if (!handoff.ok) {
    return { url: `/continue?error=${encodeURIComponent(handoff.error)}`, clearContinue: false };
  }

  const code = await signHandoffCode({ request, token: handoff.token, user: handoff.user });
  return { url: productHandoffUrl(request, code), clearContinue: true };
}

export async function finishContinue(
  account: ContinueAccount,
  request?: ContinueRequest | null,
): Promise<string> {
  const continueRequest = request !== undefined ? request : await readContinueRequest();
  const dest = await destinationAfterSignIn(account, continueRequest);
  if (dest.clearContinue) await clearContinueRequest();
  return dest.url;
}
