import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sso-continue", () => ({
  readContinueRequest: vi.fn(),
  clearContinueRequest: vi.fn(),
  productHandoffUrl: (request: { returnTo: string; state: string }, code: string) => {
    const dest = new URL(request.returnTo);
    dest.searchParams.set("code", code);
    dest.searchParams.set("state", request.state);
    return dest.toString();
  },
  productLoginUrl: vi.fn(),
}));

vi.mock("@/lib/sso-handoff", () => ({
  handoffToProduct: vi.fn(),
  signHandoffCode: vi.fn(),
}));

import { destinationAfterSignIn, finishContinue } from "@/lib/sso-complete";
import { clearContinueRequest, readContinueRequest } from "@/lib/sso-continue";
import { handoffToProduct, signHandoffCode } from "@/lib/sso-handoff";

const account = {
  token: "core-token",
  user: { id: 7, name: "Fancy", email: "fancy@example.com" },
};

const continueRequest = {
  client: "signaltap" as const,
  returnTo: "http://localhost:3001/auth/authtap/callback",
  state: "state-token-1",
};

describe("finishContinue", () => {
  beforeEach(() => {
    vi.mocked(readContinueRequest).mockReset();
    vi.mocked(clearContinueRequest).mockReset();
    vi.mocked(handoffToProduct).mockReset();
    vi.mocked(signHandoffCode).mockReset();
  });

  it("returns /account when there is no in-flight SSO continue", async () => {
    vi.mocked(readContinueRequest).mockResolvedValue(null);
    await expect(finishContinue(account)).resolves.toBe("/account");
    expect(handoffToProduct).not.toHaveBeenCalled();
    expect(clearContinueRequest).not.toHaveBeenCalled();
  });

  it("hands off with the live account and keeps client, returnTo, and state", async () => {
    vi.mocked(readContinueRequest).mockResolvedValue(continueRequest);
    vi.mocked(handoffToProduct).mockResolvedValue({
      ok: true,
      token: "product-token",
      user: account.user,
    });
    vi.mocked(signHandoffCode).mockResolvedValue("handoff-code");

    const next = await finishContinue(account);
    const url = new URL(next);
    expect(handoffToProduct).toHaveBeenCalledWith(account, "signaltap");
    expect(signHandoffCode).toHaveBeenCalledWith({
      request: continueRequest,
      token: "product-token",
      user: account.user,
    });
    expect(url.origin + url.pathname).toBe("http://localhost:3001/auth/authtap/callback");
    expect(url.searchParams.get("code")).toBe("handoff-code");
    expect(url.searchParams.get("state")).toBe("state-token-1");
    expect(clearContinueRequest).toHaveBeenCalledOnce();
  });

  it("keeps at_continue when handoff fails so the user can retry", async () => {
    vi.mocked(readContinueRequest).mockResolvedValue(continueRequest);
    vi.mocked(handoffToProduct).mockResolvedValue({ ok: false, error: "This account does not have access." });

    await expect(finishContinue(account)).resolves.toBe(
      "/continue?error=This%20account%20does%20not%20have%20access.",
    );
    expect(clearContinueRequest).not.toHaveBeenCalled();
  });

  it("uses a pre-read continue request and does not call cookies()", async () => {
    vi.mocked(handoffToProduct).mockResolvedValue({
      ok: true,
      token: "product-token",
      user: account.user,
    });
    vi.mocked(signHandoffCode).mockResolvedValue("handoff-code");

    const dest = await destinationAfterSignIn(account, continueRequest);
    expect(readContinueRequest).not.toHaveBeenCalled();
    expect(dest.clearContinue).toBe(true);
    expect(new URL(dest.url).searchParams.get("state")).toBe("state-token-1");
  });
});
