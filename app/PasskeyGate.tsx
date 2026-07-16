"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

const cardStyle: React.CSSProperties = {
  maxWidth: 420,
  margin: "80px auto 0",
  textAlign: "center",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "28px 24px",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "#04121f",
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  cursor: "pointer",
};

/** Passkey step-up shown when a member is Strava-authenticated but hasn't
 *  presented a passkey recently. No gated data is rendered until this succeeds.
 *  `title`/`description` let it front the admin site, /account, or the board. */
export function PasskeyGate({
  title = "Admin verification",
  description = "Confirm it's you with your passkey to open the admin tools.",
  inline = false,
}: {
  title?: string;
  description?: string;
  /** Embed the card without the full-page `.container` wrapper (e.g. in the
   *  home board slot, already inside a container). */
  inline?: boolean;
} = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/passkey/auth/options", { method: "POST" });
      if (!optRes.ok) throw new Error("start");
      const optionsJSON = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON });
      const verifyRes = await fetch("/api/passkey/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) throw new Error("verify");
      router.refresh();
    } catch {
      setError("Passkey verification didn't complete. Try again.");
      setBusy(false);
    }
  }

  const card = (
    <div style={inline ? { ...cardStyle, margin: "0 auto" } : cardStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{title}</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 auto 20px", maxWidth: 320 }}>
        {description}
      </p>
      <button type="button" onClick={verify} disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
        {busy ? "Waiting for passkey…" : "Verify with passkey"}
      </button>
      {error ? <p style={{ color: "#ff6b6b", marginTop: 16, fontSize: 13 }}>{error}</p> : null}
    </div>
  );
  return inline ? card : <div className="container">{card}</div>;
}
