"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";

export interface TimelineMember {
  userId: number;
  stravaAthleteId: number;
  displayName: string;
  color: string;
}

function stravaProfileUrl(athleteId: number): string {
  return `https://www.strava.com/athletes/${athleteId}`;
}

const LANE_H = 46;
const LABEL_W = 100;
/** Horizontal spacing between same-day dots in one lane. */
const DOT_SPACING = 16;
const MIN_COL_W = 44;
const COL_PAD = 12;

interface Positioned extends TimelineEvent {
  x: number;
}

export function Timeline({
  events,
  members,
}: {
  events: TimelineEvent[];
  members: TimelineMember[];
}) {
  const [selected, setSelected] = useState<Positioned | null>(null);

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
        x: colLeft[i],
        w: colWidths[i],
        year: newYear ? String(date.getFullYear()) : null,
        month: newMonth ? date.toLocaleDateString("en-US", { month: "short" }) : null,
        day: String(date.getDate()),
      };
    });
    return { laneEvents: byLane, width: acc, ticks: dayTicks, minT: sorted[0].t };
  }, [events, members]);

  const colorOf = useMemo(() => {
    const m = new Map(members.map((x) => [x.userId, x.color]));
    return (id: number) => m.get(id) ?? "#888";
  }, [members]);

  const athleteOf = useMemo(() => {
    const m = new Map(members.map((x) => [x.userId, x.stravaAthleteId]));
    return (id: number) => m.get(id);
  }, [members]);

  if (events.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No loops recorded yet. Go run the reservoir and they&apos;ll appear here.
      </p>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        className="bleed"
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          borderTop: "1px solid #232a36",
          borderBottom: "1px solid #232a36",
          background: "var(--panel)",
        }}
      >
        <div style={{ position: "relative", width: LABEL_W + width, minWidth: "100%" }}>
          {/* Day markers — one per column, i.e. only where there is data.
              Stacked year / month / day; year and month print on change. */}
          <div style={{ position: "relative", height: 46, marginLeft: LABEL_W }}>
            {ticks.map((t, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: t.x,
                  width: t.w,
                  top: 0,
                  height: 46,
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
                <span style={{ width: 1, height: 4, background: "#333c4a" }} />
              </div>
            ))}
          </div>

          {/* Lanes */}
          {members.map((m) => {
            const evs = laneEvents.get(m.userId) ?? [];
            return (
              <div
                key={m.userId}
                style={{ position: "relative", height: LANE_H, borderTop: "1px solid #1b212c" }}
              >
                <div
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    width: LABEL_W,
                    height: LANE_H,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 8px",
                    background: "var(--panel-2)",
                    borderRight: "1px solid #232a36",
                  }}
                >
                  <span
                    style={{ width: 10, height: 10, borderRadius: 5, background: m.color, flexShrink: 0 }}
                  />
                  <a
                    href={stravaProfileUrl(m.stravaAthleteId)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "inherit",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.displayName}
                  </a>
                </div>

                <div style={{ position: "absolute", top: 0, left: LABEL_W, right: 0, height: LANE_H }}>
                  {evs.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      title={`Loop — ${new Date(e.eventTime).toLocaleDateString()}`}
                      style={{
                        position: "absolute",
                        left: e.x - 7,
                        top: LANE_H / 2 - 7,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        padding: 0,
                        cursor: "pointer",
                        background: m.color,
                        border: `2px solid ${m.color}`,
                        boxShadow: `0 0 6px ${m.color}66`,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel-2)",
              border: `1px solid ${colorOf(selected.userId)}`,
              borderRadius: 12,
              padding: 20,
              minWidth: 240,
              maxWidth: 320,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {athleteOf(selected.userId) ? (
                <a
                  href={stravaProfileUrl(athleteOf(selected.userId)!)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit" }}
                >
                  {selected.displayName}
                </a>
              ) : (
                selected.displayName
              )}
            </div>
            <div style={{ fontSize: 22, marginBottom: 8, color: colorOf(selected.userId) }}>
              🔵 Reservoir loop
            </div>
            {formatDuration(selected.elapsedSeconds) ? (
              <div style={{ marginBottom: 6 }}>
                Loop time <strong>{formatDuration(selected.elapsedSeconds)}</strong>
              </div>
            ) : null}
            {selected.activityName ? (
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}>
                {selected.activityName}
              </div>
            ) : null}
            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              {new Date(selected.eventTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 16,
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid #333c4a",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
        Swipe left/right · each dot is one completed loop · tap for details
        {minT ? ` · since ${new Date(minT).toLocaleDateString()}` : ""}
      </p>
    </div>
  );
}
