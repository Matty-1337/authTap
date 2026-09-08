import { describe, expect, it } from "vitest";
import { hasSsoQuery, ssoCompletePath } from "@/lib/sso-account-continue";
import { afterAuthPath } from "@/lib/sso-continue";

describe("ssoCompletePath", () => {
  it("finishes a product hop only when this request still carries the hop", () => {
    expect(
      ssoCompletePath({
        pathname: "/account",
        hasSession: true,
        hasContinue: true,
        adding: false,
        hasSsoQuery: true,
      }),
    ).toBe("/api/sso/complete");
  });

  it("leaves a leftover product continue alone on a direct AuthTAP visit", () => {
    expect(
      ssoCompletePath({
        pathname: "/",
        hasSession: true,
        hasContinue: true,
        adding: false,
        hasSsoQuery: false,
      }),
    ).toBeNull();
    expect(
      ssoCompletePath({
        pathname: "/account",
        hasSession: true,
        hasContinue: true,
        adding: false,
        hasSsoQuery: false,
      }),
    ).toBeNull();
  });

  it("leaves /account alone when there is no in-flight continue", () => {
    expect(
      ssoCompletePath({
        pathname: "/account",
        hasSession: true,
        hasContinue: false,
        adding: false,
        hasSsoQuery: false,
      }),
    ).toBeNull();
  });

  it("does not steal the add-account flow", () => {
    expect(
      ssoCompletePath({
        pathname: "/login",
        hasSession: true,
        hasContinue: true,
        adding: true,
        hasSsoQuery: true,
      }),
    ).toBeNull();
  });
});

describe("hasSsoQuery", () => {
  it("requires client, return_to, and state", () => {
    expect(hasSsoQuery(new URLSearchParams("client=coretap&return_to=https://x/auth/authtap/callback&state=abc"))).toBe(
      true,
    );
    expect(hasSsoQuery(new URLSearchParams())).toBe(false);
    expect(hasSsoQuery(new URLSearchParams("client=coretap"))).toBe(false);
  });
});

describe("afterAuthPath", () => {
  it("stays on the AuthTAP account warehouse", async () => {
    await expect(afterAuthPath()).resolves.toBe("/account");
  });
});
