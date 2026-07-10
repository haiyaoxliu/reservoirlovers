/**
 * Backfill every member's full Strava history (or a single athlete's).
 *   npm run backfill                 # all active members
 *   npm run backfill -- <athleteId>  # just one
 *
 * Respects Strava rate limits: on a 429 it stops cleanly; re-run later to
 * continue (already-processed activities are skipped).
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { users } from "../src/db/schema";
import { reconcileAll } from "../src/worker/reconcile";
import { processActivity } from "../src/worker/process-activity";
import { getValidAccessToken } from "../src/strava/tokens";
import { listActivities } from "../src/strava/client";
import { prefilter } from "../src/strava/prefilter";

const athleteArg = process.argv[2] ? Number(process.argv[2]) : null;

if (athleteArg) {
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, athleteArg),
  });
  if (!user) throw new Error(`No user with athlete id ${athleteArg}`);
  const token = await getValidAccessToken(user);
  let page = 1;
  let processed = 0;
  for (;;) {
    const summaries = await listActivities(token, page, 30);
    if (summaries.length === 0) break;
    for (const s of summaries) {
      if (prefilter(s).pass) {
        await processActivity(s.id, user.stravaAthleteId, "create");
        processed++;
      }
    }
    console.log(`page ${page}: ${summaries.length} activities, ${processed} loops so far`);
    page++;
  }
  console.log(`Done: ${processed} reservoir activities processed for ${athleteArg}`);
} else {
  const result = await reconcileAll({ maxPages: 100 });
  console.log("Backfill complete:", JSON.stringify(result, null, 2));
}
process.exit(0);
