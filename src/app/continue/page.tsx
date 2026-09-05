import { redirect } from "next/navigation";
import { ContinuePicker } from "@/app/continue/ContinuePicker";
import { AuthTapMark } from "@/components/AuthTapMark";
import { AuthWordmark } from "@/components/AuthWordmark";
import { readAccountStore } from "@/lib/session";
import { readContinueRequest } from "@/lib/sso-continue";

type ContinuePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ContinuePage({ searchParams }: ContinuePageProps) {
  const request = await readContinueRequest();
  if (!request) redirect("/account");

  const store = await readAccountStore();
  if (!store) redirect("/login");

  const error = (await searchParams).error ?? "";

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="flex w-full max-w-[360px] flex-col items-center">
        <AuthTapMark className="mb-6 h-[76px] w-[72px]" knockout="#161826" />
        <AuthWordmark />
        <p className="mt-8 mb-5 text-center text-[15px] text-[#F2F2F5]/70">
          {store.accounts.length > 1 ? "Choose an account to continue" : "Continue with this account"}
        </p>
        <ContinuePicker accounts={store.accounts} error={error} />
      </div>
    </main>
  );
}
