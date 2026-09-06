import "server-only";

import { SignJWT } from "jose";
import { dkBackendUrl, ssoSecret } from "@/lib/env";
import type { ContinueRequest, SsoClient } from "@/lib/sso-continue";

type HandoffUser = { id: number; name: string; email: string };
type HandoffAccount = { token: string; user: HandoffUser };

export type HandoffResult =
  | { ok: true; token: string; user: HandoffUser }
  | { ok: false; error: string };

function productFor(client: SsoClient): string {
  switch (client) {
    case "coretap":
      return "coretap";
    case "nexustap":
      return "nexustap";
    case "signaltap":
      return "signaltap";
    default:
      return exhaustive(client);
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled SSO client: ${String(value)}`);
}

export async function handoffToProduct(account: HandoffAccount, client: SsoClient): Promise<HandoffResult> {
  const base = dkBackendUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api/sso/handoff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product: productFor(client) }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach the account service." };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (res.status === 403 ? "This account does not have access." : "Could not continue into the app.");
    return { ok: false, error: message };
  }

  const token = (data.token ?? data.access_token) as string | undefined;
  const rawUser = (data.user ?? data) as Record<string, unknown>;
  if (!token) return { ok: false, error: "Signed in, but no session came back." };

  return {
    ok: true,
    token,
    user: {
      id: Number(rawUser.id) || account.user.id,
      name: typeof rawUser.name === "string" ? rawUser.name : account.user.name,
      email: typeof rawUser.email === "string" ? rawUser.email : account.user.email,
    },
  };
}

export async function signHandoffCode(args: {
  request: ContinueRequest;
  token: string;
  user: HandoffUser;
}): Promise<string> {
  return new SignJWT({
    typ: "authtap_handoff",
    product: productFor(args.request.client),
    token: args.token,
    user: args.user,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("authtap")
    .setAudience(args.request.client)
    .setSubject(String(args.user.id))
    .setIssuedAt()
    .setExpirationTime("90s")
    .sign(new TextEncoder().encode(ssoSecret()));
}
