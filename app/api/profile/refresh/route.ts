import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db/index";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { RateLimitError } from "@/strava/client";
import { reconcileOne } from "@/worker/reconcile";

export const runtime = "nodejs";
export const maxDuration = 60;

const COOLDOWN_MS = 24 * 3600 * 1000;
/** How far back the self-serve refresh looks for missed activities. */
const LOOKBACK_S = 30 * 24 * 3600;

/**
 * Member-triggered refresh: re-pull the Strava profile (name, avatar) and
 * reconcile the last month of activities. Limited to once per 24h per user,
 * enforced server-side; the window is consumed even if the refresh fails.
 */
export async function POST() {
  const session = await getSession();
  if (!session.athleteId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, session.athleteId),
  });
  if (!user || user.deauthorizedAt || !user.accessToken || !user.refreshToken) {
    return NextResponse.json({ error: "No connected Strava account" }, { status: 403 });
  }

  // Claim the 24h window atomically so concurrent requests can't double-spend.
  const cutoff = new Date(Date.now() - COOLDOWN_MS);
  const claimed = await db
    .update(users)
    .set({ profileRefreshedAt: new Date() })
    .where(
      and(
        eq(users.id, user.id),
        or(isNull(users.profileRefreshedAt), lt(users.profileRefreshedAt, cutoff)),
      ),
    )
    .returning({ id: users.id });
  if (claimed.length === 0) {
    const last = user.profileRefreshedAt?.getTime() ?? Date.now();
    return NextResponse.json(
      {
        error: "Profile refresh is limited to once per day",
        retryAt: new Date(last + COOLDOWN_MS).toISOString(),
      },
      { status: 429 },
    );
  }

  try {
    const result = await reconcileOne(user, {
      refreshProfiles: true,
      maxPages: 3,
      after: Math.floor(Date.now() / 1000) - LOOKBACK_S,
      // Stop before Vercel's 60s kill so the response always makes it out;
      // anything left over is caught by webhooks and the daily cron.
      deadlineMs: Date.now() + 45_000,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Strava is rate limiting us — try again tomorrow" },
        { status: 503 },
      );
    }
    console.error(`profile refresh failed for user ${user.id}`, err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
