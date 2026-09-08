import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { coretapReturnOrigins, nexustapReturnOrigins, sessionSecret, signaltapReturnOrigins } from "@/lib/env";

export const CONTINUE_COOKIE = "at_continue";
export const CONTINUE_TTL_SECONDS = 60 * 10;

export const SSO_CLIENTS = ["coretap", "nexustap", "signaltap"] as const;
export type SsoClient = (typeof SSO_CLIENTS)[number];

export type ContinueRequest = {
  client: SsoClient;
  returnTo: string;
  state: string;
};

function key(): Uint8Array {
  return new TextEncoder().encode(sessionSecret());
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function isSsoClient(value: string): value is SsoClient {
  return (SSO_CLIENTS as readonly string[]).includes(value);
}

function allowedOriginsFor(client: SsoClient): string[] {
  switch (client) {
    case "coretap":
      return coretapReturnOrigins();
    case "nexustap":
      return nexustapReturnOrigins();
    case "signaltap":
      return signaltapReturnOrigins();
    default:
      return exhaustive(client);
  }
}

function callbackPathFor(client: SsoClient): string {
  switch (client) {
    case "coretap":
    case "nexustap":
    case "signaltap":
      return "/auth/authtap/callback";
    default:
      return exhaustive(client);
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled SSO client: ${String(value)}`);
}

export function isAllowedReturnTo(client: SsoClient, returnTo: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(returnTo);
  } catch {
    return false;
  }
  if (parsed.pathname !== callbackPathFor(client)) return false;
  if (parsed.search || parsed.hash) return false;
  if (parsed.username || parsed.password) return false;

  const origin = parsed.origin;
  if (allowedOriginsFor(client).includes(origin)) return true;

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host === "core-tap.local") return true;
  // Marketing/product apex — not venue tenants like joes.core-tap.com.
  if (host === "core-tap.com" || host === "www.core-tap.com") return true;
  if (host === "deltakinetics.io" || host.endsWith(".deltakinetics.io")) return true;
  return false;
}

export function parseContinueInput(input: {
  client?: string;
  return_to?: string;
  returnTo?: string;
  state?: string;
}): ContinueRequest | null {
  const client = (input.client ?? "").trim();
  const returnTo = (input.return_to ?? input.returnTo ?? "").trim();
  const state = (input.state ?? "").trim();
  if (!isSsoClient(client) || !returnTo || !state) return null;
  if (state.length < 8 || state.length > 256) return null;
  if (!isAllowedReturnTo(client, returnTo)) return null;
  return { client, returnTo, state };
}

async function signContinueToken(request: ContinueRequest): Promise<string> {
  return new SignJWT({
    client: request.client,
    returnTo: request.returnTo,
    state: request.state,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + CONTINUE_TTL_SECONDS)
    .sign(key());
}

export async function attachContinueCookie(res: NextResponse, request: ContinueRequest): Promise<void> {
  res.cookies.set(CONTINUE_COOKIE, await signContinueToken(request), {
    ...cookieBase(),
    maxAge: CONTINUE_TTL_SECONDS,
  });
}

/** Read at_continue from a raw cookie value — not from cookies() after writes. */
export async function parseContinueCookie(raw: string | undefined | null): Promise<ContinueRequest | null> {
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, key(), { algorithms: ["HS256"] });
    return parseContinueInput({
      client: typeof payload.client === "string" ? payload.client : "",
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : "",
      state: typeof payload.state === "string" ? payload.state : "",
    });
  } catch {
    return null;
  }
}

export async function readContinueRequest(): Promise<ContinueRequest | null> {
  const jar = await cookies();
  return parseContinueCookie(jar.get(CONTINUE_COOKIE)?.value);
}

export function clearContinueCookie(res: NextResponse): void {
  res.cookies.set(CONTINUE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export async function clearContinueRequest(): Promise<void> {
  const jar = await cookies();
  jar.delete(CONTINUE_COOKIE);
}

export async function afterAuthPath(): Promise<string> {
  return "/account";
}

/** Keep client/return_to/state on AuthTAP /login after the email step. */
export function applyContinueParams(url: URL, request: ContinueRequest | null): URL {
  if (!request) return url;
  url.searchParams.set("client", request.client);
  url.searchParams.set("return_to", request.returnTo);
  url.searchParams.set("state", request.state);
  return url;
}

function continuePath(pathname: string, request: ContinueRequest): string {
  const url = applyContinueParams(new URL(pathname, "https://authtap.invalid"), request);
  return `${url.pathname}${url.search}`;
}

/** Same-site hop that can read at_session after the cross-site product bounce. */
export function ssoIncomingPath(request: ContinueRequest): string {
  return continuePath("/sso/incoming", request);
}

export function loginContinuePath(request: ContinueRequest): string {
  return continuePath("/login", request);
}

/** After the same-site hop: picker if signed in, password only if not. */
export function pathAfterIncomingStore(hasStore: boolean, request: ContinueRequest): string {
  return hasStore ? "/continue" : loginContinuePath(request);
}

/**
 * A second verify/resend after the email is already active must finish the
 * product hop — not dump the user on /login with a dead-end error.
 */
export function destinationWhenAlreadyVerified(
  request: ContinueRequest | null,
  hasSession: boolean,
): string {
  if (request) {
    return hasSession ? ssoIncomingPath(request) : loginContinuePath(request);
  }
  return hasSession ? "/account" : "/login";
}

export function continueFromUnknown(input: {
  client?: unknown;
  return_to?: unknown;
  returnTo?: unknown;
  state?: unknown;
}): ContinueRequest | null {
  return parseContinueInput({
    client: typeof input.client === "string" ? input.client : "",
    return_to: typeof input.return_to === "string" ? input.return_to : "",
    returnTo: typeof input.returnTo === "string" ? input.returnTo : "",
    state: typeof input.state === "string" ? input.state : "",
  });
}

export function productLoginUrl(request: ContinueRequest, error?: string): string {
  const url = new URL("/login", request.returnTo);
  if (error) url.searchParams.set("error", error);
  return url.toString();
}

/** Product callback with the handoff code and the original SSO state. */
export function productHandoffUrl(request: ContinueRequest, code: string): string {
  const dest = new URL(request.returnTo);
  dest.searchParams.set("code", code);
  dest.searchParams.set("state", request.state);
  return dest.toString();
}
