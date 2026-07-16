/**
 * One-off cleanup: delete every never-redeemed invite link to kill guessable
 * open invites left over from the pre-generated era. Going forward the admin
 * creates invites on demand.
 *
 *   npm run invites:purge
 *
 * Only touches invites that were NEVER redeemed (no bound athlete, no current
 * occupant, never used). Athlete-locked invites — including those reopened when
 * a member was removed — are preserved so removed members keep their reapply
 * link. Idempotent; safe to re-run. Same "revoke all open invites" logic as the
 * /admin button.
 */
import { purgeOpenInvites } from "../src/lib/invite";

const removed = await purgeOpenInvites();

if (removed.length === 0) {
  console.log("No open invites to purge.");
} else {
  for (const code of removed) {
    console.log(`Deleted open invite ${code}.`);
  }
  console.log(`Done: ${removed.length} open invite(s) purged.`);
}
process.exit(0);
