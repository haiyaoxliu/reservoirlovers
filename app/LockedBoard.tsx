"use client";

import type { TimelineEvent } from "@/lib/queries";
import { Board } from "./Board";
import { ConnectButton } from "./ConnectButton";
import type { TimelineMember } from "./Timeline";

/**
 * Viewer-tier teaser: the real Board rendered with fake demo data, blurred
 * and inert, under a translucent lock overlay that invites a Strava connect.
 */
export function LockedBoard({
  events,
  members,
}: {
  events: TimelineEvent[];
  members: TimelineMember[];
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        inert
        aria-hidden
        style={{ filter: "blur(7px)", pointerEvents: "none", userSelect: "none" }}
      >
        <Board events={events} members={members} currentUserId={null} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          background: "color-mix(in srgb, var(--bg) 45%, transparent)",
        }}
      >
        {/* Sticky so the invite stays in view while scrolling the (tall)
            blurred section behind it. */}
        <div
          style={{
            position: "sticky",
            top: "28vh",
            width: "fit-content",
            margin: "0 auto",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>🔒</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 24 }}>Hidden</h2>
          <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 14 }}>
            Connect with Strava to view details
          </p>
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
