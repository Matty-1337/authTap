import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";
import { AuthTapMark } from "@/components/AuthTapMark";
import { AuthWordmark } from "@/components/AuthWordmark";
import { readPendingVerifyEmail } from "@/lib/auth-flow";
import { isAddingAccount, readSession } from "@/lib/session";
import { afterAuthPath, parseContinueInput, readContinueRequest } from "@/lib/sso-continue";

type VerifyEmailPageProps = {
  searchParams: Promise<{ error?: string; email?: string; client?: string; return_to?: string; state?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
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

  const email = params.email?.trim().toLowerCase() || (await readPendingVerifyEmail());
  if (!email) {
    redirect("/register");
  }

  const continueRequest = parseContinueInput(params) ?? (await readContinueRequest());
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-[400px] flex-col items-center md:max-w-[560px] md:flex-row md:items-center md:gap-7 md:rounded-2xl md:border md:border-white/10 md:bg-[#161826] md:px-8 md:py-8 md:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center md:shrink-0">
          <AuthTapMark className="h-[72px] w-[68px]" knockout="#161826" />
          <AuthWordmark className="mt-3 text-[28px] md:text-[24px]" />
        </div>
        <div className="mt-8 flex w-full flex-col gap-3 md:mt-0">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#9B6DFF]">Email verification</p>
            <h1 className="mt-1 text-[22px] font-semibold text-[#F2F2F5]">Check your inbox</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#F2F2F5]/55">
              We sent a 6-digit code to <span className="text-[#F2F2F5]">{email}</span>. Verify to finish this AuthTAP
              account. Until then it cannot open CoreTAP, NexusTAP, or Signal TAP.
            </p>
          </div>
          <VerifyEmailForm email={email} error={params.error ?? ""} continueRequest={continueRequest} />
          <p className="text-center text-[14px] text-[#F2F2F5]/55 md:text-left">
            Wrong email?{" "}
            <a className="text-[#9B6DFF]" href="/register">
              Start over
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
