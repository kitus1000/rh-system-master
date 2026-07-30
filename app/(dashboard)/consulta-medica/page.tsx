'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Hospital, Building2, Search, Heart, ShieldAlert, Users, ClipboardList, FolderLock, Eye, Calendar, PlusCircle, Clock, Hotel } from 'lucide-react'

export default function ConsultaMedicaPortal() {
    const { profile } = useAuth()
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState('')
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'compartido' | 'solo_medicos' | 'todos'>('todos')
    
    // Date Range Filter State
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')

    // Extension modal state
    const [extendingPase, setExtendingPase] = useState<any | null>(null)
    const [nuevaFechaRetorno, setNuevaFechaRetorno] = useState('')
    const [motivoExtension, setMotivoExtension] = useState('')
    const [savingExtension, setSavingExtension] = useState(false)

    // Doctor, HR or Admin have full access to view any department
    const isDoctorOrAdmin = profile?.rol === 'Médico' || 
                            profile?.rol === 'Administrador' || 
                            profile?.rol === 'Administrativo' || 
                            profile?.rol === 'Recursos Humanos' ||
                            (profile?.nombre_completo || '').toUpperCase().includes('RECURSOS')

    useEffect(() => {
        if (profile) {
            fetchDepartamentos()
        }
    }, [profile])

    useEffect(() => {
        if (profile) {
            fetchPases()
        }
    }, [selectedDept, profile, viewMode, fechaDesde, fechaHasta])

    const fetchDepartamentos = async () => {
        const { data } = await supabase
            .from('cat_departamentos')
            .select('*')
            .order('departamento')
        if (data) {
            setDepartamentos(data)
            
            // Set initial selected department based on user profile if not admin
            if (!isDoctorOrAdmin && profile?.id_departamento) {
                setSelectedDept(profile.id_departamento)
            }
        }
    }

    const fetchPases = async () => {
        setLoading(true)
        try {
            let activeDeptId = selectedDept
            
            // Lock to profile department if not doctor/admin/HR
            let allowedDepts: string[] = []
            if (!isDoctorOrAdmin) {
                if (profile?.departamentos_autorizados && profile.departamentos_autorizados.length > 0) {
                    allowedDepts = profile.departamentos_autorizados
                } else if (profile?.id_departamento) {
                    allowedDepts = [profile.id_departamento]
                }
                
                // If they picked a specific dept in UI, ensure it's in their allowed list
                if (activeDeptId) {
                    if (!allowedDepts.includes(activeDeptId)) {
                        // Trying to see a dept they don't have access to
                        setPases([])
                        setLoading(false)
                        return
                    }
                }
            }

            let query = supabase
                .from('pases_medicos')
                .select(`
                    *,
                    empleados (id_empleado, nombre, apellido_paterno, puesto, departamento),
                    pacientes (nombre_completo, parentesco),
                    clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre),
                    clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre)
                `)
                .order('creado_el', { ascending: false })

            let { data, error } = await query
            
            if (error) {
                console.warn('Primary query failed in consulta-medica, trying fallback query:', error)
                const fallbackQuery = await supabase
                    .from('pases_medicos')
                    .select(`
                        *,
                        empleados (id_empleado, nombre, apellido_paterno, puesto, departamento),
                        pacientes (nombre_completo, parentesco)
                    `)
                    .order('creado_el', { ascending: false })

                data = fallbackQuery.data || []
            }

            let filteredPases = data || []

            // Date filtering in JS so null fecha_salida records check creado_el/fecha_salida_unidad
            console.log('Total pases fetched from DB:', filteredPases.length)
            
            if (fechaDesde) {
                filteredPases = filteredPases.filter(p => {
                    const f = p.fecha_salida || p.fecha_salida_unidad || (p.creado_el ? p.creado_el.split('T')[0] : null)
                    return !f || f >= fechaDesde
                })
            }
            if (fechaHasta) {
                filteredPases = filteredPases.filter(p => {
                    const f = p.fecha_salida || p.fecha_salida_unidad || (p.creado_el ? p.creado_el.split('T')[0] : null)
                    return !f || f <= fechaHasta
                })
            }
            console.log('After date filter:', filteredPases.length)

            // Client-side role and department filtering for 100% accuracy
            if (!isDoctorOrAdmin) {
                console.log('User is NOT doctor/admin. activeDeptId:', activeDeptId, 'allowedDepts:', allowedDepts)
                if (activeDeptId) {
                    filteredPases = filteredPases.filter(p => {
                        const empDeptName = p.empleados?.departamento
                        if (!empDeptName || empDeptName === 'Sin Asignar') return true // Keep passes without explicit employee department visible
                        const matchedDept = departamentos.find(d => d.departamento?.toLowerCase().trim() === empDeptName.toLowerCase().trim())
                        const empDeptId = matchedDept?.id_departamento
                        if (!empDeptId) return true
                        return empDeptId === activeDeptId
                    })
                } else if (allowedDepts.length > 0) {
                    filteredPases = filteredPases.filter(p => {
                        const empDeptName = p.empleados?.departamento
                        if (!empDeptName || empDeptName === 'Sin Asignar') return true // Keep passes without explicit employee department visible
                        const matchedDept = departamentos.find(d => d.departamento?.toLowerCase().trim() === empDeptName.toLowerCase().trim())
                        const empDeptId = matchedDept?.id_departamento
                        if (!empDeptId) return true
                        return allowedDepts.includes(empDeptId)
                    })
                }
            } else {
                console.log('User is doctor/admin. activeDeptId:', activeDeptId, 'viewMode:', viewMode)
                if (activeDeptId) {
                    filteredPases = filteredPases.filter(p => {
                        const empDeptName = p.empleados?.departamento
                        if (!empDeptName || empDeptName === 'Sin Asignar') return true // Keep passes without explicit employee department visible
                        const matchedDept = departamentos.find(d => d.departamento?.toLowerCase().trim() === empDeptName.toLowerCase().trim())
                        const empDeptId = matchedDept?.id_departamento
                        if (!empDeptId) return true
                        return empDeptId === activeDeptId
                    })
                }
                if (viewMode === 'compartido') {
                    filteredPases = filteredPases.filter(p => p.compartido_departamentos === true)
                } else if (viewMode === 'solo_medicos') {
                    filteredPases = filteredPases.filter(p => !p.compartido_departamentos)
                }
            }
            console.log('Final pases set to state:', filteredPases.length)
            setPases(filteredPases)
        } catch (error) {
            console.error('Error fetching clinic pases:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleExtendPass = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!extendingPase || !nuevaFechaRetorno) return
        setSavingExtension(true)
        try {
            const comentariosPrevios = extendingPase.comentarios || ''
            const notaExtension = `[AMPLIACIÓN DÍAS: Nueva fecha ${nuevaFechaRetorno}. Motivo: ${motivoExtension || 'Diagnóstico médico ampliado'}]`
            const nuevosComentarios = comentariosPrevios ? `${comentariosPrevios}\n${notaExtension}` : notaExtension

            const { error } = await supabase
                .from('pases_medicos')
                .update({ 
                    fecha_retorno: nuevaFechaRetorno,
                    comentarios: nuevosComentarios
                })
                .eq('id_pase', extendingPase.id_pase)

            if (error) throw error

            alert('Vigencia ampliada con éxito.')
            setExtendingPase(null)
            setNuevaFechaRetorno('')
            setMotivoExtension('')
            fetchPases()
        } catch (err: any) {
            alert('Error al ampliar días: ' + err.message)
        } finally {
            setSavingExtension(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-6 bg-white border border-zinc-150 rounded-3xl p-12 shadow-sm relative overflow-hidden">
                {/* Background grid */}
                <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px]" />
                
                {/* Animated pulse rings */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-20 h-20 bg-emerald-500/10 rounded-full animate-ping" />
                    <div className="absolute w-14 h-14 bg-emerald-500/20 rounded-full animate-pulse" />
                    
                    <div className="relative w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <svg className="w-6 h-6 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                </div>

                <div className="text-center space-y-2 relative z-10">
                    <h3 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] animate-pulse">SISTEMA MÉDICO INDUSTRIAL</h3>
                    <p className="text-sm font-black text-zinc-800 uppercase tracking-wide">Obteniendo incidencias de pases autorizados...</p>
                    <p className="text-[10px] text-zinc-400 font-mono">ENLACE SEGURO CON LA CLÍNICA EL HERRERO</p>
                </div>

                {/* ECG Heartbeat SVG path */}
                <div className="w-48 h-6 relative overflow-hidden">
                    <svg className="w-full h-full stroke-emerald-500 stroke-[3] fill-none" viewBox="0 0 100 20">
                        <path d="M0,10 L30,10 L35,5 L40,15 L45,10 L50,10 L53,2 L57,18 L61,10 L65,10 L100,10" 
                              strokeDasharray="100" 
                              strokeDashoffset="100" 
                              className="animate-[ecg_1.8s_linear_infinite]" 
                        />
                    </svg>
                </div>

                <style>{`
                    @keyframes ecg {
                        0% { stroke-dashoffset: 100; }
                        50% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: -100; }
                    }
                `}</style>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative overflow-hidden">
            {/* Background ECG Heartbeat Line Watermark */}
            <div className="absolute top-0 right-0 w-80 h-32 opacity-[0.02] text-emerald-600 pointer-events-none z-0">
                <svg className="w-full h-full stroke-current stroke-1 fill-none" viewBox="0 0 100 20">
                    <path d="M0,10 L30,10 L35,5 L40,15 L45,10 L50,10 L53,2 L57,18 L61,10 L65,10 L100,10" />
                </svg>
            </div>

            {/* Header */}
            {isDoctorOrAdmin ? (
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-zinc-150 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform duration-300">
                            <Hospital className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-zinc-800 uppercase tracking-tight flex items-center gap-2">
                                Portal Clínico
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">RH & Clínicas</span>
                            </h1>
                            <p className="text-zinc-500 text-xs mt-0.5">Consulta de incidencias médicas autorizadas y registro diario de pases</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-zinc-150 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-zinc-500 via-zinc-400 to-zinc-300" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-200 group-hover:scale-105 transition-transform duration-300">
                            <ShieldAlert className="w-6 h-6 text-zinc-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-zinc-800 uppercase tracking-tight flex items-center gap-2">
                                Portal de Ausencias Médicas
                            </h1>
                            <p className="text-zinc-500 text-xs mt-0.5">Estado del personal con pases o consultas médicas activos</p>
                            <span className="inline-block mt-2 text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                🔒 Información confidencial — Solo motivo general de ausencia visible para jefes
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Counters & Date Filters */}
            {!isDoctorOrAdmin && (
                <div className="space-y-4">
                    <div className="flex flex-row gap-4">
                        <div className="flex-1 flex flex-col bg-zinc-50 border border-zinc-200 rounded-2xl p-4 shadow-sm">
                            <span className="text-3xl font-black text-zinc-800">{pases.length}</span>
                            <span className="text-xs font-bold text-zinc-500 uppercase mt-1">Total de ausencias</span>
                        </div>
                        <div className="flex-1 flex flex-col bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                            <span className="text-3xl font-black text-amber-800">
                                {pases.filter(p => !p.pacientes?.parentesco || p.pacientes?.parentesco.toUpperCase() === 'TITULAR' || p.pacientes?.parentesco.toUpperCase() === 'ELLA MISMA').length}
                            </span>
                            <span className="text-xs font-bold text-amber-600 uppercase mt-1">Trabajadores</span>
                        </div>
                        <div className="flex-1 flex flex-col bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm">
                            <span className="text-3xl font-black text-rose-800">
                                {pases.filter(p => p.pacientes?.parentesco && p.pacientes?.parentesco.toUpperCase() !== 'TITULAR' && p.pacientes?.parentesco.toUpperCase() !== 'ELLA MISMA').length}
                            </span>
                            <span className="text-xs font-bold text-rose-600 uppercase mt-1">Familiares</span>
                        </div>
                    </div>

                    {/* Date filter bar for Jefes */}
                    <div className="bg-white border border-zinc-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">Filtrar por Rango de Fechas:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Desde:</span>
                                <input 
                                    type="date" 
                                    value={fechaDesde} 
                                    onChange={e => setFechaDesde(e.target.value)} 
                                    className="bg-zinc-50 border border-zinc-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-emerald-500 text-zinc-700"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Hasta:</span>
                                <input 
                                    type="date" 
                                    value={fechaHasta} 
                                    onChange={e => setFechaHasta(e.target.value)} 
                                    className="bg-zinc-50 border border-zinc-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-emerald-500 text-zinc-700"
                                />
                            </div>
                            {(fechaDesde || fechaHasta) && (
                                <button 
                                    onClick={() => { setFechaDesde(''); setFechaHasta(''); }} 
                                    className="text-[10px] font-black text-rose-600 hover:text-rose-800 underline uppercase"
                                >
                                    Limpiar Fechas
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter bar */}
            {isDoctorOrAdmin ? (
                <div className="bg-white border border-zinc-150 p-5 rounded-3xl flex flex-wrap justify-between gap-4 items-center shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">Departamento:</span>
                        </div>
                        <select
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-black focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-zinc-700 min-w-[200px]"
                        >
                            <option value="">TODOS LOS DEPARTAMENTOS</option>
                            {departamentos.map(d => (
                                <option key={d.id_departamento} value={d.id_departamento}>{(d.departamento || '').toUpperCase()}</option>
                            ))}
                        </select>

                        {/* Date filters inside Admin filter bar */}
                        <div className="flex items-center gap-2 pl-4 border-l border-zinc-200">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <input 
                                type="date" 
                                value={fechaDesde} 
                                onChange={e => setFechaDesde(e.target.value)} 
                                className="bg-zinc-50 border border-zinc-200 text-[10px] font-bold rounded-lg px-2.5 py-1 text-zinc-700" 
                            />
                            <span className="text-[10px] text-zinc-400 font-bold">a</span>
                            <input 
                                type="date" 
                                value={fechaHasta} 
                                onChange={e => setFechaHasta(e.target.value)} 
                                className="bg-zinc-50 border border-zinc-200 text-[10px] font-bold rounded-lg px-2.5 py-1 text-zinc-700" 
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/80">
                        <span className="text-[9px] font-black text-zinc-500 uppercase px-2 flex items-center gap-1">
                            <Eye className="w-3 h-3 text-emerald-600" /> Vista:
                        </span>
                        <button
                            type="button"
                            onClick={() => setViewMode('compartido')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                                viewMode === 'compartido'
                                    ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                                    : 'text-zinc-600 hover:text-black hover:bg-zinc-200/50'
                            }`}
                        >
                            <span>🏢 Compartidos con Depto</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('solo_medicos')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                                viewMode === 'solo_medicos'
                                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                                    : 'text-zinc-600 hover:text-black hover:bg-zinc-200/50'
                            }`}
                        >
                            <FolderLock className="w-3 h-3" />
                            <span>🛡️ Privados (Sólo Médicos)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('todos')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                viewMode === 'todos'
                                    ? 'bg-zinc-900 text-white shadow-sm'
                                    : 'text-zinc-600 hover:text-black hover:bg-zinc-200/50'
                            }`}
                        >
                            <span>📋 Ver Todo el Expediente</span>
                        </button>
                    </div>
                </div>
            ) : (
                profile?.id_departamento && (
                    <div className="bg-emerald-50/50 border border-emerald-100/80 p-4.5 rounded-3xl text-xs font-semibold text-emerald-800 flex items-center gap-3 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                        <Building2 className="w-4.5 h-4.5 text-emerald-600" />
                        <span>Incidencias vigentes de su departamento: <strong className="text-emerald-950 font-black">{departamentos.find(d => d.id_departamento === profile.id_departamento)?.departamento || 'Cargando...'}</strong></span>
                    </div>
                )
            )}

            {/* Table */}
            {isDoctorOrAdmin ? (
            <div className="bg-white border border-zinc-150 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-150 bg-zinc-50/50 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                                <th className="px-6 py-4">Beneficiario / Paciente</th>
                                <th className="px-6 py-4">Departamento / Área</th>
                                <th className="px-6 py-4">Clasificación</th>
                                <th className="px-6 py-4">Ruta Clínica</th>
                                <th className="px-6 py-4">Vigencia</th>
                                <th className="px-6 py-4">Estatus y Privacidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 text-sm">
                            {pases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">
                                        Sin incidencias en esta vista ({viewMode === 'solo_medicos' ? 'No hay pases confidenciales / privados registrados' : 'No hay reportes médicos activos compartidos en esta sección'}).
                                    </td>
                                </tr>
                            ) : (
                                pases.map((p) => {
                                    const isTrabajador = (p.pacientes?.parentesco || '').toUpperCase() === 'ELLA MISMA' || !p.pacientes?.parentesco
                                    return (
                                        <tr key={p.id_pase} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-6 py-4.5">
                                                <div className="font-black text-zinc-800">
                                                    {p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''} ${p.empleados.apellido_materno || ''}`.trim() : 'PACIENTE NO ESPECIFICADO')}
                                                </div>
                                                <div className="text-[10px] text-zinc-400 font-mono mt-0.5 font-semibold">
                                                    ID/Folio: {p.empleados?.id_empleado || p.folio || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <div className="font-bold text-zinc-700">{p.empleados?.puesto || 'Población General'}</div>
                                                <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider mt-0.5">
                                                    {p.empleados?.departamento || 'Sin Asignar'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                {isTrabajador ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 font-black uppercase text-[9px] tracking-wider">Pase Médico</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-black uppercase text-[9px] tracking-wider">Acompañante Médico</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4.5 text-xs text-zinc-500 font-bold">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="bg-zinc-100 px-2 py-0.5 rounded font-black text-zinc-700">{p.clinica_origen?.nombre}</span>
                                                    <span className="text-zinc-400 font-normal">&rarr;</span>
                                                    <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-black">{p.clinica_destino?.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4.5 text-xs text-zinc-600 font-mono">
                                                <div>Salida: <span className="font-bold text-zinc-800">{p.fecha_salida}</span></div>
                                                <div>Retorno: <span className="font-bold text-zinc-800">{p.fecha_retorno || 'Abierto'}</span></div>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-black uppercase tracking-wider">
                                                        {p.estatus}
                                                    </span>
                                                    {isDoctorOrAdmin && (
                                                        p.compartido_departamentos ? (
                                                            <span className="text-[8px] font-black text-emerald-600 uppercase bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-200/60">
                                                                ✓ Visible en Depto
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] font-black text-purple-700 uppercase bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300 flex items-center gap-1 shadow-xs">
                                                                <FolderLock className="w-2.5 h-2.5" /> Confidencial (Sólo Médicos)
                                                            </span>
                                                        )
                                                    )}

                                                    {isDoctorOrAdmin && (
                                                        <button
                                                            onClick={() => {
                                                                setExtendingPase(p)
                                                                setNuevaFechaRetorno(p.fecha_retorno || '')
                                                            }}
                                                            className="text-[9px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200 mt-1"
                                                        >
                                                            <PlusCircle className="w-3 h-3" /> Ampliar Días
                                                        </button>
                                                    )}
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
            ) : (
                pases.length === 0 ? (
                    <div className="bg-white border border-emerald-100 rounded-3xl p-12 shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-lg font-black text-zinc-800 uppercase mb-2">Sin ausencias médicas reportadas en este período</h3>
                        <p className="text-sm text-zinc-500">Todo el personal del departamento se encuentra en sus actividades regulares.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pases.map((p) => {
                            const isTrabajador = !p.pacientes?.parentesco || p.pacientes?.parentesco.toUpperCase() === 'TITULAR' || p.pacientes?.parentesco.toUpperCase() === 'ELLA MISMA';
                            const tieneHotel = Boolean(p.requiere_hotel || p.hotel_nombre);

                            return (
                                <div key={p.id_pase} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 right-0 h-1 ${isTrabajador ? 'bg-rose-500' : 'bg-blue-500'}`} />

                                    <div className="space-y-1">
                                        <div className="font-black text-zinc-900 text-sm flex items-center justify-between">
                                            <span>
                                                {p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''} ${p.empleados.apellido_materno || ''}`.trim() : 'PACIENTE REGISTRADO')}
                                            </span>
                                            {(p.empleados?.id_empleado || p.folio) && (
                                                <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                                                    {p.empleados?.id_empleado ? `ID: ${p.empleados.id_empleado}` : `Folio: ${p.folio}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                                            {p.empleados?.departamento || 'Servicios Médicos / General'}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {/* Estatus del motivo */}
                                        {isTrabajador ? (
                                            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-2">
                                                <Heart className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                                <div>
                                                    <div>Trabajador Enfermo</div>
                                                    <div className="text-[9px] font-mono text-rose-600 font-normal">Ausencia por atención médica directa</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-2">
                                                <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                <div>
                                                    <div>Acompañante de Familiar</div>
                                                    <div className="text-[9px] font-mono text-blue-600 font-normal">Ausencia por apoyo en consulta/hospedaje</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Hospedaje Status */}
                                        {tieneHotel && (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                                <Hotel className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Pase de Hotel Autorizado ({p.hotel_nombre || 'Hotel Durango'})</span>
                                            </div>
                                        )}

                                        {/* Vigencia / Fechas */}
                                        <div className="bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-[11px] space-y-1 font-mono">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 font-bold">SALIDA:</span>
                                                <span className="font-black text-zinc-700">{p.fecha_salida || 'Inmediata'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 font-bold">RETORNO PREVISTO:</span>
                                                <span className="font-black text-emerald-700">{p.fecha_retorno || 'Pendiente / Abierto'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-zinc-100">
                                        <span className="text-[10px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                            {p.estatus || 'ACTIVO'}
                                        </span>

                                        {isDoctorOrAdmin && (
                                            <button
                                                onClick={() => {
                                                    setExtendingPase(p)
                                                    setNuevaFechaRetorno(p.fecha_retorno || '')
                                                }}
                                                className="text-[10px] font-black text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1"
                                            >
                                                <PlusCircle className="w-3 h-3" /> Ampliar Días
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {/* Modal para Ampliar Días */}
            {extendingPase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                            <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                                <PlusCircle className="w-5 h-5 text-blue-600" />
                                Ampliar Días de Pase / Hospedaje
                            </h3>
                            <button onClick={() => setExtendingPase(null)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleExtendPass} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Paciente / Trabajador</label>
                                <div className="text-sm font-black text-zinc-800 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                                    {extendingPase.pacientes?.nombre_completo || extendingPase.empleados?.nombre}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nueva Fecha de Retorno / Fin de Vigencia</label>
                                <input 
                                    type="date"
                                    required
                                    value={nuevaFechaRetorno}
                                    onChange={(e) => setNuevaFechaRetorno(e.target.value)}
                                    className="w-full text-sm font-bold border-zinc-300 rounded-xl p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Motivo Médico de la Ampliación</label>
                                <textarea
                                    rows={3}
                                    value={motivoExtension}
                                    onChange={(e) => setMotivoExtension(e.target.value)}
                                    placeholder="Ej. Requiere 3 días adicionales de reposo o tratamiento especializado..."
                                    className="w-full text-xs border-zinc-300 rounded-xl p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setExtendingPase(null)}
                                    className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingExtension}
                                    className="px-5 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-50"
                                >
                                    {savingExtension ? 'Guardando...' : 'Confirmar Ampliación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

