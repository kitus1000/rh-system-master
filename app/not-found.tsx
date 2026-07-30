'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotFound() {
    const router = useRouter()

    useEffect(() => {
        // Automatically redirect any 404 URL back to main portal / login
        const timer = setTimeout(() => {
            router.push('/')
        }, 1500)

        return () => clearTimeout(timer)
    }, [router])

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 text-center font-sans">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-2xl font-bold mb-4 border border-emerald-500/20 animate-pulse">
                404
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2">Redireccionando al Sistema RH...</h1>
            <p className="text-xs text-zinc-400 max-w-sm mb-6">
                La sección solicitada no existe o cambio de ruta. Te estamos redirigiendo automáticamente de forma segura.
            </p>
            <a 
                href="/"
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-xl transition-all shadow-lg"
            >
                Ir a Inicio de Sesión
            </a>
        </div>
    )
}
