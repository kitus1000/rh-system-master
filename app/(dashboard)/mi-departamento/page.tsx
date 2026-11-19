'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  Building2,
  HardHat,
  Stethoscope,
  Users,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  QrCode,
  Calendar,
  Clock,
  Heart,
  Hotel,
  Search,
  RefreshCw,
  ShieldCheck,
  Download,
  FileText,
  UserCheck,
  AlertTriangle,
  X,
  CalendarPlus,
} from 'lucide-react'
import { formatShortDate, diffDaysInclusive } from '@/utils/contratistasConfig'
import {
  generateContractorCredentialPDF,
  BADGE_SIZE_OPTIONS,
  BadgeSizeFormat,
} from '@/utils/contratistaBadgePdf'

export default function MiDepartamentoPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'contratistas' | 'pases' | 'plantilla' | 'permisos'>('contratistas')

  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<string>('')

  // Datos cargados
  const [empleadosAll, setEmpleadosAll] = useState<any[]>([])
  const [pasesAll, setPasesAll] = useState<any[]>([])
  const [solicitudesContratistas, setSolicitudesContratistas] = useState<any[]>([])
  const [credencialesContratistas, setCredencialesContratistas] = useState<any[]>([])
  const [prorrogasContratistas, setProrrogasContratistas] = useState<any[]>([])
  const [solicitudesInternas, setSolicitudesInternas] = useState<any[]>([])

  // Filtros internos
  const [paseFilterType, setPaseFilterType] = useState<'todos' | 'titular' | 'acompanante' | 'vigentes'>('todos')
  const [searchWorker, setSearchWorker] = useState('')
  const [badgeSizeFormat, setBadgeSizeFormat] = useState<BadgeSizeFormat>('gafete_medio')

  // Chat con Contratista
  const [chatSolicitud, setChatSolicitud] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')

  const rolUpper = (profile?.rol || '').toUpperCase()
  const isGlobalViewer =
    rolUpper.includes('ADMIN') ||
    rolUpper.includes('RECURSOS HUMANOS') ||
    rolUpper.includes('SUPERINTENDENTE') ||
    rolUpper.includes('SISTEMAS')

  useEffect(() => {
    fetchAllDepartmentData()
  }, [profile, user])

  const normalizeText = (str?: string | null) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const fetchAllDepartmentData = async () => {
    setLoading(true)
    try {
      const { data: deptsData } = await supabase
        .from('cat_departamentos')
        .select('*')
        .eq('activo', true)
        .order('departamento')

      const depts = deptsData || []
      setDepartamentos(depts)

      // Determinar el departamento del usuario logueado
      let initialDeptId = selectedDeptId
      if (!initialDeptId && depts.length > 0) {
        const profDeptId =
          profile?.id_departamento ||
          (profile?.departamentos_autorizados && profile.departamentos_autorizados[0]) ||
          user?.user_metadata?.id_departamento

        if (profDeptId && depts.some((d) => String(d.id_departamento) === String(profDeptId))) {
          initialDeptId = String(profDeptId)
        } else {
          // Buscar por nombre del usuario (ej. "Jefe Planta de Beneficio")
          const uName = normalizeText(profile?.nombre_completo || user?.email || '')
          const matchedByName = depts.find((d) => {
            const dClean = normalizeText(d.departamento)
            return dClean && (uName.includes(dClean) || dClean.split(' ').some((w: string) => w.length > 4 && uName.includes(w)))
          })
          initialDeptId = matchedByName ? String(matchedByName.id_departamento) : String(depts[0].id_departamento)
        }
        setSelectedDeptId(initialDeptId)
      }

      // Cargar Empleados con sus adscripciones
      let empList: any[] = []
      const empRes = await supabase
        .from('empleados')
        .select(`
          *,
          empleado_adscripciones (
            id_departamento,
            cat_departamentos (id_departamento, departamento),
            cat_puestos (puesto)
          )
        `)
        .order('apellido_paterno', { ascending: true })

      if (empRes.error) {
        const baseEmp = await supabase.from('empleados').select('*').order('apellido_paterno', { ascending: true })
        empList = baseEmp.data || []
      } else {
        empList = empRes.data || []
      }
      setEmpleadosAll(empList)

      // Cargar Pases Médicos
      let pasesList: any[] = []
      const pasesRes = await supabase
        .from('pases_medicos')
        .select(`
          *,
          empleados (id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado),
          pacientes (nombre_completo, parentesco, id_empleado, acompanante),
          clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre),
          clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre)
        `)
        .order('creado_el', { ascending: false })

      if (pasesRes.error) {
        const fallbackPases = await supabase
          .from('pases_medicos')
          .select('*, empleados(id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado), pacientes(nombre_completo, parentesco, id_empleado)')
          .order('creado_el', { ascending: false })
        pasesList = fallbackPases.data || []
      } else {
        pasesList = pasesRes.data || []
      }
      setPasesAll(pasesList)

      // Cargar Contratistas (Solicitudes, Credenciales, Prórrogas)
      const [solCntRes, credCntRes, prorCntRes, solIntRes] = await Promise.all([
        supabase
          .from('contratistas_solicitudes')
          .select('*, contratistas_empresas(*), contratistas_solicitud_personal(*, contratistas_personal(*))')
          .order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_credenciales')
          .select('*, contratistas_empresas(razon_social, rfc), contratistas_personal(*), contratistas_solicitudes(id_departamento_objetivo, folio, departamento_nombre, area_trabajo)')
          .order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_prorrogas')
          .select('*, contratistas_empresas(razon_social), contratistas_solicitudes(id_departamento_objetivo, folio, departamento_nombre)')
          .order('creado_el', { ascending: false }),
        supabase
          .from('solicitudes')
          .select(`
            *,
            cat_tipos_solicitud(tipo_solicitud),
            empleados!solicitudes_id_empleado_objetivo_fkey(
              id_empleado,
              nombre,
              apellido_paterno,
              apellido_materno,
              departamento,
              empleado_adscripciones(
                cat_departamentos(id_departamento, departamento),
                cat_puestos(puesto)
              )
            )
          `)
          .order('creado_el', { ascending: false }),
      ])

      setSolicitudesContratistas(solCntRes.data || [])
      setCredencialesContratistas(credCntRes.data || [])
      setProrrogasContratistas(prorCntRes.data || [])
      setSolicitudesInternas(solIntRes.data || [])
    } catch (e) {
      console.error('Error cargando portal de departamento:', e)
    } finally {
      setLoading(false)
    }
  }

  // Departamentos que este usuario tiene permitido ver
  const allowedDepartments = useMemo(() => {
    if (isGlobalViewer) return departamentos
    const authIds = new Set<string>()
    if (profile?.id_departamento) authIds.add(String(profile.id_departamento))
    if (Array.isArray(profile?.departamentos_autorizados)) {
      profile.departamentos_autorizados.forEach((id) => authIds.add(String(id)))
    }
    if (authIds.size > 0) {
      const filtered = departamentos.filter((d) => authIds.has(String(d.id_departamento)))
      if (filtered.length > 0) return filtered
    }
    return departamentos
  }, [departamentos, profile, isGlobalViewer])

  const currentDept = useMemo(
    () => departamentos.find((d) => String(d.id_departamento) === String(selectedDeptId)) || allowedDepartments[0] || null,
    [departamentos, selectedDeptId, allowedDepartments]
  )

  // Verifica si un nombre de departamento o ID coincide con el departamento seleccionado
  const matchesSelectedDepartment = (deptId?: string | number | null, deptName?: string | null): boolean => {
    if (!currentDept) return true
    if (deptId && String(deptId) === String(currentDept.id_departamento)) return true
    const targetName = normalizeText(currentDept.departamento)
    const candidateName = normalizeText(deptName)
    if (!targetName || !candidateName) return false
    if (candidateName === targetName || candidateName.includes(targetName) || targetName.includes(candidateName)) {
      return true
    }
    return false
  }

  // 1. Empleados propios de este departamento
  const deptEmployees = useMemo(() => {
    if (!currentDept) return empleadosAll
    return empleadosAll.filter((emp) => {
      const ads = emp.empleado_adscripciones?.[0]
      const adsDeptId = ads?.id_departamento || ads?.cat_departamentos?.id_departamento
      const adsDeptName = ads?.cat_departamentos?.departamento || emp.departamento
      return matchesSelectedDepartment(adsDeptId, adsDeptName)
    })
  }, [empleadosAll, currentDept])

  const deptEmployeeIds = useMemo(() => new Set(deptEmployees.map((e) => e.id_empleado)), [deptEmployees])

  // Clasificación Pase Médico Titular vs Acompañante Médico
  const classifyMedicalPass = (p: any) => {
    const parentesco = (p.parentesco || p.pacientes?.parentesco || '').toUpperCase().trim()
    const acompananteText = (p.acompanante || '').toUpperCase().trim()

    const isTitular =
      !parentesco ||
      parentesco === 'TITULAR' ||
      parentesco.includes('TITULAR') ||
      parentesco.includes('ELLA MISMA') ||
      parentesco.includes('EL MISMO') ||
      parentesco.includes('MISMO TRABAJADOR') ||
      parentesco === 'TRABAJADOR'

    const isFamiliar =
      parentesco.includes('HIJ') ||
      parentesco.includes('ESPOS') ||
      parentesco.includes('MADRE') ||
      parentesco.includes('PADRE') ||
      parentesco.includes('CONCUBIN') ||
      parentesco.includes('FAMILIAR') ||
      (parentesco.includes('ACOMPAÑANTE') && !isTitular)

    const isAcompanante =
      !isTitular &&
      (Boolean(p.es_acompanante) ||
        isFamiliar ||
        (acompananteText &&
          acompananteText !== 'NO' &&
          acompananteText !== 'NO REQUIERE' &&
          !acompananteText.includes('ELLA MISMA') &&
          !acompananteText.includes('EL MISMO')))

    const today = new Date().toISOString().split('T')[0]
    const est = (p.estatus || '').toUpperCase()
    const isClosed =
      est === 'CERRADO' ||
      est === 'CONCLUIDO' ||
      est === 'RETORNADO' ||
      Boolean(p.fecha_retorno && p.fecha_retorno < today)

    const hasExtension = (p.comentarios || '').toUpperCase().includes('AMPLIACIÓN')

    return {
      isAcompanante,
      tipoLabel: isAcompanante ? 'Acompañante Médico' : 'Pase Médico (Titular)',
      parentescoLabel: parentesco || 'TITULAR',
      isClosed,
      hasExtension,
    }
  }

  // 2. Pases Médicos y Acompañantes correspondientes a trabajadores de este departamento
  const deptMedicalPasses = useMemo(() => {
    if (!currentDept) return pasesAll
    return pasesAll.filter((p) => {
      const empId = p.id_empleado || p.pacientes?.id_empleado || p.empleados?.id_empleado
      if (empId && deptEmployeeIds.has(empId)) return true

      // Verificar por departamento directo en el objeto empleado del pase
      if (p.empleados?.departamento && matchesSelectedDepartment(null, p.empleados.departamento)) {
        return true
      }

      // Verificar por nombre del trabajador titular o paciente contra la plantilla del departamento
      const workerNameClean = normalizeText(p.nombre_trabajador)
      const patientNameClean = normalizeText(p.pacientes?.nombre_completo)
      if (workerNameClean || patientNameClean) {
        const matchEmp = deptEmployees.some((e) => {
          const full1 = normalizeText(`${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`)
          const full2 = normalizeText(`${e.apellido_paterno} ${e.apellido_materno || ''} ${e.nombre}`)
          return (
            (workerNameClean && workerNameClean.length > 5 && (full1.includes(workerNameClean) || full2.includes(workerNameClean))) ||
            (patientNameClean && patientNameClean.length > 5 && (full1.includes(patientNameClean) || full2.includes(patientNameClean)))
          )
        })
        if (matchEmp) return true
      }
      return false
    })
  }, [pasesAll, currentDept, deptEmployeeIds, deptEmployees])

  const filteredMedicalPasses = useMemo(() => {
    return deptMedicalPasses.filter((p) => {
      const info = classifyMedicalPass(p)
      if (paseFilterType === 'titular' && info.isAcompanante) return false
      if (paseFilterType === 'acompanante' && !info.isAcompanante) return false
      if (paseFilterType === 'vigentes' && info.isClosed) return false
      return true
    })
  }, [deptMedicalPasses, paseFilterType])

  // 3. Solicitudes, Credenciales y Prórrogas de Contratistas de este departamento
  const deptContractorRequests = useMemo(() => {
    if (!currentDept) return solicitudesContratistas
    return solicitudesContratistas.filter((sol) =>
      matchesSelectedDepartment(sol.id_departamento_objetivo, sol.departamento_nombre || sol.area_trabajo)
    )
  }, [solicitudesContratistas, currentDept])

  const deptContractorCredentials = useMemo(() => {
    if (!currentDept) return credencialesContratistas
    const reqIds = new Set(deptContractorRequests.map((r) => r.id_solicitud))
    return credencialesContratistas.filter(
      (c) =>
        reqIds.has(c.id_solicitud) ||
        matchesSelectedDepartment(
          c.contratistas_solicitudes?.id_departamento_objetivo,
          c.contratistas_solicitudes?.departamento_nombre || c.contratistas_solicitudes?.area_trabajo
        )
    )
  }, [credencialesContratistas, deptContractorRequests, currentDept])

  const deptContractorProrrogas = useMemo(() => {
    if (!currentDept) return prorrogasContratistas
    const reqIds = new Set(deptContractorRequests.map((r) => r.id_solicitud))
    return prorrogasContratistas.filter(
      (pr) =>
        reqIds.has(pr.id_solicitud) ||
        matchesSelectedDepartment(
          pr.contratistas_solicitudes?.id_departamento_objetivo,
          pr.contratistas_solicitudes?.departamento_nombre
        )
    )
  }, [prorrogasContratistas, deptContractorRequests, currentDept])

  // 4. Solicitudes internas (permisos/vacaciones) del personal del departamento
  const deptInternalRequests = useMemo(() => {
    if (!currentDept) return solicitudesInternas
    return solicitudesInternas.filter((req) => {
      const empId = req.id_empleado_objetivo || req.empleados?.id_empleado
      if (empId && deptEmployeeIds.has(empId)) return true
      const adsDeptId = req.empleados?.empleado_adscripciones?.[0]?.cat_departamentos?.id_departamento
      const adsDeptName = req.empleados?.empleado_adscripciones?.[0]?.cat_departamentos?.departamento || req.empleados?.departamento
      return matchesSelectedDepartment(adsDeptId, adsDeptName)
    })
  }, [solicitudesInternas, currentDept, deptEmployeeIds])

  // Acciones del Jefe de Departamento sobre Contratistas
  const handleDeptContractorDecision = async (sol: any, newStatus: 'Aprobado' | 'En Diálogo' | 'Rechazado') => {
    const note =
      newStatus === 'Rechazado' || newStatus === 'En Diálogo'
        ? prompt(`Escribe una indicación o comentario para el contratista (${sol.folio}):`) || ''
        : ''

    const updates: any = {
      estatus_departamento: newStatus,
      aprobado_departamento_por: profile?.nombre_completo || `Jefe ${currentDept?.departamento || ''}`,
      fecha_aprobacion_departamento: new Date().toISOString(),
      actualizado_el: new Date().toISOString(),
    }
    if (note) updates.comentarios_departamento = note
    if (newStatus === 'Rechazado') updates.estatus_general = 'Rechazada'

    const { error } = await supabase.from('contratistas_solicitudes').update(updates).eq('id_solicitud', sol.id_solicitud)
    if (error) {
      alert('Error actualizando autorización: ' + error.message)
      return
    }

    await supabase.from('contratistas_mensajes').insert([
      {
        id_solicitud: sol.id_solicitud,
        id_empresa: sol.id_empresa,
        remitente_id: user?.id || null,
        remitente_nombre: profile?.nombre_completo || `Jefe ${currentDept?.departamento || 'Departamento'}`,
        remitente_rol: 'Departamento',
        mensaje: `El departamento ${currentDept?.departamento || sol.departamento_nombre} marcó la solicitud como "${newStatus}".${
          note ? ` Comentario: ${note}` : ''
        }`,
      },
    ])

    await fetchAllDepartmentData()
  }

  const handleApproveProrrogaDepto = async (pr: any, decision: 'Aprobado' | 'Rechazado') => {
    const { error } = await supabase
      .from('contratistas_prorrogas')
      .update({ estatus_departamento: decision })
      .eq('id_prorroga', pr.id_prorroga)

    if (error) {
      alert('Error actualizando prórroga: ' + error.message)
      return
    }
    await fetchAllDepartmentData()
  }

  // Chat con Contratista
  const openChat = async (sol: any) => {
    setChatSolicitud(sol)
    const { data } = await supabase
      .from('contratistas_mensajes')
      .select('*')
      .eq('id_solicitud', sol.id_solicitud)
      .order('creado_el', { ascending: true })
    setMensajes(data || [])
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatSolicitud || !newMessage.trim()) return
    const { error } = await supabase.from('contratistas_mensajes').insert([
      {
        id_solicitud: chatSolicitud.id_solicitud,
        id_empresa: chatSolicitud.id_empresa,
        remitente_id: user?.id || null,
        remitente_nombre: profile?.nombre_completo || `Jefe ${currentDept?.departamento || 'Área'}`,
        remitente_rol: 'Departamento',
        mensaje: newMessage.trim(),
      },
    ])
    if (!error) {
      setNewMessage('')
      await openChat(chatSolicitud)
    }
  }

  // Autorización de Permisos/Solicitudes Internas del Personal del Departamento
  const handleInternalRequestDecision = async (idSolicitud: string, nuevoEstatus: 'Aprobada por Jefe' | 'Rechazada') => {
    const { error } = await supabase
      .from('solicitudes')
      .update({
        estatus: nuevoEstatus,
        id_autorizador: user?.id || null,
      })
      .eq('id_solicitud', idSolicitud)

    if (error) {
      alert('Error actualizando solicitud: ' + error.message)
      return
    }
    await fetchAllDepartmentData()
  }

  // Estadísticas rápidas
  const activeTitularPassesCount = useMemo(
    () => deptMedicalPasses.filter((p) => {
      const c = classifyMedicalPass(p)
      return !c.isClosed && !c.isAcompanante
    }).length,
    [deptMedicalPasses]
  )

  const activeAcompanantePassesCount = useMemo(
    () => deptMedicalPasses.filter((p) => {
      const c = classifyMedicalPass(p)
      return !c.isClosed && c.isAcompanante
    }).length,
    [deptMedicalPasses]
  )

  const contractorsInMineCount = useMemo(
    () => deptContractorCredentials.filter((c) => c.estatus === 'En Mina').length,
    [deptContractorCredentials]
  )

  const badgeClass = (status: string) => {
    const s = (status || '').toLowerCase()
    if (s.includes('aprob') || s.includes('disponible') || s.includes('completo') || s === 'en mina') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
    if (s.includes('rechaz') || s.includes('sin cupo') || s.includes('vencid') || s.includes('revoc')) {
      return 'bg-rose-100 text-rose-800 border-rose-200'
    }
    if (s.includes('diálogo') || s.includes('prórroga') || s.includes('emitida')) {
      return 'bg-blue-100 text-blue-800 border-blue-200'
    }
    return 'bg-amber-100 text-amber-800 border-amber-200'
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* HEADER DEL DEPARTAMENTO */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-400">
              Portal Operativo de Jefatura de Área • Grupo Minero Bacís
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              {currentDept ? `Departamento: ${currentDept.departamento}` : 'Portal de Mi Departamento'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Supervisión exclusiva de tus contratistas asignados, trabajadores en pase médico o acompañantes, plantilla e incidencias del área.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {allowedDepartments.length > 1 && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">Cambiar Área / Departamento</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-white text-xs font-black px-4 py-2.5 rounded-xl"
              >
                {allowedDepartments.map((d) => (
                  <option key={d.id_departamento} value={String(d.id_departamento)}>
                    🏢 {d.departamento}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchAllDepartmentData}
            className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
            title="Actualizar información del departamento"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 TARJETAS KPI DEL DEPARTAMENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('contratistas')}
          className="text-left bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:border-orange-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400">Contratistas de mi Área</span>
            <HardHat className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-black text-zinc-900 mt-2">
            {deptContractorRequests.length}{' '}
            <span className="text-xs font-bold text-emerald-600">({contractorsInMineCount} en mina)</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {deptContractorRequests.filter((s) => s.estatus_departamento === 'Pendiente').length} pendientes de tu Vo.Bo.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('pases')
            setPaseFilterType('titular')
          }}
          className="text-left bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400">En Pase Médico (Titulares)</span>
            <Stethoscope className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-emerald-600 mt-2">{activeTitularPassesCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Trabajadores de tu área en atención médica</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('pases')
            setPaseFilterType('acompanante')
          }}
          className="text-left bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:border-amber-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400">Acompañantes Médicos</span>
            <Heart className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600 mt-2">{activeAcompanantePassesCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Trabajadores acompañando a un familiar</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plantilla')}
          className="text-left bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:border-blue-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400">Mi Plantilla &amp; Permisos</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-zinc-900 mt-2">
            {deptEmployees.length}{' '}
            <span className="text-xs font-bold text-blue-600">
              ({deptInternalRequests.filter((r) => r.estatus === 'Pendiente' || r.estatus === 'En revisión').length} solic.)
            </span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">Personal adscrito a {currentDept?.departamento || 'tu área'}</p>
        </button>
      </div>

      {/* BARRA DE PESTAÑAS DEL DEPARTAMENTO */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        {[
          {
            id: 'contratistas',
            label: `1. Mis Contratistas (${deptContractorRequests.length})`,
            icon: HardHat,
          },
          {
            id: 'pases',
            label: `2. Pases Médicos y Acompañantes (${deptMedicalPasses.length})`,
            icon: Stethoscope,
          },
          {
            id: 'plantilla',
            label: `3. Mi Plantilla de Trabajadores (${deptEmployees.length})`,
            icon: Users,
          },
          {
            id: 'permisos',
            label: `4. Autorizar Permisos / Vacaciones (${
              deptInternalRequests.filter((r) => r.estatus === 'Pendiente' || r.estatus === 'En revisión').length
            })`,
            icon: FileText,
          },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                active ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* =====================================================================
          PESTAÑA 1: CONTRATISTAS DEL DEPARTAMENTO
         ===================================================================== */}
      {activeTab === 'contratistas' && (
        <div className="space-y-6">
          {/* Solicitudes de Prórroga (Más días en mina) para este Departamento */}
          {deptContractorProrrogas.filter((p) => p.estatus_general === 'Pendiente').length > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase">
                <CalendarPlus className="w-4 h-4 text-blue-600" />
                <span>Contratistas Solicitando Más Días en tu Área (Prórrogas)</span>
              </div>
              <div className="space-y-2">
                {deptContractorProrrogas
                  .filter((p) => p.estatus_general === 'Pendiente')
                  .map((pr) => (
                    <div
                      key={pr.id_prorroga}
                      className="bg-white rounded-xl border border-blue-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-mono text-xs font-black bg-zinc-900 text-amber-400 px-2 py-0.5 rounded mr-2">
                          {pr.contratistas_solicitudes?.folio}
                        </span>
                        <strong className="text-sm text-zinc-900">{pr.contratistas_empresas?.razon_social}</strong>
                        <p className="text-xs text-zinc-600 mt-1">
                          Solicita extender estadía del <strong>{formatShortDate(pr.fecha_fin_anterior)}</strong> al{' '}
                          <strong className="text-blue-700">{formatShortDate(pr.fecha_fin_solicitada)}</strong> • Motivo:{' '}
                          {pr.motivo}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleApproveProrrogaDepto(pr, 'Aprobado')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl"
                        >
                          ✓ Vo.Bo. Más Días
                        </button>
                        <button
                          onClick={() => handleApproveProrrogaDepto(pr, 'Rechazado')}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl"
                        >
                          ✕ Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Solicitudes de Ingreso de Contratistas para el Departamento */}
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase text-zinc-700">
              Solicitudes de Servicios Contratistas para {currentDept?.departamento || 'tu Departamento'}
            </h2>

            {deptContractorRequests.map((sol) => (
              <div key={sol.id_solicitud} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs bg-zinc-900 text-amber-400 px-3 py-1 rounded-lg">
                        {sol.folio}
                      </span>
                      <span className="font-black text-base text-zinc-900">
                        {sol.contratistas_empresas?.razon_social}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${badgeClass(sol.estatus_general)}`}>
                        {sol.estatus_general}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1.5">
                      Trabajo / Servicio: <strong>{sol.descripcion_servicio}</strong> • Zona:{' '}
                      <strong>{sol.area_trabajo || sol.departamento_nombre}</strong>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Fechas programadas: <strong>{formatShortDate(sol.fecha_inicio)}</strong> al{' '}
                      <strong>{formatShortDate(sol.fecha_fin)}</strong> ({diffDaysInclusive(sol.fecha_inicio, sol.fecha_fin)} días)
                    </p>
                  </div>

                  {/* Botones de Autorización del Jefe de Departamento */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openChat(sol)}
                      className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-black px-3.5 py-2 rounded-xl"
                    >
                      <MessageSquare className="w-4 h-4 text-orange-500" />
                      <span>Chat con Contratista</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeptContractorDecision(sol, 'Aprobado')}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Autorizar en mi Área</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeptContractorDecision(sol, 'Rechazado')}
                      className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black px-3 py-2 rounded-xl"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                </div>

                {/* Semáforo de los 4 Factores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">1. Mi Departamento</span>
                    <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_departamento)}`}>
                      {sol.estatus_departamento}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">2. Seguridad Industrial</span>
                    <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_seguridad)}`}>
                      {sol.estatus_seguridad}
                    </span>
                    {sol.fecha_induccion_asignada && (
                      <span className="block text-[10px] text-blue-700 font-bold mt-1">
                        Cita: {formatShortDate(sol.fecha_induccion_asignada)} {sol.hora_induccion_asignada || ''}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">3. Campamentos</span>
                    <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_campamento)}`}>
                      {sol.estatus_campamento}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">4. Credencial RH</span>
                    <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_rh)}`}>
                      {sol.estatus_rh}
                    </span>
                  </div>
                </div>

                {/* Lista de Trabajadores Contratistas que vienen a este Departamento */}
                {sol.contratistas_solicitud_personal?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-500 block mb-2">
                      Personal Contratista Asignado ({sol.contratistas_solicitud_personal.length} trabajadores):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {sol.contratistas_solicitud_personal.map((item: any) => {
                        const p = item.contratistas_personal
                        return (
                          <div
                            key={item.id_item}
                            className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-black text-zinc-900 truncate">
                                {p?.nombre} {p?.apellido_paterno} {p?.apellido_materno || ''}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-mono">
                                {p?.puesto_servicio || 'Contratista'} • NSS: {p?.nss || 'N/D'} • Sangre: {p?.tipo_sangre || 'N/E'}
                              </p>
                              {item.cama_descripcion && (
                                <span className="inline-block mt-1 text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-bold">
                                  🛏️ {item.cama_descripcion}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded shrink-0 ${
                                item.induccion_verificada
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.induccion_verificada ? '✓ Inducción' : 'Pend. Ind.'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {deptContractorRequests.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-400 text-sm">
                No hay solicitudes de contratistas registradas para {currentDept?.departamento || 'este departamento'}.
              </div>
            )}
          </div>

          {/* Monitoreo de Credenciales QR y Contratistas en Mina del Departamento */}
          {deptContractorCredentials.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black uppercase text-amber-400">
                    Gafetes QR y Estadía en Mina de Contratistas ({currentDept?.departamento})
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Monitoreo en tiempo real de entradas y salidas por Caseta y descarga de credenciales Bacís.
                  </p>
                </div>
                <select
                  value={badgeSizeFormat}
                  onChange={(e) => setBadgeSizeFormat(e.target.value as BadgeSizeFormat)}
                  className="bg-zinc-800 border border-zinc-700 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg"
                >
                  {BADGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      Tamaño PDF: {opt.label} ({opt.dimensions})
                    </option>
                  ))}
                </select>
              </div>
              <table className="min-w-full divide-y divide-zinc-200 text-xs">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Código QR</th>
                    <th className="px-4 py-3 text-left">Trabajador Contratista</th>
                    <th className="px-4 py-3 text-left">Empresa</th>
                    <th className="px-4 py-3 text-left">Vigencia</th>
                    <th className="px-4 py-3 text-left">Estado en Caseta</th>
                    <th className="px-4 py-3 text-right">Gafete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {deptContractorCredentials.map((cred) => {
                    const p = cred.contratistas_personal
                    return (
                      <tr key={cred.id_credencial} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono font-black">{cred.codigo_qr}</td>
                        <td className="px-4 py-3">
                          <div className="font-black text-zinc-900">
                            {p?.nombre} {p?.apellido_paterno} {p?.apellido_materno || ''}
                          </div>
                          <div className="text-[10px] text-zinc-500">{p?.puesto_servicio || 'Contratista'}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-700">{cred.contratistas_empresas?.razon_social}</td>
                        <td className="px-4 py-3 font-mono">
                          {formatShortDate(cred.vigencia_desde)} → {formatShortDate(cred.vigencia_hasta)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass(cred.estatus)}`}>
                            {cred.estatus}
                          </span>
                          {cred.fecha_entrada_mina && (
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              Entró: {new Date(cred.fecha_entrada_mina).toLocaleString('es-MX')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              generateContractorCredentialPDF({
                                codigo_qr: cred.codigo_qr,
                                nombre_completo: `${p?.nombre} ${p?.apellido_paterno} ${p?.apellido_materno || ''}`.trim(),
                                empresa: cred.contratistas_empresas?.razon_social || '',
                                rfc_empresa: cred.contratistas_empresas?.rfc,
                                puesto: p?.puesto_servicio || 'Contratista',
                                nss: p?.nss,
                                curp: p?.curp,
                                tipo_sangre: p?.tipo_sangre,
                                contacto_emergencia: p?.contacto_emergencia,
                                departamento_autorizado:
                                  cred.contratistas_solicitudes?.departamento_nombre || currentDept?.departamento || 'Servicios',
                                area_trabajo: cred.contratistas_solicitudes?.area_trabajo,
                                vigencia_desde: cred.vigencia_desde,
                                vigencia_hasta: cred.vigencia_hasta,
                                folio_solicitud: cred.contratistas_solicitudes?.folio || 'N/A',
                                foto_url: p?.foto_url,
                                size_format: badgeSizeFormat,
                              })
                            }
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-amber-400 rounded-lg font-bold inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: PASES MÉDICOS Y ACOMPAÑANTES DEL DEPARTAMENTO
         ===================================================================== */}
      {activeTab === 'pases' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black uppercase text-zinc-900">
                Pases Médicos y Acompañantes — {currentDept?.departamento}
              </h2>
              <p className="text-xs text-zinc-500">
                Visualiza qué trabajadores de tu departamento salieron por atención médica propia (Titular) o como Acompañantes de un familiar.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'todos', label: `Todos (${deptMedicalPasses.length})` },
                { id: 'titular', label: '🩺 Pase Médico (Titular)' },
                { id: 'acompanante', label: '👨‍👩‍👧 Acompañante Médico' },
                { id: 'vigentes', label: '🟢 Solo Vigentes' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPaseFilterType(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    paseFilterType === f.id
                      ? 'bg-zinc-900 text-amber-400 shadow'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMedicalPasses.map((p) => {
              const info = classifyMedicalPass(p)
              const workerFullName = p.empleados
                ? `${p.empleados.nombre} ${p.empleados.apellido_paterno || ''} ${p.empleados.apellido_materno || ''}`.trim()
                : p.nombre_trabajador || p.pacientes?.nombre_completo || 'Trabajador del Área'
              const patientName = p.pacientes?.nombre_completo || workerFullName

              return (
                <div
                  key={p.id_pase}
                  className={`bg-white rounded-2xl border-2 p-5 shadow-sm space-y-3 ${
                    info.isAcompanante ? 'border-amber-200' : 'border-emerald-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black bg-zinc-900 text-white px-2.5 py-1 rounded-lg">
                        Folio {p.folio || 'S/F'}
                      </span>
                      <span
                        className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                          info.isAcompanante
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {info.isAcompanante ? `👨‍👩‍👧 ACOMPAÑANTE MÉDICO (${info.parentescoLabel})` : '🩺 PASE MÉDICO (TITULAR)'}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                        info.isClosed
                          ? 'bg-zinc-100 text-zinc-600 border-zinc-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      }`}
                    >
                      {info.isClosed ? 'Retornado / Concluido' : 'En Atención / Fuera'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">
                      Trabajador de {currentDept?.departamento}:
                    </span>
                    <h3 className="text-base font-black text-zinc-900">{workerFullName}</h3>
                    {p.empleados?.puesto && (
                      <p className="text-xs text-zinc-500 font-bold">{p.empleados.puesto}</p>
                    )}
                  </div>

                  {info.isAcompanante && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                      <span className="text-[10px] font-black uppercase text-amber-800 block">
                        Familiar / Paciente al que acompaña:
                      </span>
                      <strong className="text-amber-950">{patientName}</strong>{' '}
                      <span className="text-amber-800 font-bold">({info.parentescoLabel})</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-xs">
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 block uppercase">Fecha Salida</span>
                      <strong className="font-mono text-zinc-900">
                        {formatShortDate(p.fecha_salida || p.fecha_salida_unidad)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 block uppercase">Retorno Estimado</span>
                      <strong className="font-mono text-zinc-900">
                        {p.fecha_retorno ? formatShortDate(p.fecha_retorno) : 'Por definir'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 block uppercase">Unidad / Clínica Destino</span>
                      <strong className="text-zinc-800">
                        {p.clinica_destino?.nombre || p.unidad_se_refiere || 'Clínica Externa'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 block uppercase">Servicio / Especialidad</span>
                      <strong className="text-zinc-800">{p.servicio_se_envia || p.motivo || 'Consulta Médica'}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {p.requiere_hotel && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg">
                        <Hotel className="w-3 h-3" /> Con Pase de Hotel {p.hotel_nombre ? `(${p.hotel_nombre})` : ''}
                      </span>
                    )}
                    {info.hasExtension && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3 h-3" /> Días de Reposo Ampliados por Médico
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {filteredMedicalPasses.length === 0 && (
              <div className="col-span-2 bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
                No hay trabajadores de {currentDept?.departamento || 'este departamento'} en pase médico o como acompañantes con este filtro.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: PLANTILLA DE TRABAJADORES DEL DEPARTAMENTO (ESTATUS EN VIVO)
         ===================================================================== */}
      {activeTab === 'plantilla' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase text-zinc-900">
                Plantilla de Personal — {currentDept?.departamento} ({deptEmployees.length})
              </h2>
              <p className="text-xs text-zinc-500">
                Estado operativo en tiempo real cruzando asistencia, pases médicos, acompañantes y permisos.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchWorker}
                onChange={(e) => setSearchWorker(e.target.value)}
                placeholder="Buscar trabajador o nómina..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-300 rounded-xl"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-zinc-200 text-xs">
              <thead className="bg-zinc-900 text-white uppercase text-[10px] font-black">
                <tr>
                  <th className="px-5 py-3.5 text-left"># Nómina / Trabajador</th>
                  <th className="px-5 py-3.5 text-left">Puesto</th>
                  <th className="px-5 py-3.5 text-left">Estado Operativo Hoy</th>
                  <th className="px-5 py-3.5 text-left">Detalle Médico / Acompañante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {deptEmployees
                  .filter((e) => {
                    if (!searchWorker.trim()) return true
                    const full = `${e.nombre} ${e.apellido_paterno || ''} ${e.apellido_materno || ''} ${e.numero_empleado || ''} ${e.puesto || ''}`.toLowerCase()
                    return full.includes(searchWorker.toLowerCase())
                  })
                  .map((emp) => {
                    const activePass = deptMedicalPasses.find((p) => {
                      const c = classifyMedicalPass(p)
                      if (c.isClosed) return false
                      const pid = p.id_empleado || p.pacientes?.id_empleado || p.empleados?.id_empleado
                      if (pid === emp.id_empleado) return true
                      const full1 = normalizeText(`${emp.nombre} ${emp.apellido_paterno}`)
                      return normalizeText(p.nombre_trabajador).includes(full1)
                    })
                    const passInfo = activePass ? classifyMedicalPass(activePass) : null
                    const puestoName =
                      emp.empleado_adscripciones?.[0]?.cat_puestos?.puesto || emp.puesto || 'Operativo'

                    return (
                      <tr key={emp.id_empleado} className="hover:bg-zinc-50">
                        <td className="px-5 py-3.5">
                          <div className="font-black text-zinc-900">
                            {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400">
                            Nómina #{emp.numero_empleado || 'S/N'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-zinc-700">{puestoName}</td>
                        <td className="px-5 py-3.5">
                          {activePass && passInfo ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                passInfo.isAcompanante
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                            >
                              {passInfo.isAcompanante
                                ? `👨‍👩‍👧 Acompañante Médico (${passInfo.parentescoLabel})`
                                : '🩺 En Pase Médico (Titular)'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
                              🟢 En Operación / Activo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-600">
                          {activePass ? (
                            <div>
                              <span className="font-bold">
                                Retorno: {activePass.fecha_retorno ? formatShortDate(activePass.fecha_retorno) : 'Pendiente'}
                              </span>
                              <span className="block text-[11px] text-zinc-400">
                                {activePass.servicio_se_envia || activePass.motivo || 'Unidad Médica'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: PERMISOS Y VACACIONES DEL PERSONAL DEL DEPARTAMENTO
         ===================================================================== */}
      {activeTab === 'permisos' && (
        <div className="space-y-3">
          {deptInternalRequests.map((req) => (
            <div
              key={req.id_solicitud}
              className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase px-2.5 py-1 rounded bg-zinc-900 text-amber-400">
                    {req.cat_tipos_solicitud?.tipo_solicitud || 'Solicitud'}
                  </span>
                  <strong className="text-sm text-zinc-900">
                    {req.empleados?.nombre} {req.empleados?.apellido_paterno} {req.empleados?.apellido_materno || ''}
                  </strong>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass(req.estatus)}`}>
                    {req.estatus}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Solicitado el: {formatShortDate(req.creado_el)}
                </p>
              </div>

              {(req.estatus === 'Pendiente' || req.estatus === 'En revisión') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInternalRequestDecision(req.id_solicitud, 'Aprobada por Jefe')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl"
                  >
                    ✓ Autorizar
                  </button>
                  <button
                    onClick={() => handleInternalRequestDecision(req.id_solicitud, 'Rechazada')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl"
                  >
                    ✕ Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}

          {deptInternalRequests.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
              No hay solicitudes de permisos o vacaciones pendientes en {currentDept?.departamento || 'tu departamento'}.
            </div>
          )}
        </div>
      )}

      {/* MODAL: CHAT DIRECTO ENTRE DEPARTAMENTO Y CONTRATISTA */}
      {chatSolicitud && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full h-[75vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase">
                  Comunicación con Contratista • {chatSolicitud.folio}
                </h3>
                <p className="text-[11px] text-zinc-400">{chatSolicitud.contratistas_empresas?.razon_social}</p>
              </div>
              <button onClick={() => setChatSolicitud(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {mensajes.map((m) => (
                <div
                  key={m.id_mensaje}
                  className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                    m.remitente_rol !== 'Contratista'
                      ? 'ml-auto bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-800'
                  }`}
                >
                  <span className="font-black text-[10px] uppercase block mb-1 opacity-75">
                    {m.remitente_nombre} ({m.remitente_rol})
                  </span>
                  <p>{m.mensaje}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-200 flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribir mensaje al contratista..."
                className="flex-1 text-xs border border-zinc-300 rounded-xl px-3 py-2.5"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
