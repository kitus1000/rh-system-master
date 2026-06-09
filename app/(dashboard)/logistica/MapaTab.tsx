'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Rnd } from 'react-rnd'
import { Plus, Trash2, MapPin, Truck, Mountain, TreePine, Building2, Factory, Map as MapIcon, Compass } from 'lucide-react'

export default function MapaTab() {
    const [puntos, setPuntos] = useState<any[]>([])
    const [asignaciones, setAsignaciones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    const [nuevoPunto, setNuevoPunto] = useState({ 
        nombre_punto: '', 
        descripcion: '',
        es_central: false,
        km_al_centro: 0,
        tipo_relieve: 'Planta'
    })

    useEffect(() => {
        fetchData()
        const timer = setInterval(() => setCurrentTime(new Date()), 60000) // Update time every minute
        return () => clearInterval(timer)
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Get today's string YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0]

            const [puntosRes, asigRes] = await Promise.all([
                supabase.from('logistica_puntos_mina').select('*').order('creado_el'),
                supabase.from('logistica_local_asignaciones').select(`
                    *,
                    empleados(nombre, apellido_paterno),
                    logistica_camiones(numero_economico)
                `)
                .lte('fecha_inicio', today)
                .gte('fecha_fin', today)
            ])
            
            if (puntosRes.error) throw puntosRes.error
            if (asigRes.error) throw asigRes.error
            
            setPuntos(puntosRes.data || [])
            setAsignaciones(asigRes.data || [])
        } catch (error) {
            console.error('Error fetching data for map', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddPunto = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nuevoPunto.nombre_punto) return

        try {
            // Si es central, quitamos la bandera a los demás primero (solo puede haber uno)
            if (nuevoPunto.es_central) {
                await supabase.from('logistica_puntos_mina').update({ es_central: false }).neq('id_punto', '00000000-0000-0000-0000-000000000000')
            }

            const payload = {
                nombre_punto: nuevoPunto.nombre_punto,
                descripcion: nuevoPunto.descripcion,
                posicion_x: 200 + (puntos.length * 20),
                posicion_y: 200 + (puntos.length * 20),
                es_central: nuevoPunto.es_central,
                km_al_centro: nuevoPunto.km_al_centro,
                tipo_relieve: nuevoPunto.tipo_relieve
            }
            const { error } = await supabase.from('logistica_puntos_mina').insert([payload])
            if (error) throw error
            setNuevoPunto({ nombre_punto: '', descripcion: '', es_central: false, km_al_centro: 0, tipo_relieve: 'Plano' })
            fetchData()
        } catch (error) {
            console.error('Error', error)
            alert('Error al agregar punto')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este punto del mapa?')) return
        try {
            const { error } = await supabase.from('logistica_puntos_mina').delete().eq('id_punto', id)
            if (error) throw error
            fetchData()
        } catch (error) {
            console.error('Error deleting', error)
            alert('Error al eliminar. Posiblemente esté en uso en una rotación.')
        }
    }

    const handleDragStop = async (id: string, x: number, y: number) => {
        setPuntos(prev => prev.map(p => p.id_punto === id ? { ...p, posicion_x: x, posicion_y: y } : p))
        try {
            await supabase.from('logistica_puntos_mina').update({ posicion_x: x, posicion_y: y }).eq('id_punto', id)
        } catch (error) {
            console.error('Error saving position', error)
        }
    }

    const getReliefIcon = (tipo: string, className = "w-6 h-6 text-white") => {
        switch (tipo) {
            case 'Montaña': return <Mountain className={className} />
            case 'Bosque': return <TreePine className={className} />
            case 'Ciudad': return <Building2 className={className} />
            case 'Planta': return <Factory className={className} />
            default: return <MapPin className={className} />
        }
    }

    // Renderiza iconos decorativos alrededor del punto principal
    const renderRelieveAmbiental = (tipo: string) => {
        if (tipo === 'Plano') return null
        
        const offsets = [
            { x: -50, y: -40, scale: 'scale-75', op: 'opacity-40' },
            { x: 50, y: -20, scale: 'scale-90', op: 'opacity-50' },
            { x: -40, y: 40, scale: 'scale-100', op: 'opacity-40' },
            { x: 40, y: 50, scale: 'scale-75', op: 'opacity-30' },
            { x: 0, y: -50, scale: 'scale-50', op: 'opacity-40' }
        ]

        return (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {offsets.map((pos, idx) => (
                    <div 
                        key={idx} 
                        className={`absolute ${pos.scale} ${pos.op} text-zinc-400`}
                        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                    >
                        {getReliefIcon(tipo, "w-8 h-8")}
                    </div>
                ))}
            </div>
        )
    }

    // Helper para Fake GPS: convierte "HH:MM:SS" a Date hoy
    const parseTime = (timeStr: string) => {
        if (!timeStr) return null
        const [hours, minutes] = timeStr.split(':')
        const d = new Date()
        d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
        return d
    }

    const puntoCentral = puntos.find(p => p.es_central)

    // Función para renderizar el fondo del mapa y las líneas SVG
    const renderConnections = () => {
        if (!puntoCentral) return null

        return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {puntos.filter(p => !p.es_central).map(punto => {
                    // Centro del pin visual aproximado (ajuste por padding/icono)
                    const x1 = puntoCentral.posicion_x + 30
                    const y1 = puntoCentral.posicion_y + 30
                    const x2 = punto.posicion_x + 30
                    const y2 = punto.posicion_y + 30

                    const midX = (x1 + x2) / 2
                    const midY = (y1 + y2) / 2

                    // Encontrar si hay un camión moviéndose hoy hacia este punto
                    const asignacionHoy = asignaciones.find(a => a.id_punto === punto.id_punto)
                    let progress = -1

                    if (asignacionHoy && asignacionHoy.hora_salida && asignacionHoy.hora_llegada) {
                        const salida = parseTime(asignacionHoy.hora_salida)
                        const llegada = parseTime(asignacionHoy.hora_llegada)
                        if (salida && llegada && salida < llegada) {
                            const totalMs = llegada.getTime() - salida.getTime()
                            const elapsedMs = currentTime.getTime() - salida.getTime()
                            if (elapsedMs >= 0 && elapsedMs <= totalMs) {
                                progress = elapsedMs / totalMs
                            } else if (elapsedMs > totalMs) {
                                progress = 1 // Ya llegó
                            }
                        }
                    }

                    return (
                        <g key={`line-${punto.id_punto}`}>
                            {/* Línea de ruta */}
                            <line 
                                x1={x1} y1={y1} x2={x2} y2={y2} 
                                stroke="#9ca3af" strokeWidth="3" strokeDasharray="6 6" 
                                className="opacity-60"
                            />
                            {/* Etiqueta de Kilómetros */}
                            <rect x={midX - 25} y={midY - 12} width="50" height="24" rx="4" fill="#1f2937" />
                            <text x={midX} y={midY + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                                {punto.km_al_centro} Km
                            </text>

                                    {/* FAKE GPS: Camión en movimiento */}
                            {progress >= 0 && progress < 1 && (
                                <g transform={`translate(${
                                    asignacionHoy.sentido === 'Vuelta' 
                                        ? x2 + (x1 - x2) * progress - 15 
                                        : x1 + (x2 - x1) * progress - 15
                                }, ${
                                    asignacionHoy.sentido === 'Vuelta' 
                                        ? y2 + (y1 - y2) * progress - 15 
                                        : y1 + (y2 - y1) * progress - 15
                                })`}>
                                    <circle cx="15" cy="15" r="18" fill={asignacionHoy.sentido === 'Vuelta' ? "#8b5cf6" : "#f59e0b"} className="animate-pulse opacity-50" />
                                    <rect x="0" y="0" width="30" height="30" rx="8" fill={asignacionHoy.sentido === 'Vuelta' ? "#8b5cf6" : "#f59e0b"} />
                                    <Truck x="5" y="5" width="20" height="20" color="white" />
                                    {/* Etiqueta del chofer flotando */}
                                    <rect x="-35" y="-25" width="100" height="20" rx="4" fill="white" stroke={asignacionHoy.sentido === 'Vuelta' ? "#8b5cf6" : "#f59e0b"} />
                                    <text x="15" y="-12" textAnchor="middle" fill="#374151" fontSize="10" fontWeight="bold">
                                        {asignacionHoy.sentido === 'Vuelta' ? '⬅ ' : '➡ '}{asignacionHoy.empleados?.nombre} (Eco: {asignacionHoy.logistica_camiones?.numero_economico})
                                    </text>
                                </g>
                            )}
                            
                            {/* Chofer en destino (Ya llegó o estaba estacionado) */}
                            {progress === 1 && (
                                <g transform={`translate(${asignacionHoy.sentido === 'Vuelta' ? x1 + 20 : x2 + 20}, ${asignacionHoy.sentido === 'Vuelta' ? y1 - 20 : y2 - 20})`}>
                                    <rect x="0" y="0" width="120" height="20" rx="4" fill="#10b981" />
                                    <text x="60" y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                                        Llegó: {asignacionHoy.empleados?.nombre}
                                    </text>
                                </g>
                            )}
                        </g>
                    )
                })}
            </svg>
        )
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[750px]">
            {/* Panel Izquierdo */}
            <div className="w-full md:w-80 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm flex flex-col h-full overflow-y-auto">
                <h2 className="text-lg font-bold text-zinc-900 mb-2">Editor del Mapa</h2>
                <p className="text-xs text-zinc-500 mb-4">Crea lugares, define el relieve y los Km de distancia al punto central.</p>
                
                <form onSubmit={handleAddPunto} className="space-y-4 mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-md">
                    <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">Nombre del Lugar</label>
                        <input 
                            type="text" required
                            className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                            value={nuevoPunto.nombre_punto}
                            onChange={(e) => setNuevoPunto({...nuevoPunto, nombre_punto: e.target.value})}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">Tipo de Relieve</label>
                        <select 
                            className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                            value={nuevoPunto.tipo_relieve}
                            onChange={(e) => setNuevoPunto({...nuevoPunto, tipo_relieve: e.target.value})}
                        >
                            <option value="Planta">Planta Central</option>
                            <option value="Montaña">Montaña</option>
                            <option value="Bosque">Bosque</option>
                            <option value="Ciudad">Ciudad</option>
                            <option value="Plano">Terreno Plano / Otro</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="es_central"
                            className="rounded border-zinc-300 text-black focus:ring-black"
                            checked={nuevoPunto.es_central}
                            onChange={(e) => setNuevoPunto({...nuevoPunto, es_central: e.target.checked})}
                        />
                        <label htmlFor="es_central" className="text-xs font-bold text-amber-600">Es el Punto Central (Inicio)</label>
                    </div>

                    {!nuevoPunto.es_central && (
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 mb-1">Distancia al Centro (Km)</label>
                            <input 
                                type="number" step="0.1" required
                                className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                value={nuevoPunto.km_al_centro}
                                onChange={(e) => setNuevoPunto({...nuevoPunto, km_al_centro: parseFloat(e.target.value)})}
                            />
                        </div>
                    )}

                    <button type="submit" className="w-full flex items-center justify-center bg-black text-white px-4 py-2 rounded-md hover:bg-zinc-800 text-sm font-medium">
                        <Plus className="w-4 h-4 mr-2" /> Agregar al Mapa
                    </button>
                </form>

                <div className="flex-1">
                    <h3 className="font-bold text-sm text-zinc-900 mb-2 border-b pb-1">Lugares en el Mapa</h3>
                    <ul className="divide-y divide-zinc-200">
                        {puntos.map(p => (
                            <li key={p.id_punto} className="py-2 flex justify-between items-center group">
                                <div className="flex items-center">
                                    {p.es_central ? <Compass className="w-4 h-4 text-amber-600 mr-2" /> : <MapIcon className="w-4 h-4 text-zinc-400 mr-2" />}
                                    <div>
                                        <p className="text-sm font-medium text-zinc-900">{p.nombre_punto}</p>
                                        <p className="text-xs text-zinc-500">{p.es_central ? 'Punto Central' : `${p.km_al_centro} Km`}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDelete(p.id_punto)}
                                    className="text-zinc-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Lienzo del Mapa (Canvas Inmersivo) */}
            <div className="flex-1 bg-[#eef2f6] rounded-lg border-2 border-zinc-300 shadow-inner relative overflow-hidden h-[750px]">
                {/* Cuadrícula Topográfica de fondo */}
                <div className="absolute inset-0 pointer-events-none opacity-30"
                     style={{
                         backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`,
                         backgroundSize: '50px 50px'
                     }}>
                </div>
                
                {/* Rutas SVG */}
                {renderConnections()}

                {/* Puntos Arrastrables */}
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-zinc-500">Cargando mapa interactivo...</div>
                ) : (
                    puntos.map((punto) => {
                        const isCentral = punto.es_central
                        const colorClass = isCentral ? 'bg-amber-600 border-amber-800' : 'bg-emerald-600 border-emerald-800'
                        
                        return (
                            <Rnd
                                key={punto.id_punto}
                                default={{
                                    x: punto.posicion_x || 200,
                                    y: punto.posicion_y || 200,
                                    width: 'auto',
                                    height: 'auto',
                                }}
                                enableResizing={false}
                                bounds="parent"
                                onDragStop={(e, d) => handleDragStop(punto.id_punto, d.x, d.y)}
                                className="z-10 group"
                            >
                                <div className="flex flex-col items-center cursor-move relative w-32 h-32 justify-center">
                                    {/* Entorno / Relieve esparcido alrededor */}
                                    {renderRelieveAmbiental(punto.tipo_relieve)}

                                    <div className={`p-3 rounded-2xl shadow-xl hover:scale-110 transition-transform border-2 border-white relative z-10 ${colorClass}`}>
                                        {getReliefIcon(punto.tipo_relieve, "w-8 h-8 text-white")}
                                    </div>
                                    <div className="mt-2 bg-black/90 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-xl whitespace-nowrap border border-zinc-700 relative z-10">
                                        {isCentral && '🌟 '} {punto.nombre_punto}
                                    </div>
                                </div>
                            </Rnd>
                        )
                    })
                )}
            </div>
        </div>
    )
}
