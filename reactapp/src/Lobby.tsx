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
    else {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-screen gap-8">
                <button onClick={() => handleCreate()} className='border rounded-xl p-3'>Create Game</button>
                <label className="flex flex-col">
                    Select a game:
                    <select className="justify-center" onInput={(e)=>handleID(e.target.value)}>
                        {games.map(id => <option value={id} key={id}>{id}</option>)}
                    </select>
                </label>

            </div>

        )
    }
}

export default Lobby