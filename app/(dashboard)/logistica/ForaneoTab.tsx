'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Edit, MapPin } from 'lucide-react'

export default function ForaneoTab() {
    const [viajes, setViajes] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [camiones, setCamiones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        id_empleado: '',
        id_camion: '',
        fecha_salida: '',
        hora_salida: '',
        fecha_llegada: '',
        hora_llegada: '',
        estado: 'Programado',
        observaciones: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [viajesRes, empleadosRes, camionesRes] = await Promise.all([
                supabase.from('logistica_foraneo').select('*, empleados(nombre, apellido_paterno), logistica_camiones(numero_economico)').order('fecha_salida', { ascending: false }),
                supabase.from('empleados').select('id_empleado, nombre, apellido_paterno').eq('estado_empleado', 'Activo').order('nombre'),
                supabase.from('logistica_camiones').select('id_camion, numero_economico').eq('activo', true)
            ])

            if (viajesRes.error) throw viajesRes.error
            if (empleadosRes.error) throw empleadosRes.error
            if (camionesRes.error) throw camionesRes.error

            setViajes(viajesRes.data || [])
            setEmpleados(empleadosRes.data || [])
            setCamiones(camionesRes.data || [])
        } catch (error) {
            console.error('Error fetching data', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const payload = {
                id_empleado: formData.id_empleado,
                id_camion: formData.id_camion,
                destino: 'Durango',
                fecha_salida: formData.fecha_salida,
                hora_salida: formData.hora_salida,
                fecha_llegada: formData.fecha_llegada || null,
                hora_llegada: formData.hora_llegada || null,
                estado: formData.estado,
                observaciones: formData.observaciones
            }

            const { error } = await supabase.from('logistica_foraneo').insert([payload])
            if (error) throw error

            setIsModalOpen(false)
            setFormData({
                id_empleado: '', id_camion: '', fecha_salida: '', hora_salida: '',
                fecha_llegada: '', hora_llegada: '', estado: 'Programado', observaciones: ''
            })
            fetchData()
        } catch (error) {
            console.error('Error saving', error)
            alert('Error al guardar el viaje')
        }
    }

    const getStatusBadge = (estado: string) => {
        switch (estado) {
            case 'Programado': return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Programado</span>
            case 'En Ruta': return <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">En Ruta</span>
            case 'Completado': return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Completado</span>
            default: return <span className="px-2 py-1 bg-zinc-100 text-zinc-800 text-xs rounded-full">{estado}</span>
        }
    }

    if (loading) return <div>Cargando viajes...</div>

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-zinc-900">Ruta Única: Durango</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-zinc-800 text-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Viaje
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Chofer / Camión</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Salida</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Llegada</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Obs.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {viajes.map((v) => (
                            <tr key={v.id_viaje} className="hover:bg-zinc-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-zinc-900">
                                        {v.empleados?.nombre} {v.empleados?.apellido_paterno}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        Eco: {v.logistica_camiones?.numero_economico}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-zinc-900">{v.fecha_salida}</div>
                                    <div className="text-xs text-zinc-500">{v.hora_salida}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-zinc-900">{v.fecha_llegada || '-'}</div>
                                    <div className="text-xs text-zinc-500">{v.hora_llegada || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {getStatusBadge(v.estado)}
                                </td>
                                <td className="px-6 py-4 text-sm text-zinc-500 max-w-xs truncate">
                                    {v.observaciones || '-'}
                                </td>
                            </tr>
                        ))}
                        {viajes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-zinc-500 text-sm">
                                    No hay viajes registrados
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center">
                            <MapPin className="w-5 h-5 mr-2 text-amber-600" />
                            Programar Viaje a Durango
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Chofer</label>
                                    <select 
                                        required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.id_empleado}
                                        onChange={e => setFormData({...formData, id_empleado: e.target.value})}
                                    >
                                        <option value="">Seleccione...</option>
                                        {empleados.map(e => (
                                            <option key={e.id_empleado} value={e.id_empleado}>{e.nombre} {e.apellido_paterno}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Camión</label>
                                    <select 
                                        required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.id_camion}
                                        onChange={e => setFormData({...formData, id_camion: e.target.value})}
                                    >
                                        <option value="">Seleccione...</option>
                                        {camiones.map(c => (
                                            <option key={c.id_camion} value={c.id_camion}>Eco: {c.numero_economico}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha Salida</label>
                                    <input 
                                        type="date" required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.fecha_salida}
                                        onChange={e => setFormData({...formData, fecha_salida: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Hora Salida</label>
                                    <input 
                                        type="time" required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.hora_salida}
                                        onChange={e => setFormData({...formData, hora_salida: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha Llegada (Aprox/Real)</label>
                                    <input 
                                        type="date" 
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.fecha_llegada}
                                        onChange={e => setFormData({...formData, fecha_llegada: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Hora Llegada (Aprox/Real)</label>
                                    <input 
                                        type="time" 
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.hora_llegada}
                                        onChange={e => setFormData({...formData, hora_llegada: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Estado</label>
                                <select 
                                    className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                    value={formData.estado}
                                    onChange={e => setFormData({...formData, estado: e.target.value})}
                                >
                                    <option value="Programado">Programado</option>
                                    <option value="En Ruta">En Ruta</option>
                                    <option value="Completado">Completado</option>
                                    <option value="Cancelado">Cancelado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Observaciones</label>
                                <textarea 
                                    className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                    rows={2}
                                    value={formData.observaciones}
                                    onChange={e => setFormData({...formData, observaciones: e.target.value})}
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-200">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-zinc-800"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
