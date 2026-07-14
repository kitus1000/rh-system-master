'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    startOfMonth, endOfMonth, eachDayOfInterval, format, 
    addMonths, subMonths, isSameDay, getDay, addDays
} from 'date-fns'
import { es } from 'date-fns/locale'
import { 
    Calendar as CalendarIcon, Bus, Plane, Car, Plus, 
    ChevronLeft, ChevronRight, HelpCircle, ArrowLeft, 
    Settings, Play, CheckCircle2, Clock, Trash2, ShieldAlert,
    RefreshCw
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
    reservas_count?: number
}

export default function SobrecalendarioViajes() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viajes, setViajes] = useState<Viaje[]>([])
    const [loading, setLoading] = useState(true)

    // Configuration for rotation rule
    const [rotationStartDate, setRotationStartDate] = useState('2026-07-01')
    
    // Auto-programmer modal and state
    const [showGenerator, setShowGenerator] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [previewViajes, setPreviewViajes] = useState<any[]>([])
    
    // Default hours and routes for rules (Durango - Bacis)
    const [rulesConfig, setRulesConfig] = useState({
        medicalEntryTime: '08:00',
        medicalEntryRoute: 'Durango - Bacis (Pase Médico)',
        medicalEntryVehicle: 'Autobús',
        
        medicalExitTime: '16:00',
        medicalExitRoute: 'Bacis - Durango (Revisión Médica)',
        medicalExitVehicle: 'Autobús',
        
        rotationExitTime: '12:00',
        rotationExitRoute: 'Bacis - Durango (Salida de Personal)',
        rotationExitVehicle: 'Autobús',
        
        rotationEntryTime: '07:00',
        rotationEntryRoute: 'Durango - Bacis (Regreso de Personal)',
        rotationEntryVehicle: 'Autobús'
    })

    const fetchViajes = async () => {
        setLoading(true)
        const startStr = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        const endStr = format(endOfMonth(currentDate), 'yyyy-MM-dd')

        try {
            // Load trips for the month
            const { data: viajesData, error: vError } = await supabase
                .from('transporte_personal_viajes')
                .select('*')
                .gte('fecha', startStr)
                .lte('fecha', endStr)
                .order('fecha', { ascending: true })
                .order('hora', { ascending: true })

            if (vError) throw vError

            // Load bookings counts for each trip
            if (viajesData && viajesData.length > 0) {
                const viajeIds = viajesData.map(v => v.id_viaje)
                const { data: seatsData, error: sError } = await supabase
                    .from('transporte_personal_asientos')
                    .select('id_viaje')
                    .in('id_viaje', viajeIds)

                if (sError) throw sError

                const countsMap = (seatsData || []).reduce((acc: any, curr: any) => {
                    acc[curr.id_viaje] = (acc[curr.id_viaje] || 0) + 1
                    return acc
                }, {})

                const processed = viajesData.map(v => ({
                    ...v,
                    reservas_count: countsMap[v.id_viaje] || 0
                }))
                setViajes(processed)
            } else {
                setViajes([])
            }
        } catch (e) {
            console.error('Error fetching calendar voyages:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchViajes()
    }, [currentDate])

    // Rotation cycle checks
    const getRotationDayInfo = (date: Date) => {
        const start = new Date(rotationStartDate + 'T00:00:00')
        const current = new Date(format(date, 'yyyy-MM-dd') + 'T00:00:00')
        
        const diffTime = current.getTime() - start.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) return null
        
        // 29-day cycle difference
        const R = diffDays % 29
        if (R === 19) {
            return { type: 'salida', label: 'Salida de Personal (Día 20)' }
        }
        if (R === 0) {
            return { type: 'regreso', label: 'Regreso de Personal (Día 30)' }
        }
        return null
    }

    const isMedicalEntryDay = (date: Date) => {
        const dayOfWeek = getDay(date) // 0: Sunday, 2: Tuesday, 6: Saturday
        return dayOfWeek === 2 || dayOfWeek === 6 // Tuesday or Saturday
    }

    const isMedicalExitDay = (date: Date) => {
        const dayOfWeek = getDay(date) // 0: Sunday, 4: Thursday
        return dayOfWeek === 0 || dayOfWeek === 4 // Sunday or Thursday
    }

    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    })

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))

    // Generator Wizard Calculations
    const handleGeneratePreview = () => {
        const preview: any[] = []
        const start = startOfMonth(currentDate)
        const end = endOfMonth(currentDate)
        const days = eachDayOfInterval({ start, end })

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            
            // Rule 1: Tuesdays & Saturdays (Medical Entry)
            if (isMedicalEntryDay(day)) {
                preview.push({
                    fecha: dateStr,
                    hora: rulesConfig.medicalEntryTime,
                    nombre_ruta: rulesConfig.medicalEntryRoute,
                    tipo_vehiculo: rulesConfig.medicalEntryVehicle,
                    capacidad_total: rulesConfig.medicalEntryVehicle === 'Autobús' ? 37 : rulesConfig.medicalEntryVehicle === 'Avioneta' ? 8 : 4,
                    ruleLabel: 'Entrada Médica (Mar/Sab)',
                    checked: true
                })
            }

            // Rule 2: Thursdays & Sundays (Medical Exit)
            if (isMedicalExitDay(day)) {
                preview.push({
                    fecha: dateStr,
                    hora: rulesConfig.medicalExitTime,
                    nombre_ruta: rulesConfig.medicalExitRoute,
                    tipo_vehiculo: rulesConfig.medicalExitVehicle,
                    capacidad_total: rulesConfig.medicalExitVehicle === 'Autobús' ? 37 : rulesConfig.medicalExitVehicle === 'Avioneta' ? 8 : 4,
                    ruleLabel: 'Salida Médica (Jue/Dom)',
                    checked: true
                })
            }

            // Rule 3: Rotation (Day 20 Exit & Day 30 Return)
            const rot = getRotationDayInfo(day)
            if (rot) {
                if (rot.type === 'salida') {
                    preview.push({
                        fecha: dateStr,
                        hora: rulesConfig.rotationExitTime,
                        nombre_ruta: rulesConfig.rotationExitRoute,
                        tipo_vehiculo: rulesConfig.rotationExitVehicle,
                        capacidad_total: rulesConfig.rotationExitVehicle === 'Autobús' ? 37 : rulesConfig.rotationExitVehicle === 'Avioneta' ? 8 : 4,
                        ruleLabel: 'Rotación: Salida (Día 20)',
                        checked: true
                    })
                } else if (rot.type === 'regreso') {
                    preview.push({
                        fecha: dateStr,
                        hora: rulesConfig.rotationEntryTime,
                        nombre_ruta: rulesConfig.rotationEntryRoute,
                        tipo_vehiculo: rulesConfig.rotationEntryVehicle,
                        capacidad_total: rulesConfig.rotationEntryVehicle === 'Autobús' ? 37 : rulesConfig.rotationEntryVehicle === 'Avioneta' ? 8 : 4,
                        ruleLabel: 'Rotación: Regreso (Día 30)',
                        checked: true
                    })
                }
            }
        })

        // Sort preview by date then hour
        preview.sort((a, b) => {
            const dateComp = a.fecha.localeCompare(b.fecha)
            if (dateComp !== 0) return dateComp
            return a.hora.localeCompare(b.hora)
        })

        setPreviewViajes(preview)
        setShowGenerator(true)
    }

    const handleSaveGeneratedViajes = async () => {
        setGenerating(true)
        try {
            const toInsert = previewViajes
                .filter(p => p.checked)
                .map(p => ({
                    tipo_vehiculo: p.tipo_vehiculo,
                    nombre_ruta: p.nombre_ruta,
                    fecha: p.fecha,
                    hora: p.hora + ':00', // format as time
                    capacidad_total: p.capacidad_total,
                    estado: 'Programado'
                }))

            if (toInsert.length === 0) {
                alert('No seleccionaste ningún viaje para crear.')
                setGenerating(false)
                return
            }

            const { error } = await supabase
                .from('transporte_personal_viajes')
                .insert(toInsert)

            if (error) throw error

            alert(`¡Exitoso!\nSe crearon ${toInsert.length} rutas programadas en el mes.`);
            setShowGenerator(false)
            fetchViajes()
        } catch (e: any) {
            console.error('Error generating routes:', e)
            alert('Error al guardar viajes: ' + e.message)
        } finally {
            setGenerating(false)
        }
    }

    const handleDeleteViaje = async (idViaje: string, e: React.MouseEvent) => {
        e.stopPropagation() // prevent clicking cell
        e.preventDefault()
        if (!confirm('¿Seguro que deseas eliminar este viaje programado? Se cancelarán todos los asientos.')) return
        
        try {
            const { error } = await supabase
                .from('transporte_personal_viajes')
                .delete()
                .eq('id_viaje', idViaje)

            if (error) throw error
            fetchViajes()
        } catch (err: any) {
            alert('Error al borrar viaje: ' + err.message)
        }
    }

    // Calendar grid rendering variables
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const startDate = addDays(monthStart, -getDay(monthStart)) // Pad beginning of month grid

    const calendarGrid: Date[] = []
    let tempDate = startDate
    // Render 6 rows (42 cells) to match standard calendar grid
    for (let i = 0; i < 42; i++) {
        calendarGrid.push(tempDate)
        tempDate = addDays(tempDate, 1)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Link href="/transporte" className="inline-flex text-xs font-bold text-zinc-500 hover:text-black items-center gap-1.5 transition-colors mb-2">
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Rutas
                    </Link>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-amber-500 animate-pulse" /> 
                        Sobrecalendario de Rutas
                    </h1>
                    <p className="text-zinc-500 mt-1 font-medium">Programación masiva inteligente y visualización mensual de vehículos</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Rotation start selector */}
                    <div className="bg-white border border-zinc-200 p-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm">
                        <span className="font-bold text-zinc-500">Ciclo Rotación:</span>
                        <input 
                            type="date"
                            value={rotationStartDate}
                            onChange={e => setRotationStartDate(e.target.value)}
                            className="bg-zinc-50 border border-zinc-200 rounded px-2 py-1 font-mono text-zinc-700 outline-none focus:ring-1 focus:ring-amber-500" 
                        />
                    </div>

                    <button
                        onClick={handleGeneratePreview}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2.5 rounded-xl shadow-lg shadow-amber-200 transition-all text-xs flex items-center gap-1.5"
                    >
                        <Settings className="w-4 h-4" />
                        AUTO-PROGRAMADOR
                    </button>
                </div>
            </div>

            {/* Calendar Controls */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors border border-zinc-200">
                        <ChevronLeft className="w-5 h-5 text-zinc-600" />
                    </button>
                    <span className="font-black text-zinc-800 text-xl capitalize min-w-[180px] text-center">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </span>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors border border-zinc-200">
                        <ChevronRight className="w-5 h-5 text-zinc-600" />
                    </button>
                </div>

                <div className="hidden sm:flex gap-4 text-xs font-semibold text-zinc-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-sky-100 border border-sky-300 rounded-full"></span> Entrada Pase Médico</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-indigo-100 border border-indigo-300 rounded-full"></span> Salida Revisión Médica</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded-full"></span> Rotación (Entra/Sale)</span>
                </div>
            </div>

            {/* Calendar Grid */}
            {loading ? (
                <div className="p-20 text-center text-zinc-400 font-bold animate-pulse flex flex-col justify-center items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    <span>Sincronizando itinerarios de rutas...</span>
                </div>
            ) : (
                <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                    {/* Days of week header */}
                    <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200 text-center py-3 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        <div>Domingo</div>
                        <div>Lunes</div>
                        <div>Martes</div>
                        <div>Miércoles</div>
                        <div>Jueves</div>
                        <div>Viernes</div>
                        <div>Sábado</div>
                    </div>

                    {/* Calendar Day Cells */}
                    <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 bg-zinc-200">
                        {calendarGrid.map((day, idx) => {
                            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                            const isToday = isSameDay(day, new Date())
                            const dayViajes = viajes.filter(v => v.fecha === format(day, 'yyyy-MM-dd'))

                            // Check Rules
                            const isMedEntry = isMedicalEntryDay(day)
                            const isMedExit = isMedicalExitDay(day)
                            const rotInfo = getRotationDayInfo(day)

                            return (
                                <div 
                                    key={idx} 
                                    className={`min-h-[120px] bg-white p-2 flex flex-col justify-between group transition-colors hover:bg-zinc-50/50
                                        ${isCurrentMonth ? 'text-zinc-800' : 'text-zinc-300 bg-zinc-50/50'}`}
                                >
                                    {/* Cell Header */}
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-sm font-black p-1 rounded-lg w-7 h-7 flex items-center justify-center
                                            ${isToday ? 'bg-amber-500 text-black shadow-md shadow-amber-200' : ''}
                                            ${isCurrentMonth ? 'text-zinc-800' : 'text-zinc-400'}`}>
                                            {format(day, 'd')}
                                        </span>
                                        
                                        {/* Rule Badges */}
                                        <div className="flex gap-1 flex-wrap justify-end">
                                            {rotInfo && (
                                                <span 
                                                    title={rotInfo.label}
                                                    className={`w-2 h-2 rounded-full border ${rotInfo.type === 'salida' ? 'bg-amber-500 border-amber-600' : 'bg-green-500 border-green-600'}`}
                                                />
                                            )}
                                            {isMedEntry && (
                                                <span 
                                                    title="Día de Entrada Médica sugerido (Mar/Sab)"
                                                    className="w-2 h-2 rounded-full bg-sky-400 border border-sky-500"
                                                />
                                            )}
                                            {isMedExit && (
                                                <span 
                                                    title="Día de Salida Médica sugerido (Jue/Dom)"
                                                    className="w-2 h-2 rounded-full bg-indigo-400 border border-indigo-500"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Voyages List */}
                                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] py-1">
                                        {dayViajes.map(v => (
                                            <Link 
                                                key={v.id_viaje}
                                                href={`/transporte/${v.id_viaje}`}
                                                className={`text-[9px] font-bold p-1 rounded border block transition-all flex justify-between items-center group/item hover:scale-[1.02]
                                                    ${v.tipo_vehiculo === 'Autobús' ? 'bg-sky-50 border-sky-100 text-sky-700 hover:bg-sky-100' :
                                                      v.tipo_vehiculo === 'Avioneta' ? 'bg-amber-50 border-amber-100 text-amber-800 hover:bg-amber-100' :
                                                      'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'}`}
                                            >
                                                <span className="truncate flex items-center gap-1">
                                                    {v.tipo_vehiculo === 'Autobús' && <Bus className="w-2.5 h-2.5 shrink-0 text-sky-500" />}
                                                    {v.tipo_vehiculo === 'Avioneta' && <Plane className="w-2.5 h-2.5 shrink-0 text-amber-500" />}
                                                    {v.tipo_vehiculo === 'Camioneta' && <Car className="w-2.5 h-2.5 shrink-0 text-emerald-500" />}
                                                    <span>{v.hora.substring(0, 5)} - {v.nombre_ruta}</span>
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="bg-white/80 border border-zinc-200/50 rounded px-1 text-[8px]">
                                                        {v.reservas_count}/{v.capacidad_total}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDeleteViaje(v.id_viaje, e)}
                                                        className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-red-100 text-red-500 rounded transition-opacity"
                                                        title="Eliminar viaje"
                                                    >
                                                        <Trash2 className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>

                                    {/* Cell Footer Rule Highlights */}
                                    <div className="text-[8px] font-bold text-right pt-0.5 border-t border-zinc-50 select-none uppercase tracking-wider">
                                        {rotInfo ? (
                                            <span className={rotInfo.type === 'salida' ? 'text-amber-600' : 'text-green-600'}>
                                                {rotInfo.type === 'salida' ? '↓ Salida Turno' : '↑ Regreso Turno'}
                                            </span>
                                        ) : isMedEntry ? (
                                            <span className="text-sky-500 font-medium">Entrada Médica</span>
                                        ) : isMedExit ? (
                                            <span className="text-indigo-500 font-medium">Salida Médica</span>
                                        ) : (
                                            <span className="text-zinc-200 font-normal">Libre</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Generator/Wizard Modal */}
            {showGenerator && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 border border-zinc-150 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-4 mb-4 shrink-0">
                            <h3 className="text-xl font-black text-zinc-950 flex items-center gap-2">
                                <Settings className="w-6 h-6 text-amber-500" />
                                Generador Automático de Rutas
                            </h3>
                            <button onClick={() => setShowGenerator(false)} className="text-zinc-400 hover:text-black font-black text-xl px-2">&times;</button>
                        </div>

                        {/* Middle: Rules Configuration Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-b border-zinc-100 pb-6 overflow-y-auto max-h-[30vh] shrink-0">
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b pb-1">1. Entrada Médica (Mar/Sab)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Hora</label>
                                        <input type="time" value={rulesConfig.medicalEntryTime} onChange={e => setRulesConfig({...rulesConfig, medicalEntryTime: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Vehículo</label>
                                        <select value={rulesConfig.medicalEntryVehicle} onChange={e => setRulesConfig({...rulesConfig, medicalEntryVehicle: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold">
                                            <option value="Autobús">Autobús (37 lgs)</option>
                                            <option value="Avioneta">Avioneta (8 lgs)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500">Ruta</label>
                                    <input type="text" value={rulesConfig.medicalEntryRoute} onChange={e => setRulesConfig({...rulesConfig, medicalEntryRoute: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b pb-1">2. Salida Médica (Jue/Dom)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Hora</label>
                                        <input type="time" value={rulesConfig.medicalExitTime} onChange={e => setRulesConfig({...rulesConfig, medicalExitTime: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Vehículo</label>
                                        <select value={rulesConfig.medicalExitVehicle} onChange={e => setRulesConfig({...rulesConfig, medicalExitVehicle: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold">
                                            <option value="Autobús">Autobús (37 lgs)</option>
                                            <option value="Avioneta">Avioneta (8 lgs)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500">Ruta</label>
                                    <input type="text" value={rulesConfig.medicalExitRoute} onChange={e => setRulesConfig({...rulesConfig, medicalExitRoute: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b pb-1">3. Rotación: Salida (Día 20)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Hora</label>
                                        <input type="time" value={rulesConfig.rotationExitTime} onChange={e => setRulesConfig({...rulesConfig, rotationExitTime: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Vehículo</label>
                                        <select value={rulesConfig.rotationExitVehicle} onChange={e => setRulesConfig({...rulesConfig, rotationExitVehicle: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold">
                                            <option value="Autobús">Autobús (37 lgs)</option>
                                            <option value="Avioneta">Avioneta (8 lgs)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500">Ruta</label>
                                    <input type="text" value={rulesConfig.rotationExitRoute} onChange={e => setRulesConfig({...rulesConfig, rotationExitRoute: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b pb-1">4. Rotación: Regreso (Día 30)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Hora</label>
                                        <input type="time" value={rulesConfig.rotationEntryTime} onChange={e => setRulesConfig({...rulesConfig, rotationEntryTime: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500">Vehículo</label>
                                        <select value={rulesConfig.rotationEntryVehicle} onChange={e => setRulesConfig({...rulesConfig, rotationEntryVehicle: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold">
                                            <option value="Autobús">Autobús (37 lgs)</option>
                                            <option value="Avioneta">Avioneta (8 lgs)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500">Ruta</label>
                                    <input type="text" value={rulesConfig.rotationEntryRoute} onChange={e => setRulesConfig({...rulesConfig, rotationEntryRoute: e.target.value})} className="w-full mt-1 p-2 bg-zinc-50 border rounded-lg text-xs font-bold" />
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Preview table */}
                        <div className="flex-1 overflow-y-auto mb-4 min-h-[150px]">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Vista Previa de Generación</h4>
                                <button 
                                    onClick={handleGeneratePreview}
                                    className="text-[10px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold px-2.5 py-1 rounded"
                                >
                                    Recalcular Vista Previa
                                </button>
                            </div>
                            <div className="border rounded-2xl overflow-hidden text-xs">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50 border-b text-[10px] text-zinc-500 font-bold uppercase">
                                            <th className="p-2 text-center w-10">Crear</th>
                                            <th className="p-2 text-left">Fecha / Hora</th>
                                            <th className="p-2 text-left">Ruta / Destino</th>
                                            <th className="p-2 text-left">Vehículo</th>
                                            <th className="p-2 text-left">Regla Origen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewViajes.map((pv, index) => (
                                            <tr key={index} className="hover:bg-zinc-50/50">
                                                <td className="p-2 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={pv.checked} 
                                                        onChange={() => {
                                                            const copy = [...previewViajes]
                                                            copy[index].checked = !copy[index].checked
                                                            setPreviewViajes(copy)
                                                        }}
                                                        className="rounded text-amber-500" 
                                                    />
                                                </td>
                                                <td className="p-2 font-mono">{pv.fecha} - {pv.hora}</td>
                                                <td className="p-2 font-bold">{pv.nombre_ruta}</td>
                                                <td className="p-2">{pv.tipo_vehiculo} ({pv.capacidad_total} lgs)</td>
                                                <td className="p-2 text-zinc-500 font-bold text-[9px] uppercase">{pv.ruleLabel}</td>
                                            </tr>
                                        ))}
                                        {previewViajes.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-zinc-400">Haz clic en Recalcular para procesar el mes actual.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-4 border-t border-zinc-100 flex gap-2 justify-end shrink-0">
                            <button
                                onClick={() => setShowGenerator(false)}
                                className="px-4 py-2.5 text-zinc-500 font-bold hover:bg-zinc-100 rounded-xl transition-colors text-xs"
                                disabled={generating}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveGeneratedViajes}
                                disabled={generating || previewViajes.filter(p=>p.checked).length === 0}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-black px-6 py-2.5 rounded-xl shadow-lg shadow-amber-100 transition-all text-xs flex items-center gap-2"
                            >
                                {generating ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" /> Creando viajes...
                                    </>
                                ) : (
                                    `Crear ${previewViajes.filter(p=>p.checked).length} Viajes Programados`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
