"use client";

export interface TierMark {
  /** Boundary position as a percentage of the bar width. */
  pct: number;
  /** Cumulative loop count at this boundary. */
  label: string;
  /** The headline number (full + tolerance loops) — brighter, placed first. */
  main?: boolean;
}

/**
 * Loop counts tucked into the bottom-right corner of their bar segment, in
 * every display mode. A number that would overlap another flips to the right
 * side of its boundary; if it doesn't fit there either, it disappears.
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  // Estimated text width as % of a ~350px bar (8.5px font ≈ 5px per char).
  const widthOf = (m: TierMark) => m.label.length * 1.5 + 0.5;

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
            bottom: 1,
            left: `${mk.pct}%`,
            transform: left ? undefined : "translateX(-100%)",
            paddingRight: left ? 0 : 3,
            paddingLeft: left ? 3 : 0,
            fontSize: 8.5,
            lineHeight: 1,
            color: mk.main ? "var(--text)" : "var(--muted)",
            opacity: mk.main ? 0.8 : 1,
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
          }}
        >
          {mk.label}
        </span>
      ))}
    </>
  );
}
