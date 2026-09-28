'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    X, AlertTriangle, Send, Copy, Check, Bus, Car, Users, 
    Calendar, Clock, MapPin, User, CheckSquare, Square,
    CheckCircle2, MessageSquare, Phone, ArrowRight, ShieldCheck, RefreshCw
} from 'lucide-react'

interface Viaje {
    id_viaje: string
    tipo_vehiculo: string
    nombre_ruta: string
    fecha: string
    hora: string
    capacidad_total: number
    estado: string
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
}

interface Props {
    isOpen: boolean
    onClose: () => void
    viajeOrigen?: Viaje | null
    allSolicitudes: Solicitud[]
    initialSelectedSolicitudes?: Solicitud[]
    onSuccess: () => void
}

export default function SobrecupoModal({
    isOpen,
    onClose,
    viajeOrigen,
    allSolicitudes,
    initialSelectedSolicitudes,
    onSuccess
}: Props) {
    if (!isOpen) return null

    // Configuración del nuevo transporte
    const [tipoVehiculo, setTipoVehiculo] = useState<'Camioneta' | 'Combi'>('Camioneta')
    const [chofer, setChofer] = useState('Nicolás Gómez')
    const [horaSalida, setHoraSalida] = useState(viajeOrigen ? viajeOrigen.hora.substring(0, 5) : '07:30')
    const [puntoSalida, setPuntoSalida] = useState('Caseta Principal de Vigilancia / Unidad El Herrero')
    const [notasExtra, setNotasExtra] = useState('Llevar equipaje ligero e identificación. Presentarse 15 minutos antes.')
    const [rutaPersonalizada, setRutaPersonalizada] = useState(viajeOrigen?.nombre_ruta || 'Durango - Bacis')
    const [fechaViaje, setFechaViaje] = useState(viajeOrigen?.fecha || new Date().toISOString().split('T')[0])

    // Selección de solicitudes
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [copiedMsg, setCopiedMsg] = useState(false)
    const [copiedPhones, setCopiedPhones] = useState(false)

    // Plantilla de mensaje predeterminado
    const defaultTemplate = 
`Estimado(a) {nombre}, te informamos de parte de Recursos Humanos BACIS que debido a que el autobús programado ({hora_camion} hrs del {fecha}) alcanzó su cupo máximo (37 asientos), tu traslado a {destino} ha sido reprogramado en:

🚐 Unidad asignada: {tipo_vehiculo}
👤 Chofer a cargo: {chofer}
⏰ Hora de Salida: {hora_salida} hrs
📍 Punto de Abordaje: {punto}
📝 Indicaciones: {notas}

Por favor preséntate 15 minutos antes y responde a este mensaje para confirmar tu asistencia. ¡Buen viaje!`

    const [msgTemplate, setMsgTemplate] = useState(defaultTemplate)

    // Filtrar solicitudes candidatas (las que no alcanzaron camión o coinciden con la fecha/ruta)
    const candidateSolicitudes = useMemo(() => {
        if (initialSelectedSolicitudes && initialSelectedSolicitudes.length > 0) {
            return initialSelectedSolicitudes
        }

        // Si viene de un viaje específico
        if (viajeOrigen) {
            return allSolicitudes.filter(s => {
                const matchFecha = s.fecha_sugerida === viajeOrigen.fecha
                const isPendienteOrOverbook = s.estatus === 'Pendiente' || s.id_viaje === viajeOrigen.id_viaje || !s.numero_asiento
                return matchFecha && isPendienteOrOverbook
            })
        }

        // Si no hay viaje especificado, solicitudes pendientes en general
        return allSolicitudes.filter(s => s.estatus === 'Pendiente')
    }, [viajeOrigen, allSolicitudes, initialSelectedSolicitudes])

    // Inicializar seleccionados
    useEffect(() => {
        if (candidateSolicitudes.length > 0) {
            setSelectedIds(candidateSolicitudes.map(s => s.id_solicitud))
        } else {
            setSelectedIds([])
        }
    }, [candidateSolicitudes])

    // Sugerencia automática de vehículo según cantidad de personas
    useEffect(() => {
        if (selectedIds.length > 4) {
            setTipoVehiculo('Combi')
        } else {
            setTipoVehiculo('Camioneta')
        }
    }, [selectedIds.length])

    const selectedWorkers = useMemo(() => {
        return candidateSolicitudes.filter(s => selectedIds.includes(s.id_solicitud))
    }, [candidateSolicitudes, selectedIds])

    const toggleSelectAll = () => {
        if (selectedIds.length === candidateSolicitudes.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(candidateSolicitudes.map(s => s.id_solicitud))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    // Formateador de mensaje individual o genérico
    const generateMessage = (nombreTrabajador?: string) => {
        return msgTemplate
            .replace(/{nombre}/g, nombreTrabajador || 'Compañero(a)')
            .replace(/{fecha}/g, fechaViaje)
            .replace(/{hora_camion}/g, viajeOrigen ? viajeOrigen.hora.substring(0, 5) : 'programada')
            .replace(/{destino}/g, rutaPersonalizada)
            .replace(/{tipo_vehiculo}/g, tipoVehiculo === 'Camioneta' ? 'Camioneta (4 lugares)' : 'Combi (14 lugares)')
            .replace(/{chofer}/g, chofer || 'Por asignar')
            .replace(/{hora_salida}/g, horaSalida)
            .replace(/{punto}/g, puntoSalida)
            .replace(/{notas}/g, notasExtra)
    }

    // Copiar mensaje global al portapapeles
    const handleCopyGlobalMessage = async () => {
        const globalText = generateMessage('Estimado Personal')
        try {
            await navigator.clipboard.writeText(globalText)
            setCopiedMsg(true)
            setTimeout(() => setCopiedMsg(false), 2500)
        } catch (e) {
            console.error(e)
        }
    }

    // Copiar lista de teléfonos limpios
    const handleCopyPhoneNumbers = async () => {
        const phones = selectedWorkers
            .map(w => w.celular_whatsapp?.replace(/\D/g, ''))
            .filter(Boolean)

        if (phones.length === 0) return alert('No hay teléfonos para copiar')

        const phonesText = phones.join(', ')
        try {
            await navigator.clipboard.writeText(phonesText)
            setCopiedPhones(true)
            setTimeout(() => setCopiedPhones(false), 2500)
        } catch (e) {
            console.error(e)
        }
    }

    // Enviar WhatsApp directo a un trabajador individual
    const handleSendIndividualWhatsApp = (sol: Solicitud) => {
        const rawPhone = sol.celular_whatsapp?.replace(/\D/g, '') || ''
        if (!rawPhone) return alert(`No hay número de teléfono para ${sol.nombre_completo}`)
        
        // Agregar código de país México 52 si no lo tiene
        const fullPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone
        const message = generateMessage(sol.nombre_completo)
        const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    // Reasignación automática en base de datos: Crear viaje de Camioneta/Combi y mover solicitudes
    const handleReasignarEnSistema = async () => {
        if (selectedWorkers.length === 0) {
            return alert('Selecciona al menos a un trabajador para reasignar.')
        }

        const capacidad = tipoVehiculo === 'Camioneta' ? 4 : 14
        const neededUnits = Math.ceil(selectedWorkers.length / capacidad)
        
        const confirmMsg = neededUnits > 1 
            ? `Se crearán ${neededUnits} unidades de ${tipoVehiculo} para trasladar a los ${selectedWorkers.length} trabajadores. ¿Deseas continuar?`
            : `¿Crear viaje de ${tipoVehiculo} (${capacidad} lugares) con el chofer "${chofer}" y reasignar a los ${selectedWorkers.length} trabajadores seleccionados?`

        if (!confirm(confirmMsg)) return

        setSaving(true)
        try {
            for (let unit = 1; unit <= neededUnits; unit++) {
                const unitSuffix = neededUnits > 1 ? ` (Unidad ${unit})` : ''
                const rutaNombre = `${rutaPersonalizada}${unitSuffix}`
                
                // 1. Insertar el nuevo viaje programado
                const { data: newTrip, error: tripErr } = await supabase
                    .from('transporte_personal_viajes')
                    .insert([{
                        tipo_vehiculo: tipoVehiculo,
                        nombre_ruta: rutaNombre,
                        fecha: fechaViaje,
                        hora: horaSalida,
                        capacidad_total: capacidad,
                        estado: 'Programado'
                    }])
                    .select()
                    .single()

                if (tripErr || !newTrip) throw tripErr || new Error('No se pudo crear el viaje.')

                // 2. Tomar el segmento de trabajadores para esta unidad
                const startIdx = (unit - 1) * capacidad
                const endIdx = startIdx + capacidad
                const workersForThisUnit = selectedWorkers.slice(startIdx, endIdx)

                // 3. Crear asientos y actualizar solicitudes
                for (let seatIdx = 0; seatIdx < workersForThisUnit.length; seatIdx++) {
                    const worker = workersForThisUnit[seatIdx]
                    const seatNum = seatIdx + 1

                    // Insertar en transporte_personal_asientos
                    await supabase
                        .from('transporte_personal_asientos')
                        .insert([{
                            id_viaje: newTrip.id_viaje,
                            numero_asiento: seatNum,
                            nombre_pasajero: worker.nombre_completo,
                            departamento_pasajero: worker.departamento
                        }])

                    // Actualizar solicitud de personal
                    await supabase
                        .from('transporte_personal_solicitudes')
                        .update({
                            id_viaje: newTrip.id_viaje,
                            numero_asiento: seatNum,
                            tipo_vehiculo: tipoVehiculo,
                            chofer_nombre: chofer,
                            estatus: 'Asignado'
                        })
                        .eq('id_solicitud', worker.id_solicitud)
                }
            }

            alert(`✅ ¡Operación exitosa! Se programó el transporte alternativo en ${tipoVehiculo} y se reasignaron los ${selectedWorkers.length} trabajadores con sus nuevos pases de abordar.`)
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error al reasignar:', error)
            alert('Error al reasignar trabajadores: ' + (error.message || 'Error desconocido'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
                {/* Header del Modal */}
                <div className="p-5 bg-gradient-to-r from-zinc-950 via-zinc-900 to-indigo-950 text-white flex justify-between items-start border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                Gestión de Sobrecupo y Notificación Global
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Comunica a los trabajadores que no alcanzaron lugar en el camión e indícales su salida en Camioneta o Combi.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-zinc-400 hover:text-white p-1 rounded-xl transition-colors text-xl font-bold"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cuerpo del Modal con Scroll */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Alerta de Contexto del Camión Saturado */}
                    {viajeOrigen ? (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <Bus className="w-5 h-5 text-amber-700 shrink-0" />
                                <div>
                                    <div className="text-xs font-black text-amber-900 uppercase">
                                        Autobús con cupo lleno ({viajeOrigen.capacidad_total} Asientos)
                                    </div>
                                    <div className="text-sm font-extrabold text-zinc-800">
                                        {viajeOrigen.nombre_ruta} — {viajeOrigen.fecha} a las {viajeOrigen.hora.substring(0, 5)} hrs
                                    </div>
                                </div>
                            </div>
                            <span className="bg-amber-200/80 text-amber-900 text-xs font-mono font-bold px-3 py-1 rounded-full">
                                {candidateSolicitudes.length} Rezagados detectados
                            </span>
                        </div>
                    ) : (
                        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Users className="w-5 h-5 text-indigo-600" />
                                <div>
                                    <div className="text-xs font-black text-indigo-900 uppercase">Notificación Masiva a Solicitudes</div>
                                    <div className="text-sm text-zinc-700 font-medium">Reasigna y notifica a personal sin lugar asignado</div>
                                </div>
                            </div>
                            <span className="bg-indigo-200/80 text-indigo-900 text-xs font-mono font-bold px-3 py-1 rounded-full">
                                {candidateSolicitudes.length} Solicitudes
                            </span>
                        </div>
                    )}

                    {/* Paso 1: Configurar Nuevo Medio de Transporte */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">1</span>
                            Configuración del Transporte Alternativo
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                            {/* Selector de Vehículo */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-500 uppercase">Nuevo Vehículo</label>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setTipoVehiculo('Camioneta')}
                                        className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                                            tipoVehiculo === 'Camioneta'
                                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                        }`}
                                    >
                                        <Car className="w-3.5 h-3.5" />
                                        <span>Camioneta (4)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipoVehiculo('Combi')}
                                        className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                                            tipoVehiculo === 'Combi'
                                                ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        <span>Combi (14)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Chofer Asignado */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-500 uppercase">Chofer Asignado</label>
                                <input
                                    type="text"
                                    value={chofer}
                                    onChange={e => setChofer(e.target.value)}
                                    placeholder="Ej. Nicolás Gómez"
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                />
                            </div>

                            {/* Hora de Salida */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-500 uppercase">Hora de Salida</label>
                                <input
                                    type="time"
                                    value={horaSalida}
                                    onChange={e => setHoraSalida(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                />
                            </div>

                            {/* Fecha */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-500 uppercase">Fecha de Salida</label>
                                <input
                                    type="date"
                                    value={fechaViaje}
                                    onChange={e => setFechaViaje(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                />
                            </div>

                            {/* Punto de Abordaje */}
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase">Punto de Abordaje / Reunión</label>
                                <input
                                    type="text"
                                    value={puntoSalida}
                                    onChange={e => setPuntoSalida(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                />
                            </div>

                            {/* Notas / Indicaciones */}
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase">Indicaciones Especiales</label>
                                <input
                                    type="text"
                                    value={notasExtra}
                                    onChange={e => setNotasExtra(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Paso 2: Selección de Personal que no alcanzó camión */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">2</span>
                                Trabajadores a Notificar / Reasignar ({selectedWorkers.length} seleccionados)
                            </h4>
                            <button
                                type="button"
                                onClick={toggleSelectAll}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                {selectedIds.length === candidateSolicitudes.length ? (
                                    <>
                                        <Square className="w-3.5 h-3.5" /> Deseleccionar todos
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-3.5 h-3.5" /> Seleccionar todos ({candidateSolicitudes.length})
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="border border-zinc-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-zinc-100 text-zinc-600 font-bold sticky top-0 border-b border-zinc-200">
                                    <tr>
                                        <th className="p-2.5 pl-3 w-8"></th>
                                        <th className="p-2.5">Trabajador</th>
                                        <th className="p-2.5">Departamento</th>
                                        <th className="p-2.5">Celular / WhatsApp</th>
                                        <th className="p-2.5 text-right pr-3">WhatsApp 1 a 1</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {candidateSolicitudes.map(sol => {
                                        const isSelected = selectedIds.includes(sol.id_solicitud)
                                        return (
                                            <tr key={sol.id_solicitud} className={`hover:bg-zinc-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                                                <td className="p-2.5 pl-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(sol.id_solicitud)}
                                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="p-2.5 font-bold text-zinc-900">
                                                    {sol.nombre_completo}
                                                </td>
                                                <td className="p-2.5 text-zinc-600">
                                                    {sol.departamento}
                                                </td>
                                                <td className="p-2.5 font-mono text-zinc-700">
                                                    {sol.celular_whatsapp || 'Sin número'}
                                                </td>
                                                <td className="p-2.5 text-right pr-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendIndividualWhatsApp(sol)}
                                                        className="bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                                        title="Abrir WhatsApp con mensaje personalizado"
                                                    >
                                                        <MessageSquare className="w-3 h-3 text-green-600" />
                                                        <span>Enviar</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {candidateSolicitudes.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-zinc-400 font-bold">
                                                No hay solicitudes pendientes o rezagadas para esta fecha.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Paso 3: Mensaje Predeterminado Global & Previsualización */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">3</span>
                                Mensaje Predeterminado (Global y Personalizable)
                            </h4>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyPhoneNumbers}
                                    className="text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all"
                                    title="Copia los teléfonos separados por comas para lista de difusión"
                                >
                                    {copiedPhones ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Phone className="w-3.5 h-3.5" />}
                                    <span>{copiedPhones ? 'Teléfonos Copiados' : 'Copiar Teléfonos'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyGlobalMessage}
                                    className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all"
                                    title="Copia el mensaje completo para difundirlo en grupo"
                                >
                                    {copiedMsg ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedMsg ? '¡Mensaje Copiado!' : 'Copiar Mensaje Global'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                                    Plantilla Editable (Variables: {'{nombre}'}, {'{fecha}'}, {'{tipo_vehiculo}'}, etc.)
                                </label>
                                <textarea
                                    value={msgTemplate}
                                    onChange={e => setMsgTemplate(e.target.value)}
                                    rows={6}
                                    className="w-full p-3 border border-zinc-300 rounded-2xl text-xs font-mono bg-zinc-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                                    Vista Previa para {selectedWorkers[0]?.nombre_completo || 'Trabajador'}
                                </label>
                                <div className="p-3 bg-emerald-950/5 border border-emerald-800/20 rounded-2xl text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed h-[135px] overflow-y-auto">
                                    {generateMessage(selectedWorkers[0]?.nombre_completo)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer con Acciones */}
                <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="text-xs text-zinc-500 font-medium">
                        Se asignarán a <b>{tipoVehiculo}</b> ({selectedWorkers.length} pasajeros) con el chofer <b>{chofer}</b>.
                    </div>
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 text-zinc-600 font-bold hover:bg-zinc-200 rounded-xl text-xs transition-colors"
                            disabled={saving}
                        >
                            Cerrar
                        </button>

                        <button
                            type="button"
                            onClick={handleReasignarEnSistema}
                            disabled={saving || selectedWorkers.length === 0}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Programando...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Crear Viaje y Reasignar ({selectedWorkers.length})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
