import { redirect } from "next/navigation";
import { chooseAccount, startAddAccount } from "@/app/account-actions";
import { AccountAvatar } from "@/components/AccountAvatar";
import { AuthTapMark } from "@/components/AuthTapMark";
import { AuthWordmark } from "@/components/AuthWordmark";
import { MAX_ACCOUNTS, readAccountStore } from "@/lib/session";
import { readContinueRequest } from "@/lib/sso-continue";

export default async function AccountPage() {
  const store = await readAccountStore();
  if (!store) redirect("/login");

  const pending = await readContinueRequest();
  if (pending) {
    redirect(store.accounts.length === 1 ? "/api/sso/complete" : "/continue");
  }

  const active = store.accounts.find((account) => account.user.id === store.activeUserId) ?? store.accounts[0];
  const others = store.accounts.filter((account) => account.user.id !== active.user.id);
  const canAdd = store.accounts.length < MAX_ACCOUNTS;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-[360px] flex-col items-center">
        <AuthTapMark className="mb-6 h-[76px] w-[72px]" knockout="#161826" />
        <AuthWordmark />

        <div className="mt-8 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#1C1F32] px-4 py-3">
          <AccountAvatar name={active.user.name} email={active.user.email} size="lg" />
          <div className="min-w-0 flex-1 text-left">
            {active.user.name ? (
              <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[#F2F2F5]">{active.user.name}</p>
            ) : null}
            <p className={`truncate text-[14px] ${active.user.name ? "text-[#F2F2F5]/55" : "font-semibold text-[#F2F2F5]"}`}>
              {active.user.email}
            </p>
          </div>
          <form action="/api/sso/leave" method="post" className="shrink-0">
            <button
              type="submit"
              className="rounded-xl px-3 py-2 text-[13px] font-semibold text-[#F2F2F5]/70 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              Sign out
            </button>
          </form>
        </div>

        {others.length ? (
          <div className="mt-3 flex w-full flex-col gap-2">
            {others.map((account) => (
              <div
                key={account.user.id}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-3"
              >
                <form action={chooseAccount} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <input type="hidden" name="userId" value={account.user.id} />
                  <button type="submit" className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <AccountAvatar name={account.user.name} email={account.user.email} />
                    <span className="min-w-0">
                      {account.user.name ? (
                        <span className="block truncate text-[15px] font-medium text-[#F2F2F5]">{account.user.name}</span>
                      ) : null}
                      <span
                        className={`block truncate text-[13px] ${account.user.name ? "text-[#F2F2F5]/55" : "font-medium text-[#F2F2F5]"}`}
                      >
                        {account.user.email}
                      </span>
                    </span>
                  </button>
                </form>
                <form action="/api/sso/leave" method="post" className="shrink-0">
                  <input type="hidden" name="userId" value={account.user.id} />
                  <button
                    type="submit"
                    className="rounded-xl px-3 py-2 text-[13px] font-semibold text-[#F2F2F5]/70 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex w-full flex-col gap-3">
          {canAdd ? (
            <form action={startAddAccount} className="w-full">
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#9B6DFF] text-[15px] font-semibold text-[#161826]"
              >
                Add account
              </button>
            </form>
          ) : (
            <p className="text-center text-[13px] text-[#F2F2F5]/45">You can add up to {MAX_ACCOUNTS} accounts.</p>
          )}
        </div>
      </div>
    </main>
  );
}
