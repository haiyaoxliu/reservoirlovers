"use client";

import { useSettings } from "./Settings";

export interface TierMark {
  /** Boundary position as a percentage of the bar width. */
  pct: number;
  /** Cumulative loop count at this boundary. */
  label: string;
  /** The headline number (full + tolerance loops) — brighter, placed first. */
  main?: boolean;
}

/**
 * Loop counts anchored to their bar segment's boundary. With the stat
 * columns shown they're small bottom-right corner text; with them hidden the
 * numbers grow to full-height watermarks. All marks always render, laid out
 * strictly left-to-right in tier order: each prefers right-alignment at its
 * boundary, and otherwise slides right just past the previous number
 * (dropping to the small size, then clamping, when space runs out).
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  const { prefs } = useSettings();
  const clean = !prefs.statColumns;
  // Estimated text width as % of a ~350px bar (5px/char small, 13px large).
  const smallWidthOf = (m: TierMark) => m.label.length * 1.5 + 0.5;
  const widthOf = (m: TierMark) => m.label.length * (clean ? 3.6 : 1.5) + 0.5;

  const ordered = [...marks].filter((mk) => mk.pct > 0).sort((a, b) => a.pct - b.pct);

  const placed: { mk: TierMark; x: number; left: boolean; small: boolean }[] = [];
  let prevEnd = 0;
  for (const mk of ordered) {
    let w = widthOf(mk);
    if (mk.pct - w >= prevEnd) {
      placed.push({ mk, x: mk.pct, left: false, small: false });
      prevEnd = mk.pct;
      continue;
    }
    // Slide right just past the previous number, shrinking then clamping if
    // the bar's edge is in the way.
    let small = false;
    let x = Math.max(prevEnd, mk.pct);
    if (x + w > 100) {
      small = true;
      w = smallWidthOf(mk);
      x = Math.min(Math.max(prevEnd, mk.pct), 100 - w);
    }
    placed.push({ mk, x, left: true, small });
    prevEnd = x + w;
  }

  return (
    <>
      {placed.map(({ mk, x, left, small }) => {
        const big = clean && !small;
        return (
          <span
            key={`${mk.pct}-${mk.label}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              transform: left ? undefined : "translateX(-100%)",
              paddingRight: left ? 0 : big ? 5 : 3,
              paddingLeft: left ? (big ? 5 : 3) : 0,
              color: mk.main ? "var(--text)" : "var(--muted)",
              fontVariantNumeric: "tabular-nums",
              pointerEvents: "none",
              ...(big
                ? {
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    fontSize: 24,
                    fontWeight: 700,
                    opacity: mk.main ? 0.55 : 0.4,
                  }
                : {
                    bottom: 1,
                    fontSize: 8.5,
                    lineHeight: 1,
                    opacity: mk.main ? 0.8 : 1,
                  }),
            }}
          >
            {mk.label}
          </span>
        );
      })}
    </>
  );
}
