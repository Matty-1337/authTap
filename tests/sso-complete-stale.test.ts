import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignJWT } from "jose"
import { NextRequest } from "next/server"

vi.mock("@/lib/sso-handoff", () => ({
  handoffToProduct: vi.fn(),
  signHandoffCode: vi.fn(),
}))

import { GET as completeSso } from "@/app/api/sso/complete/route"
import { sessionSecret } from "@/lib/env"
import { CONTINUE_COOKIE } from "@/lib/sso-continue"
import { handoffToProduct } from "@/lib/sso-handoff"

const user = { id: 1, name: "Ada", email: "ada@example.com" }
const continueRequest = {
  client: "coretap" as const,
  returnTo: "http://localhost:3000/auth/authtap/callback",
  state: "state-token-1",
}

async function signContinueCookie(): Promise<string> {
  return new SignJWT({
    client: continueRequest.client,
    returnTo: continueRequest.returnTo,
    state: continueRequest.state,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(sessionSecret()))
}

async function signSessionCookie(): Promise<string> {
  return new SignJWT({
    accounts: [{ token: "dead-token", user }],
    activeUserId: user.id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(new TextEncoder().encode(sessionSecret()))
}

describe("GET /api/sso/complete", () => {
  beforeEach(() => {
    vi.mocked(handoffToProduct).mockReset()
  })

  it("recovers to /login and evicts the dead account when a token is stale", async () => {
    // A stale (401) handoff means the stored token was revoked. Rather than
    // dead-ending on "session expired", AuthTAP evicts the dead account and
    // sends the user to /login to re-mint — keeping the product hop so they
    // still land back in the requesting product.
    vi.mocked(handoffToProduct).mockResolvedValue({
      ok: false,
      error: "Your session expired. Sign in again.",
      stale: true,
    })
    const [session, cont] = await Promise.all([signSessionCookie(), signContinueCookie()])
    const res = await completeSso(
      new NextRequest("http://localhost:3004/api/sso/complete", {
        headers: { cookie: `at_session=${session}; ${CONTINUE_COOKIE}=${cont}` },
      }),
    )

    expect(res.status).toBe(303)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/login")
    // Product hop preserved so re-login lands back in the requesting product.
    expect(location.searchParams.get("client")).toBe("coretap")
    // The sole (dead) account is evicted → session cookie cleared.
    expect(res.cookies.get("at_session")?.value).toBe("")
  })
})
