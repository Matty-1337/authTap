import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { logoutUserFromAuthTapProducts } from "@/lib/sso-product-logout";
import { sessionSecret } from "@/lib/env";

export const SESSION_COOKIE = "at_session";
export const ADDING_COOKIE = "at_adding";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const MAX_ACCOUNTS = 5;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
};

export type SessionData = {
  token: string;
  user: SessionUser;
};

export type AccountStore = {
  accounts: SessionData[];
  activeUserId: number;
};

export type WriteSessionResult = { ok: true } | { ok: false; error: string };

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

function isUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as SessionUser;
  return Boolean(user.id && user.email);
}

function isAccount(value: unknown): value is SessionData {
  if (!value || typeof value !== "object") return false;
  const account = value as SessionData;
  return typeof account.token === "string" && account.token.length > 0 && isUser(account.user);
}

function toStore(payload: Record<string, unknown>): AccountStore | null {
  if (Array.isArray(payload.accounts)) {
    const accounts = payload.accounts.filter(isAccount);
    if (!accounts.length) return null;
    const activeUserId = Number(payload.activeUserId);
    const active = accounts.some((account) => account.user.id === activeUserId)
      ? activeUserId
      : accounts[0].user.id;
    return { accounts, activeUserId: active };
  }

  if (typeof payload.token === "string" && isUser(payload.user)) {
    return { accounts: [{ token: payload.token, user: payload.user }], activeUserId: payload.user.id };
  }

  return null;
}

async function signStore(store: AccountStore): Promise<string> {
  return new SignJWT({ accounts: store.accounts, activeUserId: store.activeUserId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(key());
}

async function persistStore(store: AccountStore): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signStore(store), {
    ...cookieBase(),
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * Persist a store via cookies() (server action / route handler context), or
 * clear the session cookie when the store is null (no accounts left).
 */
export async function persistAccountStore(store: AccountStore | null): Promise<void> {
  if (!store) {
    await clearSession();
    return;
  }
  await persistStore(store);
}

export async function verifySession(raw: string | undefined | null): Promise<SessionData | null> {
  const store = await verifyAccountStore(raw);
  if (!store) return null;
  return store.accounts.find((account) => account.user.id === store.activeUserId) ?? store.accounts[0] ?? null;
}

export async function verifyAccountStore(raw: string | undefined | null): Promise<AccountStore | null> {
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, key(), { algorithms: ["HS256"] });
    return toStore(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function readAccountStore(): Promise<AccountStore | null> {
  const jar = await cookies();
  return verifyAccountStore(jar.get(SESSION_COOKIE)?.value);
}

export async function readSession(): Promise<SessionData | null> {
  const store = await readAccountStore();
  if (!store) return null;
  return store.accounts.find((account) => account.user.id === store.activeUserId) ?? store.accounts[0] ?? null;
}

export function mergeAccountIntoStore(
  data: SessionData,
  existing: AccountStore | null,
): { ok: true; store: AccountStore } | { ok: false; error: string } {
  const store: AccountStore = existing
    ? { accounts: [...existing.accounts], activeUserId: existing.activeUserId }
    : { accounts: [], activeUserId: 0 };
  const index = store.accounts.findIndex(
    (account) => account.user.id === data.user.id || account.user.email === data.user.email,
  );
  if (index >= 0) {
    store.accounts[index] = data;
  } else if (store.accounts.length >= MAX_ACCOUNTS) {
    return { ok: false, error: `You can add up to ${MAX_ACCOUNTS} accounts.` };
  } else {
    store.accounts.push(data);
  }
  store.activeUserId = data.user.id;
  return { ok: true, store };
}

/**
 * Pure store edit: return a copy without the given account, re-pointing
 * activeUserId, or null when no accounts remain. Unlike removeAccount, this
 * does NOT touch cookies or fan out a product logout — the caller decides how
 * to persist. Used to evict a dead (revoked-token) account during a continue.
 */
export function dropAccountFromStore(
  store: AccountStore,
  userId: number,
): AccountStore | null {
  const accounts = store.accounts.filter((account) => account.user.id !== userId);
  if (!accounts.length) return null;
  const activeUserId = accounts.some((account) => account.user.id === store.activeUserId)
    ? store.activeUserId
    : accounts[0].user.id;
  return { accounts, activeUserId };
}

export async function attachSessionStore(res: NextResponse, store: AccountStore): Promise<void> {
  res.cookies.set(SESSION_COOKIE, await signStore(store), {
    ...cookieBase(),
    maxAge: SESSION_TTL_SECONDS,
  });
  res.cookies.set(ADDING_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export async function writeSession(data: SessionData): Promise<WriteSessionResult> {
  const merged = mergeAccountIntoStore(data, await readAccountStore());
  if (!merged.ok) return merged;
  await persistStore(merged.store);
  await endAddAccount();
  return { ok: true };
}

export async function switchAccount(userId: number): Promise<boolean> {
  const store = await readAccountStore();
  if (!store || !store.accounts.some((account) => account.user.id === userId)) return false;
  store.activeUserId = userId;
  await persistStore(store);
  return true;
}

export async function removeAccount(userId: number): Promise<boolean> {
  const store = await readAccountStore();
  if (!store) return false;
  await logoutUserFromAuthTapProducts(userId);
  store.accounts = store.accounts.filter((account) => account.user.id !== userId);
  if (!store.accounts.length) {
    await clearSession();
    return false;
  }
  if (!store.accounts.some((account) => account.user.id === store.activeUserId)) {
    store.activeUserId = store.accounts[0].user.id;
  }
  await persistStore(store);
  return true;
}

export async function removeActiveAccount(): Promise<boolean> {
  const store = await readAccountStore();
  if (!store) return false;
  return removeAccount(store.activeUserId);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(ADDING_COOKIE);
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  res.cookies.set(ADDING_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export function clearAddingCookie(res: NextResponse): void {
  res.cookies.set(ADDING_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export async function beginAddAccount(): Promise<void> {
  const jar = await cookies();
  jar.set(ADDING_COOKIE, "1", { ...cookieBase(), maxAge: 60 * 20 });
}

export async function isAddingAccount(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ADDING_COOKIE)?.value === "1";
}

export async function endAddAccount(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADDING_COOKIE);
}
