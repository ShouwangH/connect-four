export const ROWS = 6
export const COLUMNS = 7

export type Player = 'Red' | 'Yellow'
export type Cell = Player | 'none'
export type Board = Cell[][]
export type AiDifficulty = 'easy' | 'medium' | 'hard' | 'perfect'

export type PlayerSlot = {
    playerId?: string
    name: string
    allowCoach: boolean
    role: 'human' | 'computer'
}

export type SpectatorSlot = {
    name: string
    sessionId?: string
}

export type GameMetadata = {
    mode: 'human' | 'computer'
    aiDifficulty?: AiDifficulty
    aiColor?: Player
    passwordProtected: boolean
    passwordHash?: string
    players: Record<Player, PlayerSlot | undefined>
    spectators: SpectatorSlot[]
    allowSpectatorCoach: boolean
    coachVisibility: 'spectators' | 'players' | 'all'
    spectatorChatEnabled: boolean
    playersRequireSelection: boolean
    resultRecorded?: boolean
}

export type GameState = {
    currentPlayer: Player
    board: Board
    winner: Player | null | 'Tie'
    id: string
    metadata: GameMetadata
}

export type LegacyGameState = Omit<GameState, 'board' | 'metadata'> & { board: string[]; metadata?: Partial<GameMetadata> }

export function createEmptyBoard(): Board {
    return Array.from({ length: ROWS }, () => Array.from({ length: COLUMNS }, () => 'none' as Cell))
}

export function createDefaultMetadata(): GameMetadata {
    return {
        mode: 'human',
        passwordProtected: false,
        players: { Red: undefined, Yellow: undefined },
        spectators: [],
        allowSpectatorCoach: true,
        coachVisibility: 'spectators',
        spectatorChatEnabled: true,
        playersRequireSelection: true,
        resultRecorded: false
    }
}

export function createInitialGameState(overrides?: Partial<GameMetadata>): GameState {
    const metadata = { ...createDefaultMetadata(), ...overrides }
    return {
        currentPlayer: 'Red',
        winner: null,
        board: createEmptyBoard(),
        id: '',
        metadata
    }
}

export function createGame(metadataOverrides?: Partial<GameMetadata>): GameState {
    const newGame = createInitialGameState(metadataOverrides)
    newGame.id = crypto.randomUUID()
    return newGame
}

export function makeMove(column: number, gameState: GameState): GameState {
    if (gameState.winner) {
        return gameState
    }

    if (column < 0 || column >= COLUMNS) {
        return gameState
    }

    const targetRow = findAvailableRow(gameState.board, column)
    if (targetRow === -1) {
        return gameState
    }

    const nextState = structuredClone(gameState)
    const currentPlayer = gameState.currentPlayer

    nextState.board[targetRow][column] = currentPlayer

    if (hasConnectFour(nextState.board, currentPlayer)) {
        nextState.winner = currentPlayer
    } else if (isBoardFull(nextState.board)) {
        nextState.winner = 'Tie'
    } else {
        nextState.currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red'
    }

    return nextState
}

export function cloneBoard(board: Board): Board {
    return board.map(row => [...row])
}

export function normalizeGameState(rawState: GameState | LegacyGameState): GameState {
    const { currentPlayer, winner, id } = rawState
    const board = normalizeBoard(rawState.board)
    const metadata = normalizeMetadata(rawState.metadata)

    return {
        currentPlayer: isPlayer(currentPlayer) ? currentPlayer : 'Red',
        winner: isWinner(winner) ? winner : null,
        id,
        board,
        metadata
    }
}

export function sanitizeGameState(state: GameState): GameState {
    const clone = structuredClone(state)
    clone.metadata.players = {
        Red: clone.metadata.players.Red ? sanitizePlayerSlot(clone.metadata.players.Red) : undefined,
        Yellow: clone.metadata.players.Yellow ? sanitizePlayerSlot(clone.metadata.players.Yellow) : undefined
    }
    clone.metadata.spectators = clone.metadata.spectators.map(sanitizeSpectatorSlot)
    clone.metadata.passwordHash = undefined
    return clone
}

export function hashBoard(board: Board): string {
    return board.map(row => row.join('')).join('|')
}

export function getValidColumns(board: Board): number[] {
    const columns: number[] = []
    for (let col = 0; col < COLUMNS; col++) {
        if (board[0][col] === 'none') {
            columns.push(col)
        }
    }
    return columns
}

export function chooseAiMove(gameState: GameState, difficulty: AiDifficulty, player: Player): number {
    const validColumns = getValidColumns(gameState.board)
    if (validColumns.length === 0) {
        return -1
    }

    if (difficulty === 'easy') {
        return validColumns[Math.floor(Math.random() * validColumns.length)]
    }

    const opponent: Player = player === 'Red' ? 'Yellow' : 'Red'

    // Win immediately if possible
    for (const col of validColumns) {
        const potential = makeHypotheticalMove(gameState, col, player)
        if (potential.winner === player) {
            return col
        }
    }

    // Block opponent win
    for (const col of validColumns) {
        const potential = makeHypotheticalMove(gameState, col, opponent)
        if (potential.winner === opponent) {
            return col
        }
    }

    if (difficulty === 'medium') {
        return centerPreferredColumn(validColumns)
    }

    // Hard / Perfect: simple heuristic evaluation with depth 3 minimax
    const depth = difficulty === 'perfect' ? 5 : 3
    let bestScore = -Infinity
    let bestMove = validColumns[0]

    for (const col of validColumns) {
        const potential = makeHypotheticalMove(gameState, col, player)
        const score = minimax(potential, depth - 1, false, player, opponent, -Infinity, Infinity)
        if (score > bestScore) {
            bestScore = score
            bestMove = col
        }
    }

    return bestMove
}

function minimax(state: GameState, depth: number, maximizing: boolean, player: Player, opponent: Player, alpha: number, beta: number): number {
    if (state.winner === player) {
        return 1000 + depth
    }
    if (state.winner === opponent) {
        return -1000 - depth
    }
    if (state.winner === 'Tie' || depth === 0) {
        return evaluateBoard(state.board, player)
    }

    const validColumns = getValidColumns(state.board)
    if (validColumns.length === 0) {
        return 0
    }

    if (maximizing) {
        let maxEval = -Infinity
        for (const col of validColumns) {
            const child = makeHypotheticalMove(state, col, player)
            const evalScore = minimax(child, depth - 1, false, player, opponent, alpha, beta)
            maxEval = Math.max(maxEval, evalScore)
            alpha = Math.max(alpha, evalScore)
            if (beta <= alpha) {
                break
            }
        }
        return maxEval
    } else {
        let minEval = Infinity
        for (const col of validColumns) {
            const child = makeHypotheticalMove(state, col, opponent)
            const evalScore = minimax(child, depth - 1, true, player, opponent, alpha, beta)
            minEval = Math.min(minEval, evalScore)
            beta = Math.min(beta, evalScore)
            if (beta <= alpha) {
                break
            }
        }
        return minEval
    }
}

function evaluateBoard(board: Board, player: Player): number {
    const opponent: Player = player === 'Red' ? 'Yellow' : 'Red'
    return scorePosition(board, player) - scorePosition(board, opponent)
}

function scorePosition(board: Board, player: Player): number {
    const patterns: Array<{ row: number; col: number }> = [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: -1 }
    ]

    let score = 0

    // Center column preference
    const centerColumn = Math.floor(COLUMNS / 2)
    let centerCount = 0
    for (let row = 0; row < ROWS; row++) {
        if (board[row][centerColumn] === player) {
            centerCount++
        }
    }
    score += centerCount * 3

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLUMNS; col++) {
            for (const { row: dRow, col: dCol } of patterns) {
                const window = collectWindow(board, row, col, dRow, dCol, 4)
                if (!window) {
                    continue
                }
                score += evaluateWindow(window, player)
            }
        }
    }

    return score
}

function evaluateWindow(window: Cell[], player: Player): number {
    const opponent: Player = player === 'Red' ? 'Yellow' : 'Red'
    const playerCount = window.filter(cell => cell === player).length
    const opponentCount = window.filter(cell => cell === opponent).length
    const emptyCount = window.filter(cell => cell === 'none').length

    if (playerCount === 4) return 100
    if (playerCount === 3 && emptyCount === 1) return 10
    if (playerCount === 2 && emptyCount === 2) return 5
    if (opponentCount === 3 && emptyCount === 1) return -8
    if (opponentCount === 4) return -100
    return 0
}

function collectWindow(board: Board, startRow: number, startCol: number, dRow: number, dCol: number, length: number): Cell[] | null {
    const window: Cell[] = []
    for (let i = 0; i < length; i++) {
        const row = startRow + i * dRow
        const col = startCol + i * dCol
        if (row < 0 || row >= ROWS || col < 0 || col >= COLUMNS) {
            return null
        }
        window.push(board[row][col])
    }
    return window
}

function makeHypotheticalMove(gameState: GameState, column: number, player: Player): GameState {
    const clone = structuredClone(gameState)
    if (clone.winner) {
        return clone
    }

    const row = findAvailableRow(clone.board, column)
    if (row === -1) {
        return clone
    }
    clone.board[row][column] = player

    if (hasConnectFour(clone.board, player)) {
        clone.winner = player
        clone.currentPlayer = player
        return clone
    }

    clone.currentPlayer = player === 'Red' ? 'Yellow' : 'Red'
    if (isBoardFull(clone.board)) {
        clone.winner = 'Tie'
    }

    return clone
}

function centerPreferredColumn(validColumns: number[]): number {
    const sorted = [...validColumns].sort((a, b) => Math.abs(a - Math.floor(COLUMNS / 2)) - Math.abs(b - Math.floor(COLUMNS / 2)))
    return sorted[0]
}

function findAvailableRow(board: Board, column: number): number {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row][column] === 'none') {
            return row
        }
    }
    return -1
}

function hasConnectFour(board: Board, player: Player): boolean {
    const directions = [
        { row: 0, col: 1 },   // horizontal
        { row: 1, col: 0 },   // vertical
        { row: 1, col: 1 },   // diagonal down-right
        { row: 1, col: -1 }   // diagonal down-left
    ]

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLUMNS; col++) {
            if (board[row][col] !== player) {
                continue
            }

            for (const { row: rowDelta, col: colDelta } of directions) {
                let count = 1
                let currentRow = row + rowDelta
                let currentCol = col + colDelta

                while (
                    currentRow >= 0 && currentRow < ROWS &&
                    currentCol >= 0 && currentCol < COLUMNS &&
                    board[currentRow][currentCol] === player
                ) {
                    count++
                    if (count === 4) {
                        return true
                    }
                    currentRow += rowDelta
                    currentCol += colDelta
                }
            }
        }
    }

    return false
}

function isBoardFull(board: Board): boolean {
    return board.every(row => row.every(cell => cell !== 'none'))
}

function normalizeBoard(board: Board | string[]): Board {
    if (isMatrixBoard(board)) {
        return board.map(row => row.map(cell => (isCell(cell) ? cell : 'none')))
    }

    if (Array.isArray(board) && board.length === ROWS * COLUMNS) {
        const normalizedBoard = createEmptyBoard()
        board.forEach((cell, index) => {
            if (!isCell(cell)) {
                return
            }
            const column = Math.floor(index / ROWS)
            const row = index % ROWS
            normalizedBoard[row][column] = cell
        })
        return normalizedBoard
    }

    return createEmptyBoard()
}

function normalizeMetadata(metadata: Partial<GameMetadata> | undefined): GameMetadata {
    const defaults = createDefaultMetadata()
    if (!metadata) {
        return defaults
    }

    const normalized: GameMetadata = {
        ...defaults,
        ...metadata,
        players: {
            Red: metadata.players?.Red ? normalizePlayerSlot(metadata.players.Red) : undefined,
            Yellow: metadata.players?.Yellow ? normalizePlayerSlot(metadata.players.Yellow) : undefined
        },
        spectators: Array.isArray(metadata.spectators) ? metadata.spectators.map(normalizeSpectatorSlot) : [],
        coachVisibility: metadata.coachVisibility ?? defaults.coachVisibility,
        passwordProtected: Boolean(metadata.passwordProtected),
        passwordHash: metadata.passwordHash,
        allowSpectatorCoach: metadata.allowSpectatorCoach ?? defaults.allowSpectatorCoach,
        spectatorChatEnabled: metadata.spectatorChatEnabled ?? defaults.spectatorChatEnabled,
        playersRequireSelection: metadata.playersRequireSelection ?? defaults.playersRequireSelection,
        resultRecorded: metadata.resultRecorded ?? defaults.resultRecorded,
        mode: metadata.mode === 'computer' ? 'computer' : 'human',
        aiDifficulty: metadata.aiDifficulty,
        aiColor: metadata.aiColor
    }

    if (metadata.mode === 'computer' && !normalized.aiColor) {
        normalized.aiColor = 'Yellow'
    }

    return normalized
}

function normalizePlayerSlot(slot: PlayerSlot): PlayerSlot {
    return {
        playerId: slot.playerId,
        name: slot.name,
        allowCoach: Boolean(slot.allowCoach),
        role: slot.role === 'computer' ? 'computer' : 'human'
    }
}

function normalizeSpectatorSlot(slot: SpectatorSlot): SpectatorSlot {
    return {
        name: slot.name,
        sessionId: slot.sessionId
    }
}

function sanitizePlayerSlot(slot: PlayerSlot): PlayerSlot {
    return {
        ...slot,
        playerId: slot.role === 'human' ? slot.playerId : undefined
    }
}

function sanitizeSpectatorSlot(slot: SpectatorSlot): SpectatorSlot {
    return {
        name: slot.name
    }
}

function isMatrixBoard(value: unknown): value is Board {
    if (!Array.isArray(value) || value.length !== ROWS) {
        return false
    }

    return value.every(
        row =>
            Array.isArray(row) &&
            row.length === COLUMNS &&
            row.every(cell => isCell(cell))
    )
}

function isCell(value: unknown): value is Cell {
    return value === 'Red' || value === 'Yellow' || value === 'none'
}

function isPlayer(value: unknown): value is Player {
    return value === 'Red' || value === 'Yellow'
}

function isWinner(value: unknown): value is Player | 'Tie' | null {
    return value === 'Red' || value === 'Yellow' || value === 'Tie' || value === null
}
