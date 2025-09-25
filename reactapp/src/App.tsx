import { useState } from 'react'
import './App.css'
import { initialGameState,makeMove } from './connectfour'

function App() {
  const [gameState, setGameState] = useState(initialGameState)

  var space:number[] = []
  
  for (var i = 0; i<=41; i++){
    space.push(i)
  }

  function playMove (position:number) {
    setGameState(makeMove(position, gameState))
  }

  const statusClass = new Map<string, string>()
    statusClass.set('red', "aspect-square border-2 rounded-4xl border-blue-700 bg-yellow-200")
    statusClass.set('yellow',  "aspect-square border-2 rounded-4xl border-blue-700 bg-red-500")
    statusClass.set('none', "aspect-square border-2 rounded-4xl border-blue-700 bg-amber-50")

  return (
    <div className="bg-black flex items-center justify-center w-screen h-screen">
      <div className="w-200 h-200 grid grid-flow-col grid-rows-6">
        {space.map(e=><div className={statusClass.get(gameState.board[e])}
       
        key={e} onClick={()=>{playMove(e)}}></div>)}
      <button className="border rounded-2xl p-2 m-4 bg-blue-900 text-blue-300" onClick={()=>setGameState(initialGameState)}>Reset</button>
      </div>

    
    </div>
  )
}

export default App
