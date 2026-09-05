"use client";

import { useActionState } from "react";
import { cancelContinue, continueWithAccount, useAnotherAccount } from "@/app/continue/actions";
import { AccountAvatar } from "@/components/AccountAvatar";
import { BrandBusy } from "@/components/BrandBusy";

type ContinueAccount = {
  user: { id: number; name: string; email: string };
};

type ContinuePickerProps = {
  accounts: ContinueAccount[];
  error?: string;
};

const initial: { error: string } = { error: "" };

export function ContinuePicker({ accounts, error = "" }: ContinuePickerProps) {
  const [state, action, pending] = useActionState(continueWithAccount, initial);
  const shownError = state.error || error;

  return (
    <div className="flex w-full flex-col gap-2">
      {pending ? <BrandBusy label="Signing in" /> : null}
      {shownError ? (
        <p role="alert" className="mb-2 text-center text-[13px] text-[#F2A0A0]">
          {shownError}
        </p>
      ) : null}

      {accounts.map((account) => (
        <form key={account.user.id} action={action}>
          <input type="hidden" name="userId" value={account.user.id} />
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#1C1F32] px-4 py-3 text-left transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)] disabled:opacity-60"
          >
            <AccountAvatar name={account.user.name} email={account.user.email} />
            <span className="min-w-0 flex-1">
              {account.user.name ? (
                <span className="block truncate text-[15px] font-medium text-[#F2F2F5]">{account.user.name}</span>
              ) : null}
              <span
                className={`block truncate text-[13px] ${account.user.name ? "text-[#F2F2F5]/55" : "font-medium text-[#F2F2F5]"}`}
              >
                {account.user.email}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-[#9B6DFF]">Continue</span>
          </button>
        </form>
      ))}

      <form action={useAnotherAccount} className="mt-4">
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-xl border border-white/15 text-[15px] font-semibold text-[#F2F2F5]"
        >
          Use another account
        </button>
      </form>

      <form action={cancelContinue} className="mt-1 text-center">
        <button type="submit" className="text-[14px] text-[#F2F2F5]/55">
          Cancel
        </button>
      </form>
    </div>
  );
}
