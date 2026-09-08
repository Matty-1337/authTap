import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { readPendingEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath, parseContinueInput, ssoIncomingPath } from "@/lib/sso-continue";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string; client?: string; return_to?: string; state?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const [session, adding] = await Promise.all([readSession(), isAddingAccount()]);
  if (session && !adding) {
    const pending = parseContinueInput(params);
    if (pending) {
      redirect(ssoIncomingPath(pending));
    }
    redirect(await afterAuthPath());
  }

  const error = params.error ?? "";
  const email = await readPendingEmail("register");
  const continueRequest = parseContinueInput(params);
  return (
    <AuthPanel mode="register" email={email} error={error} adding={adding} continueRequest={continueRequest} />
  );
}
