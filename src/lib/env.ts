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
  /** WebAuthn Relying Party ID for admin passkeys — the site's registrable
   *  domain. Defaults to the SITE_URL host with a leading `www.` stripped so a
   *  single rpID covers both the apex and `www` origins; override with
   *  WEBAUTHN_RP_ID if needed. */
  get rpId() {
    if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
    return new URL(this.siteUrl).hostname.replace(/^www\./, "");
  },
  /** Origins a passkey ceremony may occur on: SITE_URL plus its www/apex
   *  sibling, so it works whichever the admin visits. */
  get rpOrigins(): string[] {
    const u = new URL(this.siteUrl);
    const origin = u.origin;
    const sibling = u.hostname.startsWith("www.")
      ? origin.replace("://www.", "://")
      : `${u.protocol}//www.${u.host}`;
    return Array.from(new Set([origin, sibling]));
  },
  /** Human-readable Relying Party name shown in the passkey prompt. */
  get rpName() {
    return "Reservoir Lovers";
  },
};
