import type { LatLng } from "../../src/loop/geo";

/** Encode [lat,lng] pairs to a Google polyline (precision 5) — for test fixtures. */
export function encodePolyline(points: LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  const enc = (v: number) => {
    let value = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (value >= 0x20) {
      s += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    s += String.fromCharCode(value + 63);
    return s;
  };
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e5);
    const iLng = Math.round(lng * 1e5);
    out += enc(iLat - lastLat) + enc(iLng - lastLng);
    lastLat = iLat;
    lastLng = iLng;
  }
  return out;
}
