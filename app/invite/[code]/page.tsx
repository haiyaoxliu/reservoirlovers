import { ConnectButton } from "../../ConnectButton";
import { getValidInvite } from "@/lib/invite";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // Athlete-locking on member invites is enforced at redemption (the callback
  // knows the athlete); here we only surface open/used, so we don't reveal that
  // a code is bound to someone.
  const invite = await getValidInvite(code);
  const isVisitor = invite?.kind === "visitor";

  return (
    <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Reservoir Lovers</h1>
      {!invite ? (
        <p style={{ color: "#ff6b6b", marginTop: 20 }}>
          This invite link is invalid or has already been used. Ask the club for a fresh one.
        </p>
      ) : isVisitor ? (
        <>
          <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 28px" }}>
            You&apos;re invited to follow along. Open the club leaderboard — this link works once.
          </p>
          <form action="/api/auth/visitor" method="post">
            <input type="hidden" name="code" value={code} />
            <button
              type="submit"
              style={{
                background: "var(--accent)",
                color: "#04121f",
                fontWeight: 600,
                border: "none",
                borderRadius: 10,
                padding: "12px 20px",
                cursor: "pointer",
              }}
            >
              View the leaderboard
            </button>
          </form>
        </>
      ) : (
        <>
          <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 28px" }}>
            You&apos;re invited! Connect your Strava to join the club leaderboard.
          </p>
          <ConnectButton
            label="Join with Strava"
            href={`/api/auth/strava?invite=${encodeURIComponent(code)}`}
          />
        </>
      )}
    </div>
  );
}
