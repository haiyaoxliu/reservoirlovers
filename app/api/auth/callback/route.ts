import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { encryptToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { consumeInvite, isInviteValid } from "@/lib/invite";
import { exchangeCode } from "@/strava/client";

export const runtime = "nodejs";

function fail(reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, env.siteUrl));
}

export async function GET(req: NextRequest) {
  const store = await cookies();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = store.get("rl_oauth_state")?.value;

  if (!code) return fail("Authorization was cancelled");
  if (!state || state !== expectedState) return fail("Invalid OAuth state");
  store.delete("rl_oauth_state");

  // Strava echoes the scopes the user actually granted (they can uncheck
  // boxes on the consent screen). Without activity access every fetch 401s,
  // so refuse the connection with a pointer to the fix.
  const grantedScopes = url.searchParams.get("scope") ?? "";
  if (!grantedScopes.includes("activity:read")) {
    return fail(
      "Strava connected without activity access — please reconnect and keep “View data about your activities” checked",
    );
  }

  const { tokens, athlete } = await exchangeCode(code);
  const athleteId = athlete.id;

  const existing = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, athleteId),
  });

  // New athletes must present a valid, unused invite — except the configured
  // admin, who can bootstrap the very first account with no invite.
  const inviteCode = store.get("rl_invite")?.value;
  const isAdmin = env.adminAthleteId === athleteId;
  if (!existing && !isAdmin) {
    if (!inviteCode || !(await isInviteValid(inviteCode))) {
      return fail("You need an invite from the club to join");
    }
    const consumed = await consumeInvite(inviteCode, athleteId);
    if (!consumed) return fail("That invite has already been used");
  }

  const displayName =
    [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || `Athlete ${athleteId}`;

  const values = {
    stravaAthleteId: athleteId,
    displayName,
    avatarUrl: athlete.profile ?? null,
    accessToken: encryptToken(tokens.accessToken),
    refreshToken: encryptToken(tokens.refreshToken),
    tokenExpiresAt: tokens.expiresAt,
    scopes: grantedScopes,
    deauthorizedAt: null,
    isAdmin: env.adminAthleteId === athleteId ? 1 : existing?.isAdmin ?? 0,
  };

  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.stravaAthleteId, set: values })
    .returning();

  const session = await getSession();
  session.athleteId = athleteId;
  session.userId = user.id;
  session.displayName = displayName;
  await session.save();

  store.delete("rl_invite");
  return NextResponse.redirect(new URL("/", env.siteUrl));
}
