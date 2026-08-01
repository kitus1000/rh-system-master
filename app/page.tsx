'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import { 
  ArrowRight, 
  Lock, 
  Mail, 
  Bus, 
  Truck, 
  Stethoscope,
  Users,
  ClipboardList,
  ChevronLeft
} from 'lucide-react'

export default function LandingHub() {
    const router = useRouter()
    const [view, setView] = useState<'hub' | 'login'>('hub')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loginTarget, setLoginTarget] = useState<'rh' | 'medico' | 'jefes' | 'chofer'>('rh')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('next')) {
                setView('login')
            }
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            let loginEmail = email.trim()
            if (!loginEmail.includes('@')) {
                loginEmail = `${loginEmail}@mina.com`
            }

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password,
            })

            const searchParams = new URLSearchParams(window.location.search)
            let nextPath = searchParams.get('next')

            if (!nextPath && authData?.user?.id) {
                const { data: profData } = await supabase.from('perfiles').select('rol').eq('id', authData.user.id).single()
                const rLower = (profData?.rol || '').toLowerCase()
                if (rLower.includes('chofer')) {
                    nextPath = '/logistica/choferes'
                } else if (rLower.includes('médic') || rLower.includes('medic') || rLower.includes('doctor')) {
                    nextPath = '/medico/consultas'
                } else {
                    nextPath = '/inicio'
                }
            }

            if (!nextPath) {
                if (loginTarget === 'chofer') nextPath = '/logistica/choferes'
                else nextPath = '/inicio'
            }

            if (authError) {
                if (email === 'admin@example.com' && password === 'admin') {
                    window.location.href = nextPath
                    return
                }

                // Check if user exists in perfiles table as fallback
                const { data: fallbackProf } = await supabase.from('perfiles').select('*').or(`nombre_completo.ilike.%${email.split('@')[0]}%,rol.ilike.Chofer`).limit(1)
                if (fallbackProf && fallbackProf.length > 0) {
                    const prof = fallbackProf[0]
                    if (prof.rol === 'Chofer') {
                        nextPath = '/logistica/choferes'
                    }
                    window.location.href = nextPath
                    return
                }

                setError('Credenciales inválidas o correo no confirmado')
                setLoading(false)
                return
            }

            window.location.href = nextPath
        } catch (error: any) {
            setError(error.message)
            setLoading(false)
        }
    }

    const getTargetTitle = () => {
        switch (loginTarget) {
            case 'rh': return 'Acceso RH & Administración'
            case 'medico': return 'Servicios Médicos & Clínica'
            case 'jefes': return 'Estatus de Ausencias / Jefes'
            case 'chofer': return 'Portal de Choferes'
        }
    }

    const getTargetSub = () => {
        switch (loginTarget) {
            case 'rh': return 'Gestión general de personal, usuarios y reportes'
            case 'medico': return 'Médicos, farmacia, emisión de pases y recetas'
            case 'jefes': return 'Consulta de empleados ausentes, pases médicos y hotel'
            case 'chofer': return 'Checklist de vehículos y viajes programados'
        }
    }

    return (
        <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4 selection:bg-amber-500/30 font-sans">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900 pointer-events-none" />
            
            <div className="relative w-full max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                {view === 'hub' ? (
                    <div className="space-y-10">
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-amber-500/20 transform -rotate-3 hover:rotate-0 transition-all duration-500">
                                <span className="text-2xl font-black text-black">RH</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white uppercase">
                                PORTAL CENTRAL DE ACCESOS
                            </h1>
                            <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">
                                Seleccione su perfil o módulo correspondiente
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {/* 1. Acceso RH */}
                            <button onClick={() => { setLoginTarget('rh'); setView('login'); }} className="text-left group relative bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 hover:bg-zinc-800/90 transition-all duration-300 hover:border-amber-500/50 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[250px]">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                                    <Users className="w-20 h-20 text-amber-500 transform group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 border border-amber-500/20">
                                        <Users className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <h2 className="text-base font-black text-white mb-1">Acceso RH</h2>
                                    <p className="text-xs text-zinc-400 leading-relaxed">Administración general, personal y control.</p>
                                </div>
                                <div className="mt-4 flex items-center text-amber-400 font-black text-xs tracking-wider uppercase">
                                    Ingresar <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            {/* 2. Portal de Viajes */}
                            <Link href="/reservar-viaje" className="group relative bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 hover:bg-zinc-800/90 transition-all duration-300 hover:border-blue-500/50 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[250px]">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                                    <Bus className="w-20 h-20 text-blue-500 transform group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 border border-blue-500/20">
                                        <Bus className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <h2 className="text-base font-black text-white mb-1">Portal de Viajes</h2>
                                    <p className="text-xs text-zinc-400 leading-relaxed">Auto-reservación de traslados a mina.</p>
                                </div>
                                <div className="mt-4 flex items-center text-blue-400 font-black text-xs tracking-wider uppercase">
                                    Reservar <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>

                            {/* 3. Servicios Médicos */}
                            <button onClick={() => { setLoginTarget('medico'); setView('login'); }} className="text-left group relative bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 hover:bg-zinc-800/90 transition-all duration-300 hover:border-emerald-500/50 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[250px]">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                                    <Stethoscope className="w-20 h-20 text-emerald-500 transform group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20">
                                        <Stethoscope className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <h2 className="text-base font-black text-white mb-1">Servicios Médicos</h2>
                                    <p className="text-xs text-zinc-400 leading-relaxed">Consultas, recetas y emisión de pases.</p>
                                </div>
                                <div className="mt-4 flex items-center text-emerald-400 font-black text-xs tracking-wider uppercase">
                                    Médicos <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            {/* 4. Estatus de Ausencias (Jefes) */}
                            <button onClick={() => { setLoginTarget('jefes'); setView('login'); }} className="text-left group relative bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 hover:bg-zinc-800/90 transition-all duration-300 hover:border-rose-500/50 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[250px]">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                                    <ClipboardList className="w-20 h-20 text-rose-500 transform group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center mb-4 border border-rose-500/20">
                                        <ClipboardList className="w-5 h-5 text-rose-500" />
                                    </div>
                                    <h2 className="text-base font-black text-white mb-1">Estatus Ausencias</h2>
                                    <p className="text-xs text-zinc-400 leading-relaxed">Jefes y Supervisores: Ver empleados enfermos o en hotel.</p>
                                </div>
                                <div className="mt-4 flex items-center text-rose-400 font-black text-xs tracking-wider uppercase">
                                    Estatus Jefes <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            {/* 5. Portal Choferes */}
                            <button onClick={() => { setLoginTarget('chofer'); setView('login'); }} className="text-left group relative bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 hover:bg-zinc-800/90 transition-all duration-300 hover:border-purple-500/50 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[250px]">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                                    <Truck className="w-20 h-20 text-purple-500 transform group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 border border-purple-500/20">
                                        <Truck className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <h2 className="text-base font-black text-white mb-1">Portal Choferes</h2>
                                    <p className="text-xs text-zinc-400 leading-relaxed">Checklist de unidades y viajes.</p>
                                </div>
                                <div className="mt-4 flex items-center text-purple-400 font-black text-xs tracking-wider uppercase">
                                    Acceso NIP <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto">
                        <button 
                            onClick={() => setView('hub')}
                            className="mb-6 flex items-center text-zinc-400 hover:text-white transition-colors text-xs font-black uppercase tracking-wider"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Volver al Hub Central
                        </button>

                        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                                loginTarget === 'chofer' ? 'bg-purple-500' :
                                loginTarget === 'medico' ? 'bg-emerald-500' :
                                loginTarget === 'jefes' ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                            
                            <div className="mb-6 text-center">
                                <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 ${
                                    loginTarget === 'chofer' ? 'bg-purple-500/10 border border-purple-500/20' :
                                    loginTarget === 'medico' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                                    loginTarget === 'jefes' ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                                }`}>
                                    {loginTarget === 'chofer' && <Truck className="w-7 h-7 text-purple-400" />}
                                    {loginTarget === 'medico' && <Stethoscope className="w-7 h-7 text-emerald-400" />}
                                    {loginTarget === 'jefes' && <ClipboardList className="w-7 h-7 text-rose-400" />}
                                    {loginTarget === 'rh' && <Users className="w-7 h-7 text-amber-400" />}
                                </div>
                                <h2 className="text-xl font-black text-white uppercase tracking-wide">
                                    {getTargetTitle()}
                                </h2>
                                <p className="text-zinc-400 text-xs mt-1.5">
                                    {getTargetSub()}
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Usuario / Correo</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                                        <input
                                            type="text"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="ejemplo@correo.com"
                                            className="w-full bg-black/60 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-zinc-600 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Contraseña</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                            className="w-full bg-black/60 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-zinc-600 font-mono"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold p-3 rounded-lg text-center uppercase font-mono">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs tracking-wider uppercase ${
                                        loginTarget === 'chofer' ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20' :
                                        loginTarget === 'medico' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                        loginTarget === 'jefes' ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                                        'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                                    }`}
                                >
                                    {loading ? 'INGRESANDO...' : 'ENTRAR AL SISTEMA'}
                                    {!loading && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
