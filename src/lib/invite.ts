import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index";
import { invites } from "../db/schema";

export function generateInviteCode(): string {
  // 8 url-safe chars, human-shareable.
  return randomBytes(6).toString("base64url").slice(0, 8);
}

/** The invite row if the code exists, is unused, and is not expired; else null. */
export async function getValidInvite(code: string) {
  const row = await db.query.invites.findFirst({ where: eq(invites.code, code) });
  if (!row || row.usedByAthleteId) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/** True if the code exists, is unused, and is not expired. */
export async function isInviteValid(code: string): Promise<boolean> {
  return (await getValidInvite(code)) !== null;
}

/** Atomically consume an invite for an athlete. Returns false if already used. */
export async function consumeInvite(code: string, athleteId: number): Promise<boolean> {
  const res = await db
    .update(invites)
    .set({ usedByAthleteId: athleteId, usedAt: new Date() })
    .where(and(eq(invites.code, code), isNull(invites.usedByAthleteId)))
    .returning({ code: invites.code });
  return res.length > 0;
}

export async function createInvite(createdBy: number): Promise<string> {
  const code = generateInviteCode();
  await db.insert(invites).values({ code, createdBy });
  return code;
}

/** Free every invite this athlete redeemed so the link opens back up for reuse.
 *  Called when a member is removed/deauthorized. Idempotent, and returns the
 *  freed codes (usually one). */
export async function releaseInvite(athleteId: number): Promise<string[]> {
  const freed = await db
    .update(invites)
    .set({ usedByAthleteId: null, usedAt: null })
    .where(eq(invites.usedByAthleteId, athleteId))
    .returning({ code: invites.code });
  return freed.map((r) => r.code);
}
