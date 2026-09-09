"use server";

import { redirect } from "next/navigation";
import {
  beginAddAccount,
  dropAccountFromStore,
  persistAccountStore,
  readAccountStore,
} from "@/lib/session";
import { denyContinue } from "@/lib/sso-complete";
import { clearContinueRequest, productHandoffUrl, readContinueRequest } from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";
import { isStaleHandoff } from "@/lib/sso-handoff-error";

export type ContinueActionState = {
  error: string;
};

export async function continueWithAccount(
  _prev: ContinueActionState,
  formData: FormData,
): Promise<ContinueActionState> {
  const request = await readContinueRequest();
  if (!request) redirect("/account");

  const userId = Number(formData.get("userId"));
  const store = await readAccountStore();
  const account = store?.accounts.find((entry) => entry.user.id === userId);
  if (!account) {
    return { error: "Choose an account to continue." };
  }

  const handoff = await handoffToProduct(account, request.client);
  if (!handoff.ok) {
    // Stale (401): the stored token was revoked. Evict the dead account and
    // send the user to /login to re-mint, keeping the product hop intact.
    if (isStaleHandoff(handoff) && store) {
      await persistAccountStore(dropAccountFromStore(store, account.user.id));
      redirect("/login");
    }
    return { error: handoff.error };
  }

  const code = await signHandoffCode({ request, token: handoff.token, user: handoff.user });
  await clearContinueRequest();
  redirect(productHandoffUrl(request, code));
}

export async function useAnotherAccount() {
  await beginAddAccount();
  redirect("/login");
}

export async function cancelContinue() {
  await denyContinue(await readContinueRequest());
}
