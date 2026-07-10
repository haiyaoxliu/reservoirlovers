"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";
import { Timeline, stravaProfileUrl, type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { ExternalLinkIcon } from "./ExternalLinkIcon";
import canonicalJson from "@/loop/canonical-loop.json";

const MAP_PAD_M = 40;
/** Meters between stacked dots that completed at the same checkpoint. */
const STACK_STEP_M = 14;
const DOT_R = 8;

const loop = canonicalJson as {
  totalMeters: number;
  checkpoints: { x: number; y: number }[];
};

const headerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 1,
  background: "var(--panel)",
  borderTop: "1px solid #232a36",
  borderBottom: "1px solid #232a36",
  padding: "6px 16px",
};

/**
 * Map + member visibility toggles + shared detail panel + timeline. Selecting
 * a dot on either the map or the timeline populates the detail panel.
 */
export function Board({
  events,
  members,
}: {
  events: TimelineEvent[];
  members: TimelineMember[];
}) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());

  const toggle = (userId: number) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const memberOf = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  // SVG geometry: checkpoint coords are meters east/north of the reservoir
  // centroid, so meters map 1:1 to SVG units with the y axis flipped.
  const { pathD, w, h, place } = useMemo(() => {
    const xs = loop.checkpoints.map((c) => c.x);
    const ys = loop.checkpoints.map((c) => c.y);
    const minX = Math.min(...xs) - MAP_PAD_M;
    const maxX = Math.max(...xs) + MAP_PAD_M;
    const minY = Math.min(...ys) - MAP_PAD_M;
    const maxY = Math.max(...ys) + MAP_PAD_M;
    const toSvg = (x: number, y: number) => ({ x: x - minX, y: maxY - y });
    const d =
      loop.checkpoints
        .map((c, i) => {
          const p = toSvg(c.x, c.y);
          return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ") + " Z";
    // Dot position for a checkpoint, nudged outward from the loop's centroid
    // so same-spot completions stack visibly instead of hiding each other.
    const cx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const cy = ys.reduce((s, v) => s + v, 0) / ys.length;
    const placeFn = (endP: number, stackIndex: number) => {
      const c = loop.checkpoints[((endP % loop.checkpoints.length) + loop.checkpoints.length) % loop.checkpoints.length];
      const dx = c.x - cx;
      const dy = c.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const off = stackIndex * STACK_STEP_M;
      return toSvg(c.x + (dx / len) * off, c.y + (dy / len) * off);
    };
    return { pathD: d, w: maxX - minX, h: maxY - minY, place: placeFn };
  }, []);

  // Dots for visible members' loops, oldest first so stacks grow outward.
  const mapDots = useMemo(() => {
    const stack = new Map<number, number>();
    const dots: { e: TimelineEvent; x: number; y: number; color: string }[] = [];
    for (const e of events) {
      if (e.endP == null || hidden.has(e.userId)) continue;
      const k = stack.get(e.endP) ?? 0;
      stack.set(e.endP, k + 1);
      const p = place(e.endP, k);
      dots.push({ e, x: p.x, y: p.y, color: memberOf.get(e.userId)?.color ?? "#888" });
    }
    return dots;
  }, [events, hidden, memberOf, place]);

  const selectedMember = selected ? memberOf.get(selected.userId) : null;

  return (
    <>
      <section style={{ marginBottom: 32 }}>
        <div className="bleed">
          <h2 style={headerStyle}>Map</h2>

          {/* Member visibility toggles */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: "10px 16px",
              background: "var(--panel)",
            }}
          >
            {members.map((m) => {
              const off = hidden.has(m.userId);
              return (
                <button
                  key={m.userId}
                  onClick={() => toggle(m.userId)}
                  aria-pressed={!off}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: `1px solid ${off ? "#333c4a" : m.color}`,
                    borderRadius: 999,
                    padding: "3px 10px 3px 4px",
                    color: "var(--text)",
                    fontSize: 12,
                    cursor: "pointer",
                    opacity: off ? 0.45 : 1,
                  }}
                >
                  <Avatar url={m.avatarUrl} name={m.displayName} color={m.color} size={20} />
                  {m.displayName}
                </button>
              );
            })}
          </div>

          {/* Just the reservoir: the canonical loop outline, nothing else */}
          <div style={{ background: "var(--panel)", padding: "4px 16px 12px" }}>
            <svg
              viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
              style={{ display: "block", width: "100%", maxWidth: 520, margin: "0 auto" }}
              role="img"
              aria-label="Central Park Reservoir loop map"
            >
              <path
                d={pathD}
                fill="rgba(42, 111, 176, 0.22)"
                stroke="var(--water)"
                strokeWidth={4}
                strokeLinejoin="round"
              />
              {mapDots.map(({ e, x, y, color }) => (
                <circle
                  key={e.id}
                  cx={x}
                  cy={y}
                  r={DOT_R}
                  fill={color}
                  stroke={selected?.id === e.id ? "#fff" : "var(--bg)"}
                  strokeWidth={selected?.id === e.id ? 3 : 1.5}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(e)}
                >
                  <title>{`${e.displayName} — ${new Date(e.eventTime).toLocaleDateString()}`}</title>
                </circle>
              ))}
            </svg>
          </div>

          {/* Detail panel — populated by tapping a dot on the map or timeline */}
          <div
            style={{
              borderTop: "1px solid #232a36",
              borderBottom: "1px solid #232a36",
              background: "var(--panel)",
              padding: "10px 16px",
              minHeight: 54,
            }}
          >
            {selected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar
                  url={selectedMember?.avatarUrl ?? null}
                  name={selected.displayName}
                  color={selectedMember?.color}
                  size={34}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {selectedMember ? (
                      <a
                        href={stravaProfileUrl(selectedMember.stravaAthleteId)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "inherit",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {selected.displayName}
                        <ExternalLinkIcon size={11} />
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{selected.displayName}</span>
                    )}
                    {formatDuration(selected.elapsedSeconds) ? (
                      <span style={{ color: selectedMember?.color ?? "var(--accent)", fontWeight: 600 }}>
                        {formatDuration(selected.elapsedSeconds)}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {new Date(selected.eventTime).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {selected.activityName ? ` · ${selected.activityName}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Clear selection"
                  style={{
                    background: "transparent",
                    color: "var(--muted)",
                    border: "1px solid #333c4a",
                    borderRadius: 8,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <p style={{ margin: "8px 0", color: "var(--muted)", fontSize: 13 }}>
                Tap a dot on the map or timeline to see that loop&apos;s details.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <Timeline events={events} members={members} selected={selected} onSelect={setSelected} />
      </section>
    </>
  );
}
