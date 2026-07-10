import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/index";
import { activities, loopEvents, users } from "../db/schema";
import { ALGO_VERSION } from "../loop/constants";
import { matchActivity } from "../loop/matcher";
import { getActivity, getActivityFixes, RateLimitError, type ActivityDetail } from "../strava/client";
import { prefilter } from "../strava/prefilter";
import { getValidAccessToken } from "../strava/tokens";

/**
 * Process one Strava activity idempotently. Safe to call repeatedly and for
 * webhook create/update/delete. The key invariant: loop_events for the activity
 * are always wiped before re-insert, so every path converges.
 *
 * Flow: cheap summary pre-filter → GPS-streams fetch → start-agnostic matcher
 * (seeded from the reservoir segment's geometry). Concurrency is handled by an
 * atomic status claim rather than an interactive transaction (Neon HTTP has no
 * interactive txns; at ~10 users the race window is negligible and
 * delete-before-insert makes a rare double-run converge).
 */
export async function processActivity(
  stravaActivityId: number,
  ownerAthleteId: number,
  aspect: "create" | "update" | "delete",
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, ownerAthleteId),
  });
  if (!user || user.deauthorizedAt) return;

  if (aspect === "delete") {
    await handleDelete(stravaActivityId);
    return;
  }

  await ensureRow(stravaActivityId, user.id);

  const claimed = await db
    .update(activities)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(activities.stravaActivityId, stravaActivityId),
        ne(activities.status, "processing"),
      ),
    )
    .returning({ id: activities.id });
  if (claimed.length === 0) return;

  const activityId = claimed[0].id;

  try {
    const accessToken = await getValidAccessToken(user);
    const summary = await getActivity(stravaActivityId, accessToken);

    // Always wipe prior events first — makes create/update/retry converge.
    await db.delete(loopEvents).where(eq(loopEvents.activityId, activityId));

    const verdict = prefilter(summary);
    if (!verdict.pass) {
      await finalize(activityId, { status: "skipped_prefilter", totalPercent: 0, summary });
      return;
    }

    const fixes = await getActivityFixes(stravaActivityId, accessToken);
    const events = matchActivity(fixes);
    const totalPercent = events.reduce((s, e) => s + e.percent, 0);
    const startDate = summary.start_date ? new Date(summary.start_date) : new Date();

    if (events.length > 0) {
      await db.insert(loopEvents).values(
        events.map((e, i) => ({
          activityId,
          userId: user.id,
          kind: e.kind,
          percent: e.percent,
          eventTime: new Date(startDate.getTime() + e.eventTime * 1000),
          segmentStartTime: new Date(startDate.getTime() + e.segmentStartTime * 1000),
          elapsedSeconds: e.elapsedSeconds,
          direction: e.direction,
          endP: e.endP,
          ordinal: i,
        })),
      );
    }

    await finalize(activityId, { status: "processed", totalPercent, summary });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await db
      .update(activities)
      .set({ status: "error", errorDetail: detail, updatedAt: new Date() })
      .where(eq(activities.id, activityId));
    if (err instanceof RateLimitError) throw err;
  }
}

async function ensureRow(stravaActivityId: number, userId: number): Promise<void> {
  await db
    .insert(activities)
    .values({ stravaActivityId, userId, status: "pending", startDate: new Date() })
    .onConflictDoNothing({ target: activities.stravaActivityId });
}

async function handleDelete(stravaActivityId: number): Promise<void> {
  const row = await db.query.activities.findFirst({
    where: eq(activities.stravaActivityId, stravaActivityId),
  });
  if (!row) return;
  await db.delete(loopEvents).where(eq(loopEvents.activityId, row.id));
  await db
    .update(activities)
    .set({ status: "deleted", totalPercent: 0, updatedAt: new Date() })
    .where(eq(activities.id, row.id));
}

interface FinalizeArgs {
  status: "processed" | "skipped_prefilter";
  totalPercent: number;
  summary: ActivityDetail;
}

async function finalize(activityId: number, args: FinalizeArgs): Promise<void> {
  const a = args.summary;
  await db
    .update(activities)
    .set({
      status: args.status,
      totalPercent: args.totalPercent,
      sportType: a.sport_type ?? a.type ?? null,
      name: a.name ?? null,
      distanceM: a.distance ?? null,
      startDate: a.start_date ? new Date(a.start_date) : undefined,
      utcOffsetS: a.utc_offset ?? null,
      algoVersion: ALGO_VERSION,
      processedAt: new Date(),
      errorDetail: null,
      updatedAt: new Date(),
    })
    .where(eq(activities.id, activityId));
}
