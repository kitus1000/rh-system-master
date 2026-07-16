'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User, Armchair, CheckCircle, Trash2, ShieldAlert, Plane, Car, Bus, AlertTriangle, RefreshCw, Printer, FileText } from 'lucide-react'
import Link from 'next/link'

interface Empleado {
    id_empleado: string
    nombre: string
    apellido_paterno: string
    puesto: string
}

interface Reserva {
    id_reserva: string
    numero_asiento: number
    id_empleado: string | null
    nombre_pasajero?: string
    departamento_pasajero?: string
    empleados: { nombre: string, apellido_paterno: string, puesto: string } | null
}

export default function TransporteReserva() {
    const params = useParams()
    const router = useRouter()
    const id_viaje = params.id as string

    const [viaje, setViaje] = useState<any>(null)
    const [reservas, setReservas] = useState<Reserva[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
    const [searchEmp, setSearchEmp] = useState('')
    const [saving, setSaving] = useState(false)
    const [manualNombre, setManualNombre] = useState('')
    const [manualDepto, setManualDepto] = useState('')

    // Contingencia State
    const [showContingenciaModal, setShowContingenciaModal] = useState(false)
    const [contingenciaLoading, setContingenciaLoading] = useState(false)

    useEffect(() => {
        const loadData = async () => {
            // 1. Cargar el viaje
            const { data: vData } = await supabase.from('transporte_personal_viajes').select('*').eq('id_viaje', id_viaje).single()
            if (vData) setViaje(vData)

            // 2. Cargar las reservas actuales
            const { data: rData } = await supabase.from('transporte_personal_asientos').select('*, empleados(nombre, apellido_paterno, puesto)').eq('id_viaje', id_viaje)
            if (rData) setReservas(rData)

            // 3. Cargar lista de empleados para asignar
            const { data: eData } = await supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, puesto').eq('estado_empleado', 'Activo')
            if (eData) setEmpleados(eData)

            setLoading(false)
        }
        loadData()
    }, [id_viaje])

    const handleAssign = async (id_empleado: string) => {
        if (!selectedSeat || !viaje) return
        setSaving(true)
        
        // Check if employee is already in another seat
        if (reservas.find(r => r.id_empleado === id_empleado)) {
            alert('Este empleado ya tiene un asiento asignado en este viaje.')
            setSaving(false)
            return
        }

        const { data, error } = await supabase.from('transporte_personal_asientos').insert([{
            id_viaje: viaje.id_viaje,
            id_empleado,
            numero_asiento: selectedSeat
        }]).select('*, empleados(nombre, apellido_paterno, puesto)').single()

        if (error) {
            console.error(error)
            alert('Error al asignar asiento. Posiblemente alguien más ya lo tomó.')
        } else if (data) {
            setReservas([...reservas, data])
            setSelectedSeat(null)
            setSearchEmp('')
        }
        setSaving(false)
    }

    const handleAssignManual = async (nombre_pasajero: string, departamento_pasajero: string) => {
        if (!selectedSeat || !viaje) return
        setSaving(true)
        
        const { data, error } = await supabase.from('transporte_personal_asientos').insert([{
            id_viaje: viaje.id_viaje,
            id_empleado: null,
            numero_asiento: selectedSeat,
            nombre_pasajero: nombre_pasajero.trim(),
            departamento_pasajero: departamento_pasajero.trim()
        }]).select('*, empleados(nombre, apellido_paterno, puesto)').single()

        if (error) {
            console.error(error)
            alert('Error al asignar asiento. Posiblemente alguien más ya lo tomó.')
        } else if (data) {
            setReservas([...reservas, data])
            setSelectedSeat(null)
            setSearchEmp('')
            setManualNombre('')
            setManualDepto('')
        }
        setSaving(false)
    }

    const handleRemove = async (id_reserva: string) => {
        if (!confirm('¿Seguro que deseas liberar este asiento?')) return
        const { error } = await supabase.from('transporte_personal_asientos').delete().eq('id_reserva', id_reserva)
        if (!error) {
            setReservas(reservas.filter(r => r.id_reserva !== id_reserva))
            setSelectedSeat(null)
        }
    }

    const handleExportExcel = () => {
        if (!viaje) return
        const totalAsientos = viaje.capacidad_total
        const asientosList = Array.from({ length: totalAsientos }, (_, i) => i + 1)

        const formattedDate = new Date(viaje.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        })

        // Build CSV content matching the exact printout structure
        let csvContent = ""
        csvContent += "\"I\",,\n"
        csvContent += "\"UNIDAD EL HERRERO\",,\n"
        csvContent += `\"1    ${(viaje.nombre_ruta || '').toUpperCase()}\",,\n`
        csvContent += "\"RELACION DE PASES MEDICOS Y TRABAJADORES\",,\n"
        csvContent += `\"${formattedDate.toUpperCase()}\",,\n`
        csvContent += ",,\n"
        csvContent += "\"No. ASIENTO\",\"NOMBRE\",\"DEPARTAMENTO\"\n"

        asientosList.forEach(num => {
            const res = reservas.find(r => r.numero_asiento === num)
            const nombre = res 
                ? (res.empleados ? `${res.empleados.nombre} ${res.empleados.apellido_paterno}` : res.nombre_pasajero) 
                : ""
            const depto = res 
                ? (res.empleados ? res.empleados.puesto : res.departamento_pasajero) 
                : ""
            
            // Escape values for CSV
            const escNombre = `"${(nombre || '').toUpperCase().replace(/"/g, '""')}"`
            const escDepto = `"${(depto || '').toUpperCase().replace(/"/g, '""')}"`
            csvContent += `${num},${escNombre},${escDepto}\n`
        })

        // Trigger download with UTF-8 BOM
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `relacion_pasajeros_viaje_${viaje.fecha}_${viaje.tipo_vehiculo}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handlePrintManifest = () => {
        if (!viaje) return
        const totalAsientos = viaje.capacidad_total
        const asientosList = Array.from({ length: totalAsientos }, (_, i) => i + 1)
        
        const printWindow = window.open('', '_blank', 'width=800,height=900')
        if (!printWindow) return

        const formattedDate = new Date(viaje.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        })

        const rowsHTML = asientosList.map(num => {
            const res = reservas.find(r => r.numero_asiento === num)
            const nombre = res 
                ? (res.empleados ? `${res.empleados.nombre} ${res.empleados.apellido_paterno}` : res.nombre_pasajero) 
                : ""
            const depto = res 
                ? (res.empleados ? res.empleados.puesto : res.departamento_pasajero) 
                : ""
            return `
                <tr>
                    <td class="col-seat">${num}</td>
                    <td class="col-name">${(nombre || '').toUpperCase()}</td>
                    <td class="col-dept">${(depto || '').toUpperCase()}</td>
                </tr>
            `
        }).join('')

        printWindow.document.write(`
            <html>
                <head>
                    <title>Relación de Pasajeros - ${viaje.fecha}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 40px;
                            color: #000;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                            line-height: 1.6;
                        }
                        .header h1 {
                            font-size: 16px;
                            font-weight: bold;
                            margin: 0;
                            text-decoration: underline;
                            letter-spacing: 1px;
                        }
                        .header h2 {
                            font-size: 14px;
                            font-weight: bold;
                            margin: 5px 0 0 0;
                        }
                        .header h3 {
                            font-size: 14px;
                            font-weight: bold;
                            margin: 15px 0 5px 0;
                            letter-spacing: 0.5px;
                        }
                        .header .date {
                            font-size: 13px;
                            font-weight: bold;
                            margin-top: 5px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 20px;
                        }
                        th, td {
                            border: 1px solid #000;
                            padding: 8px 10px;
                            font-size: 12px;
                            text-align: left;
                        }
                        th {
                            font-weight: bold;
                            text-transform: uppercase;
                        }
                        .col-seat {
                            width: 10%;
                            text-align: center;
                            font-weight: bold;
                        }
                        .col-name {
                            width: 55%;
                            font-weight: bold;
                        }
                        .col-dept {
                            width: 35%;
                            font-weight: bold;
                        }
                        @media print {
                            body { margin: 20px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>I</h2>
                        <h1>UNIDAD EL HERRERO</h1>
                        <h2>${(viaje.nombre_ruta || '').toUpperCase()}</h2>
                        <h3>RELACION DE PASES MEDICOS Y TRABAJADORES</h3>
                        <div class="date">${formattedDate}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align: center;">No. ASIENTO</th>
                                <th>NOMBRE</th>
                                <th>DEPARTAMENTO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    const handleContingencia = async () => {
        if (!viaje || viaje.tipo_vehiculo !== 'Avioneta') return
        setContingenciaLoading(true)

        try {
            const numPasajeros = reservas.length
            
            if (numPasajeros === 0) {
                // Cancelar avioneta directamente
                const { error: cancelErr } = await supabase
                    .from('transporte_personal_viajes')
                    .update({ estado: 'Cancelado' })
                    .eq('id_viaje', id_viaje)

                if (cancelErr) throw cancelErr
                
                alert('Vuelo cancelado. Al no haber pasajeros registrados, no fue necesario generar camionetas.')
                setShowContingenciaModal(false)
                router.push('/transporte')
                return
            }

            const numCamionetas = Math.ceil(numPasajeros / 4)
            
            // Crear las N camionetas
            const nuevasCamionetas = []
            for (let i = 1; i <= numCamionetas; i++) {
                const { data, error } = await supabase
                    .from('transporte_personal_viajes')
                    .insert([{
                        tipo_vehiculo: 'Camioneta',
                        nombre_ruta: `[Contingencia] ${viaje.nombre_ruta} - Camioneta ${i}`,
                        fecha: viaje.fecha,
                        hora: viaje.hora,
                        capacidad_total: 4,
                        estado: 'Programado'
                    }])
                    .select('id_viaje, nombre_ruta')
                    .single()

                if (error) throw error
                if (data) nuevasCamionetas.push(data)
            }

            // Distribuir pasajeros
            const insertReservas = []
            for (let idx = 0; idx < numPasajeros; idx++) {
                const vanIdx = Math.floor(idx / 4)
                const seatNum = (idx % 4) + 1
                const passenger = reservas[idx]
                
                insertReservas.push({
                    id_viaje: nuevasCamionetas[vanIdx].id_viaje,
                    id_empleado: passenger.id_empleado,
                    numero_asiento: seatNum,
                    nombre_pasajero: passenger.nombre_pasajero,
                    departamento_pasajero: passenger.departamento_pasajero
                })
            }

            // Insertar todas las reservas en las camionetas
            const { error: insertErr } = await supabase
                .from('transporte_personal_asientos')
                .insert(insertReservas)

            if (insertErr) throw insertErr

            // Cancelar el viaje original de la avioneta
            const { error: updateErr } = await supabase
                .from('transporte_personal_viajes')
                .update({ estado: 'Cancelado' })
                .eq('id_viaje', id_viaje)

            if (updateErr) throw updateErr

            alert(`¡Contingencia exitosa!\n\nSe canceló el vuelo de avioneta y se crearon ${numCamionetas} camionetas para trasladar a los ${numPasajeros} pasajeros automáticamente.`)
            setShowContingenciaModal(false)
            router.push('/transporte')

        } catch (error: any) {
            console.error('Error en contingencia:', error)
            alert('Ocurrió un error al procesar la contingencia: ' + error.message)
        } finally {
            setContingenciaLoading(false)
        }
    }

    const renderSeatButton = (num: number) => {
        const reserva = reservas.find(r => r.numero_asiento === num)
        return (
            <button
                key={num}
                onClick={() => setSelectedSeat(num)}
                className={`
                    relative aspect-square w-full rounded-xl flex flex-col items-center justify-center transition-all shadow-sm border-2
                    ${reserva 
                        ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200' 
                        : 'bg-white border-zinc-200 text-zinc-400 hover:border-indigo-400 hover:text-indigo-600'}
                `}
            >
                <Armchair className={`w-5 h-5 mb-0.5 ${reserva ? 'text-amber-500' : 'text-zinc-300'}`} />
                <span className="text-[10px] font-black">{num}</span>
                {reserva && (
                    <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 rounded-full w-3.5 h-3.5 flex items-center justify-center border border-white">
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                    </div>
                )}
            </button>
        )
    }

    const renderAvionetaLayout = () => {
        // Avioneta: capacity / 2 rows
        const numRows = Math.ceil(totalAsientos / 2)
        const rows = Array.from({ length: numRows }, (_, i) => i)
        return (
            <div className="relative max-w-sm mx-auto my-8">
                {/* Alas del avión */}
                <div className="absolute top-28 -left-12 w-16 h-12 bg-zinc-200 border-2 border-r-0 border-zinc-300 rounded-l-3xl -rotate-12 z-0"></div>
                <div className="absolute top-28 -right-12 w-16 h-12 bg-zinc-200 border-2 border-l-0 border-zinc-300 rounded-r-3xl rotate-12 z-0"></div>
                
                {/* Estabilizadores traseros */}
                <div className="absolute bottom-4 -left-6 w-10 h-6 bg-zinc-200 border-2 border-r-0 border-zinc-300 rounded-l-xl -rotate-45 z-0"></div>
                <div className="absolute bottom-4 -right-6 w-10 h-6 bg-zinc-200 border-2 border-l-0 border-zinc-300 rounded-r-xl rotate-45 z-0"></div>
                
                {/* Fuselaje de la Avioneta */}
                <div className="bg-zinc-50 border-4 border-zinc-300 rounded-t-[50px] rounded-b-[40px] px-8 pt-16 pb-10 relative z-10 shadow-inner">
                    {/* Cockpit / Cabina Piloto */}
                    <div className="absolute top-4 inset-x-8 h-10 bg-zinc-800 rounded-t-full border-b-2 border-zinc-600 flex items-center justify-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        Cabina Pilotos
                    </div>

                    <div className="space-y-4 mt-6">
                        {rows.map((r) => {
                            const seatL = r * 2 + 1
                            const seatR = r * 2 + 2
                            return (
                                <div key={r} className="grid grid-cols-3 gap-2 items-center">
                                    {/* Asiento Izquierdo */}
                                    {renderSeatButton(seatL)}
                                    
                                    {/* Pasillo Central */}
                                    <div className="h-full border-x-2 border-dashed border-zinc-200 flex items-center justify-center text-[9px] font-black text-zinc-300 tracking-wider">
                                        PASILLO
                                    </div>
                                    
                                    {/* Asiento Derecho */}
                                    {renderSeatButton(seatR)}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    const renderCamionetaLayout = () => {
        // Camioneta: 4 seats in 2x2 layout
        return (
            <div className="relative max-w-xs mx-auto my-8">
                {/* Parabrisas y cofre */}
                <div className="w-48 bg-zinc-850 h-10 rounded-t-2xl mx-auto border-b-4 border-zinc-650 relative flex items-center justify-center z-10 bg-zinc-800">
                    <span className="text-[10px] font-black text-zinc-400 tracking-widest uppercase">FRENTE</span>
                </div>
                
                {/* Cabina Camioneta */}
                <div className="w-48 bg-zinc-50 border-4 border-t-0 border-zinc-300 rounded-b-3xl px-6 py-6 mx-auto shadow-inner relative z-0">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Fila 1 */}
                        {renderSeatButton(1)}
                        {renderSeatButton(2)}
                        
                        {/* Espacio intermedio / Consola */}
                        <div className="col-span-2 h-1 bg-zinc-200 rounded-full my-1"></div>
                        
                        {/* Fila 2 */}
                        {renderSeatButton(3)}
                        {renderSeatButton(4)}
                    </div>
                </div>
            </div>
        )
    }

    if (loading) return <div className="p-12 text-center font-bold text-zinc-500 animate-pulse">Cargando mapa de asientos...</div>
    if (!viaje) return <div className="p-12 text-center font-bold text-rose-500">Viaje no encontrado</div>

    // Generar arreglo de asientos (1 al N)
    const totalAsientos = viaje.capacidad_total
    const asientosList = Array.from({ length: totalAsientos }, (_, i) => i + 1)

    // Render Autobús Layout
    const renderAutobusLayout = () => {
        return (
            <div className="bg-zinc-100 p-8 rounded-3xl border-4 border-zinc-300 max-w-sm mx-auto relative overflow-hidden shadow-inner">
                {/* Cabina del chofer */}
                <div className="mb-8 border-b-2 border-zinc-300 pb-6 relative">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-white absolute left-0 top-0">
                        Chofer
                    </div>
                    <div className="text-center font-black text-zinc-300 text-3xl tracking-widest uppercase mt-4">Frente</div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    {asientosList.map((num) => {
                        const reserva = reservas.find(r => r.numero_asiento === num)
                        
                        // Agregar pasillo (margen a la derecha de la columna 2)
                        const isAisleLeft = num % 4 === 2 && num !== totalAsientos
                        
                        return (
                            <button
                                key={num}
                                onClick={() => setSelectedSeat(num)}
                                className={`
                                    relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all shadow-sm border-2
                                    ${isAisleLeft ? 'mr-6' : ''}
                                    ${reserva 
                                        ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200' 
                                        : 'bg-white border-zinc-200 text-zinc-400 hover:border-indigo-400 hover:text-indigo-600'}
                                    ${num === totalAsientos && num % 4 !== 0 ? 'col-span-4' : ''} // Último asiento centralizado si sobra
                                `}
                            >
                                <Armchair className={`w-6 h-6 mb-1 ${reserva ? 'text-amber-500' : 'text-zinc-300'}`} />
                                <span className="text-xs font-black">{num}</span>
                                {reserva && (
                                    <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                                        <CheckCircle className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            
            <Link href="/transporte" className="inline-flex text-sm font-bold text-zinc-500 hover:text-black items-center gap-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver a Rutas
            </Link>

            {/* Banner de Contingencia para Avionetas */}
            {viaje.tipo_vehiculo === 'Avioneta' && viaje.estado !== 'Cancelado' && (
                <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex gap-4 items-start">
                        <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-rose-950 font-black text-lg">¿Vuelo cancelado o Avioneta fuera de servicio?</h3>
                            <p className="text-sm text-rose-700 mt-1">Puedes cancelar este vuelo y el sistema creará automáticamente camionetas de 4 asientos para reubicar a todos los pasajeros asignados.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowContingenciaModal(true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-rose-200 transition-all text-sm shrink-0 flex items-center gap-2"
                    >
                        <Plane className="w-4 h-4" /> Convertir a Camionetas
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-8">
                
                {/* Lado Izquierdo: Resumen y Panel */}
                <div className="md:w-1/3 space-y-6">
                    <div className="bg-zinc-950 text-white p-6 rounded-3xl shadow-xl">
                        <div className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{viaje.tipo_vehiculo}</div>
                        <h1 className="text-3xl font-black mt-1 mb-6 leading-tight">{viaje.nombre_ruta}</h1>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                                <span className="text-zinc-400 text-sm">Fecha</span>
                                <span className="font-bold">{new Date(viaje.fecha + 'T12:00:00').toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                                <span className="text-zinc-400 text-sm">Hora Salida</span>
                                <span className="font-bold">{viaje.hora} Hrs</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Ocupación</span>
                                <span className={`font-black text-lg ${reservas.length === totalAsientos ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {reservas.length} / {totalAsientos}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <h3 className="text-amber-900 font-black flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4" /> Instrucciones</h3>
                        <p className="text-xs text-amber-700 font-medium">Haz clic en un asiento gris en el mapa para asignar un empleado. Los asientos naranjas ya están ocupados. Haz clic en uno ocupado para ver quién es o liberar su lugar.</p>
                    </div>
                </div>

                {/* Lado Derecho: Mapa de Asientos */}
                <div className="md:w-2/3">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200">
                        <h2 className="text-xl font-black text-zinc-800 mb-6 text-center">Plano del Vehículo</h2>
                        {viaje.tipo_vehiculo === 'Autobús' && renderAutobusLayout()}
                        {viaje.tipo_vehiculo === 'Avioneta' && renderAvionetaLayout()}
                        {viaje.tipo_vehiculo === 'Camioneta' && renderCamionetaLayout()}
                    </div>
                </div>
            </div>

            {/* Relación de Pasajeros Table & Actions */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 uppercase">Relación de Pases Médicos y Trabajadores</h2>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">Listado ordenado de ocupación del viaje</p>
                    </div>
                    <div className="flex gap-2.5">
                        <button
                            onClick={handleExportExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                        >
                            <FileText className="w-4 h-4" /> Exportar a Excel
                        </button>
                        <button
                            onClick={handlePrintManifest}
                            className="bg-zinc-900 hover:bg-black text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                        >
                            <Printer className="w-4 h-4" /> Imprimir Relación
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-650">
                        <thead className="bg-zinc-50 text-[10px] text-zinc-500 uppercase font-black border-b border-zinc-200">
                            <tr>
                                <th className="p-3 w-28 text-center">No. Asiento</th>
                                <th className="p-3">Nombre Completo</th>
                                <th className="p-3">Departamento / Concepto</th>
                                <th className="p-3 text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-medium">
                            {asientosList.map(num => {
                                const res = reservas.find(r => r.numero_asiento === num)
                                return (
                                    <tr key={num} className={res ? "hover:bg-zinc-50/50" : "text-zinc-400 bg-zinc-50/20"}>
                                        <td className="p-3 font-mono font-bold text-center bg-zinc-50/80 border-r">{num}</td>
                                        <td className="p-3 font-bold text-zinc-900 uppercase">
                                            {res 
                                                ? (res.empleados ? `${res.empleados.nombre} ${res.empleados.apellido_paterno}` : res.nombre_pasajero) 
                                                : "—"}
                                        </td>
                                        <td className="p-3 font-semibold text-zinc-650 uppercase">
                                            {res 
                                                ? (res.empleados ? res.empleados.puesto : res.departamento_pasajero) 
                                                : "—"}
                                        </td>
                                        <td className="p-3 text-right">
                                            {res ? (
                                                <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                                    Ocupado
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded bg-zinc-100 text-zinc-400">
                                                    Libre
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Asignación / Visualización */}
            {selectedSeat && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-4 mb-4">
                            <h3 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                                <Armchair className="w-5 h-5 text-indigo-500" /> Asiento {selectedSeat}
                            </h3>
                            <button onClick={() => setSelectedSeat(null)} className="text-zinc-400 hover:text-black font-black text-xl px-2">&times;</button>
                        </div>

                        {(() => {
                            const reserva = reservas.find(r => r.numero_asiento === selectedSeat)
                            
                            // ASIENTO OCUPADO
                            if (reserva) {
                                return (
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-500">
                                            <User className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Asignado A</div>
                                            <div className="text-lg font-black text-zinc-900 leading-tight mt-1">
                                                {reserva.empleados 
                                                    ? `${reserva.empleados.nombre} ${reserva.empleados.apellido_paterno}` 
                                                    : (reserva.nombre_pasajero || 'Pasajero Externo')}
                                            </div>
                                            <div className="text-sm text-zinc-500 mt-1">
                                                {reserva.empleados ? reserva.empleados.puesto : (reserva.departamento_pasajero || 'Sin puesto/Depto')}
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-zinc-100">
                                            <button 
                                                onClick={() => handleRemove(reserva.id_reserva)}
                                                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" /> Liberar Asiento
                                            </button>
                                        </div>
                                    </div>
                                )
                            }

                            // ASIENTO DISPONIBLE (ASIGNAR)
                            return (
                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        if (!manualNombre.trim()) return alert('Escribe el nombre del pasajero')
                                        handleAssignManual(manualNombre, manualDepto)
                                    }}
                                    className="space-y-4"
                                >
                                    <div className="text-[10px] font-black uppercase text-emerald-600 tracking-widest text-center bg-emerald-50 py-1 rounded-md">Asiento Disponible</div>
                                    
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">Nombre Completo</label>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="Ej. MARGARITA DIAZ CORRAL" 
                                                value={manualNombre}
                                                onChange={e => setManualNombre(e.target.value)}
                                                className="w-full p-2.5 border border-zinc-200 bg-zinc-50 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">Departamento / Pase Médico</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ej. PASE MEDICO, GEOLOGIA" 
                                                value={manualDepto}
                                                onChange={e => setManualDepto(e.target.value)}
                                                className="w-full p-2.5 border border-zinc-200 bg-zinc-50 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full bg-indigo-605 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                                        >
                                            {saving ? 'ASIGNANDO...' : 'RESERVAR ASIENTO'}
                                        </button>
                                    </div>
                                </form>
                            )
                        })()}
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Contingencia */}
            {showContingenciaModal && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-150">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-4 mb-4">
                            <h3 className="text-xl font-black text-rose-600 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-rose-500" /> Confirmar Contingencia
                            </h3>
                            <button 
                                onClick={() => !contingenciaLoading && setShowContingenciaModal(false)} 
                                className="text-zinc-400 hover:text-black font-black text-xl px-2"
                                disabled={contingenciaLoading}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                                Estás a punto de cancelar el vuelo de Avioneta y transferir a los pasajeros a camionetas.
                            </p>
                            
                            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2.5">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500 font-bold">Ruta original:</span>
                                    <span className="font-extrabold text-zinc-900">{viaje.nombre_ruta}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500 font-bold">Pasajeros a mover:</span>
                                    <span className="font-extrabold text-rose-600">{reservas.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500 font-bold">Camionetas requeridas:</span>
                                    <span className="font-extrabold text-indigo-600">{Math.ceil(reservas.length / 4)} (4 lgs c/u)</span>
                                </div>
                            </div>

                            <p className="text-[11px] text-zinc-400 leading-normal">
                                * Se crearán las camionetas necesarias y se copiarán las reservas automáticamente para el mismo día y hora. El viaje original en Avioneta quedará marcado como <b>'Cancelado'</b>.
                            </p>

                            <div className="pt-4 border-t border-zinc-100 flex gap-2 justify-end">
                                <button
                                    onClick={() => setShowContingenciaModal(false)}
                                    disabled={contingenciaLoading}
                                    className="px-4 py-2.5 text-zinc-500 font-bold hover:bg-zinc-100 rounded-xl transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleContingencia}
                                    disabled={contingenciaLoading}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-rose-100 transition-all text-sm flex items-center gap-2"
                                >
                                    {contingenciaLoading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Procesando...
                                        </>
                                    ) : (
                                        'Confirmar y Crear Camionetas'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
