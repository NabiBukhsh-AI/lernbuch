CREATE TYPE "public"."exercise_scope" AS ENUM('classwork', 'homework', 'quiz', 'drill');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('fill_blank', 'mcq', 'multi_select', 'true_false', 'match', 'order_words', 'translate_de_en', 'translate_en_de', 'transform', 'conjugate', 'gender_pick', 'case_pick', 'short_answer', 'dialogue', 'listening', 'cloze');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('der', 'die', 'das', 'plural', 'none');--> statement-breakpoint
CREATE TYPE "public"."pos" AS ENUM('noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pronoun', 'numeral', 'phrase', 'particle');--> statement-breakpoint
CREATE TYPE "public"."quiz_kind" AS ENUM('practice', 'graded', 'review');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'learner');--> statement-breakpoint
CREATE TYPE "public"."section_kind" AS ENUM('overview', 'pronunciation', 'culture', 'notes', 'takeaways');--> statement-breakpoint
CREATE TYPE "public"."content_source" AS ENUM('authored', 'generated');--> statement-breakpoint
CREATE TYPE "public"."srs_grade" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."srs_item" AS ENUM('vocab', 'grammar', 'phrase');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('not_started', 'in_progress', 'completed', 'mastered');--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"exercise_id" text,
	"user_answer" jsonb,
	"is_correct" boolean,
	"verdict" text,
	"points_awarded" numeric(5, 2),
	"hints_used" integer DEFAULT 0 NOT NULL,
	"time_ms" integer
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quiz_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" numeric(5, 2),
	"max_score" numeric(5, 2),
	"duration_sec" integer,
	"passed" boolean
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"quiz_id" text,
	"scope" "exercise_scope" NOT NULL,
	"order_index" integer NOT NULL,
	"type" "exercise_type" NOT NULL,
	"prompt_md" text NOT NULL,
	"instruction_md" text,
	"given" jsonb,
	"answer" jsonb NOT NULL,
	"accept" jsonb,
	"solution_md" text,
	"why_md" text,
	"takeaway_md" text,
	"tips" text[] DEFAULT '{}'::text[] NOT NULL,
	"hints" jsonb,
	"skill_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"vocab_refs" text[] DEFAULT '{}'::text[] NOT NULL,
	"grammar_refs" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty" integer DEFAULT 2 NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"due_date" date,
	"reveal_policy" text DEFAULT 'on_request' NOT NULL,
	"source" "content_source" DEFAULT 'authored' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_points" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"title" text NOT NULL,
	"cefr" text,
	"rule_md" text NOT NULL,
	"pattern_md" text,
	"tables" jsonb,
	"examples" jsonb,
	"contrast_md" text,
	"common_mistakes" jsonb,
	"tips" text[] DEFAULT '{}'::text[] NOT NULL,
	"memory_hook" text,
	"skill_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"related_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty" integer DEFAULT 2 NOT NULL,
	"source" "content_source" DEFAULT 'authored' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_slug" text,
	"file_hash" text,
	"action" text,
	"stats" jsonb,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"kind" "section_kind" NOT NULL,
	"order_index" integer NOT NULL,
	"title" text,
	"body_md" text NOT NULL,
	"tips_md" text
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"lesson_number" integer,
	"class_date" date NOT NULL,
	"level" text NOT NULL,
	"course" text,
	"title" text NOT NULL,
	"subtitle" text,
	"summary_md" text,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"prerequisites" text[] DEFAULT '{}'::text[] NOT NULL,
	"duration_min" integer,
	"publish" boolean DEFAULT true NOT NULL,
	"file_hash" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"successful" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mistakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text,
	"exercise_id" text,
	"skill_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"expected" text NOT NULL,
	"got" text NOT NULL,
	"note_md" text,
	"origin" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text,
	"anchor_id" text,
	"body_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"status" "lesson_status" DEFAULT 'not_started' NOT NULL,
	"classwork_done" integer DEFAULT 0 NOT NULL,
	"classwork_total" integer DEFAULT 0 NOT NULL,
	"homework_done" integer DEFAULT 0 NOT NULL,
	"homework_total" integer DEFAULT 0 NOT NULL,
	"quiz_best_score" numeric(5, 2),
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" "quiz_kind" DEFAULT 'practice' NOT NULL,
	"time_limit_sec" integer,
	"pass_score" integer DEFAULT 70 NOT NULL,
	"shuffle" boolean DEFAULT true NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "skill_stats" (
	"user_id" text NOT NULL,
	"skill_tag" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"rolling_score" numeric(5, 2),
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "skill_stats_user_id_skill_tag_pk" PRIMARY KEY("user_id","skill_tag")
);
--> statement-breakpoint
CREATE TABLE "srs_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_type" "srs_item" NOT NULL,
	"item_id" text NOT NULL,
	"ease" numeric(4, 2) DEFAULT '2.50' NOT NULL,
	"interval_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_grade" "srs_grade",
	"suspended" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"cards_reviewed" integer DEFAULT 0 NOT NULL,
	"kind" text
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text,
	"user_answer" jsonb,
	"is_correct" boolean,
	"verdict" text,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"solution_revealed" boolean DEFAULT false NOT NULL,
	"time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" DEFAULT 'learner' NOT NULL,
	"target_level" text DEFAULT 'A1.1',
	"daily_goal" integer DEFAULT 20 NOT NULL,
	"strict_mode" boolean DEFAULT false NOT NULL,
	"show_urdu" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vocab_items" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"de" text NOT NULL,
	"article" "gender" DEFAULT 'none' NOT NULL,
	"plural" text,
	"pos" "pos" NOT NULL,
	"en" text NOT NULL,
	"ur" text,
	"ipa" text,
	"example_de" text,
	"example_en" text,
	"gender_tip" text,
	"usage_tip" text,
	"collocations" text[] DEFAULT '{}'::text[] NOT NULL,
	"synonyms" text[] DEFAULT '{}'::text[] NOT NULL,
	"antonyms" text[] DEFAULT '{}'::text[] NOT NULL,
	"false_friend" text,
	"register" text DEFAULT 'neutral',
	"cefr" text,
	"verb_forms" jsonb,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"srs_enabled" boolean DEFAULT true NOT NULL,
	"source" "content_source" DEFAULT 'authored' NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(de, '') || ' ' || coalesce(plural, '') || ' ' || coalesce(en, '') || ' ' || coalesce(example_de, '') || ' ' || coalesce(example_en, ''))) STORED
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_points" ADD CONSTRAINT "grammar_points_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sections" ADD CONSTRAINT "lesson_sections_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_stats" ADD CONSTRAINT "skill_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_items" ADD CONSTRAINT "vocab_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercises_lesson_scope_idx" ON "exercises" USING btree ("lesson_id","scope","order_index");--> statement-breakpoint
CREATE INDEX "lessons_class_date_idx" ON "lessons" USING btree ("class_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "login_attempts_username_time_idx" ON "login_attempts" USING btree ("username","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "srs_cards_user_item_uq" ON "srs_cards" USING btree ("user_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "srs_due_idx" ON "srs_cards" USING btree ("user_id","due_at") WHERE "srs_cards"."suspended" = false;--> statement-breakpoint
CREATE INDEX "submissions_user_ex_idx" ON "submissions" USING btree ("user_id","exercise_id","attempt_no" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vocab_de_idx" ON "vocab_items" USING btree (lower("de"));--> statement-breakpoint
CREATE INDEX "vocab_tsv_idx" ON "vocab_items" USING gin ("search_tsv");