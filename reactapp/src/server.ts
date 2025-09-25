import express from 'express'
import ViteExpress from 'vite-express'
import { initialGameState, makeMove, type GameState, createGame } from './connectfour'


const app = express()
app.use(express.json())

let games = new Map<string, GameState>()

app.get("/game/:id", (req,res)=>{
    const id = req.params.id
    res.json(games.get(id))
})

app.post("/create", (req,res)=>{
    const newGame = createGame()
    games.set(newGame.id,newGame)
    res.json(newGame)
})

app.post("/move/:id", (req,res)=>{
    const movePos = req.body.position
    const id = req.params.id
    let updateGame = structuredClone(games.get(id))
    updateGame = makeMove(movePos,updateGame)
    games.set(id,updateGame)
    res.json(updateGame)
})

app.get('/reset/:id', (req,res)=>{
    const id = req.params.id
    let resetGame = structuredClone(games.get(id))
    resetGame = {...initialGameState, id:id}
    games.set(id,resetGame)
    res.json(resetGame)
})

app.get('/games', (req,res)=>{
    const gamesArr = [...games.keys()]
    res.json(gamesArr)
})

ViteExpress.listen(app, 3000, ()=> console.log("C4 server is listening..."))