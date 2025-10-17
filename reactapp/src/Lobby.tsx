import { useCallback, useEffect, useMemo, useState } from "react"
import type { UserProfile } from "./App"

interface LobbyProps {
    handleID: (id: string) => void
    user: UserProfile | null
    onLogin: (handle: string, password: string) => Promise<void>
    onLogout: () => Promise<void>
    isAuthLoading: boolean
    refreshProfile: () => Promise<void>
}

type Opponent = {
    id: string
    label: string
    difficulty: string
    algorithm: string
    searchDepth: number
}

type CreateMode = 'human' | 'computer'

type GameSummary = {
    id: string
    mode: 'human' | 'computer'
    passwordProtected: boolean
    availableSlots: number
    aiDifficulty?: string
    spectators: number
}

type LeaderboardEntry = {
    id: string
    handle: string
    rating: number
    gamesPlayed: number
}

function Lobby({ handleID, user, onLogin, onLogout, isAuthLoading, refreshProfile }: LobbyProps) {
    const [games, setGames] = useState<GameSummary[]>([])
    const [opponents, setOpponents] = useState<Opponent[]>([])
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [createError, setCreateError] = useState<string | null>(null)
    const [authError, setAuthError] = useState<string | null>(null)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [createMode, setCreateMode] = useState<CreateMode>('human')
    const [selectedDifficulty, setSelectedDifficulty] = useState('hard')
    const [password, setPassword] = useState('')
    const [allowSpectatorCoach, setAllowSpectatorCoach] = useState(true)
    const [spectatorChatEnabled, setSpectatorChatEnabled] = useState(true)
    const [coachVisibility, setCoachVisibility] = useState<'spectators' | 'players' | 'all'>('spectators')
    const [loginForm, setLoginForm] = useState({ handle: '', password: '' })

    const availableDifficulties = useMemo(() => {
        const difficulties = opponents.map(o => o.difficulty)
        const defaults = ['easy', 'medium', 'hard', 'perfect']
        return Array.from(new Set([...difficulties, ...defaults]))
    }, [opponents])

    const fetchGames = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/games')
            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`)
            }
            const data = await res.json()
            setGames(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error retrieving games')
        } finally {
            setIsLoading(false)
        }
    }, [])

    const fetchOpponents = useCallback(async () => {
        try {
            const res = await fetch('/computer-opponents')
            if (!res.ok) {
                throw new Error(`Failed to load opponents: ${res.status}`)
            }
            const data = await res.json()
            setOpponents(data)
        } catch (err) {
            console.warn(err)
        }
    }, [])

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await fetch('/leaderboard')
            if (!res.ok) {
                throw new Error(`Failed to load leaderboard: ${res.status}`)
            }
            const data = await res.json()
            setLeaderboard(data)
        } catch (err) {
            console.warn(err)
        }
    }, [])

    useEffect(() => {
        fetchGames().catch(() => {})
        fetchOpponents().catch(() => {})
        fetchLeaderboard().catch(() => {})
    }, [fetchGames, fetchOpponents, fetchLeaderboard])

    const handleCreate = useCallback(async () => {
        setCreateError(null)
        try {
            const payload: Record<string, unknown> = {
                mode: createMode,
                allowSpectatorCoach,
                spectatorChatEnabled,
                coachVisibility
            }
            if (createMode === 'computer') {
                payload.aiDifficulty = selectedDifficulty
            }
            if (password.trim().length > 0) {
                payload.password = password
            }

            const res = await fetch('/create', {
                method: "POST",
                headers: { "content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const errPayload = await res.json().catch(() => ({}))
                throw new Error(errPayload.error ?? `Create game failed with status ${res.status}`)
            }
            const newData = await res.json()
            if (newData?.id) {
                handleID(newData.id)
            } else {
                await fetchGames()
            }
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Unknown error creating game')
        }
    }, [createMode, selectedDifficulty, password, allowSpectatorCoach, spectatorChatEnabled, coachVisibility, handleID, fetchGames])

    const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setAuthError(null)
        setIsLoggingIn(true)
        try {
            await onLogin(loginForm.handle.trim(), loginForm.password)
            await refreshProfile()
            setLoginForm({ handle: '', password: '' })
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Unable to sign in')
        } finally {
            setIsLoggingIn(false)
        }
    }

    const handleLogoutClick = async () => {
        await onLogout()
        await refreshProfile()
    }

    if (isLoading) { return <div className="status-screen">Scanning neon skyline…</div> }
    if (error) { return <div className="status-screen error">Error finding games: {error}</div> }

    return (
        <div className="lobby-grid">
            <section className="neon-panel auth">
                <h2>Identity</h2>
                {user ? (
                    <>
                        <div className="identity-card">
                            <span className="handle">{user.handle}</span>
                            <span className="rating">{user.rating}</span>
                        </div>
                        <button className="neon-btn danger" onClick={handleLogoutClick}>Sign out</button>
                    </>
                ) : (
                    <form onSubmit={handleLoginSubmit} className="auth-form">
                        <label className="field">
                            Handle
                            <input
                                value={loginForm.handle}
                                onChange={(e) => setLoginForm(prev => ({ ...prev, handle: e.target.value }))}
                                placeholder="RainRunner"
                                disabled={isLoggingIn || isAuthLoading}
                            />
                        </label>
                        <label className="field">
                            Passphrase
                            <input
                                type="password"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="••••"
                                disabled={isLoggingIn || isAuthLoading}
                            />
                        </label>
                        <button className="neon-btn accent" type="submit" disabled={isLoggingIn || loginForm.handle.trim().length < 3 || loginForm.password.length < 4}>
                            {isLoggingIn ? 'Linking…' : 'Link Neon ID'}
                        </button>
                        {authError && <div className="alert error">{authError}</div>}
                    </form>
                )}
            </section>

            <section className="neon-panel create">
                <h2>Spin Up Arena</h2>
                <label className="field">
                    Mode
                    <select
                        value={createMode}
                        onChange={(e) => setCreateMode(e.target.value as CreateMode)}
                    >
                        <option value="human">Human vs Human</option>
                        <option value="computer">Vs Synth AI</option>
                    </select>
                </label>
                {createMode === 'computer' && (
                    <label className="field">
                        AI Difficulty
                        <select
                            value={selectedDifficulty}
                            onChange={(e) => setSelectedDifficulty(e.target.value)}
                        >
                            {availableDifficulties.map(diff => (
                                <option key={diff} value={diff}>{diff.toUpperCase()}</option>
                            ))}
                        </select>
                    </label>
                )}
                <label className="field">
                    Password (optional)
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="For private duels"
                    />
                </label>
                <label className="toggle">
                    <input
                        type="checkbox"
                        checked={allowSpectatorCoach}
                        onChange={(e) => setAllowSpectatorCoach(e.target.checked)}
                    />
                    Allow spectator coach mode
                </label>
                <label className="toggle">
                    <input
                        type="checkbox"
                        checked={spectatorChatEnabled}
                        onChange={(e) => setSpectatorChatEnabled(e.target.checked)}
                    />
                    Enable skyline chat
                </label>
                <label className="field">
                    Coach visibility
                    <select
                        value={coachVisibility}
                        onChange={(e) => setCoachVisibility(e.target.value as typeof coachVisibility)}
                    >
                        <option value="spectators">Spectators only</option>
                        <option value="players">Players (if both allow)</option>
                        <option value="all">Always visible</option>
                    </select>
                </label>
                <button
                    onClick={handleCreate}
                    className='neon-btn accent'
                >
                    Launch Arena
                </button>
                {createError && <div className="alert error">{createError}</div>}
            </section>

    <section className="neon-panel games">
                <header className="panel-head">
                    <h2>Active Circuits</h2>
                    <button onClick={() => { fetchGames().catch(() => {}); fetchLeaderboard().catch(() => {}) }} className='text-link'>Refresh</button>
                </header>
                {games.length === 0 && <div className="panel-empty">No arenas glowing yet.</div>}
                <ul className="game-list">
                    {games.map(game => (
                        <li key={game.id} className="game-card">
                            <div className="row">
                                <span className="label">Arena</span>
                                <span className="value">{game.id}</span>
                            </div>
                            <div className="row">
                                <span className="label">Mode</span>
                                <span className="value">{game.mode === 'computer' ? `Synth (${(game.aiDifficulty ?? '').toUpperCase() || 'HARD'})` : 'Players'}</span>
                            </div>
                            <div className="row">
                                <span className="label">Seats</span>
                                <span className="value">{game.availableSlots}</span>
                            </div>
                            <div className="row">
                                <span className="label">Spectators</span>
                                <span className="value">{game.spectators}</span>
                            </div>
                            <div className="row">
                                <span className="label">Access</span>
                                <span className="value">{game.passwordProtected ? 'Password' : 'Open'}</span>
                            </div>
                            <button
                                onClick={() => handleID(game.id)}
                                className="neon-btn"
                            >
                                Enter
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="neon-panel leaderboard">
                <h2>Neon Ladder</h2>
                {leaderboard.length === 0 && <div className="panel-empty">No challengers recorded.</div>}
                <ol className="ladder">
                    {leaderboard.map((entry, index) => (
                        <li key={entry.id} className={user?.id === entry.id ? 'self' : ''}>
                            <span className="rank">#{index + 1}</span>
                            <span className="handle">{entry.handle}</span>
                            <span className="rating">{entry.rating}</span>
                            <span className="games">{entry.gamesPlayed} matches</span>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    )
}

export default Lobby
