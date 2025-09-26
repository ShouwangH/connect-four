import express from 'express'
import ViteExpress from 'vite-express'
import { initialGameState, makeMove, createGame, type GameState } from './connectfour'
import {getGames, startGame, retrieveGame, playGame} from './index'


const app = express()
app.use(express.json())


app.get("/game/:id", async (req,res)=>{
    const id = req.params.id
    let selectGame = await retrieveGame(id)
    res.json(selectGame)
})

app.post("/create", async (_,res)=>{
    const newGame = createGame()
    await startGame(newGame)
    res.json(newGame)
})

app.post("/move/:id", async (req,res)=>{
    const movePos = req.body.position
    const id = req.params.id
    let updateGame:GameState = await retrieveGame(id)
    updateGame = makeMove(movePos,updateGame)
    await playGame(updateGame)
    res.json(updateGame)
})

app.get('/reset/:id', async (req,res)=>{
    const id = req.params.id
    let resetGame = {...initialGameState, id:id}
    console.log(resetGame)
    await playGame(resetGame)
    res.json(resetGame)
})

app.get('/games', async (_,res)=>{
    const gamesArr = await getGames()
    res.json(gamesArr)
})

ViteExpress.listen(app, 3000, ()=> console.log("C4 server is listening..."))


