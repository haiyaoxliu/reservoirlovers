"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** One maintenance action: a button that runs a server action and shows the
 *  returned summary line beneath it. */
function Tool({
  label,
  note,
  run,
}: {
  label: string;
  note: string;
  run: () => Promise<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

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
        onClick={() =>
          startTransition(async () => {
            setResult(await run());
            router.refresh();
          })
        }
        disabled={pending}
        style={{
          background: "var(--accent)",
          color: "#04121f",
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        {pending ? "Running…" : label}
      </button>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>
        {pending ? "This can take a while…" : result ?? note}
      </span>
    </div>
  );
}

export function AdminTools({
  refreshAll,
  backfillAll,
}: {
  refreshAll: () => Promise<string>;
  backfillAll: () => Promise<string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
      <Tool
        label="Refresh all"
        note="Re-pull every member's Strava photo & name, plus their last month of runs."
        run={refreshAll}
      />
      <Tool
        label="Backfill all"
        note="Deep reconcile of every member's full history. Stops on Strava rate limits — run again to continue."
        run={backfillAll}
      />
    </div>
  );
}
