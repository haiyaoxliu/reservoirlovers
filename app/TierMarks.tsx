"use client";

import { useSettings } from "./Settings";

export interface TierMark {
  /** Boundary position as a percentage of the bar width. */
  pct: number;
  /** Cumulative loop count at this boundary. */
  label: string;
  /** The headline number (full + tolerance loops) — brighter, never dropped. */
  main?: boolean;
  /** Never dropped either — falls back to alternate placements on collision. */
  always?: boolean;
}

type Placement = "right" | "left" | "top";

/**
 * Loop counts at the leaderboard bar's tier boundaries. Small corner text
 * when the stat columns are shown; large full-height watermark numbers when
 * they're hidden. The main mark always renders right-aligned; an `always`
 * mark that would overlap it moves just right of its boundary, or staggers
 * to the top corner when there's no room. Other marks drop on collision.
 */
export function TierMarks({ marks }: { marks: TierMark[] }) {
  const { prefs } = useSettings();
  const clean = !prefs.statColumns;

  // Marks are right-aligned at their boundary, so two marks only collide when
  // the right-hand one's own text would reach back over the left one. Text
  // width is estimated from label length (% of a ~400px bar).
  const charPct = clean ? 3.2 : 1.2;
  const widthOf = (m: TierMark) => m.label.length * charPct + 1;
  const collides = (a: TierMark, b: TierMark) => {
    const hi = a.pct >= b.pct ? a : b;
    return Math.abs(a.pct - b.pct) < widthOf(hi);
  };

  // Place the main mark first, then the rest outermost-first.
  const candidates = [
    ...marks.filter((mk) => mk.main),
    ...marks.filter((mk) => !mk.main).sort((a, b) => b.pct - a.pct),
  ].filter((mk) => mk.pct > 0);
  const visible: { mk: TierMark; placement: Placement }[] = [];
  for (const mk of candidates) {
    const clear = !visible.some((v) => v.placement === "right" && collides(v.mk, mk));
    if (clear) {
      visible.push({ mk, placement: "right" });
    } else if (mk.always) {
      // Keep it: just right of its boundary if it fits, else top corner.
      visible.push({
        mk,
        placement: mk.pct + widthOf(mk) <= 100 ? "left" : "top",
      });
    }
  }

  return (
    <>
      {visible.map(({ mk, placement }) => {
        const color = mk.main ? "var(--text)" : "var(--muted)";
        const base: React.CSSProperties = {
          position: "absolute",
          left: `${mk.pct}%`,
          color,
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
        };
        const style: React.CSSProperties = clean
          ? placement === "top"
            ? {
                ...base,
                top: 2,
                transform: "translateX(-100%)",
                paddingRight: 5,
                fontSize: 13,
                lineHeight: "15px",
                opacity: 0.5,
              }
            : {
                ...base,
                top: 0,
                bottom: 0,
                transform: placement === "left" ? undefined : "translateX(-100%)",
                display: "flex",
                alignItems: "center",
                paddingRight: placement === "left" ? 0 : 5,
                paddingLeft: placement === "left" ? 5 : 0,
                fontSize: 24,
                fontWeight: 700,
                opacity: mk.main ? 0.55 : 0.4,
              }
          : placement === "top"
            ? {
                ...base,
                top: 1,
                transform: "translateX(-100%)",
                paddingRight: 3,
                fontSize: 8.5,
                lineHeight: 1,
                opacity: mk.main ? 0.8 : 1,
              }
            : {
                ...base,
                bottom: 1,
                transform: placement === "left" ? undefined : "translateX(-100%)",
                paddingRight: placement === "left" ? 0 : 3,
                paddingLeft: placement === "left" ? 3 : 0,
                fontSize: 8.5,
                lineHeight: 1,
                opacity: mk.main ? 0.8 : 1,
              };
        return (
          <span key={`${mk.pct}-${mk.label}`} style={style}>
            {mk.label}
          </span>
        );
      })}
    </>
  );
}
