"use client";

import { useSettings } from "./Settings";

export interface TierMark {
  /** Boundary position as a percentage of the bar width. */
  pct: number;
  /** Cumulative loop count at this boundary. */
  label: string;
  /** The headline number (full + tolerance loops) — brighter, never dropped. */
  main?: boolean;
}

/**
 * Loop counts at the leaderboard bar's tier boundaries. Small corner text in
 * detail mode; large full-height watermark numbers in clean mode (where the
 * column headers are hidden). When boundaries sit too close together the
 * main mark wins and the others are dropped.
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  const { prefs } = useSettings();
  // With the stat columns hidden, the watermarks carry the counts full-size.
  const clean = !prefs.statColumns;
  const minGapPct = clean ? 10 : 5;

  // Place the main mark first, then the rest outermost-first, keeping each
  // only if it clears every already-placed mark.
  const candidates = [
    ...marks.filter((mk) => mk.main),
    ...marks.filter((mk) => !mk.main).sort((a, b) => b.pct - a.pct),
  ].filter((mk) => mk.pct > 0);
  const visible: TierMark[] = [];
  for (const mk of candidates) {
    if (visible.every((v) => Math.abs(v.pct - mk.pct) > minGapPct)) visible.push(mk);
  }

  return (
    <>
      {visible.map((mk) => (
        <span
          key={`${mk.pct}-${mk.label}`}
          style={
            clean
              ? {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${mk.pct}%`,
                  transform: "translateX(-100%)",
                  display: "flex",
                  alignItems: "center",
                  paddingRight: 5,
                  fontSize: 24,
                  fontWeight: 700,
                  color: mk.main ? "var(--text)" : "var(--muted)",
                  opacity: mk.main ? 0.55 : 0.4,
                  fontVariantNumeric: "tabular-nums",
                  pointerEvents: "none",
                }
              : {
                  position: "absolute",
                  bottom: 1,
                  left: `${mk.pct}%`,
                  transform: "translateX(-100%)",
                  paddingRight: 3,
                  fontSize: 8.5,
                  lineHeight: 1,
                  color: mk.main ? "var(--text)" : "var(--muted)",
                  opacity: mk.main ? 0.8 : 1,
                  fontVariantNumeric: "tabular-nums",
                  pointerEvents: "none",
                }
          }
        >
          {mk.label}
        </span>
      ))}
    </>
  );
}
