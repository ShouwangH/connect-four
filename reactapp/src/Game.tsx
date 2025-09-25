import { useState } from "react"
import { initialGameState, makeMove, type GameState } from "./connectfour"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

interface GameProps {
    gameID:string
}

function Game(gameID:GameProps) {
    async function fetchGame() {
        const res = await fetch('/game/' + gameID.gameID)
        return await res.json()
    }

    async function postMove({ position }: { position: number }) {
        const res = await fetch('/move/' + gameID.gameID, {
            method: "POST",
            headers: { "content-Type": "application/json" },
            body: JSON.stringify({ position })
        })
    }

    async function resetGame() {
        const res = await fetch('/reset/' + gameID.gameID)
        return await res.json()
    }

    const queryClient = useQueryClient()

    const { isPending, error, data } = useQuery({
        queryKey: ['game'],
        queryFn: fetchGame
    })

    const state = data as GameState


    const gameMove = useMutation({
        mutationFn: postMove,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['game'] })
        }
    })


    const resetting = useMutation({
        mutationFn: resetGame,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['game'] })
        }

    })

    function handleClick(position: number) {
        gameMove.mutate({ position: position })
    }

    function handleReset() {
        resetting.mutate()
    }

    console.log(state)

    const statusClass = new Map<string, string>()
    statusClass.set('red', "aspect-square border-2 rounded-4xl border-blue-700 bg-yellow-200")
    statusClass.set('yellow', "aspect-square border-2 rounded-4xl border-blue-700 bg-red-500")
    statusClass.set('none', "aspect-square border-2 rounded-4xl border-blue-700 bg-amber-50")

    if (isPending) { return <div>Game is loading</div> }
    else {
        return (
            <div className="bg-black flex items-center justify-center w-screen h-screen ">
                <div className="w-200 h-200 grid grid-flow-col grid-rows-6">
                    {state.board.map((e, i) => <div className={statusClass.get(e)}
                        key={i} onClick={() => handleClick(i)}></div>)}
                    <button className="border rounded-2xl p-2 m-4 bg-blue-900 text-blue-300" onClick={() => handleReset()}>Reset</button>
                </div>


            </div>)
    }
}

export default Game