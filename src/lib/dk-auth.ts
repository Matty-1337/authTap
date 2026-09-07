import "server-only";

import { dkBackendUrl, dkLoginProduct } from "@/lib/env";

export type AuthUser = { id: number; name: string; email: string };

export type DkAuthResult =
  | { ok: true; token: string; user: AuthUser }
  | { ok: false; status: number; error: string };

export type DkClientContext = {
  turnstileToken?: string;
  userAgent?: string;
  forwardedFor?: string;
};

export function clientContextFrom(req: Request, turnstileToken = ""): DkClientContext {
  const forwardedFor =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  return {
    turnstileToken: turnstileToken.trim(),
    userAgent: req.headers.get("user-agent") ?? "",
    forwardedFor,
  };
}

export function parseError(data: Record<string, unknown>, fallback: string): string {
  if (data.reason === "turnstile_required") {
    return "Confirm you are not a robot, then try again.";
  }
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.error === "string" && data.error) return data.error;
  return fallback;
}

function authHeaders(client?: DkClientContext): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Product": "coretap",
    ...(client?.forwardedFor ? { "X-Forwarded-For": client.forwardedFor } : {}),
    ...(client?.userAgent ? { "User-Agent": client.userAgent } : {}),
  };
}

function authBody(fields: Record<string, string>, client?: DkClientContext): string {
  const token = client?.turnstileToken?.trim();
  return JSON.stringify(token ? { ...fields, turnstileToken: token } : fields);
}

function toUser(raw: Record<string, unknown>, email: string): AuthUser {
  return {
    id: Number(raw.id),
    name: typeof raw.name === "string" ? raw.name : "",
    email: typeof raw.email === "string" ? raw.email : email,
  };
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Account";
  const named = local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return named.slice(0, 255) || "Account";
}

export async function dkLogin(
  email: string,
  password: string,
  client?: DkClientContext,
): Promise<DkAuthResult> {
  const base = dkBackendUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: authHeaders(client),
      body: authBody({ email, password, product: "coretap" }, client),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "Could not reach the account service." };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: parseError(data, "Email or password is wrong.") };
  }

  const token = (data.token ?? data.access_token) as string | undefined;
  const rawUser = (data.user ?? data) as Record<string, unknown>;
  if (!token) return { ok: false, status: 502, error: "Signed in, but no session came back." };
  return { ok: true, token, user: toUser(rawUser, email) };
}

export async function dkRegister(
  email: string,
  password: string,
  client?: DkClientContext,
): Promise<DkAuthResult> {
  const base = dkBackendUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api/register`, {
      method: "POST",
      headers: authHeaders(client),
      body: authBody(
        {
          name: nameFromEmail(email),
          email,
          password,
          password_confirmation: password,
          product: dkLoginProduct(),
          country_code: "1",
          phone: "0000000000",
        },
        client,
      ),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "Could not reach the account service." };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: parseError(data, "Could not create the account.") };
  }

  const token = (data.token ?? data.access_token) as string | undefined;
  const rawUser = (data.user ?? data) as Record<string, unknown>;
  if (!token) return { ok: false, status: 502, error: "Account created, but no session came back." };
  return { ok: true, token, user: toUser(rawUser, email) };
}
