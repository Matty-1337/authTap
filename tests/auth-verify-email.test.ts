import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("@/lib/dk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dk-auth")>();
  return {
    ...actual,
    dkVerifyEmail: vi.fn(),
  };
});

vi.mock("@/lib/sso-handoff", () => ({
  handoffToProduct: vi.fn(),
  signHandoffCode: vi.fn(),
}));

import { POST as postVerify } from "@/app/api/auth/verify-email/route";
import { dkVerifyEmail } from "@/lib/dk-auth";
import { sessionSecret } from "@/lib/env";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";

const user = { id: 1, name: "Fancy", email: "fancy@example.com" };

async function signSession(): Promise<string> {
  return new SignJWT({
    accounts: [{ token: "tok", user }],
    activeUserId: user.id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(new TextEncoder().encode(sessionSecret()));
}

function verifyReq(fields: Record<string, string>, cookie = "") {
  const body = new URLSearchParams(fields).toString();
  return new NextRequest("http://localhost:3004/api/auth/verify-email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

const continueFields = {
  email: "fancy@example.com",
  code: "123456",
  client: "coretap",
  return_to: "http://localhost:3000/auth/authtap/callback",
  state: "state-token-1",
};

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.mocked(dkVerifyEmail).mockReset();
    vi.mocked(handoffToProduct).mockReset();
    vi.mocked(signHandoffCode).mockReset();
  });

  it("does not send an already-verified hop to a login error", async () => {
    vi.mocked(dkVerifyEmail).mockResolvedValue({
      ok: false,
      status: 409,
      error: "This email is already verified. Sign in to continue.",
      alreadyVerified: true,
    });

    const res = await postVerify(verifyReq(continueFields));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    expect(data.ok).toBe(true);
    const url = new URL(data.url ?? "");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("client")).toBe("coretap");
    expect(url.searchParams.get("error")).toBeNull();
  });

  it("finishes an already-verified hop when AuthTAP already has a session", async () => {
    vi.mocked(dkVerifyEmail).mockResolvedValue({
      ok: false,
      status: 409,
      error: "This email is already verified. Sign in to continue.",
      alreadyVerified: true,
    });

    const res = await postVerify(verifyReq(continueFields, `at_session=${await signSession()}`));
    const data = (await res.json()) as { url?: string };
    const url = new URL(data.url ?? "");
    expect(url.pathname).toBe("/sso/incoming");
    expect(url.searchParams.get("client")).toBe("coretap");
  });

  it("sends a product-hop verify to Continue, not the warehouse", async () => {
    vi.mocked(dkVerifyEmail).mockResolvedValue({ ok: true, token: "core-token", user });

    const res = await postVerify(verifyReq(continueFields));
    const data = (await res.json()) as { ok?: boolean; url?: string };
    expect(data.ok).toBe(true);
    expect(new URL(data.url ?? "").pathname).toBe("/continue");
    expect(res.cookies.get("at_session")?.value).toBeTruthy();
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
    expect(handoffToProduct).not.toHaveBeenCalled();
  });

  it("verifying without a hop lands on the account list with the new account signed in", async () => {
    vi.mocked(dkVerifyEmail).mockResolvedValue({ ok: true, token: "new-token", user });

    const res = await postVerify(verifyReq({ email: "fancy@example.com", code: "123456" }));
    const data = (await res.json()) as { ok?: boolean; url?: string };
    expect(data.ok).toBe(true);
    expect(new URL(data.url ?? "").pathname).toBe("/account");
    expect(res.cookies.get("at_session")?.value).toBeTruthy();
  });

  it("appends the freshly verified account to an existing session instead of replacing it", async () => {
    const existing = { id: 42, name: "Already", email: "already@example.com" };
    const priorSession = await new SignJWT({
      accounts: [{ token: "prior", user: existing }],
      activeUserId: existing.id,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("14d")
      .sign(new TextEncoder().encode(sessionSecret()));

    vi.mocked(dkVerifyEmail).mockResolvedValue({ ok: true, token: "new-token", user });

    const res = await postVerify(
      verifyReq({ email: "fancy@example.com", code: "123456" }, `at_session=${priorSession}`),
    );
    const cookie = res.cookies.get("at_session")?.value ?? "";
    expect(cookie).toBeTruthy();

    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(sessionSecret()));
    const ids = (payload.accounts as { user: { id: number } }[]).map((a) => a.user.id).sort();
    expect(ids).toEqual([1, 42]);
    expect(payload.activeUserId).toBe(user.id);
  });

  it("keeps the product hop from at_continue when the verify form omits it", async () => {
    vi.mocked(dkVerifyEmail).mockResolvedValue({ ok: true, token: "core-token", user });
    const continueToken = await new SignJWT({
      client: "coretap",
      returnTo: "http://localhost:3000/auth/authtap/callback",
      state: "state-token-1",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(sessionSecret()));

    const res = await postVerify(verifyReq({ email: "fancy@example.com", code: "123456" }, `at_continue=${continueToken}`));
    const data = (await res.json()) as { url?: string };
    expect(new URL(data.url ?? "").pathname).toBe("/continue");
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
  });
});
