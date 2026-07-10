"use client";

import { useSettings } from "./Settings";
import { TierMarks } from "./TierMarks";
import { initials } from "./Avatar";

/** Full name normally; compressed to all-caps initials when the rank &
 *  avatars chrome is hidden. */
export function MemberName({ name }: { name: string }) {
  const { prefs } = useSettings();
  return (
    <span
      className="lb-name"
      style={{
        flex: 1,
        fontWeight: 500,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textTransform: prefs.rowChrome ? undefined : "uppercase",
      }}
    >
      {prefs.rowChrome ? name : initials(name)}
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
