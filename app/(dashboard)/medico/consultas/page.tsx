'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Stethoscope, Plus, Search, FileText, Pill } from 'lucide-react'

export default function ConsultasPage() {
    const [consultas, setConsultas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)

    // Form data
    const [formData, setFormData] = useState({
        id_paciente: '',
        diagnostico: '',
        costo_consulta: 0,
        medicamentos_recetados: [] as any[]
    })

    const [pacientes, setPacientes] = useState<any[]>([])
    const [medicamentosCat, setMedicamentosCat] = useState<any[]>([])

    useEffect(() => {
        fetchConsultas()
        fetchCatalogos()
    }, [])

    const fetchCatalogos = async () => {
        const { data: pData } = await supabase.from('pacientes').select('*')
        if (pData) setPacientes(pData)

        const { data: mData } = await supabase.from('cat_medicamentos').select('*')
        if (mData) setMedicamentosCat(mData)
    }

    const fetchConsultas = async () => {
        const { data, error } = await supabase.from('consultas_medicas').select(`
            *,
            pacientes (nombre_completo, es_poblacion_general)
        `).order('fecha', { ascending: false })
        if (data) setConsultas(data)
        setLoading(false)
    }

    const handleAddMedicamento = () => {
        setFormData({
            ...formData,
            medicamentos_recetados: [...formData.medicamentos_recetados, { id_medicamento: '', cantidad: 1, costo_unitario: 0 }]
        })
    }

    const updateMedicamento = (index: number, field: string, value: any) => {
        const newMed = [...formData.medicamentos_recetados]
        newMed[index][field] = value
        
        // Auto-fill price if it's general population
        if (field === 'id_medicamento') {
            const med = medicamentosCat.find(m => m.id_medicamento === value)
            const pac = pacientes.find(p => p.id_paciente === formData.id_paciente)
            if (med && pac?.es_poblacion_general) {
                newMed[index].costo_unitario = med.precio_venta
            } else {
                newMed[index].costo_unitario = 0
            }
        }
        
        setFormData({ ...formData, medicamentos_recetados: newMed })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // 1. Insertar Consulta
        const { data: consultaData, error: consultaError } = await supabase.from('consultas_medicas').insert([{
            id_paciente: formData.id_paciente,
            diagnostico: formData.diagnostico,
            costo_consulta: formData.costo_consulta
        }]).select()

        if (consultaData && consultaData.length > 0 && formData.medicamentos_recetados.length > 0) {
            // 2. Insertar Dispensacion
            const dispPayload = formData.medicamentos_recetados.map(med => ({
                id_consulta: consultaData[0].id_consulta,
                id_medicamento: med.id_medicamento,
                cantidad: med.cantidad,
                costo_unitario: med.costo_unitario,
                costo_total: med.cantidad * med.costo_unitario
            }))

            await supabase.from('dispensacion_medicamentos').insert(dispPayload)
        }

        setShowForm(false)
        setFormData({ id_paciente: '', diagnostico: '', costo_consulta: 0, medicamentos_recetados: [] })
        fetchConsultas()
    }

    // Auto update consultation cost when patient changes
    const handlePacienteChange = (val: string) => {
        const pac = pacientes.find(p => p.id_paciente === val)
        setFormData({
            ...formData,
            id_paciente: val,
            costo_consulta: pac?.es_poblacion_general ? 200 : 0 // Ejemplo de costo base 200 para público general
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Stethoscope className="w-6 h-6 text-amber-500" />
                        Consultas y Recetas
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Registro de atención médica y dispensación de medicamentos</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-amber-500 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-400 transition-colors shadow-sm shadow-amber-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Consulta
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <h2 className="text-lg font-bold text-zinc-800">Registrar Consulta Médica</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1">Paciente</label>
                                <select 
                                    required
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                    value={formData.id_paciente}
                                    onChange={e => handlePacienteChange(e.target.value)}
                                >
                                    <option value="">Seleccione un paciente...</option>
                                    {pacientes.map(p => (
                                        <option key={p.id_paciente} value={p.id_paciente}>
                                            {p.nombre_completo} {p.es_poblacion_general ? '(Público)' : '(Trabajador/Benef)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1">Costo de Consulta ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                                    <input 
                                        type="number" step="0.01" min="0"
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 pl-8 pr-4 py-2"
                                        value={formData.costo_consulta}
                                        onChange={e => setFormData({...formData, costo_consulta: parseFloat(e.target.value)})}
                                        readOnly={!pacientes.find(p => p.id_paciente === formData.id_paciente)?.es_poblacion_general}
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Gratis para trabajadores y beneficiarios.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1">Diagnóstico / Motivo</label>
                                <textarea 
                                    required rows={3}
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 resize-none"
                                    value={formData.diagnostico}
                                    onChange={e => setFormData({...formData, diagnostico: e.target.value})}
                                    placeholder="Describa el diagnóstico o motivo de la consulta..."
                                />
                            </div>
                        </div>

                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                                    <Pill className="w-4 h-4 text-amber-500" />
                                    Receta Médica
                                </h3>
                                <button type="button" onClick={handleAddMedicamento} className="text-sm font-bold text-amber-600 hover:text-amber-700">
                                    + Agregar Medicamento
                                </button>
                            </div>
                            
                            {formData.medicamentos_recetados.length === 0 ? (
                                <p className="text-sm text-zinc-500 text-center py-4">No se han recetado medicamentos</p>
                            ) : (
                                <div className="space-y-3">
                                    {formData.medicamentos_recetados.map((med, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-zinc-200 shadow-sm">
                                            <select 
                                                className="flex-1 rounded-md border-zinc-200 text-sm py-1.5"
                                                value={med.id_medicamento}
                                                onChange={e => updateMedicamento(idx, 'id_medicamento', e.target.value)}
                                                required
                                            >
                                                <option value="">Seleccione...</option>
                                                {medicamentosCat.map(m => (
                                                    <option key={m.id_medicamento} value={m.id_medicamento}>{m.nombre}</option>
                                                ))}
                                            </select>
                                            <input 
                                                type="number" min="1" placeholder="Cant."
                                                className="w-20 rounded-md border-zinc-200 text-sm py-1.5"
                                                value={med.cantidad}
                                                onChange={e => updateMedicamento(idx, 'cantidad', parseInt(e.target.value))}
                                                required
                                            />
                                            {med.costo_unitario > 0 && (
                                                <span className="text-xs font-bold text-amber-600 w-16 text-right">
                                                    ${med.costo_unitario * med.cantidad}
                                                </span>
                                            )}
                                            <button 
                                                type="button" 
                                                onClick={() => setFormData({...formData, medicamentos_recetados: formData.medicamentos_recetados.filter((_, i) => i !== idx)})}
                                                className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {formData.medicamentos_recetados.some(m => m.costo_unitario > 0) && (
                                        <div className="text-right text-sm font-bold text-zinc-800 pt-2 border-t mt-2">
                                            Total Farmacia: ${formData.medicamentos_recetados.reduce((acc, m) => acc + (m.costo_unitario * m.cantidad), 0)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-zinc-100">
                        <button type="submit" className="bg-amber-500 text-black px-8 py-2.5 rounded-xl text-sm font-black hover:bg-amber-400">
                            Finalizar Consulta
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-800">Historial de Consultas</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Diagnóstico</th>
                                <th className="px-6 py-4">Costo Consulta</th>
                                <th className="px-6 py-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Cargando...</td></tr>
                            ) : consultas.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No hay consultas registradas</td></tr>
                            ) : (
                                consultas.map(c => (
                                    <tr key={c.id_consulta} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 text-zinc-600 font-medium">
                                            {new Date(c.fecha).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-zinc-800">{c.pacientes?.nombre_completo || 'Paciente Eliminado'}</div>
                                            <div className="text-xs text-zinc-500">{c.pacientes?.es_poblacion_general ? 'Público General' : 'Trabajador/Beneficiario'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 max-w-xs truncate" title={c.diagnostico}>
                                            {c.diagnostico}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.costo_consulta > 0 ? (
                                                <span className="text-amber-600 font-bold">${c.costo_consulta}</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">Gratis</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button className="text-amber-500 hover:text-amber-600 font-medium flex items-center gap-1">
                                                <FileText className="w-4 h-4" /> Ver Receta
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
