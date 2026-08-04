'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Heart, Plus, Search, Users, Trash2, UserCheck, UserPlus, Building2, Briefcase, AlertTriangle, ShieldX, CheckCircle, FileText, X, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function PacientesPage() {
    const [activeTab, setActiveTab] = useState<'trabajadores' | 'beneficiarios'>('trabajadores')
    const [pacientes, setPacientes] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [showWorkerForm, setShowWorkerForm] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedWorkerModal, setSelectedWorkerModal] = useState<any | null>(null)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    
    // Beneficiary form state
    const [formData, setFormData] = useState({ 
        nombre_completo: '', 
        es_poblacion_general: false, 
        parentesco: 'Esposo(a)',
        id_empleado: '',
        acompanante: ''
    })

    // Worker creation form state
    const [workerFormData, setWorkerFormData] = useState({
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        departamento: 'MINA GENERAL',
        puesto: 'GENERAL',
        numero_empleado: '',
        curp: '',
        rfc: '',
        nss: ''
    })

    useEffect(() => {
        fetchPacientes()
        fetchEmpleados()
        fetchDepartamentos()
    }, [])

    const fetchPacientes = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('pacientes')
            .select('*, empleados (id_empleado, nombre, apellido_paterno, apellido_materno, departamento, puesto, estado_empleado)')
            .order('nombre_completo')
        if (data) setPacientes(data)
        setLoading(false)
    }

    const fetchEmpleados = async () => {
        const { data } = await supabase
            .from('empleados')
            .select('id_empleado, numero_empleado, nombre, apellido_paterno, apellido_materno, departamento, puesto, curp, rfc, nss, estado_empleado')
            .order('nombre')
        if (data) setEmpleados(data)
    }

    const fetchDepartamentos = async () => {
        const { data } = await supabase.from('cat_departamentos').select('*').order('departamento')
        if (data) setDepartamentos(data)
    }

    const getEmpFullName = (emp: any) => {
        if (!emp) return ''
        return `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    }

    const openAddBeneficiaryForWorker = (empId: string) => {
        const emp = empleados.find(e => e.id_empleado === empId)
        setFormData({
            nombre_completo: '',
            es_poblacion_general: false,
            parentesco: 'Esposo(a)',
            id_empleado: empId,
            acompanante: emp ? getEmpFullName(emp) : ''
        })
        setShowForm(true)
    }

    const toggleBajaStatus = async (emp: any) => {
        const isBaja = emp.estado_empleado === 'BAJA'
        const actionName = isBaja ? 'REACTIVAR' : 'DAR DE BAJA'
        
        if (!confirm(`¿Está seguro de ${actionName} al trabajador "${getEmpFullName(emp)}"? ${!isBaja ? '\n\nATENCIÓN: Su perfil se marcará en ROJO y se suspenderá la atención médica y pases.' : ''}`)) {
            return
        }

        setUpdatingStatus(true)
        const newStatus = isBaja ? 'ACTIVO' : 'BAJA'

        // Update empleados table
        const { error: empErr } = await supabase
            .from('empleados')
            .update({ estado_empleado: newStatus })
            .eq('id_empleado', emp.id_empleado)

        // Update pacientes table for worker and beneficiaries
        await supabase
            .from('pacientes')
            .update({ activo: isBaja })
            .eq('id_empleado', emp.id_empleado)

        if (!empErr) {
            await fetchEmpleados()
            await fetchPacientes()
            
            if (selectedWorkerModal && selectedWorkerModal.id_empleado === emp.id_empleado) {
                setSelectedWorkerModal({ ...selectedWorkerModal, estado_empleado: newStatus })
            }
        } else {
            alert('Error al cambiar el estatus del trabajador: ' + empErr.message)
        }
        setUpdatingStatus(false)
    }

    const handleCreateWorker = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!workerFormData.nombre.trim() || !workerFormData.apellido_paterno.trim()) {
            alert('Por favor ingrese al menos Nombre y Apellido Paterno.')
            return
        }

        const fullName = `${workerFormData.nombre.trim()} ${workerFormData.apellido_paterno.trim()} ${workerFormData.apellido_materno.trim()}`.trim().toUpperCase()

        // 1. Insert into empleados
        const { data: newEmp, error: empErr } = await supabase
            .from('empleados')
            .insert([{
                nombre: workerFormData.nombre.toUpperCase().trim(),
                apellido_paterno: workerFormData.apellido_paterno.toUpperCase().trim(),
                apellido_materno: workerFormData.apellido_materno.toUpperCase().trim(),
                departamento: workerFormData.departamento,
                puesto: workerFormData.puesto.toUpperCase().trim() || 'GENERAL',
                numero_empleado: workerFormData.numero_empleado || null,
                curp: workerFormData.curp || null,
                rfc: workerFormData.rfc || null,
                nss: workerFormData.nss || null,
                estado_empleado: 'ACTIVO'
            }])
            .select('id_empleado')
            .single()

        if (empErr) {
            alert('Error al crear el trabajador: ' + empErr.message)
            return
        }

        const empId = newEmp?.id_empleado

        // 2. Insert Titular patient into pacientes
        await supabase.from('pacientes').insert([{
            nombre_completo: fullName,
            parentesco: 'TITULAR (TRABAJADOR)',
            es_poblacion_general: false,
            activo: true,
            id_empleado: empId || null
        }])

        setShowWorkerForm(false)
        setWorkerFormData({
            nombre: '',
            apellido_paterno: '',
            apellido_materno: '',
            departamento: 'MINA GENERAL',
            puesto: 'GENERAL',
            numero_empleado: '',
            curp: '',
            rfc: '',
            nss: ''
        })

        await fetchEmpleados()
        await fetchPacientes()
        setActiveTab('trabajadores')
        alert(`¡Trabajador "${fullName}" registrado exitosamente!`)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.nombre_completo.trim()) {
            alert('Por favor ingrese el nombre completo del paciente o beneficiario.')
            return
        }

        const { error } = await supabase.from('pacientes').insert([
            {
                nombre_completo: formData.nombre_completo.toUpperCase().trim(),
                es_poblacion_general: formData.es_poblacion_general,
                parentesco: formData.es_poblacion_general ? 'Población General' : formData.parentesco,
                id_empleado: formData.es_poblacion_general ? null : (formData.id_empleado || null),
                acompanante: formData.acompanante ? formData.acompanante.toUpperCase().trim() : null
            }
        ])

        if (!error) {
            setShowForm(false)
            setFormData({ nombre_completo: '', es_poblacion_general: false, parentesco: 'Esposo(a)', id_empleado: '', acompanante: '' })
            fetchPacientes()
            setActiveTab('beneficiarios')
        } else {
            alert('Error al guardar el beneficiario: ' + error.message)
        }
    }

    const deletePaciente = async (id: string, nombre: string) => {
        if (!confirm(`¿Está seguro de eliminar al beneficiario "${nombre}"?`)) return
        const { error } = await supabase.from('pacientes').delete().eq('id_paciente', id)
        if (!error) {
            fetchPacientes()
        } else {
            alert('No se pudo eliminar el registro. Es posible que esté asociado a consultas o pases existentes.')
        }
    }

    // Filter employees for Tab 1
    const filteredEmpleados = empleados.filter(e => {
        const full = getEmpFullName(e).toLowerCase()
        const dept = (e.departamento || '').toLowerCase()
        const puesto = (e.puesto || '').toLowerCase()
        const query = searchQuery.toLowerCase()
        return full.includes(query) || dept.includes(query) || puesto.includes(query)
    })

    // Filter beneficiaries for Tab 2
    const beneficiariosList = pacientes.filter(p => 
        p.parentesco && 
        p.parentesco.toUpperCase() !== 'TITULAR (TRABAJADOR)' && 
        p.parentesco.toUpperCase() !== 'TITULAR' &&
        p.parentesco.toUpperCase() !== 'ELLA MISMA'
    )

    const filteredBeneficiarios = beneficiariosList.filter(p => {
        const nameMatch = (p.nombre_completo || '').toLowerCase().includes(searchQuery.toLowerCase())
        const parentMatch = (p.parentesco || '').toLowerCase().includes(searchQuery.toLowerCase())
        const empName = p.empleados ? getEmpFullName(p.empleados).toLowerCase() : ''
        return nameMatch || parentMatch || empName.includes(searchQuery.toLowerCase())
    })

    return (
        <div className="space-y-6">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-zinc-150">
                <div>
                    <h1 className="text-2xl font-black text-zinc-900 flex items-center gap-2.5">
                        <Heart className="w-7 h-7 text-rose-500 fill-rose-500/20" />
                        Padrón de Trabajadores y Beneficiarios
                    </h1>
                    <p className="text-zinc-500 text-xs font-semibold mt-1">
                        Catálogo oficial de personal titular y familiares con cobertura de servicios médicos y pases.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                        href="/empleados/duplicados"
                        className="bg-amber-100 border border-amber-300 text-amber-950 px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-amber-200 transition-all shadow-xs"
                    >
                        <Sparkles className="w-4 h-4 text-amber-700" />
                        🧹 Depurar Duplicados
                    </Link>

                    <button
                        onClick={() => {
                            setShowForm(false)
                            setShowWorkerForm(!showWorkerForm)
                        }}
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-emerald-500 transition-all shadow-md active:scale-95"
                    >
                        <UserPlus className="w-4 h-4 text-emerald-200" />
                        + Agregar Nuevo Trabajador
                    </button>

                    <button
                        onClick={() => {
                            setShowWorkerForm(false)
                            setFormData({ nombre_completo: '', es_poblacion_general: false, parentesco: 'Esposo(a)', id_empleado: '', acompanante: '' })
                            setShowForm(!showForm)
                        }}
                        className="bg-zinc-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-md active:scale-95"
                    >
                        <Plus className="w-4 h-4 text-emerald-400" />
                        + Agregar Beneficiario
                    </button>
                </div>
            </div>

            {/* Tab Selector Buttons */}
            <div className="flex items-center gap-2 bg-zinc-200/60 p-1.5 rounded-2xl w-fit border border-zinc-200">
                <button
                    onClick={() => setActiveTab('trabajadores')}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                        activeTab === 'trabajadores'
                            ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/80'
                            : 'text-zinc-600 hover:text-black hover:bg-white/50'
                    }`}
                >
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>👔 Trabajadores Titulares ({empleados.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('beneficiarios')}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                        activeTab === 'beneficiarios'
                            ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/80'
                            : 'text-zinc-600 hover:text-black hover:bg-white/50'
                    }`}
                >
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>👨‍👩‍👧‍👦 Beneficiarios y Familiares ({beneficiariosList.length})</span>
                </button>
            </div>

            {/* CREATE NEW WORKER FORM MODAL */}
            {showWorkerForm && (
                <form onSubmit={handleCreateWorker} className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-300 space-y-4 animate-in fade-in duration-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
                    
                    <div className="flex justify-between items-center border-b pb-3 border-zinc-100">
                        <h2 className="text-base font-black text-zinc-900 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-emerald-600" />
                            Alta de Nuevo Trabajador Titular
                        </h2>
                        <button type="button" onClick={() => setShowWorkerForm(false)} className="text-xs font-bold text-zinc-400 hover:text-zinc-700">✕ Cerrar</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Nombre(s)</label>
                            <input 
                                required type="text"
                                placeholder="Ej. JOSE ANASTACIO"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.nombre}
                                onChange={e => setWorkerFormData({...workerFormData, nombre: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Apellido Paterno</label>
                            <input 
                                required type="text"
                                placeholder="Ej. ARREOLA"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.apellido_paterno}
                                onChange={e => setWorkerFormData({...workerFormData, apellido_paterno: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Apellido Materno</label>
                            <input 
                                type="text"
                                placeholder="Ej. OROSCO"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.apellido_materno}
                                onChange={e => setWorkerFormData({...workerFormData, apellido_materno: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Departamento</label>
                            <select 
                                required
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 font-bold text-xs text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.departamento}
                                onChange={e => setWorkerFormData({...workerFormData, departamento: e.target.value})}
                            >
                                {departamentos.map(d => (
                                    <option key={d.id_departamento} value={d.departamento}>
                                        {d.departamento}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Puesto / Categoría</label>
                            <input 
                                type="text"
                                placeholder="Ej. SUPERVISOR B BENEFICIO"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.puesto}
                                onChange={e => setWorkerFormData({...workerFormData, puesto: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">No. de Empleado (Ficha)</label>
                            <input 
                                type="text"
                                placeholder="Ej. 344"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.numero_empleado}
                                onChange={e => setWorkerFormData({...workerFormData, numero_empleado: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">CURP (Opcional)</label>
                            <input 
                                type="text"
                                placeholder="AEOA560415..."
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.curp}
                                onChange={e => setWorkerFormData({...workerFormData, curp: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">RFC (Opcional)</label>
                            <input 
                                type="text"
                                placeholder="AEOA560415..."
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.rfc}
                                onChange={e => setWorkerFormData({...workerFormData, rfc: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Afiliación IMSS / NSS (Opcional)</label>
                            <input 
                                type="text"
                                placeholder="310556..."
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={workerFormData.nss}
                                onChange={e => setWorkerFormData({...workerFormData, nss: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 gap-2">
                        <button type="button" onClick={() => setShowWorkerForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-black hover:bg-emerald-500 shadow-md">
                            Guardar Trabajador Titular
                        </button>
                    </div>
                </form>
            )}

            {/* New Beneficiary Modal / Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200/80 space-y-4 animate-in fade-in duration-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                    
                    <div className="flex justify-between items-center border-b pb-3 border-zinc-100">
                        <h2 className="text-base font-black text-zinc-900 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-emerald-600" />
                            Registrar Nuevo Beneficiario / Paciente
                        </h2>
                        <button type="button" onClick={() => setShowForm(false)} className="text-xs font-bold text-zinc-400 hover:text-zinc-700">✕ Cerrar</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Nombre Completo del Beneficiario</label>
                            <input 
                                required type="text"
                                placeholder="Nombre(s) Apellido Paterno Apellido Materno"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={formData.nombre_completo}
                                onChange={e => setFormData({...formData, nombre_completo: e.target.value})}
                            />
                        </div>

                        <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 border border-zinc-200 p-2.5 rounded-2xl w-full">
                                <input 
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                    checked={formData.es_poblacion_general}
                                    onChange={e => setFormData({...formData, es_poblacion_general: e.target.checked})}
                                />
                                <span className="text-xs font-black text-zinc-800">Población General (Público General)</span>
                            </label>
                        </div>

                        {!formData.es_poblacion_general && (
                            <>
                                <div>
                                    <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Trabajador Titular Relacionado</label>
                                    <select 
                                        required
                                        className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 font-bold text-xs text-zinc-900 focus:bg-white focus:border-emerald-500"
                                        value={formData.id_empleado}
                                        onChange={e => {
                                            const empId = e.target.value
                                            const emp = empleados.find(x => x.id_empleado === empId)
                                            setFormData({
                                                ...formData,
                                                id_empleado: empId,
                                                acompanante: emp ? getEmpFullName(emp) : ''
                                            })
                                        }}
                                    >
                                        <option value="">Seleccionar trabajador titular...</option>
                                        {empleados.map(emp => (
                                            <option key={emp.id_empleado} value={emp.id_empleado}>
                                                {getEmpFullName(emp)} ({emp.departamento || 'Sin Depto'}) {emp.estado_empleado === 'BAJA' ? '🔴 DADO DE BAJA' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Parentesco con el Trabajador</label>
                                    <select 
                                        className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 font-bold text-xs text-zinc-900 focus:bg-white focus:border-emerald-500"
                                        value={formData.parentesco}
                                        onChange={e => setFormData({ ...formData, parentesco: e.target.value })}
                                    >
                                        <option value="Esposo(a)">Esposo(a) / Concubina(o)</option>
                                        <option value="Hijo(a)">Hijo(a)</option>
                                        <option value="Padre/Madre">Padre / Madre</option>
                                        <option value="Hermano(a)">Hermano(a)</option>
                                        <option value="Acompañante Médico">Acompañante Médico</option>
                                        <option value="Otro Familiar">Otro Familiar</option>
                                    </select>
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-xs font-black text-zinc-700 mb-1 uppercase tracking-wider">Acompañante Habitual (Opcional)</label>
                            <input 
                                type="text"
                                placeholder="Ej. MARIA ARREOLA (MADRE)"
                                className="w-full rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 focus:bg-white focus:border-emerald-500"
                                value={formData.acompanante}
                                onChange={e => setFormData({...formData, acompanante: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-emerald-500 shadow-md">
                            Guardar Beneficiario
                        </button>
                    </div>
                </form>
            )}

            {/* Search input bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-150 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                        type="text"
                        placeholder={activeTab === 'trabajadores' ? "Buscar trabajador por nombre, puesto o departamento..." : "Buscar beneficiario o titular..."}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-900 focus:bg-white"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* TAB 1: TRABAJADORES TITULARES */}
            {activeTab === 'trabajadores' && (
                <div className="bg-white rounded-3xl shadow-sm border border-zinc-150 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-zinc-50 text-zinc-400 font-black uppercase tracking-wider border-b border-zinc-150 text-[10px]">
                                <tr>
                                    <th className="px-6 py-4">Nombre Completo del Trabajador</th>
                                    <th className="px-6 py-4">Departamento</th>
                                    <th className="px-6 py-4">Puesto</th>
                                    <th className="px-6 py-4">Estatus Servicio Médico</th>
                                    <th className="px-6 py-4">Beneficiarios</th>
                                    <th className="px-6 py-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-150">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-400 font-bold">Cargando catálogo de trabajadores...</td></tr>
                                ) : filteredEmpleados.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-400 font-bold">No se encontraron trabajadores en este criterio.</td></tr>
                                ) : (
                                    filteredEmpleados.map(emp => {
                                        const fullName = getEmpFullName(emp)
                                        const isBaja = emp.estado_empleado === 'BAJA' || emp.estado_empleado === 'INACTIVO'
                                        const countBeneficiarios = pacientes.filter(p => p.id_empleado === emp.id_empleado && p.parentesco && p.parentesco.toUpperCase() !== 'TITULAR (TRABAJADOR)').length

                                        return (
                                            <tr 
                                                key={emp.id_empleado} 
                                                onClick={() => setSelectedWorkerModal(emp)}
                                                className={`transition-colors cursor-pointer ${
                                                    isBaja 
                                                        ? 'bg-rose-50/80 hover:bg-rose-100/90 border-l-4 border-l-rose-600' 
                                                        : 'hover:bg-zinc-50/70'
                                                }`}
                                            >
                                                <td className="px-6 py-4 font-black text-zinc-900 flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                                                        isBaja ? 'bg-rose-200 text-rose-900 border border-rose-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                                    }`}>
                                                        {isBaja ? '🔴' : '👔'}
                                                    </div>
                                                    <div>
                                                        <div className={`text-sm font-black ${isBaja ? 'text-rose-950 line-through decoration-rose-500' : 'text-zinc-900'}`}>{fullName}</div>
                                                        <div className="text-[10px] font-mono text-zinc-400">ID: {emp.numero_empleado || emp.id_empleado?.substring(0, 8)}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border ${
                                                        isBaja 
                                                            ? 'bg-rose-100 text-rose-900 border-rose-200' 
                                                            : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                                    }`}>
                                                        <Building2 className="w-3 h-3" />
                                                        {emp.departamento || 'Sin Asignar'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-zinc-700">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Briefcase className="w-3 h-3 text-zinc-400" />
                                                        {emp.puesto || 'General'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isBaja ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-full font-black text-[9px] uppercase tracking-wide shadow-xs">
                                                            <ShieldX className="w-3 h-3" />
                                                            🔴 DADO DE BAJA / SUSPENDIDO
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-full font-black text-[9px] uppercase tracking-wide">
                                                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                                                            🟢 ACTIVO (CON ATENCIÓN)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {countBeneficiarios > 0 ? (
                                                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-black text-[10px]">
                                                            {countBeneficiarios} beneficiario(s)
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-400 font-semibold">Sin beneficiarios</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openAddBeneficiaryForWorker(emp.id_empleado)}
                                                            className="bg-zinc-100 hover:bg-emerald-50 text-zinc-800 hover:text-emerald-800 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all border border-zinc-200"
                                                        >
                                                            + Beneficiario
                                                        </button>
                                                        <button
                                                            onClick={() => toggleBajaStatus(emp)}
                                                            disabled={updatingStatus}
                                                            className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all border shadow-xs ${
                                                                isBaja 
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500' 
                                                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-600 hover:text-white'
                                                            }`}
                                                        >
                                                            {isBaja ? '🟢 Reactivar' : '🔴 Dar de Baja'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: BENEFICIARIOS Y FAMILIARES */}
            {activeTab === 'beneficiarios' && (
                <div className="bg-white rounded-3xl shadow-sm border border-zinc-150 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-zinc-50 text-zinc-400 font-black uppercase tracking-wider border-b border-zinc-150 text-[10px]">
                                <tr>
                                    <th className="px-6 py-4">Nombre del Beneficiario</th>
                                    <th className="px-6 py-4">Parentesco</th>
                                    <th className="px-6 py-4">Trabajador Titular</th>
                                    <th className="px-6 py-4">Departamento</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-150">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-400 font-bold">Cargando beneficiarios...</td></tr>
                                ) : filteredBeneficiarios.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-400 font-bold">No se encontraron beneficiarios o familiares en la búsqueda.</td></tr>
                                ) : (
                                    filteredBeneficiarios.map(pac => {
                                        const empFullName = pac.empleados ? getEmpFullName(pac.empleados) : 'SIN TITULAR VINCULADO'
                                        const isBaja = pac.empleados?.estado_empleado === 'BAJA'

                                        return (
                                            <tr key={pac.id_paciente} className={`transition-colors ${isBaja ? 'bg-rose-50/60' : 'hover:bg-zinc-50/60'}`}>
                                                <td className="px-6 py-4 font-black text-zinc-900 flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                                                        isBaja ? 'bg-rose-200 text-rose-800' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                    }`}>
                                                        👨‍👩‍👧
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-zinc-900">{pac.nombre_completo}</div>
                                                        {isBaja && (
                                                            <div className="text-[9px] font-black text-rose-600 uppercase tracking-wide">
                                                                🔴 TITULAR DADO DE BAJA
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[10px] font-black uppercase tracking-wide">
                                                        {pac.parentesco || 'Familia'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-zinc-800">{empFullName}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-black text-emerald-800 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                        {pac.empleados?.departamento || 'General'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => deletePaciente(pac.id_paciente, pac.nombre_completo)}
                                                        className="text-zinc-400 hover:text-rose-600 font-black text-[10px] uppercase flex items-center gap-1 ml-auto"
                                                        title="Eliminar registro"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DETAILED WORKER MODAL / EXPEDIENTE */}
            {selectedWorkerModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className={`bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 border-2 relative overflow-hidden ${
                        selectedWorkerModal.estado_empleado === 'BAJA' 
                            ? 'border-rose-500 bg-rose-50/20' 
                            : 'border-emerald-500'
                    }`}>
                        <div className={`absolute top-0 left-0 right-0 h-2 ${
                            selectedWorkerModal.estado_empleado === 'BAJA' ? 'bg-rose-600' : 'bg-emerald-500'
                        }`} />

                        {/* Modal Header */}
                        <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-black text-zinc-900">
                                        {getEmpFullName(selectedWorkerModal)}
                                    </h2>
                                    {selectedWorkerModal.estado_empleado === 'BAJA' ? (
                                        <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full font-black text-[10px] uppercase">
                                            🔴 DADO DE BAJA
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-[10px] uppercase">
                                            🟢 ACTIVO
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                                    Expediente Oficial de Registro Médico y Hospedaje
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedWorkerModal(null)} 
                                className="p-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* WARNING BANNER IF BAJA */}
                        {selectedWorkerModal.estado_empleado === 'BAJA' && (
                            <div className="bg-rose-600 text-white p-4 rounded-2xl flex items-start gap-3 shadow-md">
                                <ShieldX className="w-6 h-6 flex-shrink-0 mt-0.5 text-rose-100" />
                                <div>
                                    <div className="font-black text-sm uppercase tracking-wide">⚠️ ATENCIÓN MÉDICA Y PASES SUSPENDIDOS</div>
                                    <div className="text-xs font-medium text-rose-100 mt-0.5">
                                        Este trabajador se encuentra DADO DE BAJA. No tiene permitida la consulta médica ni la generación de pases médicos o hospedaje en hotel.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Worker Information Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/80">
                            <div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase">Departamento</div>
                                <div className="text-xs font-black text-emerald-800 uppercase mt-0.5">{selectedWorkerModal.departamento || 'Sin Asignar'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase">Puesto</div>
                                <div className="text-xs font-black text-zinc-800 uppercase mt-0.5">{selectedWorkerModal.puesto || 'General'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase">No. Empleado</div>
                                <div className="text-xs font-mono font-bold text-zinc-700 mt-0.5">{selectedWorkerModal.numero_empleado || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase">RFC</div>
                                <div className="text-xs font-mono font-bold text-zinc-700 mt-0.5">{selectedWorkerModal.rfc || 'No registrado'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase">CURP</div>
                                <div className="text-xs font-mono font-bold text-zinc-700 mt-0.5">{selectedWorkerModal.curp || 'No registrado'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase">Afiliación IMSS</div>
                                <div className="text-xs font-mono font-bold text-zinc-700 mt-0.5">{selectedWorkerModal.nss || 'No registrado'}</div>
                            </div>
                        </div>

                        {/* Linked Beneficiaries List */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-indigo-600" />
                                    Beneficiarios y Familiares Registrados
                                </h3>
                                <button 
                                    onClick={() => {
                                        openAddBeneficiaryForWorker(selectedWorkerModal.id_empleado)
                                        setSelectedWorkerModal(null)
                                    }}
                                    className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl hover:bg-indigo-100 border border-indigo-200/80"
                                >
                                    + Agregar Beneficiario
                                </button>
                            </div>

                            <div className="bg-zinc-50 rounded-2xl border border-zinc-200/80 divide-y divide-zinc-200 max-h-40 overflow-y-auto">
                                {pacientes.filter(p => p.id_empleado === selectedWorkerModal.id_empleado && p.parentesco && p.parentesco.toUpperCase() !== 'TITULAR (TRABAJADOR)').length === 0 ? (
                                    <div className="p-4 text-center text-xs text-zinc-400 font-semibold">Sin beneficiarios dados de alta para este trabajador.</div>
                                ) : (
                                    pacientes.filter(p => p.id_empleado === selectedWorkerModal.id_empleado && p.parentesco && p.parentesco.toUpperCase() !== 'TITULAR (TRABAJADOR)').map(fam => (
                                        <div key={fam.id_paciente} className="p-3 flex justify-between items-center text-xs">
                                            <div>
                                                <div className="font-black text-zinc-900">{fam.nombre_completo}</div>
                                                <div className="text-[10px] font-bold text-amber-800 uppercase">{fam.parentesco}</div>
                                            </div>
                                            <button 
                                                onClick={() => deletePaciente(fam.id_paciente, fam.nombre_completo)} 
                                                className="text-zinc-400 hover:text-rose-600 text-[10px] font-bold"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Modal Action Footer */}
                        <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
                            <button
                                onClick={() => toggleBajaStatus(selectedWorkerModal)}
                                disabled={updatingStatus}
                                className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-md transition-all ${
                                    selectedWorkerModal.estado_empleado === 'BAJA'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                                }`}
                            >
                                {selectedWorkerModal.estado_empleado === 'BAJA' ? (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        🟢 Reactivar Trabajador (Habilitar Atención)
                                    </>
                                ) : (
                                    <>
                                        <ShieldX className="w-4 h-4" />
                                        🔴 Dar de Baja Trabajador (Suspender Atención)
                                    </>
                                )}
                            </button>
                            
                            <button 
                                onClick={() => setSelectedWorkerModal(null)} 
                                className="bg-zinc-200 text-zinc-800 px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-zinc-300"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
