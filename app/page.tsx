import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboard, getTimeline, formatDuration } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import { Timeline, type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { ExternalLinkIcon } from "./ExternalLinkIcon";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session.athleteId) redirect("/login");

  const [leaderboard, timeline] = await Promise.all([getLeaderboard(), getTimeline()]);

  // Stable colour per member, by leaderboard order.
  const members: TimelineMember[] = leaderboard.map((r, i) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    color: colorFor(i),
  }));

  const topLoops = leaderboard[0]?.loops ?? 0;

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
        <h2 style={{ fontSize: 15, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
          Leaderboard
        </h2>
        <div className="bleed" style={{ marginTop: 12, borderBottom: "1px solid #232a36" }}>
          {leaderboard.map((r, i) => {
            // The stripe doubles as the relative bar: its background fills
            // with the member's colour up to loops/topLoops.
            const pct = topLoops > 0 ? (r.loops / topLoops) * 100 : 0;
            return (
              <div
                key={r.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "var(--panel)",
                  backgroundImage: `linear-gradient(90deg, ${colorFor(i)}33 ${pct}%, transparent ${pct}%)`,
                  borderTop: "1px solid #232a36",
                  padding: "8px 16px",
                }}
              >
                <span style={{ width: 18, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                  {i + 1}
                </span>
                <Avatar url={r.avatarUrl} name={r.displayName} color={colorFor(i)} />
                <a
                  href={`https://www.strava.com/athletes/${r.stravaAthleteId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "inherit",
                    fontWeight: 500,
                  }}
                >
                  {/* Name shrinks/truncates; the icon stays pinned at the end
                      of the column so it lines up across rows. */}
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.displayName}
                  </span>
                  <ExternalLinkIcon />
                </a>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 700 }}>
                    {r.loops}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {r.loops === 1 ? "loop" : "loops"}
                    {formatDuration(r.fastestSeconds) ? ` · PR ${formatDuration(r.fastestSeconds)}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {leaderboard.length === 0 ? (
            <p style={{ color: "var(--muted)", padding: "0 16px" }}>No members yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 15, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Timeline
        </h2>
        <Timeline events={timeline} members={members} />
      </section>
    </div>
  );
}
