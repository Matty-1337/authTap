import "server-only";

import { dkAccountVerified } from "@/lib/dk-auth";
import type { SessionData } from "@/lib/session";
import { applyContinueParams, type ContinueRequest } from "@/lib/sso-continue";

export async function isSessionEmailVerified(session: SessionData | null): Promise<boolean> {
  if (!session?.token) return false;
  return dkAccountVerified(session.token);
}

export function verifyEmailHref(email: string, continueRequest: ContinueRequest | null = null): string {
  const dest = new URL("/verify-email", "http://authtap.local");
  if (email) dest.searchParams.set("email", email.trim().toLowerCase());
  applyContinueParams(dest, continueRequest);
  return `${dest.pathname}${dest.search}`;
}
