import { drizzle } from 'drizzle-orm/postgres-js'
import { connectFourTable, coachSuggestionsTable, computerOpponentTable, playersTable, matchesTable } from './db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { normalizeGameState } from './connectfour';
import type { GameState, Player } from './connectfour';


const db = drizzle(process.env.DATABASE_URL!)

export type GameSummary = {
    id: string
    mode: 'human' | 'computer'
    passwordProtected: boolean
    availableSlots: number
    aiDifficulty?: string
    spectators: number
}

export async function getGames(): Promise<GameSummary[]> {
    const allGames = await db.select().from(connectFourTable)
    return allGames.map(game => {
        const normalized = normalizeGameState(game as GameState)
        const totalHumanSlots = normalized.metadata.mode === 'computer' ? 1 : 2
        const occupiedHumanSlots = Object.values(normalized.metadata.players).filter(slot => slot && slot.role === 'human').length
        return {
            id: normalized.id,
            mode: normalized.metadata.mode,
            passwordProtected: normalized.metadata.passwordProtected,
            availableSlots: Math.max(totalHumanSlots - occupiedHumanSlots, 0),
            aiDifficulty: normalized.metadata.aiDifficulty,
            spectators: normalized.metadata.spectators.length
        }
    })
}

export async function startGame(newGame:GameState) {
    const normalized = normalizeGameState(newGame)
    await db.insert(connectFourTable).values(normalized)
}

export async function playGame(updateGame:GameState) {
    const normalized = normalizeGameState(updateGame)
    await db.update(connectFourTable).set(normalized).where(eq(connectFourTable.id,normalized.id))
}

export async function retrieveGame(id:string) {
    const retrieved = await db.select().from(connectFourTable).where(eq(connectFourTable.id,id))
    const game = retrieved[0]
    if (!game) {
        throw new Error(`Game ${id} not found`)
    }
    return normalizeGameState(game as GameState)
}

export async function listComputerOpponents() {
    return await db.select().from(computerOpponentTable)
}

export async function getCoachSuggestions(positionHash: string) {
    return await db.select().from(coachSuggestionsTable).where(eq(coachSuggestionsTable.positionHash, positionHash))
}

export type PlayerRecord = typeof playersTable.$inferSelect

export async function findPlayerByHandle(handle: string): Promise<PlayerRecord | undefined> {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.handle, handle))
    return player
}

export async function findPlayerById(id: string): Promise<PlayerRecord | undefined> {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id))
    return player
}

export async function ensurePlayer(handle: string, passwordHash: string): Promise<PlayerRecord> {
    const existing = await findPlayerByHandle(handle)
    if (existing) {
        return existing
    }
    const [created] = await db.insert(playersTable).values({
        handle,
        passwordHash
    }).returning()
    return created
}

export async function updateLeaderboardEntry(playerId: string, rating: number, incrementGames: boolean) {
    const setValues = {
        rating,
        lastActiveAt: sql`now()`,
        ...(incrementGames ? { gamesPlayed: sql`${playersTable.gamesPlayed} + 1` } : {})
    }
    await db.update(playersTable)
        .set(setValues as any)
        .where(eq(playersTable.id, playerId))
}

export async function recordMatch(gameId: string, result: 'Red' | 'Yellow' | 'Tie', winnerId?: string, loserId?: string) {
    await db.insert(matchesTable).values({
        gameId,
        result,
        winnerId,
        loserId
    })
}

export async function getLeaderboard(limit = 20) {
    return await db.select()
        .from(playersTable)
        .orderBy(sql`${playersTable.rating} DESC`)
        .limit(limit)
}
