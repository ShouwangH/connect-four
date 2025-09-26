import { drizzle } from 'drizzle-orm/postgres-js'
import { connectFourTable } from './db/schema';
import { eq } from 'drizzle-orm';
import type { GameState } from './connectfour';


const db = drizzle(process.env.DATABASE_URL!)

export async function getGames() {
    const allGames = await db.select().from(connectFourTable);
    return allGames.map(game=>game.id) 
}

export async function startGame(newGame:GameState) {
    await db.insert(connectFourTable).values(newGame)
}

export async function playGame(updateGame:GameState) {
    await db.update(connectFourTable).set(updateGame).where(eq(connectFourTable.id,updateGame.id))
}

export async function retrieveGame(id:string) {
    const retrieved = await db.select().from(connectFourTable).where(eq(connectFourTable.id,id))
    return retrieved[0]
}
