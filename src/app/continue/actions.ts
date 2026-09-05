"use server";

import { redirect } from "next/navigation";
import { beginAddAccount, readAccountStore } from "@/lib/session";
import { denyContinue } from "@/lib/sso-complete";
import { clearContinueRequest, productHandoffUrl, readContinueRequest } from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";

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
  if (!handoff.ok) return { error: handoff.error };

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
