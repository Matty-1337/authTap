"use client";

import { useState } from "react";
import { BrandBusy } from "@/components/BrandBusy";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import type { AuthMode } from "@/lib/auth-types";
import { isTurnstileEnabled } from "@/lib/turnstile";

type AuthFormProps = {
  mode: AuthMode;
  email: string;
  error: string;
  continueRequest?: { client: string; returnTo: string; state: string } | null;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#161826] px-4 text-[16px] text-[#F2F2F5] outline-none placeholder:text-[#F2F2F5]/35 focus:border-[#9B6DFF] md:bg-[#141624]";
const buttonClass =
  "flex h-12 w-full items-center justify-center rounded-xl bg-[#9B6DFF] text-[15px] font-semibold text-[#161826] disabled:opacity-60";

export function AuthForm({
  mode,
  email: pendingEmail,
  error,
  continueRequest = null,
}: AuthFormProps) {
  const step = pendingEmail ? "password" : "email";
  const [email, setEmail] = useState(pendingEmail);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const copy = copyFor(mode);
  const turnstileOn = isTurnstileEnabled();
  const waitingOnTurnstile = turnstileOn && !turnstileToken;

  if (step === "email") {
    return (
      <>
        {busy ? <BrandBusy label="Continuing" /> : null}
        <form
          action="/api/auth/email"
          method="post"
          noValidate
          className="flex w-full flex-col gap-3"
          onSubmit={() => setBusy(true)}
        >
          <input type="hidden" name="mode" value={mode} />
          {continueRequest ? (
            <>
              <input type="hidden" name="client" value={continueRequest.client} />
              <input type="hidden" name="return_to" value={continueRequest.returnTo} />
              <input type="hidden" name="state" value={continueRequest.state} />
            </>
          ) : null}
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className={fieldClass}
          />
          {error ? <p className="text-[13px] text-[#FF8A80]">{error}</p> : null}
          <button type="submit" className={buttonClass} disabled={busy}>
            Continue
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      {busy ? <BrandBusy label={copy.busy} /> : null}
      <form
        action="/api/auth/sign-in"
        method="post"
        noValidate
        className="flex w-full flex-col gap-3"
        onSubmit={(event) => {
          if (waitingOnTurnstile) {
            event.preventDefault();
            return;
          }
          setBusy(true);
        }}
      >
        <input type="hidden" name="mode" value={mode} />
        {continueRequest ? (
          <>
            <input type="hidden" name="client" value={continueRequest.client} />
            <input type="hidden" name="return_to" value={continueRequest.returnTo} />
            <input type="hidden" name="state" value={continueRequest.state} />
          </>
        ) : null}
        <input type="hidden" name="turnstileToken" value={turnstileToken} />
        <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
        <input type="email" name="email" value={pendingEmail} hidden autoComplete="username" readOnly />
        <a href={backHref(mode, continueRequest)} className="self-start text-[13px] text-[#9B6DFF]">
          ← {pendingEmail}
        </a>
        <label className="sr-only" htmlFor="password">
          Password
        </label>
        {mode === "register" ? (
          <div className="relative">
            <input
              id="password"
              name="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className={`${fieldClass} pr-16`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 text-[13px] font-medium text-[#9B6DFF]"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-pressed={passwordVisible}
            >
              {passwordVisible ? "Hide" : "Show"}
            </button>
          </div>
        ) : (
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className={fieldClass}
          />
        )}
        {error ? <p className="text-[13px] text-[#FF8A80]">{error}</p> : null}
        <TurnstileWidget onVerify={setTurnstileToken} className="flex justify-center" />
        <button type="submit" className={buttonClass} disabled={busy || waitingOnTurnstile}>
          {copy.submit}
        </button>
      </form>
    </>
  );
}

function backHref(
  mode: AuthMode,
  continueRequest: { client: string; returnTo: string; state: string } | null,
): string {
  const dest = new URL("/auth/back", "http://authtap.local");
  dest.searchParams.set("mode", mode);
  if (continueRequest) {
    dest.searchParams.set("client", continueRequest.client);
    dest.searchParams.set("return_to", continueRequest.returnTo);
    dest.searchParams.set("state", continueRequest.state);
  }
  return `${dest.pathname}${dest.search}`;
}

function copyFor(mode: AuthMode) {
  switch (mode) {
    case "login":
      return { submit: "Sign in", busy: "Signing in" };
    case "register":
      return { submit: "Create account", busy: "Creating account" };
    default:
      return exhaustive(mode);
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled auth state: ${String(value)}`);
}
