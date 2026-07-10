import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboard, getTimeline } from "@/lib/queries";
import { colorFor } from "@/lib/colors";
import { type TimelineMember } from "./Timeline";
import { Board } from "./Board";
import { Leaderboard } from "./Leaderboard";
import { HeaderActions } from "./Settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session.athleteId) redirect("/login");

  const [leaderboard, timeline] = await Promise.all([getLeaderboard(), getTimeline()]);

  // Stable colour per member, by all-time leaderboard order — range-filtered
  // reshuffles on the client never change anyone's colour.
  const members: TimelineMember[] = leaderboard.map((r, i) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    color: colorFor(i),
  }));

  return (
    <div className="container">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 26, margin: "8px 0 20px" }}>🏃 Reservoir Lovers</h1>
        <HeaderActions
          isAdmin={
            leaderboard.find((r) => r.stravaAthleteId === session.athleteId)?.isAdmin ?? false
          }
        />
      </header>

      <Leaderboard members={members} events={timeline} />

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
