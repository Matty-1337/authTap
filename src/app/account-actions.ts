"use server";

import { redirect } from "next/navigation";
import { beginAddAccount, endAddAccount, switchAccount } from "@/lib/session";
import { afterAuthPath } from "@/lib/sso-continue";

export async function startAddAccount() {
  await beginAddAccount();
  redirect("/login");
}

export async function cancelAddAccount() {
  await endAddAccount();
  redirect(await afterAuthPath());
}

export async function chooseAccount(formData: FormData) {
  const userId = Number(formData.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) redirect("/account");
  await switchAccount(userId);
  redirect(await afterAuthPath());
}
