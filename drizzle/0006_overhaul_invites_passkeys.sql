ALTER TABLE "invites" ADD COLUMN "kind" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "bound_athlete_id" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_backfill_at" timestamp with time zone;