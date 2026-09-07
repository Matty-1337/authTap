import { describe, it, expect, beforeEach } from "vitest";
import {
  applyContinueParams,
  isAllowedReturnTo,
  parseContinueInput,
  productHandoffUrl,
} from "@/lib/sso-continue";

beforeEach(() => {
  process.env.SIGNALTAP_RETURN_ORIGINS = "http://localhost:3001";
  process.env.NEXUSTAP_RETURN_ORIGINS = "http://localhost:3002";
  process.env.CORETAP_RETURN_ORIGINS = "http://localhost:6100";
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

describe("AuthTAP SSO continue — coretap client", () => {
  it("accepts client=coretap with the local CoreTAP callback", () => {
    const parsed = parseContinueInput({
      client: "coretap",
      return_to: "http://localhost:6100/auth/authtap/callback",
      state: "state-token-1",
    });
    expect(parsed).toEqual({
      client: "coretap",
      returnTo: "http://localhost:6100/auth/authtap/callback",
      state: "state-token-1",
    });
  });

  it("rejects 0.0.0.0 and venue hosts as return_to", () => {
    expect(isAllowedReturnTo("coretap", "https://0.0.0.0:8080/auth/authtap/callback")).toBe(false);
    expect(isAllowedReturnTo("coretap", "https://joes.core-tap.com/auth/authtap/callback")).toBe(false);
    expect(
      parseContinueInput({
        client: "coretap",
        return_to: "https://0.0.0.0:8080/auth/authtap/callback",
        state: "state-token-1",
      }),
    ).toBeNull();
  });

  it("accepts the production CoreTAP apex as a deltakinetics.io host", () => {
    expect(isAllowedReturnTo("coretap", "https://coretap.deltakinetics.io/auth/authtap/callback")).toBe(true);
  });

  it("accepts the public core-tap.com apex, but not venue subdomains", () => {
    expect(isAllowedReturnTo("coretap", "https://core-tap.com/auth/authtap/callback")).toBe(true);
    expect(isAllowedReturnTo("coretap", "https://www.core-tap.com/auth/authtap/callback")).toBe(true);
    expect(isAllowedReturnTo("coretap", "https://joes.core-tap.com/auth/authtap/callback")).toBe(false);
  });

  it("keeps continue fields on the AuthTAP login URL after the email step", () => {
    const dest = applyContinueParams(new URL("http://localhost:3004/login"), {
      client: "coretap",
      returnTo: "http://localhost:3000/auth/authtap/callback",
      state: "state-token-1",
    });
    expect(dest.searchParams.get("client")).toBe("coretap");
    expect(dest.searchParams.get("return_to")).toBe("http://localhost:3000/auth/authtap/callback");
    expect(dest.searchParams.get("state")).toBe("state-token-1");
  });

  it("accepts the local CoreTAP hosts the app actually runs on", () => {
    expect(isAllowedReturnTo("coretap", "http://localhost:3000/auth/authtap/callback")).toBe(true);
    expect(isAllowedReturnTo("coretap", "http://core-tap.local:3000/auth/authtap/callback")).toBe(true);
    expect(isAllowedReturnTo("coretap", "http://joes.core-tap.local:3000/auth/authtap/callback")).toBe(false);
  });
});
