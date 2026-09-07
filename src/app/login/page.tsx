import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { readPendingEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath, parseContinueInput, readContinueRequest } from "@/lib/sso-continue";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; client?: string; return_to?: string; state?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const [session, adding] = await Promise.all([readSession(), isAddingAccount()]);
  if (session && !adding) {
    const pending = parseContinueInput(params);
    if (pending) {
      redirect(
        `/api/sso/incoming?client=${encodeURIComponent(pending.client)}&return_to=${encodeURIComponent(pending.returnTo)}&state=${encodeURIComponent(pending.state)}`,
      );
    }
    redirect(await afterAuthPath());
  }

  const error = params.error ?? "";
  const email = await readPendingEmail("login");
  const continueRequest = parseContinueInput(params) ?? (await readContinueRequest());
  return (
    <AuthPanel mode="login" email={email} error={error} adding={adding} continueRequest={continueRequest} />
  );
}
