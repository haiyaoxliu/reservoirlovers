"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/queries";

export interface TimelineMember {
  userId: number;
  displayName: string;
  color: string;
}

const PX_PER_DAY = 42;
const LANE_H = 46;
const LABEL_W = 120;
const PAD_DAYS = 1;
const DAY_MS = 86400000;

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

  const { laneEvents, width, months, minT } = useMemo(() => {
    if (events.length === 0) {
      return { laneEvents: new Map<number, Positioned[]>(), width: 400, months: [], minT: 0 };
    }
    const times = events.map((e) => new Date(e.eventTime).getTime());
    const min = Math.min(...times) - PAD_DAYS * DAY_MS;
    const max = Math.max(...times) + PAD_DAYS * DAY_MS;
    const w = ((max - min) / DAY_MS) * PX_PER_DAY;

    const byLane = new Map<number, Positioned[]>();
    for (const m of members) byLane.set(m.userId, []);
    for (const e of events) {
      const x = ((new Date(e.eventTime).getTime() - min) / DAY_MS) * PX_PER_DAY;
      byLane.get(e.userId)?.push({ ...e, x });
    }

    const monthTicks: { x: number; label: string }[] = [];
    const start = new Date(min);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor.getTime() <= max) {
      const x = ((cursor.getTime() - min) / DAY_MS) * PX_PER_DAY;
      monthTicks.push({
        x,
        label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { laneEvents: byLane, width: w, months: monthTicks, minT: min };
  }, [events, members]);

  const colorOf = useMemo(() => {
    const m = new Map(members.map((x) => [x.userId, x.color]));
    return (id: number) => m.get(id) ?? "#888";
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
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          border: "1px solid #232a36",
          borderRadius: 12,
          background: "var(--panel)",
        }}
      >
        <div style={{ position: "relative", width: LABEL_W + width, minWidth: "100%" }}>
          {/* Month header */}
          <div style={{ position: "relative", height: 24, marginLeft: LABEL_W }}>
            {months.map((mo, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: mo.x,
                  top: 4,
                  fontSize: 11,
                  color: "var(--muted)",
                  borderLeft: "1px solid #232a36",
                  paddingLeft: 4,
                  height: 16,
                }}
              >
                {mo.label}
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
                  <span
                    style={{
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.displayName}
                  </span>
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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{selected.displayName}</div>
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
