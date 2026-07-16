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

/** Passkey step-up shown when the admin is Strava-authenticated but hasn't
 *  presented a passkey recently. No admin data is rendered until this succeeds.
 */
export function PasskeyGate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/admin/passkey/auth/options", { method: "POST" });
      if (!optRes.ok) throw new Error("start");
      const optionsJSON = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON });
      const verifyRes = await fetch("/api/admin/passkey/auth/verify", {
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

  return (
    <div className="container">
      <div style={cardStyle}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Admin verification</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 auto 20px", maxWidth: 320 }}>
          Confirm it's you with your passkey to open the admin tools.
        </p>
        <button type="button" onClick={verify} disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Waiting for passkey…" : "Verify with passkey"}
        </button>
        {error ? <p style={{ color: "#ff6b6b", marginTop: 16, fontSize: 13 }}>{error}</p> : null}
      </div>
    </div>
  );
}
