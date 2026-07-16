"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** "New invite" button, disabled once members + open invites hit the Strava
 *  cap. The backend enforces the same limit; this just keeps the admin from
 *  clicking into an error. */
export function NewInvite({
  committedSlots,
  maxSlots,
  create,
}: {
  committedSlots: number;
  maxSlots: number;
  create: () => Promise<string | null>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const atCap = committedSlots >= maxSlots;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <button
        type="button"
        disabled={pending || atCap}
        onClick={() =>
          startTransition(async () => {
            setError(await create());
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
          cursor: pending || atCap ? "default" : "pointer",
          opacity: pending || atCap ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {pending ? "Creating…" : "New invite"}
      </button>
      <span style={{ fontSize: 13, color: atCap || error ? "#ff6b6b" : "var(--muted)" }}>
        {error ?? `${committedSlots}/${maxSlots} slots committed — members plus open invites.`}
      </span>
    </div>
  );
}
