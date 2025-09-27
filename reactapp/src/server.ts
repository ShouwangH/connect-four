import express from 'express'
import ViteExpress from 'vite-express'
import { initialGameState, makeMove, createGame, type GameState } from './connectfour'
import {getGames, startGame, retrieveGame, playGame} from './index'
import {createServer} from 'node:http'
import {Server} from 'socket.io'


const app = express()
app.use(express.json())

const server = createServer(app)
const serverSocket = new Server(server, {
  cors: {origin: "http://localhost:3000"
  }
})


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
    serverSocket.to(updateGame.id).emit('gameStateUpdate',updateGame)
    res.json(updateGame)
})

app.get('/reset/:id', async (req,res)=>{
    const id = req.params.id
    let resetGame = {...initialGameState, id:id}
    await playGame(resetGame)
    serverSocket.to(resetGame.id).emit('gameStateUpdate',resetGame)
    res.json(resetGame)
})

app.get('/games', async (_,res)=>{
    const gamesArr = await getGames()
    res.json(gamesArr)
})

app.get('game/:id/users', (req,res)=>{
    serverSocket.in(req.params.id).allSockets()
    
})

serverSocket.on('connection', (socket)=>{
    console.log('User connected');

    socket.on('joinRoom',(id)=>{
        socket.join(id);
        console.log(`${socket.id} joined room: ${id}`)
    })

    socket.on('disconnect', ()=>{
        console.log('User disconnected')
    })
})


server.listen(4000)
ViteExpress.listen(app, 3000, ()=> console.log("C4 server is listening..."))


