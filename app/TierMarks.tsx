"use client";

import { useSettings } from "./Settings";

export interface TierMark {
  /** Boundary position as a percentage of the bar width. */
  pct: number;
  /** Cumulative loop count at this boundary. */
  label: string;
}

/**
 * Loop counts at the leaderboard bar's tier boundaries. Small corner text in
 * detail mode; large full-height watermark numbers in clean mode (where the
 * column headers are hidden). Marks too close to the next one are dropped.
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  const { display } = useSettings();
  const clean = display === "clean";
  const minGapPct = clean ? 10 : 5;
  const visible = marks.filter(
    (mk, idx, arr) => mk.pct > 0 && (idx === arr.length - 1 || arr[idx + 1].pct - mk.pct > minGapPct),
  );
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
                  color: "var(--muted)",
                  opacity: 0.4,
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
                  color: "var(--muted)",
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
