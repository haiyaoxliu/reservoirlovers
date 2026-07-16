import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { env } from "./env";

export interface SessionData {
  athleteId?: number;
  userId?: number;
  displayName?: string;
  /** View-only tier: leaderboard access, granted by redeeming a visitor invite.
   *  No Strava, no detailed board. */
  viewer?: boolean;
  /** Epoch ms the visitor invite was redeemed. Also the eviction line for the
   *  retired shared-password viewer tier: those old cookies carry viewer=true
   *  but no viewerAt, so they no longer validate — no SESSION_SECRET rotation
   *  needed to shed them. */
  viewerAt?: number;
  /** In-flight WebAuthn challenge (base64url) for a passkey ceremony. */
  webauthnChallenge?: string;
  /** Epoch ms of this member's last successful passkey verification. The
   *  detailed board, /account, and /admin all require this to be recent (see
   *  isFreshPasskey). */
  passkeyAt?: number;
}

/** How long a passkey verification stays valid before we re-prompt. Short by
 *  design — the member re-verifies on each visit; the window only needs to
 *  cover using the page in one sitting. */
export const ADMIN_PASSKEY_TTL_MS = 5 * 60_000;

/** True if this session presented a passkey within the freshness window. */
export function isFreshPasskey(session: SessionData): boolean {
  return (
    typeof session.passkeyAt === "number" &&
    Date.now() - session.passkeyAt < ADMIN_PASSKEY_TTL_MS
  );
}

/** True if this session is a view-only visitor (redeemed a visitor invite).
 *  Requires the redemption stamp so pre-invite (shared-password era) viewer
 *  cookies are rejected. */
export function isActiveViewer(session: SessionData): boolean {
  return session.viewer === true && typeof session.viewerAt === "number";
}

export function sessionOptions(): SessionOptions {
  return {
    password: env.sessionSecret,
    cookieName: "rl_session",
    cookieOptions: {
      httpOnly: true,
      secure: env.siteUrl.startsWith("https://"),
      sameSite: "lax",
      // ~1 year — friends stay logged in.
      maxAge: 60 * 60 * 24 * 365,
    },
  };
}

export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions());
}
