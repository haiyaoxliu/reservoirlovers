import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { activities, loopEvents, users } from "../db/schema";

export interface LeaderboardRow {
  userId: number;
  stravaAthleteId: number;
  displayName: string;
  avatarUrl: string | null;
  loops: number;
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
      fastestSeconds: sql<number | null>`min(${loopEvents.elapsedSeconds})`,
    })
    .from(users)
    .leftJoin(loopEvents, eq(loopEvents.userId, users.id))
    .groupBy(users.id, users.stravaAthleteId, users.displayName, users.avatarUrl)
    .orderBy(desc(sql`coalesce(sum(case when ${loopEvents.kind} = 'full' then 1 else 0 end), 0)`));

  return rows.map((r) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    loops: Number(r.loops),
    fastestSeconds: r.fastestSeconds == null ? null : Number(r.fastestSeconds),
  }));
}

export interface TimelineEvent {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  eventTime: string; // ISO — loop completion
  elapsedSeconds: number | null;
  activityName: string | null;
}

/** Full loop completions with member info, oldest first, for the timeline. */
export async function getTimeline(): Promise<TimelineEvent[]> {
  const rows = await db
    .select({
      id: loopEvents.id,
      userId: loopEvents.userId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      eventTime: loopEvents.eventTime,
      elapsedSeconds: loopEvents.elapsedSeconds,
      activityName: activities.name,
    })
    .from(loopEvents)
    .innerJoin(users, eq(users.id, loopEvents.userId))
    .innerJoin(activities, eq(activities.id, loopEvents.activityId))
    .where(eq(loopEvents.kind, "full"))
    .orderBy(asc(loopEvents.eventTime));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    eventTime: r.eventTime.toISOString(),
    elapsedSeconds: r.elapsedSeconds,
    activityName: r.activityName,
  }));
}

/** Format seconds as m:ss (e.g. 782 → "13:02"). */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
