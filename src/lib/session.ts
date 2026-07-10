import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { env } from "./env";

export interface SessionData {
  athleteId?: number;
  userId?: number;
  displayName?: string;
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
