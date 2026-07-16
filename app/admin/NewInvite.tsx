"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InviteKind } from "@/db/schema";

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  background: "var(--accent)",
  color: "#04121f",
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
  flexShrink: 0,
});

/** Create invites. Member invites take a Strava slot and are disabled once
 *  members + open member invites hit the cap (the backend enforces the same
 *  limit). Visitor invites are view-only and never capped. */
export function NewInvite({
  committedSlots,
  maxSlots,
  create,
}: {
  committedSlots: number;
  maxSlots: number;
  create: (kind: InviteKind) => Promise<string | null>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const atCap = committedSlots >= maxSlots;

  const make = (kind: InviteKind) =>
    startTransition(async () => {
      setError(await create(kind));
      router.refresh();
    });

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
        onClick={() => make("member")}
        style={buttonStyle(pending || atCap)}
      >
        {pending ? "Creating…" : "New member invite"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => make("visitor")}
        style={{
          ...buttonStyle(pending),
          background: "transparent",
          color: "var(--muted)",
          border: "1px solid var(--border-btn)",
        }}
      >
        New viewer invite
      </button>
      <span style={{ fontSize: 13, color: atCap || error ? "#ff6b6b" : "var(--muted)" }}>
        {error ?? `${committedSlots}/${maxSlots} member slots committed — members plus open invites.`}
      </span>
    </div>
  );
}
