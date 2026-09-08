import { NextRequest, NextResponse } from "next/server"
import { publicUrl } from "@/lib/public-origin"
import { clearSessionCookies } from "@/lib/session"
import { attachContinueCookie, type ContinueRequest } from "@/lib/sso-continue"

/** Dead Sanctum token: drop the AuthTAP session and collect a password again. */
export async function redirectToLoginAfterStaleHandoff(
  req: NextRequest,
  request: ContinueRequest,
): Promise<NextResponse> {
  const login = publicUrl("/login", req)
  login.searchParams.set("client", request.client)
  login.searchParams.set("return_to", request.returnTo)
  login.searchParams.set("state", request.state)
  const res = NextResponse.redirect(login)
  clearSessionCookies(res)
  await attachContinueCookie(res, request)
  return res
}
