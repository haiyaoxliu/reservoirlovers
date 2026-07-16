import { createHash } from "node:crypto";
import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { env } from "./env";

export interface SessionData {
  athleteId?: number;
  userId?: number;
  displayName?: string;
  /** View-only tier: leaderboard access with the shared viewer password. */
  viewer?: boolean;
  /** Hash prefix of the password the viewer logged in with — rotating
   *  VIEWER_PASSWORD invalidates existing viewer sessions. */
  viewerKey?: string;
  /** In-flight WebAuthn challenge (base64url) for an admin passkey ceremony. */
  webauthnChallenge?: string;
  /** Epoch ms of the admin's last successful passkey verification. The admin
   *  page and its actions require this to be recent (see isFreshPasskey). */
  adminPasskeyAt?: number;
}

/** How long an admin passkey verification stays valid before /admin re-prompts.
 *  Short by design — the admin re-verifies on each visit; the window only needs
 *  to cover using the page in one sitting. */
export const ADMIN_PASSKEY_TTL_MS = 5 * 60_000;

/** True if this session presented a passkey within the freshness window. */
export function isFreshPasskey(session: SessionData): boolean {
  return (
    typeof session.adminPasskeyAt === "number" &&
    Date.now() - session.adminPasskeyAt < ADMIN_PASSKEY_TTL_MS
  );
}

/** Key stored in viewer sessions; compared against the current password. */
export function viewerKeyFor(password: string): string {
  return createHash("sha256").update(password).digest("hex").slice(0, 16);
}

/** True if this session is a valid viewer for the CURRENT viewer password. */
export function isActiveViewer(session: SessionData): boolean {
  const pw = env.viewerPassword;
  return Boolean(pw && session.viewer && session.viewerKey === viewerKeyFor(pw));
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
