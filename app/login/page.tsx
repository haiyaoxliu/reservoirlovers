import { ConnectButton } from "../ConnectButton";
import { env } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const viewerEnabled = Boolean(env.viewerPassword);
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
        Already a member? Just reconnect above. New here? Ask for an invite link.
      </p>

      {viewerEnabled ? (
        <>
          <p style={{ color: "var(--muted)", margin: "32px 0 12px", fontSize: 13 }}>
            — or just watching? —
          </p>
          <form
            action="/api/auth/viewer"
            method="post"
            style={{ display: "flex", gap: 8, justifyContent: "center" }}
          >
            <input
              type="password"
              name="password"
              required
              placeholder="Viewer password"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                padding: "8px 12px",
                width: 180,
              }}
            />
            <button
              type="submit"
              style={{
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid var(--border-btn)",
                borderRadius: 8,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              View only
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
