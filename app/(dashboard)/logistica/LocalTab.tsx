'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react'

export default function LocalTab() {
    const [asignaciones, setAsignaciones] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [camiones, setCamiones] = useState<any[]>([])
    const [puntos, setPuntos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        id_empleado: '',
        id_camion: '',
        id_punto: '',
        turno: 'Día',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: new Date().toISOString().split('T')[0],
        hora_salida: '',
        hora_llegada: '',
        sentido: 'Ida',
        observaciones: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        fetchAsignaciones()
    }, [fechaFiltro])

    const fetchData = async () => {
        try {
            const [empleadosRes, camionesRes, puntosRes] = await Promise.all([
                supabase.from('empleados').select('id_empleado, nombre, apellido_paterno').eq('estado_empleado', 'Activo').order('nombre'),
                supabase.from('logistica_camiones').select('*').eq('activo', true),
                supabase.from('logistica_puntos_mina').select('*').eq('activo', true)
            ])
            
            setEmpleados(empleadosRes.data || [])
            setCamiones(camionesRes.data || [])
            setPuntos(puntosRes.data || [])
        } catch (error) {
            console.error('Error fetching catalogos locales', error)
        }
    }

    const fetchAsignaciones = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('logistica_local_asignaciones')
                .select(`
                    *,
                    empleados(nombre, apellido_paterno),
                    logistica_camiones(numero_economico),
                    logistica_puntos_mina(nombre_punto)
                `)
                .lte('fecha_inicio', fechaFiltro)
                .gte('fecha_fin', fechaFiltro)
                .order('turno')
                .order('creado_el', { ascending: false })

            if (error) throw error
            setAsignaciones(data || [])
        } catch (error) {
            console.error('Error fetching asignaciones', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('logistica_local_asignaciones').insert([formData])
            if (error) throw error

            setIsModalOpen(false)
            setFormData({
                ...formData,
                id_empleado: '', id_camion: '', id_punto: '', hora_salida: '', hora_llegada: '', observaciones: ''
                // Mantenemos 'sentido' y fechas iguales para facilitar la carga rápida
            })
            if (fechaFiltro >= formData.fecha_inicio && fechaFiltro <= formData.fecha_fin) {
                fetchAsignaciones()
            }
        } catch (error) {
            console.error('Error saving', error)
            alert('Error al guardar asignación')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta asignación?')) return
        try {
            const { error } = await supabase.from('logistica_local_asignaciones').delete().eq('id_asignacion', id)
            if (error) throw error
            fetchAsignaciones()
        } catch (error) {
            console.error('Error deleting', error)
            alert('Error al eliminar')
        }
    }

    const turnos = ['Primera (Día)', 'Segunda (Tarde)', 'Tercera (Noche)']

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border border-zinc-300 shadow-sm">
                    <CalendarIcon className="w-5 h-5 text-zinc-500" />
                    <input 
                        type="date"
                        className="border-none focus:ring-0 text-sm p-0 m-0 w-32 font-medium text-zinc-900"
                        value={fechaFiltro}
                        onChange={(e) => setFechaFiltro(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => {
                        setFormData({...formData, fecha_inicio: fechaFiltro, fecha_fin: fechaFiltro})
                        setIsModalOpen(true)
                    }}
                    className="flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-zinc-800 text-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Asignación
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-zinc-500">Cargando...</div>
                ) : (
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Sentido</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Turno</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Periodo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Punto en Mina</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Horario</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Chofer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Camión</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {asignaciones.map((a) => (
                                <tr key={a.id_asignacion} className="hover:bg-zinc-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${a.sentido === 'Vuelta' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {a.sentido || 'Ida'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">
                                            {a.turno}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-zinc-500">
                                        Del {a.fecha_inicio} <br /> al {a.fecha_fin}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                                        {a.logistica_puntos_mina?.nombre_punto}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-zinc-900">{a.hora_salida || '--:--'} - {a.hora_llegada || '--:--'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        {a.empleados?.nombre} {a.empleados?.apellido_paterno}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        Eco: {a.logistica_camiones?.numero_economico}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleDelete(a.id_asignacion)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {asignaciones.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 text-sm">
                                        No hay rotaciones asignadas para este día.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Programar Viaje (Local)</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 pb-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Día de Inicio</label>
                                    <input 
                                        type="date" required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.fecha_inicio}
                                        onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Día de Finalización</label>
                                    <input 
                                        type="date" required min={formData.fecha_inicio}
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.fecha_fin}
                                        onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Turno</label>
                                    <select 
                                        required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.turno}
                                        onChange={e => setFormData({...formData, turno: e.target.value})}
                                    >
                                        <option value="">Seleccione...</option>
                                        {turnos.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Sentido</label>
                                    <select 
                                        required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.sentido}
                                        onChange={e => setFormData({...formData, sentido: e.target.value})}
                                    >
                                        <option value="Ida">De Ida</option>
                                        <option value="Vuelta">De Regreso</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Hora Estimada Salida</label>
                                    <input 
                                        type="time" required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.hora_salida}
                                        onChange={e => setFormData({...formData, hora_salida: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Hora Estimada Llegada</label>
                                    <input 
                                        type="time" required
                                        className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                        value={formData.hora_llegada}
                                        onChange={e => setFormData({...formData, hora_llegada: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Punto Estratégico (Mina)</label>
                                <select 
                                    required
                                    className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                                    value={formData.id_punto}
                                    onChange={e => setFormData({...formData, id_punto: e.target.value})}
                                >
                                    <option value="">Seleccione...</option>
                                    {puntos.map(p => <option key={p.id_punto} value={p.id_punto}>{p.nombre_punto}</option>)}
                                </select>
                            </div>

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
                                        {empleados.map(e => <option key={e.id_empleado} value={e.id_empleado}>{e.nombre} {e.apellido_paterno}</option>)}
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
                                        {camiones.map(c => <option key={c.id_camion} value={c.id_camion}>Eco: {c.numero_economico}</option>)}
                                    </select>
                                </div>
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
                                    Guardar Asignación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
