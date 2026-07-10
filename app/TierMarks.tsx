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
 * numbers grow to full-height watermarks. Either way the same placement rule
 * applies — a number that would overlap another flips to the right side of
 * its boundary, and disappears if it doesn't fit there either — with the
 * growth ceiling (estimated text width) scaled to the font.
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  const { prefs } = useSettings();
  const clean = !prefs.statColumns;
  // Estimated text width as % of a ~350px bar (5px/char small, 13px large).
  const widthOf = (m: TierMark) => m.label.length * (clean ? 3.6 : 1.5) + 0.5;

  const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

  // Main first so it always gets its preferred spot, then the rest inward
  // from the right.
  const ordered = [
    ...marks.filter((mk) => mk.main),
    ...marks.filter((mk) => !mk.main).sort((a, b) => b.pct - a.pct),
  ].filter((mk) => mk.pct > 0);

  const placed: { mk: TierMark; left: boolean; span: [number, number] }[] = [];
  for (const mk of ordered) {
    const w = widthOf(mk);
    const right: [number, number] = [mk.pct - w, mk.pct];
    const flipped: [number, number] = [mk.pct, mk.pct + w];
    if (right[0] >= 0 && !placed.some((p) => overlaps(p.span, right))) {
      placed.push({ mk, left: false, span: right });
    } else if (flipped[1] <= 100 && !placed.some((p) => overlaps(p.span, flipped))) {
      placed.push({ mk, left: true, span: flipped });
    }
    // else: no room — the mark disappears
  }

  return (
    <>
      {placed.map(({ mk, left }) => (
        <span
          key={`${mk.pct}-${mk.label}`}
          style={{
            position: "absolute",
            left: `${mk.pct}%`,
            transform: left ? undefined : "translateX(-100%)",
            paddingRight: left ? 0 : clean ? 5 : 3,
            paddingLeft: left ? (clean ? 5 : 3) : 0,
            color: mk.main ? "var(--text)" : "var(--muted)",
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
            ...(clean
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
      ))}
    </>
  );
}
