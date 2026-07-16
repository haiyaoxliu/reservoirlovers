"use client";

import { useMemo } from "react";
import type { LeaderboardBuckets } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";
import type { TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { DetailOnly, Distance, DistanceUnit, HeaderTabs, useSettings } from "./Settings";
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
 * The leaderboard. Rankings are precomputed server-side per range (see
 * getLeaderboardBuckets) so no raw event stream reaches the browser; switching
 * range just picks a bucket, still instant. Member colours stay stable
 * (assigned from the all-time server order) even when a shorter range reshuffles
 * the ranking.
 */
export function Leaderboard({
  members,
  buckets,
}: {
  members: TimelineMember[];
  buckets: LeaderboardBuckets;
}) {
  const { range, setRange } = useSettings();

  const colorByUser = useMemo(
    () => new Map(members.map((m) => [m.userId, m.color])),
    [members],
  );

  const rows = useMemo(
    () =>
      buckets[range].map((r) => ({
        userId: r.userId,
        color: colorByUser.get(r.userId) ?? "var(--muted)",
        avatarUrl: r.avatarUrl,
        displayName: r.displayName,
        deauthorizedAt: r.deauthorizedAt,
        loops: r.loops,
        exact: r.exactFullPercent,
        tolerance: r.toleranceFullPercent,
        total: r.totalPercent,
        fastest: r.fastestSeconds,
      })),
    [buckets, range, colorByUser],
  );

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
        {rows.map((r, i) => (
          <LeaderboardRow
            // Range in the key remounts rows on timeframe switch so no
            // stale marks or name-fit state carries over.
            key={`${range}:${r.userId}`}
            color={r.color}
            maxTotal={maxTotal}
            exactFullPercent={r.exact}
            toleranceFullPercent={r.tolerance}
            totalPercent={r.total}
            loops={r.loops}
          >
            <DetailOnly pref="rowChrome">
              <span style={{ width: 18, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </span>
              <Avatar url={r.avatarUrl} name={r.displayName} color={r.color} />
            </DetailOnly>
            <MemberName name={r.displayName} dimmed={Boolean(r.deauthorizedAt)} />
            {/* Disconnected members keep their history but are frozen: greyed
                name plus the date their Strava was unlinked. */}
            {r.deauthorizedAt ? (
              <span
                title={`Strava disconnected — last update ${fmtYmd(r.deauthorizedAt)}`}
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtYmd(r.deauthorizedAt)}
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
                  {formatDuration(r.fastest) ?? ""}
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
                  {r.total > 0 ? <Distance km={kmOf(r.total)} bare /> : ""}
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
                  {r.loops}
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
