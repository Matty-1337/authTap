"use server";

import { redirect } from "next/navigation";
import { endAddAccount } from "@/lib/session";
import { afterAuthPath, readContinueRequest } from "@/lib/sso-continue";

/** Back out of "Use another account": return to the product hop's picker. */
export async function cancelAddAccount() {
  await endAddAccount();
  const request = await readContinueRequest();
  redirect(request ? "/continue" : await afterAuthPath());
}
