import { describe, expect, it } from "vitest";
import { ssoCompletePath } from "@/lib/sso-account-continue";
import { afterAuthPath } from "@/lib/sso-continue";

describe("ssoCompletePath", () => {
  it("sends a signed-in CoreTAP continue off /account to the handoff route", () => {
    expect(
      ssoCompletePath({
        pathname: "/account",
        hasSession: true,
        hasContinue: true,
        adding: false,
      }),
    ).toBe("/api/sso/complete");
  });

  it("leaves /account alone when there is no in-flight continue", () => {
    expect(
      ssoCompletePath({
        pathname: "/account",
        hasSession: true,
        hasContinue: false,
        adding: false,
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
      }),
    ).toBeNull();
  });
});

describe("afterAuthPath", () => {
  it("always finishes through /api/sso/complete so cookies() cannot hide at_continue", async () => {
    await expect(afterAuthPath()).resolves.toBe("/api/sso/complete");
  });
});
