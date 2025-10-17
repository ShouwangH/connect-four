import { pgEnum, pgTable, varchar, jsonb, integer, serial, uuid, timestamp } from "drizzle-orm/pg-core";
import type { Board, GameMetadata } from "../connectfour";

export const aiDifficultyEnum = pgEnum("ai_difficulty", ["easy", "medium", "hard", "perfect"]);

export const connectFourTable = pgTable("games", {
    id: varchar({ length: 36 }).primaryKey(),
    currentPlayer: varchar({ length: 8 }).notNull(),
    winner: varchar({ length: 8 }),
    board: jsonb("board").$type<Board>(),
    metadata: jsonb("metadata").$type<GameMetadata>()
});

export type ComputerOpponentMetadata = {
    heuristics: string[]
    notes?: string
    trainedAt?: string
}

export const computerOpponentTable = pgTable("computer_opponents", {
    id: varchar({ length: 36 }).primaryKey(),
    label: varchar({ length: 64 }).notNull(),
    difficulty: aiDifficultyEnum().notNull().default("medium"),
    algorithm: varchar({ length: 64 }).notNull(),
    searchDepth: integer().notNull(),
    metadata: jsonb("metadata").$type<ComputerOpponentMetadata>().default({
        heuristics: []
    })
});

export const coachSuggestionsTable = pgTable("coach_suggestions", {
    id: serial("id").primaryKey(),
    positionHash: varchar({ length: 128 }).notNull(),
    suggestedColumn: integer().notNull(),
    idealFor: varchar({ length: 8 }).notNull(), // Red or Yellow
    difficulty: aiDifficultyEnum().notNull(),
    reason: varchar({ length: 512 }).notNull()
});

export const playersTable = pgTable("players", {
    id: uuid("id").defaultRandom().primaryKey(),
    handle: varchar({ length: 48 }).notNull(),
    passwordHash: varchar({ length: 128 }).notNull(),
    rating: integer().default(1200).notNull(),
    gamesPlayed: integer().default(0).notNull(),
    lastActiveAt: timestamp({ withTimezone: true }).defaultNow().notNull()
});

export const matchesTable = pgTable("matches", {
    id: serial("id").primaryKey(),
    gameId: varchar({ length: 36 }).notNull(),
    winnerId: uuid("winner_id"),
    loserId: uuid("loser_id"),
    result: varchar({ length: 8 }).notNull(), // Red, Yellow, Tie
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
});
