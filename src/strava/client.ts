import { env } from "../lib/env";
import type { GpsFix } from "../loop/matcher";
import type { ActivitySummary } from "./prefilter";

const OAUTH_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

export const OAUTH_SCOPES = "read,activity:read_all";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AthleteProfile {
  id: number;
  firstname?: string;
  lastname?: string;
  profile?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: AthleteProfile;
}

function toTokenSet(r: TokenResponse): TokenSet {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: new Date(r.expires_at * 1000),
  };
}

/** Build the URL that starts the OAuth flow. */
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.stravaClientId,
    redirect_uri: `${env.siteUrl}/api/auth/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: OAUTH_SCOPES,
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

/** Exchange an authorization code for tokens + the athlete profile. */
export async function exchangeCode(
  code: string,
): Promise<{ tokens: TokenSet; athlete: AthleteProfile }> {
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.athlete) throw new Error("Strava token exchange returned no athlete");
  return { tokens: toTokenSet(json), athlete: json.athlete };
}

/** Refresh an expired access token. */
export async function refreshToken(refresh: string): Promise<TokenSet> {
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  return toTokenSet((await res.json()) as TokenResponse);
}

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super("Strava rate limit hit");
  }
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 429) {
    // Strava resets the 15-min window on the quarter hour; retry after that.
    throw new RateLimitError(15 * 60 * 1000);
  }
  if (!res.ok) {
    throw new Error(`Strava GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Fetch the authenticated athlete's current profile (name, avatar). */
export function getAthlete(accessToken: string): Promise<AthleteProfile> {
  return apiGet("/athlete", accessToken);
}

export type ActivityDetail = ActivitySummary & {
  id?: number;
  name?: string;
  start_date?: string;
  utc_offset?: number;
};

/** Fetch a detailed activity (summary fields + polyline, name, start date). */
export function getActivity(id: number, accessToken: string): Promise<ActivityDetail> {
  return apiGet(`/activities/${id}`, accessToken);
}

interface StreamSet {
  latlng?: { data: [number, number][] };
  time?: { data: number[] };
  distance?: { data: number[] };
}

/** Fetch GPS streams and shape them into the matcher's GpsFix[]. */
export async function getActivityFixes(id: number, accessToken: string): Promise<GpsFix[]> {
  const streams = await apiGet<StreamSet>(
    `/activities/${id}/streams?keys=latlng,time,distance&key_by_type=true`,
    accessToken,
  );
  const latlng = streams.latlng?.data;
  const time = streams.time?.data;
  if (!latlng || !time || latlng.length !== time.length) return [];
  return latlng.map(([lat, lng], i) => ({ lat, lng, t: time[i] }));
}

export type ListedActivity = ActivitySummary & {
  id: number;
  name?: string;
  start_date?: string;
};

/** Recent activities for reconciliation/backfill (summaries, paginated). */
export function listActivities(
  accessToken: string,
  page = 1,
  perPage = 30,
  after?: number,
): Promise<ListedActivity[]> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (after) params.set("after", String(after));
  return apiGet(`/athlete/activities?${params}`, accessToken);
}

export interface SegmentDetail {
  id?: number;
  name?: string;
  distance?: number;
  map?: { polyline?: string };
}

/** Fetch a segment's detail, including its full encoded polyline geometry. */
export function getSegment(id: number, accessToken: string): Promise<SegmentDetail> {
  return apiGet(`/segments/${id}`, accessToken);
}
