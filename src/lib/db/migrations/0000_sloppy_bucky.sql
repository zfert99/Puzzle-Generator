CREATE TABLE "daily_puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"difficulty" text NOT NULL,
	"grid" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"clue_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solve_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"time_ms" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"mistakes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "solve_attempts" ADD CONSTRAINT "solve_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solve_attempts" ADD CONSTRAINT "solve_attempts_puzzle_id_daily_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."daily_puzzles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_puzzles_date_difficulty_key" ON "daily_puzzles" USING btree ("date","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "solve_attempts_user_puzzle_key" ON "solve_attempts" USING btree ("user_id","puzzle_id");--> statement-breakpoint
CREATE INDEX "solve_attempts_puzzle_time_idx" ON "solve_attempts" USING btree ("puzzle_id","time_ms");