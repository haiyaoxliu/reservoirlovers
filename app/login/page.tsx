import { ConnectButton } from "../ConnectButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>Reservoir Lovers</h1>
      <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 28px" }}>
        Loop-counting for the run club, around the Central Park Reservoir.
      </p>
      {error ? (
        <p style={{ color: "#ff6b6b", marginBottom: 20 }}>{error}</p>
      ) : null}
      <ConnectButton />
      <p style={{ color: "var(--muted)", marginTop: 28, fontSize: 14 }}>
        Already a member? Just reconnect above. New here, or just watching? Ask the club for an
        invite link.
      </p>
    </div>
  );
}
