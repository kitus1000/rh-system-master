'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    Search, Mail, Phone, ShieldAlert, CheckCircle, Calendar, 
    Clock, Bus, Plane, Car, Lock, Cpu, ChevronRight, 
    Printer, X, LogOut, MapPin, User, RefreshCw, AlertCircle, 
    ArrowRight, Armchair, HelpCircle, HardHat, FileText, Check
} from 'lucide-react'
import Link from 'next/link'

interface Empleado {
    id_empleado: string
    numero_empleado: number
    nombre: string
    apellido_paterno: string
    apellido_materno?: string
    telefono?: string
    correo_electronico?: string
    puesto?: string
}

interface Viaje {
    id_viaje: string
    tipo_vehiculo: string
    nombre_ruta: string
    fecha: string
    hora: string
    capacidad_total: number
    estado: string
}

interface Reserva {
    id_reserva: string
    numero_asiento: number
    id_empleado: string
    empleados?: { nombre: string, apellido_paterno: string }
}

export default function ReservarViajePublico() {
    // Navigation / Flow state
    const [step, setStep] = useState<'search' | 'verify' | 'booking' | 'pass'>('search')
    const [employee, setEmployee] = useState<Empleado | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchError, setSearchError] = useState('')
    const [searching, setSearching] = useState(false)

    // Verification state
    const [verifyMethod, setVerifyMethod] = useState<'sms' | 'email'>('sms')
    const [verificationCode, setVerificationCode] = useState('')
    const [sentCode, setSentCode] = useState('')
    const [sendingCode, setSendingCode] = useState(false)
    const [terminalLogs, setTerminalLogs] = useState<string[]>([])
    const [otpInput, setOtpInput] = useState('')
    const [otpError, setOtpError] = useState('')
    const [showHudIntercept, setShowHudIntercept] = useState(false)

    // Booking state
    const [activeTab, setActiveTab] = useState<'terrestre' | 'aereo'>('terrestre')
    const [viajes, setViajes] = useState<Viaje[]>([])
    const [loadingViajes, setLoadingViajes] = useState(false)
    const [selectedViaje, setSelectedViaje] = useState<Viaje | null>(null)
    const [reservas, setReservas] = useState<Reserva[]>([])
    const [loadingAsientos, setLoadingAsientos] = useState(false)
    
    // Seating state
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
    const [confirmingReservation, setConfirmingReservation] = useState(false)
    const [bookingSuccessData, setBookingSuccessData] = useState<any>(null)

    // Clear session on mount/unmount if desired
    useEffect(() => {
        // Retrieve session from localStorage if exists
        const cachedEmp = localStorage.getItem('rh_reserva_empleado')
        if (cachedEmp) {
            try {
                const parsed = JSON.parse(cachedEmp)
                setEmployee(parsed)
                setStep('booking')
            } catch (e) {
                localStorage.removeItem('rh_reserva_empleado')
            }
        }
    }, [])

    // Load trips when employee enters booking step or switches tabs
    useEffect(() => {
        if (step === 'booking') {
            fetchViajes()
            setSelectedViaje(null)
            setSelectedSeat(null)
        }
    }, [step, activeTab])

    // Load seats when a voyage is selected
    useEffect(() => {
        if (selectedViaje) {
            fetchReservas(selectedViaje.id_viaje)
            setSelectedSeat(null)
        }
    }, [selectedViaje])

    const handleSearchEmployee = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return

        setSearching(true)
        setSearchError('')

        try {
            // Search by employee number or CURP/Name
            let query = supabase.from('empleados').select('*').eq('estado_empleado', 'Activo')
            
            const isNum = /^\d+$/.test(searchQuery.trim())
            if (isNum) {
                query = query.eq('numero_empleado', parseInt(searchQuery.trim()))
            } else {
                query = query.ilike('nombre', `%${searchQuery.trim()}%`)
            }

            const { data, error } = await query

            if (error) throw error

            if (!data || data.length === 0) {
                setSearchError('No se encontró ningún empleado activo con ese criterio.')
            } else if (data.length > 1) {
                setSearchError('Se encontraron múltiples coincidencias. Por favor ingresa el número de empleado exacto.')
            } else {
                setEmployee(data[0])
                setStep('verify')
            }
        } catch (err: any) {
            console.error(err)
            setSearchError('Error en el servidor al realizar la búsqueda.')
        } finally {
            setSearching(false)
        }
    };

    const runTerminalLogs = (code: string) => {
        setTerminalLogs([])
        const logs = [
            `[SYS_CONN] Estableciendo canal seguro con Mina Saucito...`,
            `[SYS_NET] Buscando gateway celular LTE y servidor SMTP...`,
            `[SYS_CRYPT] Generando token de acceso OTP de 6 dígitos...`,
            `[SYS_DISPATCH] Transmitiendo paquete de seguridad encriptado...`,
            `[SYS_SUCCESS] Token enviado a ${verifyMethod === 'sms' ? 'dispositivo celular' : 'bandeja de correo'}.`
        ]

        let currentIdx = 0
        const interval = setInterval(() => {
            if (currentIdx < logs.length) {
                setTerminalLogs(prev => [...prev, logs[currentIdx]])
                currentIdx++
            } else {
                clearInterval(interval)
                setSendingCode(false)
                setShowHudIntercept(true)
            }
        }, 600)
    }

    const handleSendVerificationCode = () => {
        if (!employee) return
        setSendingCode(true)
        setOtpError('')
        
        // Generate a 6 digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        setSentCode(code)
        
        runTerminalLogs(code)
    }

    const handleVerifyOtp = () => {
        if (otpInput.trim() === sentCode && employee) {
            localStorage.setItem('rh_reserva_empleado', JSON.stringify(employee))
            setStep('booking')
            setOtpInput('')
            setShowHudIntercept(false)
        } else {
            setOtpError('CÓDIGO INCORRECTO. ACCESO DENEGADO.')
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('rh_reserva_empleado')
        setEmployee(null)
        setStep('search')
        setSearchQuery('')
        setSelectedViaje(null)
        setSelectedSeat(null)
    }

    const fetchViajes = async () => {
        setLoadingViajes(true)
        try {
            const types = activeTab === 'terrestre' ? ['Autobús', 'Camioneta'] : ['Avioneta']
            
            // Fetch scheduled voyages
            const { data, error } = await supabase
                .from('transporte_personal_viajes')
                .select('*')
                .in('tipo_vehiculo', types)
                .eq('estado', 'Programado')
                .gte('fecha', new Date().toISOString().split('T')[0])
                .order('fecha', { ascending: true })
                .order('hora', { ascending: true })

            if (error) throw error
            setViajes(data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingViajes(false)
        }
    }

    const fetchReservas = async (idViaje: string) => {
        setLoadingAsientos(true)
        try {
            const { data, error } = await supabase
                .from('transporte_personal_asientos')
                .select('*')
                .eq('id_viaje', idViaje)

            if (error) throw error
            setReservas(data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingAsientos(false)
        }
    }

    const handleConfirmBooking = async () => {
        if (!selectedSeat || !selectedViaje || !employee) return
        setConfirmingReservation(true)

        try {
            // Check if employee is already registered in this trip
            const alreadyBooked = reservas.find(r => r.id_empleado === employee.id_empleado)
            if (alreadyBooked) {
                alert('Ya tienes un asiento reservado en este viaje. Primero libera tu asiento actual si deseas cambiarlo.')
                setConfirmingReservation(false)
                return
            }

            // Check if seat is occupied
            const seatOccupied = reservas.find(r => r.numero_asiento === selectedSeat)
            if (seatOccupied) {
                alert('Este asiento acaba de ser reservado por otro usuario. Por favor elige otro.')
                fetchReservas(selectedViaje.id_viaje)
                setConfirmingReservation(false)
                return
            }

            const { data, error } = await supabase
                .from('transporte_personal_asientos')
                .insert([{
                    id_viaje: selectedViaje.id_viaje,
                    id_empleado: employee.id_empleado,
                    numero_asiento: selectedSeat
                }])
                .select('*')
                .single()

            if (error) throw error

            if (data) {
                setBookingSuccessData({
                    viaje: selectedViaje,
                    reserva: data,
                    empleado: employee
                })
                setStep('pass')
            }
        } catch (err: any) {
            console.error(err)
            alert('Error al reservar asiento: ' + (err.message || err))
        } finally {
            setConfirmingReservation(false)
        }
    }

    const handleReleaseSeat = async (idReserva: string) => {
        if (!confirm('¿Seguro que deseas liberar tu asiento reservado en este viaje?')) return
        try {
            const { error } = await supabase
                .from('transporte_personal_asientos')
                .delete()
                .eq('id_reserva', idReserva)

            if (error) throw error

            // Refresh seats list
            if (selectedViaje) {
                fetchReservas(selectedViaje.id_viaje)
            }
            setSelectedSeat(null)
            alert('Reserva liberada con éxito.')
        } catch (e: any) {
            console.error(e)
            alert('Error al liberar reserva: ' + e.message)
        }
    }

    // Mask sensitive contact details
    const maskPhone = (phone?: string) => {
        if (!phone) return 'No registrado'
        const cleaned = phone.replace(/\s+/g, '')
        if (cleaned.length < 4) return phone
        return `${cleaned.substring(0, 3)} ****** ${cleaned.substring(cleaned.length - 4)}`
    }

    const maskEmail = (email?: string) => {
        if (!email) return 'No registrado'
        const parts = email.split('@')
        if (parts.length !== 2) return email
        const name = parts[0]
        const domain = parts[1]
        if (name.length < 3) return `***@${domain}`
        return `${name.substring(0, 2)}***@${domain}`
    }

    // Print Boarding Pass
    const handlePrintPass = () => {
        window.print()
    }

    // --- Seating layout renders ---
    const renderSeatButton = (num: number) => {
        if (!employee) return null
        const r = reservas.find(res => res.numero_asiento === num)
        const isOwn = r?.id_empleado === employee.id_empleado

        return (
            <button
                key={num}
                onClick={() => {
                    if (r) {
                        if (isOwn) {
                            setSelectedSeat(num)
                        }
                    } else {
                        setSelectedSeat(num)
                    }
                }}
                className={`
                    relative aspect-square w-full rounded-xl flex flex-col items-center justify-center transition-all border-2 font-mono duration-300
                    ${r 
                        ? (isOwn 
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse' 
                            : 'bg-red-950/40 border-red-900/60 text-red-500/60 cursor-not-allowed') 
                        : (selectedSeat === num 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.3)] scale-105' 
                            : 'bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}
                `}
                disabled={r && !isOwn ? true : false}
            >
                <Armchair className={`w-5 h-5 mb-0.5 ${r ? (isOwn ? 'text-amber-400' : 'text-red-900/40') : (selectedSeat === num ? 'text-cyan-400' : 'text-zinc-600')}`} />
                <span className="text-[10px] font-bold">{num}</span>
                {r && (
                    <div className={`absolute -top-1.5 -right-1.5 rounded-full w-4 h-4 flex items-center justify-center border text-[8px] font-black
                        ${isOwn ? 'bg-amber-500 border-zinc-950 text-black' : 'bg-red-900/80 border-zinc-950 text-red-300'}`}>
                        {isOwn ? <Check className="w-2.5 h-2.5" /> : 'X'}
                    </div>
                )}
            </button>
        )
    }

    const renderAutobusLayout = () => {
        const capacity = selectedViaje?.capacidad_total || 37
        const seats = Array.from({ length: capacity }, (_, i) => i + 1)
        return (
            <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-850 max-w-sm mx-auto relative overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
                {/* Cabina del chofer */}
                <div className="mb-8 border-b border-zinc-850 pb-6 relative flex items-center justify-between">
                    <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 border border-zinc-800 text-[10px] font-mono">
                        CHOFER
                    </div>
                    <div className="text-center font-black text-zinc-700 text-sm uppercase tracking-[0.3em] font-mono">FRENTE VEHÍCULO</div>
                    <div className="w-5 h-5 bg-zinc-900 border border-zinc-800 rounded"></div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                    {seats.map((num) => {
                        const isAisleLeft = num % 4 === 2 && num !== capacity
                        return (
                            <div key={num} className={isAisleLeft ? 'mr-5' : ''}>
                                {renderSeatButton(num)}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const renderAvionetaLayout = () => {
        // 8 seats: 4 rows of 2 seats
        const rows = [
            [1, 2],
            [3, 4],
            [5, 6],
            [7, 8]
        ]
        return (
            <div className="relative max-w-sm mx-auto my-6">
                {/* Alas del avión */}
                <div className="absolute top-24 -left-10 w-12 h-10 bg-zinc-900 border border-r-0 border-zinc-800 rounded-l-3xl -rotate-12 z-0"></div>
                <div className="absolute top-24 -right-10 w-12 h-10 bg-zinc-900 border border-l-0 border-zinc-800 rounded-r-3xl rotate-12 z-0"></div>
                
                {/* Estabilizadores traseros */}
                <div className="absolute bottom-4 -left-4 w-8 h-5 bg-zinc-900 border border-r-0 border-zinc-800 rounded-l-xl -rotate-45 z-0"></div>
                <div className="absolute bottom-4 -right-4 w-8 h-5 bg-zinc-900 border border-l-0 border-zinc-800 rounded-r-xl rotate-45 z-0"></div>
                
                {/* Fuselaje */}
                <div className="bg-zinc-950 border border-zinc-850 rounded-t-[50px] rounded-b-[40px] px-8 pt-14 pb-8 relative z-10 shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
                    {/* Cabina Piloto */}
                    <div className="absolute top-3 inset-x-8 h-8 bg-zinc-900 border border-zinc-800 rounded-t-full flex items-center justify-center text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                        CABINA PILOTOS
                    </div>

                    <div className="space-y-4 mt-6">
                        {rows.map((rowArr, idx) => (
                            <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                                {renderSeatButton(rowArr[0])}
                                <div className="h-full border-x border-dashed border-zinc-900 flex items-center justify-center text-[8px] font-mono text-zinc-700 tracking-wider">
                                    PASILLO
                                </div>
                                {renderSeatButton(rowArr[1])}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const renderCamionetaLayout = () => {
        return (
            <div className="relative max-w-xs mx-auto my-6">
                <div className="w-40 bg-zinc-900 h-8 rounded-t-xl mx-auto border-b-2 border-zinc-850 relative flex items-center justify-center z-10">
                    <span className="text-[8px] font-mono text-zinc-500 tracking-widest uppercase">FRENTE</span>
                </div>
                
                <div className="w-40 bg-zinc-950 border border-zinc-850 rounded-b-2xl px-5 py-5 mx-auto shadow-inner relative z-0">
                    <div className="grid grid-cols-2 gap-4">
                        {renderSeatButton(1)}
                        {renderSeatButton(2)}
                        
                        <div className="col-span-2 h-px bg-zinc-900 my-1"></div>
                        
                        {renderSeatButton(3)}
                        {renderSeatButton(4)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#07080a] text-zinc-300 font-mono relative overflow-x-hidden flex flex-col justify-between">
            {/* Cyberpunk HUD grid overlay */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.3)] animate-pulse pointer-events-none" />

            {/* Simulated HUD OTP interceptor */}
            {showHudIntercept && (
                <div className="fixed top-6 right-6 z-50 w-80 bg-zinc-900/90 border border-amber-500/60 rounded-xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-in slide-in-from-right-10 duration-300 backdrop-blur-md">
                    <div className="flex justify-between items-center border-b border-amber-500/30 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-amber-500 animate-spin" />
                            <span className="text-[10px] font-black text-amber-500 tracking-widest uppercase">HUD_INTERCEPT_SUCCESS</span>
                        </div>
                        <button onClick={() => setShowHudIntercept(false)} className="text-zinc-500 hover:text-amber-500">&times;</button>
                    </div>
                    <div className="text-[9px] text-zinc-400 space-y-1">
                        <p className="text-amber-400/80 font-bold uppercase font-mono">[EMULADOR DE CANALES ACTIVADO]</p>
                        <p>Para fines de demostración, interceptamos el código OTP enviado al empleado:</p>
                        <div className="my-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-center">
                            <span className="text-xl font-bold text-amber-400 tracking-[0.2em]">{sentCode}</span>
                        </div>
                        <p className="text-[8px] text-zinc-500">En una integración real, este código se enviaría vía SMS (Twilio) o Email (Resend) al número o correo registrado en la ficha del empleado.</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md py-4 px-6 z-10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-cyan-500/20 border border-cyan-500 flex items-center justify-center text-cyan-400">
                        <HardHat className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest block leading-none">MINA SAUCITO SA</span>
                        <span className="text-sm font-black text-white uppercase tracking-wider block">AUTO-RESERVACIÓN TRANSPORTE</span>
                    </div>
                </div>

                {employee && step !== 'pass' && (
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-xs font-black text-white">{employee.nombre} {employee.apellido_paterno}</span>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">{employee.puesto || 'OPERARIO'}</span>
                        </div>
                        <button 
                            onClick={handleLogout}
                            title="Cerrar Sesión de Reserva"
                            className="p-2 border border-zinc-800 rounded bg-zinc-900/60 hover:bg-red-950/30 hover:border-red-900 hover:text-red-400 transition-all flex items-center gap-2 text-xs"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden md:inline">SALIR</span>
                        </button>
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 flex items-center justify-center z-10">
                
                {/* 1. SEARCH EMPLOYEE STEP */}
                {step === 'search' && (
                    <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-850 rounded-2xl p-6 sm:p-8 relative shadow-2xl animate-in zoom-in-95 duration-500">
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-cyan-500" />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-cyan-500" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-cyan-500" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-cyan-500" />

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
                                <User className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Identificación de Personal</h2>
                            <p className="text-xs text-zinc-500 mt-1">Ingresa tu número de empleado para verificar tu registro y reservar tu transporte.</p>
                        </div>

                        <form onSubmit={handleSearchEmployee} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Credencial ID / No. Empleado o Nombre</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                    <input 
                                        type="text" 
                                        required
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Ej. 1042 o Juan Pérez"
                                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all placeholder:text-zinc-700 font-mono"
                                    />
                                </div>
                            </div>

                            {searchError && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] p-3 rounded-lg text-center flex items-center gap-2 justify-center font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{searchError}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={searching}
                                className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                            >
                                {searching ? 'BUSCANDO EXPEDIENTE...' : 'BUSCAR REGISTRO'}
                                {!searching && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>

                        <div className="mt-6 border-t border-zinc-850 pt-4 text-center">
                            <Link href="/login" className="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors uppercase">
                                [ Ir a Plataforma Administrativa ]
                            </Link>
                        </div>
                    </div>
                )}

                {/* 2. OTP VERIFICATION STEP */}
                {step === 'verify' && employee && (
                    <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-850 rounded-2xl p-6 sm:p-8 relative shadow-2xl animate-in zoom-in-95 duration-400">
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-amber-500" />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-amber-500" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-amber-500" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-amber-500" />

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
                                <Lock className="w-6 h-6 text-amber-500" />
                            </div>
                            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Verificación de Seguridad</h2>
                            <p className="text-xs text-zinc-500 mt-1">
                                Hola, <span className="text-white font-bold">{employee.nombre}</span>. Elige el medio para recibir tu código temporal.
                            </p>
                        </div>

                        {!sentCode ? (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setVerifyMethod('sms')}
                                        className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all font-mono
                                            ${verifyMethod === 'sms' 
                                                ? 'bg-amber-500/10 border-amber-500 text-white' 
                                                : 'bg-zinc-950/80 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                    >
                                        <Phone className="w-5 h-5 text-amber-500" />
                                        <span className="text-xs font-bold">SMS Celular</span>
                                        <span className="text-[8px] text-zinc-500">{maskPhone(employee.telefono)}</span>
                                    </button>
                                    <button 
                                        onClick={() => setVerifyMethod('email')}
                                        className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all font-mono
                                            ${verifyMethod === 'email' 
                                                ? 'bg-amber-500/10 border-amber-500 text-white' 
                                                : 'bg-zinc-950/80 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                    >
                                        <Mail className="w-5 h-5 text-amber-500" />
                                        <span className="text-xs font-bold">Email</span>
                                        <span className="text-[8px] text-zinc-500">{maskEmail(employee.correo_electronico)}</span>
                                    </button>
                                </div>

                                <button
                                    onClick={handleSendVerificationCode}
                                    disabled={sendingCode}
                                    className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-amber-500/10 disabled:opacity-50"
                                >
                                    {sendingCode ? 'TRANSMITIENDO...' : 'TRANSMITIR CÓDIGO'}
                                    {!sendingCode && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider text-center block">Código de Confirmación (6 Dígitos)</label>
                                    <input 
                                        type="text" 
                                        maxLength={6}
                                        value={otpInput}
                                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                                        placeholder="••••••"
                                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 text-center text-xl font-bold tracking-[0.4em] text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 transition-all font-mono placeholder:text-zinc-800"
                                    />
                                </div>

                                {otpError && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] p-2.5 rounded-lg text-center font-bold font-mono">
                                        {otpError}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setSentCode(''); setOtpInput('') }}
                                        className="flex-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-bold py-3 rounded-xl transition-all text-xs"
                                    >
                                        ATRÁS
                                    </button>
                                    <button
                                        onClick={handleVerifyOtp}
                                        className="flex-[2] bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl transition-all text-xs shadow-lg shadow-amber-500/10"
                                    >
                                        VERIFICAR ACCESO
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Terminal Transmission Loader overlay */}
                        {sendingCode && (
                            <div className="absolute inset-0 bg-zinc-950/95 rounded-2xl p-6 flex flex-col justify-between z-20 border border-amber-500/40">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                                        <Cpu className="w-5 h-5 text-amber-500 animate-spin" />
                                        <span className="text-[10px] font-black text-amber-400 tracking-wider">HOLO_SEND_ROUTINE.EXE</span>
                                    </div>
                                    <div className="space-y-2 text-[10px] font-mono text-zinc-400">
                                        {terminalLogs.map((log, index) => (
                                            <p key={index} className="animate-in fade-in slide-in-from-left-2 duration-300">
                                                {log}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[8px] text-zinc-600 border-t border-zinc-900 pt-3">
                                    <span>GATEWAY STATUS: TRANSMITTING</span>
                                    <span className="animate-pulse">● SIGNAL ON</span>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 border-t border-zinc-850 pt-4 text-center">
                            <button onClick={() => setStep('search')} className="text-[10px] text-zinc-500 hover:text-white uppercase transition-colors">
                                [ Cancelar y volver ]
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. BOOKING TRIP & SEATING SELECTOR STEP */}
                {step === 'booking' && employee && (
                    <div className="w-full space-y-6">
                        
                        {/* Selector Tabs: Vuelos vs Camiones */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <Cpu className="w-5 h-5 text-cyan-400" />
                                    <span>Consola de Reservas</span>
                                </h2>
                                <p className="text-xs text-zinc-500">Selecciona el tipo de transporte y el asiento de tu preferencia.</p>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => { setActiveTab('terrestre'); setSelectedViaje(null); setSelectedSeat(null); }}
                                    className={`flex-1 sm:flex-none px-4 py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all font-mono
                                        ${activeTab === 'terrestre'
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                                            : 'bg-zinc-950/80 border-zinc-850 text-zinc-500 hover:border-zinc-800'}`}
                                >
                                    <Bus className="w-4 h-4" />
                                    <span>CAMIONES</span>
                                </button>
                                <button
                                    onClick={() => { setActiveTab('aereo'); setSelectedViaje(null); setSelectedSeat(null); }}
                                    className={`flex-1 sm:flex-none px-4 py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all font-mono
                                        ${activeTab === 'aereo'
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                                            : 'bg-zinc-950/80 border-zinc-850 text-zinc-500 hover:border-zinc-800'}`}
                                >
                                    <Plane className="w-4 h-4" />
                                    <span>VUELOS</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            
                            {/* Left Col (2/5): List of Voyages */}
                            <div className="lg:col-span-2 space-y-4">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">
                                    {activeTab === 'terrestre' ? 'Rutas Terrestres Disponibles' : 'Vuelos de Avioneta Disponibles'}
                                </h3>

                                {loadingViajes ? (
                                    <div className="py-12 text-center text-zinc-600 text-xs flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Buscando rutas en la red...</span>
                                    </div>
                                ) : viajes.length === 0 ? (
                                    <div className="py-12 px-4 border border-dashed border-zinc-850 rounded-2xl text-center text-zinc-600 text-xs">
                                        No hay viajes programados vigentes para esta categoría.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                        {viajes.map((v) => {
                                            const isSelected = selectedViaje?.id_viaje === v.id_viaje
                                            return (
                                                <button
                                                    key={v.id_viaje}
                                                    onClick={() => setSelectedViaje(v)}
                                                    className={`w-full text-left p-4 border rounded-xl transition-all duration-300 font-mono relative overflow-hidden group
                                                        ${isSelected 
                                                            ? 'bg-cyan-950/20 border-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.15)]' 
                                                            : 'bg-zinc-900/30 border-zinc-850 text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/50'}`}
                                                >
                                                    {isSelected && (
                                                        <div className="absolute top-0 right-0 w-8 h-8 bg-cyan-500 text-black flex items-center justify-center rounded-bl-xl font-bold text-xs">
                                                            ✓
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {v.tipo_vehiculo === 'Autobús' && <Bus className="w-4 h-4 text-cyan-400" />}
                                                        {v.tipo_vehiculo === 'Avioneta' && <Plane className="w-4 h-4 text-amber-500" />}
                                                        {v.tipo_vehiculo === 'Camioneta' && <Car className="w-4 h-4 text-emerald-400" />}
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                                                            {v.tipo_vehiculo} ({v.capacidad_total} Lgs)
                                                        </span>
                                                    </div>

                                                    <h4 className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors leading-tight mb-3">
                                                        {v.nombre_ruta}
                                                    </h4>

                                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                            {new Date(v.fecha + 'T12:00:00').toLocaleDateString()}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5 shrink-0" />
                                                            {v.hora} Hrs
                                                        </span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Right Col (3/5): Holo-Map & Reservation */}
                            <div className="lg:col-span-3">
                                {selectedViaje ? (
                                    <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-6 relative shadow-2xl">
                                        <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[8px] text-emerald-500 tracking-wider">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                            <span>MAP_CONNECT_ONLINE</span>
                                        </div>

                                        <h3 className="text-center font-bold text-white uppercase tracking-wider mb-2 text-sm">
                                            Holo-Plano de Asignación
                                        </h3>
                                        <p className="text-center text-[10px] text-zinc-500 mb-6 font-mono">
                                            {selectedViaje.nombre_ruta} - {selectedViaje.tipo_vehiculo}
                                        </p>

                                        {loadingAsientos ? (
                                            <div className="py-20 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-3">
                                                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                                                <span>Escaneando matriz de asientos...</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Seating map render based on type */}
                                                <div>
                                                    {selectedViaje.tipo_vehiculo === 'Autobús' && renderAutobusLayout()}
                                                    {selectedViaje.tipo_vehiculo === 'Avioneta' && renderAvionetaLayout()}
                                                    {selectedViaje.tipo_vehiculo === 'Camioneta' && renderCamionetaLayout()}
                                                </div>

                                                {/* Map Legend */}
                                                <div className="flex justify-center gap-6 border-t border-zinc-850 pt-4 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 bg-zinc-900 border border-zinc-800 rounded"></span>
                                                        Disponible
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 bg-red-950/40 border border-red-900 rounded"></span>
                                                        Reservado (Otros)
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 bg-amber-500/20 border border-amber-500 rounded"></span>
                                                        Tu Asiento
                                                    </span>
                                                </div>

                                                {/* Seat Actions / Selection detail */}
                                                {selectedSeat && (() => {
                                                    const r = reservas.find(res => res.numero_asiento === selectedSeat)
                                                    const isOwn = r?.id_empleado === employee.id_empleado

                                                    if (isOwn && r) {
                                                        return (
                                                            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-in fade-in duration-300">
                                                                <div className="text-center sm:text-left">
                                                                    <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">RESERVACIÓN REGISTRADA</span>
                                                                    <h4 className="text-white text-sm font-bold mt-1">Tienes reservado el Asiento {selectedSeat}</h4>
                                                                    <p className="text-[10px] text-zinc-500">¿Deseas liberar tu lugar en esta ruta?</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleReleaseSeat(r.id_reserva)}
                                                                    className="w-full sm:w-auto bg-red-900 hover:bg-red-800 text-white font-bold px-4 py-2.5 rounded-lg text-xs"
                                                                >
                                                                    LIBERAR ASIENTO
                                                                </button>
                                                            </div>
                                                        )
                                                    }

                                                    return (
                                                        <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-in fade-in duration-300">
                                                            <div className="text-center sm:text-left font-mono">
                                                                <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">CONFIRMACIÓN REQUERIDA</span>
                                                                <h4 className="text-white text-sm font-bold mt-1">Has seleccionado el Asiento {selectedSeat}</h4>
                                                                <p className="text-[10px] text-zinc-500">Haz clic en Reservar para apartar tu lugar.</p>
                                                            </div>
                                                            <button
                                                                onClick={handleConfirmBooking}
                                                                disabled={confirmingReservation}
                                                                className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-black font-black px-6 py-2.5 rounded-lg text-xs shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2"
                                                            >
                                                                {confirmingReservation ? 'PROCESANDO...' : 'RESERVAR ASIENTO'}
                                                            </button>
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full min-h-[350px] border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-zinc-600">
                                        <Cpu className="w-12 h-12 mb-3 text-zinc-800" />
                                        <span className="text-xs uppercase tracking-widest">Selecciona un viaje disponible del listado</span>
                                        <span className="text-[10px] text-zinc-700 mt-1">El holo-mapa de asientos se cargará automáticamente.</span>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                )}

                {/* 4. DIGITAL BOARDING PASS STEP */}
                {step === 'pass' && bookingSuccessData && (
                    <div className="w-full max-w-lg mx-auto space-y-6">
                        
                        {/* Sci-Fi Cyberpunk Boarding Pass Card */}
                        <div id="boarding-pass" className="bg-[#0b0c10] border border-cyan-500/50 rounded-3xl p-6 sm:p-8 relative shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden print:border-black print:text-black print:bg-white print:shadow-none">
                            {/* Glowing lines decorative */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 print:hidden" />
                            <div className="absolute top-6 right-6 text-cyan-500/40 text-[9px] font-mono tracking-widest uppercase print:hidden">BOARDING_PASS_GEN_V2</div>

                            {/* Ticket Header */}
                            <div className="flex justify-between items-start border-b border-zinc-800 pb-6 print:border-zinc-300">
                                <div>
                                    <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase font-mono">PASE DE RESTRICCIÓN DE VIAJE</h3>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter mt-1 print:text-black">
                                        EL EXPEDIENTE
                                    </h2>
                                    <p className="text-[8px] text-zinc-500 tracking-widest font-mono mt-1 uppercase">SISTEMA INTEGRAL DE TRANSPORTE MINERO</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-zinc-500 uppercase font-mono">FOLIO_TICKET</span>
                                    <div className="text-lg font-bold text-white font-mono uppercase tracking-widest mt-1 print:text-black">
                                        {bookingSuccessData.reserva.id_reserva.substring(0, 8)}
                                    </div>
                                </div>
                            </div>

                            {/* Passenger Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">PASAJERO / EMPLEADO</span>
                                        <span className="text-sm font-bold text-white uppercase font-mono print:text-black">
                                            {bookingSuccessData.empleado.nombre} {bookingSuccessData.empleado.apellido_paterno}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">PUESTO Y ADSCRIPCIÓN</span>
                                        <span className="text-xs text-zinc-300 uppercase block font-mono print:text-black">
                                            {bookingSuccessData.empleado.puesto || 'OPERARIO GENERAL'}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">TIPO DE VEHÍCULO</span>
                                        <span className="text-sm font-bold text-cyan-400 uppercase font-mono print:text-black flex items-center gap-1.5">
                                            {bookingSuccessData.viaje.tipo_vehiculo === 'Autobús' && <Bus className="w-4 h-4 shrink-0" />}
                                            {bookingSuccessData.viaje.tipo_vehiculo === 'Avioneta' && <Plane className="w-4 h-4 shrink-0" />}
                                            {bookingSuccessData.viaje.tipo_vehiculo === 'Camioneta' && <Car className="w-4 h-4 shrink-0" />}
                                            {bookingSuccessData.viaje.tipo_vehiculo}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block font-mono">NÚMERO DE ASIENTO</span>
                                        <span className="text-lg font-extrabold text-amber-400 uppercase font-mono print:text-black">
                                            ASIENTO #{bookingSuccessData.reserva.numero_asiento}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Route & Trip Details */}
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 my-6 print:bg-zinc-100 print:border-zinc-300 print:text-black">
                                <div className="text-[9px] text-zinc-500 uppercase block font-mono mb-2">RUTA ASIGNADA</div>
                                <div className="text-md font-bold text-white uppercase tracking-tight mb-4 print:text-black flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                                    {bookingSuccessData.viaje.nombre_ruta}
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block">FECHA DE SALIDA</span>
                                        <span className="font-bold text-white print:text-black">{new Date(bookingSuccessData.viaje.fecha + 'T12:00:00').toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase block">HORA DE EMBARQUE</span>
                                        <span className="font-bold text-white print:text-black">{bookingSuccessData.viaje.hora} Hrs</span>
                                    </div>
                                </div>
                            </div>

                            {/* Barcode Mock */}
                            <div className="flex flex-col items-center justify-center mt-8 pt-6 border-t border-zinc-900 print:border-zinc-300">
                                <div className="h-10 w-full max-w-sm bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,transparent_2px,transparent_6px,#000_6px,#000_10px,transparent_10px,transparent_12px)] opacity-80 print:opacity-100" />
                                <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.4em] mt-2 block">
                                    *{bookingSuccessData.reserva.id_reserva.substring(0, 18)}*
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
                                onClick={() => {
                                    setStep('booking')
                                    setSelectedSeat(null)
                                }}
                                className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold px-6 py-3.5 rounded-xl transition-all text-xs"
                            >
                                RESERVAR OTRO VIAJE
                            </button>
                        </div>

                    </div>
                )}

            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-md py-4 px-6 z-10 text-center text-[9px] text-zinc-600 font-mono tracking-widest shrink-0 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>ESTADO CONEXIÓN: ENLADA SEGURO (HTTPS/TLS)</span>
                <span>DESARROLLADO PARA GRUPO METALES PRECIOSOS &copy; 2026</span>
            </footer>
        </div>
    )
}
