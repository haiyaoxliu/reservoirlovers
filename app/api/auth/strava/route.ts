import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/strava/client";
import { env } from "@/lib/env";
import { isInviteValid } from "@/lib/invite";

export const runtime = "nodejs";

/**
 * Start the Strava OAuth flow. Anyone may start it; membership is enforced in
 * the callback (existing user, valid invite, or the bootstrap admin). If a valid
 * `?invite=<code>` is present we stash it in a cookie here (a Route Handler —
 * cookies can't be set during a Server Component render) for the callback to
 * consume after Strava returns.
 */
export async function GET(req: NextRequest) {
  const invite = new URL(req.url).searchParams.get("invite") ?? undefined;
  const hasValidInvite = invite ? await isInviteValid(invite) : false;

  const state = randomBytes(16).toString("hex");
  const secure = env.siteUrl.startsWith("https://");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("rl_oauth_state", state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  if (hasValidInvite && invite) {
    res.cookies.set("rl_invite", invite, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }
  return res;
}
