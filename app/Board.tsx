"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";
import { Timeline, TIMELINE_RAIL_W, type TimelineMember } from "./Timeline";
import { Avatar } from "./Avatar";
import { ExternalLinkIcon } from "./ExternalLinkIcon";
import { DetailOnly, Distance, useSettings } from "./Settings";
import canonicalJson from "@/loop/canonical-loop.json";

const MAP_PAD_M = 30;
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

const fmtDay = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

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
  // One member's runs show on the map at a time, picked by tapping their
  // timeline row (or any of their events). Defaults to the viewer.
  const [activeUserId, setActiveUserId] = useState<number | null>(
    currentUserId ?? members[0]?.userId ?? null,
  );

  const memberOf = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const dayFloor = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  // The window slides over the timeline's own date columns (days that have
  // at least one event), showing up to WINDOW_DAYS columns at a time on the
  // map. Indexing columns rather than wall-clock time keeps the slider and
  // the mask perfectly in step. Defaults to the most recent columns.
  const days = useMemo(() => {
    const set = new Set<number>();
    for (const e of events) set.add(dayFloor(new Date(e.eventTime).getTime()));
    return [...set].sort((a, b) => a - b);
  }, [events]);
  const { mapWindow, prefs } = useSettings();
  const windowDays = mapWindow === "all" ? Math.max(1, days.length) : mapWindow === "wide" ? 8 : 4;
  const maxStartIdx = Math.max(0, days.length - windowDays);
  const [startIdxRaw, setStartIdx] = useState<number | null>(null);
  const startIdx = Math.min(startIdxRaw ?? maxStartIdx, maxStartIdx);
  const windowStart = days[startIdx] ?? 0;
  const windowEnd = days[Math.min(startIdx + windowDays, days.length) - 1] ?? 0;

  const mapEvents = useMemo(() => {
    return events.filter((e) => {
      const d = dayFloor(new Date(e.eventTime).getTime());
      return d >= windowStart && d <= windowEnd;
    });
  }, [events, windowStart, windowEnd]);

  // Select an event: slide the window to cover its day if needed (centred
  // when possible), and make its member the active one on the map.
  const selectEvent = (e: TimelineEvent) => {
    setSelected(e);
    const idx = days.indexOf(dayFloor(new Date(e.eventTime).getTime()));
    if (idx >= 0 && (idx < startIdx || idx > startIdx + windowDays - 1)) {
      setStartIdx(Math.max(0, Math.min(idx - Math.floor(windowDays / 2), maxStartIdx)));
    }
    setActiveUserId(e.userId);
  };

  // Prev/next within the selected member's own event sequence (oldest first).
  const { prevEvent, nextEvent } = useMemo(() => {
    if (!selected) return { prevEvent: null, nextEvent: null };
    const own = events.filter((ev) => ev.userId === selected.userId);
    const pos = own.findIndex((ev) => ev.id === selected.id);
    return {
      prevEvent: pos > 0 ? own[pos - 1] : null,
      nextEvent: pos >= 0 && pos < own.length - 1 ? own[pos + 1] : null,
    };
  }, [events, selected]);

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
      const end = pts[pts.length - 1];
      const prev = pts[pts.length - 2] ?? pts[0];
      const tLen = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
      const tx = (end.x - prev.x) / tLen;
      const ty = (end.y - prev.y) / tLen;

      // A full loop ends where its start dot sits — stop the line short and
      // point the arrow tip at the dot instead of overlapping it.
      const linePts = full
        ? [...pts.slice(0, -1), { x: end.x - tx * 14, y: end.y - ty * 14 }]
        : pts;
      const d = linePts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
      // Arrow tip: just before the dot for fulls, past the last fix for partials.
      const tipX = full ? end.x - tx * 7 : end.x + tx * 8;
      const tipY = full ? end.y - ty * 7 : end.y + ty * 8;
      const arrow = [
        `${tipX.toFixed(1)},${tipY.toFixed(1)}`,
        `${(tipX - tx * 11 - ty * 5).toFixed(1)},${(tipY - ty * 11 + tx * 5).toFixed(1)}`,
        `${(tipX - tx * 11 + ty * 5).toFixed(1)},${(tipY - ty * 11 - tx * 5).toFixed(1)}`,
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

  // Partials render first so full-loop rings sit on top of them, and the
  // selected event renders last so its halo isn't covered.
  const visibleDrawn = useMemo(
    () =>
      drawn
        .filter(({ e }) => e.userId === activeUserId)
        .sort(
          (a, b) =>
            Number(a.e.id === selected?.id) - Number(b.e.id === selected?.id) ||
            Number(a.full) - Number(b.full),
        ),
    [drawn, activeUserId, selected],
  );

  const selectedMember = selected ? memberOf.get(selected.userId) : null;

  return (
    <>
      <section style={{ marginBottom: 32 }}>
        <Timeline
          events={events}
          members={members}
          selected={selected}
          onSelect={selectEvent}
          activeUserId={activeUserId}
          onSelectUser={setActiveUserId}
          mask={days.length > 0 ? { start: windowStart, end: windowEnd } : null}
        />

        {/* Window picker, attached under the timeline it masks. Its row
            header sits in the same column as the Strava icon rail. */}
        {days.length > 0 ? (
          <div
            className="bleed"
            style={{
              display: "flex",
              alignItems: "stretch",
              background: "var(--panel)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: TIMELINE_RAIL_W,
                flexShrink: 0,
                background: "var(--panel-2)",
                borderRight: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                // Bottom-anchored with hidden overflow: if the cell ever gets
                // too short, the start date clips first, keeping the end date.
                justifyContent: "flex-end",
                overflow: "hidden",
                padding: "3px 0",
                fontSize: 9,
                lineHeight: "11px",
                color: "var(--muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {prefs.sliderDates ? (
                <>
                  <span>{fmtDay(windowStart)}</span>
                  <span>–</span>
                  <span>{fmtDay(windowEnd)}</span>
                </>
              ) : null}
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "8px 16px 8px 10px" }}>
              <input
                type="range"
                min={0}
                max={maxStartIdx}
                step={1}
                value={startIdx}
                onChange={(ev) => setStartIdx(Number(ev.target.value))}
                disabled={maxStartIdx === 0}
                aria-label="Date range shown on the map"
                style={{ flex: 1 }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="bleed" style={{ display: "flex", flexDirection: "column" }}>
          {/* Member visibility is picked by tapping a timeline row — the map
              always shows the active member's runs. */}
          <DetailOnly pref="headers">
            <h2 style={headerStyle}>
              Map
              {activeUserId != null && memberOf.get(activeUserId) ? (
                <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                  {" "}
                  · {memberOf.get(activeUserId)!.displayName}
                </span>
              ) : null}
            </h2>
          </DetailOnly>

          {/* Just the reservoir: the canonical loop outline, nothing else.
              Flex `order` places the map after the detail strip visually. */}
          <div style={{ background: "var(--panel)", padding: "4px 16px 12px", order: 1 }}>
            <svg
              viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
              style={{ display: "block", width: "100%", maxWidth: 560, margin: "0 auto" }}
              role="img"
              aria-label="Central Park Reservoir loop map"
            >
              {/* Grayscale base so the water shape never competes with
                  member colours. */}
              <path
                d={basePath}
                fill="var(--mask)"
                stroke="var(--border-btn)"
                strokeWidth={4}
                strokeLinejoin="round"
              />
              {visibleDrawn.map(({ e, full, d, arrow, sx, sy, color }) => {
                const isSel = selected?.id === e.id;
                const exact = full && e.percent >= 100;
                // Three tiers: clean 100% loops bright (80%), 98-99%
                // tolerance fulls dimmer (65%), partials faint (20%) — the
                // selected event at full colour with a halo underneath.
                const stroke = isSel
                  ? color
                  : exact
                    ? `${color}cc`
                    : full
                      ? `${color}a6`
                      : `${color}33`;
                const markerFill = isSel || exact ? color : full ? `${color}d9` : `${color}66`;
                const title = `${e.displayName} — ${full ? (e.percent < 100 ? `full loop (${e.percent}%)` : "full loop") : `${e.percent}%`} · ${new Date(e.eventTime).toLocaleDateString()}`;
                return (
                  <g key={e.id}>
                    {isSel ? (
                      <path
                        d={d}
                        fill="none"
                        stroke="var(--text)"
                        strokeWidth={8}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={0.45}
                      />
                    ) : null}
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isSel ? 4.5 : full ? 3 : 2}
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
                      onClick={() => selectEvent(e)}
                    >
                      <title>{title}</title>
                    </path>
                    <polygon
                      points={arrow}
                      fill={markerFill}
                      stroke={isSel ? "var(--text)" : "none"}
                      strokeWidth={isSel ? 1.5 : 0}
                      pointerEvents="none"
                    />
                    <circle
                      cx={sx}
                      cy={sy}
                      r={isSel ? (full ? 6 : 4.5) : full ? 5 : 3.5}
                      fill={markerFill}
                      stroke={isSel ? "var(--text)" : "var(--bg)"}
                      strokeWidth={isSel ? 2.5 : 1}
                      style={{ cursor: "pointer" }}
                      onClick={() => selectEvent(e)}
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
                    {/* No name here — the map header already shows whose runs
                        these are. The stat links to the Strava activity,
                        coloured by tier like the rest of the site. */}
                    <a
                      href={`https://www.strava.com/activities/${selected.stravaActivityId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: selectedMember?.color
                          ? selected.kind === "full"
                            ? selected.percent >= 100
                              ? selectedMember.color
                              : `${selectedMember.color}b3`
                            : `${selectedMember.color}80`
                          : "var(--accent)",
                        fontWeight: selected.kind === "full" ? 600 : 400,
                        fontSize: selected.kind === "full" ? undefined : 13,
                      }}
                    >
                      {/* Uniform for every event: time · percent · distance */}
                      {[formatDuration(selected.durationSeconds), `${selected.percent}%`]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      <Distance km={((selected.percent / 100) * loop.totalMeters) / 1000} />
                      <ExternalLinkIcon size={11} />
                    </a>
                  </div>
                  {prefs.detailMeta ? (
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {(() => {
                        const d = new Date(selected.eventTime);
                        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                      })()}
                      {selected.activityName ? ` · ${selected.activityName}` : ""}
                    </div>
                  ) : null}
                </div>
                {/* Step through this member's events in timeline order */}
                <button
                  onClick={() => prevEvent && selectEvent(prevEvent)}
                  disabled={!prevEvent}
                  aria-label="Previous loop"
                  style={{
                    background: "transparent",
                    color: prevEvent ? "var(--text)" : "var(--muted)",
                    border: "1px solid var(--border-btn)",
                    borderRadius: 8,
                    padding: "4px 10px",
                    cursor: prevEvent ? "pointer" : "default",
                    fontSize: 13,
                    opacity: prevEvent ? 1 : 0.4,
                  }}
                >
                  ‹
                </button>
                <button
                  onClick={() => nextEvent && selectEvent(nextEvent)}
                  disabled={!nextEvent}
                  aria-label="Next loop"
                  style={{
                    background: "transparent",
                    color: nextEvent ? "var(--text)" : "var(--muted)",
                    border: "1px solid var(--border-btn)",
                    borderRadius: 8,
                    padding: "4px 10px",
                    cursor: nextEvent ? "pointer" : "default",
                    fontSize: 13,
                    opacity: nextEvent ? 1 : 0.4,
                  }}
                >
                  ›
                </button>
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
