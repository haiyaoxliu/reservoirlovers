import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { activities, loopEvents, users } from "../db/schema";

export interface LeaderboardRow {
  userId: number;
  stravaAthleteId: number;
  displayName: string;
  avatarUrl: string | null;
  loops: number;
  /** Percent units from clean 100% loops. */
  exactFullPercent: number;
  /** Percent units from tolerance fulls (98-99%). */
  toleranceFullPercent: number;
  /** Total credited loop travel in percent-of-loop units (full + partial). */
  totalPercent: number;
  /** Fastest single loop in seconds, if any. */
  fastestSeconds: number | null;
}

/** Score per member: number of completed reservoir loops, plus their PR. */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      stravaAthleteId: users.stravaAthleteId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      loops: sql<number>`coalesce(sum(case when ${loopEvents.kind} = 'full' then 1 else 0 end), 0)`,
      exactFullPercent: sql<number>`coalesce(sum(case when ${loopEvents.kind} = 'full' and ${loopEvents.percent} >= 100 then ${loopEvents.percent} else 0 end), 0)`,
      toleranceFullPercent: sql<number>`coalesce(sum(case when ${loopEvents.kind} = 'full' and ${loopEvents.percent} < 100 then ${loopEvents.percent} else 0 end), 0)`,
      totalPercent: sql<number>`coalesce(sum(${loopEvents.percent}), 0)`,
      fastestSeconds: sql<number | null>`min(${loopEvents.elapsedSeconds})`,
    })
    .from(users)
    .leftJoin(loopEvents, eq(loopEvents.userId, users.id))
    .groupBy(users.id, users.stravaAthleteId, users.displayName, users.avatarUrl)
    .orderBy(
      desc(sql`coalesce(sum(case when ${loopEvents.kind} = 'full' then 1 else 0 end), 0)`),
      desc(sql`coalesce(sum(${loopEvents.percent}), 0)`),
    );

  return rows.map((r) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
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
