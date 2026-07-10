import {
  ENTER_M,
  EXIT_M,
  GAP_BRIDGE_S,
  MAX_MEDIAN_D_M,
  MAX_SPEED_MPS,
  MIN_SEG_PCT,
  MIN_TELEPORT_M,
  OFF_GRACE_S,
  REV_HYST,
} from "./constants";
import { buildGeometry, loopPosition, LOOP_N, type CanonicalLoop, type LoopGeometry } from "./canonical";
import { median, project } from "./geo";
import canonicalJson from "./canonical-loop.json";

export type LoopEventKind = "full" | "partial";
export type Direction = "ccw" | "cw" | "mixed";

export interface LoopEvent {
  kind: LoopEventKind;
  /** 1–100. `full` events are always 100. */
  percent: number;
  /** Seconds since activity start: completion instant (full) or segment end (partial). */
  eventTime: number;
  /** Seconds since activity start: first credited fix of the segment. */
  segmentStartTime: number;
  /** For a full loop, seconds taken to run that lap (since the previous
   *  completion, or segment start for the first). Null for partials. */
  elapsedSeconds: number | null;
  direction: Direction;
}

export interface GpsFix {
  lat: number;
  lng: number;
  /** Seconds since activity start. */
  t: number;
}

/** Shortest signed move between two loop positions, in (-N/2, N/2]. */
function wrapDelta(from: number, to: number): number {
  const half = LOOP_N / 2;
  return ((to - from + half + LOOP_N) % LOOP_N) - half;
}

interface Commit {
  t: number;
  dir: 1 | -1;
}

/**
 * A contiguous stretch of on-track running. `P` is unwrapped signed travel;
 * commits are whole 1% steps of progress with reversal hysteresis.
 */
class Segment {
  fixes: { t: number; d: number }[] = [];
  P = 0;
  committed = 0;
  lastDir: 0 | 1 | -1 = 0;
  commits: Commit[] = [];
  prevP: number;
  prevT: number;

  constructor(startP: number, startT: number, startD: number) {
    this.prevP = startP;
    this.prevT = startT;
    this.fixes.push({ t: startT, d: startD });
  }

  advance(deltaP: number, p: number, t: number, d: number): void {
    this.fixes.push({ t, d });
    const startP = this.P;
    this.P += deltaP;

    while (true) {
      let boundary: number;
      let dir: 1 | -1;
      const upThresh = this.committed + 1 + (this.lastDir === -1 ? REV_HYST : 0);
      const downThresh = this.committed - 1 - (this.lastDir === 1 ? REV_HYST : 0);
      if (this.P >= upThresh) {
        boundary = this.committed + 1;
        dir = 1;
      } else if (this.P <= downThresh) {
        boundary = this.committed - 1;
        dir = -1;
      } else {
        break;
      }
      const span = this.P - startP;
      const frac = span === 0 ? 1 : (boundary - startP) / span;
      const ct = this.prevT + Math.max(0, Math.min(1, frac)) * (t - this.prevT);
      this.commits.push({ t: ct, dir });
      this.committed = boundary;
      this.lastDir = dir;
    }

    this.prevP = p;
    this.prevT = t;
  }
}

export interface MatchOptions {
  loop?: CanonicalLoop;
  geometry?: LoopGeometry;
}

let cachedGeometry: LoopGeometry | null = null;
function defaultGeometry(): LoopGeometry {
  if (!cachedGeometry) {
    cachedGeometry = buildGeometry(canonicalJson as CanonicalLoop);
  }
  return cachedGeometry;
}

/**
 * Turn a run's GPS fixes into loop events. Pure: same input → same output.
 * Fixes must be time-ordered.
 */
export function matchActivity(fixes: GpsFix[], opts: MatchOptions = {}): LoopEvent[] {
  const geo = opts.geometry ?? (opts.loop ? buildGeometry(opts.loop) : defaultGeometry());
  const events: LoopEvent[] = [];

  let seg: Segment | null = null;
  let offSince: number | null = null;

  const closeSegment = () => {
    if (seg) finalizeSegment(seg, events);
    seg = null;
    offSince = null;
  };

  for (const fix of fixes) {
    const pt = project(fix.lat, fix.lng, geo.loop.lat0, geo.loop.lng0);
    const { p, d } = loopPosition(geo, pt);

    if (!seg) {
      if (d <= ENTER_M) seg = new Segment(p, fix.t, d);
      continue;
    }

    if (d > EXIT_M) {
      if (offSince === null) offSince = fix.t;
      if (fix.t - offSince > OFF_GRACE_S) closeSegment();
      continue;
    }
    offSince = null;

    const dt = fix.t - seg.prevT;
    const delta = wrapDelta(seg.prevP, p);
    const groundMeters = Math.abs(delta) * (geo.loop.totalMeters / LOOP_N);

    if (
      dt > 0 &&
      groundMeters > MAX_SPEED_MPS * dt &&
      groundMeters > MIN_TELEPORT_M &&
      dt <= GAP_BRIDGE_S
    ) {
      closeSegment();
      if (d <= ENTER_M) seg = new Segment(p, fix.t, d);
      continue;
    }
    if (dt > GAP_BRIDGE_S) {
      closeSegment();
      if (d <= ENTER_M) seg = new Segment(p, fix.t, d);
      continue;
    }

    seg.advance(delta, p, fix.t, d);
  }

  closeSegment();
  return events;
}

function finalizeSegment(seg: Segment, out: LoopEvent[]): void {
  const total = seg.commits.length; // percent of travel, direction-agnostic
  if (total < MIN_SEG_PCT) return;

  const medianD = median(seg.fixes.map((f) => f.d));
  if (medianD > MAX_MEDIAN_D_M) return; // bridle-path guard

  const net = seg.commits.reduce((s, c) => s + c.dir, 0);
  const direction: Direction =
    net === total ? "ccw" : net === -total ? "cw" : "mixed";

  const segmentStartTime = seg.commits[0].t;

  let emitted = 0;
  let lastFullTime = segmentStartTime;
  for (let k = 0; k < seg.commits.length; k++) {
    const count = k + 1;
    if (count % LOOP_N === 0) {
      const completion = seg.commits[k].t;
      out.push({
        kind: "full",
        percent: 100,
        eventTime: completion,
        segmentStartTime,
        elapsedSeconds: Math.round(completion - lastFullTime),
        direction,
      });
      lastFullTime = completion;
      emitted += LOOP_N;
    }
  }

  const remainder = total - emitted;
  if (remainder > 0) {
    out.push({
      kind: "partial",
      percent: remainder,
      eventTime: seg.commits[seg.commits.length - 1].t,
      segmentStartTime,
      elapsedSeconds: null,
      direction,
    });
  }
}
