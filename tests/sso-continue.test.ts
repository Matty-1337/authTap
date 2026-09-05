import { describe, it, expect, beforeEach } from "vitest";
import { isAllowedReturnTo, parseContinueInput, productHandoffUrl } from "@/lib/sso-continue";

beforeEach(() => {
  process.env.SIGNALTAP_RETURN_ORIGINS = "http://localhost:3001";
  process.env.NEXUSTAP_RETURN_ORIGINS = "http://localhost:3002";
});

describe("AuthTAP SSO continue — signaltap client", () => {
  it("accepts client=signaltap with the product callback", () => {
    const parsed = parseContinueInput({
      client: "signaltap",
      return_to: "http://localhost:3001/auth/authtap/callback",
      state: "state-token-1",
    });
    expect(parsed).toEqual({
      client: "signaltap",
      returnTo: "http://localhost:3001/auth/authtap/callback",
      state: "state-token-1",
    });
  });

  it("rejects a bad return_to for signaltap", () => {
    expect(isAllowedReturnTo("signaltap", "https://evil.example/steal")).toBe(false);
    expect(
      parseContinueInput({
        client: "signaltap",
        return_to: "https://evil.example/auth/authtap/callback",
        state: "state-token-1",
      }),
    ).toBeNull();
  });

  it("rejects signaltap return_to that is not the callback path", () => {
    expect(isAllowedReturnTo("signaltap", "http://localhost:3001/dashboard")).toBe(false);
  });

  it("keeps the original state on the product callback", () => {
    const dest = productHandoffUrl(
      {
        client: "signaltap",
        returnTo: "http://localhost:3001/auth/authtap/callback",
        state: "state-token-1",
      },
      "handoff-code",
    );
    const url = new URL(dest);
    expect(url.origin + url.pathname).toBe("http://localhost:3001/auth/authtap/callback");
    expect(url.searchParams.get("code")).toBe("handoff-code");
    expect(url.searchParams.get("state")).toBe("state-token-1");
  });
});
