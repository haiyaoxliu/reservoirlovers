import { CHECKPOINTS } from "./constants";
import { projectToSegment, type Vec2 } from "./geo";

export interface Checkpoint {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export interface CanonicalLoop {
  lat0: number;
  lng0: number;
  totalMeters: number;
  /** Exactly CHECKPOINTS points, equally spaced, in loop order. */
  checkpoints: Checkpoint[];
}

/**
 * Precomputed directed segments of the loop, wrapping from the last checkpoint
 * back to the first. Segment `i` runs from checkpoint `i` to `(i+1) % N`.
 */
export interface LoopGeometry {
  loop: CanonicalLoop;
  segStart: Vec2[];
  segEnd: Vec2[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export function buildGeometry(loop: CanonicalLoop): LoopGeometry {
  const n = loop.checkpoints.length;
  const segStart: Vec2[] = [];
  const segEnd: Vec2[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = loop.checkpoints[i];
    const b = loop.checkpoints[(i + 1) % n];
    segStart.push({ x: a.x, y: a.y });
    segEnd.push({ x: b.x, y: b.y });
    if (a.x < minX) minX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.x > maxX) maxX = a.x;
    if (a.y > maxY) maxY = a.y;
  }
  return { loop, segStart, segEnd, bbox: { minX, minY, maxX, maxY } };
}

export interface LoopPosition {
  /** Continuous loop position in [0, N): checkpoint index + fraction. */
  p: number;
  /** Cross-track distance to the nearest segment (meters). */
  d: number;
}

/**
 * Map a projected GPS point to its nearest position on the loop by brute-force
 * projection onto all N segments. O(N) per fix — a few hundred float ops.
 */
export function loopPosition(geo: LoopGeometry, point: Vec2): LoopPosition {
  const n = geo.segStart.length;
  let bestD = Infinity;
  let bestP = 0;
  for (let i = 0; i < n; i++) {
    const { d, t } = projectToSegment(point, geo.segStart[i], geo.segEnd[i]);
    if (d < bestD) {
      bestD = d;
      bestP = (i + t) % n;
    }
  }
  return { p: bestP, d: bestD };
}

export const LOOP_N = CHECKPOINTS;
