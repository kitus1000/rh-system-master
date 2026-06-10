'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Heart, Plus, Search, Users } from 'lucide-react'

export default function PacientesPage() {
    const [pacientes, setPacientes] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({ 
        nombre_completo: '', 
        es_poblacion_general: false, 
        parentesco: 'Esposo(a)',
        id_empleado: ''
    })

    useEffect(() => {
        fetchPacientes()
        fetchEmpleados()
    }, [])

    const fetchPacientes = async () => {
        const { data, error } = await supabase.from('pacientes').select(`
            *,
            empleados (nombre, apellido_paterno, apellido_materno)
        `).order('nombre_completo')
        if (data) setPacientes(data)
        setLoading(false)
    }

    const fetchEmpleados = async () => {
        const { data } = await supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, apellido_materno').order('nombre')
        if (data) setEmpleados(data)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.from('pacientes').insert([
            {
                nombre_completo: formData.nombre_completo,
                es_poblacion_general: formData.es_poblacion_general,
                parentesco: formData.es_poblacion_general ? null : formData.parentesco,
                id_empleado: formData.es_poblacion_general ? null : formData.id_empleado
            }
        ])
        if (!error) {
            setShowForm(false)
            setFormData({ nombre_completo: '', es_poblacion_general: false, parentesco: 'Esposo(a)', id_empleado: '' })
            fetchPacientes()
        } else {
            alert('Error al guardar el paciente. Verifique los datos.')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Heart className="w-6 h-6 text-amber-500" />
                        Pacientes y Beneficiarios
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Directorio de población general y beneficiarios vinculados a empleados</p>
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
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre Completo</label>
                            <input 
                                required type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
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
                                    onChange={e => setFormData({...formData, es_poblacion_general: e.target.checked, id_empleado: ''})}
                                />
                                <span className="text-sm font-medium text-zinc-700">Es Población General (No Trabajador/Beneficiario)</span>
                            </label>
                        </div>

                        {!formData.es_poblacion_general && (
                            <>
                                <div className="col-span-1 lg:col-span-2">
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Trabajador Titular (Empleado)</label>
                                    <select 
                                        required
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                        value={formData.id_empleado}
                                        onChange={e => setFormData({...formData, id_empleado: e.target.value})}
                                    >
                                        <option value="">Seleccione el trabajador de la mina...</option>
                                        {empleados.map(emp => (
                                            <option key={emp.id_empleado} value={emp.id_empleado}>
                                                {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Parentesco con el Trabajador</label>
                                    <select 
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                        value={formData.parentesco}
                                        onChange={e => setFormData({...formData, parentesco: e.target.value})}
                                    >
                                        <option value="Esposo(a)">Esposo(a)</option>
                                        <option value="Hijo(a)">Hijo(a)</option>
                                        <option value="Padre/Madre">Padre/Madre</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </>
                        )}
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
                            placeholder="Buscar paciente o beneficiario..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border-zinc-200 bg-white"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Nombre del Paciente</th>
                                <th className="px-6 py-4">Tipo de Paciente</th>
                                <th className="px-6 py-4">Trabajador Titular</th>
                                <th className="px-6 py-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Cargando...</td></tr>
                            ) : pacientes.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No hay pacientes registrados</td></tr>
                            ) : (
                                pacientes.map(pac => (
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
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">Beneficiario: {pac.parentesco}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {!pac.es_poblacion_general && pac.empleados ? (
                                                <div className="font-medium text-zinc-700">
                                                    {pac.empleados.nombre} {pac.empleados.apellido_paterno}
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400 italic">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button className="text-zinc-400 hover:text-amber-500 font-medium">Ver Historial</button>
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
