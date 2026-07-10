import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users, type User } from "../db/schema";
import { decryptToken, encryptToken } from "../lib/crypto";
import { refreshToken } from "./client";

const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh if expiring within 5 minutes

/**
 * Return a currently-valid access token for a user, refreshing and persisting
 * the new token pair first if the stored one is close to expiry.
 */
export async function getValidAccessToken(user: User): Promise<string> {
  if (!user.accessToken || !user.refreshToken) {
    throw new Error(`User ${user.id} has no Strava tokens (deauthorized?)`);
  }
  const expiresAt = user.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return decryptToken(user.accessToken);
  }

  const fresh = await refreshToken(decryptToken(user.refreshToken));
  await db
    .update(users)
    .set({
      accessToken: encryptToken(fresh.accessToken),
      refreshToken: encryptToken(fresh.refreshToken),
      tokenExpiresAt: fresh.expiresAt,
    })
    .where(eq(users.id, user.id));
  return fresh.accessToken;
}
