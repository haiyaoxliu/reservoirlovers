import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const activityStatus = pgEnum("activity_status", [
  "pending",
  "skipped_prefilter",
  "processing",
  "processed",
  "error",
  "deleted",
]);

export const loopEventKind = pgEnum("loop_event_kind", ["full", "partial"]);

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  stravaAthleteId: bigint("strava_athlete_id", { mode: "number" }).notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  // Tokens are encrypted at rest by the app layer (see src/lib/crypto.ts).
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  isAdmin: integer("is_admin").notNull().default(0),
  deauthorizedAt: timestamp("deauthorized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activities = pgTable(
  "activities",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    stravaActivityId: bigint("strava_activity_id", { mode: "number" })
      .notNull()
      .unique(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    status: activityStatus("status").notNull().default("pending"),
    sportType: text("sport_type"),
    name: text("name"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    utcOffsetS: integer("utc_offset_s"),
    distanceM: real("distance_m"),
    totalPercent: integer("total_percent").notNull().default(0),
    algoVersion: integer("algo_version"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activities_user_start_idx").on(t.userId, t.startDate.desc()),
    index("activities_status_idx").on(t.status),
  ],
);

export const loopEvents = pgTable(
  "loop_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    activityId: bigint("activity_id", { mode: "number" })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    kind: loopEventKind("kind").notNull(),
    percent: smallint("percent").notNull(),
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
    segmentStartTime: timestamp("segment_start_time", { withTimezone: true }),
    elapsedSeconds: integer("elapsed_seconds"),
    direction: text("direction"),
    /** Loop position (checkpoint 0-99) where the event ended; null on rows
     *  processed before ALGO_VERSION 4. */
    endP: smallint("end_p"),
    ordinal: smallint("ordinal").notNull(),
  },
  (t) => [
    index("loop_events_user_time_idx").on(t.userId, t.eventTime.desc()),
    index("loop_events_activity_idx").on(t.activityId),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    objectId: bigint("object_id", { mode: "number" }).notNull(),
    objectType: text("object_type").notNull(),
    aspectType: text("aspect_type").notNull(),
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
    eventTime: bigint("event_time", { mode: "number" }).notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("webhook_dedupe_idx").on(t.objectId, t.aspectType, t.eventTime),
  ],
);

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  createdBy: bigint("created_by", { mode: "number" }),
  usedByAthleteId: bigint("used_by_athlete_id", { mode: "number" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type LoopEventRow = typeof loopEvents.$inferSelect;
export type Invite = typeof invites.$inferSelect;
