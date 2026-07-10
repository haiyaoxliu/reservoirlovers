import { dist, type Vec2 } from "./geo";

/** Total length of a polyline (open, i.e. not closing back to the start). */
export function pathLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * Resample a closed polyline to exactly `n` equally-spaced points by arc length.
 * Input should already be closed (first ≈ last). Returns `n` points spaced
 * `perimeter / n` apart, starting at the input's first point.
 */
export function resampleClosed(points: Vec2[], n: number): Vec2[] {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  }
  const perimeter = cum[cum.length - 1];
  const step = perimeter / n;

  const out: Vec2[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (seg < points.length - 2 && cum[seg + 1] < target) seg++;
    const segLen = cum[seg + 1] - cum[seg] || 1;
    const frac = (target - cum[seg]) / segLen;
    out.push({
      x: points[seg].x + frac * (points[seg + 1].x - points[seg].x),
      y: points[seg].y + frac * (points[seg + 1].y - points[seg].y),
    });
  }
  return out;
}
