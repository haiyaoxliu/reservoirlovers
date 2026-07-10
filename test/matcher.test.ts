import { describe, it, expect } from "vitest";
import { matchActivity, type LoopEvent } from "../src/loop/matcher";
import { synthRun } from "./helpers/synth";

const total = (events: LoopEvent[]) => events.reduce((s, e) => s + e.percent, 0);
const fulls = (events: LoopEvent[]) => events.filter((e) => e.kind === "full");
const partials = (events: LoopEvent[]) => events.filter((e) => e.kind === "partial");

describe("matcher — full loops", () => {
  it("credits one full loop for a clean CCW lap", () => {
    const ev = matchActivity(synthRun({ moves: [{ type: "run", deltaPct: 105 }] }));
    expect(fulls(ev)).toHaveLength(1);
    expect(total(ev)).toBeGreaterThanOrEqual(103);
    expect(total(ev)).toBeLessThanOrEqual(107);
    expect(ev[0].direction).toBe("ccw");
    // Lap time ≈ 2540 m / 3.5 m/s ≈ 726 s.
    expect(ev[0].elapsedSeconds).toBeGreaterThan(600);
    expect(ev[0].elapsedSeconds).toBeLessThan(850);
  });

  it("credits a clockwise lap the same and labels direction cw", () => {
    const ev = matchActivity(
      synthRun({ startPct: 60, moves: [{ type: "run", deltaPct: -105 }] }),
    );
    expect(fulls(ev)).toHaveLength(1);
    expect(total(ev)).toBeGreaterThanOrEqual(103);
    expect(ev[0].direction).toBe("cw");
  });

  it("counts 3.4 laps as 3 full events plus a ~40% partial", () => {
    const ev = matchActivity(synthRun({ moves: [{ type: "run", deltaPct: 340 }] }));
    expect(fulls(ev)).toHaveLength(3);
    const p = partials(ev);
    expect(p).toHaveLength(1);
    expect(p[0].percent).toBeGreaterThanOrEqual(37);
    expect(p[0].percent).toBeLessThanOrEqual(43);
    const times = fulls(ev).map((e) => e.eventTime);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(3);
    // Each lap time is positive and roughly one lap long.
    for (const f of fulls(ev)) expect(f.elapsedSeconds).toBeGreaterThan(500);
  });

  it("credits a full loop when the run starts mid-loop", () => {
    const ev = matchActivity(
      synthRun({ startPct: 37, moves: [{ type: "run", deltaPct: 105 }] }),
    );
    expect(fulls(ev)).toHaveLength(1);
    expect(total(ev)).toBeGreaterThanOrEqual(103);
  });
});

describe("matcher — partial credit and quirks", () => {
  it("credits an out-and-back as summed travel with no full loop", () => {
    const ev = matchActivity(
      synthRun({
        moves: [
          { type: "run", deltaPct: 30 },
          { type: "run", deltaPct: -30 },
        ],
      }),
    );
    expect(fulls(ev)).toHaveLength(0);
    expect(total(ev)).toBeGreaterThanOrEqual(56);
    expect(total(ev)).toBeLessThanOrEqual(64);
    expect(ev[0].direction).toBe("mixed");
  });

  it("credits a short on-track stretch as a small partial (≥ 1%)", () => {
    const ev = matchActivity(synthRun({ moves: [{ type: "run", deltaPct: 3 }] }));
    expect(fulls(ev)).toHaveLength(0);
    expect(partials(ev)).toHaveLength(1);
    expect(partials(ev)[0].percent).toBeGreaterThanOrEqual(1);
    expect(partials(ev)[0].percent).toBeLessThanOrEqual(4);
  });

  it("ignores a graze too short to commit a single checkpoint", () => {
    const ev = matchActivity(synthRun({ moves: [{ type: "run", deltaPct: 0.4 }] }));
    expect(ev).toHaveLength(0);
  });

  it("reports where on the loop each event ended", () => {
    const ev = matchActivity(
      synthRun({ startPct: 37, moves: [{ type: "run", deltaPct: 130 }] }),
    );
    const f = fulls(ev)[0];
    const p = partials(ev)[0];
    // A full loop ends where the segment began; the partial ~30% further on.
    expect(Math.abs(f.endP - 37)).toBeLessThanOrEqual(2);
    expect(p.endP).toBeGreaterThanOrEqual(63);
    expect(p.endP).toBeLessThanOrEqual(71);
  });
});

describe("matcher — bridle path guard", () => {
  it("gives zero credit for a full loop run ~20 m off the track", () => {
    const ev = matchActivity(
      synthRun({ noiseM: 8, moves: [{ type: "run", deltaPct: 105, offsetM: 20 }] }),
    );
    expect(ev).toHaveLength(0);
  });
});

describe("matcher — noise, gaps, pauses", () => {
  it("still credits one loop under heavy GPS noise", () => {
    const ev = matchActivity(
      synthRun({ seed: 7, noiseM: 10, moves: [{ type: "run", deltaPct: 108 }] }),
    );
    expect(fulls(ev)).toHaveLength(1);
    expect(total(ev)).toBeGreaterThanOrEqual(100);
    expect(total(ev)).toBeLessThanOrEqual(116);
  });

  it("bridges a 40 s dropout during which the runner kept moving", () => {
    const ev = matchActivity(
      synthRun({
        moves: [
          { type: "run", deltaPct: 50 },
          { type: "gap", seconds: 40, deltaPct: 5.5 },
          { type: "run", deltaPct: 50 },
        ],
      }),
    );
    expect(fulls(ev)).toHaveLength(1);
    expect(total(ev)).toBeGreaterThanOrEqual(103);
  });

  it("splits into two partials when the runner leaves and returns", () => {
    const ev = matchActivity(
      synthRun({
        moves: [
          { type: "run", deltaPct: 40 },
          { type: "off", seconds: 600, awayM: 200 },
          { type: "run", deltaPct: 30 },
        ],
      }),
    );
    expect(fulls(ev)).toHaveLength(0);
    expect(partials(ev)).toHaveLength(2);
    const pcts = partials(ev).map((e) => e.percent).sort((a, b) => a - b);
    expect(pcts[0]).toBeGreaterThanOrEqual(27);
    expect(pcts[1]).toBeGreaterThanOrEqual(37);
    expect(total(ev)).toBeGreaterThanOrEqual(64);
    expect(total(ev)).toBeLessThanOrEqual(76);
  });

  it("accrues no credit while paused mid-loop", () => {
    const ev = matchActivity(
      synthRun({
        noiseM: 10,
        moves: [
          { type: "run", deltaPct: 20 },
          { type: "pause", seconds: 300 },
          { type: "run", deltaPct: 85 },
        ],
      }),
    );
    expect(fulls(ev)).toHaveLength(1);
    expect(total(ev)).toBeLessThanOrEqual(112);
  });
});

describe("matcher — empty / degenerate", () => {
  it("returns nothing for an empty activity", () => {
    expect(matchActivity([])).toEqual([]);
  });
});
