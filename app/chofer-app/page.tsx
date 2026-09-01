'use client'

import dynamic from 'next/dynamic'

// Cargar la aplicación principal unificada de Choferes de Minas de Bacis
const ChoferesClient = dynamic(() => import('@/app/(dashboard)/logistica/choferes/ChoferesClient'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center animate-bounce text-emerald-400 font-black text-xl">
        🚌
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-black text-white">Iniciando Portal de Choferes</h2>
        <p className="text-xs text-zinc-400">Minas de Bacis • Cargando sistema offline...</p>
      </div>
    </div>
  )
})

export default function ChoferAppPage() {
  return <ChoferesClient />
}
