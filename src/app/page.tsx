import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { BrandSplash } from "@/components/BrandSplash";
import { readPendingEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath, parseContinueInput, ssoIncomingPath } from "@/lib/sso-continue";

type HomePageProps = {
  searchParams: Promise<{ error?: string; client?: string; return_to?: string; state?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
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
  const email = await readPendingEmail("login");
  const continueRequest = parseContinueInput(params);
  return (
    <>
      {adding ? null : <BrandSplash />}
      <AuthPanel mode="login" email={email} error={error} adding={adding} continueRequest={continueRequest} />
    </>
  );
}
