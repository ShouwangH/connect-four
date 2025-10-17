import { useEffect, useState } from 'react'
import './App.css'
import Game from './Game'
import Lobby from './Lobby'

export type UserProfile = {
  id: string
  handle: string
  rating: number
}

type ThemeMode = 'neon-dark' | 'neon-light'

function App() {
  const [gameID, setGameID] = useState('')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [theme, setTheme] = useState<ThemeMode>('neon-dark')
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    void fetchProfile()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  async function fetchProfile() {
    try {
      setIsAuthLoading(true)
      const res = await fetch('/auth/me')
      if (!res.ok) {
        throw new Error('Unable to load profile')
      }
      const data = await res.json()
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setIsAuthLoading(false)
    }
  }

  async function login(handle: string, password: string) {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, password })
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      throw new Error(payload.error ?? `Login failed (${res.status})`)
    }
    const profile = await res.json()
    setUser(profile)
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  function toggleTheme() {
    setTheme(prev => prev === 'neon-dark' ? 'neon-light' : 'neon-dark')
  }

  function handleID(id: string) {
    setGameID(id)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-glyph">◇</span>
          <span className="brand-text">Circuits</span>
        </div>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'neon-dark' ? 'Rise' : 'Dusk'}
          </button>
          {user ? (
            <div className="user-chip">
              <span>{user.handle}</span>
              <span className="rating">{user.rating}</span>
              <button onClick={logout}>Sign out</button>
            </div>
          ) : (
            <div className="user-chip ghost">Guest</div>
          )}
        </div>
      </header>
      <main className="app-main">
        {gameID ? (
          <Game
            key={gameID}
            gameID={gameID}
            handleID={handleID}
            user={user}
            isAuthLoading={isAuthLoading}
          />
        ) : (
          <Lobby
            handleID={handleID}
            user={user}
            onLogin={login}
            onLogout={logout}
            isAuthLoading={isAuthLoading}
            refreshProfile={fetchProfile}
          />
        )}
      </main>
    </div>
  )
}

export default App
