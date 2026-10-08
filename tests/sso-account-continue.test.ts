import { afterEach, describe, expect, it } from "vitest";
import { hasSsoQuery, isStrayVisit, ssoCompletePath, strayUrl } from "@/lib/sso-account-continue";
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

const AUTH_PAGES = ["/", "/login", "/register", "/continue", "/verify-email"];

describe("isStrayVisit", () => {
  it("treats a visit no product started as a stray on every AuthTAP page", () => {
    for (const pathname of AUTH_PAGES) {
      expect(isStrayVisit({ pathname, hasSsoQuery: false, hasContinue: false })).toBe(true);
    }
  });

  it("keeps every step of a product hop, by query or by at_continue", () => {
    for (const pathname of AUTH_PAGES) {
      expect(isStrayVisit({ pathname, hasSsoQuery: true, hasContinue: false })).toBe(false);
      expect(isStrayVisit({ pathname, hasSsoQuery: false, hasContinue: true })).toBe(false);
    }
  });

  it("never serves the old account page, even mid-hop", () => {
    expect(isStrayVisit({ pathname: "/account", hasSsoQuery: true, hasContinue: true })).toBe(true);
  });
});

describe("strayUrl", () => {
  afterEach(() => {
    delete process.env.AUTHTAP_STRAY_URL;
  });

  it("defaults to the Delta Kinetics site", () => {
    expect(strayUrl()).toBe("https://deltakinetics.io");
  });

  it("honours AUTHTAP_STRAY_URL without a trailing slash", () => {
    process.env.AUTHTAP_STRAY_URL = "https://example.test/";
    expect(strayUrl()).toBe("https://example.test");
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
  it("leaves AuthTAP when there is no product hop", async () => {
    await expect(afterAuthPath()).resolves.toBe("https://deltakinetics.io");
  });
});
