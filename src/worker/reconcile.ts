import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "../db/index";
import { activities, users, type User } from "../db/schema";
import { ALGO_VERSION } from "../loop/constants";
import { listActivities, RateLimitError } from "../strava/client";
import { prefilter } from "../strava/prefilter";
import { getValidAccessToken } from "../strava/tokens";
import { processActivity } from "./process-activity";

export interface ReconcileResult {
  usersScanned: number;
  activitiesSeen: number;
  processed: number;
  rateLimited: boolean;
}

interface ReconcileOptions {
  /** Only consider activities started after this epoch (seconds). */
  after?: number;
  /** Max pages of 30 activities to pull per user. */
  maxPages?: number;
}

/**
 * Catch webhook misses and reprocess stale activities. For each active member,
 * page recent activity summaries, cheaply pre-filter, and (re)process anything
 * that isn't already processed at the current algo version.
 */
export async function reconcileAll(opts: ReconcileOptions = {}): Promise<ReconcileResult> {
  const active = await db
    .select()
    .from(users)
    .where(isNull(users.deauthorizedAt));

  const result: ReconcileResult = {
    usersScanned: 0,
    activitiesSeen: 0,
    processed: 0,
    rateLimited: false,
  };

  for (const user of active) {
    if (!user.accessToken || !user.refreshToken) continue;
    result.usersScanned++;
    try {
      await reconcileUser(user, opts, result);
    } catch (err) {
      if (err instanceof RateLimitError) {
        result.rateLimited = true;
        break; // stop; the next run will pick up where we left off
      }
      console.error(`reconcile failed for user ${user.id}`, err);
    }
  }
  return result;
}

async function reconcileUser(
  user: User,
  opts: ReconcileOptions,
  result: ReconcileResult,
): Promise<void> {
  const token = await getValidAccessToken(user);
  const maxPages = opts.maxPages ?? 1;

  for (let page = 1; page <= maxPages; page++) {
    const summaries = await listActivities(token, page, 30, opts.after);
    if (summaries.length === 0) break;

    for (const summary of summaries) {
      result.activitiesSeen++;

      const existing = await db.query.activities.findFirst({
        where: eq(activities.stravaActivityId, summary.id),
      });
      const upToDate =
        existing &&
        existing.algoVersion === ALGO_VERSION &&
        (existing.status === "processed" || existing.status === "skipped_prefilter");
      if (upToDate) continue;

      // Cheap gate so we don't burn a streams call on non-reservoir runs.
      if (!prefilter(summary).pass) continue;

      await processActivity(summary.id, user.stravaAthleteId, "create");
      result.processed++;
    }
  }
}

/** Re-enqueue activities left in the `error` state (e.g. after a rate limit). */
export async function retryErrored(): Promise<number> {
  const rows = await db
    .select({ id: activities.stravaActivityId, userId: activities.userId })
    .from(activities)
    .where(and(eq(activities.status, "error"), ne(activities.status, "processing")));

  let retried = 0;
  for (const row of rows) {
    const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user || user.deauthorizedAt) continue;
    try {
      await processActivity(row.id, user.stravaAthleteId, "create");
      retried++;
    } catch (err) {
      if (err instanceof RateLimitError) break;
    }
  }
  return retried;
}
