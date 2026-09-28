'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    X, AlertTriangle, Send, Copy, Check, Bus, Car, Users, 
    Calendar, Clock, MapPin, User, CheckSquare, Square,
    CheckCircle2, MessageSquare, Phone, ArrowRight, ShieldCheck, 
    RefreshCw, PlusCircle, ListFilter, HelpCircle, Layers
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
    allViajes: Viaje[]
    allSolicitudes: Solicitud[]
    initialSelectedSolicitudes?: Solicitud[]
    onSuccess: () => void
}

export default function SobrecupoModal({
    isOpen,
    onClose,
    viajeOrigen,
    allViajes,
    allSolicitudes,
    initialSelectedSolicitudes,
    onSuccess
}: Props) {
    if (!isOpen) return null

    // 1. Selector de Fecha y Viaje
    const [selectedFecha, setSelectedFecha] = useState<string>(() => {
        if (viajeOrigen?.fecha) return viajeOrigen.fecha
        if (initialSelectedSolicitudes && initialSelectedSolicitudes.length > 0) {
            return initialSelectedSolicitudes[0].fecha_sugerida
        }
        return new Date().toISOString().split('T')[0]
    })

    const [selectedViajeId, setSelectedViajeId] = useState<string>(() => {
        return viajeOrigen?.id_viaje || 'TODOS'
    })

    // 2. Modo de Reasignación: 'crear_nuevo' | 'existente'
    const [reassignMode, setReassignMode] = useState<'crear_nuevo' | 'existente'>('crear_nuevo')

    // Campos si se crea uno nuevo aquí mismo
    const [nuevoTipo, setNuevoTipo] = useState<'Camioneta' | 'Combi'>('Camioneta')
    const [nuevoChofer, setNuevoChofer] = useState('Nicolás Gómez')
    const [nuevaHora, setNuevaHora] = useState(viajeOrigen ? viajeOrigen.hora.substring(0, 5) : '07:30')
    const [nuevoPunto, setNuevoPunto] = useState('Caseta Principal de Vigilancia / Unidad El Herrero')
    const [nuevasNotas, setNuevasNotas] = useState('Presentarse 15 minutos antes con equipaje ligero e identificación.')
    const [nuevaRuta, setNuevaRuta] = useState(viajeOrigen?.nombre_ruta || 'Durango - Bacis')

    // Campos si se usa un viaje ya existente de ese mismo día
    const [targetExistingViajeId, setTargetExistingViajeId] = useState<string>('')
    const [existingSeatsOccupied, setExistingSeatsOccupied] = useState<number[]>([])
    const [loadingExistingSeats, setLoadingExistingSeats] = useState(false)

    // Selección de solicitudes a reasignar
    const [selectedSolIds, setSelectedSolIds] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [copiedMsg, setCopiedMsg] = useState(false)
    const [copiedPhones, setCopiedPhones] = useState(false)

    // Sincronizar si cambia viajeOrigen al abrir
    useEffect(() => {
        if (viajeOrigen) {
            setSelectedFecha(viajeOrigen.fecha)
            setSelectedViajeId(viajeOrigen.id_viaje)
            setNuevaHora(viajeOrigen.hora.substring(0, 5))
            setNuevaRuta(viajeOrigen.nombre_ruta)
        }
    }, [viajeOrigen])

    // Viajes programados para la fecha seleccionada
    const viajesDelDia = useMemo(() => {
        return allViajes.filter(v => v.fecha === selectedFecha && v.estado !== 'Cancelado')
    }, [allViajes, selectedFecha])

    // Viajes disponibles para reasignación (excluyendo el viaje saturado seleccionado)
    const viajesDisponiblesParaReasignar = useMemo(() => {
        return viajesDelDia.filter(v => v.id_viaje !== selectedViajeId)
    }, [viajesDelDia, selectedViajeId])

    // Inicializar viaje existente destino si hay disponibles
    useEffect(() => {
        if (viajesDisponiblesParaReasignar.length > 0 && !targetExistingViajeId) {
            setTargetExistingViajeId(viajesDisponiblesParaReasignar[0].id_viaje)
        } else if (viajesDisponiblesParaReasignar.length === 0) {
            setTargetExistingViajeId('')
        }
    }, [viajesDisponiblesParaReasignar, targetExistingViajeId])

    // Cargar asientos ocupados cuando se selecciona un viaje existente
    useEffect(() => {
        if (!targetExistingViajeId || reassignMode !== 'existente') {
            setExistingSeatsOccupied([])
            return
        }

        const fetchOccupied = async () => {
            setLoadingExistingSeats(true)
            const { data } = await supabase
                .from('transporte_personal_asientos')
                .select('numero_asiento')
                .eq('id_viaje', targetExistingViajeId)

            if (data) {
                setExistingSeatsOccupied(data.map(d => d.numero_asiento))
            }
            setLoadingExistingSeats(false)
        }
        fetchOccupied()
    }, [targetExistingViajeId, reassignMode])

    // Viaje saturado actualmente seleccionado en el dropdown
    const viajeActual = useMemo(() => {
        if (selectedViajeId === 'TODOS') return null
        return allViajes.find(v => v.id_viaje === selectedViajeId) || null
    }, [allViajes, selectedViajeId])

    // 3. FILTRADO ESTRICTO: Solo personas de este día que NO TIENEN ASIENTO ASIGNADO
    const personasSinAsiento = useMemo(() => {
        return allSolicitudes.filter(sol => {
            // Debe coincidir con la fecha elegida
            const matchFecha = sol.fecha_sugerida === selectedFecha

            // Debe NO tener asiento asignado o estar en estado Pendiente
            const noTieneAsiento = !sol.numero_asiento || sol.numero_asiento === null || sol.estatus === 'Pendiente'

            // Si se eligió un viaje específico, debe estar vinculado a ese viaje o estar pendiente para esa fecha
            const matchViaje = selectedViajeId === 'TODOS' 
                ? true 
                : (sol.id_viaje === selectedViajeId || !sol.id_viaje)

            // No mostrar cancelados o personas que ya tienen viaje asignado con asiento válido
            const noEsCancelado = sol.estatus !== 'Cancelado'

            return matchFecha && noTieneAsiento && matchViaje && noEsCancelado
        })
    }, [allSolicitudes, selectedFecha, selectedViajeId])

    // Inicializar seleccionados automáticamente con las personas sin asiento
    useEffect(() => {
        if (initialSelectedSolicitudes && initialSelectedSolicitudes.length > 0) {
            setSelectedSolIds(initialSelectedSolicitudes.map(s => s.id_solicitud))
        } else {
            setSelectedSolIds(personasSinAsiento.map(s => s.id_solicitud))
        }
    }, [personasSinAsiento, initialSelectedSolicitudes])

    // Sugerencia automática de nuevo vehículo según cantidad
    useEffect(() => {
        if (reassignMode === 'crear_nuevo') {
            if (selectedSolIds.length > 4) {
                setNuevoTipo('Combi')
            } else {
                setNuevoTipo('Camioneta')
            }
        }
    }, [selectedSolIds.length, reassignMode])

    const trabajadoresSeleccionados = useMemo(() => {
        return personasSinAsiento.filter(s => selectedSolIds.includes(s.id_solicitud))
    }, [personasSinAsiento, selectedSolIds])

    // Toggle de selección
    const toggleSelectAll = () => {
        if (selectedSolIds.length === personasSinAsiento.length) {
            setSelectedSolIds([])
        } else {
            setSelectedSolIds(personasSinAsiento.map(s => s.id_solicitud))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedSolIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    // Datos del viaje existente seleccionado (si aplica)
    const targetViajeObj = useMemo(() => {
        return allViajes.find(v => v.id_viaje === targetExistingViajeId) || null
    }, [allViajes, targetExistingViajeId])

    const lugaresLibresEnExistente = useMemo(() => {
        if (!targetViajeObj) return 0
        return Math.max(0, targetViajeObj.capacidad_total - existingSeatsOccupied.length)
    }, [targetViajeObj, existingSeatsOccupied])

    // Vehículo destino final (nombre y datos)
    const vehiculoDestinoNombre = reassignMode === 'crear_nuevo' 
        ? `${nuevoTipo} (${nuevoTipo === 'Camioneta' ? '4' : '14'} lgs)`
        : (targetViajeObj ? `${targetViajeObj.tipo_vehiculo} (${targetViajeObj.nombre_ruta})` : 'Vehículo existente')

    const choferDestino = reassignMode === 'crear_nuevo'
        ? nuevoChofer
        : 'Chofer asignado'

    const horaDestino = reassignMode === 'crear_nuevo'
        ? nuevaHora
        : (targetViajeObj ? targetViajeObj.hora.substring(0, 5) : nuevaHora)

    // Plantilla de mensaje
    const defaultTemplate = 
`Estimado(a) {nombre}, de parte de Recursos Humanos BACIS te informamos que debido a que el autobús programado ({hora_autobus} hrs del {fecha}) se encuentra a su máxima capacidad, tu traslado a {destino} ha sido reprogramado en:

🚐 Unidad asignada: {tipo_vehiculo}
👤 Chofer a cargo: {chofer}
⏰ Hora de Salida: {hora_salida} hrs
📍 Punto de Abordaje: {punto}
📝 Indicaciones: {notas}

Por favor preséntate 15 minutos antes y responde a este mensaje para confirmar de enterado. ¡Buen viaje!`

    const [msgTemplate, setMsgTemplate] = useState(defaultTemplate)

    // Generar mensaje personalizado
    const generateMessage = (nombreTrabajador?: string) => {
        const horaOriginal = viajeActual ? viajeActual.hora.substring(0, 5) : 'programada'
        const rutaFinal = viajeActual ? viajeActual.nombre_ruta : nuevaRuta

        return msgTemplate
            .replace(/{nombre}/g, nombreTrabajador || 'Compañero(a)')
            .replace(/{fecha}/g, selectedFecha)
            .replace(/{hora_autobus}/g, horaOriginal)
            .replace(/{destino}/g, rutaFinal)
            .replace(/{tipo_vehiculo}/g, vehiculoDestinoNombre)
            .replace(/{chofer}/g, choferDestino)
            .replace(/{hora_salida}/g, horaDestino)
            .replace(/{punto}/g, nuevoPunto)
            .replace(/{notas}/g, nuevasNotas)
    }

    // Copiar mensaje global
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

    // Copiar teléfonos
    const handleCopyPhoneNumbers = async () => {
        const phones = trabajadoresSeleccionados
            .map(w => w.celular_whatsapp?.replace(/\D/g, ''))
            .filter(Boolean)

        if (phones.length === 0) return alert('No hay números de teléfono disponibles.')

        try {
            await navigator.clipboard.writeText(phones.join(', '))
            setCopiedPhones(true)
            setTimeout(() => setCopiedPhones(false), 2500)
        } catch (e) {
            console.error(e)
        }
    }

    // Enviar WhatsApp individual 1 a 1
    const handleSendIndividualWhatsApp = (sol: Solicitud) => {
        const rawPhone = sol.celular_whatsapp?.replace(/\D/g, '') || ''
        if (!rawPhone) return alert(`No hay número de teléfono para ${sol.nombre_completo}`)
        
        const fullPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone
        const message = generateMessage(sol.nombre_completo)
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank')
    }

    // Ejecutar reasignación en base de datos
    const handleReasignar = async () => {
        if (trabajadoresSeleccionados.length === 0) {
            return alert('Debes seleccionar al menos a una persona para reasignar.')
        }

        setSaving(true)
        try {
            // CASO A: Crear nuevo viaje de Camioneta o Combi aquí mismo
            if (reassignMode === 'crear_nuevo') {
                const capacidad = nuevoTipo === 'Camioneta' ? 4 : 14
                const neededUnits = Math.ceil(trabajadoresSeleccionados.length / capacidad)

                for (let unit = 1; unit <= neededUnits; unit++) {
                    const unitSuffix = neededUnits > 1 ? ` (Unidad ${unit})` : ''
                    const rutaFinal = `${nuevaRuta}${unitSuffix}`

                    // 1. Insertar el nuevo viaje
                    const { data: newTrip, error: tripErr } = await supabase
                        .from('transporte_personal_viajes')
                        .insert([{
                            tipo_vehiculo: nuevoTipo,
                            nombre_ruta: rutaFinal,
                            fecha: selectedFecha,
                            hora: nuevaHora,
                            capacidad_total: capacidad,
                            estado: 'Programado'
                        }])
                        .select()
                        .single()

                    if (tripErr || !newTrip) throw tripErr || new Error('No se pudo crear el viaje.')

                    // 2. Segmentar trabajadores para esta unidad
                    const startIdx = (unit - 1) * capacidad
                    const endIdx = startIdx + capacidad
                    const workersForUnit = trabajadoresSeleccionados.slice(startIdx, endIdx)

                    // 3. Asignar asientos y actualizar solicitudes
                    for (let i = 0; i < workersForUnit.length; i++) {
                        const w = workersForUnit[i]
                        const seatNum = i + 1

                        await supabase.from('transporte_personal_asientos').insert([{
                            id_viaje: newTrip.id_viaje,
                            numero_asiento: seatNum,
                            nombre_pasajero: w.nombre_completo,
                            departamento_pasajero: w.departamento
                        }])

                        await supabase.from('transporte_personal_solicitudes').update({
                            id_viaje: newTrip.id_viaje,
                            numero_asiento: seatNum,
                            tipo_vehiculo: nuevoTipo,
                            chofer_nombre: nuevoChofer,
                            estatus: 'Asignado'
                        }).eq('id_solicitud', w.id_solicitud)
                    }
                }

                alert(`✅ ¡Listo! Se creó el nuevo transporte en ${nuevoTipo} y se reasignaron los ${trabajadoresSeleccionados.length} trabajadores con sus nuevos asientos y pases oficiales.`)
            } 
            // CASO B: Reasignar a un viaje existente de ese mismo día
            else {
                if (!targetExistingViajeId || !targetViajeObj) {
                    throw new Error('Selecciona un viaje existente para reasignar.')
                }

                if (trabajadoresSeleccionados.length > lugaresLibresEnExistente) {
                    const proceed = confirm(`El viaje seleccionado tiene ${lugaresLibresEnExistente} asientos libres, pero intentas reasignar a ${trabajadoresSeleccionados.length} personas. ¿Deseas asignar los que quepan?`)
                    if (!proceed) {
                        setSaving(false)
                        return
                    }
                }

                // Obtener asientos libres disponibles
                const occupiedSet = new Set(existingSeatsOccupied)
                const freeSeats: number[] = []
                for (let num = 1; num <= targetViajeObj.capacidad_total; num++) {
                    if (!occupiedSet.has(num)) {
                        freeSeats.push(num)
                    }
                }

                const workersToAssign = trabajadoresSeleccionados.slice(0, freeSeats.length)

                for (let i = 0; i < workersToAssign.length; i++) {
                    const w = workersToAssign[i]
                    const seatNum = freeSeats[i]

                    await supabase.from('transporte_personal_asientos').insert([{
                        id_viaje: targetExistingViajeId,
                        numero_asiento: seatNum,
                        nombre_pasajero: w.nombre_completo,
                        departamento_pasajero: w.departamento
                    }])

                    await supabase.from('transporte_personal_solicitudes').update({
                        id_viaje: targetExistingViajeId,
                        numero_asiento: seatNum,
                        tipo_vehiculo: targetViajeObj.tipo_vehiculo,
                        estatus: 'Asignado'
                    }).eq('id_solicitud', w.id_solicitud)
                }

                alert(`✅ ¡Listo! Se reasignaron con éxito ${workersToAssign.length} trabajadores al viaje de ${targetViajeObj.tipo_vehiculo} (${targetViajeObj.nombre_ruta}).`)
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            console.error('Error al reasignar:', err)
            alert('Error al reasignar: ' + (err.message || 'Error desconocido'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
                {/* Header del Modal */}
                <div className="p-5 bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 text-white flex justify-between items-start border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                Gestión de Sobrecupo y Reasignación de Viajes
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Selecciona el viaje, filtra las personas sin asiento y reasígnalas a Camioneta o Combi.
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
                    {/* PASO 1: SELECCIONAR DÍA Y VIAJE */}
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">1</span>
                                Selecciona el Día y el Viaje Saturado
                            </span>
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                {personasSinAsiento.length} Persona(s) sin asiento detectadas
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Selector de Día */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                    Día del Viaje
                                </label>
                                <input
                                    type="date"
                                    value={selectedFecha}
                                    onChange={e => {
                                        setSelectedFecha(e.target.value)
                                        setSelectedViajeId('TODOS')
                                    }}
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                />
                            </div>

                            {/* Selector del Viaje de ese día */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                    <Bus className="w-3.5 h-3.5 text-zinc-400" />
                                    Viaje de Referencia
                                </label>
                                <select
                                    value={selectedViajeId}
                                    onChange={e => setSelectedViajeId(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                >
                                    <option value="TODOS">Ver todas las personas sin asiento de este día</option>
                                    {viajesDelDia.map(v => (
                                        <option key={v.id_viaje} value={v.id_viaje}>
                                            {v.tipo_vehiculo} — {v.nombre_ruta} ({v.hora.substring(0, 5)} hrs) [{v.capacidad_total} lgs]
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Estado del Viaje Seleccionado */}
                        {viajeActual && (
                            <div className="bg-white p-3 rounded-xl border border-zinc-200 flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-black uppercase text-[10px]">
                                        {viajeActual.tipo_vehiculo}
                                    </span>
                                    <span className="font-extrabold text-zinc-800">{viajeActual.nombre_ruta}</span>
                                    <span className="text-zinc-500">a las {viajeActual.hora.substring(0, 5)} hrs</span>
                                </div>
                                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                    Capacidad: {viajeActual.capacidad_total} lugares
                                </span>
                            </div>
                        )}
                    </div>

                    {/* PASO 2: PERSONAS SIN ASIENTO ASIGNADO */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">2</span>
                                Personas sin Asiento Asignado ({trabajadoresSeleccionados.length} de {personasSinAsiento.length} seleccionadas)
                            </span>
                            {personasSinAsiento.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    {selectedSolIds.length === personasSinAsiento.length ? (
                                        <>
                                            <Square className="w-3.5 h-3.5" /> Deseleccionar todos
                                        </>
                                    ) : (
                                        <>
                                            <CheckSquare className="w-3.5 h-3.5" /> Seleccionar todos ({personasSinAsiento.length})
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {personasSinAsiento.length > 0 ? (
                            <div className="border border-zinc-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-zinc-100 text-zinc-600 font-bold sticky top-0 border-b border-zinc-200">
                                        <tr>
                                            <th className="p-2.5 pl-3 w-8"></th>
                                            <th className="p-2.5">Trabajador / Pasajero</th>
                                            <th className="p-2.5">Departamento</th>
                                            <th className="p-2.5">Celular</th>
                                            <th className="p-2.5 text-right pr-3">WhatsApp 1 a 1</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {personasSinAsiento.map(sol => {
                                            const isSelected = selectedSolIds.includes(sol.id_solicitud)
                                            return (
                                                <tr key={sol.id_solicitud} className={`hover:bg-zinc-50 transition-colors ${isSelected ? 'bg-amber-50/50' : ''}`}>
                                                    <td className="p-2.5 pl-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(sol.id_solicitud)}
                                                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
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
                                                            title="Enviar aviso por WhatsApp personalizado"
                                                        >
                                                            <MessageSquare className="w-3 h-3 text-green-600" />
                                                            <span>WhatsApp</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <span>¡Excelente! No hay personas sin asiento asignado para la fecha <b>{selectedFecha}</b>.</span>
                            </div>
                        )}
                    </div>

                    {/* PASO 3: DESTINO DE REASIGNACIÓN (Crear aquí mismo O Elegir existente de ese día) */}
                    <div className="space-y-3">
                        <span className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">3</span>
                            ¿A qué vehículo se reasignan?
                        </span>

                        {/* Tabs de Modo: Crear Nuevo vs Usar Existente */}
                        <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => setReassignMode('crear_nuevo')}
                                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                    reassignMode === 'crear_nuevo'
                                        ? 'bg-white text-zinc-900 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                            >
                                <PlusCircle className="w-4 h-4 text-indigo-600" />
                                <span>Crear Nuevo Transporte Aquí Mismo</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setReassignMode('existente')}
                                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                    reassignMode === 'existente'
                                        ? 'bg-white text-zinc-900 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                            >
                                <Layers className="w-4 h-4 text-amber-600" />
                                <span>Reasignar a Viaje Existente de este Día ({viajesDisponiblesParaReasignar.length})</span>
                            </button>
                        </div>

                        {/* CONTENIDO MODO A: CREAR NUEVO VEHÍCULO */}
                        {reassignMode === 'crear_nuevo' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                                <div>
                                    <label className="text-[11px] font-bold text-zinc-500 uppercase">Vehículo a Crear</label>
                                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setNuevoTipo('Camioneta')}
                                            className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                                                nuevoTipo === 'Camioneta'
                                                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                            }`}
                                        >
                                            <Car className="w-3.5 h-3.5" />
                                            <span>Camioneta (4)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNuevoTipo('Combi')}
                                            className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                                                nuevoTipo === 'Combi'
                                                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                                                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                            }`}
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            <span>Combi (14)</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-zinc-500 uppercase">Chofer Asignado</label>
                                    <input
                                        type="text"
                                        value={nuevoChofer}
                                        onChange={e => setNuevoChofer(e.target.value)}
                                        placeholder="Ej. Nicolás Gómez"
                                        className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-zinc-500 uppercase">Hora de Salida</label>
                                    <input
                                        type="time"
                                        value={nuevaHora}
                                        onChange={e => setNuevaHora(e.target.value)}
                                        className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-zinc-500 uppercase">Ruta / Destino</label>
                                    <input
                                        type="text"
                                        value={nuevaRuta}
                                        onChange={e => setNuevaRuta(e.target.value)}
                                        className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold text-zinc-500 uppercase">Punto de Abordaje</label>
                                    <input
                                        type="text"
                                        value={nuevoPunto}
                                        onChange={e => setNuevoPunto(e.target.value)}
                                        className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold text-zinc-500 uppercase">Notas Especiales</label>
                                    <input
                                        type="text"
                                        value={nuevasNotas}
                                        onChange={e => setNuevasNotas(e.target.value)}
                                        className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                    />
                                </div>
                            </div>
                        )}

                        {/* CONTENIDO MODO B: ELEGIR VIAJE EXISTENTE DE ESE DÍA */}
                        {reassignMode === 'existente' && (
                            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-3">
                                {viajesDisponiblesParaReasignar.length > 0 ? (
                                    <>
                                        <div>
                                            <label className="text-[11px] font-bold text-zinc-500 uppercase">
                                                Selecciona el Viaje Destino del {selectedFecha}
                                            </label>
                                            <select
                                                value={targetExistingViajeId}
                                                onChange={e => setTargetExistingViajeId(e.target.value)}
                                                className="w-full mt-1 p-2.5 border border-zinc-300 rounded-xl text-xs font-bold bg-white"
                                            >
                                                {viajesDisponiblesParaReasignar.map(v => (
                                                    <option key={v.id_viaje} value={v.id_viaje}>
                                                        {v.tipo_vehiculo} — {v.nombre_ruta} ({v.hora.substring(0, 5)} hrs) [Capacidad: {v.capacidad_total}]
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {targetViajeObj && (
                                            <div className="bg-white p-3 rounded-xl border border-zinc-200 flex flex-wrap justify-between items-center text-xs gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-zinc-900">{targetViajeObj.tipo_vehiculo}</span>
                                                    <span className="text-zinc-500">Ruta: {targetViajeObj.nombre_ruta}</span>
                                                    <span className="text-zinc-500 font-mono">({targetViajeObj.hora.substring(0, 5)} hrs)</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-zinc-500">Ocupados: <b>{existingSeatsOccupied.length}</b> / {targetViajeObj.capacidad_total}</span>
                                                    <span className={`px-2.5 py-1 rounded-full font-mono font-black text-xs ${
                                                        lugaresLibresEnExistente > 0 ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {lugaresLibresEnExistente} Asientos Libres
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center p-6 text-xs text-zinc-500">
                                        <p className="font-bold">No hay otros viajes programados en la fecha {selectedFecha}.</p>
                                        <p className="text-zinc-400 mt-1">Puedes cambiar a la opción <b>"Crear Nuevo Transporte Aquí Mismo"</b> para programar la Camioneta o Combi en un clic.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PASO 4: MENSAJE PREDETERMINADO & ACCIONES DE DIFUSIÓN */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">4</span>
                                Mensaje Predeterminado (Global y Personalizable)
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyPhoneNumbers}
                                    className="text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all"
                                    title="Copiar teléfonos separados por comas para lista de difusión"
                                >
                                    {copiedPhones ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Phone className="w-3.5 h-3.5" />}
                                    <span>{copiedPhones ? 'Teléfonos Copiados' : 'Copiar Teléfonos'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyGlobalMessage}
                                    className="text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all"
                                    title="Copiar mensaje general para pegar en el grupo de WhatsApp"
                                >
                                    {copiedMsg ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedMsg ? '¡Copiado!' : 'Copiar Mensaje Global'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                                    Plantilla Editable
                                </label>
                                <textarea
                                    value={msgTemplate}
                                    onChange={e => setMsgTemplate(e.target.value)}
                                    rows={5}
                                    className="w-full p-3 border border-zinc-300 rounded-2xl text-xs font-mono bg-zinc-50 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                                    Vista Previa para {trabajadoresSeleccionados[0]?.nombre_completo || 'Trabajador'}
                                </label>
                                <div className="p-3 bg-amber-950/5 border border-amber-800/20 rounded-2xl text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed h-[115px] overflow-y-auto">
                                    {generateMessage(trabajadoresSeleccionados[0]?.nombre_completo)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer con Acciones */}
                <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="text-xs text-zinc-600 font-medium">
                        Reasignar <b>{trabajadoresSeleccionados.length}</b> persona(s) a <b>{vehiculoDestinoNombre}</b> el <b>{selectedFecha}</b>.
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
                            onClick={handleReasignar}
                            disabled={saving || trabajadoresSeleccionados.length === 0}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl text-xs shadow-md shadow-amber-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Reasignando...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Reasignar {trabajadoresSeleccionados.length} Persona(s)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
