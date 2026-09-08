export type HandoffFailure = {
  error: string
  stale: boolean
}

/** 401 from /api/sso/handoff means the AuthTAP Sanctum token is dead. */
export function handoffErrorFromResponse(status: number, data: Record<string, unknown>): HandoffFailure {
  if (status === 401) {
    return { error: "Your session expired. Sign in again.", stale: true }
  }
  if (data.reason === "email_unverified") {
    return { error: "Verify your email to finish creating this account.", stale: false }
  }
  const message =
    (typeof data.message === "string" && data.message) ||
    (status === 403 ? "This account does not have access." : "Could not continue into the app.")
  return { error: message, stale: false }
}

export function isStaleHandoff(result: { ok: false; stale?: boolean }): boolean {
  return result.stale === true
}
