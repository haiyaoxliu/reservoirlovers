"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type PasskeyItem = { id: number; label: string; meta: string };

/** The admin's registered passkeys, each with a Remove control. Removal is only
 *  offered while more than one passkey exists — taking the last one would drop
 *  /admin back to first-time bootstrap enrollment, so we make the admin add a
 *  replacement first. The server action re-checks this. */
export function PasskeyList({
  passkeys,
  removePasskey,
}: {
  passkeys: PasskeyItem[];
  removePasskey: (id: number) => Promise<string>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const canRemove = passkeys.length > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
      {passkeys.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{p.label}</span>
          <span style={{ color: "var(--muted)", fontSize: 12, flexShrink: 0 }}>{p.meta}</span>
          {canRemove ? (
            <button
              type="button"
              onClick={() => {
                if (
                  !window.confirm(
                    `Remove "${p.label}"? You can no longer use it to open the admin ` +
                      `site. Make sure you still have another passkey to hand.`,
                  )
                ) {
                  return;
                }
                setPendingId(p.id);
                startTransition(async () => {
                  setResult(await removePasskey(p.id));
                  setPendingId(null);
                  router.refresh();
                });
              }}
              disabled={pendingId !== null}
              style={{
                background: "transparent",
                color: "#ff6b6b",
                fontWeight: 600,
                border: "1px solid var(--border-btn)",
                borderRadius: 8,
                padding: "5px 12px",
                fontSize: 12,
                cursor: pendingId !== null ? "default" : "pointer",
                opacity: pendingId !== null && pendingId !== p.id ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              {pendingId === p.id ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
      ))}
      {result ? (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>{result}</p>
      ) : null}
    </div>
  );
}
