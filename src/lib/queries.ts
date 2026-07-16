import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { activities, loopEvents, users } from "../db/schema";

export interface LeaderboardRow {
  userId: number;
  stravaAthleteId: number;
  displayName: string;
  avatarUrl: string | null;
  loops: number;
  isAdmin: boolean;
  /** ISO timestamp the member's Strava was disconnected, or null if active.
   *  Disconnected members keep their history on the board, shown greyed out. */
  deauthorizedAt: string | null;
  /** Percent units from clean 100% loops. */
  exactFullPercent: number;
  /** Percent units from tolerance fulls (98-99%). */
  toleranceFullPercent: number;
  /** Total credited loop travel in percent-of-loop units (full + partial). */
  totalPercent: number;
  /** Fastest single loop in seconds, if any. */
  fastestSeconds: number | null;
}

/** Leaderboard time windows, matching the range tabs. `null` = all time. */
export type LeaderboardRangeKey = "week" | "month" | "year" | "all";
const RANGE_MS: Record<LeaderboardRangeKey, number | null> = {
  week: 7 * 86400000,
  month: 30 * 86400000,
  year: 365 * 86400000,
  all: null,
};

/** All-time leaderboard (kept for callers that want a single ranking). */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  return leaderboardSince(null);
}

/** Per-range leaderboards, precomputed server-side so the gated tier (visitors
 *  and members without a verified passkey) can rank by week/month/year/all
 *  without ever receiving the raw event stream. Ranges switch client-side
 *  instantly by picking a bucket. */
export type LeaderboardBuckets = Record<LeaderboardRangeKey, LeaderboardRow[]>;

export async function getLeaderboardBuckets(): Promise<LeaderboardBuckets> {
  const now = Date.now();
  const [week, month, year, all] = await Promise.all(
    (["week", "month", "year", "all"] as const).map((k) => {
      const span = RANGE_MS[k];
      return leaderboardSince(span == null ? null : new Date(now - span));
    }),
  );
  return { week, month, year, all };
}

/** Score per member within a time window (or all-time when cutoff is null):
 *  completed reservoir loops, credited travel, and their PR. Members with no
 *  events in the window still appear (zeroed) — the cutoff lives inside the
 *  aggregates, not a WHERE, so a left join keeps every member. */
async function leaderboardSince(cutoff: Date | null): Promise<LeaderboardRow[]> {
  const inRange = cutoff ? sql`${loopEvents.eventTime} >= ${cutoff}` : sql`true`;
  // Lap time for a full loop: the recorded elapsed, else derived from the
  // credited segment span — mirrors getTimeline's durationSeconds.
  const dur = sql`coalesce(${loopEvents.elapsedSeconds}, extract(epoch from (${loopEvents.eventTime} - ${loopEvents.segmentStartTime})))`;
  const loops = sql<number>`coalesce(sum(case when ${loopEvents.kind} = 'full' and ${inRange} then 1 else 0 end), 0)`;
  const total = sql<number>`coalesce(sum(case when ${inRange} then ${loopEvents.percent} else 0 end), 0)`;

  const rows = await db
    .select({
      userId: users.id,
      stravaAthleteId: users.stravaAthleteId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      deauthorizedAt: users.deauthorizedAt,
      loops,
      exactFullPercent: sql<number>`coalesce(sum(case when ${loopEvents.kind} = 'full' and ${loopEvents.percent} >= 100 and ${inRange} then ${loopEvents.percent} else 0 end), 0)`,
      toleranceFullPercent: sql<number>`coalesce(sum(case when ${loopEvents.kind} = 'full' and ${loopEvents.percent} < 100 and ${inRange} then ${loopEvents.percent} else 0 end), 0)`,
      totalPercent: total,
      fastestSeconds: sql<number | null>`min(case when ${loopEvents.kind} = 'full' and ${inRange} then ${dur} else null end)`,
    })
    .from(users)
    .leftJoin(loopEvents, eq(loopEvents.userId, users.id))
    .groupBy(
      users.id,
      users.stravaAthleteId,
      users.displayName,
      users.avatarUrl,
      users.isAdmin,
      users.deauthorizedAt,
    )
    .orderBy(desc(loops), desc(total));

  return rows.map((r) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    isAdmin: r.isAdmin === 1,
    deauthorizedAt: r.deauthorizedAt?.toISOString() ?? null,
    loops: Number(r.loops),
    exactFullPercent: Number(r.exactFullPercent),
    toleranceFullPercent: Number(r.toleranceFullPercent),
    totalPercent: Number(r.totalPercent),
    fastestSeconds: r.fastestSeconds == null ? null : Number(r.fastestSeconds),
  }));
}

export interface TimelineEvent {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  kind: "full" | "partial";
  /** 1-100; full events are always 100. */
  percent: number;
  direction: string | null; // "ccw" | "cw" | "mixed"
  eventTime: string; // ISO — loop completion
  elapsedSeconds: number | null;
  /** Lap time for fulls; time spent on the credited segment for partials. */
  durationSeconds: number | null;
  activityName: string | null;
  /** Strava activity id, for linking to the run itself. */
  stravaActivityId: number;
  /** Loop position (checkpoint 0-99) where the event ended; null on rows
   *  processed before ALGO_VERSION 4. */
  endP: number | null;
}

/** All loop events (full + partial) with member info, oldest first, for the
 *  timeline and map. */
export async function getTimeline(): Promise<TimelineEvent[]> {
  const rows = await db
    .select({
      id: loopEvents.id,
      userId: loopEvents.userId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      kind: loopEvents.kind,
      percent: loopEvents.percent,
      direction: loopEvents.direction,
      eventTime: loopEvents.eventTime,
      elapsedSeconds: loopEvents.elapsedSeconds,
      segmentStartTime: loopEvents.segmentStartTime,
      activityName: activities.name,
      stravaActivityId: activities.stravaActivityId,
      endP: loopEvents.endP,
    })
    .from(loopEvents)
    .innerJoin(users, eq(users.id, loopEvents.userId))
    .innerJoin(activities, eq(activities.id, loopEvents.activityId))
    .orderBy(asc(loopEvents.eventTime));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    kind: r.kind,
    percent: r.percent,
    direction: r.direction,
    eventTime: r.eventTime.toISOString(),
    elapsedSeconds: r.elapsedSeconds,
    durationSeconds:
      r.elapsedSeconds ??
      (r.segmentStartTime
        ? Math.round((r.eventTime.getTime() - r.segmentStartTime.getTime()) / 1000)
        : null),
    activityName: r.activityName,
    stravaActivityId: r.stravaActivityId,
    endP: r.endP,
  }));
}

/** Format seconds as m:ss (e.g. 782 → "13:02"). */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
