import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/strava/client";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { isInviteValid } from "@/lib/invite";

export const runtime = "nodejs";

/**
 * Start the Strava OAuth flow. Allowed if the visitor either already has a
 * session (re-login on a new device) or arrives with a valid `?invite=<code>`
 * from the invite landing page. We stash the invite in a cookie here (a Route
 * Handler — cookies can't be set during a Server Component render) so the
 * callback can consume it after Strava returns.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const invite = new URL(req.url).searchParams.get("invite") ?? undefined;

  const hasSession = Boolean(session.athleteId);
  const hasValidInvite = invite ? await isInviteValid(invite) : false;

  if (!hasSession && !hasValidInvite) {
    return NextResponse.redirect(new URL("/login", env.siteUrl));
  }

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
