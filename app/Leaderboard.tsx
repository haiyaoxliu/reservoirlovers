"use client";

import { useMemo } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";
import type { TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import {
  DetailOnly,
  Distance,
  DistanceUnit,
  HeaderTabs,
  RANGE_MS,
  useSettings,
} from "./Settings";
import { LeaderboardRow, MemberName } from "./LeaderboardRow";
import canonicalJson from "@/loop/canonical-loop.json";

/** Credited loop travel (percent units) as kilometres. */
function kmOf(totalPercent: number): number {
  return (totalPercent / 100) * (canonicalJson.totalMeters / 1000);
}

/** ISO timestamp → yyyy/mm/dd in the viewer's local zone. */
function fmtYmd(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

/**
 * The leaderboard, aggregated client-side from the raw events so the range
 * setting (past week / month / year / all time) applies instantly. Member
 * colours stay stable (assigned from the all-time server order) even when a
 * shorter range reshuffles the ranking.
 */
export function Leaderboard({
  members,
  events,
}: {
  members: TimelineMember[];
  events: TimelineEvent[];
}) {
  const { range, setRange } = useSettings();

  const rows = useMemo(() => {
    const span = RANGE_MS[range];
    const cutoff = span == null ? null : Date.now() - span;
    const agg = new Map(
      members.map((m) => [
        m.userId,
        { loops: 0, exact: 0, tolerance: 0, total: 0, fastest: null as number | null },
      ]),
    );
    for (const e of events) {
      if (cutoff != null && new Date(e.eventTime).getTime() < cutoff) continue;
      const a = agg.get(e.userId);
      if (!a) continue;
      a.total += e.percent;
      if (e.kind === "full") {
        a.loops += 1;
        if (e.percent >= 100) a.exact += e.percent;
        else a.tolerance += e.percent;
        if (e.durationSeconds != null && (a.fastest == null || e.durationSeconds < a.fastest)) {
          a.fastest = e.durationSeconds;
        }
      }
    }
    return members
      .map((m) => ({ m, ...agg.get(m.userId)! }))
      .sort((a, b) => b.loops - a.loops || b.total - a.total);
  }, [members, events, range]);

  // Bars scale to the largest total score in the selected range.
  const maxTotal = Math.max(0, ...rows.map((r) => r.total));

  return (
    <section style={{ marginBottom: 32 }}>
      <div className="bleed" style={{ borderBottom: "1px solid var(--border)" }}>
        <DetailOnly pref="headers">
          <h2
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              background: "var(--panel)",
              borderTop: "1px solid var(--border)",
              padding: 0,
              display: "flex",
              alignItems: "stretch",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "stretch" }}>
              <span style={{ display: "flex", alignItems: "center", padding: "6px 12px 6px 16px" }}>
                Leaderboard
              </span>
              {/* Range tabs: scores cover the past week / month / year / all */}
              <HeaderTabs
                value={range}
                options={[
                  { v: "week", label: "W" },
                  { v: "month", label: "M" },
                  { v: "year", label: "Y" },
                  { v: "all", label: "All" },
                ]}
                onChange={setRange}
              />
            </span>
            {/* Column headers, matching the row column widths below; they
                hide together with the stat columns. */}
            <DetailOnly pref="statColumns">
              <span
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  alignSelf: "center",
                  paddingRight: 16,
                }}
              >
                <span style={{ width: 66, textAlign: "right" }}>PR</span>
                <span style={{ width: 62, textAlign: "right" }}>
                  <DistanceUnit />
                </span>
                <span style={{ width: 40, textAlign: "right" }}>#</span>
              </span>
            </DetailOnly>
          </h2>
        </DetailOnly>
        {rows.map(({ m, loops, exact, tolerance, total, fastest }, i) => (
          <LeaderboardRow
            // Range in the key remounts rows on timeframe switch so no
            // stale marks or name-fit state carries over.
            key={`${range}:${m.userId}`}
            color={m.color}
            maxTotal={maxTotal}
            exactFullPercent={exact}
            toleranceFullPercent={tolerance}
            totalPercent={total}
            loops={loops}
          >
            <DetailOnly pref="rowChrome">
              <span style={{ width: 18, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </span>
              <Avatar url={m.avatarUrl} name={m.displayName} color={m.color} />
            </DetailOnly>
            <MemberName name={m.displayName} dimmed={Boolean(m.deauthorizedAt)} />
            {/* Disconnected members keep their history but are frozen: greyed
                name plus the date their Strava was unlinked. */}
            {m.deauthorizedAt ? (
              <span
                title={`Strava disconnected — last update ${fmtYmd(m.deauthorizedAt)}`}
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtYmd(m.deauthorizedAt)}
              </span>
            ) : null}
            {/* Fixed-width right-aligned columns so PR / km / loops line up
                vertically across rows; hidden with the headers' labels. */}
            <DetailOnly pref="statColumns">
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span
                  style={{
                    width: 66,
                    textAlign: "right",
                    fontSize: 11,
                    color: "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDuration(fastest) ?? ""}
                </span>
                <span
                  style={{
                    width: 62,
                    textAlign: "right",
                    fontSize: 11,
                    color: "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {total > 0 ? <Distance km={kmOf(total)} bare /> : ""}
                </span>
                <span
                  style={{
                    width: 40,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {loops}
                </span>
              </div>
            </DetailOnly>
          </LeaderboardRow>
        ))}
        {rows.length === 0 ? (
          <p style={{ color: "var(--muted)", padding: "0 16px" }}>No members yet.</p>
        ) : null}
      </div>
    </section>
  );
}
