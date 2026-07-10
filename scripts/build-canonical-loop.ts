/**
 * Build src/loop/canonical-loop.json from the Strava reservoir segment's own
 * polyline — no hand-recorded lap needed.
 *
 *   RESERVOIR_SEGMENT_ID=852256 npm run build:loop
 *
 * Token resolution, in order:
 *   1. STRAVA_ACCESS_TOKEN env (grab one from your app's API settings page), or
 *   2. the first connected user's token from the DB (needs DATABASE_URL + creds).
 * With neither, a synthetic ellipse is emitted so tests/dev still work — clearly
 * marked; run this for real (with a token) before launch.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CHECKPOINTS,
  EXPECTED_LOOP_METERS,
  MAX_LOOP_METERS,
  MIN_LOOP_METERS,
  RESERVOIR_LAT0,
  RESERVOIR_LNG0,
} from "../src/loop/constants";
import { project, unproject, type Vec2 } from "../src/loop/geo";
import { pathLength, resampleClosed } from "../src/loop/resample";
import type { CanonicalLoop } from "../src/loop/canonical";
import { decodePolyline } from "../src/strava/polyline";
import { getSegment } from "../src/strava/client";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../src/loop/canonical-loop.json");
const SEGMENT_ID = Number(process.env.RESERVOIR_SEGMENT_ID ?? 852256);

function closeRing(pts: Vec2[]): Vec2[] {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > 30) return [...pts, { ...first }];
  return pts;
}

function syntheticRing(): Vec2[] {
  const a = 340;
  const b = 440;
  const raw: Vec2[] = [];
  const STEPS = 720;
  for (let i = 0; i < STEPS; i++) {
    const th = (i / STEPS) * 2 * Math.PI;
    raw.push({ x: a * Math.cos(th), y: b * Math.sin(th) });
  }
  raw.push({ ...raw[0] });
  const scale = EXPECTED_LOOP_METERS / pathLength(raw);
  return raw.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

async function tokenFromDb(): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("../src/db/index");
    const { users } = await import("../src/db/schema");
    const { isNull } = await import("drizzle-orm");
    const { getValidAccessToken } = await import("../src/strava/tokens");
    const active = await db.select().from(users).where(isNull(users.deauthorizedAt)).limit(1);
    if (active.length === 0 || !active[0].accessToken) return null;
    return await getValidAccessToken(active[0]);
  } catch (err) {
    console.warn("Could not read a token from the DB:", (err as Error).message);
    return null;
  }
}

async function segmentRing(): Promise<Vec2[] | null> {
  const token = process.env.STRAVA_ACCESS_TOKEN ?? (await tokenFromDb());
  if (!token) return null;
  const seg = await getSegment(SEGMENT_ID, token);
  const encoded = seg.map?.polyline;
  if (!encoded) throw new Error(`Segment ${SEGMENT_ID} has no polyline`);
  const latlng = decodePolyline(encoded);
  if (latlng.length < 20) throw new Error(`Segment ${SEGMENT_ID} polyline too short`);
  console.log(`Fetched segment ${SEGMENT_ID} "${seg.name}" (${latlng.length} points)`);
  return closeRing(latlng.map(([lat, lng]) => project(lat, lng)));
}

const fromSegment = await segmentRing();
const ring = fromSegment ?? syntheticRing();
const synthetic = fromSegment === null;

if (synthetic) {
  console.warn(
    "⚠  No Strava token available — emitting a SYNTHETIC reservoir loop.\n" +
      "   Set STRAVA_ACCESS_TOKEN (or DATABASE_URL with a connected user) and re-run before launch.",
  );
}

const totalMeters = pathLength(ring);
if (!synthetic && (totalMeters < MIN_LOOP_METERS || totalMeters > MAX_LOOP_METERS)) {
  throw new Error(
    `segment loop is ${totalMeters.toFixed(0)} m, expected ~${EXPECTED_LOOP_METERS} m ` +
      `(${MIN_LOOP_METERS}–${MAX_LOOP_METERS}). Wrong segment id?`,
  );
}

const resampled = resampleClosed(ring, CHECKPOINTS);
const checkpoints = resampled.map((p) => {
  const [lat, lng] = unproject(p);
  return { x: p.x, y: p.y, lat, lng };
});

const loop: CanonicalLoop & { synthetic: boolean; segmentId: number } = {
  lat0: RESERVOIR_LAT0,
  lng0: RESERVOIR_LNG0,
  totalMeters,
  synthetic,
  segmentId: SEGMENT_ID,
  checkpoints,
};

writeFileSync(OUT, JSON.stringify(loop, null, 2) + "\n");
console.log(
  `Wrote ${OUT}: ${checkpoints.length} checkpoints, ${totalMeters.toFixed(0)} m` +
    (synthetic ? " (synthetic)" : ` (segment ${SEGMENT_ID})`),
);
process.exit(0);
