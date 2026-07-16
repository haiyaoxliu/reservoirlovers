"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** "Revoke all open invites" — deletes every never-redeemed link to kill
 *  guessable open invites. Confirms first, since it can't be undone. Disabled
 *  when there's nothing open. */
export function RevokeOpenInvites({
  openCount,
  revoke,
}: {
  openCount: number;
  revoke: () => Promise<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const disabled = pending || openCount === 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (
            !window.confirm(
              `Revoke ${openCount} open invite${openCount === 1 ? "" : "s"}? Anyone holding ` +
                `those links loses them. Previously-used (athlete-locked) invites are kept.`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            setResult(await revoke());
            router.refresh();
          });
        }}
        style={{
          background: "transparent",
          color: "#ff6b6b",
          fontWeight: 600,
          border: "1px solid var(--border-btn)",
          borderRadius: 8,
          padding: "8px 16px",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {pending ? "Revoking…" : "Revoke all open invites"}
      </button>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>
        {result ?? `${openCount} open (never-redeemed) invite${openCount === 1 ? "" : "s"}.`}
      </span>
    </div>
  );
}
