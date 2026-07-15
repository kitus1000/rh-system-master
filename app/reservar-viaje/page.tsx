'use client'

import { useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    Search, Mail, Phone, ShieldAlert, CheckCircle, Calendar, 
    Clock, Bus, Plane, Car, Lock, Cpu, ChevronRight, 
    Printer, X, LogOut, MapPin, User, RefreshCw, AlertCircle, 
    ArrowRight, Armchair, HelpCircle, HardHat, FileText, Check, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

export default function ReservarViajePublico() {
    // Mode: 'menu' | 'request' | 'query' | 'pass'
    const [mode, setMode] = useState<'menu' | 'request' | 'query' | 'pass'>('menu')
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Request Form State
    const [requestForm, setRequestForm] = useState({
        nombre_completo: '',
        departamento: '',
        celular_whatsapp: '',
        tipo_vehiculo: 'Autobús',
        fecha_sugerida: new Date().toISOString().split('T')[0]
    })
    const [requestFolio, setRequestFolio] = useState('')

    // Query Form State
    const [queryForm, setQueryForm] = useState({
        celular_whatsapp: '',
        clave_confirmacion: ''
    })

    // Boarding Pass Data
    const [passData, setPassData] = useState<any>(null)

    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!requestForm.nombre_completo.trim() || !requestForm.departamento.trim() || !requestForm.celular_whatsapp.trim()) {
            setErrorMsg('Por favor llena todos los campos obligatorios.')
            return
        }

        setLoading(true)
        setErrorMsg('')
        setSuccessMsg('')

        try {
            // Clean phone number
            const cleanPhone = requestForm.celular_whatsapp.replace(/\D/g, '')

            const { data, error } = await supabase
                .from('transporte_personal_solicitudes')
                .insert([{
                    nombre_completo: requestForm.nombre_completo.trim(),
                    departamento: requestForm.departamento.trim(),
                    celular_whatsapp: cleanPhone,
                    tipo_vehiculo: requestForm.tipo_vehiculo,
                    fecha_sugerida: requestForm.fecha_sugerida,
                    estatus: 'Pendiente'
                }])
                .select('id_solicitud')
                .single()

            if (error) throw error

            if (data) {
                const folio = data.id_solicitud.substring(0, 8).toUpperCase()
                setRequestFolio(folio)
                setSuccessMsg(`¡Solicitud registrada con éxito! Tu folio de seguimiento es: ${folio}.`)
                setMode('request') // Stay on request page but show success banner
                // Reset form
                setRequestForm({
                    nombre_completo: '',
                    departamento: '',
                    celular_whatsapp: '',
                    tipo_vehiculo: 'Autobús',
                    fecha_sugerida: new Date().toISOString().split('T')[0]
                })
            }
        } catch (err: any) {
            console.error(err)
            setErrorMsg('Error al guardar la solicitud en el servidor: ' + (err.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleQueryPass = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!queryForm.celular_whatsapp.trim() || !queryForm.clave_confirmacion.trim()) {
            setErrorMsg('Llena ambos campos para consultar.')
            return
        }

        setLoading(true)
        setErrorMsg('')

        try {
            const cleanPhone = queryForm.celular_whatsapp.replace(/\D/g, '')
            const cleanClave = queryForm.clave_confirmacion.trim()

            // Query request
            const { data: solData, error: solError } = await supabase
                .from('transporte_personal_solicitudes')
                .select(`
                    *,
                    viajes:transporte_personal_viajes(nombre_ruta, fecha, hora, tipo_vehiculo)
                `)
                .eq('celular_whatsapp', cleanPhone)
                .eq('clave_confirmacion', cleanClave)
                .single()

            if (solError || !solData) {
                setErrorMsg('No se encontró ningún viaje asignado con ese número de celular y clave. Verifica tus datos o contacta al administrador.')
                setLoading(false)
                return
            }

            if (solData.estatus !== 'Asignado' || !solData.viajes) {
                setErrorMsg('Tu solicitud aún está pendiente de asignación o fue rechazada. Te enviaremos tu clave por WhatsApp en cuanto se te asigne un lugar.')
                setLoading(false)
                return
            }

            setPassData(solData)
            setMode('pass')
        } catch (err: any) {
            console.error(err)
            setErrorMsg('Error al consultar el pase de abordaje.')
        } finally {
            setLoading(false)
        }
    }

    const handlePrintPass = () => {
        window.print()
    }

    const handleCancelBooking = async () => {
        if (!passData) return
        if (!confirm("⚠️ ¿Estás seguro de que deseas cancelar esta reservación de viaje? Tu asiento se liberará y esta acción no se puede deshacer.")) return

        setLoading(true)
        try {
            // 1. Delete occupied seat
            const { error: seatErr } = await supabase
                .from('transporte_personal_asientos')
                .delete()
                .eq('id_viaje', passData.id_viaje)
                .eq('numero_asiento', passData.numero_asiento)

            if (seatErr) throw seatErr

            // 2. Mark request as Cancelled in solicitudes table
            const { error: solErr } = await supabase
                .from('transporte_personal_solicitudes')
                .update({
                    estatus: 'Cancelado',
                    clave_confirmacion: null,
                    id_viaje: null,
                    numero_asiento: null,
                    chofer_nombre: null
                })
                .eq('id_solicitud', passData.id_solicitud)

            if (solErr) throw solErr

            alert("Tu reservación ha sido cancelada con éxito y tu asiento ha sido liberado.")
            setMode('menu')
            setPassData(null)
            setQueryForm({ celular_whatsapp: '', clave_confirmacion: '' })
        } catch (err: any) {
            console.error(err)
            alert("Error al cancelar la reservación: " + (err.message || err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#07080a] text-zinc-300 font-mono relative overflow-x-hidden flex flex-col justify-between">
            {/* Cyberpunk HUD grid overlay */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.3)] animate-pulse pointer-events-none" />

            {/* Header */}
            <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md py-4 px-6 z-10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-cyan-500/20 border border-cyan-500 flex items-center justify-center text-cyan-400">
                        <HardHat className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest block leading-none">SISTEMA BACIS</span>
                        <span className="text-sm font-black text-white uppercase tracking-wider block">PORTAL AUTO-SERVICIO VIAJES</span>
                    </div>
                </div>
                <div>
                    <span className="text-[9px] text-zinc-600 border border-zinc-800 px-2 py-1 rounded bg-zinc-900/40">ONLINE</span>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 flex items-center justify-center z-10">
                
                {/* 1. SELECTION MENU */}
                {mode === 'menu' && (
                    <div className="w-full max-w-lg space-y-6 animate-in fade-in duration-500">
                        <div className="text-center space-y-2 mb-8">
                            <h1 className="text-3xl font-black text-white uppercase tracking-wider">¿Qué deseas realizar hoy?</h1>
                            <p className="text-xs text-zinc-500">Selecciona una opción para programar tu viaje o consultar tu boleto asignado.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Request ride option */}
                            <button
                                onClick={() => { setMode('request'); setErrorMsg(''); setSuccessMsg(''); }}
                                className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-cyan-500/50 p-6 rounded-2xl text-left transition-all duration-300 group flex flex-col justify-between h-48 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all" />
                                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl w-fit">
                                    <Bus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-md font-bold text-white uppercase tracking-wider group-hover:text-cyan-400 transition-colors">1. Solicitar Viaje</h3>
                                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Registra tus datos de contacto y fecha deseada. Nosotros te asignamos tu lugar.</p>
                                </div>
                            </button>

                            {/* Query ticket option */}
                            <button
                                onClick={() => { setMode('query'); setErrorMsg(''); setSuccessMsg(''); }}
                                className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-amber-500/50 p-6 rounded-2xl text-left transition-all duration-300 group flex flex-col justify-between h-48 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl w-fit">
                                    <Lock className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-md font-bold text-white uppercase tracking-wider group-hover:text-amber-400 transition-colors">2. Consultar Boleto</h3>
                                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Ingresa la clave que te enviamos por WhatsApp para ver tu asiento, fecha y chofer asignado.</p>
                                </div>
                            </button>
                        </div>

                        <div className="mt-8 text-center pt-4 border-t border-zinc-900">
                            <Link href="/login" className="text-[10px] text-zinc-600 hover:text-cyan-400 transition-colors uppercase">
                                [ Acceso Administrativo / RH ]
                            </Link>
                        </div>
                    </div>
                )}

                {/* 2. REQUEST TRAVEL FORM */}
                {mode === 'request' && (
                    <div className="w-full max-w-lg bg-zinc-900/50 border border-zinc-850 rounded-3xl p-6 sm:p-8 relative shadow-2xl animate-in zoom-in-95 duration-400">
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-cyan-500" />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-cyan-500" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-cyan-500" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-cyan-500" />

                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-850">
                            <button 
                                onClick={() => setMode('menu')}
                                className="text-xs font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors uppercase"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                            </button>
                            <h2 className="text-md font-bold text-white uppercase tracking-wider">Nueva Solicitud de Viaje</h2>
                        </div>

                        {successMsg ? (
                            <div className="space-y-6 py-4 text-center">
                                <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500 text-cyan-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                                    <Check className="w-6 h-6" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-bold text-white uppercase">Registro Guardado</h3>
                                    <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                                        {successMsg}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 max-w-xs mx-auto pt-2">
                                        Te enviaremos un mensaje de WhatsApp a tu número de celular registrado cuando hayamos asignado tu transporte, indicando tu clave de confirmación, asiento y chofer.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => { setSuccessMsg(''); setMode('menu'); }}
                                    className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl text-xs uppercase"
                                >
                                    Volver al Menú
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateRequest} className="space-y-4">
                                {/* Name */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nombre Completo</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Ej. Juan Pérez M."
                                        value={requestForm.nombre_completo}
                                        onChange={e => setRequestForm({...requestForm, nombre_completo: e.target.value})}
                                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3 px-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                </div>

                                {/* Department */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Departamento</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Ej. Operaciones, Geología, Administración"
                                        value={requestForm.departamento}
                                        onChange={e => setRequestForm({...requestForm, departamento: e.target.value})}
                                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3 px-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                </div>

                                {/* WhatsApp Cellphone */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Celular (WhatsApp)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-655 text-zinc-600" />
                                        <input 
                                            type="tel" 
                                            required
                                            placeholder="10 dígitos (ej. 6181234567)"
                                            value={requestForm.celular_whatsapp}
                                            onChange={e => setRequestForm({...requestForm, celular_whatsapp: e.target.value})}
                                            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Vehicle type */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Transporte</label>
                                        <select 
                                            value={requestForm.tipo_vehiculo}
                                            onChange={e => setRequestForm({...requestForm, tipo_vehiculo: e.target.value})}
                                            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3 px-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                                        >
                                            <option value="Autobús">Autobús (Camión)</option>
                                            <option value="Avioneta">Avioneta (Vuelo)</option>
                                        </select>
                                    </div>

                                    {/* Travel date */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Fecha de Viaje</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={requestForm.fecha_sugerida}
                                            onChange={e => setRequestForm({...requestForm, fecha_sugerida: e.target.value})}
                                            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3 px-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                {errorMsg && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] p-2.5 rounded-lg text-center font-bold">
                                        {errorMsg}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                                >
                                    {loading ? 'REGISTRANDO SOLICITUD...' : 'ENVIAR SOLICITUD DE VIAJE'}
                                    {!loading && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* 3. QUERY PASSCODE FORM */}
                {mode === 'query' && (
                    <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-850 rounded-3xl p-6 sm:p-8 relative shadow-2xl animate-in zoom-in-95 duration-400">
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-amber-500" />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-amber-500" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-amber-500" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-amber-500" />

                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-850">
                            <button 
                                onClick={() => setMode('menu')}
                                className="text-xs font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors uppercase"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                            </button>
                            <h2 className="text-md font-bold text-white uppercase tracking-wider">Consultar Boleto</h2>
                        </div>

                        <form onSubmit={handleQueryPass} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Número de Celular (WhatsApp)</label>
                                <div className="relative">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-655 text-zinc-650 text-zinc-600" />
                                    <input 
                                        type="tel" 
                                        required
                                        placeholder="Ingresa tus 10 dígitos"
                                        value={queryForm.celular_whatsapp}
                                        onChange={e => setQueryForm({...queryForm, celular_whatsapp: e.target.value})}
                                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Clave de Confirmación</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-650 text-zinc-600" />
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Ej. BC-1234"
                                        value={queryForm.clave_confirmacion}
                                        onChange={e => setQueryForm({...queryForm, clave_confirmacion: e.target.value})}
                                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono tracking-widest"
                                    />
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] p-2.5 rounded-lg text-center font-bold">
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-amber-500/10"
                            >
                                {loading ? 'CONSULTANDO...' : 'CONSULTAR PASE'}
                                {!loading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>
                    </div>
                )}

                {/* 4. DIGITAL BOARDING PASS VIEW */}
                {mode === 'pass' && passData && (
                    <div className="w-full max-w-lg mx-auto space-y-6">
                        
                        {/* Sci-Fi Cyberpunk Boarding Pass Card */}
                        <div id="boarding-pass" className="bg-[#0b0c10] border border-cyan-500/50 rounded-3xl p-6 sm:p-8 relative shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden print:border-black print:text-black print:bg-white print:shadow-none">
                            {/* Glowing lines decorative */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 print:hidden" />
                            <div className="absolute top-6 right-6 text-cyan-500/40 text-[9px] font-mono tracking-widest uppercase print:hidden">BOARDING_PASS_GEN_V2</div>

                            {/* Ticket Header */}
                            <div className="flex justify-between items-start border-b border-zinc-800 pb-6 print:border-zinc-300">
                                <div>
                                    <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase font-mono">PASE DE TRANSPORTE CONFIRMADO</h3>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter mt-1 print:text-black">
                                        SISTEMA BACIS
                                    </h2>
                                    <p className="text-[8px] text-zinc-500 tracking-widest font-mono mt-1 uppercase">SISTEMA INTEGRAL DE TRANSPORTE MINERO</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-zinc-500 uppercase font-mono">CLAVE_TICKET</span>
                                    <div className="text-lg font-bold text-amber-400 font-mono uppercase tracking-widest mt-1 print:text-black">
                                        {passData.clave_confirmacion}
                                    </div>
                                </div>
                            </div>

                            {/* Passenger Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">PASAJERO / SOLICITANTE</span>
                                        <span className="text-sm font-bold text-white uppercase font-mono print:text-black">
                                            {passData.nombre_completo}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">DEPARTAMENTO</span>
                                        <span className="text-xs text-zinc-300 uppercase block font-mono print:text-black">
                                            {passData.departamento}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">TIPO DE VEHÍCULO</span>
                                        <span className="text-sm font-bold text-cyan-400 uppercase font-mono print:text-black flex items-center gap-1.5">
                                            {passData.tipo_vehiculo === 'Autobús' && <Bus className="w-4 h-4 shrink-0" />}
                                            {passData.tipo_vehiculo === 'Avioneta' && <Plane className="w-4 h-4 shrink-0" />}
                                            {passData.tipo_vehiculo === 'Camioneta' && <Car className="w-4 h-4 shrink-0" />}
                                            {passData.tipo_vehiculo}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">ASIENTO ASIGNADO</span>
                                        <span className="text-lg font-extrabold text-amber-400 uppercase font-mono print:text-black">
                                            ASIENTO #{passData.numero_asiento}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Route & Trip Details */}
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 my-6 print:bg-zinc-100 print:border-zinc-300 print:text-black">
                                <div className="text-[9px] text-zinc-500 uppercase block font-mono mb-2">RUTA ASIGNADA</div>
                                <div className="text-md font-bold text-white uppercase tracking-tight mb-4 print:text-black flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                                    {passData.viajes.nombre_ruta}
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block">FECHA DE SALIDA</span>
                                        <span className="font-bold text-white print:text-black">{new Date(passData.viajes.fecha + 'T12:00:00').toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block">HORA EMBARQUE</span>
                                        <span className="font-bold text-white print:text-black">{passData.viajes.hora.substring(0, 5)} Hrs</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block">CHOFER</span>
                                        <span className="font-bold text-white print:text-black truncate block">{passData.chofer_nombre || 'POR CONFIRMAR'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Barcode Mock */}
                            <div className="flex flex-col items-center justify-center mt-8 pt-6 border-t border-zinc-900 print:border-zinc-300">
                                <div className="h-10 w-full max-w-sm bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,transparent_2px,transparent_6px,#000_6px,#000_10px,transparent_10px,transparent_12px)] opacity-80 print:opacity-100" />
                                <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.4em] mt-2 block">
                                    *{passData.id_solicitud.substring(0, 18)}*
                                </span>
                            </div>
                        </div>

                        {/* Back / Print Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center print:hidden">
                            <button
                                onClick={handlePrintPass}
                                className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-black font-black px-6 py-3.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10"
                            >
                                <Printer className="w-4 h-4" />
                                IMPRIMIR COMPROBANTE
                            </button>
                            <button
                                onClick={handleCancelBooking}
                                className="w-full sm:w-auto bg-rose-950/20 border border-rose-500/40 hover:bg-rose-600 hover:text-white text-rose-400 font-bold px-6 py-3.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
                            >
                                <X className="w-4 h-4" />
                                CANCELAR VIAJE
                            </button>
                            <button
                                onClick={() => {
                                    setMode('menu')
                                    setPassData(null)
                                }}
                                className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold px-6 py-3.5 rounded-xl transition-all text-xs"
                            >
                                VOLVER AL MENÚ
                            </button>
                        </div>

                    </div>
                )}

            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-md py-4 px-6 z-10 text-center text-[9px] text-zinc-600 font-mono tracking-widest shrink-0 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>CONEXIÓN CIFRADA / MINERA BACIS SA</span>
                <span>DESARROLLADO PARA RECURSOS HUMANOS &copy; 2026</span>
            </footer>
        </div>
    )
}
