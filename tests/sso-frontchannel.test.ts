import { describe, it, expect, beforeEach } from "vitest";
import { afterLastAccountSignOutUrl, productFrontchannelApps } from "@/lib/sso-frontchannel";

beforeEach(() => {
  process.env.CORETAP_RETURN_ORIGINS = "http://localhost:6100";
  process.env.NEXUSTAP_RETURN_ORIGINS = "http://localhost:3002";
  process.env.SIGNALTAP_RETURN_ORIGINS = "http://localhost:3001";
});

describe("AuthTAP front-channel chain", () => {
  it("includes CoreTAP then NexusTAP then Signal TAP before AuthTAP login", () => {
    const apps = productFrontchannelApps();
    expect(apps.map((app) => `${app.origin}${app.path}`)).toEqual([
      "http://localhost:6100/api/auth/sso/authtap/frontchannel-logout",
      "http://localhost:3002/api/auth/sso/authtap/frontchannel-logout",
      "http://localhost:3001/auth/sso/authtap/frontchannel-logout",
    ]);

    const dest = afterLastAccountSignOutUrl("http://localhost:3004");
    const first = new URL(dest);
    expect(first.origin + first.pathname).toBe(
      "http://localhost:6100/api/auth/sso/authtap/frontchannel-logout",
    );
    const second = new URL(first.searchParams.get("next")!);
    expect(second.origin + second.pathname).toBe(
      "http://localhost:3002/api/auth/sso/authtap/frontchannel-logout",
    );
    const third = new URL(second.searchParams.get("next")!);
    expect(third.origin + third.pathname).toBe(
      "http://localhost:3001/auth/sso/authtap/frontchannel-logout",
    );
    expect(third.searchParams.get("next")).toBe("http://localhost:3004/login");
  });
});
