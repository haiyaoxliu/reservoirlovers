"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";
import { Timeline, stravaProfileUrl, type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { ExternalLinkIcon } from "./ExternalLinkIcon";
import { Distance } from "./Settings";
import canonicalJson from "@/loop/canonical-loop.json";

const MAP_PAD_M = 30;
/** The map shows a sliding window of this length, picked below the timeline. */
const WINDOW_MS = 30 * 86400000;
/** First travel line sits this far outside the water's edge. */
const BASE_OFF_M = 12;
/** Radial distance between an event's ring level and the next. */
const LEVEL_STEP_M = 6;
/** Small per-member phase shift so same-level lines don't coincide exactly. */
const MEMBER_PHASE_M = 2;

const loop = canonicalJson as {
  totalMeters: number;
  checkpoints: { x: number; y: number }[];
};

const fmtDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const headerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 1,
  background: "var(--panel)",
  borderTop: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
  padding: "6px 16px",
};

/**
 * Map + member visibility toggles + shared detail panel + timeline. Selecting
 * a dot on either the map or the timeline populates the detail panel.
 */
export function Board({
  events,
  members,
  currentUserId,
}: {
  events: TimelineEvent[];
  members: TimelineMember[];
  currentUserId: number | null;
}) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  // By default only the viewer's own runs are shown on the map.
  const [hidden, setHidden] = useState<Set<number>>(
    () =>
      new Set(
        currentUserId == null
          ? []
          : members.filter((m) => m.userId !== currentUserId).map((m) => m.userId),
      ),
  );

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

  const dayFloor = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  // Sliding 1-month window; the map only draws events inside it. Defaults to
  // the most recent month of data.
  const timeRange = useMemo(() => {
    if (events.length === 0) return null;
    const ts = events.map((e) => new Date(e.eventTime).getTime());
    return { min: Math.min(...ts), max: Math.max(...ts) };
  }, [events]);
  const [windowStartRaw, setWindowStart] = useState<number | null>(null);
  const windowStart =
    windowStartRaw ?? (timeRange ? Math.max(timeRange.min, timeRange.max - WINDOW_MS) : 0);
  const windowEnd = windowStart + WINDOW_MS;

  const mapEvents = useMemo(() => {
    const lo = dayFloor(windowStart);
    const hi = dayFloor(windowEnd);
    return events.filter((e) => {
      const d = dayFloor(new Date(e.eventTime).getTime());
      return d >= lo && d <= hi;
    });
  }, [events, windowStart, windowEnd]);

  // SVG geometry: checkpoint coords are meters east/north of the reservoir
  // centroid, so meters map 1:1 to SVG units with the y axis flipped. Every
  // event draws its credited travel as a line offset outward from the water:
  // full loops are closed rings, partials are arcs, and each event gets its
  // own radial level (per member, reusing levels for non-overlapping arcs) so
  // successive completions stay visually distinct.
  const { basePath, w, h, drawn } = useMemo(() => {
    const cps = loop.checkpoints;
    const N = cps.length;
    const cx = cps.reduce((s, c) => s + c.x, 0) / N;
    const cy = cps.reduce((s, c) => s + c.y, 0) / N;
    const normals = cps.map((c) => {
      const dx = c.x - cx;
      const dy = c.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { nx: dx / len, ny: dy / len };
    });
    const mod = (v: number) => ((v % N) + N) % N;
    const memberIndex = new Map(members.map((m, i) => [m.userId, i]));

    // Level assignment covers every event in the window (not just visible
    // members) so toggling a member never reshuffles everyone else's rings.
    interface Placed {
      e: TimelineEvent;
      cover: number[]; // checkpoint indices along the travel, start → end
      offset: number; // radial meters outside the water line
      full: boolean;
    }
    const occupied = new Map<number, boolean[][]>(); // userId -> level -> checkpoints
    const placed: Placed[] = [];
    let maxOffset = 0;
    for (const e of mapEvents) {
      if (e.endP == null) continue;
      const pct = Math.max(1, Math.min(100, e.percent));
      const dir = e.direction === "cw" ? -1 : 1;
      const startP = mod(e.endP - dir * pct);
      const cover: number[] = [];
      for (let i = 0; i <= pct; i++) cover.push(mod(startP + dir * i));

      let levels = occupied.get(e.userId);
      if (!levels) occupied.set(e.userId, (levels = []));
      let level = 0;
      while (level < levels.length && cover.some((c) => levels[level][c])) level++;
      if (level === levels.length) levels.push(new Array(N).fill(false));
      for (const c of cover) levels[level][c] = true;

      const offset =
        BASE_OFF_M + level * LEVEL_STEP_M + (memberIndex.get(e.userId) ?? 0) * MEMBER_PHASE_M;
      if (offset > maxOffset) maxOffset = offset;
      placed.push({ e, cover, offset, full: e.kind === "full" });
    }

    const xs = cps.map((c) => c.x);
    const ys = cps.map((c) => c.y);
    const pad = maxOffset + MAP_PAD_M;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const toSvg = (x: number, y: number) => ({ x: x - minX, y: maxY - y });
    const pointAt = (i: number, off: number) =>
      toSvg(cps[i].x + normals[i].nx * off, cps[i].y + normals[i].ny * off);

    const base =
      cps
        .map((c, i) => {
          const p = toSvg(c.x, c.y);
          return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ") + " Z";

    const drawnEvents = placed.map(({ e, cover, offset, full }) => {
      const pts = cover.map((c) => pointAt(c, offset));
      const linePts = full ? pts.slice(0, -1) : pts; // ring closes via Z
      const d =
        linePts
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ") + (full ? " Z" : "");
      // Arrow tip at the end of travel, oriented along the final step.
      const end = pts[pts.length - 1];
      const prev = pts[pts.length - 2] ?? pts[0];
      const tLen = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
      const tx = (end.x - prev.x) / tLen;
      const ty = (end.y - prev.y) / tLen;
      const arrow = [
        `${(end.x + tx * 8).toFixed(1)},${(end.y + ty * 8).toFixed(1)}`,
        `${(end.x - tx * 3 - ty * 5).toFixed(1)},${(end.y - ty * 3 + tx * 5).toFixed(1)}`,
        `${(end.x - tx * 3 + ty * 5).toFixed(1)},${(end.y - ty * 3 - tx * 5).toFixed(1)}`,
      ].join(" ");
      return {
        e,
        full,
        d,
        arrow,
        sx: pts[0].x,
        sy: pts[0].y,
        color: memberOf.get(e.userId)?.color ?? "#888",
      };
    });

    return { basePath: base, w: maxX - minX, h: maxY - minY, drawn: drawnEvents };
  }, [mapEvents, members, memberOf]);

  // Partials render first so full-loop rings sit on top of them.
  const visibleDrawn = useMemo(
    () =>
      drawn
        .filter(({ e }) => !hidden.has(e.userId))
        .sort((a, b) => Number(a.full) - Number(b.full)),
    [drawn, hidden],
  );

  const selectedMember = selected ? memberOf.get(selected.userId) : null;

  return (
    <>
      <section style={{ marginBottom: 32 }}>
        <Timeline
          events={events}
          members={members}
          selected={selected}
          onSelect={setSelected}
          mask={timeRange ? { start: windowStart, end: windowEnd } : null}
        />

        {/* Window picker: slides the 1-month clamp shown on the map */}
        {timeRange ? (
          <div
            className="bleed"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--panel)",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
              padding: "8px 16px",
              marginTop: 8,
            }}
          >
            <input
              type="range"
              min={timeRange.min}
              max={Math.max(timeRange.min, timeRange.max - WINDOW_MS)}
              step={86400000}
              value={windowStart}
              onChange={(ev) => setWindowStart(Number(ev.target.value))}
              disabled={timeRange.max - timeRange.min <= WINDOW_MS}
              aria-label="Month shown on the map"
              style={{ flex: 1 }}
            />
            <span
              style={{
                fontSize: 11,
                color: "var(--muted)",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtDay(windowStart)} – {fmtDay(windowEnd)}
            </span>
          </div>
        ) : null}
      </section>

      <section>
        <div className="bleed" style={{ display: "flex", flexDirection: "column" }}>
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
                    background: off ? "transparent" : m.color,
                    border: `1px solid ${off ? "var(--border-btn)" : m.color}`,
                    borderRadius: 999,
                    padding: "3px 10px 3px 4px",
                    color: off ? "var(--muted)" : "#04121f",
                    fontWeight: off ? 400 : 600,
                    fontSize: 12,
                    cursor: "pointer",
                    opacity: off ? 0.55 : 1,
                  }}
                >
                  <Avatar url={m.avatarUrl} name={m.displayName} color={m.color} size={20} />
                  {m.displayName}
                </button>
              );
            })}
          </div>

          {/* Just the reservoir: the canonical loop outline, nothing else.
              Flex `order` places the map after the detail strip visually. */}
          <div style={{ background: "var(--panel)", padding: "4px 16px 12px", order: 1 }}>
            <svg
              viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
              style={{ display: "block", width: "100%", maxWidth: 560, margin: "0 auto" }}
              role="img"
              aria-label="Central Park Reservoir loop map"
            >
              <path
                d={basePath}
                fill="rgba(42, 111, 176, 0.22)"
                stroke="var(--water)"
                strokeWidth={4}
                strokeLinejoin="round"
              />
              {visibleDrawn.map(({ e, full, d, arrow, sx, sy, color }) => {
                const isSel = selected?.id === e.id;
                // Same prominence split as the leaderboard bars: full loops
                // at 40% opacity, partial travel at 18%.
                const stroke = isSel ? color : full ? `${color}66` : `${color}2e`;
                const title = `${e.displayName} — ${full ? "full loop" : `${e.percent}%`} · ${new Date(e.eventTime).toLocaleDateString()}`;
                return (
                  <g key={e.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={full ? 3 : 2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* invisible wide stroke = generous tap target */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ cursor: "pointer" }}
                      pointerEvents="stroke"
                      onClick={() => setSelected(e)}
                    >
                      <title>{title}</title>
                    </path>
                    <polygon
                      points={arrow}
                      fill={full || isSel ? color : `${color}88`}
                      pointerEvents="none"
                    />
                    <circle
                      cx={sx}
                      cy={sy}
                      r={full ? 5 : 3.5}
                      fill={full || isSel ? color : `${color}88`}
                      stroke={isSel ? "var(--text)" : "var(--bg)"}
                      strokeWidth={isSel ? 2.5 : 1}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelected(e)}
                    >
                      <title>{title}</title>
                    </circle>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detail panel — populated by tapping a dot on the map or timeline */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
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
                    {selected.kind === "full" && formatDuration(selected.elapsedSeconds) ? (
                      <span style={{ color: selectedMember?.color ?? "var(--accent)", fontWeight: 600 }}>
                        {formatDuration(selected.elapsedSeconds)}
                      </span>
                    ) : null}
                    {selected.kind === "partial" ? (
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>
                        partial · {selected.percent}% (
                        <Distance km={((selected.percent / 100) * loop.totalMeters) / 1000} />)
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
                    border: "1px solid var(--border-btn)",
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
                Tap a line on the map or a dot on the timeline to see that loop&apos;s details.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
