import express from 'express'
import session from 'express-session'
import ViteExpress from 'vite-express'
import {
    createInitialGameState,
    makeMove,
    createGame,
    sanitizeGameState,
    chooseAiMove,
    hashBoard,
    type GameState,
    type Player,
    type GameMetadata,
    type PlayerSlot,
    type SpectatorSlot
} from './connectfour'
import {
    getGames,
    startGame,
    retrieveGame,
    playGame,
    listComputerOpponents,
    getCoachSuggestions,
    ensurePlayer,
    findPlayerByHandle,
    findPlayerById,
    updateLeaderboardEntry,
    recordMatch,
    getLeaderboard,
    type PlayerRecord
} from './index'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createHash } from 'node:crypto'

declare module 'express-session' {
    interface SessionData {
        playerId?: string
    }
}

const app = express()
app.use(express.json())

app.use(session({
    secret: process.env.SESSION_SECRET ?? 'c4-local-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60,
        sameSite: 'lax'
    }
}))

app.use((_, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
})

const server = createServer(app)
const serverSocket = new Server(server, {
    cors: {
        origin: "http://localhost:3000"
    }
})

type JoinRole = 'player' | 'spectator'
type JoinRequest = {
    role?: JoinRole
    desiredColor?: Player | 'Any'
    allowCoach?: boolean
    displayName?: string
    password?: string
}

type JoinResponse = {
    role: JoinRole
    color?: Player
    state: GameState
    chatHistory?: SpectatorChatMessage[]
}

type SpectatorChatMessage = {
    id: string
    name: string
    message: string
    timestamp: number
}

const chatHistory = new Map<string, SpectatorChatMessage[]>()

app.post("/auth/login", async (req, res) => {
    const handle = String(req.body?.handle ?? '').trim()
    const password = String(req.body?.password ?? '')

    if (handle.length < 3 || password.length < 4) {
        res.status(400).json({ error: "Handle must be at least 3 characters and password at least 4 characters." })
        return
    }

    try {
        const passwordHash = hashPassword(handle, password)
        const existing = await findPlayerByHandle(handle)
        if (existing) {
            if (existing.passwordHash !== passwordHash) {
                res.status(403).json({ error: "Incorrect credentials." })
                return
            }
            req.session.playerId = existing.id
            res.json({ id: existing.id, handle: existing.handle, rating: existing.rating })
            return
        }

        const created = await ensurePlayer(handle, passwordHash)
        req.session.playerId = created.id
        res.json({ id: created.id, handle: created.handle, rating: created.rating })
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

app.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true })
    })
})

app.get("/auth/me", async (req, res) => {
    if (!req.session.playerId) {
        res.json(null)
        return
    }
    const player = await findPlayerById(req.session.playerId)
    if (!player) {
        res.json(null)
        return
    }
    res.json({ id: player.id, handle: player.handle, rating: player.rating })
})

app.get("/leaderboard", async (_req, res) => {
    const results = await getLeaderboard()
    res.json(results.map(r => ({
        id: r.id,
        handle: r.handle,
        rating: r.rating,
        gamesPlayed: r.gamesPlayed
    })))
})

app.get("/game/:id", async (req, res) => {
    try {
        const id = req.params.id
        const game = await retrieveGame(id)
        res.json(sanitizeGameState(game))
    } catch (err) {
        res.status(404).json({ error: (err as Error).message })
    }
})

app.get("/games", async (_req, res) => {
    const games = await getGames()
    res.json(games)
})

app.get("/computer-opponents", async (_req, res) => {
    const opponents = await listComputerOpponents()
    res.json(opponents)
})

app.post("/create", async (req, res) => {
    try {
        const body = req.body ?? {}
        const metadata: Partial<GameMetadata> = {
            mode: body.mode === 'computer' ? 'computer' : 'human',
            aiDifficulty: normalizeDifficulty(body.aiDifficulty),
            allowSpectatorCoach: body.allowSpectatorCoach !== undefined ? Boolean(body.allowSpectatorCoach) : true,
            spectatorChatEnabled: body.spectatorChatEnabled !== undefined ? Boolean(body.spectatorChatEnabled) : true,
            coachVisibility: ['spectators', 'players', 'all'].includes(body.coachVisibility) ? body.coachVisibility : 'spectators',
            playersRequireSelection: true,
            resultRecorded: false
        }

        if (metadata.mode === 'computer' && !metadata.aiDifficulty) {
            metadata.aiDifficulty = 'hard'
        }

        if (typeof body.password === 'string' && body.password.length > 0) {
            metadata.passwordProtected = true
            metadata.passwordHash = hashPassword('__game__', body.password)
        }

        const newGame = createGame(metadata)
        await startGame(newGame)
        res.json(sanitizeGameState(newGame))
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

app.post("/join/:id", async (req, res) => {
    const id = req.params.id
    const joinBody = req.body as JoinRequest

    try {
        const game = await retrieveGame(id)

        if (game.metadata.passwordProtected) {
            if (!joinBody.password) {
                res.status(403).json({ error: "Password required to join this game." })
                return
            }
            if (!verifyPassword(joinBody.password, game.metadata)) {
                res.status(403).json({ error: "Invalid password." })
                return
            }
        }

        const role: JoinRole = joinBody.role === 'spectator' ? 'spectator' : 'player'

        if (role === 'player') {
            const playerRecord = await requirePlayer(req, res)
            if (!playerRecord) {
                return
            }
            assignPlayerSlot(game, playerRecord, joinBody.desiredColor ?? 'Any', Boolean(joinBody.allowCoach))
        } else {
            const name = String(joinBody.displayName ?? 'Spectator').trim() || 'Spectator'
            assignSpectator(game, name, req.sessionID)
        }

        updateSelectionRequirement(game.metadata)
        await playGame(game)
        await broadcastState(game.id, game)

        const payload: JoinResponse = {
            role,
            color: role === 'player' ? currentPlayerColorForSession(game.metadata, req.session.playerId) : undefined,
            state: sanitizeGameState(game)
        }
        if (role === 'spectator') {
            payload.chatHistory = chatHistory.get(game.id) ?? []
        }
        res.json(payload)
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

app.post("/move/:id", async (req, res) => {
    const id = req.params.id
    const column = Number(req.body.column)

    if (!Number.isInteger(column) || column < 0) {
        res.status(400).json({ error: "Invalid move column." })
        return
    }

    try {
        const playerRecord = await requirePlayer(req, res)
        if (!playerRecord) {
            return
        }

        let game = await retrieveGame(id)
        const playerColor = colorForPlayer(game.metadata, playerRecord.id)
        if (!playerColor) {
            res.status(403).json({ error: "You are not seated as a player in this game." })
            return
        }
        if (game.currentPlayer !== playerColor) {
            res.status(403).json({ error: "It is not your turn." })
            return
        }

        game = makeMove(column, game)

        if (shouldAiMove(game)) {
            game = performAiMove(game)
        }

        await finalizeGameState(game)
        await broadcastState(game.id, game)
        res.json(sanitizeGameState(game))
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

app.post("/reset/:id", async (req, res) => {
    const id = req.params.id
    try {
        const playerRecord = await requirePlayer(req, res)
        if (!playerRecord) {
            return
        }
        const existing = await retrieveGame(id)
        const playerColor = colorForPlayer(existing.metadata, playerRecord.id)
        if (!playerColor) {
            res.status(403).json({ error: "Only active players may reset the game." })
            return
        }

        const resetMeta = resetMetadata(existing.metadata)
        const resetState = createInitialGameState(resetMeta)
        resetState.id = existing.id
        await playGame(resetState)
        await broadcastState(resetState.id, resetState)
        res.json(sanitizeGameState(resetState))
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

app.get("/coach/:id", async (req, res) => {
    const id = req.params.id
    try {
        const game = await retrieveGame(id)
        const identity = await identifyParticipant(req, game.metadata)
        if (!identity) {
            res.status(403).json({ error: "Unable to determine viewer permissions." })
            return
        }

        if (identity.type === 'player') {
            const bothAllow = playersAllowCoach(game.metadata)
            if (!bothAllow && game.metadata.coachVisibility !== 'all') {
                res.status(403).json({ error: "Coach mode not enabled by both players." })
                return
            }
        } else if (identity.type === 'spectator') {
            if (!game.metadata.allowSpectatorCoach) {
                res.status(403).json({ error: "Spectators cannot view coaching tips in this game." })
                return
            }
        }

        const suggestions = await getCoachSuggestions(hashBoard(game.board))
        res.json({ suggestions })
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

app.post("/spectator/chat/:id", async (req, res) => {
    const id = req.params.id
    const message = String(req.body?.message ?? '').trim()
    if (message.length === 0 || message.length > 512) {
        res.status(400).json({ error: "Message must be between 1 and 512 characters." })
        return
    }

    try {
        const game = await retrieveGame(id)
        const identity = await identifyParticipant(req, game.metadata)
        if (!identity || identity.type !== 'spectator') {
            res.status(403).json({ error: "Only spectators may chat." })
            return
        }
        if (!game.metadata.spectatorChatEnabled) {
            res.status(403).json({ error: "Spectator chat is disabled for this game." })
            return
        }
        const spectator = spectatorBySession(game.metadata, req.sessionID)
        const chatMessage: SpectatorChatMessage = {
            id: cryptoId(),
            name: spectator?.name ?? 'Spectator',
            message,
            timestamp: Date.now()
        }
        appendChatMessage(id, chatMessage)
        serverSocket.to(id).emit('spectatorChatMessage', chatMessage)
        res.json(chatMessage)
    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

serverSocket.on('connection', (socket) => {
    socket.on('joinRoom', ({ gameId }: { gameId: string }) => {
        socket.join(gameId)
    })
})

server.listen(4000)
ViteExpress.listen(app, 3000, () => console.log("C4 server is listening..."))

async function broadcastState(gameId: string, state: GameState) {
    serverSocket.to(gameId).emit('gameStateUpdate', sanitizeGameState(state))
}

async function requirePlayer(req: express.Request, res: express.Response): Promise<PlayerRecord | undefined> {
    if (!req.session.playerId) {
        res.status(401).json({ error: "Login required." })
        return undefined
    }
    const player = await findPlayerById(req.session.playerId)
    if (!player) {
        res.status(401).json({ error: "Invalid session." })
        return undefined
    }
    return player
}

async function identifyParticipant(req: express.Request, metadata: GameMetadata):
    Promise<{ type: 'player', color: Player, record: PlayerRecord } | { type: 'spectator', name: string } | null> {
    if (req.session.playerId) {
        const color = colorForPlayer(metadata, req.session.playerId)
        if (color) {
            const record = await findPlayerById(req.session.playerId)
            if (record) {
                return { type: 'player', color, record }
            }
        }
    }
    const spectator = spectatorBySession(metadata, req.sessionID)
    if (spectator) {
        return { type: 'spectator', name: spectator.name }
    }
    return null
}

function assignPlayerSlot(game: GameState, player: PlayerRecord, desiredColor: Player | 'Any', allowCoach: boolean) {
    const color = resolvePlayerColor(game.metadata, desiredColor)
    if (!color) {
        throw new Error("No available player slots.")
    }

    game.metadata.players[color] = {
        playerId: player.id,
        name: player.handle,
        allowCoach,
        role: 'human'
    }

    if (game.metadata.mode === 'computer') {
        const aiColor = determineAiColor(game.metadata) ?? otherColor(color)
        game.metadata.aiColor = aiColor
        game.metadata.players[aiColor] = game.metadata.players[aiColor] ?? {
            name: "Synth AI",
            allowCoach: true,
            role: 'computer'
        }
    }
}

function assignSpectator(game: GameState, name: string, sessionId: string) {
    const sanitizedName = name.slice(0, 24)
    const existing = game.metadata.spectators.find(s => s.sessionId === sessionId)
    if (existing) {
        existing.name = sanitizedName
        return
    }
    const slot: SpectatorSlot = {
        name: sanitizedName,
        sessionId
    }
    game.metadata.spectators.push(slot)
}

function colorForPlayer(metadata: GameMetadata, playerId: string | undefined): Player | undefined {
    if (!playerId) return undefined
    for (const color of ['Red', 'Yellow'] as Player[]) {
        const slot = metadata.players[color]
        if (slot?.playerId === playerId) {
            return color
        }
    }
    return undefined
}

function currentPlayerColorForSession(metadata: GameMetadata, playerId: string | undefined): Player | undefined {
    return colorForPlayer(metadata, playerId)
}

function availableHumanColors(metadata: GameMetadata): Player[] {
    const colors: Player[] = []
    if (!metadata.players.Red || metadata.players.Red.role !== 'human') {
        colors.push('Red')
    }
    if (!metadata.players.Yellow || metadata.players.Yellow.role !== 'human') {
        colors.push('Yellow')
    }
    if (metadata.mode === 'computer' && colors.length > 1) {
        // only one human slot against AI
        return colors.slice(0, 1)
    }
    return colors
}

function resolvePlayerColor(metadata: GameMetadata, desired: Player | 'Any'): Player | undefined {
    const available = availableHumanColors(metadata)
    if (available.length === 0) {
        return undefined
    }
    if (desired === 'Any') {
        return available[Math.floor(Math.random() * available.length)]
    }
    if (available.includes(desired)) {
        return desired
    }
    return available[Math.floor(Math.random() * available.length)]
}

function determineAiColor(metadata: GameMetadata): Player | undefined {
    if (metadata.mode !== 'computer') {
        return undefined
    }
    if (metadata.aiColor) {
        return metadata.aiColor
    }
    if (metadata.players.Red?.role === 'computer') return 'Red'
    if (metadata.players.Yellow?.role === 'computer') return 'Yellow'
    return undefined
}

function shouldAiMove(state: GameState): boolean {
    if (state.metadata.mode !== 'computer' || state.winner) {
        return false
    }
    const aiColor = determineAiColor(state.metadata)
    if (!aiColor) {
        return false
    }
    return state.currentPlayer === aiColor
}

function performAiMove(state: GameState): GameState {
    const aiColor = determineAiColor(state.metadata)
    if (!aiColor) {
        return state
    }
    const difficulty = state.metadata.aiDifficulty ?? 'hard'
    const column = chooseAiMove(state, difficulty, aiColor)
    if (column === -1) {
        return state
    }
    return makeMove(column, state)
}

async function finalizeGameState(state: GameState) {
    if (state.winner && !state.metadata.resultRecorded) {
        await handleGameCompletion(state)
    }
    await playGame(state)
}

async function handleGameCompletion(state: GameState) {
    const winner = state.winner
    state.metadata.resultRecorded = true

    if (!winner) {
        await recordMatch(state.id, 'Tie')
        return
    }

    const redSlot = state.metadata.players.Red
    const yellowSlot = state.metadata.players.Yellow

    if (!redSlot || !yellowSlot || redSlot.role !== 'human' || yellowSlot.role !== 'human' || !redSlot.playerId || !yellowSlot.playerId) {
        await recordMatch(state.id, winner)
        return
    }

    const [redPlayer, yellowPlayer] = await Promise.all([
        findPlayerById(redSlot.playerId),
        findPlayerById(yellowSlot.playerId)
    ])

    if (!redPlayer || !yellowPlayer) {
        await recordMatch(state.id, winner)
        return
    }

    if (winner === 'Tie') {
        const { redRating, yellowRating } = calculateEloOutcome(redPlayer.rating, yellowPlayer.rating, 'Tie')
        await Promise.all([
            updateLeaderboardEntry(redPlayer.id, redRating, true),
            updateLeaderboardEntry(yellowPlayer.id, yellowRating, true),
            recordMatch(state.id, 'Tie')
        ])
        return
    }

    const { redRating, yellowRating } = calculateEloOutcome(redPlayer.rating, yellowPlayer.rating, winner)

    await Promise.all([
        updateLeaderboardEntry(redPlayer.id, redRating, true),
        updateLeaderboardEntry(yellowPlayer.id, yellowRating, true),
        recordMatch(
            state.id,
            winner,
            winner === 'Red' ? redPlayer.id : yellowPlayer.id,
            winner === 'Red' ? yellowPlayer.id : redPlayer.id
        )
    ])
}

function playersAllowCoach(metadata: GameMetadata): boolean {
    const players = Object.values(metadata.players).filter(slot => slot && slot.role === 'human') as PlayerSlot[]
    if (metadata.mode === 'computer') {
        return players.length === 1 && players[0]?.allowCoach
    }
    if (players.length < 2) {
        return false
    }
    return players.every(slot => slot.allowCoach)
}

function spectatorBySession(metadata: GameMetadata, sessionId: string): SpectatorSlot | undefined {
    return metadata.spectators.find(s => s.sessionId === sessionId)
}

function updateSelectionRequirement(metadata: GameMetadata) {
    const humanPlayers = Object.values(metadata.players).filter(slot => slot && slot.role === 'human')
    if (metadata.mode === 'computer') {
        metadata.playersRequireSelection = humanPlayers.length === 0
    } else {
        metadata.playersRequireSelection = humanPlayers.length < 2
    }
}

function resetMetadata(metadata: GameMetadata): GameMetadata {
    const clone: GameMetadata = structuredClone(metadata)
    clone.players = { Red: undefined, Yellow: undefined }
    clone.resultRecorded = false
    clone.playersRequireSelection = true
    clone.spectators = clone.spectators.map(s => ({ name: s.name, sessionId: s.sessionId }))
    if (clone.mode === 'computer') {
        clone.aiColor = undefined
    }
    return clone
}

function hashPassword(handle: string, password: string) {
    return createHash('sha256').update(`${handle.toLowerCase()}:${password}`).digest('hex')
}

function verifyPassword(password: string, metadata: GameMetadata): boolean {
    if (!metadata.passwordHash) {
        return false
    }
    return metadata.passwordHash === hashPassword('__game__', password)
}

function calculateEloOutcome(redRating: number, yellowRating: number, result: Player | 'Tie') {
    const k = 32
    const expectedRed = 1 / (1 + Math.pow(10, (yellowRating - redRating) / 400))
    const expectedYellow = 1 / (1 + Math.pow(10, (redRating - yellowRating) / 400))

    const scoreRed = result === 'Red' ? 1 : result === 'Tie' ? 0.5 : 0
    const scoreYellow = result === 'Yellow' ? 1 : result === 'Tie' ? 0.5 : 0

    return {
        redRating: Math.round(redRating + k * (scoreRed - expectedRed)),
        yellowRating: Math.round(yellowRating + k * (scoreYellow - expectedYellow))
    }
}

function appendChatMessage(gameId: string, message: SpectatorChatMessage) {
    const history = chatHistory.get(gameId) ?? []
    history.push(message)
    if (history.length > 100) {
        history.shift()
    }
    chatHistory.set(gameId, history)
}

function otherColor(color: Player): Player {
    return color === 'Red' ? 'Yellow' : 'Red'
}

function normalizeDifficulty(value: unknown) {
    if (value === 'easy' || value === 'medium' || value === 'hard' || value === 'perfect') {
        return value
    }
    return undefined
}

function cryptoId() {
    return createHash('sha1').update(`${Date.now()}-${Math.random()}`).digest('hex')
}
