"use client";

import { useState } from "react";
import { BrandBusy } from "@/components/BrandBusy";
import type { AuthMode } from "@/lib/auth-types";

type AuthFormProps = {
  mode: AuthMode;
  email: string;
  error: string;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#161826] px-4 text-[16px] text-[#F2F2F5] outline-none placeholder:text-[#F2F2F5]/35 focus:border-[#9B6DFF] md:bg-[#141624]";
const buttonClass =
  "flex h-12 w-full items-center justify-center rounded-xl bg-[#9B6DFF] text-[15px] font-semibold text-[#161826] disabled:opacity-60";

export function AuthForm({ mode, email: pendingEmail, error }: AuthFormProps) {
  const step = pendingEmail ? "password" : "email";
  const [email, setEmail] = useState(pendingEmail);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = copyFor(mode);

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
        onSubmit={() => setBusy(true)}
      >
        <input type="hidden" name="mode" value={mode} />
        <input type="email" name="email" value={pendingEmail} hidden autoComplete="username" readOnly />
        <a href={`/auth/back?mode=${mode}`} className="self-start text-[13px] text-[#9B6DFF]">
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
        <button type="submit" className={buttonClass} disabled={busy}>
          {copy.submit}
        </button>
      </form>
    </>
  );
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
