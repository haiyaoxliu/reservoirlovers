import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboard, getTimeline, formatDuration } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import { type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { Board } from "./Board";
import { DetailOnly, Distance, DistanceUnit, HeaderActions } from "./Settings";
import { TierMarks } from "./TierMarks";
import canonicalJson from "@/loop/canonical-loop.json";

export const dynamic = "force-dynamic";

/** Credited loop travel (full + partial percents) as kilometres. */
function kmOf(totalPercent: number): number {
  return (totalPercent / 100) * (canonicalJson.totalMeters / 1000);
}

export default async function HomePage() {
  const session = await getSession();
  if (!session.athleteId) redirect("/login");

  const [leaderboard, timeline] = await Promise.all([getLeaderboard(), getTimeline()]);

  // Stable colour per member, by leaderboard order.
  const members: TimelineMember[] = leaderboard.map((r, i) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    color: colorFor(i),
  }));

  // Bars are scaled to the largest *total* score (full + partial credit),
  // which can belong to someone other than the loop leader.
  const maxTotal = Math.max(0, ...leaderboard.map((r) => r.totalPercent));

  return (
    <div className="container">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 26, margin: "8px 0 20px" }}>🏃 Reservoir Lovers</h1>
        <HeaderActions />
      </header>

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
              padding: "6px 16px",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span>Leaderboard</span>
            {/* Column headers, matching the row column widths below */}
            <span style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ width: 66, textAlign: "right" }}>PR</span>
              <span style={{ width: 62, textAlign: "right" }}>
                <DistanceUnit />
              </span>
              <span style={{ width: 40, textAlign: "right" }}>#</span>
            </span>
          </h2>
          </DetailOnly>
          {leaderboard.map((r, i) => {
            // The stripe doubles as the relative bar, in three opacity tiers:
            // clean 100% loops (brightest) → 98-99% tolerance fulls (slightly
            // dimmer) → partial credit (faint), out to the total score.
            // Every bar starts with a fixed pad of the full-loop colour wide
            // enough for the name (and rank, in detail view) to sit on; real
            // values scale into the remaining width.
            const BAR_PAD_PCT = 28;
            const pctOf = (v: number) =>
              BAR_PAD_PCT + (maxTotal > 0 ? (v / maxTotal) * (100 - BAR_PAD_PCT) : 0);
            const exactPct = pctOf(r.exactFullPercent);
            const fullPct = pctOf(r.exactFullPercent + r.toleranceFullPercent);
            const totalPct = pctOf(r.totalPercent);
            const c = colorFor(i);
            // Cumulative loop count at each tier boundary (TierMarks handles
            // overlap-dropping and sizing). The main count always shows.
            const fmtLoops = (v: number) => v.toFixed(1).replace(/\.0$/, "");
            const tierMarks = [
              ...(r.exactFullPercent > 0
                ? [{ pct: exactPct, label: fmtLoops(r.exactFullPercent / 100) }]
                : []),
              { pct: fullPct, label: String(r.loops), main: true },
              ...(r.totalPercent > 0
                ? [{ pct: totalPct, label: fmtLoops(r.totalPercent / 100) }]
                : []),
            ];
            return (
              <div
                key={r.userId}
                className="lb-row"
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "var(--panel)",
                  backgroundImage: `linear-gradient(90deg, ${c}66 ${exactPct}%, ${c}59 ${exactPct}%, ${c}59 ${fullPct}%, ${c}2e ${fullPct}%, ${c}2e ${totalPct}%, transparent ${totalPct}%)`,
                  borderTop: "1px solid var(--border)",
                  padding: "8px 16px",
                }}
              >
                <TierMarks marks={tierMarks} />
                <DetailOnly pref="rowChrome">
                  <span style={{ width: 18, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                    {i + 1}
                  </span>
                  <Avatar url={r.avatarUrl} name={r.displayName} color={colorFor(i)} />
                </DetailOnly>
                <span
                  className="lb-name"
                  style={{ flex: 1, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {r.displayName}
                </span>
                {/* Fixed-width right-aligned columns so PR / km / loops line
                    up vertically across rows; when hidden, the watermark tier
                    counts carry the numbers. */}
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
                    {formatDuration(r.fastestSeconds) ?? ""}
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
                    {r.totalPercent > 0 ? <Distance km={kmOf(r.totalPercent)} bare /> : ""}
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
              </div>
            );
          })}
          {leaderboard.length === 0 ? (
            <p style={{ color: "var(--muted)", padding: "0 16px" }}>No members yet.</p>
          ) : null}
        </div>
      </section>

      <Board
        events={timeline}
        members={members}
        currentUserId={
          leaderboard.find((r) => r.stravaAthleteId === session.athleteId)?.userId ?? null
        }
      />
    </div>
  );
}
