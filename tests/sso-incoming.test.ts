import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { GET as incoming } from "@/app/api/sso/incoming/route";
import { GET as sameSiteIncoming } from "@/app/sso/incoming/route";
import { sessionSecret } from "@/lib/env";

const user = { id: 1, name: "Ada", email: "ada@example.com" };

async function signSession(accounts = [{ token: "tok", user }]): Promise<string> {
  return new SignJWT({
    accounts,
    activeUserId: accounts[0].user.id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(new TextEncoder().encode(sessionSecret()));
}

function incomingReq(cookie = "") {
  const url = new URL("http://localhost:3004/api/sso/incoming");
  url.searchParams.set("client", "coretap");
  url.searchParams.set("return_to", "http://localhost:3000/auth/authtap/callback");
  url.searchParams.set("state", "state-token-1");
  return new NextRequest(url, { headers: cookie ? { cookie } : {} });
}

describe("GET /api/sso/incoming", () => {
  it("bounces to the same-site hop even when a session cookie is on this request", async () => {
    const session = await signSession();
    const res = await incoming(incomingReq(`at_session=${session}`));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sso/incoming");
    expect(location.searchParams.get("client")).toBe("coretap");
    expect(location.searchParams.get("return_to")).toBe("http://localhost:3000/auth/authtap/callback");
    expect(location.searchParams.get("state")).toBe("state-token-1");
    expect(res.cookies.get("at_continue")?.value).toBeFalsy();
  });

  it("does not decide login on the cross-site hop", async () => {
    const res = await incoming(incomingReq());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sso/incoming");
    expect(location.searchParams.get("client")).toBe("coretap");
  });

  it("sends a broken hop to the account warehouse", async () => {
    const url = new URL("http://localhost:3004/api/sso/incoming");
    url.searchParams.set("client", "coretap");
    const res = await incoming(new NextRequest(url));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/account");
  });
});

describe("GET /sso/incoming", () => {
  function hopReq(cookie = "") {
    const url = new URL("http://localhost:3004/sso/incoming");
    url.searchParams.set("client", "coretap");
    url.searchParams.set("return_to", "http://localhost:3000/auth/authtap/callback");
    url.searchParams.set("state", "state-token-1");
    return new NextRequest(url, { headers: cookie ? { cookie } : {} });
  }

  it("sends a signed-in hop to the picker and writes at_continue", async () => {
    const session = await signSession();
    const res = await sameSiteIncoming(hopReq(`at_session=${session}; at_adding=1`));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/continue");
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
    expect(res.cookies.get("at_adding")?.value).toBe("");
  });

  it("asks for a password only when this same-site hop has no session", async () => {
    const res = await sameSiteIncoming(hopReq());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("client")).toBe("coretap");
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
  });
});
