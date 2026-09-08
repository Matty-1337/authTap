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

  it("hands a successful verify through to the product", async () => {
    vi.mocked(dkVerifyEmail).mockResolvedValue({ ok: true, token: "core-token", user });
    vi.mocked(handoffToProduct).mockResolvedValue({ ok: true, token: "product-token", user });
    vi.mocked(signHandoffCode).mockResolvedValue("handoff-code");

    const res = await postVerify(verifyReq(continueFields));
    const data = (await res.json()) as { ok?: boolean; url?: string };
    expect(data.ok).toBe(true);
    const url = new URL(data.url ?? "");
    expect(url.origin + url.pathname).toBe("http://localhost:3000/auth/authtap/callback");
    expect(url.searchParams.get("code")).toBe("handoff-code");
  });
});
