import { NextRequest, NextResponse } from "next/server";

/**
 * Gate every page behind a session cookie. This is a cheap presence check;
 * the actual session is validated server-side in each page via getSession().
 * Public paths: the login page, invite landing, and all API routes (which do
 * their own auth / are called by Strava).
 */
const PUBLIC_PREFIXES = ["/login", "/invite", "/api", "/_next", "/favicon"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const hasSession = req.cookies.has("rl_session");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
