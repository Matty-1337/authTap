import { redirect } from "next/navigation";
import { endAddAccount, readAccountStore } from "@/lib/session";
import {
  parseContinueInput,
  pathAfterIncomingStore,
  writeContinueRequest,
} from "@/lib/sso-continue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SsoIncomingPageProps = {
  searchParams: Promise<{ client?: string; return_to?: string; state?: string }>;
};

export default async function SsoIncomingPage({ searchParams }: SsoIncomingPageProps) {
  const pending = parseContinueInput(await searchParams);
  if (!pending) redirect("/account");

  await writeContinueRequest(pending);
  // Leftover "Use another account" must not hide a signed-in product hop.
  await endAddAccount();

  const store = await readAccountStore();
  redirect(pathAfterIncomingStore(Boolean(store), pending));
}
