CREATE TABLE "accept_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accept_overrides" ADD CONSTRAINT "accept_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accept_overrides" ADD CONSTRAINT "accept_overrides_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accept_overrides_user_ex_idx" ON "accept_overrides" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accept_overrides_unique" ON "accept_overrides" USING btree ("user_id","exercise_id","answer");