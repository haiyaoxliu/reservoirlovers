import { COUNTING_SPORT_TYPES, MIN_ACTIVITY_M } from "../loop/constants";
import {
  buildGeometry,
  type CanonicalLoop,
  type LoopGeometry,
} from "../loop/canonical";
import { project } from "../loop/geo";
import { decodePolyline } from "./polyline";
import canonicalJson from "../loop/canonical-loop.json";

/** The slice of a Strava activity summary the pre-filter needs. */
export interface ActivitySummary {
  sport_type?: string;
  type?: string;
  distance?: number;
  manual?: boolean;
  trainer?: boolean;
  map?: { summary_polyline?: string | null };
}

export type PrefilterVerdict = { pass: true } | { pass: false; reason: string };

// Looser than the matcher's thresholds because the summary polyline is coarse.
const BBOX_PAD_M = 100;
const CORRIDOR_M = 80;
const MIN_POINTS_IN_BBOX = 3;
const MIN_POINTS_IN_CORRIDOR = 3;
const MIN_DISTINCT_CHECKPOINTS = 5;

let cachedGeo: LoopGeometry | null = null;
function geo(): LoopGeometry {
  if (!cachedGeo) cachedGeo = buildGeometry(canonicalJson as CanonicalLoop);
  return cachedGeo;
}

/**
 * Decide whether an activity is worth spending a GPS-streams API call on, using
 * only its summary. Cheap checks first.
 */
export function prefilter(
  activity: ActivitySummary,
  geometry: LoopGeometry = geo(),
): PrefilterVerdict {
  const sport = activity.sport_type ?? activity.type ?? "";
  if (!COUNTING_SPORT_TYPES.has(sport)) {
    return { pass: false, reason: `sport_type ${sport || "unknown"} not counted` };
  }
  if (activity.manual || activity.trainer) {
    return { pass: false, reason: "manual or trainer activity" };
  }
  if ((activity.distance ?? 0) < MIN_ACTIVITY_M) {
    return { pass: false, reason: "activity shorter than minimum" };
  }
  const encoded = activity.map?.summary_polyline;
  if (!encoded) {
    return { pass: false, reason: "no summary polyline" };
  }

  const points = decodePolyline(encoded);
  const { bbox } = geometry;
  const projected = points.map((p) =>
    project(p[0], p[1], geometry.loop.lat0, geometry.loop.lng0),
  );

  let inBbox = 0;
  for (const pt of projected) {
    if (
      pt.x >= bbox.minX - BBOX_PAD_M &&
      pt.x <= bbox.maxX + BBOX_PAD_M &&
      pt.y >= bbox.minY - BBOX_PAD_M &&
      pt.y <= bbox.maxY + BBOX_PAD_M
    ) {
      inBbox++;
    }
  }
  if (inBbox < MIN_POINTS_IN_BBOX) {
    return { pass: false, reason: "polyline not near the reservoir bbox" };
  }

  const checkpoints = geometry.loop.checkpoints;
  const touched = new Set<number>();
  let inCorridor = 0;
  for (const pt of projected) {
    let bestD = Infinity;
    let bestI = -1;
    for (let i = 0; i < checkpoints.length; i++) {
      const d = Math.hypot(pt.x - checkpoints[i].x, pt.y - checkpoints[i].y);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestD <= CORRIDOR_M) {
      inCorridor++;
      touched.add(bestI);
    }
  }
  if (inCorridor < MIN_POINTS_IN_CORRIDOR || touched.size < MIN_DISTINCT_CHECKPOINTS) {
    return { pass: false, reason: "polyline only grazes the track" };
  }

  return { pass: true };
}
