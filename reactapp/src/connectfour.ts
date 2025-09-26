export type GameState = {
    currentPlayer: Player
    board: string[]
    winner: Player | null | 'Tie'
    id: string
}

type Player = 'Red' | 'Yellow'

export const initialGameState: GameState = {
    currentPlayer: 'Red',
    winner: null,
    board: Array(42).fill('none'),
    id: ""
}

export function createGame(): GameState {
    const idinitialGameState = { ...initialGameState, id: crypto.randomUUID() }
    return idinitialGameState
}

export function makeMove(position: number, gameState: GameState): GameState {
    if (gameState.winner) {
        return gameState
    }
    let currentGS = structuredClone(gameState)
    let num = position
    let drop = Math.floor(num / 6)
    for (let i = 5 + drop * 6; i >= drop * 6; i--) {
        if (currentGS.board[i] === 'none') {
            currentGS.board[i] = currentGS.currentPlayer
            currentGS = checkWin(currentGS)
            currentGS.currentPlayer = (gameState.currentPlayer == 'Red') ? 'Yellow' : 'Red'
            return currentGS
        }
    }
    return currentGS
}


function checkWin(gameState: GameState): GameState {
    let currentGS = structuredClone(gameState)
    if (currentGS.board.find(e => e == 'none')) {
        if (checkDiagonalLeft(gameState) || checkDiagonalRight(gameState) ||
            checkHorizontal(gameState) || checkVertical(gameState)) {
            currentGS.winner = gameState.currentPlayer
        }
        return currentGS
    } else {
        currentGS.winner = "Tie"
        return currentGS
    }


}

function checkHorizontal(gameState: GameState): boolean {
    for (var increment = 0; increment <= 6; increment++) {
        var rowCount = 0
        for (var i = 0 + increment; i <= 36 + increment; i += 6)
            if (gameState.board[i] == gameState.currentPlayer) {
                rowCount++
                if (rowCount === 4) {
                    return true
                }
            } else {
                rowCount = 0
            }
    }
    return false
}

function checkVertical(gameState: GameState): boolean {
    for (var increment = 0; increment <= 36; increment += 6) {
        var rowCount = 0
        for (var i = 0 + increment; i <= 5 + increment; i++)
            if (gameState.board[i] == gameState.currentPlayer) {
                rowCount++
                if (rowCount === 4) {
                    return true
                }
            } else {
                rowCount = 0
            }
    }
    return false
}

function checkDiagonalRight(gameState: GameState): boolean {
    for (var increment = 0; increment <= 2; increment++) {
        var rowCount = 0
        for (var i = 3 + increment; i <= 18 + increment * 6; i += 5)
            if (gameState.board[i] == gameState.currentPlayer) {
                rowCount++
                if (rowCount === 4) {
                    return true
                }
            } else {
                rowCount = 0
            }
    }
    for (var increment = 0; increment <= 12; increment += 6) {
        var rowCount = 0
        for (var i = 11 + increment; i <= 36 + increment / 6; i += 5)
            if (gameState.board[i] == gameState.currentPlayer) {
                rowCount++
                if (rowCount === 4) {
                    return true
                }
            } else {
                rowCount = 0
            }
    }
    return false
}

function checkDiagonalLeft(gameState: GameState): boolean {
    for (var increment = 0; increment <= 2; increment++) {
        var rowCount = 0
        for (var i = 2 - increment; i <= 23 + increment * 6; i += 7)
            if (gameState.board[i] == gameState.currentPlayer) {
                rowCount++
                if (rowCount === 4) {
                    return true
                }
            } else {
                rowCount = 0
            }
    }
    for (var increment = 0; increment <= 12; increment += 6) {
        var rowCount = 0
        for (var i = 6 + increment; i <= 41 - increment / 6; i += 7)
            if (gameState.board[i] == gameState.currentPlayer) {
                rowCount++
                if (rowCount === 4) {
                    return true
                }
            } else {
                rowCount = 0
            }
    }
    return false
}