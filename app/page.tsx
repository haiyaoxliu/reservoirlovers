import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboard, getTimeline, formatDuration } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import { Timeline, type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session.athleteId) redirect("/login");

  const [leaderboard, timeline] = await Promise.all([getLeaderboard(), getTimeline()]);

  // Stable colour per member, by leaderboard order.
  const members: TimelineMember[] = leaderboard.map((r, i) => ({
    userId: r.userId,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {leaderboard.map((r, i) => (
            <div
              key={r.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--panel)",
                border: "1px solid #232a36",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <span style={{ width: 22, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </span>
              <span
                style={{ width: 12, height: 12, borderRadius: 6, background: colorFor(i), flexShrink: 0 }}
              />
              <Avatar url={r.avatarUrl} name={r.displayName} color={colorFor(i)} />
              <span style={{ flex: 1, fontWeight: 500 }}>{r.displayName}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 700 }}>
                  {r.loops}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {r.loops === 1 ? "loop" : "loops"}
                  {formatDuration(r.fastestSeconds) ? ` · PR ${formatDuration(r.fastestSeconds)}` : ""}
                </div>
              </div>
              {/* Relative bar */}
              <div style={{ width: 60, height: 6, background: "#232a36", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${topLoops > 0 ? (r.loops / topLoops) * 100 : 0}%`,
                    height: "100%",
                    background: colorFor(i),
                  }}
                />
              </div>
            </div>
          ))}
          {leaderboard.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No members yet.</p>
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
