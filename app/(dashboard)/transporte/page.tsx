'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    Bus, Plane, Car, Plus, Calendar, Clock, MapPin, Users, ArrowRight, 
    ExternalLink, Copy, Check, FileText, Send, User, Armchair, HelpCircle, Printer,
    Filter, Search, CheckSquare, Square, Trash2, XCircle, CheckCircle2, RotateCcw, X
} from 'lucide-react'
import Link from 'next/link'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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
    const [logoBase64, setLogoBase64] = useState<string | null>(null)
    
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
    const [numCamionetas, setNumCamionetas] = useState('1')

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

    // Modal Editar Viaje
    const [editingViaje, setEditingViaje] = useState<Viaje | null>(null)
    const [editTipo, setEditTipo] = useState('')
    const [editRuta, setEditRuta] = useState('')
    const [editFecha, setEditFecha] = useState('')
    const [editHora, setEditHora] = useState('')
    const [editCapacidad, setEditCapacidad] = useState('37')
    const [savingEdit, setSavingEdit] = useState(false)

    // Filtros de Solicitudes
    const filterFechaStart = viajesDateStart // re-use start date filter
    const filterFechaEnd = viajesDateEnd // re-use end date filter

    // Multi-selection states
    const [selectedViajeIds, setSelectedViajeIds] = useState<string[]>([])
    const [selectedSolicitudIds, setSelectedSolicitudIds] = useState<string[]>([])

    // Filter states for Viajes Programados
    const [viajesSearch, setViajesSearch] = useState('')
    const [viajesTipoFilter, setViajesTipoFilter] = useState('TODOS')
    const [viajesEstadoFilter, setViajesEstadoFilter] = useState('TODOS')
    const [viajesDateStart, setViajesDateStart] = useState('')
    const [viajesDateEnd, setViajesDateEnd] = useState('')

    // Filter states for Solicitudes de Personal
    const [solicitudesSearch, setSolicitudesSearch] = useState('')
    const [solicitudesTipoFilter, setSolicitudesTipoFilter] = useState('TODOS')
    const [solicitudesEstatusFilter, setSolicitudesEstatusFilter] = useState('TODOS')

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
        const fetchLogo = async () => {
            const { data } = await supabase.from('configuracion_empresa').select('logo_base64').single()
            if (data?.logo_base64) setLogoBase64(data.logo_base64)
        }
        await Promise.all([fetchViajes(), fetchSolicitudes(), fetchEmpleados(), fetchLogo()])
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
        
        if (tipo === 'Camioneta' && parseInt(numCamionetas) > 1) {
            const count = parseInt(numCamionetas)
            const toInsert = []
            for (let i = 1; i <= count; i++) {
                toInsert.push({
                    tipo_vehiculo: tipo,
                    nombre_ruta: `${ruta} (Camioneta ${i})`,
                    fecha,
                    hora,
                    capacidad_total: 4,
                    estado: 'Programado'
                })
            }
            const { error } = await supabase.from('transporte_personal_viajes').insert(toInsert)
            if (error) {
                console.error(error)
                alert('Error al crear los viajes de camionetas.')
                return
            }
        } else {
            const { error } = await supabase.from('transporte_personal_viajes').insert([{
                tipo_vehiculo: tipo,
                nombre_ruta: ruta,
                fecha,
                hora,
                capacidad_total: parseInt(capacidad),
                estado: 'Programado'
            }])
            if (error) {
                console.error(error)
                alert('Error al crear el viaje.')
                return
            }
        }

        setShowForm(false)
        setRuta('')
        setFecha('')
        setHora('')
        setNumCamionetas('1')
        fetchViajes()
    }

    const handleCancelViaje = async (id_viaje: string) => {
        if (!confirm('¿Seguro que deseas cancelar este viaje? Se marcará como Cancelado.')) return

        const { error } = await supabase
            .from('transporte_personal_viajes')
            .update({ estado: 'Cancelado' })
            .eq('id_viaje', id_viaje)

        if (error) {
            console.error(error)
            alert('Error al cancelar el viaje.')
        } else {
            alert('Viaje marcado como Cancelado exitosamente.')
            fetchViajes()
        }
    }

    // Single delete Viaje
    const handleDeleteViaje = async (id_viaje: string) => {
        if (!confirm('¿Estás seguro de que deseas ELIMINAR permanentemente este viaje? Esta acción no se puede deshacer.')) return

        try {
            await supabase.from('transporte_personal_asientos').delete().eq('id_viaje', id_viaje)
            await supabase.from('transporte_personal_solicitudes').update({ id_viaje: null, estatus: 'Pendiente' }).eq('id_viaje', id_viaje)

            const { error } = await supabase
                .from('transporte_personal_viajes')
                .delete()
                .eq('id_viaje', id_viaje)

            if (error) throw error

            alert('Viaje eliminado con éxito.')
            setSelectedViajeIds(prev => prev.filter(id => id !== id_viaje))
            fetchViajes()
        } catch (error: any) {
            console.error(error)
            alert('Error al eliminar el viaje: ' + error.message)
        }
    }

    // Bulk cancel Viajes
    const handleBulkCancelViajes = async () => {
        if (selectedViajeIds.length === 0) return
        if (!confirm(`¿Estás seguro de marcar como CANCELADOS los ${selectedViajeIds.length} viaje(s) seleccionado(s)?`)) return

        const { error } = await supabase
            .from('transporte_personal_viajes')
            .update({ estado: 'Cancelado' })
            .in('id_viaje', selectedViajeIds)

        if (error) {
            console.error(error)
            alert('Error al cancelar los viajes seleccionados.')
        } else {
            alert(`${selectedViajeIds.length} viaje(s) marcado(s) como Cancelado(s) con éxito.`)
            setSelectedViajeIds([])
            fetchViajes()
        }
    }

    // Bulk delete Viajes
    const handleBulkDeleteViajes = async () => {
        if (selectedViajeIds.length === 0) return
        if (!confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE los ${selectedViajeIds.length} viaje(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return

        try {
            await supabase.from('transporte_personal_asientos').delete().in('id_viaje', selectedViajeIds)
            await supabase.from('transporte_personal_solicitudes').update({ id_viaje: null, estatus: 'Pendiente' }).in('id_viaje', selectedViajeIds)

            const { error } = await supabase
                .from('transporte_personal_viajes')
                .delete()
                .in('id_viaje', selectedViajeIds)

            if (error) throw error

            alert(`${selectedViajeIds.length} viaje(s) eliminado(s) permanentemente.`)
            setSelectedViajeIds([])
            fetchViajes()
        } catch (error: any) {
            console.error(error)
            alert('Error al eliminar los viajes seleccionados: ' + error.message)
        }
    }

    // Single delete Solicitud
    const handleDeleteSolicitud = async (id_solicitud: string) => {
        if (!confirm('¿Estás seguro de ELIMINAR permanentemente esta solicitud?')) return

        const { error } = await supabase
            .from('transporte_personal_solicitudes')
            .delete()
            .eq('id_solicitud', id_solicitud)

        if (error) {
            console.error(error)
            alert('Error al eliminar la solicitud.')
        } else {
            alert('Solicitud eliminada.')
            setSelectedSolicitudIds(prev => prev.filter(id => id !== id_solicitud))
            fetchSolicitudes()
        }
    }

    // Bulk cancel Solicitudes
    const handleBulkCancelSolicitudes = async () => {
        if (selectedSolicitudIds.length === 0) return
        if (!confirm(`¿Estás seguro de cancelar las ${selectedSolicitudIds.length} solicitud(es) seleccionada(s)?`)) return

        const { error } = await supabase
            .from('transporte_personal_solicitudes')
            .update({ estatus: 'Cancelado' })
            .in('id_solicitud', selectedSolicitudIds)

        if (error) {
            console.error(error)
            alert('Error al cancelar las solicitudes seleccionadas.')
        } else {
            alert(`${selectedSolicitudIds.length} solicitud(es) cancelada(s) con éxito.`)
            setSelectedSolicitudIds([])
            fetchSolicitudes()
        }
    }

    // Bulk delete Solicitudes
    const handleBulkDeleteSolicitudes = async () => {
        if (selectedSolicitudIds.length === 0) return
        if (!confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE las ${selectedSolicitudIds.length} solicitud(es) seleccionada(s)? Esta acción no se puede deshacer.`)) return

        const { error } = await supabase
            .from('transporte_personal_solicitudes')
            .delete()
            .in('id_solicitud', selectedSolicitudIds)

        if (error) {
            console.error(error)
            alert('Error al eliminar las solicitudes seleccionadas.')
        } else {
            alert(`${selectedSolicitudIds.length} solicitud(es) eliminada(s) con éxito.`)
            setSelectedSolicitudIds([])
            fetchSolicitudes()
        }
    }

    const handleOpenEditModal = (v: Viaje) => {
        setEditingViaje(v)
        setEditTipo(v.tipo_vehiculo)
        setEditRuta(v.nombre_ruta)
        setEditFecha(v.fecha)
        setEditHora(v.hora.substring(0, 5))
        setEditCapacidad(v.capacidad_total.toString())
    }

    const handleConfirmEdit = async () => {
        if (!editingViaje || !editRuta || !editFecha || !editHora || !editCapacidad) return alert('Llena todos los campos')
        setSavingEdit(true)

        const { error } = await supabase
            .from('transporte_personal_viajes')
            .update({
                tipo_vehiculo: editTipo,
                nombre_ruta: editRuta,
                fecha: editFecha,
                hora: editHora,
                capacidad_total: parseInt(editCapacidad)
            })
            .eq('id_viaje', editingViaje.id_viaje)

        if (error) {
            console.error(error)
            alert('Error al modificar el viaje.')
        } else {
            setEditingViaje(null)
            fetchViajes()
        }
        setSavingEdit(false)
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
        const vehChar = sol.tipo_vehiculo === 'Autobús' ? 'C' : sol.tipo_vehiculo === 'Combi' ? 'M' : sol.tipo_vehiculo === 'Alterna' ? 'A' : 'V'
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

    const handleSendWhatsAppWarning = (sol: Solicitud) => {
        const text = `Hola *${sol.nombre_completo}*, hemos registrado tu aviso de viaje por cuenta propia para el día *${new Date(sol.fecha_sugerida + 'T12:00:00').toLocaleDateString()}*.

⚠️ *Aviso de Prevención:* 
Te recordamos amablemente que por tu seguridad, los únicos vehículos autorizados y monitoreados por la compañía son los de nuestra flotilla oficial. Te invitamos a tomar precauciones si viajas por otros medios. 

¡Excelente viaje y cuídate mucho! 👋`

        const waUrl = `https://api.whatsapp.com/send?phone=52${sol.celular_whatsapp}&text=${encodeURIComponent(text)}`
        window.open(waUrl, '_blank')
    }

    const exportPassengerList = (viaje: Viaje) => {
        const doc = new jsPDF()
        
        if (logoBase64) {
            try {
                const imgFormat = logoBase64.substring(logoBase64.indexOf('/') + 1, logoBase64.indexOf(';')).toUpperCase();
                doc.addImage(logoBase64, imgFormat === 'JPEG' ? 'JPEG' : imgFormat === 'PNG' ? 'PNG' : 'JPEG', 14, 10, 40, 20)
            } catch (e) {
                console.warn('Could not add logo to PDF', e)
            }
        }
        
        doc.setFontSize(16)
        doc.text(`Manifiesto / Lista de Pasajeros - ${viaje.nombre_ruta}`, 14, 40)
        
        const passengers = solicitudes.filter(s => s.id_viaje === viaje.id_viaje && s.estatus === 'Asignado')
        const tableData = passengers.map(p => [
            p.numero_asiento?.toString() || 'S/A',
            p.nombre_completo,
            p.departamento
        ])

        autoTable(doc, {
            startY: 50,
            head: [['Asiento', 'Nombre', 'Departamento']],
            body: tableData,
        })

        const finalY = (doc as any).lastAutoTable.finalY || 50
        doc.text("Firma del Chofer: _________________________", 14, finalY + 30)

        doc.save(`Manifiesto_${viaje.nombre_ruta.replace(/\s+/g, '_')}_${viaje.fecha}.pdf`)
    }

    // Render seats in admin assignment modal (Bus / Plane / Van layouts)
    const renderSeatGrid = (capacity: number, vehicleType: string) => {
        const seats = Array.from({ length: capacity }, (_, i) => i + 1)
        
        if (vehicleType === 'Autobús') {
            return (
                <div className="bg-zinc-150 bg-zinc-100 p-3.5 rounded-2xl border border-zinc-200 max-w-[270px] mx-auto max-h-[190px] overflow-y-auto shadow-inner space-y-2">
                    <div className="text-[9px] font-black text-zinc-400 uppercase text-center border-b pb-1">Frente del Autobús</div>
                    <div className="grid grid-cols-4 gap-2">
                        {seats.map(num => {
                            const isOccupied = occupiedSeats.includes(num)
                            const isSelected = assignSeat === num
                            const isAisleLeft = num % 4 === 2 && num !== capacity
                            return (
                                <button
                                    key={num}
                                    type="button"
                                    disabled={isOccupied}
                                    onClick={() => setAssignSeat(num)}
                                    className={`p-1 rounded-lg text-[9px] font-black border transition-all text-center flex flex-col items-center justify-center aspect-square
                                        ${isAisleLeft ? 'mr-3' : ''}
                                        ${isOccupied 
                                            ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed'
                                            : (isSelected
                                                ? 'bg-cyan-500 border-cyan-600 text-white shadow-md'
                                                : 'bg-white border-zinc-200 text-zinc-550 hover:border-zinc-450')}`}
                                >
                                    <Armchair className="w-3.5 h-3.5 mb-0.5" />
                                    {num}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )
        }
        
        if (vehicleType === 'Avioneta') {
            const numRows = Math.ceil(capacity / 2)
            const rows = Array.from({ length: numRows }, (_, i) => i)
            return (
                <div className="bg-zinc-100 p-3.5 rounded-2xl border border-zinc-200 max-w-[230px] mx-auto max-h-[190px] overflow-y-auto shadow-inner space-y-2">
                    <div className="text-[9px] font-black text-zinc-400 uppercase text-center border-b pb-1">Cabina Pilotos</div>
                    <div className="space-y-1.5 mt-2">
                        {rows.map(r => {
                            const seatL = r * 2 + 1
                            const seatR = r * 2 + 2
                            return (
                                <div key={r} className="grid grid-cols-3 gap-2 items-center">
                                    {/* Asiento Izquierdo */}
                                    {seatL <= capacity && (() => {
                                        const isOccupied = occupiedSeats.includes(seatL)
                                        const isSelected = assignSeat === seatL
                                        return (
                                            <button
                                                type="button"
                                                disabled={isOccupied}
                                                onClick={() => setAssignSeat(seatL)}
                                                className={`p-1 rounded-lg text-[9px] font-black border transition-all text-center flex flex-col items-center justify-center aspect-square
                                                    ${isOccupied 
                                                        ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed'
                                                        : (isSelected
                                                            ? 'bg-cyan-500 border-cyan-600 text-white shadow-md'
                                                            : 'bg-white border-zinc-200 text-zinc-550 hover:border-zinc-450')}`}
                                            >
                                                <Armchair className="w-3.5 h-3.5 mb-0.5" />
                                                {seatL}
                                            </button>
                                        )
                                    })()}
                                    
                                    {/* Pasillo */}
                                    <div className="text-[8px] font-black text-zinc-300 text-center tracking-wider">P</div>

                                    {/* Asiento Derecho */}
                                    {seatR <= capacity && (() => {
                                        const isOccupied = occupiedSeats.includes(seatR)
                                        const isSelected = assignSeat === seatR
                                        return (
                                            <button
                                                type="button"
                                                disabled={isOccupied}
                                                onClick={() => setAssignSeat(seatR)}
                                                className={`p-1 rounded-lg text-[9px] font-black border transition-all text-center flex flex-col items-center justify-center aspect-square
                                                    ${isOccupied 
                                                        ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed'
                                                        : (isSelected
                                                            ? 'bg-cyan-500 border-cyan-600 text-white shadow-md'
                                                            : 'bg-white border-zinc-200 text-zinc-550 hover:border-zinc-450')}`}
                                            >
                                                <Armchair className="w-3.5 h-3.5 mb-0.5" />
                                                {seatR}
                                            </button>
                                        )
                                    })()}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )
        }

        if (vehicleType === 'Combi') {
            return (
                <div className="bg-zinc-100 p-3.5 rounded-2xl border border-zinc-200 max-w-[260px] mx-auto shadow-inner space-y-2">
                    <div className="text-[9px] font-black text-zinc-400 uppercase text-center border-b pb-1">Frente de la Combi</div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        {seats.map(num => {
                            const isOccupied = occupiedSeats.includes(num)
                            const isSelected = assignSeat === num
                            return (
                                <button
                                    key={num}
                                    type="button"
                                    disabled={isOccupied}
                                    onClick={() => setAssignSeat(num)}
                                    className={`p-1.5 rounded-lg text-[9px] font-black border transition-all text-center flex flex-col items-center justify-center aspect-square
                                        ${isOccupied 
                                            ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed'
                                            : (isSelected
                                                ? 'bg-cyan-500 border-cyan-600 text-white shadow-md'
                                                : 'bg-white border-zinc-200 text-zinc-550 hover:border-zinc-450')}`}
                                >
                                    <Armchair className="w-3.5 h-3.5 mb-0.5" />
                                    {num}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )
        }

        // Camioneta/Van
        return (
            <div className="bg-zinc-100 p-3.5 rounded-2xl border border-zinc-200 max-w-[200px] mx-auto shadow-inner space-y-2">
                <div className="text-[9px] font-black text-zinc-400 uppercase text-center border-b pb-1">Frente</div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    {seats.map(num => {
                        const isOccupied = occupiedSeats.includes(num)
                        const isSelected = assignSeat === num
                        return (
                            <button
                                key={num}
                                type="button"
                                disabled={isOccupied}
                                onClick={() => setAssignSeat(num)}
                                className={`p-1.5 rounded-lg text-[9px] font-black border transition-all text-center flex flex-col items-center justify-center aspect-square
                                    ${isOccupied 
                                        ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed'
                                        : (isSelected
                                            ? 'bg-cyan-500 border-cyan-600 text-white shadow-md'
                                            : 'bg-white border-zinc-200 text-zinc-550 hover:border-zinc-450')}`}
                            >
                                <Armchair className="w-3.5 h-3.5 mb-0.5" />
                                {num}
                            </button>
                        )
                    })}
                </div>
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
                                if(e.target.value === 'Combi') setCapacidad('20')
                                if(e.target.value === 'Alterna') setCapacidad('8')
                            }} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 font-bold">
                                <option value="Autobús">Autobús (37 lgs)</option>
                                <option value="Combi">Combi (20 lgs)</option>
                                <option value="Avioneta">Avioneta (8 lgs)</option>
                                <option value="Camioneta">Camioneta (4 lgs)</option>
                                <option value="Alterna">Alterna (Contratistas / Particular)</option>
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
                        {tipo === 'Camioneta' && (
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase">Cantidad de Camionetas</label>
                                <select 
                                    value={numCamionetas} 
                                    onChange={e => setNumCamionetas(e.target.value)} 
                                    className="w-full mt-1 p-3 border border-amber-300 rounded-lg text-sm bg-amber-50 font-bold text-amber-900"
                                >
                                    <option value="1">1 Camioneta (4 lugares)</option>
                                    <option value="2">2 Camionetas (2 listas de 4 lgs)</option>
                                    <option value="3">3 Camionetas (3 listas de 4 lgs)</option>
                                    <option value="4">4 Camionetas (4 listas de 4 lgs)</option>
                                </select>
                            </div>
                        )}
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
                    {adminTab === 'viajes' && (() => {
                        const filteredViajes = viajes.filter(v => {
                            const searchMatch = !viajesSearch || v.nombre_ruta.toLowerCase().includes(viajesSearch.toLowerCase()) || v.tipo_vehiculo.toLowerCase().includes(viajesSearch.toLowerCase())
                            const tipoMatch = viajesTipoFilter === 'TODOS' || v.tipo_vehiculo === viajesTipoFilter
                            const estadoMatch = viajesEstadoFilter === 'TODOS' || v.estado === viajesEstadoFilter
                            const startMatch = !viajesDateStart || v.fecha >= viajesDateStart
                            const endMatch = !viajesDateEnd || v.fecha <= viajesDateEnd
                            return searchMatch && tipoMatch && estadoMatch && startMatch && endMatch
                        })

                        const allSelected = filteredViajes.length > 0 && filteredViajes.every(v => selectedViajeIds.includes(v.id_viaje))

                        return (
                            <div className="space-y-4">
                                {/* BARRA DE FILTROS VIAJES */}
                                <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-xs font-black text-zinc-800 uppercase tracking-wide">
                                            <Filter className="w-4 h-4 text-indigo-500" />
                                            <span>Filtros y Agrupación de Viajes</span>
                                        </div>

                                        {(viajesSearch || viajesTipoFilter !== 'TODOS' || viajesEstadoFilter !== 'TODOS' || viajesDateStart || viajesDateEnd) && (
                                            <button 
                                                onClick={() => {
                                                    setViajesSearch('')
                                                    setViajesTipoFilter('TODOS')
                                                    setViajesEstadoFilter('TODOS')
                                                    setViajesDateStart('')
                                                    setViajesDateEnd('')
                                                }}
                                                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                            >
                                                <X className="w-3.5 h-3.5" /> Limpiar Filtros
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {/* Búsqueda libre */}
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por ruta o destino..."
                                                value={viajesSearch}
                                                onChange={e => setViajesSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Filtro por Vehículo */}
                                        <div>
                                            <select
                                                value={viajesTipoFilter}
                                                onChange={e => setViajesTipoFilter(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white"
                                            >
                                                <option value="TODOS">🚌 Todos los Vehículos</option>
                                                <option value="Autobús">Autobús</option>
                                                <option value="Combi">Combi</option>
                                                <option value="Avioneta">Avioneta</option>
                                                <option value="Camioneta">Camioneta</option>
                                                <option value="Alterna">Alterna</option>
                                            </select>
                                        </div>

                                        {/* Filtro por Estado */}
                                        <div>
                                            <select
                                                value={viajesEstadoFilter}
                                                onChange={e => setViajesEstadoFilter(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white"
                                            >
                                                <option value="TODOS">📌 Todos los Estados</option>
                                                <option value="Programado">Programado</option>
                                                <option value="Cancelado">Cancelado</option>
                                            </select>
                                        </div>

                                        {/* Rango de Fechas */}
                                        <div>
                                            <input
                                                type="date"
                                                value={viajesDateStart}
                                                onChange={e => setViajesDateStart(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                                                title="Fecha Desde"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="date"
                                                value={viajesDateEnd}
                                                onChange={e => setViajesDateEnd(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                                                title="Fecha Hasta"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ACCIONES EN LOTE / SELECCIÓN MÚLTIPLE VIAJES */}
                                <div className="bg-zinc-900 text-white p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                if (allSelected) {
                                                    setSelectedViajeIds([])
                                                } else {
                                                    setSelectedViajeIds(filteredViajes.map(v => v.id_viaje))
                                                }
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-black rounded-xl border border-zinc-700 transition-all"
                                        >
                                            {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-zinc-400" />}
                                            <span>{allSelected ? 'Desmarcar Todos' : 'Seleccionar Todos'} ({filteredViajes.length})</span>
                                        </button>

                                        {selectedViajeIds.length > 0 && (
                                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                                {selectedViajeIds.length} viaje(s) seleccionado(s)
                                            </span>
                                        )}
                                    </div>

                                    {selectedViajeIds.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleBulkCancelViajes}
                                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all transform hover:scale-105"
                                                title="Marcar viajes seleccionados como Cancelados"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                <span>Cancelar ({selectedViajeIds.length})</span>
                                            </button>
                                            <button
                                                onClick={handleBulkDeleteViajes}
                                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all transform hover:scale-105"
                                                title="Eliminar viajes seleccionados permanentemente"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span>Eliminar ({selectedViajeIds.length})</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* LISTADO GRID DE VIAJES */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredViajes.map(v => {
                                        const isChecked = selectedViajeIds.includes(v.id_viaje)
                                        return (
                                            <div 
                                                key={v.id_viaje} 
                                                className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col group relative ${
                                                    isChecked ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-md' : 'border-zinc-200 hover:shadow-md'
                                                }`}
                                            >
                                                {/* Checkbox de selección */}
                                                <div className="absolute top-3 left-3 z-10">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isChecked) {
                                                                setSelectedViajeIds(selectedViajeIds.filter(id => id !== v.id_viaje))
                                                            } else {
                                                                setSelectedViajeIds([...selectedViajeIds, v.id_viaje])
                                                            }
                                                        }}
                                                        className="p-1 rounded-lg bg-white/90 shadow-sm border border-zinc-200 hover:bg-zinc-100 transition-all"
                                                    >
                                                        {isChecked ? (
                                                            <CheckSquare className="w-5 h-5 text-amber-500" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-zinc-400" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="p-5 pl-12 flex-1">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2 rounded-lg ${
                                                                v.tipo_vehiculo === 'Autobús' ? 'bg-indigo-100 text-indigo-600' :
                                                                v.tipo_vehiculo === 'Combi' ? 'bg-purple-100 text-purple-600' :
                                                                v.tipo_vehiculo === 'Avioneta' ? 'bg-sky-100 text-sky-600' :
                                                                v.tipo_vehiculo === 'Alterna' ? 'bg-teal-100 text-teal-600' :
                                                                'bg-emerald-100 text-emerald-600'
                                                            }`}>
                                                                {v.tipo_vehiculo === 'Autobús' && <Bus className="w-5 h-5" />}
                                                                {v.tipo_vehiculo === 'Combi' && <Car className="w-5 h-5" />}
                                                                {v.tipo_vehiculo === 'Avioneta' && <Plane className="w-5 h-5" />}
                                                                {v.tipo_vehiculo === 'Camioneta' && <Car className="w-5 h-5" />}
                                                                {v.tipo_vehiculo === 'Alterna' && <Users className="w-5 h-5" />}
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">{v.tipo_vehiculo}</div>
                                                                <div className="font-bold text-zinc-900 leading-tight">{v.capacidad_total} Pasajeros</div>
                                                            </div>
                                                        </div>
                                                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                                            v.estado === 'Cancelado' ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-700'
                                                        }`}>
                                                            {v.estado}
                                                        </span>
                                                    </div>
                                                    
                                                    <h3 className="text-xl font-black text-zinc-800 mb-4">{v.nombre_ruta}</h3>
                                                    
                                                    <div className="space-y-2 text-sm text-zinc-600">
                                                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-zinc-400" /> {new Date(v.fecha + 'T12:00:00').toLocaleDateString()}</div>
                                                        <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> {v.hora.substring(0,5)} Hrs</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex gap-2 flex-wrap">
                                                    <Link href={`/transporte/${v.id_viaje}`} className="flex-1 min-w-[100px] bg-white border border-zinc-200 hover:border-indigo-305 hover:text-indigo-700 text-zinc-800 font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition-all shadow-sm text-xs">
                                                        Ver Asientos
                                                    </Link>
                                                    <button 
                                                        onClick={() => handleOpenEditModal(v)}
                                                        className="bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold px-3 py-2 rounded-xl text-xs transition-all"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button 
                                                        onClick={() => exportPassengerList(v)}
                                                        className="bg-white border border-zinc-200 text-indigo-600 hover:bg-indigo-50 font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1 transition-all text-xs"
                                                        title="Descargar Lista (PDF)"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" /> PDF
                                                    </button>
                                                    {v.estado !== 'Cancelado' && (
                                                        <button 
                                                            onClick={() => handleCancelViaje(v.id_viaje)}
                                                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-3 py-2 rounded-xl text-xs transition-all"
                                                            title="Marcar como Cancelado"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleDeleteViaje(v.id_viaje)}
                                                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1"
                                                        title="Eliminar viaje definitivamente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {filteredViajes.length === 0 && (
                                        <div className="col-span-full p-12 text-center text-zinc-400 font-bold border-2 border-dashed border-zinc-200 rounded-2xl">
                                            No hay viajes que coincidan con los filtros seleccionados.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    {/* TAB SOLICITUDES */}
                    {adminTab === 'solicitudes' && (() => {
                        const filteredSolicitudes = solicitudes.filter(sol => {
                            const searchText = `${sol.nombre_completo || ''} ${sol.departamento || ''} ${sol.clave_confirmacion || ''} ${sol.celular_whatsapp || ''}`.toLowerCase()
                            const searchMatch = !solicitudesSearch || searchText.includes(solicitudesSearch.toLowerCase())
                            const tipoMatch = solicitudesTipoFilter === 'TODOS' || sol.tipo_vehiculo === solicitudesTipoFilter
                            const estatusMatch = solicitudesEstatusFilter === 'TODOS' || sol.estatus === solicitudesEstatusFilter
                            const startMatch = !viajesDateStart || sol.fecha_sugerida >= viajesDateStart
                            const endMatch = !viajesDateEnd || sol.fecha_sugerida <= viajesDateEnd
                            return searchMatch && tipoMatch && estatusMatch && startMatch && endMatch
                        })

                        const allSelectedSols = filteredSolicitudes.length > 0 && filteredSolicitudes.every(s => selectedSolicitudIds.includes(s.id_solicitud))

                        return (
                            <div className="space-y-4">
                                {/* BARRA DE FILTROS SOLICITUDES */}
                                <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-xs font-black text-zinc-800 uppercase tracking-wide">
                                            <Filter className="w-4 h-4 text-indigo-500" />
                                            <span>Filtros y Agrupación de Solicitudes</span>
                                        </div>

                                        {(solicitudesSearch || solicitudesTipoFilter !== 'TODOS' || solicitudesEstatusFilter !== 'TODOS' || viajesDateStart || viajesDateEnd) && (
                                            <button 
                                                onClick={() => {
                                                    setSolicitudesSearch('')
                                                    setSolicitudesTipoFilter('TODOS')
                                                    setSolicitudesEstatusFilter('TODOS')
                                                    setViajesDateStart('')
                                                    setViajesDateEnd('')
                                                }}
                                                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                            >
                                                <X className="w-3.5 h-3.5" /> Limpiar Filtros
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {/* Búsqueda por pasajero / depto */}
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por pasajero o departamento..."
                                                value={solicitudesSearch}
                                                onChange={e => setSolicitudesSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Filtro por Vehículo */}
                                        <div>
                                            <select
                                                value={solicitudesTipoFilter}
                                                onChange={e => setSolicitudesTipoFilter(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white"
                                            >
                                                <option value="TODOS">🚌 Todos los Vehículos</option>
                                                <option value="Autobús">Autobús</option>
                                                <option value="Combi">Combi</option>
                                                <option value="Avioneta">Avioneta</option>
                                                <option value="Camioneta">Camioneta</option>
                                                <option value="Alterna">Alterna</option>
                                            </select>
                                        </div>

                                        {/* Filtro por Estatus */}
                                        <div>
                                            <select
                                                value={solicitudesEstatusFilter}
                                                onChange={e => setSolicitudesEstatusFilter(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white"
                                            >
                                                <option value="TODOS">📌 Todos los Estatus</option>
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="Asignado">Asignado</option>
                                                <option value="Por cuenta propia">Por cuenta propia</option>
                                                <option value="Cancelado">Cancelado</option>
                                            </select>
                                        </div>

                                        {/* Rango de Fechas */}
                                        <div>
                                            <input
                                                type="date"
                                                value={viajesDateStart}
                                                onChange={e => setViajesDateStart(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                                                title="Fecha Viaje Desde"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="date"
                                                value={viajesDateEnd}
                                                onChange={e => setViajesDateEnd(e.target.value)}
                                                className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                                                title="Fecha Viaje Hasta"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ACCIONES EN LOTE SOLICITUDES */}
                                {selectedSolicitudIds.length > 0 && (
                                    <div className="bg-zinc-900 text-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-in fade-in">
                                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                            {selectedSolicitudIds.length} solicitud(es) seleccionada(s)
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleBulkCancelSolicitudes}
                                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all transform hover:scale-105"
                                                title="Marcar solicitudes seleccionadas como Canceladas"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                <span>Cancelar ({selectedSolicitudIds.length})</span>
                                            </button>
                                            <button
                                                onClick={handleBulkDeleteSolicitudes}
                                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all transform hover:scale-105"
                                                title="Eliminar solicitudes seleccionadas permanentemente"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span>Eliminar ({selectedSolicitudIds.length})</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm text-zinc-600">
                                            <thead className="bg-zinc-50 text-[10px] text-zinc-500 uppercase font-black border-b border-zinc-200">
                                                <tr>
                                                    <th className="p-4 w-10">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (allSelectedSols) {
                                                                    setSelectedSolicitudIds([])
                                                                } else {
                                                                    setSelectedSolicitudIds(filteredSolicitudes.map(s => s.id_solicitud))
                                                                }
                                                            }}
                                                            className="p-1 rounded bg-white border border-zinc-300 hover:bg-zinc-100"
                                                        >
                                                            {allSelectedSols ? (
                                                                <CheckSquare className="w-4 h-4 text-amber-500" />
                                                            ) : (
                                                                <Square className="w-4 h-4 text-zinc-400" />
                                                            )}
                                                        </button>
                                                    </th>
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
                                            <tbody className="divide-y divide-zinc-100">
                                                {filteredSolicitudes.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="p-8 text-center text-zinc-400 font-bold">
                                                            No se encontraron solicitudes para los filtros seleccionados.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredSolicitudes.map(sol => {
                                                        const isChecked = selectedSolicitudIds.includes(sol.id_solicitud)
                                                        return (
                                                            <tr key={sol.id_solicitud} className={`hover:bg-zinc-50/50 transition-colors ${isChecked ? 'bg-amber-50/40' : ''}`}>
                                                                <td className="p-4">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (isChecked) {
                                                                                setSelectedSolicitudIds(selectedSolicitudIds.filter(id => id !== sol.id_solicitud))
                                                                            } else {
                                                                                setSelectedSolicitudIds([...selectedSolicitudIds, sol.id_solicitud])
                                                                            }
                                                                        }}
                                                                        className="p-1 rounded hover:bg-zinc-100"
                                                                    >
                                                                        {isChecked ? (
                                                                            <CheckSquare className="w-4 h-4 text-amber-500" />
                                                                        ) : (
                                                                            <Square className="w-4 h-4 text-zinc-400" />
                                                                        )}
                                                                    </button>
                                                                </td>
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
                                                                        ${sol.tipo_vehiculo === 'Autobús' ? 'bg-sky-100 text-sky-700' : sol.tipo_vehiculo === 'Alterna' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
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
                                                                          sol.estatus === 'Cancelado' ? 'bg-rose-100 text-rose-700 font-bold' :
                                                                          'bg-red-100 text-red-700'}`}>
                                                                        {sol.estatus}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {sol.estatus === 'Por cuenta propia' ? (
                                                                            <button
                                                                                onClick={() => handleSendWhatsAppWarning(sol)}
                                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-2 text-xs w-full sm:w-auto"
                                                                                title="Enviar aviso de prevención por WhatsApp"
                                                                            >
                                                                                <Send className="w-3.5 h-3.5" />
                                                                                Aviso WhatsApp
                                                                            </button>
                                                                        ) : sol.estatus === 'Pendiente' ? (
                                                                            <button
                                                                                onClick={() => handleOpenAssignModal(sol)}
                                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-sm"
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
                                                                        <button
                                                                            onClick={() => handleDeleteSolicitud(sol.id_solicitud)}
                                                                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                            title="Eliminar solicitud"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
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

                        {/* Step 1: Select programmed Trip */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase">1. Seleccionar Ruta Programada</label>
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

                        {/* Step 2: Choose seat */}
                        {assignTripId && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase">2. Selecciona el Asiento libre</label>
                                {(() => {
                                    const vDetails = viajes.find(v => v.id_viaje === assignTripId)
                                    return vDetails ? renderSeatGrid(vDetails.capacidad_total, vDetails.tipo_vehiculo) : null
                                })()}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            {/* Driver Name */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-zinc-500 uppercase">3. Nombre Chofer</label>
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
                                <label className="text-[10px] font-black text-zinc-500 uppercase">4. Clave de Confirmación</label>
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
            {/* Editar Viaje Modal */}
            {editingViaje && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-150 space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-3 mb-2">
                            <h3 className="text-lg font-black text-zinc-950 flex items-center gap-2">
                                <Bus className="w-5 h-5 text-indigo-500" />
                                Modificar Viaje Programado
                            </h3>
                            <button onClick={() => setEditingViaje(null)} className="text-zinc-400 hover:text-black font-black text-xl px-1">&times;</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase">Vehículo</label>
                                <select 
                                    value={editTipo} 
                                    onChange={e => {
                                        setEditTipo(e.target.value)
                                        if(e.target.value === 'Autobús') setEditCapacidad('37')
                                        if(e.target.value === 'Combi') setEditCapacidad('14')
                                        if(e.target.value === 'Avioneta') setEditCapacidad('8')
                                        if(e.target.value === 'Camioneta') setEditCapacidad('4')
                                        if(e.target.value === 'Alterna') setEditCapacidad('8')
                                    }} 
                                    className="w-full mt-1 p-2.5 border rounded-lg text-sm bg-zinc-50 font-bold"
                                >
                                    <option value="Autobús">Autobús (37 lgs)</option>
                                    <option value="Combi">Combi (14 lgs)</option>
                                    <option value="Avioneta">Avioneta (8 lgs)</option>
                                    <option value="Camioneta">Camioneta (4 lgs)</option>
                                    <option value="Alterna">Alterna (Contratistas / Particular)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase">Ruta / Destino</label>
                                <input 
                                    type="text" 
                                    value={editRuta} 
                                    onChange={e => setEditRuta(e.target.value)} 
                                    className="w-full mt-1 p-2.5 border rounded-lg text-sm bg-zinc-50 font-bold" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Fecha</label>
                                    <input 
                                        type="date" 
                                        value={editFecha} 
                                        onChange={e => setEditFecha(e.target.value)} 
                                        className="w-full mt-1 p-2.5 border rounded-lg text-sm bg-zinc-50" 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Hora Salida</label>
                                    <input 
                                        type="time" 
                                        value={editHora} 
                                        onChange={e => setEditHora(e.target.value)} 
                                        className="w-full mt-1 p-2.5 border rounded-lg text-sm bg-zinc-50" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t flex justify-end gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setEditingViaje(null)}
                                className="px-4 py-2 text-zinc-500 font-bold hover:bg-zinc-100 rounded-lg"
                                disabled={savingEdit}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmEdit}
                                disabled={savingEdit}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg shadow-md"
                            >
                                {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
