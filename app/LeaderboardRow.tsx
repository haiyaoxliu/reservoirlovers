"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "./Settings";
import { TierMarks } from "./TierMarks";
import { initials } from "./Avatar";

/**
 * Member name that compresses to fit its space: full name → last name to its
 * leading letter → first name too → gone. All-caps initials outright when
 * the rank & avatars chrome is hidden.
 */
export function MemberName({ name, dimmed = false }: { name: string; dimmed?: boolean }) {
  const { prefs } = useSettings();
  const ref = useRef<HTMLSpanElement>(null);
  const [level, setLevel] = useState(0);

  const options = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    return last
      ? [name, `${first} ${last[0]}`, `${first[0]} ${last[0]}`, ""]
      : [name, first[0] ?? "", ""];
  }, [name]);

  // Re-run the fit cascade whenever the allocated width changes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLevel(0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Step down one compression level per render until the text fits. The
  // span's width comes from flex, not content, so this converges.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollWidth > el.clientWidth && level < options.length - 1) {
      setLevel(level + 1);
    }
  });

  return (
    <span
      ref={ref}
      className="lb-name"
      style={{
        flex: 1,
        fontWeight: 500,
        minWidth: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textTransform: prefs.rowChrome ? undefined : "uppercase",
        color: dimmed ? "var(--muted)" : undefined,
      }}
    >
      {prefs.rowChrome ? options[Math.min(level, options.length - 1)] : initials(name)}
    </span>
  );
}

/**
 * A leaderboard stripe whose background is the three-tier relative bar,
 * starting at the row's left edge with true proportions.
 */
export function LeaderboardRow({
  color,
  maxTotal,
  exactFullPercent,
  toleranceFullPercent,
  totalPercent,
  loops,
  children,
}: {
  color: string;
  maxTotal: number;
  exactFullPercent: number;
  toleranceFullPercent: number;
  totalPercent: number;
  loops: number;
  children: React.ReactNode;
}) {
  const pctOf = (v: number) => (maxTotal > 0 ? (v / maxTotal) * 100 : 0);
  const exactPct = pctOf(exactFullPercent);
  const fullPct = pctOf(exactFullPercent + toleranceFullPercent);
  const totalPct = pctOf(totalPercent);
  const fmtLoops = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  const fullSum = exactFullPercent + toleranceFullPercent;
  const marks = [
    ...(exactFullPercent > 0 ? [{ pct: exactPct, label: fmtLoops(exactFullPercent / 100) }] : []),
    { pct: fullPct, label: String(loops), main: true },
    // Omitted only when it would just duplicate the main count.
    ...(totalPercent > fullSum
      ? [{ pct: totalPct, label: fmtLoops(totalPercent / 100) }]
      : []),
  ];

  return (
    <div
      className="lb-row"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        backgroundColor: "var(--panel)",
        backgroundImage: `linear-gradient(90deg, ${color}66 ${exactPct}%, ${color}59 ${exactPct}%, ${color}59 ${fullPct}%, ${color}2e ${fullPct}%, ${color}2e ${totalPct}%, transparent ${totalPct}%)`,
        borderTop: "1px solid var(--border)",
        padding: "8px 16px",
      }}
    >
      <TierMarks marks={marks} />
      {children}
    </div>
  );
}
