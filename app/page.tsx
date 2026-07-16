import { redirect } from "next/navigation";
import { getSession, isActiveViewer, isFreshPasskey } from "@/lib/session";
import { getLeaderboardBuckets, getTimeline } from "@/lib/queries";
import { listCredentials } from "@/lib/passkey";
import { colorFor } from "@/lib/colors";
import { type TimelineMember } from "./Timeline";
import { Board } from "./Board";
import { Leaderboard } from "./Leaderboard";
import { LockedBoard } from "./LockedBoard";
import { PasskeyEnroll } from "./PasskeyEnroll";
import { PasskeyGate } from "./PasskeyGate";
import { demoBoardData } from "./demoData";
import { HeaderActions } from "./Settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  // Three tiers: connected members, view-only visitors (redeemed a visitor
  // invite), and everyone else (bounced to /login). Members additionally need a
  // fresh passkey before any non-leaderboard data is loaded.
  const isMember = Boolean(session.athleteId);
  if (!isMember && !isActiveViewer(session)) redirect("/login");
  const verified = isMember && isFreshPasskey(session);

  // Leaderboard is aggregated server-side (per range), so the gated tier never
  // receives the raw event stream. Only a verified member's board loads events.
  const [buckets, timeline] = await Promise.all([
    getLeaderboardBuckets(),
    verified ? getTimeline() : Promise.resolve(null),
  ]);
  const leaderboard = buckets.all;

  // Stable colour per member, by all-time leaderboard order — range-filtered
  // reshuffles on the client never change anyone's colour.
  const members: TimelineMember[] = leaderboard.map((r, i) => ({
    userId: r.userId,
    stravaAthleteId: r.stravaAthleteId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    color: colorFor(i),
    deauthorizedAt: r.deauthorizedAt,
  }));

  const me = leaderboard.find((r) => r.stravaAthleteId === session.athleteId);

  // A member who isn't passkey-verified sees the leaderboard but the board slot
  // asks for their passkey — register the first one (bootstrap) or verify an
  // existing one. Deciding needs their credential count, not the event stream.
  let memberGate: "enroll" | "verify" | null = null;
  if (isMember && !verified) {
    const creds = await listCredentials(session.userId ?? me?.userId ?? -1);
    memberGate = creds.length === 0 ? "enroll" : "verify";
  }

  return (
    <div className="container">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 26, margin: "8px 0 20px" }}>Reservoir Lovers</h1>
        <HeaderActions isMember={isMember} isAdmin={me?.isAdmin ?? false} />
      </header>

      <Leaderboard members={members} buckets={buckets} />

      {verified && timeline ? (
        <Board events={timeline} members={members} currentUserId={me?.userId ?? null} />
      ) : memberGate ? (
        // Member without a fresh passkey: unlock prompt in the board slot; the
        // timeline/map are never fetched until it succeeds.
        <div style={{ margin: "24px 0" }}>
          {memberGate === "enroll" ? (
            <PasskeyEnroll
              bootstrap
              inline
              title="Unlock the full board"
              description="Register a passkey (Touch ID, Face ID, or a security key) to see the timeline and map. You'll confirm it on each visit."
            />
          ) : (
            <PasskeyGate
              inline
              title="Unlock the full board"
              description="Confirm it's you with your passkey to load the timeline and map."
            />
          )}
        </div>
      ) : (
        // Visitors get a teaser: the same board, but blurred fake data under a
        // lock overlay — real timeline/map detail stays member-only.
        <LockedBoard {...demoBoardData(Date.now())} />
      )}
    </div>
  );
}
