'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Heart, Plus, Search, Users, Trash2, ShieldAlert } from 'lucide-react'

export default function PacientesPage() {
    const [pacientes, setPacientes] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [formData, setFormData] = useState({ 
        nombre_completo: '', 
        es_poblacion_general: false, 
        parentesco: 'Ella misma',
        id_empleado: '',
        acompanante: ''
    })

    useEffect(() => {
        fetchPacientes()
        fetchEmpleados()
    }, [])

    const fetchPacientes = async () => {
        setLoading(true)
        const { data } = await supabase.from('pacientes').select('*').order('nombre_completo')
        if (data) setPacientes(data)
        setLoading(false)
    }

    const fetchEmpleados = async () => {
        const { data } = await supabase
            .from('empleados')
            .select('id_empleado, nombre, apellido_paterno')
            .order('nombre')
        if (data) setEmpleados(data)
    }

    const handleEmpleadoChange = (empId: string) => {
        const emp = empleados.find(e => e.id_empleado === empId)
        if (emp && formData.parentesco === 'Ella misma') {
            setFormData({
                ...formData,
                id_empleado: empId,
                nombre_completo: `${emp.nombre} ${emp.apellido_paterno}`.toUpperCase()
            })
        } else {
            setFormData({
                ...formData,
                id_empleado: empId
            })
        }
    }

    const handleParentescoChange = (parentescoVal: string) => {
        if (parentescoVal === 'Ella misma' && formData.id_empleado) {
            const emp = empleados.find(e => e.id_empleado === formData.id_empleado)
            if (emp) {
                setFormData({
                    ...formData,
                    parentesco: parentescoVal,
                    nombre_completo: `${emp.nombre} ${emp.apellido_paterno}`.toUpperCase()
                })
                return
            }
        }
        setFormData({
            ...formData,
            parentesco: parentescoVal
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.from('pacientes').insert([
            {
                nombre_completo: formData.nombre_completo.toUpperCase(),
                es_poblacion_general: formData.es_poblacion_general,
                parentesco: formData.es_poblacion_general ? null : formData.parentesco,
                id_empleado: formData.es_poblacion_general ? null : (formData.id_empleado || null),
                acompanante: formData.acompanante ? formData.acompanante.toUpperCase() : null
            }
        ])
        if (!error) {
            setShowForm(false)
            setFormData({ nombre_completo: '', es_poblacion_general: false, parentesco: 'Ella misma', id_empleado: '', acompanante: '' })
            fetchPacientes()
        } else {
            alert('Error al guardar el paciente: ' + error.message)
        }
    }

    const deletePaciente = async (id: string, nombre: string) => {
        if (!confirm(`¿Está seguro de eliminar al paciente "${nombre}"?`)) return
        const { error } = await supabase.from('pacientes').delete().eq('id_paciente', id)
        if (!error) {
            fetchPacientes()
        } else {
            alert('No se pudo eliminar al paciente. Es posible que esté asociado a consultas o pases existentes.')
        }
    }

    const filteredPacientes = pacientes.filter(p => 
        (p.nombre_completo || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Heart className="w-6 h-6 text-amber-500" />
                        Pacientes y Beneficiarios
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Directorio de población general y beneficiarios</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Paciente
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-800 border-b pb-2">Registrar Paciente</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre Completo del Paciente</label>
                            <input 
                                required type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                value={formData.nombre_completo}
                                onChange={e => setFormData({...formData, nombre_completo: e.target.value})}
                            />
                        </div>
                        <div className="flex items-center mt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                    checked={formData.es_poblacion_general}
                                    onChange={e => setFormData({...formData, es_poblacion_general: e.target.checked})}
                                />
                                <span className="text-xs font-bold text-zinc-700">Es Población General (No Trabajador/Beneficiario)</span>
                            </label>
                        </div>
                        {!formData.es_poblacion_general && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Trabajador Relacionado</label>
                                    <select 
                                        required
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 font-bold text-xs"
                                        value={formData.id_empleado}
                                        onChange={e => handleEmpleadoChange(e.target.value)}
                                    >
                                        <option value="">Seleccione trabajador...</option>
                                        {empleados.map(emp => (
                                            <option key={emp.id_empleado} value={emp.id_empleado}>
                                                {emp.nombre} {emp.apellido_paterno}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Parentesco con Trabajador</label>
                                    <select 
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 font-bold text-xs"
                                        value={formData.parentesco}
                                        onChange={e => handleParentescoChange(e.target.value)}
                                    >
                                        <option value="Ella misma">El mismo / Ella misma (Trabajador)</option>
                                        <option value="Esposo(a)">Esposo(a)</option>
                                        <option value="Hijo(a)">Hijo(a)</option>
                                        <option value="Padre/Madre">Padre/Madre</option>
                                        <option value="Acompañante">Acompañante Médico</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Acompañante Habitual (Opcional)</label>
                            <input 
                                type="text"
                                placeholder="Ej. MARIA ARREOLA (MADRE)"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                value={formData.acompanante}
                                onChange={e => setFormData({...formData, acompanante: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-amber-500 text-black px-6 py-2 rounded-xl text-sm font-bold hover:bg-amber-400">
                            Guardar Paciente
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 flex items-center bg-zinc-50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text"
                            placeholder="Buscar paciente por nombre..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border-zinc-200 bg-white text-sm"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Nombre del Paciente</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Parentesco</th>
                                <th className="px-6 py-4">Acompañante Habitual</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Cargando...</td></tr>
                            ) : filteredPacientes.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No se encontraron pacientes</td></tr>
                            ) : (
                                filteredPacientes.map(pac => (
                                    <tr key={pac.id_paciente} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-zinc-800 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            {pac.nombre_completo}
                                        </td>
                                        <td className="px-6 py-4">
                                            {pac.es_poblacion_general ? (
                                                <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">Población General</span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">Beneficiario</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600">{pac.es_poblacion_general ? '-' : (pac.parentesco || 'Titular')}</td>
                                        <td className="px-6 py-4 font-bold text-xs text-zinc-700">{pac.acompanante || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => deletePaciente(pac.id_paciente, pac.nombre_completo)}
                                                className="text-zinc-400 hover:text-rose-600 font-medium text-xs flex items-center gap-1 ml-auto"
                                                title="Eliminar Paciente"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
