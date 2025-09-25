import { useState, useRef, useEffect } from 'react'
import './App.css'
import { initialGameState, makeMove } from './connectfour'
import Game from './Game'
import Lobby from './Lobby'

function App() {
  const [gameID, setGameID] = useState('')

  function handleID(id:string) {
    setGameID(id)
  }


  const mouseRef = useRef<HTMLDivElement>(null)

  /*useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (mouseRef.current) {
        mouseRef.current.style.left = `${e.clientX}px`
        mouseRef.current.style.top = `${e.clientY}px`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  })*/




  return (
    <>
    {gameID?
      <Game gameID={gameID}/>:
      <Lobby handleID={handleID}/>
    }
    </>
  )
}

export default App
