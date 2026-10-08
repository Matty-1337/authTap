import { beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { GET as authorize } from "@/app/sso/authorize/route";
import { GET as bridge } from "@/app/sso/authorize/bridge/route";
import { sessionSecret } from "@/lib/env";
import { isAllowedReturnTo, oidcBridgePostUrl, parseContinueInput, productLoginUrl } from "@/lib/sso-continue";
import { destinationAfterSignIn } from "@/lib/sso-complete";

const user = { id: 1, name: "Ada", email: "ada@example.com" };
const AUTHORIZE =
  "http://localhost:9000/oauth/authorize?client_id=6&redirect_uri=https%3A%2F%2Fshifttap.deltakinetics.io%2Fauth%2Fcallback&response_type=code&state=abc&prompt=login";

async function signSession(accounts = [{ token: "dk-token", user }]): Promise<string> {
  return new SignJWT({ accounts, activeUserId: accounts[0].user.id })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(new TextEncoder().encode(sessionSecret()));
}

async function signContinue(returnTo = AUTHORIZE): Promise<string> {
  return new SignJWT({ client: "oidc", returnTo, state: "state-token-oidc" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(sessionSecret()));
}

function authorizeReq(returnTo: string | null, cookie = ""): NextRequest {
  const url = new URL("http://localhost:3004/sso/authorize");
  if (returnTo !== null) url.searchParams.set("return", returnTo);
  return new NextRequest(url, { headers: cookie ? { cookie } : {} });
}

function bridgeReq(cookie = ""): NextRequest {
  return new NextRequest("http://localhost:3004/sso/authorize/bridge", { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  delete process.env.DK_BACKEND_URL;
});

describe("an OIDC authorize URL as a product hop", () => {
  it("accepts dk-backend's /oauth/authorize with its query, on either www spelling", () => {
    expect(isAllowedReturnTo("oidc", AUTHORIZE)).toBe(true);
    process.env.DK_BACKEND_URL = "https://deltakinetics.io";
    expect(isAllowedReturnTo("oidc", "https://deltakinetics.io/oauth/authorize?client_id=6")).toBe(true);
    expect(isAllowedReturnTo("oidc", "https://www.deltakinetics.io/oauth/authorize?client_id=6")).toBe(true);
  });

  it("rejects any other host or path", () => {
    expect(isAllowedReturnTo("oidc", "https://evil.example/oauth/authorize?client_id=6")).toBe(false);
    expect(isAllowedReturnTo("oidc", "http://localhost:9000/admin/login")).toBe(false);
    expect(isAllowedReturnTo("oidc", `${AUTHORIZE}#frag`)).toBe(false);
    expect(parseContinueInput({ client: "oidc", return_to: "https://evil.example/oauth/authorize", state: "state-token" })).toBeNull();
  });

  it("posts the bridge to the host the authorize URL names", () => {
    const request = parseContinueInput({ client: "oidc", return_to: AUTHORIZE, state: "state-token" })!;
    expect(oidcBridgePostUrl(request)).toBe("http://localhost:9000/sso/session/bridge");
  });

  it("leaves AuthTAP when an OIDC hop is cancelled, since the product login is unknown", () => {
    const request = parseContinueInput({ client: "oidc", return_to: AUTHORIZE, state: "state-token" })!;
    expect(productLoginUrl(request, "sso_denied")).toBe("https://deltakinetics.io");
  });

  it("ends a password sign-in on the bridge page without minting a product token", async () => {
    const request = parseContinueInput({ client: "oidc", return_to: AUTHORIZE, state: "state-token" })!;
    await expect(destinationAfterSignIn({ token: "dk-token", user }, request)).resolves.toEqual({
      url: "/sso/authorize/bridge",
      clearContinue: false,
    });
  });
});

describe("GET /sso/authorize", () => {
  it("sends a bad or missing return off AuthTAP", async () => {
    for (const bad of [null, "https://evil.example/oauth/authorize?client_id=6", "not a url"]) {
      const res = await authorize(authorizeReq(bad));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://deltakinetics.io/");
      expect(res.cookies.get("at_continue")?.value).toBeFalsy();
    }
  });

  it("asks for a password first when nobody is signed in, keeping the hop", async () => {
    const res = await authorize(authorizeReq(AUTHORIZE));
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("client")).toBe("oidc");
    expect(location.searchParams.get("return_to")).toBe(AUTHORIZE);
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
  });

  it("bridges straight away with one signed-in account", async () => {
    const res = await authorize(authorizeReq(AUTHORIZE, `at_session=${await signSession()}; at_adding=1`));
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/sso/authorize/bridge");
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
    expect(res.cookies.get("at_adding")?.value).toBe("");
  });

  it("shows the picker with two signed-in accounts", async () => {
    const session = await signSession([
      { token: "dk-token", user },
      { token: "dk-token-2", user: { id: 2, name: "Bob", email: "bob@example.com" } },
    ]);
    const res = await authorize(authorizeReq(AUTHORIZE, `at_session=${session}`));
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/continue");
  });
});

describe("GET /sso/authorize/bridge", () => {
  it("posts the active account's token to dk-backend's bridge and clears the hop", async () => {
    const res = await bridge(bridgeReq(`at_session=${await signSession()}; at_continue=${await signContinue()}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('action="http://localhost:9000/sso/session/bridge"');
    expect(html).toContain('name="token" value="dk-token"');
    expect(html).toContain(`name="return" value="${AUTHORIZE.replace(/&/g, "&amp;")}"`);
    expect(html).toContain('document.getElementById("bridge").submit()');
    expect(res.cookies.get("at_continue")?.value).toBe("");
  });

  it("uses the account the picker chose", async () => {
    const other = { id: 2, name: "Bob", email: "bob@example.com" };
    const session = await new SignJWT({
      accounts: [{ token: "dk-token", user }, { token: "dk-token-2", user: other }],
      activeUserId: 2,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("14d")
      .sign(new TextEncoder().encode(sessionSecret()));
    const res = await bridge(bridgeReq(`at_session=${session}; at_continue=${await signContinue()}`));
    expect(await res.text()).toContain('name="token" value="dk-token-2"');
  });

  it("leaves AuthTAP without a session or without an OIDC hop", async () => {
    const noSession = await bridge(bridgeReq(`at_continue=${await signContinue()}`));
    expect(noSession.headers.get("location")).toBe("https://deltakinetics.io/");

    const handoffHop = await new SignJWT({
      client: "coretap",
      returnTo: "http://localhost:6100/auth/authtap/callback",
      state: "state-token-1",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(sessionSecret()));
    const wrongKind = await bridge(bridgeReq(`at_session=${await signSession()}; at_continue=${handoffHop}`));
    expect(wrongKind.headers.get("location")).toBe("https://deltakinetics.io/");
  });
});
