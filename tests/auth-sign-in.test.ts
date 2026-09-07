import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("@/lib/dk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dk-auth")>();
  return {
    ...actual,
    dkLogin: vi.fn(),
    dkRegister: vi.fn(),
  };
});

vi.mock("@/lib/sso-handoff", () => ({
  handoffToProduct: vi.fn(),
  signHandoffCode: vi.fn(),
}));

import { POST as postEmail } from "@/app/api/auth/email/route";
import { POST as postSignIn } from "@/app/api/auth/sign-in/route";
import { completePasswordSignIn } from "@/lib/auth-sign-in";
import { dkLogin } from "@/lib/dk-auth";
import { sessionSecret } from "@/lib/env";
import { CONTINUE_COOKIE } from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";

const user = { id: 1, name: "Fancy", email: "fancy@example.com" };
const continueRequest = {
  client: "signaltap" as const,
  returnTo: "http://localhost:3001/auth/authtap/callback",
  state: "state-token-1",
};

async function signContinueCookie(): Promise<string> {
  return new SignJWT({
    client: continueRequest.client,
    returnTo: continueRequest.returnTo,
    state: continueRequest.state,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(sessionSecret()));
}

function formRequest(url: string, fields: Record<string, string>, cookie = ""): NextRequest {
  const body = new URLSearchParams(fields).toString();
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

describe("completePasswordSignIn", () => {
  beforeEach(() => {
    vi.mocked(dkLogin).mockReset();
    vi.mocked(handoffToProduct).mockReset();
    vi.mocked(signHandoffCode).mockReset();
  });

  it("uses the pre-read continue request instead of re-reading cookies", async () => {
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });
    vi.mocked(handoffToProduct).mockResolvedValue({ ok: true, token: "product-token", user });
    vi.mocked(signHandoffCode).mockResolvedValue("handoff-code");

    const result = await completePasswordSignIn({
      mode: "login",
      password: "secret",
      pendingEmail: "fancy@example.com",
      continueRequest,
      existingStore: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(handoffToProduct).toHaveBeenCalledWith({ token: "core-token", user }, "signaltap");
    expect(result.dest.clearContinue).toBe(true);
    const url = new URL(result.dest.url);
    expect(url.origin + url.pathname).toBe("http://localhost:3001/auth/authtap/callback");
    expect(url.searchParams.get("code")).toBe("handoff-code");
    expect(url.searchParams.get("state")).toBe("state-token-1");
  });

  it("returns /account when there is no in-flight continue", async () => {
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });
    const result = await completePasswordSignIn({
      mode: "login",
      password: "secret",
      pendingEmail: "fancy@example.com",
      continueRequest: null,
      existingStore: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dest).toEqual({ url: "/account", clearContinue: false });
    expect(handoffToProduct).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/email", () => {
  it("303s to /login and only writes the pending email cookie", async () => {
    const continueToken = await signContinueCookie();
    const res = await postEmail(
      formRequest(
        "http://localhost:3004/api/auth/email",
        { mode: "login", email: " Fancy@Example.com " },
        `${CONTINUE_COOKIE}=${continueToken}`,
      ),
    );

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("http://localhost:3004/login");
    expect(location.searchParams.get("client")).toBe("signaltap");
    expect(location.searchParams.get("return_to")).toBe("http://localhost:3001/auth/authtap/callback");
    expect(location.searchParams.get("state")).toBe("state-token-1");
    expect(res.cookies.get("at_pending_email")?.value).toBe("login:fancy@example.com");
    expect(res.cookies.get(CONTINUE_COOKIE)?.value).toBeTruthy();
  });

  it("keeps CoreTAP continue fields from the email form on /login", async () => {
    const res = await postEmail(
      formRequest("http://localhost:3004/api/auth/email", {
        mode: "login",
        email: "fancy@example.com",
        client: "coretap",
        return_to: "http://localhost:3000/auth/authtap/callback",
        state: "state-token-1",
      }),
    );

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.searchParams.get("client")).toBe("coretap");
    expect(location.searchParams.get("return_to")).toBe("http://localhost:3000/auth/authtap/callback");
    expect(location.searchParams.get("state")).toBe("state-token-1");
  });
});

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.mocked(dkLogin).mockReset();
    vi.mocked(handoffToProduct).mockReset();
    vi.mocked(signHandoffCode).mockReset();
  });

  it("303s to Signal TAP with code and state from the incoming at_continue cookie", async () => {
    const continueToken = await signContinueCookie();
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });
    vi.mocked(handoffToProduct).mockResolvedValue({ ok: true, token: "product-token", user });
    vi.mocked(signHandoffCode).mockResolvedValue("handoff-code");

    const res = await postSignIn(
      formRequest(
        "http://localhost:3004/api/auth/sign-in",
        { mode: "login", password: "secret", turnstileToken: "cf-tok" },
        `at_pending_email=login:fancy@example.com; ${CONTINUE_COOKIE}=${continueToken}`,
      ),
    );

    expect(dkLogin).toHaveBeenCalledWith(
      "fancy@example.com",
      "secret",
      expect.objectContaining({ turnstileToken: "cf-tok" }),
    );
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("http://localhost:3001/auth/authtap/callback");
    expect(location.searchParams.get("code")).toBe("handoff-code");
    expect(location.searchParams.get("state")).toBe("state-token-1");
    expect(signHandoffCode).toHaveBeenCalledWith({
      request: continueRequest,
      token: "product-token",
      user,
    });

    expect(res.cookies.get("at_session")?.value).toBeTruthy();
    expect(res.cookies.get("at_pending_email")?.value).toBe("");
  });

  it("303s to the product from form continue fields when the cookie is missing", async () => {
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });
    vi.mocked(handoffToProduct).mockResolvedValue({ ok: true, token: "product-token", user });
    vi.mocked(signHandoffCode).mockResolvedValue("handoff-code");

    const res = await postSignIn(
      formRequest("http://localhost:3004/api/auth/sign-in", {
        mode: "login",
        password: "secret",
        turnstileToken: "cf-tok",
        client: "coretap",
        return_to: "http://localhost:3000/auth/authtap/callback",
        state: "state-token-1",
      }, "at_pending_email=login:fancy@example.com"),
    );

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("http://localhost:3000/auth/authtap/callback");
    expect(location.searchParams.get("state")).toBe("state-token-1");
    expect(handoffToProduct).toHaveBeenCalledWith({ token: "core-token", user }, "coretap");
    expect(res.cookies.get(CONTINUE_COOKIE)?.value).toBe("");
  });
});
