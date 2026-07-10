/**
 * Every tunable in the loop-matching engine lives here so it can be adjusted
 * from test fixtures without touching algorithm code. Distances are meters;
 * percent units are "checkpoints" (1% of the loop ≈ 25.4 m).
 *
 * The canonical loop geometry is seeded from the Strava segment's own polyline
 * (a crowd-averaged centerline), so these thresholds describe how far a real GPS
 * track may drift from that centerline and still count.
 */

/** Number of equally-spaced checkpoints the canonical loop is resampled to. */
export const CHECKPOINTS = 100;

/** Expected total length of the reservoir loop, for fixture sanity checks. */
export const EXPECTED_LOOP_METERS = 2540;
export const MIN_LOOP_METERS = 2200;
export const MAX_LOOP_METERS = 2800;

/** Reservoir centroid — origin of the local equirectangular projection. */
export const RESERVOIR_LAT0 = 40.786;
export const RESERVOIR_LNG0 = -73.9625;

/** Meters per degree at the reservoir latitude (equirectangular projection). */
export const METERS_PER_DEG_LAT = 110574;
export const metersPerDegLng = (lat0: number) =>
  111320 * Math.cos((lat0 * Math.PI) / 180);

// ---- Matching thresholds (the "leeway") ----

/** Go on-track when cross-track distance ≤ this. Track is ~4 m wide; GPS
 *  noise 5–15 m; the bridle path is ≥10 m away, so 15 m accepts genuine fixes
 *  while making a bridle runner's entry marginal. */
export const ENTER_M = 15;

/** Stay on-track until cross-track distance exceeds this (spatial hysteresis).
 *  Absorbs occasional 20 m noise spikes without dropping the lap. */
export const EXIT_M = 25;

/** A run of off-track/missing fixes shorter than this never closes a segment. */
export const OFF_GRACE_S = 20;

/**
 * Extra percent margin required to commit progress in the *opposite* direction
 * of the last commit (Schmitt trigger). Blocks jitter from accruing credit.
 */
export const REV_HYST = 0.5;

/** Faster-than-this movement between fixes is treated as a teleport/gap. */
export const MAX_SPEED_MPS = 8;

/**
 * A jump is only treated as a teleport if it is *also* at least this many
 * meters. Below it, an implausible apparent speed is just GPS noise between
 * two 1 Hz fixes and is applied normally (quantization + REV_HYST absorb it).
 */
export const MIN_TELEPORT_M = 60;

/** Recording gaps up to this long may be bridged if speed/direction are sane. */
export const GAP_BRIDGE_S = 60;

/** Segments crediting less than this many percent are discarded.
 *  1% ≈ 25 m — the smallest increment that earns partial credit. */
export const MIN_SEG_PCT = 1;

/**
 * Bridle-path defense: discard a segment whose *median* cross-track distance
 * exceeds this. Real reservoir runners sit at 5–8 m; bridle runners at 10–40 m.
 * This is the ceiling on how far a whole run may drift from the centerline.
 */
export const MAX_MEDIAN_D_M = 12;

/** Pre-filter: minimum activity distance to bother processing. */
export const MIN_ACTIVITY_M = 150;

/** Bump when any constant above changes, to trigger reprocessing of activities. */
export const ALGO_VERSION = 4;

/** Sport types that earn loop credit (foot-powered). */
export const COUNTING_SPORT_TYPES = new Set([
  "Run",
  "TrailRun",
  "Walk",
  "Hike",
]);
