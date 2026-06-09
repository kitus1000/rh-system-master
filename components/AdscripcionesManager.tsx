'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Save, X } from 'lucide-react'

export function AdscripcionesManager({ idEmpleado, isReadOnly = false }: { idEmpleado: string, isReadOnly?: boolean }) {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    // Catalogs
    const [deptos, setDeptos] = useState<any[]>([])
    const [puestos, setPuestos] = useState<any[]>([])
    const [unidades, setUnidades] = useState<any[]>([])

    // New Record State
    const [formData, setFormData] = useState({
        fecha_inicio: new Date().toISOString().split('T')[0],
        id_unidad: '',
        id_departamento: '',
        id_puesto: '',
        salario_diario: '',
        es_jefe: false
    })

    useEffect(() => {
        fetchHistory()
        fetchCatalogs()
    }, [])

    async function fetchHistory() {
        const { data } = await supabase
            .from('empleado_adscripciones')
            .select(`
        *,
        cat_departamentos(departamento),
        cat_puestos(puesto),
        cat_unidades_trabajo(unidad_trabajo)
      `)
            .eq('id_empleado', idEmpleado)
            .order('fecha_inicio', { ascending: false })

        setHistory(data || [])
        setLoading(false)
    }

    async function fetchCatalogs() {
        supabase.from('cat_departamentos').select('*').then(res => setDeptos(res.data || []))
        supabase.from('cat_puestos').select('*').then(res => setPuestos(res.data || []))
        supabase.from('cat_unidades_trabajo').select('*').then(res => setUnidades(res.data || []))
    }

    async function handleSave() {
        if (!formData.id_unidad || !formData.id_departamento || !formData.id_puesto) {
            alert("Favor de seleccionar Unidad, Departamento y Puesto")
            return
        }

        try {
            // 1. Close previous active record (if needed logic exists, currently simplified)

            // 2. Insert Adscription
            const { error: adsError } = await supabase.from('empleado_adscripciones').insert([{
                id_empleado: idEmpleado,
                fecha_inicio: formData.fecha_inicio,
                id_unidad: formData.id_unidad,
                id_departamento: formData.id_departamento,
                id_puesto: formData.id_puesto,
                es_jefe: formData.es_jefe
            }])
            if (adsError) throw adsError

            // 3. Insert Salary if provided
            if (formData.salario_diario) {
                const { error: salError } = await supabase.from('empleado_salarios').insert([{
                    id_empleado: idEmpleado,
                    fecha_inicio_vigencia: formData.fecha_inicio,
                    salario_diario: formData.salario_diario,
                    motivo: 'Asignación Inicial/Cambio'
                }])
                if (salError) console.error("Error salary", salError)
            }

            setIsCreating(false)
            fetchHistory()
        } catch (e: any) {
            console.error(e)
            if (e.code === '23505') {
                alert("Error: Ya existe un registro para esta fecha. Por favor selecciona una fecha diferente.")
            } else {
                alert("Error al guardar: " + e.message)
            }
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-zinc-900">Historial de Puestos y Ubicación</h3>
                {!isCreating && !isReadOnly && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center text-sm bg-black text-white px-3 py-2 rounded-md hover:bg-zinc-800"
                    >
                        <Plus className="w-4 h-4 mr-2 text-amber-500" />
                        Nueva Asignación
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg mb-6 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-zinc-700 mb-4 border-b pb-2">Registrar Movimiento</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Fecha Inicio</label>
                            <input type="date" className="w-full text-sm border-zinc-300 rounded-md text-zinc-900" value={formData.fecha_inicio} onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Unidad de Trabajo</label>
                            <select className="w-full text-sm border-zinc-300 rounded-md text-zinc-900" value={formData.id_unidad} onChange={e => setFormData({ ...formData, id_unidad: e.target.value })}>
                                <option value="">-- Seleccionar --</option>
                                {unidades.map(u => <option key={u.id_unidad} value={u.id_unidad}>{u.unidad_trabajo}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Departamento</label>
                            <select className="w-full text-sm border-zinc-300 rounded-md text-zinc-900" value={formData.id_departamento} onChange={e => setFormData({ ...formData, id_departamento: e.target.value })}>
                                <option value="">-- Seleccionar --</option>
                                {deptos.map(d => <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Puesto</label>
                            <select className="w-full text-sm border-zinc-300 rounded-md text-zinc-900" value={formData.id_puesto} onChange={e => setFormData({ ...formData, id_puesto: e.target.value })}>
                                <option value="">-- Seleccionar --</option>
                                {puestos.map(p => <option key={p.id_puesto} value={p.id_puesto}>{p.puesto}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Nuevo Salario Diario (Opcional)</label>
                            <input type="number" className="w-full text-sm border-zinc-300 rounded-md text-zinc-900" placeholder="0.00" value={formData.salario_diario} onChange={e => setFormData({ ...formData, salario_diario: e.target.value })} />
                        </div>
                        <div className="flex items-end pb-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                    checked={formData.es_jefe}
                                    onChange={e => setFormData({ ...formData, es_jefe: e.target.checked })}
                                />
                                <span className="text-sm font-medium text-zinc-700">¿Es Jefe?</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                        <button onClick={() => setIsCreating(false)} className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
                        <button onClick={handleSave} className="px-4 py-2 text-sm bg-amber-500 text-white font-medium rounded-md hover:bg-amber-600 shadow-sm">Guardar Cambios</button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-md border border-zinc-200 overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Periodo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Puesto</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Ubicación</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {!loading && history.length === 0 && (
                            <tr><td colSpan={3} className="p-4 text-center text-sm text-zinc-400">No hay historial registrado.</td></tr>
                        )}
                        {history.map((h) => (
                            <tr key={h.fecha_inicio + h.id_empleado}>
                                <td className="px-4 py-3 text-sm text-zinc-900 border-l-4 border-amber-500">
                                    {h.fecha_inicio} <span className="text-zinc-400 mx-1">➜</span> {h.fecha_fin || 'Vigente'}
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-900 font-medium">
                                    {h.cat_puestos?.puesto}
                                    {h.es_jefe && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                            Jefe
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-500">
                                    {h.cat_departamentos?.departamento} <br />
                                    <span className="text-xs text-zinc-400">{h.cat_unidades_trabajo?.unidad_trabajo}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
