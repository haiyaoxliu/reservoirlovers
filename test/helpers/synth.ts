import canonicalJson from "../../src/loop/canonical-loop.json";
import { buildGeometry, type CanonicalLoop } from "../../src/loop/canonical";
import { unproject, type Vec2 } from "../../src/loop/geo";
import type { GpsFix } from "../../src/loop/matcher";

export const LOOP = canonicalJson as CanonicalLoop;
export const GEO = buildGeometry(LOOP);
const N = LOOP.checkpoints.length;
const METERS_PER_PCT = LOOP.totalMeters / N;
const SPEED_MPS = 3.5;
const HZ = 1;

/** Deterministic PRNG (mulberry32) so fixtures are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number, sigma: number): number {
  const u = 1 - rand();
  const v = rand();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Point on the loop at continuous pct in [0, N), plus outward unit normal. */
function loopPointAt(pct: number): { pos: Vec2; normal: Vec2 } {
  const wrapped = ((pct % N) + N) % N;
  const i = Math.floor(wrapped);
  const frac = wrapped - i;
  const a = GEO.segStart[i];
  const b = GEO.segEnd[i];
  const pos = { x: a.x + frac * (b.x - a.x), y: a.y + frac * (b.y - a.y) };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / len, y: -dx / len };
  return { pos, normal };
}

export type Move =
  | { type: "run"; deltaPct: number; offsetM?: number; noiseM?: number }
  | { type: "pause"; seconds: number; noiseM?: number }
  | { type: "off"; seconds: number; awayM?: number }
  | { type: "gap"; seconds: number; deltaPct?: number };

export interface RunSpec {
  startPct?: number;
  seed?: number;
  noiseM?: number;
  moves: Move[];
}

/** Build GPS fixes (lat/lng/t) by executing a sequence of moves along the loop. */
export function synthRun(spec: RunSpec): GpsFix[] {
  const rand = rng(spec.seed ?? 42);
  const baseNoise = spec.noiseM ?? 5;
  const fixes: GpsFix[] = [];
  let pct = spec.startPct ?? 0;
  let t = 0;

  const emit = (pos: Vec2, extra = 0) => {
    const nx = gaussian(rand, extra || baseNoise);
    const ny = gaussian(rand, extra || baseNoise);
    const [lat, lng] = unproject({ x: pos.x + nx, y: pos.y + ny }, LOOP.lat0, LOOP.lng0);
    fixes.push({ lat, lng, t });
  };

  for (const mv of spec.moves) {
    if (mv.type === "run") {
      const meters = Math.abs(mv.deltaPct) * METERS_PER_PCT;
      const duration = meters / SPEED_MPS;
      const steps = Math.max(1, Math.round(duration * HZ));
      const dPct = mv.deltaPct / steps;
      const noise = mv.noiseM ?? baseNoise;
      for (let s = 0; s < steps; s++) {
        pct += dPct;
        const { pos, normal } = loopPointAt(pct);
        const off = mv.offsetM ?? 0;
        emit({ x: pos.x + normal.x * off, y: pos.y + normal.y * off }, noise);
        t += 1 / HZ;
      }
    } else if (mv.type === "pause") {
      const { pos } = loopPointAt(pct);
      for (let s = 0; s < mv.seconds * HZ; s++) {
        emit(pos, mv.noiseM ?? baseNoise);
        t += 1 / HZ;
      }
    } else if (mv.type === "off") {
      const { pos, normal } = loopPointAt(pct);
      const away = mv.awayM ?? 200;
      for (let s = 0; s < mv.seconds * HZ; s++) {
        emit({ x: pos.x + normal.x * away, y: pos.y + normal.y * away }, 5);
        t += 1 / HZ;
      }
    } else if (mv.type === "gap") {
      t += mv.seconds;
      if (mv.deltaPct) pct += mv.deltaPct;
    }
  }
  return fixes;
}

export { N as LOOP_CHECKPOINTS, METERS_PER_PCT };
