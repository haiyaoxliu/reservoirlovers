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
 * A leaderboard stripe whose background is the three-tier relative bar. The
 * bar starts with a pad in the full-loop colour sized to what sits on it —
 * wide for full names, narrow for initials — with a thin marker where the
 * pad ends and real data begins.
 */
export function LeaderboardRow({
  color,
  maxTotal,
  exactFullPercent,
  toleranceFullPercent,
  totalPercent,
  loops,
  stats,
  children,
}: {
  color: string;
  maxTotal: number;
  exactFullPercent: number;
  toleranceFullPercent: number;
  totalPercent: number;
  loops: number;
  /** Stat columns, rendered in their own section right of the bar so the
   *  bar colouring never runs under them. */
  stats?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { prefs } = useSettings();
  const pad = prefs.rowChrome ? 28 : 12;
  const pctOf = (v: number) => pad + (maxTotal > 0 ? (v / maxTotal) * (100 - pad) : 0);
  const exactPct = pctOf(exactFullPercent);
  const fullPct = pctOf(exactFullPercent + toleranceFullPercent);
  const totalPct = pctOf(totalPercent);
  const fmtLoops = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  const fullSum = exactFullPercent + toleranceFullPercent;
  const marks = [
    ...(exactFullPercent > 0 ? [{ pct: exactPct, label: fmtLoops(exactFullPercent / 100) }] : []),
    { pct: fullPct, label: String(loops), main: true },
    // The grand total renders in every view; only omitted when it would just
    // duplicate the main count (no partial credit at all).
    ...(totalPercent > fullSum
      ? [{ pct: totalPct, label: fmtLoops(totalPercent / 100), always: true }]
      : []),
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "var(--panel)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        className="lb-row"
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          // The pad renders brighter than the exact-full tier so where real
          // data begins stays visible.
          backgroundImage: `linear-gradient(90deg, ${color}8c ${pad}%, ${color}66 ${pad}%, ${color}66 ${exactPct}%, ${color}59 ${exactPct}%, ${color}59 ${fullPct}%, ${color}2e ${fullPct}%, ${color}2e ${totalPct}%, transparent ${totalPct}%)`,
          padding: "8px 8px 8px 16px",
        }}
      >
        <TierMarks marks={marks} />
        {children}
      </div>
      {stats}
    </div>
  );
}
