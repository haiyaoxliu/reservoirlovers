import { describe, it, expect } from "vitest";
import { prefilter } from "../src/strava/prefilter";
import canonicalJson from "../src/loop/canonical-loop.json";
import type { CanonicalLoop } from "../src/loop/canonical";
import type { LatLng } from "../src/loop/geo";
import { encodePolyline } from "./helpers/encode-polyline";

const loop = canonicalJson as CanonicalLoop;
const reservoirPolyline = encodePolyline(loop.checkpoints.map((c) => [c.lat, c.lng] as LatLng));

const prospectPolyline = encodePolyline(
  Array.from({ length: 40 }, (_, i) => [40.66 + i * 0.0002, -73.97] as LatLng),
);

const grazePolyline = encodePolyline([
  ...loop.checkpoints.slice(0, 3).map((c) => [c.lat, c.lng] as LatLng),
  [40.79, -73.95],
  [40.8, -73.94],
]);

describe("prefilter", () => {
  it("passes a genuine reservoir run", () => {
    expect(
      prefilter({ sport_type: "Run", distance: 2600, map: { summary_polyline: reservoirPolyline } }).pass,
    ).toBe(true);
  });

  it("rejects a manual (no-GPS) activity", () => {
    expect(prefilter({ sport_type: "Run", distance: 2600, manual: true }).pass).toBe(false);
  });

  it("rejects a ride even along the reservoir", () => {
    expect(
      prefilter({ sport_type: "Ride", distance: 2600, map: { summary_polyline: reservoirPolyline } }).pass,
    ).toBe(false);
  });

  it("rejects a run in another park", () => {
    expect(
      prefilter({ sport_type: "Run", distance: 5000, map: { summary_polyline: prospectPolyline } }).pass,
    ).toBe(false);
  });

  it("rejects a run that only grazes the track", () => {
    expect(
      prefilter({ sport_type: "Run", distance: 4000, map: { summary_polyline: grazePolyline } }).pass,
    ).toBe(false);
  });

  it("counts a walk on the track", () => {
    expect(
      prefilter({ sport_type: "Walk", distance: 2600, map: { summary_polyline: reservoirPolyline } }).pass,
    ).toBe(true);
  });
});
