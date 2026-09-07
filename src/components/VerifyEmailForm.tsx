"use client";

import { useState } from "react";
import { BrandBusy } from "@/components/BrandBusy";
import type { ContinueRequest } from "@/lib/sso-continue";

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#161826] px-4 text-center text-[22px] font-semibold tracking-[0.28em] text-[#F2F2F5] outline-none placeholder:text-[#F2F2F5]/35 focus:border-[#9B6DFF] md:bg-[#141624]";
const buttonClass =
  "flex h-12 w-full items-center justify-center rounded-xl bg-[#9B6DFF] text-[15px] font-semibold text-[#161826] disabled:opacity-60";

type VerifyEmailFormProps = {
  email: string;
  error: string;
  continueRequest?: ContinueRequest | null;
};

export function VerifyEmailForm({ email, error, continueRequest = null }: VerifyEmailFormProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      {busy ? <BrandBusy label="Verifying" /> : null}
      <form
        action="/api/auth/verify-email"
        method="post"
        className="flex w-full flex-col gap-3"
        onSubmit={() => setBusy(true)}
      >
        <input type="hidden" name="email" value={email} />
        {continueRequest ? (
          <>
            <input type="hidden" name="client" value={continueRequest.client} />
            <input type="hidden" name="return_to" value={continueRequest.returnTo} />
            <input type="hidden" name="state" value={continueRequest.state} />
          </>
        ) : null}
        <label className="sr-only" htmlFor="code">
          Verification code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className={fieldClass}
        />
        {error ? <p className="text-[13px] text-[#FF8A80]">{error}</p> : null}
        <button type="submit" className={buttonClass} disabled={busy || code.length !== 6}>
          Verify email
        </button>
      </form>
      <form action="/api/auth/resend-verification" method="post" className="text-center md:text-left">
        <input type="hidden" name="email" value={email} />
        {continueRequest ? (
          <>
            <input type="hidden" name="client" value={continueRequest.client} />
            <input type="hidden" name="return_to" value={continueRequest.returnTo} />
            <input type="hidden" name="state" value={continueRequest.state} />
          </>
        ) : null}
        <button type="submit" className="text-[14px] text-[#9B6DFF]">
          Resend code
        </button>
      </form>
    </>
  );
}
