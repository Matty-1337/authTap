import { describe, it, expect, beforeEach } from "vitest";
import { afterLastAccountSignOutUrl, productFrontchannelApps } from "@/lib/sso-frontchannel";

beforeEach(() => {
  delete process.env.AUTHTAP_FRONTCHANNEL_CLIENTS;
  process.env.CORETAP_RETURN_ORIGINS = "http://localhost:6100";
  process.env.NEXUSTAP_RETURN_ORIGINS = "http://localhost:3002";
  process.env.SIGNALTAP_RETURN_ORIGINS = "http://localhost:3001";
  process.env.SHIFTTAP_RETURN_ORIGINS = "http://localhost:3005";
});

describe("AuthTAP front-channel chain", () => {
  it("walks every configured CoreTAP origin so localhost and core-tap.local both expire", () => {
    process.env.AUTHTAP_FRONTCHANNEL_CLIENTS = "coretap";
    process.env.CORETAP_RETURN_ORIGINS = "http://localhost:3000,http://core-tap.local:3000";
    const dest = afterLastAccountSignOutUrl("http://localhost:3004");
    const first = new URL(dest);
    expect(first.origin + first.pathname).toBe(
      "http://localhost:3000/api/auth/sso/authtap/frontchannel-logout",
    );
    const second = new URL(first.searchParams.get("next")!);
    expect(second.origin + second.pathname).toBe(
      "http://core-tap.local:3000/api/auth/sso/authtap/frontchannel-logout",
    );
    expect(second.searchParams.get("next")).toBe("http://localhost:3004/login");
  });

  it("includes only the clients listed in AUTHTAP_FRONTCHANNEL_CLIENTS", () => {
    process.env.AUTHTAP_FRONTCHANNEL_CLIENTS = "coretap";
    process.env.CORETAP_RETURN_ORIGINS = "http://localhost:3000";
    const dest = afterLastAccountSignOutUrl("http://localhost:3004");
    const first = new URL(dest);
    expect(first.origin + first.pathname).toBe(
      "http://localhost:3000/api/auth/sso/authtap/frontchannel-logout",
    );
    expect(first.searchParams.get("next")).toBe("http://localhost:3004/login");
  });

  it("includes CoreTAP then NexusTAP then SignalTAP then ShiftTAP before AuthTAP login", () => {
    delete process.env.AUTHTAP_FRONTCHANNEL_CLIENTS;
    const apps = productFrontchannelApps();
    expect(apps.map((app) => `${app.origin}${app.path}`)).toEqual([
      "http://localhost:6100/api/auth/sso/authtap/frontchannel-logout",
      "http://localhost:3002/api/auth/sso/authtap/frontchannel-logout",
      "http://localhost:3001/auth/sso/authtap/frontchannel-logout",
      "http://localhost:3005/api/auth/sso/authtap/frontchannel-logout",
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
    const fourth = new URL(third.searchParams.get("next")!);
    expect(fourth.origin + fourth.pathname).toBe(
      "http://localhost:3005/api/auth/sso/authtap/frontchannel-logout",
    );
    expect(fourth.searchParams.get("next")).toBe("http://localhost:3004/login");
  });
});
