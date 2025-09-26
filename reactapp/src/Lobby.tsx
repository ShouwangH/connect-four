import { useMutation, useQuery } from "@tanstack/react-query"


interface LobbyProps {
    handleID: (id: string) => void
}
function Lobby({handleID}: LobbyProps) {



    async function listGame() {
        const res = await fetch('/games')
        return await res.json()
    }

    async function newGame() {
        const res = await fetch('/create',{
            method: "post",
        })
        const newData = await res.json()
        return await newData.id
    }

    const { isPending, error, data } = useQuery({
        queryFn: listGame,
        queryKey: ['Games']
    })

    const games = data

    const createGame = useMutation({
        mutationFn: newGame,
        onSuccess: (id) => { handleID(id) }

    })

    function handleCreate() {
        createGame.mutate()
    }

    if (isPending) { return <div>Looking for Games</div> }
    else if (error) {return <div>Error finding Games</div>}
    else    {
        return (
            <div className="flex flex-col bg-black text-gray-400 items-center justify-center h-screen w-screen gap-8">
                <div className="flex gap-2">
                <h1 className='text-4xl text-red-500'>Connect </h1>
                <h1 className='text-4xl animate-bounce text-yellow-200'> Four</h1>
                </div>
                <button onClick={() => handleCreate()} className='border text-white rounded-xl p-3 bg-red-500 transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-110 hover:bg-yellow-200 hover:text-black'>Create Game</button>
                <label className="flex flex-col items-center">
                    {(games[0]) ? "Select a game:": "No active games"}
                    <select className="justify-center" onChange={(e)=>handleID(e.target.value)}>
                        <option></option>
                        {games.map((id:string) => <option value={id} key={id}>{id}</option>)}
                    </select>
                </label>

            </div>

        )
    }
}

export default Lobby