import { and, eq } from "drizzle-orm";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db } from "../db/index";
import { adminCredentials, users, type AdminCredential, type User } from "../db/schema";
import { getSession } from "./session";

/** The admin User for the current session, or null if the caller isn't the
 *  Strava-authenticated admin. Used by the passkey API routes, which respond
 *  with JSON rather than redirecting like the admin page does. */
export async function getAdminUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.athleteId) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, session.athleteId),
  });
  return user && user.isAdmin === 1 ? user : null;
}

export async function listCredentials(userId: number): Promise<AdminCredential[]> {
  return db.query.adminCredentials.findMany({
    where: eq(adminCredentials.userId, userId),
  });
}

export async function saveCredential(input: {
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  label?: string | null;
}): Promise<void> {
  await db.insert(adminCredentials).values({
    userId: input.userId,
    credentialId: input.credentialId,
    publicKey: input.publicKey,
    counter: input.counter,
    transports: input.transports ? JSON.stringify(input.transports) : null,
    label: input.label ?? null,
  });
}

/** Delete one of the admin's own passkeys by its row id. Scoped to userId so a
 *  caller can only ever remove their own credentials. Returns the number of rows
 *  removed (0 if it was already gone or never belonged to them). */
export async function deleteCredential(userId: number, id: number): Promise<number> {
  const removed = await db
    .delete(adminCredentials)
    .where(and(eq(adminCredentials.id, id), eq(adminCredentials.userId, userId)))
    .returning({ id: adminCredentials.id });
  return removed.length;
}

/** Bump the stored signature counter and last-used time after a successful
 *  assertion — the counter guards against cloned-authenticator replay. */
export async function touchCredential(credentialId: string, counter: number): Promise<void> {
  await db
    .update(adminCredentials)
    .set({ counter, lastUsedAt: new Date() })
    .where(eq(adminCredentials.credentialId, credentialId));
}

/** Parse the stored transports JSON back into the typed array. */
export function credentialTransports(
  row: AdminCredential,
): AuthenticatorTransportFuture[] | undefined {
  if (!row.transports) return undefined;
  try {
    return JSON.parse(row.transports) as AuthenticatorTransportFuture[];
  } catch {
    return undefined;
  }
}
