import { useState } from 'react'
import './App.css'
import Game from './Game'
import Lobby from './Lobby'

function App() {
  const [gameID, setGameID] = useState('')

  function handleID(id:string) {
    setGameID(id)
  }

  return (
    <>
    {gameID?
      <Game gameID={gameID} handleID={handleID}/>:
      <Lobby handleID={handleID}/>
    }
    </>
  )
}

export default App
