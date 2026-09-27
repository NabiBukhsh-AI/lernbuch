-- Hand-edited: drizzle-kit recreates the enum, which fails on existing 'owner' rows. A rename keeps them.
ALTER TYPE "public"."role" RENAME VALUE 'owner' TO 'admin';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_admin_uq" ON "users" USING btree ("role") WHERE "users"."role" = 'admin';--> statement-breakpoint
DROP TABLE "login_attempts";--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_events_key_time_idx" ON "rate_limit_events" USING btree ("key","created_at");
