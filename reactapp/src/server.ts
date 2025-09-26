import express from 'express'
import ViteExpress from 'vite-express'
import { initialGameState, makeMove, createGame, type GameState } from './connectfour'
import { getGames, startGame, retrieveGame, playGame } from './index'
import { Server } from 'socket.io'
import {io} from 'socket.io-client'
import { createServer } from 'http'


const app = express()
app.use(express.json())

const httpServer = createServer(app)

export const clientSocket = io("http://localhost:3000", {
  autoConnect: false,
}); 

const ioServer = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
  },
})

ioServer.on("connection", (socket) => {
  console.log("A client connected", socket.id)
  socket.on("joinGame", (gameID) => {
    socket.join(gameID)
    console.log(`Socket ${socket.id} joined room ${gameID}`)
  })
})

app.get("/game/:id", async (req, res) => {
    const id = req.params.id
    let selectGame = await retrieveGame(id)
    ioServer.to(id).emit("gameStateUpdate", selectGame)
    res.json(selectGame)
})

app.post("/create", async (_, res) => {
    const newGame = createGame()
    await startGame(newGame)
    res.json(newGame)
})

app.post("/move/:id", async (req, res) => {
    const movePos = req.body.position
    const id = req.params.id
    let updateGame: GameState = await retrieveGame(id)
    updateGame = makeMove(movePos, updateGame)
    await playGame(updateGame)
    ioServer.to(id).emit("gameStateUpdate", updateGame)
    res.json(updateGame)
})

app.get('/reset/:id', async (req, res) => {
    const id = req.params.id
    let resetGame = { ...initialGameState, id: id }
    console.log(resetGame)
    await playGame(resetGame)
    ioServer.to(id).emit("gameStateUpdate", resetGame)
    res.json(resetGame)
})

app.get('/games', async (_, res) => {
    const gamesArr = await getGames()
    res.json(gamesArr)
})

ViteExpress.bind(app, httpServer)
httpServer.listen(3000, () => {
  console.log("Server listening on PORT 3000")
})


