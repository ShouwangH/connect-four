CREATE TYPE "public"."ai_difficulty" AS ENUM('easy', 'medium', 'hard', 'perfect');--> statement-breakpoint
CREATE TABLE "coach_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"positionHash" varchar(128) NOT NULL,
	"suggestedColumn" integer NOT NULL,
	"idealFor" varchar(8) NOT NULL,
	"difficulty" "ai_difficulty" NOT NULL,
	"reason" varchar(512) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "computer_opponents" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"label" varchar(64) NOT NULL,
	"difficulty" "ai_difficulty" DEFAULT 'medium' NOT NULL,
	"algorithm" varchar(64) NOT NULL,
	"searchDepth" integer NOT NULL,
	"metadata" jsonb DEFAULT '{"heuristics":[]}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"currentPlayer" varchar(8) NOT NULL,
	"winner" varchar(8),
	"board" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"gameId" varchar(36) NOT NULL,
	"winner_id" uuid,
	"loser_id" uuid,
	"result" varchar(8) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" varchar(48) NOT NULL,
	"passwordHash" varchar(128) NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"gamesPlayed" integer DEFAULT 0 NOT NULL,
	"lastActiveAt" timestamp with time zone DEFAULT now() NOT NULL
);
