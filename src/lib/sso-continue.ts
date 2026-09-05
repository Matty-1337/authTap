import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { nexustapReturnOrigins, sessionSecret, signaltapReturnOrigins } from "@/lib/env";

export const CONTINUE_COOKIE = "at_continue";
export const CONTINUE_TTL_SECONDS = 60 * 10;

export const SSO_CLIENTS = ["nexustap", "signaltap"] as const;
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

export async function readContinueRequest(): Promise<ContinueRequest | null> {
  const jar = await cookies();
  const raw = jar.get(CONTINUE_COOKIE)?.value;
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

export async function clearContinueRequest(): Promise<void> {
  const jar = await cookies();
  jar.delete(CONTINUE_COOKIE);
}

export async function afterAuthPath(): Promise<string> {
  return (await readContinueRequest()) ? "/api/sso/complete" : "/account";
}

export function productLoginUrl(request: ContinueRequest, error?: string): string {
  const url = new URL("/login", request.returnTo);
  if (error) url.searchParams.set("error", error);
  return url.toString();
}
