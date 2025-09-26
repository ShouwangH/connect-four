import { pgTable, varchar, jsonb } from "drizzle-orm/pg-core";

export const connectFourTable = pgTable("games",{
    id: varchar({length: 36}).primaryKey(),
    currentPlayer: varchar({length: 8}).notNull(),
    winner: varchar({length: 8}),
    board: jsonb().$type<Board>()
})