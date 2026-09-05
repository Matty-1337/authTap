import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { readPendingEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath } from "@/lib/sso-continue";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const [session, adding] = await Promise.all([readSession(), isAddingAccount()]);
  if (session && !adding) redirect(await afterAuthPath());

  const error = (await searchParams).error ?? "";
  const email = await readPendingEmail("register");
  return <AuthPanel mode="register" email={email} error={error} adding={adding} />;
}
