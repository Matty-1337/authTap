import { NextResponse, type NextRequest } from "next/server";
import {
  ADDING_COOKIE,
  CONTINUE_COOKIE,
  SESSION_COOKIE,
  hasSsoQuery,
  shouldClearLeftoverContinue,
  ssoCompletePath,
} from "@/lib/sso-account-continue";

export function middleware(req: NextRequest) {
  const ssoQuery = hasSsoQuery(req.nextUrl.searchParams);
  const dest = ssoCompletePath({
    pathname: req.nextUrl.pathname,
    hasSession: Boolean(req.cookies.get(SESSION_COOKIE)?.value),
    hasContinue: Boolean(req.cookies.get(CONTINUE_COOKIE)?.value),
    adding: Boolean(req.cookies.get(ADDING_COOKIE)?.value),
    hasSsoQuery: ssoQuery,
  });
  const res = dest ? NextResponse.redirect(new URL(dest, req.url)) : NextResponse.next();
  if (shouldClearLeftoverContinue(req.nextUrl.pathname, ssoQuery) && req.cookies.get(CONTINUE_COOKIE)?.value) {
    res.cookies.set(CONTINUE_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}

export const config = {
  matcher: ["/", "/login", "/register", "/account"],
};
