'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    Bus, Plane, Car, Plus, Calendar, Clock, MapPin, Users, ArrowRight, 
    ExternalLink, Copy, Check, FileText, Send, User, Armchair, HelpCircle
} from 'lucide-react'
import Link from 'next/link'

interface Viaje {
    id_viaje: string
    tipo_vehiculo: string
    nombre_ruta: string
    fecha: string
    hora: string
    capacidad_total: number
    estado: string
    creado_el: string
    creador?: { nombre: string, apellido_paterno: string }
}

interface Solicitud {
    id_solicitud: string
    nombre_completo: string
    departamento: string
    celular_whatsapp: string
    tipo_vehiculo: string
    fecha_sugerida: string
    estatus: string
    clave_confirmacion?: string
    id_viaje?: string
    numero_asiento?: number
    chofer_nombre?: string
    creado_el: string
}

export default function TransporteDashboard() {
    const [viajes, setViajes] = useState<Viaje[]>([])
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    
    // Tab switching: 'viajes' | 'solicitudes'
    const [adminTab, setAdminTab] = useState<'viajes' | 'solicitudes'>('viajes')

    // Link share feedback state
    const [copied, setCopied] = useState(false)

    // Formulario de Nuevo Viaje
    const [showForm, setShowForm] = useState(false)
    const [tipo, setTipo] = useState('Autobús')
    const [ruta, setRuta] = useState('')
    const [fecha, setFecha] = useState('')
    const [hora, setHora] = useState('')
    const [capacidad, setCapacidad] = useState('37')

    // Modal Asignar Estado
    const [selectedSol, setSelectedSol] = useState<Solicitud | null>(null)
    const [assignTripId, setAssignTripId] = useState('')
    const [assignSeat, setAssignSeat] = useState<number | null>(null)
    const [assignDriver, setAssignDriver] = useState('')
    const [assignClave, setAssignClave] = useState('')
    const [assignEmpleadoId, setAssignEmpleadoId] = useState('')
    const [savingAssignment, setSavingAssignment] = useState(false)

    // List of occupied seats for selected assign trip
    const [occupiedSeats, setOccupiedSeats] = useState<number[]>([])

    const fetchViajes = async () => {
        const { data, error } = await supabase
            .from('transporte_personal_viajes')
            .select(`
                *,
                creador:empleados!transporte_personal_viajes_creado_por_fkey(nombre, apellido_paterno)
            `)
            .order('fecha', { ascending: true })
            .order('hora', { ascending: true })
        
        if (!error && data) {
            setViajes(data)
        }
    }

    const fetchSolicitudes = async () => {
        const { data, error } = await supabase
            .from('transporte_personal_solicitudes')
            .select('*')
            .order('creado_el', { ascending: false })

        if (!error && data) {
            setSolicitudes(data)
        }
    }

    const fetchEmpleados = async () => {
        const { data, error } = await supabase
            .from('empleados')
            .select('id_empleado, nombre, apellido_paterno, departamento_id:cat_departamentos(departamento)')
            .eq('estado_empleado', 'Activo')
            .order('nombre')

        if (!error && data) {
            setEmpleados(data)
        }
    }

    const loadData = async () => {
        setLoading(true)
        await Promise.all([fetchViajes(), fetchSolicitudes(), fetchEmpleados()])
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleCopyLink = () => {
        const url = `${window.location.origin}/reservar-viaje`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleCrearViaje = async () => {
        if (!ruta || !fecha || !hora || !capacidad) return alert('Llena todos los campos')
        
        const { error } = await supabase.from('transporte_personal_viajes').insert([{
            tipo_vehiculo: tipo,
            nombre_ruta: ruta,
            fecha,
            hora,
            capacidad_total: parseInt(capacidad)
        }])
        
        if (error) {
            console.error(error)
            alert('Error al crear el viaje.')
        } else {
            setShowForm(false)
            setRuta('')
            setFecha('')
            setHora('')
            fetchViajes()
        }
    }

    // Load occupied seats when trip changes in assignment modal
    useEffect(() => {
        if (assignTripId) {
            supabase
                .from('transporte_personal_asientos')
                .select('numero_asiento')
                .eq('id_viaje', assignTripId)
                .then(({ data }) => {
                    if (data) {
                        setOccupiedSeats(data.map(d => d.numero_asiento))
                    } else {
                        setOccupiedSeats([])
                    }
                    setAssignSeat(null)
                })
        } else {
            setOccupiedSeats([])
            setAssignSeat(null)
        }
    }, [assignTripId])

    const handleOpenAssignModal = (sol: Solicitud) => {
        setSelectedSol(sol)
        setAssignTripId('')
        setAssignSeat(null)
        setAssignDriver('')
        
        // Generate a random confirmation key (clean short alphanumeric)
        const randNum = Math.floor(1000 + Math.random() * 9000).toString()
        const vehChar = sol.tipo_vehiculo === 'Autobús' ? 'C' : 'V'
        setAssignClave(`${vehChar}-${randNum}`)

        // Try to pre-match employee by name similarity
        const matched = empleados.find(e => 
            `${e.nombre} ${e.apellido_paterno}`.toLowerCase().includes(sol.nombre_completo.toLowerCase())
        )
        setAssignEmpleadoId(matched ? matched.id_empleado : '')
    }

    const handleConfirmAssignment = async () => {
        if (!selectedSol || !assignTripId || !assignSeat) {
            alert('Por favor selecciona el viaje y el asiento.')
            return
        }

        setSavingAssignment(true)

        try {
            // 1. Insert reservation into seats table
            const seatPayload: any = {
                id_viaje: assignTripId,
                numero_asiento: assignSeat
            }
            
            if (assignEmpleadoId) {
                seatPayload.id_empleado = assignEmpleadoId
            } else {
                seatPayload.nombre_pasajero = selectedSol.nombre_completo
                seatPayload.departamento_pasajero = selectedSol.departamento
            }

            const { error: seatError } = await supabase
                .from('transporte_personal_asientos')
                .insert([seatPayload])

            if (seatError) {
                // If it fails, could be seat taken or passenger already has seat
                throw new Error('El asiento ya está ocupado o el pasajero ya cuenta con reservación en este viaje.')
            }

            // 2. Update the request with details
            const { error: solError } = await supabase
                .from('transporte_personal_solicitudes')
                .update({
                    estatus: 'Asignado',
                    clave_confirmacion: assignClave,
                    id_viaje: assignTripId,
                    numero_asiento: assignSeat,
                    chofer_nombre: assignDriver.trim() || 'POR CONFIRMAR'
                })
                .eq('id_solicitud', selectedSol.id_solicitud)

            if (solError) throw solError

            alert('Asiento y clave asignados con éxito.')
            setSelectedSol(null)
            loadData()
        } catch (e: any) {
            console.error(e)
            alert('Error en la asignación: ' + e.message)
        } finally {
            setSavingAssignment(false)
        }
    }

    const handleSendWhatsApp = (sol: Solicitud) => {
        const viajeDetails = viajes.find(v => v.id_viaje === sol.id_viaje)
        if (!viajeDetails) return

        const formattedDate = new Date(viajeDetails.fecha + 'T12:00:00').toLocaleDateString()
        const text = `Hola *${sol.nombre_completo}*, tu viaje de *${viajeDetails.nombre_ruta}* ha sido confirmado.
🗓️ *Fecha:* ${formattedDate}
⏰ *Hora:* ${viajeDetails.hora.substring(0, 5)} Hrs
🚌 *Vehículo:* ${viajeDetails.tipo_vehiculo} (Asiento #${sol.numero_asiento})
👤 *Chofer:* ${sol.chofer_nombre || 'Por confirmar'}

🔑 *Tu clave de acceso es:* ${sol.clave_confirmacion}
Puedes descargar tu pase de abordaje en:
${window.location.origin}/reservar-viaje`

        const waUrl = `https://api.whatsapp.com/send?phone=52${sol.celular_whatsapp}&text=${encodeURIComponent(text)}`
        window.open(waUrl, '_blank')
    }

    // Render seats in admin assignment modal
    const renderSeatGrid = (capacity: number) => {
        const seats = Array.from({ length: capacity }, (_, i) => i + 1)
        return (
            <div className="grid grid-cols-5 gap-2 max-h-[160px] overflow-y-auto p-2 border border-zinc-200 rounded-xl bg-zinc-50">
                {seats.map(num => {
                    const isOccupied = occupiedSeats.includes(num)
                    const isSelected = assignSeat === num
                    return (
                        <button
                            key={num}
                            type="button"
                            disabled={isOccupied}
                            onClick={() => setAssignSeat(num)}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all text-center
                                ${isOccupied 
                                    ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed'
                                    : (isSelected
                                        ? 'bg-cyan-500 border-cyan-600 text-white shadow-md'
                                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400')}`}
                        >
                            {num}
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <Bus className="w-8 h-8 text-indigo-500" /> 
                        Transporte de Personal
                    </h1>
                    <p className="text-zinc-500 mt-1 font-medium font-mono text-xs">SISTEMA INTEGRAL DE RUTAS Y AUTO-SERVICIO / BACIS</p>
                </div>
                <div className="flex gap-2.5">
                    <Link
                        href="/transporte/calendario"
                        className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Calendar className="w-4 h-4 text-amber-500" /> Sobrecalendario de Rutas
                    </Link>
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" /> Programar Viaje
                    </button>
                </div>
            </div>

            {/* Portal link sharing banner */}
            <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-800 text-zinc-300 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg">
                        <ExternalLink className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-white uppercase tracking-wider">Portal de Auto-Servicio para Trabajadores</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">Los empleados pueden solicitar viajes y descargar sus pases de abordaje de manera independiente.</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleCopyLink}
                        className="flex-1 md:flex-none border border-zinc-850 bg-zinc-900/60 hover:bg-zinc-850 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {copied ? (
                            <>
                                <Check className="w-4 h-4 text-green-500" />
                                COPIADO
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                COPIAR ENLACE
                            </>
                        )}
                    </button>
                    <Link 
                        href="/reservar-viaje"
                        target="_blank"
                        className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                    >
                        ABRIR PORTAL
                    </Link>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-zinc-200 gap-4">
                <button
                    onClick={() => setAdminTab('viajes')}
                    className={`py-2 px-4 text-sm font-black border-b-2 transition-all uppercase tracking-wider
                        ${adminTab === 'viajes'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-zinc-500 hover:text-black'}`}
                >
                    Viajes Programados ({viajes.length})
                </button>
                <button
                    onClick={() => setAdminTab('solicitudes')}
                    className={`py-2 px-4 text-sm font-black border-b-2 transition-all uppercase tracking-wider
                        ${adminTab === 'solicitudes'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-zinc-500 hover:text-black'}`}
                >
                    Solicitudes de Personal ({solicitudes.length})
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-lg font-black text-zinc-800 border-b pb-2 mb-4">Nuevo Viaje Programado</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase">Vehículo</label>
                            <select value={tipo} onChange={e => {
                                setTipo(e.target.value)
                                if(e.target.value === 'Autobús') setCapacidad('37')
                                if(e.target.value === 'Avioneta') setCapacidad('8')
                                if(e.target.value === 'Camioneta') setCapacidad('4')
                            }} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 font-bold">
                                <option value="Autobús">Autobús (37 lgs)</option>
                                <option value="Avioneta">Avioneta (8 lgs)</option>
                                <option value="Camioneta">Camioneta (4 lgs)</option>
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Ruta / Destino</label>
                            <input type="text" value={ruta} onChange={e => setRuta(e.target.value)} placeholder="Ej. Durango - Bacis" className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase">Fecha</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase">Hora Salida</label>
                            <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="px-4 py-2 text-zinc-500 font-bold hover:bg-zinc-100 rounded-lg">Cancelar</button>
                        <button onClick={handleCrearViaje} className="px-6 py-2 bg-zinc-900 text-white font-bold rounded-lg shadow-md hover:bg-black">Crear Viaje</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="p-12 text-center text-zinc-400 font-bold animate-pulse">Cargando datos...</div>
            ) : (
                <>
                    {/* TAB VIAJES */}
                    {adminTab === 'viajes' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {viajes.map(v => (
                                <div key={v.id_viaje} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                                    <div className="p-5 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-2 rounded-lg ${
                                                    v.tipo_vehiculo === 'Autobús' ? 'bg-indigo-100 text-indigo-600' :
                                                    v.tipo_vehiculo === 'Avioneta' ? 'bg-sky-100 text-sky-600' :
                                                    'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                    {v.tipo_vehiculo === 'Autobús' && <Bus className="w-5 h-5" />}
                                                    {v.tipo_vehiculo === 'Avioneta' && <Plane className="w-5 h-5" />}
                                                    {v.tipo_vehiculo === 'Camioneta' && <Car className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">{v.tipo_vehiculo}</div>
                                                    <div className="font-bold text-zinc-900 leading-tight">{v.capacidad_total} Pasajeros</div>
                                                </div>
                                            </div>
                                            <span className="bg-zinc-100 text-zinc-600 text-xs font-black px-2 py-1 rounded-full">{v.estado}</span>
                                        </div>
                                        
                                        <h3 className="text-xl font-black text-zinc-800 mb-4">{v.nombre_ruta}</h3>
                                        
                                        <div className="space-y-2 text-sm text-zinc-600">
                                            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-zinc-400" /> {new Date(v.fecha + 'T12:00:00').toLocaleDateString()}</div>
                                            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> {v.hora.substring(0,5)} Hrs</div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 border-t border-zinc-100 bg-zinc-50">
                                        <Link href={`/transporte/${v.id_viaje}`} className="w-full bg-white border border-zinc-200 hover:border-indigo-300 hover:text-indigo-700 text-zinc-800 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                                            Ver Asientos y Reservar <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                            {viajes.length === 0 && (
                                <div className="col-span-full p-12 text-center text-zinc-400 font-bold border-2 border-dashed border-zinc-200 rounded-2xl">
                                    No hay viajes programados. Haz clic en "Programar Viaje" o ve al sobrecalendario.
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB SOLICITUDES */}
                    {adminTab === 'solicitudes' && (
                        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-zinc-600">
                                    <thead className="bg-zinc-55 bg-zinc-50 text-[10px] text-zinc-500 uppercase font-black border-b border-zinc-200">
                                        <tr>
                                            <th className="p-4">Fecha Solicitud</th>
                                            <th className="p-4">Pasajero</th>
                                            <th className="p-4">Departamento</th>
                                            <th className="p-4">Celular (WhatsApp)</th>
                                            <th className="p-4">Preferencia</th>
                                            <th className="p-4">Fecha Sugerida</th>
                                            <th className="p-4">Estatus</th>
                                            <th className="p-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-250 border-zinc-100">
                                        {solicitudes.map(sol => (
                                            <tr key={sol.id_solicitud} className="hover:bg-zinc-50/50 transition-colors">
                                                <td className="p-4 font-mono text-xs text-zinc-400">
                                                    {new Date(sol.creado_el).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 font-bold text-zinc-950">
                                                    {sol.nombre_completo}
                                                </td>
                                                <td className="p-4 font-semibold text-zinc-600">
                                                    {sol.departamento}
                                                </td>
                                                <td className="p-4 font-mono text-xs">
                                                    {sol.celular_whatsapp}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full
                                                        ${sol.tipo_vehiculo === 'Autobús' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-800'}`}>
                                                        {sol.tipo_vehiculo}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-zinc-800">
                                                    {new Date(sol.fecha_sugerida + 'T12:00:00').toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase
                                                        ${sol.estatus === 'Pendiente' ? 'bg-zinc-100 text-zinc-600 animate-pulse' :
                                                          sol.estatus === 'Asignado' ? 'bg-emerald-100 text-emerald-700 font-bold' :
                                                          'bg-red-100 text-red-700'}`}>
                                                        {sol.estatus}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {sol.estatus === 'Pendiente' ? (
                                                        <button
                                                            onClick={() => handleOpenAssignModal(sol)}
                                                            className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-sm"
                                                        >
                                                            Asignar Lugar
                                                        </button>
                                                    ) : (
                                                        <div className="flex justify-end gap-2 items-center text-xs">
                                                            <div className="text-left font-mono text-[9px] text-zinc-400">
                                                                <div>Asiento: <span className="font-bold text-zinc-700">{sol.numero_asiento}</span></div>
                                                                <div>Clave: <span className="font-bold text-amber-600">{sol.clave_confirmacion}</span></div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleSendWhatsApp(sol)}
                                                                className="bg-green-600 hover:bg-green-700 text-white font-bold p-2 rounded-lg flex items-center justify-center"
                                                                title="Enviar clave y datos por WhatsApp"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {solicitudes.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-zinc-400 font-bold">
                                                    No hay solicitudes cargadas en el portal.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Asignar Lugar Modal */}
            {selectedSol && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-150 space-y-4">
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-3 mb-2">
                            <h3 className="text-lg font-black text-zinc-950 flex items-center gap-2">
                                <Armchair className="w-5 h-5 text-indigo-500" />
                                Asignar Lugar de Viaje
                            </h3>
                            <button onClick={() => setSelectedSol(null)} className="text-zinc-400 hover:text-black font-black text-xl px-1">&times;</button>
                        </div>

                        {/* Request Summary details */}
                        <div className="bg-zinc-50 border rounded-xl p-3 text-xs space-y-1 font-mono">
                            <p><span className="text-zinc-500 font-bold">Pasajero:</span> <span className="text-zinc-950 font-bold">{selectedSol.nombre_completo}</span></p>
                            <p><span className="text-zinc-500">Depto:</span> {selectedSol.departamento}</p>
                            <p><span className="text-zinc-500">Preferencia:</span> {selectedSol.tipo_vehiculo} ({selectedSol.fecha_sugerida})</p>
                        </div>

                        {/* Step 1: Link to database employee */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase">1. Vincular a Ficha del Empleado</label>
                            <select 
                                value={assignEmpleadoId}
                                onChange={e => setAssignEmpleadoId(e.target.value)}
                                className="w-full p-2 border rounded-lg text-xs bg-zinc-50 font-bold focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">-- Selecciona el empleado --</option>
                                {empleados.map(e => (
                                    <option key={e.id_empleado} value={e.id_empleado}>
                                        {e.nombre} {e.apellido_paterno} [{e.departamento_id?.departamento || 'N/A'}]
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Step 2: Select programmed Trip */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase">2. Seleccionar Ruta Programada</label>
                            <select
                                value={assignTripId}
                                onChange={e => setAssignTripId(e.target.value)}
                                className="w-full p-2 border rounded-lg text-xs bg-zinc-50 font-bold focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">-- Selecciona el viaje --</option>
                                {viajes
                                    .filter(v => v.tipo_vehiculo === selectedSol.tipo_vehiculo && v.fecha === selectedSol.fecha_sugerida)
                                    .map(v => (
                                        <option key={v.id_viaje} value={v.id_viaje}>
                                            {v.hora.substring(0, 5)} - {v.nombre_ruta} ({v.tipo_vehiculo})
                                        </option>
                                    ))}
                            </select>
                            {viajes.filter(v => v.tipo_vehiculo === selectedSol.tipo_vehiculo && v.fecha === selectedSol.fecha_sugerida).length === 0 && (
                                <p className="text-[10px] text-amber-600 font-bold mt-1">⚠️ No hay viajes programados de tipo {selectedSol.tipo_vehiculo} para el día {selectedSol.fecha_sugerida}. Programalo primero en la lista o en el sobrecalendario.</p>
                            )}
                        </div>

                        {/* Step 3: Choose seat */}
                        {assignTripId && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase">3. Selecciona el Asiento libre</label>
                                {(() => {
                                    const vDetails = viajes.find(v => v.id_viaje === assignTripId)
                                    return vDetails ? renderSeatGrid(vDetails.capacidad_total) : null
                                })()}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            {/* Driver Name */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-zinc-500 uppercase">4. Nombre Chofer</label>
                                <input 
                                    type="text" 
                                    value={assignDriver}
                                    onChange={e => setAssignDriver(e.target.value)}
                                    placeholder="Ej. Pedro M."
                                    className="w-full p-2 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Passcode Confirmation code */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-zinc-500 uppercase">5. Clave de Confirmación</label>
                                <input 
                                    type="text" 
                                    value={assignClave}
                                    onChange={e => setAssignClave(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-xs font-mono font-bold tracking-wider bg-zinc-50"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-3 border-t flex justify-end gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setSelectedSol(null)}
                                className="px-4 py-2 text-zinc-500 font-bold hover:bg-zinc-100 rounded-lg"
                                disabled={savingAssignment}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAssignment}
                                disabled={savingAssignment || !assignTripId || !assignSeat}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg shadow-md disabled:opacity-50"
                            >
                                {savingAssignment ? 'Asignando...' : 'Confirmar Asignación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
