import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboard, getTimeline, formatDuration } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import { type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { Board } from "./Board";
import canonicalJson from "@/loop/canonical-loop.json";

export const dynamic = "force-dynamic";

/** Credited loop travel (full + partial percents) as kilometres. */
function formatKm(totalPercent: number): string {
  const km = (totalPercent / 100) * (canonicalJson.totalMeters / 1000);
  return `${km.toFixed(1)} km`;
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
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            style={{
              background: "transparent",
              color: "var(--muted)",
              border: "1px solid #333c4a",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <section style={{ marginBottom: 32 }}>
        <div className="bleed" style={{ borderBottom: "1px solid #232a36" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              background: "var(--panel)",
              borderTop: "1px solid #232a36",
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
                  borderTop: "1px solid #232a36",
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
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  {formatDuration(r.fastestSeconds) ? (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      PR {formatDuration(r.fastestSeconds)} ·
                    </span>
                  ) : null}
                  {r.totalPercent > 0 ? (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {formatKm(r.totalPercent)} ·
                    </span>
                  ) : null}
                  <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 700 }}>
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

      <Board events={timeline} members={members} />
    </div>
  );
}
