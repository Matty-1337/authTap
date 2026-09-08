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

  it("sends a dead Sanctum token back to login instead of showing Unauthenticated", async () => {
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

    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("client")).toBe("coretap")
    expect(location.searchParams.get("return_to")).toBe(continueRequest.returnTo)
    expect(location.searchParams.get("state")).toBe(continueRequest.state)
    expect(res.cookies.get("at_session")?.value).toBe("")
  })
})
