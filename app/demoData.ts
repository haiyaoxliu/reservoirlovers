import type { TimelineEvent } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import type { TimelineMember } from "./Timeline";

/** Seeded PRNG (mulberry32) so the demo board is deterministic: the server
 *  render and the client hydration must produce identical fake data. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["Alex R.", "Jamie L.", "Sam K.", "Morgan T.", "Riley P."];
const ACTIVITY_NAMES = ["Morning Run", "Evening Run", "Lunch Run", "Reservoir Loops"];
const DAY_MS = 86400000;

/**
 * Plausible-looking members and loop events for the viewer-tier teaser board.
 * Negative ids keep the fake rows unmistakably distinct from real ones.
 * `now` comes from the server request so the demo always spans "recently".
 */
export function demoBoardData(now: number): {
  members: TimelineMember[];
  events: TimelineEvent[];
} {
  const rand = mulberry32(0x5eed);
  const members: TimelineMember[] = NAMES.map((displayName, i) => ({
    userId: -(i + 1),
    stravaAthleteId: 0,
    displayName,
    avatarUrl: null,
    color: colorFor(i),
  }));

  const events: TimelineEvent[] = [];
  let id = -1;
  for (const m of members) {
    const count = 10 + Math.floor(rand() * 8);
    for (let i = 0; i < count; i++) {
      // Skew toward recent days so the week/month windows aren't empty.
      const daysAgo = Math.floor(rand() ** 1.6 * 120);
      const timeOfDay = (6 + rand() * 14) * 3600000;
      const full = rand() < 0.55;
      const percent = full
        ? rand() < 0.8
          ? 100
          : 98 + Math.floor(rand() * 2)
        : 20 + Math.floor(rand() * 70);
      // Roughly 8-13 min/mile over percent% of the loop.
      const durationSeconds = Math.round((percent / 100) * (750 + rand() * 450));
      events.push({
        id: id--,
        userId: m.userId,
        displayName: m.displayName,
        avatarUrl: null,
        kind: full ? "full" : "partial",
        percent,
        direction: rand() < 0.85 ? "ccw" : "cw",
        eventTime: new Date(now - daysAgo * DAY_MS - timeOfDay).toISOString(),
        elapsedSeconds: durationSeconds,
        durationSeconds,
        activityName: ACTIVITY_NAMES[Math.floor(rand() * ACTIVITY_NAMES.length)],
        stravaActivityId: 0,
        endP: Math.floor(rand() * 100),
      });
    }
  }

  // Oldest first, matching getTimeline().
  events.sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  return { members, events };
}
