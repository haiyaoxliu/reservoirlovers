CREATE TYPE "public"."activity_status" AS ENUM('pending', 'skipped_prefilter', 'processing', 'processed', 'error', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."loop_event_kind" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"strava_activity_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"status" "activity_status" DEFAULT 'pending' NOT NULL,
	"sport_type" text,
	"name" text,
	"start_date" timestamp with time zone NOT NULL,
	"utc_offset_s" integer,
	"distance_m" real,
	"total_percent" integer DEFAULT 0 NOT NULL,
	"algo_version" integer,
	"processed_at" timestamp with time zone,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_strava_activity_id_unique" UNIQUE("strava_activity_id")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"created_by" bigint,
	"note" text,
	"used_by_athlete_id" bigint,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loop_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"activity_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"kind" "loop_event_kind" NOT NULL,
	"percent" smallint NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"segment_start_time" timestamp with time zone,
	"elapsed_seconds" integer,
	"direction" text,
	"ordinal" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"strava_athlete_id" bigint NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"is_admin" integer DEFAULT 0 NOT NULL,
	"deauthorized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_strava_athlete_id_unique" UNIQUE("strava_athlete_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"object_id" bigint NOT NULL,
	"object_type" text NOT NULL,
	"aspect_type" text NOT NULL,
	"owner_id" bigint NOT NULL,
	"event_time" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_events" ADD CONSTRAINT "loop_events_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_start_idx" ON "activities" USING btree ("user_id","start_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activities_status_idx" ON "activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loop_events_user_time_idx" ON "loop_events" USING btree ("user_id","event_time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "loop_events_activity_idx" ON "loop_events" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_dedupe_idx" ON "webhook_events" USING btree ("object_id","aspect_type","event_time");