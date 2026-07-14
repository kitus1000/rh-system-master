'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Bus, Plane, Car, Plus, Calendar, Clock, MapPin, Users, ArrowRight, ExternalLink, Copy, Check } from 'lucide-react'
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

export default function TransporteDashboard() {
    const [viajes, setViajes] = useState<Viaje[]>([])
    const [loading, setLoading] = useState(true)
    
    // Formulario de Nuevo Viaje
    const [showForm, setShowForm] = useState(false)
    const [tipo, setTipo] = useState('Autobús')
    const [ruta, setRuta] = useState('')
    const [fecha, setFecha] = useState('')
    const [hora, setHora] = useState('')
    const [capacidad, setCapacidad] = useState('37')
    const [copied, setCopied] = useState(false)

    const handleCopyLink = () => {
        const url = `${window.location.origin}/reservar-viaje`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const fetchViajes = async () => {
        setLoading(true)
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
        setLoading(false)
    }

    useEffect(() => {
        fetchViajes()
    }, [])

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
            alert('Error al crear el viaje. ¿Ya corriste el script de la base de datos?')
        } else {
            setShowForm(false)
            setRuta('')
            fetchViajes()
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <Bus className="w-8 h-8 text-indigo-500" /> 
                        Transporte de Personal
                    </h1>
                    <p className="text-zinc-500 mt-1 font-medium">Sistema de Reservas y Asignación de Asientos</p>
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
                        <p className="text-xs text-zinc-500 mt-0.5">Los empleados pueden reservar vuelos y autobuses de manera independiente y segura.</p>
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
                            <input type="text" value={ruta} onChange={e => setRuta(e.target.value)} placeholder="Ej. Hermosillo - Mina" className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 font-bold" />
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
                <div className="p-12 text-center text-zinc-400 font-bold animate-pulse">Cargando rutas...</div>
            ) : (
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
                                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> {v.hora} Hrs</div>
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
                            No hay viajes programados. Haz clic en "Programar Viaje" para empezar.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
