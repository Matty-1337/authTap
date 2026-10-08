import { NextResponse, type NextRequest } from "next/server";
import {
  ADDING_COOKIE,
  CONTINUE_COOKIE,
  SESSION_COOKIE,
  hasSsoQuery,
  isStrayVisit,
  ssoCompletePath,
  strayUrl,
} from "@/lib/sso-account-continue";

export function middleware(req: NextRequest) {
  const ssoQuery = hasSsoQuery(req.nextUrl.searchParams);
  const hasContinue = Boolean(req.cookies.get(CONTINUE_COOKIE)?.value);

  if (isStrayVisit({ pathname: req.nextUrl.pathname, hasSsoQuery: ssoQuery, hasContinue })) {
    const res = NextResponse.redirect(strayUrl());
    if (hasContinue) res.cookies.set(CONTINUE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const dest = ssoCompletePath({
    pathname: req.nextUrl.pathname,
    hasSession: Boolean(req.cookies.get(SESSION_COOKIE)?.value),
    hasContinue,
    adding: Boolean(req.cookies.get(ADDING_COOKIE)?.value),
    hasSsoQuery: ssoQuery,
  });
  return dest ? NextResponse.redirect(new URL(dest, req.url)) : NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/account", "/continue", "/verify-email"],
};
