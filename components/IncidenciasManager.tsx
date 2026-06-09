'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { addDays, format, differenceInDays, parseISO } from 'date-fns'

export function IncidenciasManager({ idEmpleado, isReadOnly = false }: { idEmpleado: string, isReadOnly?: boolean }) {
    const [incidents, setIncidents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [tipos, setTipos] = useState<any[]>([])

    const [formData, setFormData] = useState({
        fecha_incidencia: new Date().toISOString().split('T')[0],
        id_tipo_incidencia: '',
        dias: 1,
        comentarios: ''
    })

    useEffect(() => {
        fetchIncidents()
        fetchTipos()
    }, [])

    async function fetchIncidents() {
        const { data } = await supabase
            .from('empleado_incidencias')
            .select(`
                *,
                cat_tipos_incidencia(tipo_incidencia)
            `)
            .eq('id_empleado', idEmpleado)
            .order('fecha_inicio', { ascending: false })

        setIncidents(data || [])
        setLoading(false)
    }

    async function fetchTipos() {
        const { data } = await supabase.from('cat_tipos_incidencia').select('*').eq('activo', true)
        setTipos(data || [])
    }

    async function handleSave() {
        if (!formData.id_tipo_incidencia) return alert('Seleccione un tipo')

        try {
            // Calculate end date based on duration
            const startDate = parseISO(formData.fecha_incidencia)
            const endDate = addDays(startDate, formData.dias - 1)

            const { error } = await supabase.from('empleado_incidencias').insert([{
                id_empleado: idEmpleado,
                id_tipo_incidencia: formData.id_tipo_incidencia,
                fecha_inicio: formData.fecha_incidencia,
                fecha_fin: format(endDate, 'yyyy-MM-dd'),
                comentarios: formData.comentarios
            }])

            if (error) throw error

            setIsCreating(false)
            fetchIncidents()
            // Reset form (keep date)
            setFormData({ ...formData, comentarios: '', id_tipo_incidencia: '', dias: 1 })
        } catch (e: any) {
            alert(e.message)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta incidencia?')) return

        // Authorization Check
        const pin = prompt('AUTORIZACIÓN REQUERIDA: Ingrese clave de Jefe de RH para eliminar:')
        if (pin !== 'RH2026') {
            return alert('CLAVE INCORRECTA. No tiene permiso para eliminar esta incidencia.')
        }

        const { error } = await supabase.from('empleado_incidencias').delete().eq('id_incidencia', id)
        if (!error) fetchIncidents()
    }
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-zinc-900">Registro de Incidencias</h3>
                <div className="flex gap-2">
                    <button
                        onClick={fetchIncidents}
                        className="flex items-center text-sm bg-white border border-zinc-200 text-zinc-600 px-3 py-2 rounded-md hover:bg-zinc-50 transition-colors"
                        title="Actualizar lista"
                    >
                        Actualizar
                    </button>
                    {!isCreating && !isReadOnly && (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center text-sm bg-black text-white px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2 text-amber-500" />
                            Nueva Incidencia
                        </button>
                    )}
                </div>
            </div>

            {isCreating && (
                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg mb-6 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-zinc-700 mb-4 border-b pb-2">Registrar Faltas / Incapacidades</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Fecha</label>
                            <input
                                type="date"
                                className="w-full text-sm border-zinc-300 rounded-md text-zinc-900 bg-white focus:ring-amber-500 focus:border-amber-500"
                                value={formData.fecha_incidencia}
                                onChange={e => setFormData({ ...formData, fecha_incidencia: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Tipo Incidencia</label>
                            {tipos.length > 0 ? (
                                <select
                                    className="w-full text-sm border-zinc-300 rounded-md text-zinc-900 bg-white focus:ring-amber-500 focus:border-amber-500"
                                    value={formData.id_tipo_incidencia}
                                    onChange={e => setFormData({ ...formData, id_tipo_incidencia: e.target.value })}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {tipos.map(t => (
                                        <option key={t.id_tipo_incidencia} value={t.id_tipo_incidencia}>{t.tipo_incidencia}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-xs text-red-500 border border-red-200 bg-red-50 p-2 rounded">
                                    No hay tipos registrados. <a href="/catalogos" className="underline font-bold" target="_blank">Ir a Catálogos</a>
                                </div>
                            )}
                            {tipos.length > 0 && (
                                <div className="mt-1 text-[10px] text-zinc-400 text-right">
                                    ¿No encuentras el tipo? <a href="/catalogos" target="_blank" className="underline hover:text-zinc-600">Administrar Catálogos</a>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Días</label>
                            <input
                                type="number"
                                className="w-full text-sm border-zinc-300 rounded-md text-zinc-900 bg-white focus:ring-amber-500 focus:border-amber-500"
                                value={formData.dias}
                                onChange={e => setFormData({ ...formData, dias: parseInt(e.target.value) })}
                                min={1}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Comentarios</label>
                            <input
                                type="text"
                                className="w-full text-sm border-zinc-300 rounded-md text-zinc-900 bg-white focus:ring-amber-500 focus:border-amber-500"
                                placeholder="Detalles adicionales..."
                                value={formData.comentarios}
                                onChange={e => setFormData({ ...formData, comentarios: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                        <button onClick={() => setIsCreating(false)} className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
                        <button onClick={handleSave} className="px-4 py-2 text-sm bg-amber-500 text-white font-medium rounded-md hover:bg-amber-600 shadow-sm">Guardar</button>
                    </div>
                </div>
            )
            }

            <div className="bg-white rounded-md border border-zinc-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Fecha</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Días</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Detalle</th>
                            <th className="px-4 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {!loading && incidents.length === 0 && (
                            <tr><td colSpan={5} className="p-4 text-center text-sm text-zinc-400">No hay incidencias registradas.</td></tr>
                        )}
                        {incidents.map((inc) => {
                            let diasCalc = 1;
                            try {
                                diasCalc = differenceInDays(parseISO(inc.fecha_fin), parseISO(inc.fecha_inicio)) + 1
                            } catch (e) {
                                diasCalc = 1
                            }
                            return (
                                <tr key={inc.id_incidencia} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-4 py-3 text-sm text-zinc-900 whitespace-nowrap">
                                        {inc.fecha_inicio} <span className="text-zinc-400 text-xs">al</span> {inc.fecha_fin}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-amber-700">
                                        {inc.cat_tipos_incidencia?.tipo_incidencia || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-zinc-900">{diasCalc}</td>
                                    <td className="px-4 py-3 text-sm text-zinc-500 truncate max-w-xs">{inc.comentarios || '-'}</td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        <button onClick={() => handleDelete(inc.id_incidencia)} className="text-zinc-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    )
}
