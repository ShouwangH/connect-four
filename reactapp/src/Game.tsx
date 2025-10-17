import './App.css'
import { type GameState, type Player } from "./connectfour"
import Confetti from 'react-confetti'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import type { UserProfile } from './App'

const clientSocket = io("http://localhost:4000")

type CoachSuggestion = {
    id: number
    positionHash: string
    suggestedColumn: number
    idealFor: string
    difficulty: string
    reason: string
}

type SpectatorChatMessage = {
    id: string
    name: string
    message: string
    timestamp: number
}

type JoinRole = 'player' | 'spectator'

type GameSession = {
    role: JoinRole
    color?: Player
    allowCoach: boolean
    spectatorName?: string
}

const sessionStorageKey = (gameId: string) => `connect-four-session-${gameId}`

interface GameProps {
    gameID: string
    handleID: (id: string) => void
    user: UserProfile | null
    isAuthLoading: boolean
}

type SuggestionMarker = {
    reason: string
    difficulty: string
    idealFor: string
}

function Game({ gameID, handleID, user, isAuthLoading }: GameProps) {
    const [hoverCell, setHoverCell] = useState<{ row: number, column: number } | null>(null)
    const [activeCoachTip, setActiveCoachTip] = useState<SuggestionMarker | null>(null)
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [session, setSession] = useState<GameSession | null>(() => loadStoredSession(gameID))
    const [joinOpen, setJoinOpen] = useState(true)
    const [joinError, setJoinError] = useState<string | null>(null)
    const [coachSuggestions, setCoachSuggestions] = useState<CoachSuggestion[]>([])
    const [coachError, setCoachError] = useState<string | null>(null)
    const [chatMessages, setChatMessages] = useState<SpectatorChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isJoining, setIsJoining] = useState(false)

    const [joinForm, setJoinForm] = useState({
        role: 'player' as JoinRole,
        desiredColor: 'Any' as Player | 'Any',
        allowCoach: true,
        spectatorName: '',
        password: ''
    })

    useEffect(() => {
        const handleGameStateUpdate = (newGameState: GameState) => {
            setGameState(newGameState)
            setIsLoading(false)
            setError(null)
        }

        const handleSpectatorChat = (message: SpectatorChatMessage) => {
            setChatMessages(prev => [...prev, message])
        }

        clientSocket.emit('joinRoom', { gameId: gameID })
        clientSocket.on("gameStateUpdate", handleGameStateUpdate)
        clientSocket.on("spectatorChatMessage", handleSpectatorChat)

        return () => {
            clientSocket.off("gameStateUpdate", handleGameStateUpdate)
            clientSocket.off("spectatorChatMessage", handleSpectatorChat)
        }
    }, [gameID])

    const fetchGame = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/game/' + gameID)
            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`)
            }
            const data = await res.json()
            setGameState(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error fetching game')
        } finally {
            setIsLoading(false)
        }
    }, [gameID])

    useEffect(() => {
        fetchGame().catch(() => {})
    }, [fetchGame])

    useEffect(() => {
        if (!gameState) {
            setJoinOpen(true)
            return
        }

        if (gameState.metadata.playersRequireSelection) {
            clearStoredSession(gameID)
            setSession(null)
            setJoinOpen(true)
            return
        }

        if (!session) {
            setJoinOpen(true)
            return
        }

        if (session.role === 'player') {
            if (!session.color) {
                setJoinOpen(true)
                return
            }
            const assignedSlot = gameState.metadata.players[session.color]
            if (!assignedSlot || assignedSlot.name !== user?.handle) {
                clearStoredSession(gameID)
                setSession(null)
                setJoinOpen(true)
            } else {
                setJoinOpen(false)
            }
        } else {
            const isSpectatorPresent = gameState.metadata.spectators.some(s => s.name === session.spectatorName)
            if (!isSpectatorPresent) {
                clearStoredSession(gameID)
                setSession(null)
                setJoinOpen(true)
            } else {
                setJoinOpen(false)
            }
        }
    }, [gameState, session, gameID, user])

    useEffect(() => {
        setCoachSuggestions([])
        setCoachError(null)
        setActiveCoachTip(null)
    }, [gameState?.board])

    const hoverClass = useMemo(() => ({
        Red: "chip chip-red chip-ghost",
        Yellow: "chip chip-yellow chip-ghost"
    }), [])

    const statusClass = useMemo(() => ({
        Red: "chip chip-red",
        Yellow: "chip chip-yellow",
        none: "chip chip-empty"
    }), [])

    const winClass = useMemo(() => ({
        Red: 'victory-banner red',
        Yellow: 'victory-banner yellow',
        Tie: 'victory-banner neutral'
    }), [])

    const suggestionTargets = useMemo(() => {
        if (!gameState) return new Map<string, SuggestionMarker>()
        const map = new Map<string, SuggestionMarker>()
        for (const suggestion of coachSuggestions) {
            const col = suggestion.suggestedColumn
            if (col < 0 || col >= gameState.board[0].length) continue
            for (let row = gameState.board.length - 1; row >= 0; row--) {
                if (gameState.board[row][col] === 'none') {
                    map.set(`${row}-${col}`, {
                        reason: suggestion.reason,
                        difficulty: suggestion.difficulty,
                        idealFor: suggestion.idealFor
                    })
                    break
                }
            }
        }
        return map
    }, [coachSuggestions, gameState])

    const isPlayersTurn = useMemo(() => {
        if (!gameState || !session || session.role !== 'player' || !session.color) {
            return false
        }
        return session.color === gameState.currentPlayer && !gameState.winner
    }, [gameState, session])

    const canReset = session?.role === 'player' && !!session.color
    const canChat = session?.role === 'spectator' && gameState?.metadata.spectatorChatEnabled
    const canRequestCoach = useMemo(() => {
        if (!gameState) {
            return false
        }
        if (session?.role === 'spectator') {
            return gameState.metadata.allowSpectatorCoach
        }
        if (session?.role === 'player' && session.color) {
            const players = gameState.metadata.players
            const redAllows = players.Red?.allowCoach ?? false
            const yellowAllows = players.Yellow?.allowCoach ?? false
            if (gameState.metadata.coachVisibility === 'all') {
                return true
            }
            return redAllows && yellowAllows
        }
        return false
    }, [gameState, session])

    const occupants = useMemo(() => {
        if (!gameState) return []
        return [
            { label: 'Red', value: gameState.metadata.players.Red?.name ?? 'Awaiting', highlight: gameState.currentPlayer === 'Red' },
            { label: 'Yellow', value: gameState.metadata.players.Yellow?.name ?? 'Awaiting', highlight: gameState.currentPlayer === 'Yellow' }
        ]
    }, [gameState])

    const handleClick = async (column: number) => {
        setHoverCell(null)
        if (!session || session.role !== 'player') {
            return
        }
        if (!isPlayersTurn) {
            return
        }
        try {
            const res = await fetch('/move/' + gameID, {
                method: "POST",
                headers: { "content-Type": "application/json" },
                body: JSON.stringify({ column })
            })
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                throw new Error(payload.error ?? `Move failed with status ${res.status}`)
            }
            const updatedState = await res.json()
            setGameState(updatedState)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error submitting move')
        }
    }

    const handleReset = async () => {
        if (!session || session.role !== 'player') {
            return
        }
        try {
            const res = await fetch('/reset/' + gameID, {
                method: "POST",
                headers: { "content-Type": "application/json" }
            })
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                throw new Error(payload.error ?? `Reset failed with status ${res.status}`)
            }
            const resetState = await res.json()
            setGameState(resetState)
            setError(null)
            clearStoredSession(gameID)
            setSession(null)
            setJoinOpen(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error resetting game')
        }
    }

    const handleHover = useCallback((column: number) => {
        if (!gameState || gameState.winner || !isPlayersTurn) {
            setHoverCell(null)
            return
        }

        for (let row = gameState.board.length - 1; row >= 0; row--) {
            if (gameState.board[row][column] === 'none') {
                setHoverCell({ row, column })
                const marker = suggestionTargets.get(`${row}-${column}`)
                setActiveCoachTip(marker ?? null)
                return
            }
        }
        setHoverCell(null)
        setActiveCoachTip(null)
    }, [gameState, isPlayersTurn, suggestionTargets])

    const handleJoinSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setJoinError(null)
        setIsJoining(true)
        try {
            if (joinForm.role === 'player') {
                if (!user) {
                    throw new Error('Sign in before taking a seat.')
                }
            }

            const res = await fetch('/join/' + gameID, {
                method: "POST",
                headers: { "content-Type": "application/json" },
                body: JSON.stringify({
                    role: joinForm.role,
                    desiredColor: joinForm.role === 'player' ? joinForm.desiredColor : undefined,
                    allowCoach: joinForm.allowCoach,
                    displayName: joinForm.role === 'spectator' ? joinForm.spectatorName : undefined,
                    password: joinForm.password || undefined
                })
            })
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                throw new Error(payload.error ?? `Join failed with status ${res.status}`)
            }

            const data = await res.json() as {
                role: JoinRole
                color?: Player
                state: GameState
                chatHistory?: SpectatorChatMessage[]
            }
            setGameState(data.state)

            if (data.chatHistory) {
                setChatMessages(data.chatHistory)
            }

            if (data.role === 'player') {
                const newSession: GameSession = {
                    role: 'player',
                    color: data.color,
                    allowCoach: joinForm.allowCoach
                }
                setSession(newSession)
                storeSession(gameID, newSession)
            } else {
                const newSession: GameSession = {
                    role: 'spectator',
                    allowCoach: false,
                    spectatorName: joinForm.spectatorName || 'Spectator'
                }
                setSession(newSession)
                storeSession(gameID, newSession)
            }
            setJoinOpen(false)
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : 'Unknown error joining game')
        } finally {
            setIsJoining(false)
        }
    }

    const handleCoachRequest = async () => {
        if (!session || !canRequestCoach) {
            return
        }
        setCoachError(null)
        try {
            const res = await fetch(`/coach/${gameID}`)
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                throw new Error(payload.error ?? `Coach request failed with status ${res.status}`)
            }
            const data = await res.json() as { suggestions: CoachSuggestion[] }
            setCoachSuggestions(data.suggestions ?? [])
        } catch (err) {
            setCoachError(err instanceof Error ? err.message : 'Unknown error retrieving suggestions')
        }
    }

    const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canChat || chatInput.trim().length === 0) {
            return
        }
        try {
            const res = await fetch(`/spectator/chat/${gameID}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message: chatInput.trim() })
            })
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                throw new Error(payload.error ?? `Chat failed (${res.status})`)
            }
            setChatInput('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error sending chat message')
        }
    }

    const resetJoinState = () => {
        setJoinError(null)
        setJoinForm({
            role: 'player',
            desiredColor: 'Any',
            allowCoach: true,
            spectatorName: '',
            password: ''
        })
    }

    useEffect(() => {
        if (!joinOpen) {
            resetJoinState()
        }
    }, [joinOpen])

    if (isLoading && !gameState) { return <div className="status-screen">Synchronising skyline grid…</div> }
    if (error && !gameState) { return <div className="status-screen error">Game failed to load: {error}</div> }
    if (!gameState) { return <div className="status-screen">Game unavailable</div> }

    const aiInfo = gameState.metadata.mode === 'computer'
        ? `AI Difficulty: ${(gameState.metadata.aiDifficulty ?? 'hard').toUpperCase()}`
        : 'Solar Duel: Human vs Human'

    return (
        <div className="game-wrap">
            {gameState.winner && <h1 className={winClass[gameState.winner]}>{gameState.winner === 'Tie' ? "Evening Truce" : `${gameState.winner} Ascends`}</h1>}
            {(gameState.winner === 'Red' || gameState.winner === 'Yellow') ? <Confetti /> : ''}
            <div className="arena">
                <div className="board-shell">
                    <div className='board-grid'>
                        {gameState.board.map((row, rowIndex) =>
                            row.map((cell, columnIndex) => {
                                const key = `${rowIndex}-${columnIndex}`
                                const isHover = hoverCell?.row === rowIndex && hoverCell.column === columnIndex
                                const suggestion = suggestionTargets.get(key)
                                const cellClass = isHover
                                    ? hoverClass[gameState.currentPlayer]
                                    : statusClass[cell]
                                const classes = [
                                    cellClass,
                                    suggestion ? 'coach-ghost' : '',
                                    (session?.role !== 'player' || !isPlayersTurn) ? 'disabled-cell' : ''
                                ].join(' ').trim()
                                return (
                                    <div
                                        className={classes}
                                        key={key}
                                        onClick={() => handleClick(columnIndex)}
                                        onMouseEnter={() => {
                                            handleHover(columnIndex)
                                            if (suggestion) {
                                                setActiveCoachTip(suggestion)
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            setHoverCell(null)
                                            setActiveCoachTip(null)
                                        }}
                                    >
                                        {suggestion && <span className="coach-glyph">C</span>}
                                    </div>
                                )
                            })
                        )}
                    </div>
                    <div className="board-underlay" />
                </div>
                {canChat && (
                    <aside className="neon-panel chat">
                        <h2>Skyline Comms</h2>
                        <div className="chat-stream">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className="chat-line">
                                    <span className="chat-name">{msg.name}</span>
                                    <span className="chat-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    <div className="chat-text">{msg.message}</div>
                                </div>
                            ))}
                            {chatMessages.length === 0 && <div className="chat-empty">No transmissions yet.</div>}
                        </div>
                        <form onSubmit={handleChatSubmit} className="chat-input">
                            <input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Broadcast a neon whisper…"
                            />
                            <button type="submit" disabled={chatInput.trim().length === 0}>Send</button>
                        </form>
                    </aside>
                )}
            </div>
            <div className="hud">
                <div className="neon-panel status">
                    <span>{aiInfo}</span>
                    <span>Current Turn: {gameState.currentPlayer}</span>
                    <span>Game ID: {gameState.id}</span>
                </div>
                <div className="neon-panel occupants">
                    {occupants.map(player => (
                        <div key={player.label} className={`seat ${player.highlight ? 'active' : ''}`}>
                            <span>{player.label}</span>
                            <strong>{player.value}</strong>
                        </div>
                    ))}
                </div>
                <div className="hud-actions">
                    <button
                        className="neon-btn danger"
                        onClick={handleReset}
                        disabled={!canReset}
                    >
                        Reset Grid
                    </button>
                    <button
                        className="neon-btn"
                        onClick={() => handleID('')}
                    >
                        Back to Lobby
                    </button>
                    {canRequestCoach && (
                        <button
                            className="neon-btn accent"
                            onClick={handleCoachRequest}
                        >
                            Coach Pulse
                        </button>
                    )}
                </div>
            </div>
            {coachError && <div className="alert error">{coachError}</div>}
            {activeCoachTip && (
                <div className="coach-tooltip">
                    <div className="title">Coach Insight</div>
                    <div>{activeCoachTip.reason}</div>
                    <div className="meta">{activeCoachTip.difficulty.toUpperCase()} • {activeCoachTip.idealFor}</div>
                </div>
            )}
            {error && <div className="alert error">{error}</div>}
            {joinOpen && (
                <div className="modal-backdrop">
                    <form onSubmit={handleJoinSubmit} className="join-modal neon-panel">
                        <h2>Join the Tower</h2>
                        <label className="field">
                            Role
                            <select
                                value={joinForm.role}
                                onChange={(e) => setJoinForm(prev => ({ ...prev, role: e.target.value as JoinRole }))}
                            >
                                <option value="player">Player</option>
                                <option value="spectator">Spectator</option>
                            </select>
                        </label>
                        {gameState.metadata.passwordProtected && (
                            <label className="field">
                                Game Password
                                <input
                                    type="password"
                                    value={joinForm.password}
                                    onChange={(e) => setJoinForm(prev => ({ ...prev, password: e.target.value }))}
                                />
                            </label>
                        )}
                        {joinForm.role === 'player' ? (
                            <>
                                <label className="field">
                                    Preferred Color
                                    <select
                                        value={joinForm.desiredColor}
                                        onChange={(e) => setJoinForm(prev => ({ ...prev, desiredColor: e.target.value as Player | 'Any' }))}
                                    >
                                        <option value="Any">Any</option>
                                        <option value="Red">Red</option>
                                        <option value="Yellow">Yellow</option>
                                    </select>
                                </label>
                                <label className="toggle">
                                    <input
                                        type="checkbox"
                                        checked={joinForm.allowCoach}
                                        onChange={(e) => setJoinForm(prev => ({ ...prev, allowCoach: e.target.checked }))}
                                    />
                                    Share coach insights with my opponent
                                </label>
                                {!user && !isAuthLoading && (
                                    <div className="alert warning">Sign in from the lobby to play.</div>
                                )}
                            </>
                        ) : (
                            <label className="field">
                                Codename
                                <input
                                    value={joinForm.spectatorName}
                                    onChange={(e) => setJoinForm(prev => ({ ...prev, spectatorName: e.target.value }))}
                                    placeholder="Neon Watcher"
                                />
                            </label>
                        )}
                        <button className="neon-btn accent" type="submit" disabled={isJoining || (joinForm.role === 'player' && !user)}>
                            {joinForm.role === 'player' ? 'Take Seat' : 'Watch the Duel'}
                        </button>
                        {joinError && <div className="alert error">{joinError}</div>}
                    </form>
                </div>
            )}
        </div>
    )
}

function loadStoredSession(gameId: string): GameSession | null {
    try {
        const raw = sessionStorage.getItem(sessionStorageKey(gameId))
        if (!raw) return null
        return JSON.parse(raw) as GameSession
    } catch {
        return null
    }
}

function storeSession(gameId: string, session: GameSession) {
    sessionStorage.setItem(sessionStorageKey(gameId), JSON.stringify(session))
}

function clearStoredSession(gameId: string) {
    sessionStorage.removeItem(sessionStorageKey(gameId))
}

export default Game
