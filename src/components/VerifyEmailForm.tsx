"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContinueRequest } from "@/lib/sso-continue";

const CODE_LENGTH = 6;

type VerifyEmailFormProps = {
  email: string;
  error: string;
  continueRequest?: ContinueRequest | null;
};

export function VerifyEmailForm({ email, error, continueRequest = null }: VerifyEmailFormProps) {
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittedCodeRef = useRef<string | null>(null);
  const displayError = clientError ?? error;

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const applyDigits = useCallback((digits: string[]) => {
    const next = Array(CODE_LENGTH).fill("");
    digits.slice(0, CODE_LENGTH).forEach((digit, idx) => {
      next[idx] = digit;
    });
    setCode(next);
    const nextEmpty = next.findIndex((digit) => digit === "");
    inputRefs.current[nextEmpty === -1 ? CODE_LENGTH - 1 : nextEmpty]?.focus();
    return next;
  }, []);

  const submitCode = useCallback(async (digits: string[]) => {
    const next = digits.join("");
    if (busy || next.length !== CODE_LENGTH) return;
    if (submittedCodeRef.current === next) return;
    submittedCodeRef.current = next;
    setBusy(true);
    setClientError("");
    const body = new FormData();
    body.set("email", email);
    body.set("code", next);
    if (continueRequest) {
      body.set("client", continueRequest.client);
      body.set("return_to", continueRequest.returnTo);
      body.set("state", continueRequest.state);
    }
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
        alreadyVerified?: boolean;
      };
      if (data.url && (data.ok || data.alreadyVerified)) {
        window.location.assign(data.url);
        return;
      }
      setClientError(data.error || "Invalid or expired verification code.");
      submittedCodeRef.current = null;
      const cleared = applyDigits([]);
      setCode(cleared);
      inputRefs.current[0]?.focus();
    } catch {
      setClientError("Could not reach AuthTAP. Try again.");
      submittedCodeRef.current = null;
    } finally {
      setBusy(false);
    }
  }, [applyDigits, busy, continueRequest, email]);

  const handleChange = (idx: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const next = [...code];
      next[idx] = "";
      setCode(next);
      return;
    }
    if (digits.length > 1) {
      const next = applyDigits([...code.slice(0, idx), ...digits.split("")]);
      if (next.every((digit) => digit !== "")) void submitCode(next);
      return;
    }
    const next = [...code];
    next[idx] = digits.slice(-1);
    setCode(next);
    if (idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
    if (next.every((digit) => digit !== "")) {
      void submitCode(next);
    }
  };

  const handleKeyDown = (idx: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = applyDigits(pasted.split(""));
    if (next.every((digit) => digit !== "")) {
      void submitCode(next);
    }
  };

  return (
    <>
      <div className="mx-auto mt-6 mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(155,109,255,0.12)]">
        <MailIcon />
      </div>
      <h1 className="m-0 text-[22px] font-bold text-[#F2F2F5]">Verify Your Email</h1>
      <p className="mt-2 mb-6 text-[14px] leading-relaxed text-[#F2F2F5]/55">
        We sent a 6-digit code to <span className="text-[#F2F2F5]">{email}</span>. Enter it below to
        activate your AuthTAP account.
      </p>

      <div className="flex w-full flex-col items-center">
        <div className="mb-4 flex justify-center gap-2" onPaste={handlePaste}>
          {code.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={idx === 0 ? "one-time-code" : "off"}
              maxLength={idx === 0 ? CODE_LENGTH : 1}
              value={digit}
              onChange={(event) => handleChange(idx, event.target.value)}
              onKeyDown={(event) => handleKeyDown(idx, event)}
              disabled={busy}
              aria-label={`Digit ${idx + 1}`}
              className="h-14 w-12 rounded-lg border border-white/10 bg-[#141624] text-center text-[20px] font-bold text-[#F2F2F5] caret-[#9B6DFF] outline-none focus:border-[#9B6DFF] focus:ring-2 focus:ring-[#9B6DFF]/40 disabled:opacity-50"
            />
          ))}
        </div>

        {busy ? <p className="text-[13px] text-[#F2F2F5]/45">Verifying...</p> : null}
        {displayError ? (
          <div className="mb-4 w-full rounded-lg bg-[rgba(255,138,128,0.12)] p-3 text-[13px] text-[#FF8A80]">
            {displayError}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={resending || resendCooldown > 0}
        onClick={() => {
          if (resendCooldown > 0 || resending) return;
          setResending(true);
          setClientError("");
          const body = new FormData();
          body.set("email", email);
          if (continueRequest) {
            body.set("client", continueRequest.client);
            body.set("return_to", continueRequest.returnTo);
            body.set("state", continueRequest.state);
          }
          void fetch("/api/auth/resend-verification", {
            method: "POST",
            headers: { Accept: "application/json" },
            body,
          })
            .then(async (res) => {
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
                url?: string;
                alreadyVerified?: boolean;
              };
              if (data.alreadyVerified && data.url) {
                window.location.assign(data.url);
                return;
              }
              if (!data.ok) {
                setClientError(data.error || "Could not resend the code.");
                return;
              }
              setResendCooldown(60);
            })
            .catch(() => {
              setClientError("Could not resend the code.");
            })
            .finally(() => {
              setResending(false);
            });
        }}
        className="mt-4 inline-flex cursor-pointer items-center gap-2 text-[14px] font-medium text-[#9B6DFF] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshIcon spinning={resending} />
        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
      </button>

      <div className="mt-6 text-[12px] text-[#F2F2F5]/40">
        Wrong account?{" "}
        <a
          href={leaveVerifyHref("register", continueRequest)}
          onClick={() => setLeaving(true)}
          className={`cursor-pointer font-medium text-[#9B6DFF] underline ${leaving ? "opacity-50" : ""}`}
        >
          Sign out and start over
        </a>
        {" · "}
        <a href={leaveVerifyHref("login", continueRequest)} className="cursor-pointer font-medium text-[#9B6DFF] underline">
          Sign in
        </a>
      </div>
    </>
  );
}

function leaveVerifyHref(
  mode: "login" | "register",
  continueRequest: ContinueRequest | null,
): string {
  const dest = new URL("/api/auth/leave-verify", "http://authtap.local");
  dest.searchParams.set("mode", mode);
  if (continueRequest) {
    dest.searchParams.set("client", continueRequest.client);
    dest.searchParams.set("return_to", continueRequest.returnTo);
    dest.searchParams.set("state", continueRequest.state);
  }
  return `${dest.pathname}${dest.search}`;
}

function MailIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16v12H4V6zm0 0 8 7 8-7"
        stroke="#9B6DFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={spinning ? "animate-spin" : undefined}
    >
      <path
        d="M20 12a8 8 0 1 1-2.2-5.5M20 4v5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
