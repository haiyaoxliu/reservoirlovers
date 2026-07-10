import { ConnectButton } from "../../ConnectButton";
import { getValidInvite } from "@/lib/invite";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getValidInvite(code);

  return (
    <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>🏃 Reservoir Lovers</h1>
      {invite ? (
        <>
          {invite.note ? (
            <p style={{ fontSize: 18, margin: "0 auto 4px" }}>
              This one&apos;s for you, <strong>{invite.note}</strong>.
            </p>
          ) : null}
          <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 28px" }}>
            You&apos;re invited! Connect your Strava to join the club leaderboard.
          </p>
          <ConnectButton
            label="Join with Strava"
            href={`/api/auth/strava?invite=${encodeURIComponent(code)}`}
          />
        </>
      ) : (
        <p style={{ color: "#ff6b6b", marginTop: 20 }}>
          This invite link is invalid or has already been used. Ask the club for a fresh one.
        </p>
      )}
    </div>
  );
}
