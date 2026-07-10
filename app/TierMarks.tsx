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
 * its boundary, and if it still doesn't fit it keeps sliding right (dropping
 * to the small size when even that fails) until it does.
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  const { prefs } = useSettings();
  const clean = !prefs.statColumns;
  // Estimated text width as % of a ~350px bar (5px/char small, 13px large).
  const smallWidthOf = (m: TierMark) => m.label.length * 1.5 + 0.5;
  const widthOf = (m: TierMark) => m.label.length * (clean ? 3.6 : 1.5) + 0.5;

  const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

  // Main first so it always gets its preferred spot, then the rest inward
  // from the right.
  const ordered = [
    ...marks.filter((mk) => mk.main),
    ...marks.filter((mk) => !mk.main).sort((a, b) => b.pct - a.pct),
  ].filter((mk) => mk.pct > 0);

  const placed: { mk: TierMark; x: number; left: boolean; small: boolean; span: [number, number] }[] =
    [];
  // Smallest x >= from where [x, x+w] clears every placed span and the edge.
  const slideRight = (from: number, w: number): number | null => {
    let x = from;
    for (let guard = 0; guard <= placed.length; guard++) {
      const hit = placed.find((p) => overlaps(p.span, [x, x + w]));
      if (!hit) break;
      x = hit.span[1];
    }
    return x + w <= 100 ? x : null;
  };
  for (const mk of ordered) {
    const w = widthOf(mk);
    const right: [number, number] = [mk.pct - w, mk.pct];
    if (right[0] >= 0 && !placed.some((p) => overlaps(p.span, right))) {
      placed.push({ mk, x: mk.pct, left: false, small: false, span: right });
      continue;
    }
    // Flip to the right of the boundary, sliding further right as needed.
    const slid = slideRight(mk.pct, w);
    if (slid != null) {
      placed.push({ mk, x: slid, left: true, small: false, span: [slid, slid + w] });
      continue;
    }
    // Last resort: small size, slid right until it fits.
    const sw = smallWidthOf(mk);
    const slidSmall = slideRight(mk.pct, sw) ?? 100 - sw;
    placed.push({ mk, x: slidSmall, left: true, small: true, span: [slidSmall, slidSmall + sw] });
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
