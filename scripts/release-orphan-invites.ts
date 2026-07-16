/**
 * One-time backfill: reopen invites redeemed by members who were already
 * removed (deauthorized) before invite-freeing was wired into the remove flow.
 * Freed invites become "open" again on the admin page and can be reshared.
 *
 *   npm run invites:release
 *
 * Idempotent — safe to re-run; it only touches used invites belonging to
 * deauthorized athletes.
 */
import { eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../src/db/index";
import { invites, users } from "../src/db/schema";

const deauthorized = db
  .select({ athleteId: users.stravaAthleteId })
  .from(users)
  .where(isNotNull(users.deauthorizedAt));

const freed = await db
  .update(invites)
  .set({ usedByAthleteId: null, usedAt: null })
  .where(inArray(invites.usedByAthleteId, deauthorized))
  .returning({ code: invites.code });

if (freed.length === 0) {
  console.log("No orphaned invites to reopen.");
} else {
  for (const inv of freed) {
    console.log(`Reopened invite ${inv.code}.`);
  }
  console.log(`Done: ${freed.length} invite(s) reopened.`);
}
process.exit(0);
