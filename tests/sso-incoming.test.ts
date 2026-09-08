import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { GET as incoming } from "@/app/api/sso/incoming/route";
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
  it("sends a signed-in user to the account picker even with one account", async () => {
    const session = await signSession();
    const res = await incoming(incomingReq(`at_session=${session}`));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/continue");
    expect(res.cookies.get("at_continue")?.value).toBeTruthy();
  });

  it("asks for a password only when AuthTAP has no session", async () => {
    const res = await incoming(incomingReq());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("client")).toBe("coretap");
  });
});
