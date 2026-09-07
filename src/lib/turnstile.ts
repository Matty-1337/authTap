function envFlag(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

export function turnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
}

/** Widget + client gates. Off in development unless NEXT_PUBLIC_TURNSTILE_ENFORCE=1. */
export function isTurnstileEnabled(): boolean {
  if (!turnstileSiteKey()) return false;
  const flag = envFlag(process.env.NEXT_PUBLIC_TURNSTILE_ENFORCE);
  if (flag !== null) return flag;
  return process.env.NODE_ENV === "production";
}

export function turnstileTokenFromForm(form: FormData): string {
  const named = String(form.get("turnstileToken") ?? "").trim();
  if (named) return named;
  return String(form.get("cf-turnstile-response") ?? "").trim();
}
