import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { BrandSplash } from "@/components/BrandSplash";
import { readPendingEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath } from "@/lib/sso-continue";

type HomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const [session, adding] = await Promise.all([readSession(), isAddingAccount()]);
  if (session && !adding) redirect(await afterAuthPath());

  const error = (await searchParams).error ?? "";
  const email = await readPendingEmail("login");
  return (
    <>
      {adding ? null : <BrandSplash />}
      <AuthPanel mode="login" email={email} error={error} adding={adding} />
    </>
  );
}
