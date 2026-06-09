'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Save, X, Calendar, Clock, Briefcase } from 'lucide-react'

export function TurnoRolManager({ idEmpleado, isReadOnly = false }: { idEmpleado: string, isReadOnly?: boolean }) {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    // Catalogs
    const [turnos, setTurnos] = useState<any[]>([])
    const [roles, setRoles] = useState<any[]>([])

    // Form State
    const [tipoAsignacion, setTipoAsignacion] = useState<'turno' | 'rol'>('turno')
    const [formData, setFormData] = useState({
        fecha_inicio: new Date().toISOString().split('T')[0],
        id_turno: '',
        id_tipo_rol: ''
    })

    useEffect(() => {
        fetchHistory()
        fetchCatalogs()
    }, [])

    async function fetchCatalogs() {
        const { data: dataTurnos } = await supabase.from('turnos').select('*').eq('activo', true)
        const { data: dataRoles } = await supabase.from('cat_tipos_rol').select('*').eq('activo', true)
        setTurnos(dataTurnos || [])
        setRoles(dataRoles || [])
    }

    async function fetchHistory() {
        setLoading(true)
        // Fetch Turnos History
        const { data: dataTurnos } = await supabase
            .from('empleado_turnos')
            .select('*, turnos(nombre)')
            .eq('id_empleado', idEmpleado)

        // Fetch Roles History
        const { data: dataRoles } = await supabase
            .from('empleado_roles')
            .select('*, cat_tipos_rol(tipo_rol, dias_trabajo, dias_descanso)')
            .eq('id_empleado', idEmpleado)

        // Combine and sort by fecha_inicio DESC
        const combined = [
            ...(dataTurnos || []).map((t: any) => ({ ...t, tipo: 'turno', itemName: t.turnos?.nombre })),
            ...(dataRoles || []).map((r: any) => ({ ...r, tipo: 'rol', itemName: `Rol ${r.cat_tipos_rol?.tipo_rol} (${r.cat_tipos_rol?.dias_trabajo}x${r.cat_tipos_rol?.dias_descanso})` }))
        ].sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())

        setHistory(combined)
        setLoading(false)
    }

    async function handleSave() {
        if (tipoAsignacion === 'turno' && !formData.id_turno) {
            alert("Favor de seleccionar un Turno Fijo")
            return
        }
        if (tipoAsignacion === 'rol' && !formData.id_tipo_rol) {
            alert("Favor de seleccionar un Rol")
            return
        }
        if (!formData.fecha_inicio) {
            alert("La fecha de inicio es requerida")
            return
        }

        try {
            const nuevaFechaInicio = new Date(formData.fecha_inicio)
            // Calculamos fecha_fin para los vigentes (un día antes de la nueva fecha_inicio)
            const fechaFinStr = new Date(nuevaFechaInicio.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            // 1. Cerrar cualquier Turno Vigente
            const { data: turnosVigentes } = await supabase
                .from('empleado_turnos')
                .select('id')
                .eq('id_empleado', idEmpleado)
                .is('fecha_fin', null)
            
            if (turnosVigentes && turnosVigentes.length > 0) {
                for (const t of turnosVigentes) {
                    await supabase.from('empleado_turnos').update({ fecha_fin: fechaFinStr }).eq('id', t.id)
                }
            }

            // 2. Cerrar cualquier Rol Vigente
            // La primary key de empleado_roles es (id_empleado, fecha_inicio), así que necesitamos match by those
            const { data: rolesVigentes } = await supabase
                .from('empleado_roles')
                .select('id_empleado, fecha_inicio')
                .eq('id_empleado', idEmpleado)
                .is('fecha_fin', null)

            if (rolesVigentes && rolesVigentes.length > 0) {
                for (const r of rolesVigentes) {
                    await supabase.from('empleado_roles').update({ fecha_fin: fechaFinStr })
                        .eq('id_empleado', r.id_empleado)
                        .eq('fecha_inicio', r.fecha_inicio)
                }
            }

            // 3. Insertar nueva asignación
            if (tipoAsignacion === 'turno') {
                const { error } = await supabase.from('empleado_turnos').insert({
                    id_empleado: idEmpleado,
                    id_turno: formData.id_turno,
                    fecha_inicio: formData.fecha_inicio
                })
                if (error) throw error

                // Actualizar tabla empleados base (quick lookup)
                await supabase.from('empleados').update({ id_turno: formData.id_turno }).eq('id_empleado', idEmpleado)
            } else {
                const { error } = await supabase.from('empleado_roles').insert({
                    id_empleado: idEmpleado,
                    id_tipo_rol: formData.id_tipo_rol,
                    fecha_inicio: formData.fecha_inicio
                })
                if (error) throw error

                // Actualizar tabla empleados base: limpiamos el id_turno porque ahora usa un rol
                await supabase.from('empleados').update({ id_turno: null }).eq('id_empleado', idEmpleado)
            }

            setIsCreating(false)
            fetchHistory()
        } catch (e: any) {
            console.error(e)
            alert("Error al guardar: " + e.message)
        }
    }

    const handleDelete = async (item: any) => {
        if (!confirm('¿Estás seguro de eliminar este registro histórico? Esto no se puede deshacer.')) return
        try {
            if (item.tipo === 'turno') {
                await supabase.from('empleado_turnos').delete().eq('id', item.id)
            } else {
                await supabase.from('empleado_roles').delete()
                    .eq('id_empleado', item.id_empleado)
                    .eq('fecha_inicio', item.fecha_inicio)
            }
            fetchHistory()
        } catch (error) {
            console.error(error)
            alert("Error al eliminar")
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-zinc-900">Historial de Turnos y Roles</h3>
                {!isReadOnly && !isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-black hover:bg-zinc-800"
                    >
                        <Plus className="-ml-1 mr-1 h-4 w-4" />
                        Nueva Asignación
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-zinc-50 p-4 rounded-md border border-zinc-200 mb-6 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-zinc-900">Programar Nueva Asignación</h4>
                        <button onClick={() => setIsCreating(false)} className="text-zinc-400 hover:text-zinc-900">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Primer Día de Trabajo (Fecha de Inicio) *</label>
                            <input
                                type="date"
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border text-black bg-white"
                                value={formData.fecha_inicio}
                                onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">
                                A partir de este día comenzará a contar la proyección de trabajo/descanso (en caso de Rol) o la asistencia base (en caso de Turno).
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo de Esquema *</label>
                            <select
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border text-black bg-white"
                                value={tipoAsignacion}
                                onChange={e => {
                                    setTipoAsignacion(e.target.value as 'turno' | 'rol')
                                    setFormData({ ...formData, id_turno: '', id_tipo_rol: '' })
                                }}
                            >
                                <option value="turno">Turno Fijo (Lunes a Viernes / Sábado)</option>
                                <option value="rol">Rol Rotativo (Ej. 14x14, 20x10)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">
                                {tipoAsignacion === 'turno' ? 'Seleccionar Turno *' : 'Seleccionar Rol *'}
                            </label>
                            {tipoAsignacion === 'turno' ? (
                                <select
                                    className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border text-black bg-white"
                                    value={formData.id_turno}
                                    onChange={e => setFormData({ ...formData, id_turno: e.target.value })}
                                >
                                    <option value="">Seleccione...</option>
                                    {turnos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                </select>
                            ) : (
                                <select
                                    className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border text-black bg-white"
                                    value={formData.id_tipo_rol}
                                    onChange={e => setFormData({ ...formData, id_tipo_rol: e.target.value })}
                                >
                                    <option value="">Seleccione...</option>
                                    {roles.map(r => <option key={r.id_tipo_rol} value={r.id_tipo_rol}>{r.tipo_rol} ({r.dias_trabajo}x{r.dias_descanso})</option>)}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end space-x-2">
                        <button
                            onClick={handleSave}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-black hover:bg-zinc-800"
                        >
                            <Save className="-ml-1 mr-2 h-4 w-4" />
                            Guardar Asignación
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-4 text-sm text-zinc-500">Cargando historial...</div>
            ) : history.length === 0 ? (
                <div className="text-center py-8 bg-zinc-50 border border-zinc-200 border-dashed rounded-lg">
                    <p className="text-sm text-zinc-500">No hay turnos ni roles registrados.</p>
                </div>
            ) : (
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Tipo</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Asignación</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Inicio</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Fin</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Estado</th>
                                {!isReadOnly && <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-zinc-200">
                            {history.map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        {item.tipo === 'turno' ? (
                                            <span className="inline-flex items-center text-blue-600"><Clock className="w-4 h-4 mr-1"/> Turno</span>
                                        ) : (
                                            <span className="inline-flex items-center text-amber-600"><Briefcase className="w-4 h-4 mr-1"/> Rol</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                                        {item.itemName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        {item.fecha_inicio}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        {item.fecha_fin || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {!item.fecha_fin ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Vigente
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">
                                                Finalizado
                                            </span>
                                        )}
                                    </td>
                                    {!isReadOnly && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-900">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
