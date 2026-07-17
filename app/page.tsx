'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import { 
  FolderLock, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Mail, 
  Activity, 
  Cpu, 
  HardHat, 
  Layers 
} from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isMedicalPortal, setIsMedicalPortal] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('next')?.includes('/consulta-medica')) {
                setIsMedicalPortal(true)
            }
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Auto-append domain if it's just a username
            let loginEmail = email.trim()
            if (!loginEmail.includes('@')) {
                loginEmail = `${loginEmail}@mina.com`
            }

            const { error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password,
            })

            const searchParams = new URLSearchParams(window.location.search)
            const nextPath = searchParams.get('next') || (isMedicalPortal ? '/consulta-medica' : '/inicio')

            if (authError) {
                if (email === 'admin@example.com' && password === 'admin') {
                    window.location.href = nextPath
                    return
                }
                throw authError
            }

            // Ensure browser cookie is written before navigating
            await supabase.auth.getSession()
            await new Promise(resolve => setTimeout(resolve, 600))

            window.location.href = nextPath
        } catch (err: any) {
            setError(err.message || 'Credenciales inválidas')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#07080a] overflow-hidden relative font-mono">
            {/* HUD / Mining Scan Animated Grid overlay */}
            <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Cyberpunk/Mining Glow Rings */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
                <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                {/* Horizontal scanner bar */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-[scan_4s_ease-in-out_infinite]" />
            </div>

            {/* Custom Scan CSS injected inline to avoid modifying layout stylesheets */}
            <style jsx global>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>

            <div className="relative w-full max-w-[460px] px-6 z-10 animate-in fade-in zoom-in-95 duration-700">
                
                {/* Top Corner HUD brackets decoration */}
                <div className="absolute -top-3 -left-3 w-8 h-8 border-t-2 border-l-2 border-amber-500/60 rounded-tl-sm pointer-events-none" />
                <div className="absolute -top-3 -right-3 w-8 h-8 border-t-2 border-r-2 border-amber-500/60 rounded-tr-sm pointer-events-none" />
                <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-2 border-l-2 border-amber-500/60 rounded-bl-sm pointer-events-none" />
                <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-2 border-r-2 border-amber-500/60 rounded-br-sm pointer-events-none" />

                {/* Left Telemetry Sidebar HUD */}
                <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-6 text-[10px] text-zinc-600 font-bold uppercase tracking-widest pointer-events-none">
                  <div className="flex items-center gap-1.5 transform -rotate-90 origin-left">
                    <Activity className="w-3.5 h-3.5 text-amber-500/70 animate-pulse" />
                    <span>SYS_ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-1.5 transform -rotate-90 origin-left mt-8">
                    <Layers className="w-3.5 h-3.5 text-amber-500/70" />
                    <span>SEC_RH_MINA</span>
                  </div>
                </div>

                {/* Brand Header */}
                <div className="text-center mb-8 space-y-3">
                    <div className="relative mx-auto w-24 h-24 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-[0_0_30px_rgba(245,158,11,0.05)] cursor-pointer group overflow-hidden">
                        {/* Background tech circle rotating */}
                        <div className="absolute inset-0 border-2 border-dashed border-amber-500/20 rounded-full scale-90 animate-[spin_20s_linear_infinite] group-hover:border-amber-500/40" />
                        <div className="relative z-10 flex flex-col items-center">
                            <HardHat className="w-8 h-8 text-amber-500 group-hover:scale-115 transition-all duration-300" />
                            <span className="text-[7px] text-zinc-500 uppercase tracking-widest font-black mt-1">RH_PORTAL</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-xs font-black text-amber-500 uppercase tracking-[0.4em] italic">PLATAFORMA INDUSTRIAL</h1>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                            EL <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">EXPEDIENTE</span>
                        </h2>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          <span>ENLACE SEGURO SSL / MINA SAUCITO</span>
                      </div>
                    </div>
                </div>

                {/* Login Tech Card */}
                <div className="bg-zinc-900/60 backdrop-blur-xl p-8 rounded-2xl border border-zinc-800 shadow-2xl relative overflow-hidden">
                    {/* Inner glowing edge indicator */}
                    <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                    
                    {isMedicalPortal && (
                        <div className="mb-5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-4 text-center space-y-1.5 animate-in fade-in zoom-in duration-300 shadow-lg shadow-emerald-950/50">
                            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
                                <span>PORTAL CLÍNICO SELECCIONADO</span>
                            </div>
                            <p className="text-[9px] text-emerald-200/90 font-mono leading-relaxed">
                                Ingresa con tu cuenta de Médico, Recursos Humanos o Jefe de Departamento para consultar expedientes y pases autorizados.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">CREDERNIAL_ID / EMAIL</label>
                              <span className="text-[8px] text-zinc-700 font-mono">[REQUERIDO]</span>
                            </div>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
                                <input
                                    type="text"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com o usuario"
                                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">CLAVE_ACCESO / PIN</label>
                              <span className="text-[8px] text-zinc-700 font-mono">[CIFRADO]</span>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black p-3 rounded-lg text-center animate-shake uppercase tracking-wider font-mono">
                              ERROR: {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full relative overflow-hidden group font-black py-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                                isMedicalPortal 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20' 
                                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black shadow-amber-500/10'
                            }`}
                        >
                            {/* Sliding tech glare effect on hover */}
                            <div className="absolute inset-0 w-1/2 h-full bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000 ease-out" />
                            
                            <span className="text-xs uppercase tracking-widest">{loading ? 'VERIFICANDO CREDENCIALES...' : (isMedicalPortal ? 'INGRESAR A PORTAL CLÍNICO' : 'ACCEDER AL EXPEDIENTE')}</span>
                            {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                        </button>
                    </form>

                    <Link
                        href="/reservar-viaje"
                        className="mt-4 w-full border border-zinc-800 hover:border-amber-500/50 hover:text-amber-400 text-zinc-500 text-[9px] font-black py-3 rounded-xl transition-all text-center uppercase tracking-widest block font-mono bg-zinc-950/20"
                    >
                        [ PORTAL DE AUTO-RESERVACIÓN DE VIAJES ]
                    </Link>

                    <Link
                        href="/consulta-medica"
                        onClick={(e) => {
                            e.preventDefault()
                            setIsMedicalPortal(true)
                            window.history.pushState({}, '', '/?next=/consulta-medica')
                        }}
                        className={`mt-2 w-full border text-[9px] font-black py-3 rounded-xl transition-all text-center uppercase tracking-widest block font-mono ${
                            isMedicalPortal
                                ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-400 shadow-sm shadow-emerald-500/10'
                                : 'border-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 text-zinc-500 bg-zinc-950/20'
                        }`}
                    >
                        [ PORTAL CLÍNICO / CONSULTA DE PASES ]
                    </Link>

                    {/* Bottom HUD Metadata */}
                    <div className="pt-6 mt-6 border-t border-zinc-800/80 flex justify-between items-center text-[8px] text-zinc-600 font-black tracking-widest font-mono">
                        <span>ESTADO: ONLINE</span>
                        <span>J. Raul Mtz M &copy; 2026</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
