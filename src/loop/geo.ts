import {
  METERS_PER_DEG_LAT,
  metersPerDegLng,
  RESERVOIR_LAT0,
  RESERVOIR_LNG0,
} from "./constants";

export interface Vec2 {
  x: number;
  y: number;
}

export type LatLng = [lat: number, lng: number];

/**
 * Equirectangular projection to a local plane in meters, centred on the given
 * origin. Accurate to well under a meter across an ~800 m feature.
 */
export function project(
  lat: number,
  lng: number,
  lat0 = RESERVOIR_LAT0,
  lng0 = RESERVOIR_LNG0,
): Vec2 {
  return {
    x: (lng - lng0) * metersPerDegLng(lat0),
    y: (lat - lat0) * METERS_PER_DEG_LAT,
  };
}

/** Inverse of {@link project}. */
export function unproject(
  p: Vec2,
  lat0 = RESERVOIR_LAT0,
  lng0 = RESERVOIR_LNG0,
): LatLng {
  return [
    p.y / METERS_PER_DEG_LAT + lat0,
    p.x / metersPerDegLng(lat0) + lng0,
  ];
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface Projection {
  /** Perpendicular distance from the point to the segment (meters). */
  d: number;
  /** Parameter along the segment in [0, 1]. */
  t: number;
}

/**
 * Project point `p` onto segment `a → b`, returning the clamped parameter `t`
 * and the perpendicular distance `d`.
 */
export function projectToSegment(p: Vec2, a: Vec2, b: Vec2): Projection {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return { d: dist(p, a), t: 0 };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const projX = a.x + t * abx;
  const projY = a.y + t * aby;
  return { d: Math.hypot(p.x - projX, p.y - projY), t };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
