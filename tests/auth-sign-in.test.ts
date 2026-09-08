import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("@/lib/dk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dk-auth")>();
  return {
    ...actual,
    dkLogin: vi.fn(),
    dkRegister: vi.fn(),
    dkResendVerification: vi.fn(),
    dkAccountVerified: vi.fn(),
  };
});

vi.mock("@/lib/sso-handoff", () => ({
  handoffToProduct: vi.fn(),
  signHandoffCode: vi.fn(),
}));

import { POST as postEmail } from "@/app/api/auth/email/route";
import { GET as leaveVerify } from "@/app/api/auth/leave-verify/route";
import { POST as postSignIn } from "@/app/api/auth/sign-in/route";
import { completePasswordSignIn } from "@/lib/auth-sign-in";
import { dkAccountVerified, dkLogin, dkRegister, dkResendVerification } from "@/lib/dk-auth";
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
    vi.mocked(dkRegister).mockReset();
    vi.mocked(dkResendVerification).mockReset();
    vi.mocked(dkAccountVerified).mockReset();
    vi.mocked(handoffToProduct).mockReset();
    vi.mocked(signHandoffCode).mockReset();
  });

  it("keeps an unverified register out of the AuthTAP session", async () => {
    vi.mocked(dkRegister).mockResolvedValue({
      ok: true,
      needsVerification: true,
      email: "new@example.com",
    });

    await expect(
      completePasswordSignIn({
        mode: "register",
        password: "secret123",
        pendingEmail: "new@example.com",
        continueRequest,
        existingStore: null,
      }),
    ).resolves.toEqual({
      ok: true,
      needsVerification: true,
      email: "new@example.com",
    });
    expect(handoffToProduct).not.toHaveBeenCalled();
  });

  it("admits register when the returned account is already verified", async () => {
    vi.mocked(dkRegister).mockResolvedValue({ ok: true, token: "core-token", user });
    vi.mocked(dkAccountVerified).mockResolvedValue(true);

    const result = await completePasswordSignIn({
      mode: "register",
      password: "secret123",
      pendingEmail: "fancy@example.com",
      continueRequest: null,
      existingStore: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.needsVerification) return;
    expect(result.dest).toEqual({ url: "/account", clearContinue: false });
    expect(dkResendVerification).not.toHaveBeenCalled();
  });

  it("admits login when the API returns a token", async () => {
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });

    const result = await completePasswordSignIn({
      mode: "login",
      password: "secret",
      pendingEmail: "fancy@example.com",
      continueRequest: null,
      existingStore: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.needsVerification) return;
    expect(result.dest).toEqual({ url: "/account", clearContinue: false });
    expect(dkResendVerification).not.toHaveBeenCalled();
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
    if (!result.ok || result.needsVerification) return;
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
    if (!result.ok || result.needsVerification) return;
    expect(result.dest).toEqual({ url: "/account", clearContinue: false });
    expect(handoffToProduct).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/email", () => {
  it("303s to /login and does not revive a leftover product continue cookie", async () => {
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
    expect(location.searchParams.get("client")).toBeNull();
    expect(res.cookies.get("at_pending_email")?.value).toBe("login:fancy@example.com");
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
    vi.mocked(dkRegister).mockReset();
    vi.mocked(dkResendVerification).mockReset();
    vi.mocked(dkAccountVerified).mockReset();
    vi.mocked(handoffToProduct).mockReset();
    vi.mocked(signHandoffCode).mockReset();
  });

  it("stays on AuthTAP when only a leftover at_continue cookie is present", async () => {
    const continueToken = await signContinueCookie();
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });

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
    expect(location.origin + location.pathname).toBe("http://localhost:3004/account");
    expect(handoffToProduct).not.toHaveBeenCalled();
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

  it("writes a session when login returns a token", async () => {
    vi.mocked(dkLogin).mockResolvedValue({ ok: true, token: "core-token", user });

    const res = await postSignIn(
      formRequest(
        "http://localhost:3004/api/auth/sign-in",
        { mode: "login", password: "secret" },
        "at_pending_email=login:fancy@example.com",
      ),
    );

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("http://localhost:3004/account");
    expect(res.cookies.get("at_session")?.value).toBeTruthy();
  });

  it("does not write a session when register still needs email verification", async () => {
    vi.mocked(dkRegister).mockResolvedValue({
      ok: true,
      needsVerification: true,
      email: "new@example.com",
    });

    const res = await postSignIn(
      formRequest(
        "http://localhost:3004/api/auth/sign-in",
        { mode: "register", password: "secret123" },
        "at_pending_email=register:new@example.com",
      ),
    );

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("http://localhost:3004/verify-email");
    expect(res.cookies.get("at_session")?.value).toBeUndefined();
    expect(res.cookies.get("at_pending_verify")?.value).toBe("new@example.com");
    expect(handoffToProduct).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/leave-verify", () => {
  it("leaves the verify page for login and clears the pending verify session", async () => {
    const res = await leaveVerify(
      new NextRequest(
        "http://localhost:3004/api/auth/leave-verify?mode=login&client=coretap&return_to=http://localhost:3000/auth/authtap/callback&state=state-token-1",
        { headers: { cookie: "at_pending_verify=fancy@example.com; at_session=stale" } },
      ),
    );

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("http://localhost:3004/login");
    expect(location.searchParams.get("client")).toBe("coretap");
    expect(res.cookies.get("at_pending_verify")?.value).toBe("");
    expect(res.cookies.get("at_session")?.value).toBe("");
  });
});
