import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index";
import { invites } from "../db/schema";

export function generateInviteCode(): string {
  // 8 url-safe chars, human-shareable.
  return randomBytes(6).toString("base64url").slice(0, 8);
}

/** True if the code exists, is unused, and is not expired. */
export async function isInviteValid(code: string): Promise<boolean> {
  const row = await db.query.invites.findFirst({ where: eq(invites.code, code) });
  if (!row || row.usedByAthleteId) return false;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false;
  return true;
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

export async function createInvite(createdBy: number, note?: string): Promise<string> {
  const code = generateInviteCode();
  await db.insert(invites).values({ code, createdBy, note });
  return code;
}
