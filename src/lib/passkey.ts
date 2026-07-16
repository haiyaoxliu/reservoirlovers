import { and, eq } from "drizzle-orm";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db } from "../db/index";
import { passkeyCredentials, users, type PasskeyCredential, type User } from "../db/schema";
import { getSession } from "./session";

/** The connected member for the current session, or null if there's no Strava
 *  session. Any member (not just the admin) can register/verify a passkey, so
 *  the passkey API routes authorize against this. */
export async function getSessionUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.athleteId) return null;
  return (
    (await db.query.users.findFirst({
      where: eq(users.stravaAthleteId, session.athleteId),
    })) ?? null
  );
}

export async function listCredentials(userId: number): Promise<PasskeyCredential[]> {
  return db.query.passkeyCredentials.findMany({
    where: eq(passkeyCredentials.userId, userId),
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
  await db.insert(passkeyCredentials).values({
    userId: input.userId,
    credentialId: input.credentialId,
    publicKey: input.publicKey,
    counter: input.counter,
    transports: input.transports ? JSON.stringify(input.transports) : null,
    label: input.label ?? null,
  });
}

/** Delete one of a member's own passkeys by its row id. Scoped to userId so a
 *  caller can only ever remove their own credentials. Returns the number of rows
 *  removed (0 if it was already gone or never belonged to them). */
export async function deleteCredential(userId: number, id: number): Promise<number> {
  const removed = await db
    .delete(passkeyCredentials)
    .where(and(eq(passkeyCredentials.id, id), eq(passkeyCredentials.userId, userId)))
    .returning({ id: passkeyCredentials.id });
  return removed.length;
}

/** Bump the stored signature counter and last-used time after a successful
 *  assertion — the counter guards against cloned-authenticator replay. */
export async function touchCredential(credentialId: string, counter: number): Promise<void> {
  await db
    .update(passkeyCredentials)
    .set({ counter, lastUsedAt: new Date() })
    .where(eq(passkeyCredentials.credentialId, credentialId));
}

/** Parse the stored transports JSON back into the typed array. */
export function credentialTransports(
  row: PasskeyCredential,
): AuthenticatorTransportFuture[] | undefined {
  if (!row.transports) return undefined;
  try {
    return JSON.parse(row.transports) as AuthenticatorTransportFuture[];
  } catch {
    return undefined;
  }
}
