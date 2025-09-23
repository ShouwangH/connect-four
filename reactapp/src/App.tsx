import { useState } from 'react'
import './App.css'

function App() {

  var space:number[] = []
  
  for (var i = 41; i>=0; i--){
    space.push(i)
  }

  return (
    <>
      <div className="w-[400px] h-[400px] grid grid-cols-7 grid-rows-6">
        {space.map(e=><div key={e}>{e}</div>)}
      </div>

    </>
  )
}

export default App
