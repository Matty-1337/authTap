import { NextResponse, type NextRequest } from "next/server";
import {
  ADDING_COOKIE,
  CONTINUE_COOKIE,
  SESSION_COOKIE,
  ssoCompletePath,
} from "@/lib/sso-account-continue";

export function middleware(req: NextRequest) {
  const dest = ssoCompletePath({
    pathname: req.nextUrl.pathname,
    hasSession: Boolean(req.cookies.get(SESSION_COOKIE)?.value),
    hasContinue: Boolean(req.cookies.get(CONTINUE_COOKIE)?.value),
    adding: Boolean(req.cookies.get(ADDING_COOKIE)?.value),
  });
  if (!dest) return NextResponse.next();
  return NextResponse.redirect(new URL(dest, req.url));
}

export const config = {
  matcher: ["/", "/login", "/register", "/account"],
};
