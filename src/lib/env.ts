/** Centralized access to required environment variables, with clear errors. */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get stravaClientId() {
    return required("STRAVA_CLIENT_ID");
  },
  get stravaClientSecret() {
    return required("STRAVA_CLIENT_SECRET");
  },
  /** Random string Strava echoes back on webhook subscription validation. */
  get stravaWebhookVerifyToken() {
    return required("STRAVA_WEBHOOK_VERIFY_TOKEN");
  },
  /** 32-byte key, base64, for encrypting Strava tokens at rest. */
  get tokenEncKey() {
    return required("TOKEN_ENC_KEY");
  },
  /** Secret for signing the session cookie (>= 32 chars). */
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  /** Public site origin, e.g. https://reservoirlovers.nyc */
  get siteUrl() {
    return process.env.SITE_URL ?? "http://localhost:3000";
  },
  /** Strava athlete id that gets admin (invite management) rights. */
  get adminAthleteId() {
    const v = process.env.ADMIN_ATHLETE_ID;
    return v ? Number(v) : null;
  },
  /** Shared password for the view-only tier; unset disables it. */
  get viewerPassword() {
    return process.env.VIEWER_PASSWORD || null;
  },
};
