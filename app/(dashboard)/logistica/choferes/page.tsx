'use client'

import dynamic from 'next/dynamic'

// Dynamically import the entire page to avoid SSR issues with canvas and window objects
const ChoferesClient = dynamic(() => import('./ChoferesClient'), { 
    ssr: false,
    loading: () => <div className="p-8 text-center text-zinc-500 animate-pulse font-bold">Cargando aplicación del chofer...</div>
})

export default function ChoferesPage() {
    return <ChoferesClient />
}
