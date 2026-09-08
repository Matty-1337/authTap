import { describe, expect, it } from "vitest"
import { handoffErrorFromResponse, isStaleHandoff } from "@/lib/sso-handoff-error"

describe("handoffErrorFromResponse", () => {
  it("treats Laravel Unauthenticated as a dead AuthTAP token", () => {
    expect(handoffErrorFromResponse(401, { message: "Unauthenticated." })).toEqual({
      error: "Your session expired. Sign in again.",
      stale: true,
    })
    expect(isStaleHandoff({ ok: false, stale: true, error: "x" })).toBe(true)
  })

  it("leaves access denials on the continue picker", () => {
    expect(handoffErrorFromResponse(403, { message: "This account does not have access." })).toEqual({
      error: "This account does not have access.",
      stale: false,
    })
    expect(isStaleHandoff({ ok: false, stale: false, error: "x" })).toBe(false)
  })
})
