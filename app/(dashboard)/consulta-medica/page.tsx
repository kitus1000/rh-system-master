'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { 
    Hospital, Building2, Search, Heart, ShieldAlert, Users, ClipboardList, 
    FolderLock, Eye, Calendar, PlusCircle, Clock, Hotel, Stethoscope, Shield,
    UserCheck, AlertTriangle, FileText, CheckCircle2, RefreshCw, Settings,
    ToggleLeft, ToggleRight, Edit3, Save, Check, User
} from 'lucide-react'

export default function ConsultaMedicaPortal() {
    const { profile } = useAuth()
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState('')
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    
    // Main Tab State: 'departamento' (Operativo Jefes), 'control' (Centro de Mando Médicos), 'clinico' (Historial Clínico), 'hotel' (Hospedaje)
    const [activeTab, setActiveTab] = useState<'departamento' | 'control' | 'clinico' | 'hotel'>('departamento')
    
    // Search & Date Range Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')

    // Doctor clinical chart modal state
    const [selectedPaseExpediente, setSelectedPaseExpediente] = useState<any | null>(null)
    const [expedienteConsultas, setExpedienteConsultas] = useState<any[]>([])
    const [loadingExpediente, setLoadingExpediente] = useState(false)

    // Pass Extension Modal State (+ Días de Reposo)
    const [extendingPase, setExtendingPase] = useState<any | null>(null)
    const [nuevaFechaRetorno, setNuevaFechaRetorno] = useState('')
    const [motivoExtension, setMotivoExtension] = useState('')
    const [medicoAutorizaExtension, setMedicoAutorizaExtension] = useState('')
    const [savingExtension, setSavingExtension] = useState(false)

    // Edit Pass Modal State (Control de Información)
    const [editingPase, setEditingPase] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({
        fecha_salida: '',
        fecha_retorno: '',
        medico_refiere: '',
        compartido_departamentos: true,
        comentarios: ''
    })
    const [savingEdit, setSavingEdit] = useState(false)

    // Clean role evaluation
    const rolClean = (profile?.rol || '').toUpperCase()
    const isDoctorOrAdmin = rolClean.includes('MÉDICO') || 
                            rolClean.includes('MEDICO') ||
                            rolClean.includes('JEFE MÉDICO') ||
                            rolClean.includes('ADMINISTRADOR') || 
                            rolClean.includes('ADMINISTRATIVO') || 
                            rolClean.includes('RECURSOS HUMANOS') ||
                            (profile?.nombre_completo || '').toUpperCase().includes('RECURSOS')

    // Formatter to present clean DD/MM/YYYY dates
    const formatFecha = (dateStr?: string | null, fallbackDateStr?: string | null) => {
        const str = dateStr || fallbackDateStr
        if (!str) return 'Pendiente de valoración'
        if (str.toUpperCase().includes('INMEDIATA') || str.toUpperCase().includes('ABIERTO')) return 'Pendiente de valoración'
        
        const cleanStr = str.split('T')[0]
        const parts = cleanStr.split('-')
        if (parts.length === 3) {
            const [y, m, d] = parts
            return `${d}/${m}/${y}`
        }
        return cleanStr
    }

    // Helper to determine exact classification: Pase Médico vs Acompañante Médico
    const getClasificacionPase = (p: any) => {
        const parentesco = (p.parentesco || p.pacientes?.parentesco || '').toUpperCase().trim()
        const acompananteText = (p.acompanante || '').toUpperCase().trim()
        
        // 1. Check if parentesco explicitly indicates the worker/titular
        const isWorkerParentesco = !parentesco || 
            parentesco === 'TITULAR' || 
            parentesco.includes('TITULAR') || 
            parentesco.includes('ELLA MISMA') || 
            parentesco.includes('EL MISMO') || 
            parentesco.includes('MISMO TRABAJADOR') || 
            parentesco === 'TRABAJADOR'

        // 2. Check if parentesco explicitly indicates a family member / accompanying person
        const isFamilyRelation = parentesco.includes('HIJ') || 
            parentesco.includes('ESPOS') || 
            parentesco.includes('MADRE') || 
            parentesco.includes('PADRE') || 
            parentesco.includes('CONCUBIN') || 
            parentesco.includes('FAMILIAR') ||
            (parentesco.includes('ACOMPAÑANTE') && !parentesco.includes('ELLA MISMA') && !parentesco.includes('EL MISMO'))

        // 3. A pass is an Acompañante ONLY IF not worker parentesco and is family/accompanying
        const isAcompanante = !isWorkerParentesco && (
            Boolean(p.es_acompanante) || 
            isFamilyRelation ||
            (acompananteText && acompananteText !== 'NO' && acompananteText !== 'NO REQUIERE' && !acompananteText.includes('ELLA MISMA') && !acompananteText.includes('EL MISMO'))
        )

        if (isAcompanante) {
            return {
                isAcompanante: true,
                tipo: 'Acompañante Médico',
                badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
                desc: parentesco ? `Acompañando a familiar (${parentesco})` : 'Acompañante médico en traslado'
            }
        }

        return {
            isAcompanante: false,
            tipo: 'Pase Médico',
            badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
            desc: 'Trabajador Titular (Paciente Principal)'
        }
    }

    // Helper to detect if reposo was extended by doctor
    const getExtensionStatus = (p: any) => {
        const comentarios = p.comentarios || ''
        const hasExtension = comentarios.includes('[AMPLIACIÓN DÍAS') || comentarios.includes('AMPLIACIÓN DÍAS') || comentarios.includes('Ampliación')
        return {
            hasExtension,
            badge: hasExtension ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold' : null
        }
    }

    // Helper for Vigencia status
    const getVigenciaStatus = (p: any) => {
        const today = new Date().toISOString().split('T')[0]
        const estatus = (p.estatus || '').toUpperCase()
        
        if (estatus === 'CERRADO' || estatus === 'CONCLUIDO' || estatus === 'RETORNADO') {
            return {
                isClosed: true,
                label: 'CONCLUIDO / RETORNADO',
                badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-300 font-bold'
            }
        }
        
        if (p.fecha_retorno && p.fecha_retorno < today) {
            return {
                isClosed: true,
                label: 'VIGENCIA VENCIDA (REGRESADO)',
                badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 font-bold'
            }
        }
        
        return {
            isClosed: false,
            label: 'EN ATENCIÓN / VIGENTE',
            badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
        }
    }

    // Toggle visibility with departments (Control de Información)
    const handleToggleVisibilidad = async (paseId: string, currentVal: boolean) => {
        const newVal = !currentVal
        const { error } = await supabase
            .from('pases_medicos')
            .update({ compartido_departamentos: newVal })
            .eq('id_pase', paseId)

        if (error) {
            alert('Error al actualizar visibilidad: ' + error.message)
        } else {
            fetchPases()
        }
    }

    // Toggle/Close vigencia manually
    const handleToggleVigencia = async (paseId: string, currentStatus: string) => {
        const isCurrentlyClosed = (currentStatus === 'CERRADO' || currentStatus === 'CONCLUIDO' || currentStatus === 'RETORNADO')
        const newStatus = isCurrentlyClosed ? 'ACTIVO' : 'CONCLUIDO'
        const confirmMsg = isCurrentlyClosed 
            ? '¿Desea reabrir la vigencia de este pase médico?' 
            : '¿Desea cerrar la vigencia y marcar al trabajador como RETORNADO / REGRESADO A TRABAJAR?'
            
        if (!confirm(confirmMsg)) return

        const { error } = await supabase
            .from('pases_medicos')
            .update({ estatus: newStatus })
            .eq('id_pase', paseId)

        if (error) {
            alert('Error al actualizar estatus: ' + error.message)
        } else {
            fetchPases()
        }
    }

    // Doctor clinical history lookup
    const openExpedienteClinico = async (pase: any) => {
        setSelectedPaseExpediente(pase)
        setLoadingExpediente(true)
        try {
            const pacId = pase.id_paciente
            let consultasQuery = supabase.from('consultas_medicas').select('*').order('fecha', { ascending: false })
            if (pacId) {
                consultasQuery = consultasQuery.eq('id_paciente', pacId)
            }
            const { data: cData } = await consultasQuery
            setExpedienteConsultas(cData || [])
        } catch (err) {
            console.error('Error fetching clinical chart:', err)
        } finally {
            setLoadingExpediente(false)
        }
    }

    useEffect(() => {
        fetchDepartamentos()
        fetchPases()

        const timer = setTimeout(() => {
            setLoading(false)
        }, 3000)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        fetchPases()
    }, [selectedDept, profile, activeTab, fechaDesde, fechaHasta])

    const fetchDepartamentos = async () => {
        const { data } = await supabase
            .from('cat_departamentos')
            .select('*')
            .order('departamento')
        if (data) {
            setDepartamentos(data)
            if (!isDoctorOrAdmin && profile?.id_departamento) {
                setSelectedDept(profile.id_departamento)
            }
        }
    }

    const fetchPases = async () => {
        setLoading(true)
        try {
            let activeDeptId = selectedDept
            
            let allowedDepts: string[] = []
            if (!isDoctorOrAdmin) {
                if (profile?.departamentos_autorizados && profile.departamentos_autorizados.length > 0) {
                    allowedDepts = profile.departamentos_autorizados
                } else if (profile?.id_departamento) {
                    allowedDepts = [profile.id_departamento]
                }
                
                if (activeDeptId && !allowedDepts.includes(activeDeptId)) {
                    setPases([])
                    setLoading(false)
                    return
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
                console.warn('Primary query fallback triggered:', error)
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

            // Filter by date range
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

            // Client-side role and department filtering
            if (!isDoctorOrAdmin) {
                // Non-doctors ONLY see passes marked as shared with departments
                filteredPases = filteredPases.filter(p => p.compartido_departamentos !== false)

                if (activeDeptId) {
                    filteredPases = filteredPases.filter(p => {
                        const empDeptName = p.empleados?.departamento
                        if (!empDeptName || empDeptName === 'Sin Asignar') return true
                        const matchedDept = departamentos.find(d => d.departamento?.toLowerCase().trim() === empDeptName.toLowerCase().trim())
                        const empDeptId = matchedDept?.id_departamento
                        if (!empDeptId) return true
                        return empDeptId === activeDeptId
                    })
                } else if (allowedDepts.length > 0) {
                    filteredPases = filteredPases.filter(p => {
                        const empDeptName = p.empleados?.departamento
                        if (!empDeptName || empDeptName === 'Sin Asignar') return true
                        const matchedDept = departamentos.find(d => d.departamento?.toLowerCase().trim() === empDeptName.toLowerCase().trim())
                        const empDeptId = matchedDept?.id_departamento
                        if (!empDeptId) return true
                        return allowedDepts.includes(empDeptId)
                    })
                }
            } else {
                if (activeDeptId) {
                    filteredPases = filteredPases.filter(p => {
                        const empDeptName = p.empleados?.departamento
                        if (!empDeptName || empDeptName === 'Sin Asignar') return true
                        const matchedDept = departamentos.find(d => d.departamento?.toLowerCase().trim() === empDeptName.toLowerCase().trim())
                        const empDeptId = matchedDept?.id_departamento
                        if (!empDeptId) return true
                        return empDeptId === activeDeptId
                    })
                }
            }

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
            const doctorNombre = medicoAutorizaExtension.trim() || profile?.nombre_completo || 'Médico de Turno'
            const notaExtension = `[AMPLIACIÓN DÍAS: Nueva fecha ${nuevaFechaRetorno}. Autoriza: ${doctorNombre}. Motivo: ${motivoExtension || 'Diagnóstico médico ampliado'}]`
            const nuevosComentarios = comentariosPrevios ? `${comentariosPrevios}\n${notaExtension}` : notaExtension

            const { error } = await supabase
                .from('pases_medicos')
                .update({ 
                    fecha_retorno: nuevaFechaRetorno,
                    medico_refiere: doctorNombre,
                    comentarios: nuevosComentarios
                })
                .eq('id_pase', extendingPase.id_pase)

            if (error) throw error

            alert('Vigencia ampliada con éxito. Los departamentos verán la nueva fecha de regreso.')
            setExtendingPase(null)
            setNuevaFechaRetorno('')
            setMotivoExtension('')
            setMedicoAutorizaExtension('')
            fetchPases()
        } catch (err: any) {
            alert('Error al ampliar días: ' + err.message)
        } finally {
            setSavingExtension(false)
        }
    }

    // Handle full pass edit from Control de Información
    const handleStartEdit = (p: any) => {
        setEditingPase(p)
        setEditForm({
            fecha_salida: p.fecha_salida || (p.creado_el ? p.creado_el.split('T')[0] : ''),
            fecha_retorno: p.fecha_retorno || '',
            medico_refiere: p.medico_refiere || profile?.nombre_completo || '',
            compartido_departamentos: p.compartido_departamentos !== false,
            comentarios: p.comentarios || ''
        })
    }

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingPase) return
        setSavingEdit(true)
        try {
            const { error } = await supabase
                .from('pases_medicos')
                .update({
                    fecha_salida: editForm.fecha_salida || null,
                    fecha_retorno: editForm.fecha_retorno || null,
                    medico_refiere: editForm.medico_refiere || null,
                    compartido_departamentos: editForm.compartido_departamentos,
                    comentarios: editForm.comentarios
                })
                .eq('id_pase', editingPase.id_pase)

            if (error) throw error

            alert('Información del pase actualizada exitosamente.')
            setEditingPase(null)
            fetchPases()
        } catch (err: any) {
            alert('Error al guardar cambios: ' + err.message)
        } finally {
            setSavingEdit(false)
        }
    }

    // Filtered pases based on active Tab & Search
    const searchFilteredPases = pases.filter(p => {
        const name = (p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''}` : '')).toLowerCase()
        const folio = (p.folio || p.id_pase || '').toLowerCase()
        const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || folio.includes(searchTerm.toLowerCase())
        
        if (activeTab === 'hotel') {
            const tieneHotel = Boolean(p.requiere_hotel || p.hotel_nombre)
            return matchesSearch && tieneHotel
        }
        return matchesSearch
    })

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-6 bg-white border border-zinc-200 rounded-3xl p-12 shadow-xs relative overflow-hidden">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-20 h-20 bg-emerald-500/10 rounded-full animate-ping" />
                    <div className="relative w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <svg className="w-6 h-6 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                </div>
                <div className="text-center space-y-2 relative z-10">
                    <h3 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] animate-pulse">SISTEMA MÉDICO INDUSTRIAL</h3>
                    <p className="text-sm font-black text-zinc-800 uppercase tracking-wide">Cargando ausencias médicas y pases vigentes...</p>
                    <p className="text-[10px] text-zinc-400 font-mono">UNIDAD MINERA BACIS — EL HERRERO</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative overflow-hidden font-sans">
            {/* Header Principal */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-zinc-200 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                        <Hospital className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-zinc-800 uppercase tracking-tight flex items-center gap-2">
                            Portal de Ausencias Médicas
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">Unidad Bacis</span>
                        </h1>
                        <p className="text-zinc-500 text-xs mt-0.5">Control operativo de personal incapacitado, vigencia de retornos y hospedaje en Durango</p>
                    </div>
                </div>

                {!isDoctorOrAdmin && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-900 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>🔒 Privacidad Activa: Información diagnóstica protegida para Jefes de Área</span>
                    </div>
                )}
            </div>

            {/* KPI Summary Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
                    <div className="text-2xl font-black text-zinc-900">{pases.length}</div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">Total Ausencias</div>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 shadow-xs">
                    <div className="text-2xl font-black text-emerald-900">
                        {pases.filter(p => !getClasificacionPase(p).isAcompanante).length}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-700 uppercase mt-0.5">Trabajadores Titulares</div>
                </div>
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs">
                    <div className="text-2xl font-black text-amber-900">
                        {pases.filter(p => getClasificacionPase(p).isAcompanante).length}
                    </div>
                    <div className="text-[10px] font-bold text-amber-700 uppercase mt-0.5">Acompañantes Autorizados</div>
                </div>
                <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 shadow-xs">
                    <div className="text-2xl font-black text-purple-900">
                        {pases.filter(p => Boolean(p.requiere_hotel || p.hotel_nombre)).length}
                    </div>
                    <div className="text-[10px] font-bold text-purple-700 uppercase mt-0.5">Pases de Hotel Activos</div>
                </div>
            </div>

            {/* Navigation Tabs (Central Concentrador) */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-100 rounded-2xl border border-zinc-200">
                <button
                    onClick={() => setActiveTab('departamento')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'departamento'
                            ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200'
                            : 'text-zinc-500 hover:text-black'
                    }`}
                >
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>🏢 Resumen para Departamentos</span>
                </button>

                {isDoctorOrAdmin && (
                    <button
                        onClick={() => setActiveTab('control')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'control'
                                ? 'bg-amber-500 text-black shadow-md font-extrabold'
                                : 'text-zinc-600 hover:text-black font-bold'
                        }`}
                    >
                        <Settings className="w-4 h-4 text-black animate-spin-slow" />
                        <span>⚙️ Control de Información (Médicos)</span>
                    </button>
                )}

                {isDoctorOrAdmin && (
                    <button
                        onClick={() => setActiveTab('clinico')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'clinico'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                : 'text-zinc-500 hover:text-black'
                        }`}
                    >
                        <Stethoscope className="w-4 h-4" />
                        <span>🛡️ Expediente Clínico Completo</span>
                    </button>
                )}

                <button
                    onClick={() => setActiveTab('hotel')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'hotel'
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                            : 'text-zinc-500 hover:text-black'
                    }`}
                >
                    <Hotel className="w-4 h-4" />
                    <span>🏨 Hospedaje & Traslados</span>
                </button>
            </div>

            {/* Filters Bar: Search, Department, Dates */}
            <div className="bg-white border border-zinc-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative min-w-[220px]">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Buscar trabajador o folio..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    {/* Department Dropdown */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase">Depto:</span>
                        <select
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            disabled={!isDoctorOrAdmin && Boolean(profile?.id_departamento)}
                            className="bg-zinc-50 border border-zinc-200 text-xs font-bold rounded-xl px-3 py-1.5 text-zinc-800 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="">TODOS LOS DEPARTAMENTOS</option>
                            {departamentos.map(d => (
                                <option key={d.id_departamento} value={d.id_departamento}>{(d.departamento || '').toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={e => setFechaDesde(e.target.value)}
                            className="bg-zinc-50 border border-zinc-200 text-[10px] font-bold rounded-xl px-2.5 py-1 text-zinc-700"
                        />
                        <span className="text-[10px] text-zinc-400 font-bold">a</span>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={e => setFechaHasta(e.target.value)}
                            className="bg-zinc-50 border border-zinc-200 text-[10px] font-bold rounded-xl px-2.5 py-1 text-zinc-700"
                        />
                        {(fechaDesde || fechaHasta) && (
                            <button onClick={() => { setFechaDesde(''); setFechaHasta(''); }} className="text-[10px] font-black text-rose-600 hover:underline">Limpiar</button>
                        )}
                    </div>
                </div>

                <button onClick={fetchPases} className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                </button>
            </div>

            {/* TAB 1: RESUMEN PARA DEPARTAMENTOS (OPERATIVO / JEFES) */}
            {activeTab === 'departamento' && (
                <div className="space-y-4">
                    {searchFilteredPases.length === 0 ? (
                        <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-black text-zinc-800 uppercase">Sin ausencias reportadas en este departamento</h3>
                            <p className="text-xs text-zinc-500">Todo el personal del área se encuentra en sus actividades regulares.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {searchFilteredPases.map(p => {
                                const clasif = getClasificacionPase(p)
                                const vig = getVigenciaStatus(p)
                                const ext = getExtensionStatus(p)
                                const tieneHotel = Boolean(p.requiere_hotel || p.hotel_nombre)

                                return (
                                    <div key={p.id_pase} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${clasif.isAcompanante ? 'bg-amber-500' : 'bg-emerald-500'}`} />

                                        <div className="space-y-1 pt-1">
                                            <div className="font-black text-zinc-900 text-sm flex items-center justify-between gap-2">
                                                <span className="truncate">
                                                    {p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''}` : 'TRABAJADOR REGISTRADO')}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                                                    ID: {p.empleados?.id_empleado || p.folio || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                                                {p.empleados?.departamento || 'Departamento Minero / General'}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {/* Clasificación */}
                                            <div className={`p-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-2 border ${clasif.badgeClass}`}>
                                                {clasif.isAcompanante ? <Users className="w-4 h-4 text-amber-700 flex-shrink-0" /> : <Heart className="w-4 h-4 text-emerald-700 flex-shrink-0" />}
                                                <div>
                                                    <div>{clasif.tipo}</div>
                                                    <div className="text-[9px] font-mono font-normal opacity-90">{clasif.desc}</div>
                                                </div>
                                            </div>

                                            {/* Alerta de Reposo Ampliado por Doctor */}
                                            {ext.hasExtension && (
                                                <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                                                    <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                                    <span>ℹ️ Reposo médico ampliado por doctor</span>
                                                </div>
                                            )}

                                            {/* Hospedaje Status */}
                                            {tieneHotel && (
                                                <div className="bg-purple-50 border border-purple-200 text-purple-900 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                                    <Hotel className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                                    <span>Pase de Hotel Autorizado ({p.hotel_nombre || 'Hotel Durango'})</span>
                                                </div>
                                            )}

                                            {/* Vigencia / Fechas Legibles de Calendario */}
                                            <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl text-[11px] space-y-1.5 font-mono">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-zinc-400 font-bold text-[10px]">🚀 SALIDA DE MINA:</span>
                                                    <span className="font-black text-zinc-900">{formatFecha(p.fecha_salida, p.creado_el)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-zinc-400 font-bold text-[10px]">🛬 RETORNO PREVISTO:</span>
                                                    <span className="font-black text-emerald-700">{formatFecha(p.fecha_retorno)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer con Estatus */}
                                        <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-zinc-100">
                                            <div className="flex justify-between items-center">
                                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${vig.badgeClass}`}>
                                                    {vig.label}
                                                </span>
                                                {isDoctorOrAdmin && (
                                                    <button
                                                        onClick={() => handleToggleVigencia(p.id_pase, p.estatus)}
                                                        className="text-[9px] font-black text-zinc-600 hover:text-zinc-900 underline"
                                                    >
                                                        {vig.isClosed ? '🔓 Reabrir' : '🔒 Marcar Regresado'}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="text-[9px] text-zinc-400 italic text-center font-medium">
                                                🔒 Diagnóstico y receta protegidos por privacidad médica
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: CONTROL DE INFORMACIÓN (CENTRO DE MANDO MÉDICOS & ADMIN) */}
            {activeTab === 'control' && isDoctorOrAdmin && (
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <h3 className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                                <Settings className="w-4 h-4 text-amber-600" /> Centro de Control y Ajustes de Ausencias Médicas
                            </h3>
                            <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                                Concentrador de pases y consultas. Ajusta fechas reales de salida/retorno, asigna el Médico Autorizante y activa/desactiva la visibilidad para los departamentos.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                                        <th className="px-6 py-4">Paciente / Folio</th>
                                        <th className="px-6 py-4">Departamento</th>
                                        <th className="px-6 py-4">👨‍⚕️ Doctor / Clínica Autoriza</th>
                                        <th className="px-6 py-4">📅 Fechas Reales (Salida / Retorno)</th>
                                        <th className="px-6 py-4">📢 Compartido Deptos</th>
                                        <th className="px-6 py-4">Acciones de Control</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 text-xs font-semibold">
                                    {searchFilteredPases.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
                                                No hay registros de ausencias en esta vista.
                                            </td>
                                        </tr>
                                    ) : (
                                        searchFilteredPases.map(p => {
                                            const clasif = getClasificacionPase(p)
                                            const vig = getVigenciaStatus(p)
                                            const isShared = p.compartido_departamentos !== false

                                            return (
                                                <tr key={p.id_pase} className="hover:bg-zinc-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-black text-zinc-900">
                                                            {p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''}` : 'PACIENTE')}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                                            Folio: {p.folio || p.id_pase}
                                                        </div>
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] uppercase mt-1 ${clasif.badgeClass}`}>
                                                            {clasif.tipo}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-zinc-800">{p.empleados?.puesto || 'General'}</div>
                                                        <div className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">
                                                            {p.empleados?.departamento || 'Sin Asignar'}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-zinc-900 flex items-center gap-1">
                                                            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                            <span>{p.medico_refiere || 'Médico Bacis / Turno'}</span>
                                                        </div>
                                                        <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                                            Destino: {p.clinica_destino?.nombre || 'Durango / Externo'}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 font-mono text-[11px]">
                                                        <div className="flex items-center gap-1 text-zinc-700">
                                                            <span className="text-zinc-400 text-[10px]">🚀 Salida:</span>
                                                            <span className="font-bold">{formatFecha(p.fecha_salida, p.creado_el)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-emerald-800">
                                                            <span className="text-zinc-400 text-[10px]">🛬 Retorno:</span>
                                                            <span className="font-black">{formatFecha(p.fecha_retorno)}</span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => handleToggleVisibilidad(p.id_pase, isShared)}
                                                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-xs ${
                                                                isShared 
                                                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                                                                    : 'bg-zinc-100 text-zinc-500 border border-zinc-300'
                                                            }`}
                                                        >
                                                            {isShared ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                                                            <span>{isShared ? '📢 Publicado' : '🔒 Privado'}</span>
                                                        </button>
                                                    </td>

                                                    <td className="px-6 py-4 space-y-1.5">
                                                        <button
                                                            onClick={() => handleStartEdit(p)}
                                                            className="w-full text-[9px] font-black text-amber-900 hover:text-black bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <Edit3 className="w-3 h-3 text-amber-700" />
                                                            <span>Editar Fechas & Doctor</span>
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                setExtendingPase(p)
                                                                setNuevaFechaRetorno(p.fecha_retorno || '')
                                                                setMedicoAutorizaExtension(p.medico_refiere || profile?.nombre_completo || '')
                                                            }}
                                                            className="w-full text-[9px] font-black text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <PlusCircle className="w-3 h-3 text-blue-600" />
                                                            <span>+ Ampliar Reposo</span>
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
                </div>
            )}

            {/* TAB 3: EXPEDIENTE CLÍNICO COMPLETO (MÉDICOS & ADMIN) */}
            {activeTab === 'clinico' && isDoctorOrAdmin && (
                <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                                    <th className="px-6 py-4">Paciente / Beneficiario</th>
                                    <th className="px-6 py-4">Departamento / Puesto</th>
                                    <th className="px-6 py-4">Clasificación & Diagnóstico</th>
                                    <th className="px-6 py-4">Ruta Clínica</th>
                                    <th className="px-6 py-4">Fechas Vigencia</th>
                                    <th className="px-6 py-4">Acciones Clínicas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 text-xs font-semibold">
                                {searchFilteredPases.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
                                            No hay expedientes clínicos registrados en esta vista.
                                        </td>
                                    </tr>
                                ) : (
                                    searchFilteredPases.map(p => {
                                        const clasif = getClasificacionPase(p)
                                        const vig = getVigenciaStatus(p)
                                        const ext = getExtensionStatus(p)

                                        return (
                                            <tr key={p.id_pase} className="hover:bg-zinc-50 transition-colors">
                                                <td className="px-6 py-4.5">
                                                    <div className="font-black text-zinc-900">
                                                        {p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''}` : 'PACIENTE')}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                                        Folio: {p.folio || p.id_pase}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4.5">
                                                    <div className="font-bold text-zinc-800">{p.empleados?.puesto || 'General'}</div>
                                                    <div className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">
                                                        {p.empleados?.departamento || 'Sin Asignar'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4.5 space-y-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase ${clasif.badgeClass}`}>
                                                        {clasif.tipo}
                                                    </span>
                                                    {ext.hasExtension && (
                                                        <span className="block text-[9px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                            ⏱️ REPOSO AMPLIADO
                                                        </span>
                                                    )}
                                                    {p.motivo && (
                                                        <div className="text-[10px] text-zinc-600 font-mono line-clamp-2">
                                                            <strong>Dx:</strong> {p.motivo}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                        <span className="bg-zinc-100 px-2 py-0.5 rounded">{p.clinica_origen?.nombre || 'Herrero'}</span>
                                                        <span>&rarr;</span>
                                                        <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded">{p.clinica_destino?.nombre || 'Durango / Externo'}</span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                                        👨‍⚕️ {p.medico_refiere || 'Médico General'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4.5 text-[10px] font-mono">
                                                    <div>Salida: <strong>{formatFecha(p.fecha_salida, p.creado_el)}</strong></div>
                                                    <div>Retorno: <strong className="text-emerald-700">{formatFecha(p.fecha_retorno)}</strong></div>
                                                </td>
                                                <td className="px-6 py-4.5 space-y-1.5">
                                                    <button
                                                        onClick={() => openExpedienteClinico(p)}
                                                        className="w-full text-[9px] font-black text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <Stethoscope className="w-3 h-3 text-emerald-600" />
                                                        <span>Expediente & Recetas</span>
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

            {/* TAB 4: HOSPEDAJE & TRASLADOS EN DURANGO */}
            {activeTab === 'hotel' && (
                <div className="space-y-4">
                    {searchFilteredPases.length === 0 ? (
                        <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl mx-auto flex items-center justify-center">
                                <Hotel className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-black text-zinc-800 uppercase">Sin pases de hotel activos</h3>
                            <p className="text-xs text-zinc-500">No hay personal hospedado en Durango en este período.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {searchFilteredPases.map(p => {
                                return (
                                    <div key={p.id_pase} className="bg-white border border-purple-200 rounded-2xl p-5 shadow-xs space-y-3 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-500" />
                                        
                                        <div className="flex justify-between items-start pt-1">
                                            <div>
                                                <div className="font-black text-zinc-900 text-sm">
                                                    {p.pacientes?.nombre_completo || p.nombre_trabajador || (p.empleados ? `${p.empleados.nombre || ''} ${p.empleados.apellido_paterno || ''}` : 'PACIENTE')}
                                                </div>
                                                <div className="text-[10px] text-purple-700 font-bold uppercase mt-0.5">
                                                    {p.empleados?.departamento || 'Mina Bacis'}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded">
                                                HOTEL AUTORIZADO
                                            </span>
                                        </div>

                                        <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-xl text-xs space-y-1">
                                            <div className="font-black text-purple-950 flex items-center gap-1.5">
                                                <Hotel className="w-4 h-4 text-purple-600" />
                                                <span>{p.hotel_nombre || 'Hotel Durango'}</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-600 font-mono">
                                                Acompañante: <strong>{p.acompanante || 'NO REQUIERE'}</strong>
                                            </div>
                                        </div>

                                        <div className="bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-[11px] font-mono flex justify-between">
                                            <span>Entrada: <strong>{formatFecha(p.fecha_salida, p.creado_el)}</strong></span>
                                            <span>Salida Prevista: <strong className="text-purple-700">{formatFecha(p.fecha_retorno)}</strong></span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DE EDICIÓN RÁPIDA (CONTROL DE INFORMACIÓN) */}
            {editingPase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                            <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                                <Settings className="w-5 h-5 text-amber-600" />
                                Ajustar Información de Ausencia
                            </h3>
                            <button onClick={() => setEditingPase(null)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Paciente / Trabajador</label>
                                <div className="text-sm font-black text-zinc-800 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                                    {editingPase.pacientes?.nombre_completo || editingPase.empleados?.nombre}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Salida Mina</label>
                                    <input 
                                        type="date"
                                        value={editForm.fecha_salida}
                                        onChange={(e) => setEditForm({ ...editForm, fecha_salida: e.target.value })}
                                        className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Retorno Previsto</label>
                                    <input 
                                        type="date"
                                        value={editForm.fecha_retorno}
                                        onChange={(e) => setEditForm({ ...editForm, fecha_retorno: e.target.value })}
                                        className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">👨‍⚕️ Médico / Doctor Autorizante</label>
                                <input 
                                    type="text"
                                    required
                                    value={editForm.medico_refiere}
                                    onChange={(e) => setEditForm({ ...editForm, medico_refiere: e.target.value })}
                                    placeholder="Ej. Dr. Adriana / Consultorio Bacis"
                                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                                />
                            </div>

                            <div>
                                <label className="flex items-center space-x-2 cursor-pointer bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                                    <input 
                                        type="checkbox"
                                        checked={editForm.compartido_departamentos}
                                        onChange={(e) => setEditForm({ ...editForm, compartido_departamentos: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-bold text-zinc-800">📢 Publicar y compartir fechas con Departamentos</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Notas / Observaciones</label>
                                <textarea
                                    rows={2}
                                    value={editForm.comentarios}
                                    onChange={(e) => setEditForm({ ...editForm, comentarios: e.target.value })}
                                    className="w-full text-xs border-zinc-300 rounded-xl p-2.5"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingPase(null)}
                                    className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEdit}
                                    className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50"
                                >
                                    {savingEdit ? 'Guardando...' : 'Guardar Ajustes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE AMPLIACIÓN DE DÍAS DE REPOSO (+ DÍAS / DOCTOR) */}
            {extendingPase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                            <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                                <PlusCircle className="w-5 h-5 text-blue-600" />
                                Ampliar Días de Reposo Médico
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
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nueva Fecha de Retorno Prevista</label>
                                <input 
                                    type="date"
                                    required
                                    value={nuevaFechaRetorno}
                                    onChange={(e) => setNuevaFechaRetorno(e.target.value)}
                                    className="w-full text-sm font-bold border-zinc-300 rounded-xl p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">👨‍⚕️ Médico / Doctor Autorizante</label>
                                <input 
                                    type="text"
                                    required
                                    value={medicoAutorizaExtension}
                                    onChange={(e) => setMedicoAutorizaExtension(e.target.value)}
                                    placeholder="Nombre del médico tratante que autoriza"
                                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Motivo Médico de la Ampliación</label>
                                <textarea
                                    rows={3}
                                    value={motivoExtension}
                                    onChange={(e) => setMotivoExtension(e.target.value)}
                                    placeholder="Ej. Se extiende incapacidad por 3 días más debido a evolución del padecimiento..."
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

            {/* MODAL DE EXPEDIENTE CLÍNICO COMPLETO PARA MÉDICOS Y JEFE MÉDICO */}
            {selectedPaseExpediente && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-zinc-200 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
                            <div>
                                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">EXPEDIENTE MÉDICO INDUSTRIAL & FARMACIA</span>
                                <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight">
                                    {selectedPaseExpediente.pacientes?.nombre_completo || selectedPaseExpediente.nombre_trabajador || 'EXPEDIENTE CLÍNICO'}
                                </h2>
                                <p className="text-xs text-zinc-500 font-semibold">
                                    Puesto: {selectedPaseExpediente.empleados?.puesto || 'General'} | Depto: {selectedPaseExpediente.empleados?.departamento || 'Mina'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedPaseExpediente(null)} 
                                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Detalles del Pase Actual */}
                        <div className="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-emerald-950 uppercase">PASE MÉDICO # {selectedPaseExpediente.folio || selectedPaseExpediente.id_pase}</span>
                                <span className="text-[10px] font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded uppercase">
                                    {selectedPaseExpediente.estatus || 'ACTIVO'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div>🚀 Fecha Salida: <strong>{formatFecha(selectedPaseExpediente.fecha_salida, selectedPaseExpediente.creado_el)}</strong></div>
                                <div>🛬 Retorno Previsto: <strong>{formatFecha(selectedPaseExpediente.fecha_retorno)}</strong></div>
                            </div>
                            <div className="text-xs text-zinc-700 bg-white p-2.5 rounded-xl border border-emerald-100 mt-2 font-mono">
                                <strong>👨‍⚕️ Médico Responsable:</strong> {selectedPaseExpediente.medico_refiere || 'Consultorio Médico Bacis'}
                            </div>
                            {selectedPaseExpediente.comentarios && (
                                <div className="text-xs text-zinc-700 bg-white p-2.5 rounded-xl border border-emerald-100 mt-2">
                                    <strong>Notas Médicas del Pase:</strong> {selectedPaseExpediente.comentarios}
                                </div>
                            )}
                        </div>

                        {/* Historial de Consultas Médicas & Recetas */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                                <Stethoscope className="w-4 h-4 text-emerald-600" />
                                Historial de Consultas & Recetas Surtidas
                            </h3>

                            {loadingExpediente ? (
                                <div className="p-8 text-center text-xs text-zinc-400 animate-pulse font-bold">
                                    Cargando historial médico y recetas...
                                </div>
                            ) : expedienteConsultas.length === 0 ? (
                                <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-zinc-200">
                                    No hay consultas médicas o recetas previas registradas directamente en el sistema para este paciente.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {expedienteConsultas.map((c: any) => (
                                        <div key={c.id_consulta} className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl space-y-2">
                                            <div className="flex justify-between items-center border-b border-zinc-200/80 pb-2">
                                                <span className="text-xs font-bold text-zinc-700 font-mono">📅 Fecha: {formatFecha(c.fecha, c.creado_el)}</span>
                                                <span className="text-[10px] font-black bg-blue-100 text-blue-900 px-2 py-0.5 rounded">CONSULTA # {c.id_consulta}</span>
                                            </div>

                                            <div>
                                                <div className="text-[10px] font-bold text-zinc-400 uppercase">Diagnóstico Clínico:</div>
                                                <div className="text-xs font-bold text-zinc-800 mt-0.5">{c.diagnostico || 'Atención Médica General'}</div>
                                            </div>

                                            {c.notas_tratamiento && (
                                                <div>
                                                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Tratamiento / Receta Surtida:</div>
                                                    <div className="text-xs text-emerald-900 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 mt-0.5 font-mono">
                                                        {c.notas_tratamiento}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={() => setSelectedPaseExpediente(null)}
                                className="px-5 py-2 text-xs font-black bg-zinc-800 text-white rounded-xl hover:bg-zinc-900"
                            >
                                Cerrar Expediente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
