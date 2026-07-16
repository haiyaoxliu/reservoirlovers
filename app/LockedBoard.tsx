"use client";

import type { TimelineEvent } from "@/lib/queries";
import { Board } from "./Board";
import type { TimelineMember } from "./Timeline";

/**
 * Visitor-tier teaser: the real Board rendered with fake demo data, blurred and
 * inert, under a translucent lock overlay. Visitors reached this via a view-only
 * invite; the full timeline/map is member-only, so we point them at a member
 * invite rather than a Strava connect that would dead-end without one.
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
          <h2 style={{ margin: "0 0 6px", fontSize: 24 }}>Members only</h2>
          <p style={{ margin: "0 0 4px", color: "var(--muted)", fontSize: 14 }}>
            The timeline & map are for club members.
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Ask the club for a member invite to join.
          </p>
        </div>
      </div>
    </div>
  );
}
