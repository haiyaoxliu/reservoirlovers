"use client";

import { useEffect, useMemo, useRef } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { DetailOnly, useSettings } from "./Settings";

/** Strava's chevron mark, tinted to the site's muted grayscale. */
function StravaIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

export interface TimelineMember {
  userId: number;
  stravaAthleteId: number;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

export function stravaProfileUrl(athleteId: number): string {
  return `https://www.strava.com/athletes/${athleteId}`;
}

const LANE_H = 46;
/** Rail width matches lane height so member cells are square. */
const LABEL_W = 46;
const HEADER_H = 46;
/** Horizontal spacing between same-day dots in one lane. */
const DOT_SPACING = 16;
const MIN_COL_W = 44;
const COL_PAD = 12;

interface Positioned extends TimelineEvent {
  x: number;
}

/** Floor a timestamp to local midnight. */
function dayFloor(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function Timeline({
  events,
  members,
  selected,
  onSelect,
  activeUserId,
  onSelectUser,
  mask,
}: {
  events: TimelineEvent[];
  members: TimelineMember[];
  selected: TimelineEvent | null;
  onSelect: (e: TimelineEvent) => void;
  /** Member whose runs the map shows; their row is highlighted. */
  activeUserId: number | null;
  /** Tapping a member's row makes them the active one. */
  onSelectUser: (userId: number) => void;
  /** Time window highlighted over the day columns (the map's clamp). */
  mask?: { start: number; end: number } | null;
}) {
  const { prefs } = useSettings();
  // Ordinal axis: one column per calendar day that has at least one loop —
  // empty stretches between run days take up no space at all.
  const { laneEvents, width, ticks, minT } = useMemo(() => {
    if (events.length === 0) {
      return { laneEvents: new Map<number, Positioned[]>(), width: 400, ticks: [], minT: 0 };
    }
    const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const sorted = [...events]
      .map((e) => ({ ...e, t: new Date(e.eventTime).getTime() }))
      .sort((a, b) => a.t - b.t);

    const days: { key: string; t: number }[] = [];
    const dayIndex = new Map<string, number>();
    for (const e of sorted) {
      const k = dayKey(new Date(e.t));
      if (!dayIndex.has(k)) {
        dayIndex.set(k, days.length);
        days.push({ key: k, t: e.t });
      }
    }

    // A column widens if any member ran several loops that day.
    const perDayLaneCount = days.map(() => new Map<number, number>());
    for (const e of sorted) {
      const counts = perDayLaneCount[dayIndex.get(dayKey(new Date(e.t)))!];
      counts.set(e.userId, (counts.get(e.userId) ?? 0) + 1);
    }
    const colWidths = perDayLaneCount.map((counts) =>
      Math.max(MIN_COL_W, Math.max(...counts.values()) * DOT_SPACING + COL_PAD),
    );
    const colLeft: number[] = [];
    let acc = 0;
    for (const w of colWidths) {
      colLeft.push(acc);
      acc += w;
    }

    const byLane = new Map<number, Positioned[]>();
    for (const m of members) byLane.set(m.userId, []);
    const placed = days.map(() => new Map<number, number>());
    for (const e of sorted) {
      const idx = dayIndex.get(dayKey(new Date(e.t)))!;
      const total = perDayLaneCount[idx].get(e.userId)!;
      const kth = placed[idx].get(e.userId) ?? 0;
      placed[idx].set(e.userId, kth + 1);
      // Same-day loops fan out around the column centre.
      const x = colLeft[idx] + colWidths[idx] / 2 + (kth - (total - 1) / 2) * DOT_SPACING;
      byLane.get(e.userId)?.push({ ...e, x });
    }

    // Year/month rows only print when they change; the day row always does.
    const dayTicks = days.map((d, i) => {
      const date = new Date(d.t);
      const prev = i > 0 ? new Date(days[i - 1].t) : null;
      const newYear = !prev || prev.getFullYear() !== date.getFullYear();
      const newMonth = newYear || prev!.getMonth() !== date.getMonth();
      return {
        t: d.t,
        x: colLeft[i],
        w: colWidths[i],
        year: newYear ? String(date.getFullYear()) : null,
        month: newMonth ? date.toLocaleDateString("en-US", { month: "short" }) : null,
        day: String(date.getDate()),
      };
    });
    return { laneEvents: byLane, width: acc, ticks: dayTicks, minT: sorted[0].t };
  }, [events, members]);

  // Start scrolled to the most recent end, like the map window.
  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);
  useEffect(() => {
    if (didInitScroll.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    didInitScroll.current = true;
  }, [width]);

  // Bring the selected dot into view (e.g. when stepping with prev/next or
  // tapping on the map).
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId == null) return;
    scrollRef.current
      ?.querySelector(`[data-eid="${selectedId}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  // Pixel span of the masked window across the day columns.
  const maskSpan = useMemo(() => {
    if (!mask) return null;
    const lo = dayFloor(mask.start);
    const hi = dayFloor(mask.end);
    const within = ticks.filter((t) => dayFloor(t.t) >= lo && dayFloor(t.t) <= hi);
    if (within.length === 0) return null;
    const left = within[0].x;
    const right = within[within.length - 1].x + within[within.length - 1].w;
    return { left, width: right - left };
  }, [ticks, mask]);

  if (events.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No loops recorded yet. Go run the reservoir and they&apos;ll appear here.
      </p>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div className="bleed">
        {/* Section header, matching the leaderboard's — help text right-aligned */}
        <DetailOnly pref="headers">
        <h2
          style={{
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
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>Timeline</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textTransform: "none",
              letterSpacing: 0,
              fontWeight: 400,
              fontSize: 11,
              minWidth: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-label="swipe left or right">← →</span>
            <span>·</span>
            {/* Grayscale legend for the three dot tiers, mirroring the real
                dots' fill/border pattern: full solid, 98%+ dimmed fill with
                solid border, partial faint fill with faint border. */}
            {[
              { label: "full loop", size: 10, bg: "var(--muted)", border: "var(--muted)" },
              {
                label: "98%+ loop",
                size: 10,
                bg: "color-mix(in srgb, var(--muted) 70%, transparent)",
                border: "var(--muted)",
              },
              {
                label: "partial credit",
                size: 8,
                bg: "color-mix(in srgb, var(--muted) 30%, transparent)",
                border: "color-mix(in srgb, var(--muted) 60%, transparent)",
              },
            ].map((tier) => (
              <span
                key={tier.label}
                title={tier.label}
                style={{
                  width: tier.size,
                  height: tier.size,
                  borderRadius: tier.size / 2,
                  background: tier.bg,
                  border: `2px solid ${tier.border}`,
                  flexShrink: 0,
                }}
              />
            ))}
            <span>·</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              tap for details{minT ? ` · since ${new Date(minT).toLocaleDateString()}` : ""}
            </span>
          </span>
        </h2>
        </DetailOnly>

        {/* The rail lives OUTSIDE the scroll container so the elastic overscroll
            bounce at the data's end only moves the dots/markers, never the rail. */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            background: "var(--panel)",
          }}
        >
        <div
          style={{
            width: LABEL_W,
            flexShrink: 0,
            background: "var(--panel-2)",
            borderRight: "1px solid var(--border)",
          }}
        >
          {/* Corner cell: Strava mark — the avatars below link to profiles */}
          {prefs.timelineDates ? (
            <div
              style={{
                height: HEADER_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
              }}
              title="Avatars link to Strava profiles"
            >
              <StravaIcon size={16} />
            </div>
          ) : null}
          {members.map((m) => (
            <div
              key={m.userId}
              onClick={() => onSelectUser(m.userId)}
              style={{
                height: LANE_H,
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                borderTop: "1px solid var(--border-soft)",
                cursor: "pointer",
                background:
                  prefs.userHighlight && m.userId === activeUserId
                    ? `${m.color}26`
                    : "transparent",
              }}
            >
              <a
                href={stravaProfileUrl(m.stravaAthleteId)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${m.displayName} on Strava`}
                title={m.displayName}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "inherit",
                }}
              >
                <Avatar url={m.avatarUrl} name={m.displayName} color={m.color} />
              </a>
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ position: "relative", width, minWidth: "100%" }}>
            {/* Sliding highlight marking the window shown on the map */}
            {maskSpan ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: maskSpan.left,
                  width: maskSpan.width,
                  background: "var(--mask)",
                  pointerEvents: "none",
                  zIndex: 1,
                  transition: "left 120ms ease-out, width 120ms ease-out",
                }}
              />
            ) : null}
            {/* Day markers — stacked year / month / day; year and month
                print on change. Toggleable with the Strava corner cell. */}
            {prefs.timelineDates ? (
              <div style={{ position: "relative", height: HEADER_H }}>
                {ticks.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: t.x,
                      width: t.w,
                      top: 0,
                      height: HEADER_H,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ height: 12, fontSize: 9, lineHeight: "12px", color: "var(--muted)" }}>
                      {t.year}
                    </span>
                    <span style={{ height: 13, fontSize: 10, lineHeight: "13px", color: "var(--muted)" }}>
                      {t.month}
                    </span>
                    <span style={{ height: 15, fontSize: 11, lineHeight: "15px", fontWeight: 600 }}>
                      {t.day}
                    </span>
                    <span style={{ width: 1, height: 4, background: "var(--border-btn)" }} />
                  </div>
                ))}
              </div>
            ) : null}

          {/* Lanes — dots only; the member rail is outside the scroll area.
              Tapping anywhere in a lane makes that member active. */}
          {members.map((m) => {
            const evs = laneEvents.get(m.userId) ?? [];
            return (
              <div
                key={m.userId}
                onClick={() => onSelectUser(m.userId)}
                style={{
                  position: "relative",
                  height: LANE_H,
                  borderTop: "1px solid var(--border-soft)",
                  cursor: "pointer",
                  background:
                    prefs.userHighlight && m.userId === activeUserId
                      ? `${m.color}14`
                      : "transparent",
                }}
              >
                  {evs.map((e) => {
                    const full = e.kind === "full";
                    const exact = full && e.percent >= 100;
                    const r = full ? 7 : 5;
                    const isSel = selected?.id === e.id;
                    const date = new Date(e.eventTime).toLocaleDateString();
                    return (
                      <button
                        key={e.id}
                        data-eid={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelect(e);
                        }}
                        title={
                          full
                            ? exact
                              ? `Loop — ${date}`
                              : `Loop (${e.percent}%) — ${date}`
                            : `Partial ${e.percent}% — ${date}`
                        }
                        style={{
                          position: "absolute",
                          left: e.x - r,
                          top: LANE_H / 2 - r,
                          width: r * 2,
                          height: r * 2,
                          borderRadius: r,
                          padding: 0,
                          cursor: "pointer",
                          // Three tiers like the leaderboard bars: clean 100%
                          // loops solid, 98-99% tolerance fulls slightly
                          // dimmer, partials faint.
                          background: exact ? m.color : full ? `${m.color}b3` : `${m.color}4d`,
                          border: `2px solid ${isSel ? "var(--text)" : full ? m.color : `${m.color}99`}`,
                          boxShadow: exact ? `0 0 6px ${m.color}66` : "none",
                        }}
                      />
                    );
                  })}
              </div>
            );
          })}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
