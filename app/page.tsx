import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboard, getTimeline, formatDuration } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import { type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { Board } from "./Board";
import { Distance, HeaderActions } from "./Settings";
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
            <span>Loops</span>
          </h2>
          {leaderboard.map((r, i) => {
            // The stripe doubles as the relative bar: a brighter section for
            // full loops, continuing dimmer to the total score incl. partials.
            const fullPct = maxTotal > 0 ? ((r.loops * 100) / maxTotal) * 100 : 0;
            const totalPct = maxTotal > 0 ? (r.totalPercent / maxTotal) * 100 : 0;
            const c = colorFor(i);
            return (
              <div
                key={r.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "var(--panel)",
                  backgroundImage: `linear-gradient(90deg, ${c}66 ${fullPct}%, ${c}2e ${fullPct}%, ${c}2e ${totalPct}%, transparent ${totalPct}%)`,
                  borderTop: "1px solid var(--border)",
                  padding: "8px 16px",
                }}
              >
                <span style={{ width: 18, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                  {i + 1}
                </span>
                <Avatar url={r.avatarUrl} name={r.displayName} color={colorFor(i)} />
                <span style={{ flex: 1, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.displayName}
                </span>
                {/* Fixed-width right-aligned columns so PR / km / loops line
                    up vertically across rows. */}
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
                    {formatDuration(r.fastestSeconds) ? `PR ${formatDuration(r.fastestSeconds)}` : ""}
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
                    {r.totalPercent > 0 ? <Distance km={kmOf(r.totalPercent)} /> : ""}
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
