import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";
import { AuthWordmark } from "@/components/AuthWordmark";
import { readPendingVerifyEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath, continueFromSearchOrJar, ssoIncomingPath } from "@/lib/sso-continue";

type VerifyEmailPageProps = {
  searchParams: Promise<{ error?: string; email?: string; client?: string; return_to?: string; state?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const [session, adding] = await Promise.all([readSession(), isAddingAccount()]);
  const pending = await continueFromSearchOrJar(params);
  if (session && !adding) {
    if (pending) {
      redirect(ssoIncomingPath(pending));
    }
    redirect(await afterAuthPath());
  }

  const email = params.email?.trim().toLowerCase() || session?.user.email || (await readPendingVerifyEmail());
  if (!email) {
    redirect("/register");
  }

  const continueRequest = pending;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1C1F32] px-6 py-8 text-center sm:px-8">
        <AuthWordmark className="text-[24px]" />
        <VerifyEmailForm email={email} error={params.error ?? ""} continueRequest={continueRequest} />
      </div>
    </main>
  );
}
