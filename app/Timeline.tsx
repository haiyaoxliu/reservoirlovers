"use client";

import { useMemo } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { ExternalLinkIcon } from "./ExternalLinkIcon";
import { Avatar } from "./Avatar";

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
const LABEL_W = 72;
const HEADER_H = 46;
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
  selected,
  onSelect,
}: {
  events: TimelineEvent[];
  members: TimelineMember[];
  selected: TimelineEvent | null;
  onSelect: (e: TimelineEvent) => void;
}) {
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

  if (events.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No loops recorded yet. Go run the reservoir and they&apos;ll appear here.
      </p>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* The rail lives OUTSIDE the scroll container so the elastic overscroll
          bounce at the data's end only moves the dots/markers, never the rail. */}
      <div
        className="bleed"
        style={{
          display: "flex",
          borderTop: "1px solid #232a36",
          borderBottom: "1px solid #232a36",
          background: "var(--panel)",
        }}
      >
        <div
          style={{
            width: LABEL_W,
            flexShrink: 0,
            background: "var(--panel-2)",
            borderRight: "1px solid #232a36",
          }}
        >
          {/* Header cell: the section title heads the date-marker stack the
              same way member avatars head the dot lanes below. */}
          <div
            style={{
              height: HEADER_H,
              display: "flex",
              alignItems: "flex-end",
              padding: "0 8px 6px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Timeline
            </h2>
          </div>
          {members.map((m) => (
            <div
              key={m.userId}
              style={{
                height: LANE_H,
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                borderTop: "1px solid #1b212c",
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
                  justifyContent: "space-between",
                  gap: 6,
                  color: "inherit",
                }}
              >
                <Avatar url={m.avatarUrl} name={m.displayName} color={m.color} />
                <ExternalLinkIcon size={11} />
              </a>
            </div>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ position: "relative", width, minWidth: "100%" }}>
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
                <span style={{ width: 1, height: 4, background: "#333c4a" }} />
              </div>
            ))}
            </div>

          {/* Lanes — dots only; the member rail is outside the scroll area */}
          {members.map((m) => {
            const evs = laneEvents.get(m.userId) ?? [];
            return (
              <div
                key={m.userId}
                style={{ position: "relative", height: LANE_H, borderTop: "1px solid #1b212c" }}
              >
                  {evs.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
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
                        border: `2px solid ${selected?.id === e.id ? "#fff" : m.color}`,
                        boxShadow: `0 0 6px ${m.color}66`,
                      }}
                    />
                  ))}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
        Swipe left/right · each dot is one completed loop · tap for details
        {minT ? ` · since ${new Date(minT).toLocaleDateString()}` : ""}
      </p>
    </div>
  );
}
