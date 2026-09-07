import { cancelAddAccount } from "@/app/account-actions";
import { AuthForm } from "@/components/AuthForm";
import { AuthTapMark } from "@/components/AuthTapMark";
import { AuthWordmark } from "@/components/AuthWordmark";
import type { AuthMode } from "@/lib/auth-types";
import type { ContinueRequest } from "@/lib/sso-continue";

type AuthPanelProps = {
  mode: AuthMode;
  email: string;
  error: string;
  adding?: boolean;
  continueRequest?: ContinueRequest | null;
};

export function AuthPanel({
  mode,
  email,
  error,
  adding = false,
  continueRequest = null,
}: AuthPanelProps) {
  const copy = copyFor(mode);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-[400px] flex-col items-center md:max-w-[560px] md:flex-row md:items-center md:gap-7 md:rounded-2xl md:border md:border-white/10 md:bg-[#161826] md:px-8 md:py-8 md:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center md:shrink-0">
          <AuthTapMark className="h-[72px] w-[68px]" knockout="#161826" />
          <AuthWordmark className="mt-3 text-[28px] md:text-[24px]" />
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 md:mt-0">
          <AuthForm mode={mode} email={email} error={error} continueRequest={continueRequest} />

          <p className="text-center text-[14px] text-[#F2F2F5]/55 md:text-left">
            {copy.switchLabel}{" "}
            <a className="text-[#9B6DFF]" href={copy.switchHref}>
              {copy.switchCta}
            </a>
          </p>
          {adding ? (
            <form action={cancelAddAccount} className="text-center md:text-left">
              <button type="submit" className="text-[14px] text-[#9B6DFF]">
                Cancel
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function copyFor(mode: AuthMode) {
  switch (mode) {
    case "login":
      return {
        submit: "Sign in",
        switchLabel: "Don't have an account?",
        switchCta: "Sign up",
        switchHref: "/register",
      };
    case "register":
      return {
        submit: "Create account",
        switchLabel: "Already have an account?",
        switchCta: "Sign in",
        switchHref: "/login",
      };
    default:
      return exhaustive(mode);
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled auth state: ${String(value)}`);
}
