import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { AuthMode } from "@/lib/auth-types";

export type { AuthMode };

export const PENDING_EMAIL_COOKIE = "at_pending_email";
export const PENDING_VERIFY_COOKIE = "at_pending_verify";
const PENDING_TTL = 60 * 10;
const VERIFY_TTL = 60 * 30;

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function parsePendingEmail(raw: string | undefined | null, mode: AuthMode): string {
  const value = (raw ?? "").trim();
  const sep = value.indexOf(":");
  if (sep < 0) return "";
  const storedMode = value.slice(0, sep);
  const email = value.slice(sep + 1).trim().toLowerCase();
  return storedMode === mode ? email : "";
}

export async function readPendingEmail(mode: AuthMode): Promise<string> {
  const jar = await cookies();
  return parsePendingEmail(jar.get(PENDING_EMAIL_COOKIE)?.value, mode);
}

export function attachPendingEmailCookie(res: NextResponse, mode: AuthMode, email: string): void {
  res.cookies.set(PENDING_EMAIL_COOKIE, `${mode}:${email}`, { ...cookieBase(), maxAge: PENDING_TTL });
}

export function clearPendingEmailCookie(res: NextResponse): void {
  res.cookies.set(PENDING_EMAIL_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export async function writePendingEmail(mode: AuthMode, email: string): Promise<void> {
  const jar = await cookies();
  jar.set(PENDING_EMAIL_COOKIE, `${mode}:${email}`, { ...cookieBase(), maxAge: PENDING_TTL });
}

export async function clearPendingEmail(): Promise<void> {
  const jar = await cookies();
  jar.delete(PENDING_EMAIL_COOKIE);
}

export function attachPendingVerifyCookie(res: NextResponse, email: string): void {
  res.cookies.set(PENDING_VERIFY_COOKIE, normalizeVerifyEmail(email), { ...cookieBase(), maxAge: VERIFY_TTL });
}

export function clearPendingVerifyCookie(res: NextResponse): void {
  res.cookies.set(PENDING_VERIFY_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export function parsePendingVerifyEmail(raw: string | undefined | null): string {
  return normalizeVerifyEmail(raw ?? "");
}

export async function readPendingVerifyEmail(): Promise<string> {
  const jar = await cookies();
  return parsePendingVerifyEmail(jar.get(PENDING_VERIFY_COOKIE)?.value);
}

function normalizeVerifyEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function verifyEmailPath(error?: string, email?: string): string {
  const dest = new URL("/verify-email", "http://authtap.local");
  const verified = normalizeVerifyEmail(email ?? "");
  if (verified) dest.searchParams.set("email", verified);
  if (error) dest.searchParams.set("error", error);
  return `${dest.pathname}${dest.search}`;
}

/**
 * The address we told the user we emailed. Never the signed-in session:
 * adding a new account while Fancy is still in at_session used to show
 * fancy@gmail.com on the verify page.
 */
export function resolveVerifyPageEmail(input: {
  pendingVerifyEmail?: string | null;
  queryEmail?: string | null;
}): string {
  return (
    normalizeVerifyEmail(input.pendingVerifyEmail ?? "") ||
    normalizeVerifyEmail(input.queryEmail ?? "")
  );
}

export function pathFor(mode: AuthMode, error?: string): string {
  const path = mode === "register" ? "/register" : "/login";
  if (!error) return path;
  return `${path}?error=${encodeURIComponent(error)}`;
}
