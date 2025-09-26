import './App.css'
import { type GameState } from "./connectfour"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Confetti from 'react-confetti'

interface GameProps {
    gameID: string
    handleID: (id: string) => void
}

function Game({ gameID, handleID }: GameProps) {
    async function fetchGame() {
        const res = await fetch('/game/' + gameID)
        return await res.json()
    }

    async function postMove({ position }: { position: number }) {
        await fetch('/move/' + gameID, {
            method: "POST",
            headers: { "content-Type": "application/json" },
            body: JSON.stringify({ position })
        })
    }

    async function resetGame() {
        const res = await fetch('/reset/' + gameID)
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

    const statusClass = new Map<string, string>()
    statusClass.set('Red', "bounce-in-top aspect-square border-2 rounded-full border-blue-700 bg-red-500")
    statusClass.set('Yellow', "bounce-in-top aspect-square border-2 rounded-full border-blue-700 bg-yellow-200")
    statusClass.set('none', "aspect-square border-2 rounded-full border-blue-700 bg-amber-50")

    const winClass = new Map<string,string>()
    winClass.set('Red', 'z-50 absolute text-9xl  text-red-500 text-shadow-lg text-shadow-stone-950 animate-pulse') 
    winClass.set('Yellow', 'z-50 absolute text-9xl  text-yellow-200 text-shadow-lg text-shadow-stone-950 animate-pulse')
    winClass.set('Tie', 'z-50 absolute text-9xl  text-Black text-shadow-lg text-shadow-stone-950 animate-pulse')


    if (isPending) { return <div>Game is loading</div> }
    else if (error) { return <div>Game failed to load</div>}
    {
        return (
            <>
                <div className="bg-black flex flex-col items-center justify-center w-screen h-screen ">
                    {state.winner && <h1 className={winClass.get(state.winner)}>{state.winner==='Tie'? "Tie Game": state.winner + ' Wins!'}</h1>}
                    {(state.winner === 'Red' || state.winner ==='Yellow') ? <Confetti/> : ''}
                    <div className={state.currentPlayer == "Red" ?
                        'h-2/3 grid grid-flow-col grid-rows-6 bg-linear-to-t from-blue-500 to-blue-800 p-2 border-red-500 border-4 rounded-xl' :
                        'h-2/3 grid grid-flow-col grid-rows-6 bg-linear-to-t from-blue-500 to-blue-800 p-2 border-yellow-200 border-4 rounded-xl'}>
                        {state.board.map((e, i) => <div className={statusClass.get(e)}
                            key={i} onClick={() => handleClick(i)}></div>)}
                    </div>
                    <div>
                        <button className="m-4 border text-white rounded-xl text-3xl p-3 bg-red-500 transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-110 hover:bg-yellow-200 hover:text-black" onClick={() => handleReset()}>Reset</button>
                        <button className="border text-white rounded-xl text-3xl p-3 bg-red-500 transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-110 hover:bg-yellow-200 hover:text-black" onClick={() => handleID('')}>Lobby</button>
                    </div>
                    <div className="text-gray-50">Game: {state.id}</div>
                </div>

            </>)
    }
}

export default Game