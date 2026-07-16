"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Member self-service backfill, capped to once a day. The button disables until
 *  the cooldown elapses; the server action re-checks and is the real limit (this
 *  is just so an honest click isn't wasted). */
export function SelfBackfill({
  lastBackfillAt,
  run,
}: {
  /** ISO timestamp of the member's last backfill, or null. */
  lastBackfillAt: string | null;
  run: () => Promise<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const last = lastBackfillAt ? new Date(lastBackfillAt).getTime() : 0;
  const readyAt = last + COOLDOWN_MS;
  const onCooldown = Date.now() < readyAt;
  const hoursLeft = Math.ceil((readyAt - Date.now()) / (60 * 60 * 1000));
  const disabled = pending || onCooldown;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          startTransition(async () => {
            setResult(await run());
            router.refresh();
          })
        }
        style={{
          background: "var(--accent)",
          color: "#04121f",
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {pending ? "Running…" : "Backfill my history"}
      </button>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>
        {pending
          ? "Re-pulling your Strava runs — this can take a while…"
          : result ??
            (onCooldown
              ? `Already run today — available again in ~${hoursLeft}h.`
              : "Re-scan your full Strava history for missed loops. Once a day.")}
      </span>
    </div>
  );
}
