"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

const buttonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "#04121f",
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  cursor: "pointer",
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border-btn)",
  borderRadius: 8,
  color: "var(--text)",
  padding: "8px 12px",
  fontSize: 13,
  minWidth: 160,
};

/** Enroll a passkey. `bootstrap` renders a centered card for the first-time
 *  setup (no passkey yet); otherwise it's an inline "add another" control on
 *  the already-verified admin page. */
export function PasskeyEnroll({ bootstrap = false }: { bootstrap?: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/admin/passkey/register/options", { method: "POST" });
      if (!optRes.ok) throw new Error("start");
      const optionsJSON = await optRes.json();
      const attestation = await startRegistration({ optionsJSON });
      const verifyRes = await fetch("/api/admin/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation, label: label.trim() || undefined }),
      });
      if (!verifyRes.ok) throw new Error("verify");
      router.refresh();
    } catch {
      setError("Couldn't register the passkey. Try again.");
      setBusy(false);
    }
  }

  const controls = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={busy}
        placeholder="Label (e.g. MacBook)"
        style={inputStyle}
      />
      <button type="button" onClick={enroll} disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
        {busy ? "Waiting for passkey…" : bootstrap ? "Set up a passkey" : "Add another passkey"}
      </button>
    </div>
  );

  if (!bootstrap) {
    return (
      <div>
        {controls}
        {error ? <p style={{ color: "#ff6b6b", marginTop: 10, fontSize: 13 }}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="container">
      <div
        style={{
          maxWidth: 460,
          margin: "80px auto 0",
          textAlign: "center",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "28px 24px",
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Protect the admin site</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 auto 20px", maxWidth: 360 }}>
          Register a passkey (Touch ID, Face ID, or a security key). After this,
          the admin tools ask for it on every visit.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>{controls}</div>
        {error ? <p style={{ color: "#ff6b6b", marginTop: 16, fontSize: 13 }}>{error}</p> : null}
      </div>
    </div>
  );
}
