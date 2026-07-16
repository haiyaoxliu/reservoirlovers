import { randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index";
import { invites, users, type Invite, type InviteKind } from "../db/schema";

/** Strava caps the app at 10 connected athletes. We never let members plus
 *  still-open member invites exceed this — an open member invite is a slot
 *  already promised. Visitor invites are view-only and don't count. */
export const MAX_SLOTS = 10;

export function generateInviteCode(): string {
  // 8 url-safe chars, human-shareable.
  return randomBytes(6).toString("base64url").slice(0, 8);
}

/** True if the invite hasn't expired. */
function notExpired(row: Invite): boolean {
  return !row.expiresAt || row.expiresAt.getTime() >= Date.now();
}

/** The invite row if it's redeemable, else null. Redeemability depends on kind:
 *  - visitor: never redeemed (`usedAt` null) and not expired.
 *  - member: no current occupant (`usedByAthleteId` null), not expired, and —
 *    when the code is athlete-locked (`boundAthleteId` set from a prior
 *    redemption) — only for that same athlete. `athleteId` is unknown on the
 *    public landing page (pre-OAuth); the lock is enforced at redemption, so
 *    omitting it only checks occupancy/expiry. */
export async function getValidInvite(code: string, athleteId?: number): Promise<Invite | null> {
  const row = await db.query.invites.findFirst({ where: eq(invites.code, code) });
  if (!row || !notExpired(row)) return null;
  if (row.kind === "visitor") {
    return row.usedAt ? null : row;
  }
  if (row.usedByAthleteId) return null;
  if (row.boundAthleteId && athleteId !== undefined && row.boundAthleteId !== athleteId) {
    return null;
  }
  return row;
}

/** True if the code is redeemable (see getValidInvite). */
export async function isInviteValid(code: string, athleteId?: number): Promise<boolean> {
  return (await getValidInvite(code, athleteId)) !== null;
}

/** Atomically consume a member invite for an athlete. Sets the occupant and,
 *  on the first redemption, binds the code to that athlete for good. Returns
 *  false if it was taken, is a visitor invite, or is locked to someone else. */
export async function consumeInvite(code: string, athleteId: number): Promise<boolean> {
  const res = await db
    .update(invites)
    .set({
      usedByAthleteId: athleteId,
      usedAt: new Date(),
      // COALESCE: set the lock on first redemption, leave it once bound.
      boundAthleteId: sql`coalesce(${invites.boundAthleteId}, ${athleteId})`,
    })
    .where(
      and(
        eq(invites.code, code),
        eq(invites.kind, "member"),
        isNull(invites.usedByAthleteId),
        or(isNull(invites.boundAthleteId), eq(invites.boundAthleteId, athleteId)),
      ),
    )
    .returning({ code: invites.code });
  return res.length > 0;
}

/** Atomically consume a one-time visitor invite. Returns false if already used
 *  or not a visitor invite. */
export async function consumeVisitorInvite(code: string): Promise<boolean> {
  const res = await db
    .update(invites)
    .set({ usedAt: new Date() })
    .where(and(eq(invites.code, code), eq(invites.kind, "visitor"), isNull(invites.usedAt)))
    .returning({ code: invites.code });
  return res.length > 0;
}

/** Slots already committed against the Strava 10-athlete cap: connected members
 *  plus still-open (unused, unexpired) member invites, each of which could
 *  become a member. Visitor invites are excluded — they never connect Strava. */
export async function countCommittedSlots(): Promise<number> {
  const [members] = await db
    .select({ n: count() })
    .from(users)
    .where(isNull(users.deauthorizedAt));
  const [open] = await db
    .select({ n: count() })
    .from(invites)
    .where(
      and(
        eq(invites.kind, "member"),
        isNull(invites.usedByAthleteId),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
      ),
    );
  return members.n + open.n;
}

/** Create an invite. Member invites are refused past the Strava cap; visitor
 *  invites (view-only) are uncapped. Returns the new code, or null if a member
 *  invite would exceed capacity. */
export async function createInvite(
  createdBy: number,
  kind: InviteKind = "member",
): Promise<string | null> {
  if (kind === "member" && (await countCommittedSlots()) >= MAX_SLOTS) return null;
  const code = generateInviteCode();
  await db.insert(invites).values({ code, createdBy, kind });
  return code;
}

/** Free every member invite this athlete occupies so it reopens for them to
 *  reapply. Called when a member is removed/deauthorized. The athlete lock
 *  (`boundAthleteId`) is intentionally kept, so the reopened code only works for
 *  the same athlete. Idempotent; returns the freed codes (usually one). */
export async function releaseInvite(athleteId: number): Promise<string[]> {
  const freed = await db
    .update(invites)
    .set({ usedByAthleteId: null, usedAt: null })
    .where(eq(invites.usedByAthleteId, athleteId))
    .returning({ code: invites.code });
  return freed.map((r) => r.code);
}

/** Re-occupy the invite locked to this athlete, if it's currently open. Covers
 *  the reconnect path: a removed member's row still exists, so the OAuth callback
 *  treats them as an existing user and never calls consumeInvite — without this
 *  their reopened invite would stay "open" while they're an active member again,
 *  double-counting their slot against the cap. Idempotent (no-op if already
 *  occupied or unbound). */
export async function occupyBoundInvite(athleteId: number): Promise<void> {
  await db
    .update(invites)
    .set({ usedByAthleteId: athleteId, usedAt: new Date() })
    .where(and(eq(invites.boundAthleteId, athleteId), isNull(invites.usedByAthleteId)));
}

/** Delete every never-redeemed invite — member or visitor — to clear guessable
 *  open links. Athlete-locked invites (`boundAthleteId` set, i.e. redeemed at
 *  least once, possibly since released) are preserved so removed members keep
 *  their reapply link. Returns the deleted codes. */
export async function purgeOpenInvites(): Promise<string[]> {
  const removed = await db
    .delete(invites)
    .where(
      and(
        isNull(invites.boundAthleteId),
        isNull(invites.usedByAthleteId),
        isNull(invites.usedAt),
      ),
    )
    .returning({ code: invites.code });
  return removed.map((r) => r.code);
}
