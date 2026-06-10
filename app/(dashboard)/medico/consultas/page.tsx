'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Stethoscope, Plus, Search, FileText, Pill, Users, UserPlus } from 'lucide-react'

export default function ConsultasPage() {
    const [consultas, setConsultas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)

    // Form data
    const [tipoPaciente, setTipoPaciente] = useState<'Trabajador' | 'Poblacion General'>('Trabajador')
    const [formData, setFormData] = useState({
        id_empleado_titular: '',
        paciente_seleccionado: '', // Puede ser "titular", o un id_paciente, o vacio
        diagnostico: '',
        costo_consulta: 0,
        medicamentos_recetados: [] as any[]
    })

    const [empleados, setEmpleados] = useState<any[]>([])
    const [beneficiariosActuales, setBeneficiariosActuales] = useState<any[]>([])
    const [poblacionGeneral, setPoblacionGeneral] = useState<any[]>([])
    const [medicamentosCat, setMedicamentosCat] = useState<any[]>([])

    // Quick add beneficiary
    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const [quickAddData, setQuickAddData] = useState({ nombre: '', parentesco: 'Hijo(a)' })

    useEffect(() => {
        fetchConsultas()
        fetchCatalogosBase()
    }, [])

    const fetchCatalogosBase = async () => {
        // Empleados
        const { data: eData } = await supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, apellido_materno').order('nombre')
        if (eData) setEmpleados(eData)

        // Poblacion General
        const { data: pData } = await supabase.from('pacientes').select('*').eq('es_poblacion_general', true).order('nombre_completo')
        if (pData) setPoblacionGeneral(pData)

        // Medicamentos
        const { data: mData } = await supabase.from('cat_medicamentos').select('*')
        if (mData) setMedicamentosCat(mData)
    }

    const fetchConsultas = async () => {
        const { data, error } = await supabase.from('consultas_medicas').select(`
            *,
            empleados (nombre, apellido_paterno),
            pacientes (nombre_completo, es_poblacion_general)
        `).order('fecha', { ascending: false })
        if (data) setConsultas(data)
        setLoading(false)
    }

    const loadBeneficiarios = async (id_empleado: string) => {
        if (!id_empleado) {
            setBeneficiariosActuales([])
            return
        }
        const { data } = await supabase.from('pacientes').select('*').eq('id_empleado', id_empleado)
        if (data) setBeneficiariosActuales(data)
    }

    const handleEmpleadoChange = (val: string) => {
        setFormData({ ...formData, id_empleado_titular: val, paciente_seleccionado: '' })
        loadBeneficiarios(val)
    }

    const handleQuickAdd = async () => {
        if (!quickAddData.nombre || !formData.id_empleado_titular) return
        
        const { data, error } = await supabase.from('pacientes').insert([{
            id_empleado: formData.id_empleado_titular,
            nombre_completo: quickAddData.nombre,
            parentesco: quickAddData.parentesco,
            es_poblacion_general: false
        }]).select()

        if (data && data.length > 0) {
            await loadBeneficiarios(formData.id_empleado_titular)
            setFormData({...formData, paciente_seleccionado: data[0].id_paciente})
            setShowQuickAdd(false)
            setQuickAddData({ nombre: '', parentesco: 'Hijo(a)' })
        }
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
        
        // Auto-fill price
        if (field === 'id_medicamento') {
            const med = medicamentosCat.find(m => m.id_medicamento === value)
            if (med && tipoPaciente === 'Poblacion General') {
                newMed[index].costo_unitario = med.precio_venta
            } else {
                newMed[index].costo_unitario = 0
            }
        }
        
        setFormData({ ...formData, medicamentos_recetados: newMed })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        let id_emp = null;
        let id_pac = null;

        if (tipoPaciente === 'Trabajador') {
            if (formData.paciente_seleccionado === 'titular') {
                id_emp = formData.id_empleado_titular;
            } else {
                id_emp = formData.id_empleado_titular;
                id_pac = formData.paciente_seleccionado;
            }
        } else {
            id_pac = formData.paciente_seleccionado;
        }

        // 1. Insertar Consulta
        const { data: consultaData, error: consultaError } = await supabase.from('consultas_medicas').insert([{
            id_empleado: id_emp,
            id_paciente: id_pac,
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
        setFormData({ id_empleado_titular: '', paciente_seleccionado: '', diagnostico: '', costo_consulta: 0, medicamentos_recetados: [] })
        fetchConsultas()
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Stethoscope className="w-6 h-6 text-amber-500" />
                        Consultas Médicas
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Registro clínico de trabajadores y beneficiarios</p>
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
                    <div className="flex items-center gap-4 border-b pb-4">
                        <h2 className="text-lg font-bold text-zinc-800">Tipo de Paciente:</h2>
                        <div className="flex bg-zinc-100 p-1 rounded-lg">
                            <button 
                                type="button"
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tipoPaciente === 'Trabajador' ? 'bg-white shadow-sm text-amber-600' : 'text-zinc-500'}`}
                                onClick={() => { setTipoPaciente('Trabajador'); setFormData({...formData, costo_consulta: 0, paciente_seleccionado: ''}) }}
                            >
                                Personal / Beneficiario
                            </button>
                            <button 
                                type="button"
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tipoPaciente === 'Poblacion General' ? 'bg-white shadow-sm text-amber-600' : 'text-zinc-500'}`}
                                onClick={() => { setTipoPaciente('Poblacion General'); setFormData({...formData, costo_consulta: 200, paciente_seleccionado: ''}) }}
                            >
                                Población General
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            
                            {tipoPaciente === 'Trabajador' ? (
                                <>
                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100/50">
                                        <label className="block text-sm font-bold text-amber-900 mb-1">Paso 1: Buscar Trabajador Titular</label>
                                        <select 
                                            required
                                            className="w-full rounded-xl border-amber-200 bg-white px-4 py-2 text-sm"
                                            value={formData.id_empleado_titular}
                                            onChange={e => handleEmpleadoChange(e.target.value)}
                                        >
                                            <option value="">Seleccione el trabajador...</option>
                                            {empleados.map(emp => (
                                                <option key={emp.id_empleado} value={emp.id_empleado}>
                                                    {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {formData.id_empleado_titular && (
                                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-bold text-emerald-900">Paso 2: ¿Quién recibe la consulta?</label>
                                                <button type="button" onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md hover:bg-emerald-200 flex items-center gap-1">
                                                    <UserPlus className="w-3 h-3" /> Añadir Beneficiario
                                                </button>
                                            </div>
                                            
                                            {showQuickAdd && (
                                                <div className="mb-3 p-3 bg-white rounded-lg border border-emerald-200 flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-zinc-500">Nombre Completo</label>
                                                        <input type="text" className="w-full text-sm border-zinc-200 rounded-md" value={quickAddData.nombre} onChange={e=>setQuickAddData({...quickAddData, nombre: e.target.value})} />
                                                    </div>
                                                    <div className="w-32">
                                                        <label className="text-xs text-zinc-500">Parentesco</label>
                                                        <select className="w-full text-sm border-zinc-200 rounded-md" value={quickAddData.parentesco} onChange={e=>setQuickAddData({...quickAddData, parentesco: e.target.value})}>
                                                            <option>Esposo(a)</option>
                                                            <option>Hijo(a)</option>
                                                            <option>Padre/Madre</option>
                                                        </select>
                                                    </div>
                                                    <button type="button" onClick={handleQuickAdd} className="bg-emerald-600 text-white px-3 py-2 rounded-md text-sm font-bold">Crear</button>
                                                </div>
                                            )}

                                            <select 
                                                required
                                                className="w-full rounded-xl border-emerald-200 bg-white px-4 py-2 text-sm"
                                                value={formData.paciente_seleccionado}
                                                onChange={e => setFormData({...formData, paciente_seleccionado: e.target.value})}
                                            >
                                                <option value="">Seleccione el paciente final...</option>
                                                <option value="titular">👉 El Trabajador Mismo</option>
                                                {beneficiariosActuales.map(ben => (
                                                    <option key={ben.id_paciente} value={ben.id_paciente}>
                                                        Familia: {ben.nombre_completo} ({ben.parentesco})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-1">Seleccionar Paciente (Población General)</label>
                                    <select 
                                        required
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                        value={formData.paciente_seleccionado}
                                        onChange={e => setFormData({...formData, paciente_seleccionado: e.target.value})}
                                    >
                                        <option value="">Seleccione...</option>
                                        {poblacionGeneral.map(p => (
                                            <option key={p.id_paciente} value={p.id_paciente}>
                                                {p.nombre_completo}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-amber-600 font-bold mt-1">Si el paciente no existe, debe registrarlo primero en la pestaña de Pacientes.</p>
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1">Costo de Consulta ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                                    <input 
                                        type="number" step="0.01" min="0"
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 pl-8 pr-4 py-2"
                                        value={formData.costo_consulta}
                                        onChange={e => setFormData({...formData, costo_consulta: parseFloat(e.target.value)})}
                                        readOnly={tipoPaciente === 'Trabajador'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1">Diagnóstico / Motivo</label>
                                <textarea 
                                    required rows={3}
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 resize-none"
                                    value={formData.diagnostico}
                                    onChange={e => setFormData({...formData, diagnostico: e.target.value})}
                                    placeholder="Describa el diagnóstico..."
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
                                                className="w-16 rounded-md border-zinc-200 text-sm py-1.5"
                                                value={med.cantidad}
                                                onChange={e => updateMedicamento(idx, 'cantidad', parseInt(e.target.value))}
                                                required
                                            />
                                            {med.costo_unitario > 0 && (
                                                <span className="text-xs font-bold text-amber-600 w-12 text-right">
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
                            Guardar Consulta
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
                                <th className="px-6 py-4">Paciente Final</th>
                                <th className="px-6 py-4">Sponsor (Trabajador)</th>
                                <th className="px-6 py-4">Diagnóstico</th>
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
                                            <div className="font-bold text-zinc-800">
                                                {c.id_empleado && !c.id_paciente ? '👤 ' + c.empleados?.nombre + ' (Trabajador)' : ''}
                                                {c.id_paciente ? '👪 ' + c.pacientes?.nombre_completo : ''}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500">
                                            {c.id_paciente && c.id_empleado ? c.empleados?.nombre + ' (Titular)' : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 max-w-xs truncate">
                                            {c.diagnostico}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button className="text-amber-500 hover:text-amber-600 font-medium flex items-center gap-1">
                                                <FileText className="w-4 h-4" /> Receta
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
