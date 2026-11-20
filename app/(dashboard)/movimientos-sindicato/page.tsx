'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  HardHat,
  Users,
  Plus,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Send,
  Calendar,
  Award,
  AlertTriangle,
  RefreshCw,
  Download,
  ShieldCheck,
  ArrowRight,
  Lock,
  Unlock,
  Star,
  Building2,
  Phone,
  Sparkles,
  CheckSquare,
  Bell,
  X,
  Layers,
  RotateCcw,
  Settings,
  UserCheck,
  KeyRound,
  Copy,
  Inbox,
  Check,
  Sliders,
} from 'lucide-react'
import { formatShortDate, diffDaysInclusive, isSchemaMissingError } from '@/utils/contratistasConfig'
import { generateConvocatoriaSindicatoPDF } from '@/utils/convocatoriaSindicatoPdf'
import {
  generateSimulacionReglasPDF,
  type SimulacionReglasReportData,
  type SimulacionRuleItem,
} from '@/utils/simulacionReglasPdf'

const DEFAULT_RULES = {
  id_regla: null as string | null,
  nombre_regla: 'Matriz Oficial Sindicato - RH Unidad - RH Corporativo - Departamentos',
  regla_vacante_libre_obligatoria: true,
  regla_orden_secuencial: true,
  regla_bloqueo_por_usuario: true,
  regla_requiere_jefe_rh_unidad: true,
  regla_requiere_supt_rh_corporativo: true,
  regla_requiere_liberacion_origen: true,
  regla_permitir_efecto_domino: true,
  regla_notificar_correo_automatico: true,
  regla_dias_convocatoria: 10,
  jefe_rh_unidad_id: null as string | null,
  jefe_rh_unidad_nombre: 'Jefe de RH Unidad El Herrero',
  jefe_rh_unidad_correo: 'jefe.rh.unidad@bacis.com',
  supt_rh_corporativo_id: null as string | null,
  supt_rh_corporativo_nombre: 'Superintendente de RH Corporativo',
  supt_rh_corporativo_correo: 'supt.rh.corporativo@bacis.com',
  sindicato_id: null as string | null,
  sindicato_nombre: 'Representación Sindical Sección Minera',
  sindicato_correo: 'sindicato@bacis.com',
}

const DEFAULT_ENCARGADOS = [
  {
    id_encargado: 'enc-mina',
    nombre_encargado: 'Superintendente / Jefe de Mina',
    correo_encargado: 'jefe.mina@bacis.com',
    cargo: 'Encargado General Mina y Sub-áreas',
    departamento_principal: 'Mina',
    sub_departamentos: ['Mina', 'Perforación y Voladura', 'Acarreo Interior Mina', 'Rezaga y Ademe', 'Ventilación y Servicios Mina'],
  },
  {
    id_encargado: 'enc-planta',
    nombre_encargado: 'Encargado Planta de Beneficio y Procesos',
    correo_encargado: 'jefe.planta.de@bacis.com',
    cargo: 'Jefe de Planta y Sub-departamentos',
    departamento_principal: 'Planta de Beneficio',
    sub_departamentos: ['Planta de Beneficio', 'Trituración', 'Molienda', 'Flotación', 'Filtros y Espesadores', 'Presa de Jales'],
  },
  {
    id_encargado: 'enc-mant',
    nombre_encargado: 'Jefe de Mantenimiento y Talleres',
    correo_encargado: 'jefe.mantenimiento@bacis.com',
    cargo: 'Encargado Mantenimiento Mecánico y Eléctrico',
    departamento_principal: 'Mantenimiento',
    sub_departamentos: ['Mantenimiento', 'Mantenimiento Mecánico Mina', 'Mantenimiento Planta', 'Taller Equipo Pesado / Scooptram', 'Eléctrico e Instrumentación'],
  },
  {
    id_encargado: 'enc-geo',
    nombre_encargado: 'Encargado Geología, Laboratorio y Servicios',
    correo_encargado: 'jefe.geologia.y@bacis.com',
    cargo: 'Jefe de Áreas Técnicas',
    departamento_principal: 'Geología y Exploración',
    sub_departamentos: ['Geología y Exploración', 'Muestreo y Topografía', 'Laboratorio Químico', 'Logística y Almacén', 'Superficie y Patio'],
  },
]

export default function MovimientosSindicatoPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'convocatorias' | 'inscripciones' | 'autorizaciones' | 'ajedrez' | 'reglas' | 'simulador' | 'historial'
  >('convocatorias')

  const [vacantes, setVacantes] = useState<any[]>([])
  const [postulantes, setPostulantes] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [encargados, setEncargados] = useState<any[]>(DEFAULT_ENCARGADOS)
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [empleadosCatalog, setEmpleadosCatalog] = useState<any[]>([])
  const [reglas, setReglas] = useState<any>(DEFAULT_RULES)
  const [bandejaAlertas, setBandejaAlertas] = useState<any[]>([])
  const [perfilesCatalog, setPerfilesCatalog] = useState<any[]>([])

  const [selectedVacanteId, setSelectedVacanteId] = useState<string>('')
  const [savingReglas, setSavingReglas] = useState(false)
  const [seedingAuth, setSeedingAuth] = useState(false)
  const [seededAuthModal, setSeededAuthModal] = useState<any[] | null>(null)
  const [actorSubmittingId, setActorSubmittingId] = useState<string | null>(null)

  const [simState, setSimState] = useState({
    escenarioNombre: 'Escenario Estándar: Ayudante de Planta -> Ayudante de Perforista (Mina)',
    candidatoNombre: 'Juan Carlos Pérez López',
    departamentoOrigen: 'Planta de Beneficio',
    subDepartamentoOrigen: 'Trituración',
    puestoActual: 'Ayudante General de Planta',
    departamentoDestino: 'Mina',
    subDepartamentoDestino: 'Perforación y Voladura',
    puestoVacante: 'Ayudante de Perforista',
    plazasLibres: 1,
    rhUnidadAprobo: true,
    rhCorpAprobo: true,
    destinoPlanYFecha: true,
    origenRespuesta: 'Autorizado (Sí)' as 'Pendiente de Respuesta' | 'Autorizado (Sí)' | 'No / Reprogramar Fecha',
    usuarioPrueba: 'jefe.rh.unidad@bacis.com',
    etapaAProbar: 'RH_UNIDAD' as 'RH_UNIDAD' | 'RH_CORPORATIVO' | 'PLAN_DESTINO' | 'LIBERACION_ORIGEN' | 'MOVER_AJEDREZ',
  })

  // Modal 1: Abrir Nueva Vacante + Convocatoria 10 Días
  const [showVacanteModal, setShowVacanteModal] = useState(false)
  const [vacanteForm, setVacanteForm] = useState({
    puesto_vacante: 'Ayudante de Perforista',
    departamento_destino: 'Mina',
    sub_departamento_destino: 'Perforación y Voladura',
    plazas_totales: 2,
    categoria_tabulador: 'Sindicalizado / Escalafón',
    requisitos: 'Personal activo, examen médico apto, disponibilidad de rol y compromiso con Seguridad Industrial.',
    fecha_apertura: new Date().toISOString().split('T')[0],
    dias_convocatoria: 10,
    plan_avance_departamento: 'Evaluación práctica en nivel + 15 días de adiestramiento con perforista titular.',
    crear_efecto_domino: true,
  })
  const [savingVacante, setSavingVacante] = useState(false)

  // Modal 2: Inscribir Trabajador a la Convocatoria
  const [showInscribirModal, setShowInscribirModal] = useState(false)
  const [inscribirForm, setInscribirForm] = useState({
    id_vacante: '',
    id_empleado: '',
    nombre_completo: '',
    numero_empleado: '',
    fecha_inscripcion: new Date().toISOString().split('T')[0],
    departamento_actual: 'Planta de Beneficio',
    sub_departamento_actual: 'Trituración',
    puesto_actual: 'Ayudante General de Planta',
    puesto_postulado: 'Ayudante de Perforista',
    celular: '',
    anos_antiguedad: 3.5,
    tiene_anos_experiencia: true,
    anos_experiencia_detalle: '3 años en operación minera',
    tiene_experiencia_puesto: false,
    requiere_capacitacion_previa: true,
  })
  const [savingInscripcion, setSavingInscripcion] = useState(false)

  // Modal 3: Calificar Estancia / Desempeño por el Departamento Asignado
  const [evaluatingItem, setEvaluatingItem] = useState<any>(null)
  const [evalForm, setEvalForm] = useState({
    calificacion: 9.0,
    dictamen: 'Aprobado Definitivo en el Puesto',
    comentarios_desempeno: '',
    fecha_fin: '',
  })

  // Modal 4: Reprogramar Nueva Fecha cuando Depto Origen dijo que NO
  const [reprogramTarget, setReprogramTarget] = useState<any>(null)
  const [reprogramDate, setReprogramDate] = useState('')
  const [reprogramNote, setReprogramNote] = useState('')

  // Modal 5: Configurar Encargado Multi-Subdepartamento
  const [showEncargadoModal, setShowEncargadoModal] = useState(false)
  const [encargadoForm, setEncargadoForm] = useState({
    nombre_encargado: '',
    correo_encargado: '',
    cargo: 'Jefe / Encargado de Áreas',
    departamento_principal: '',
    sub_departamentos_csv: '',
  })

  const [sendingEmails, setSendingEmails] = useState(false)

  useEffect(() => {
    fetchAllData()
  }, [])

  // Encuentra el Encargado único responsable de cualquier departamento o sub-departamento
  const resolveEncargadoForDept = (deptoName: string, subDeptoName?: string) => {
    const dClean = (deptoName || '').toLowerCase().trim()
    const sClean = (subDeptoName || '').toLowerCase().trim()

    for (const enc of encargados) {
      const mainClean = (enc.departamento_principal || '').toLowerCase().trim()
      const subs: string[] = Array.isArray(enc.sub_departamentos) ? enc.sub_departamentos : []
      const matchSub = subs.some((s) => {
        const sc = s.toLowerCase().trim()
        return (sClean && (sc.includes(sClean) || sClean.includes(sc))) || (dClean && (sc.includes(dClean) || dClean.includes(sc)))
      })
      if (matchSub || (mainClean && (mainClean.includes(dClean) || dClean.includes(mainClean)))) {
        return enc
      }
    }
    return encargados[0] || DEFAULT_ENCARGADOS[0]
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      // Cargar catálogo de empleados para autocompletar en inscripción
      const empRes = await supabase
        .from('empleados')
        .select(`
          *,
          empleado_adscripciones (
            cat_departamentos (id_departamento, departamento),
            cat_puestos (puesto)
          )
        `)
        .order('nombre')
      if (empRes.data) setEmpleadosCatalog(empRes.data)

      const { data: vacData, error: vacErr } = await supabase
        .from('movimientos_vacantes')
        .select('*')
        .order('creado_el', { ascending: false })

      if (vacErr) {
        if (isSchemaMissingError(vacErr)) {
          setSchemaMissing(true)
        }
        setLoading(false)
        return
      }

      const [postRes, histRes, encRes, notRes, ruleRes, bandejaRes, perfilesRes] = await Promise.all([
        supabase.from('movimientos_postulantes').select('*').order('anos_antiguedad', { ascending: false }),
        supabase.from('movimientos_historial_estancia').select('*').order('creado_el', { ascending: false }),
        supabase.from('movimientos_encargados_subdeptos').select('*').order('departamento_principal'),
        supabase.from('movimientos_notificaciones_log').select('*').order('creado_el', { ascending: false }).limit(60),
        supabase.from('movimientos_reglas_autorizacion').select('*').limit(1).maybeSingle(),
        supabase.from('movimientos_bandeja_notificaciones').select('*').order('creado_el', { ascending: false }).limit(120),
        supabase.from('perfiles').select('id, nombre_completo, rol, email').order('nombre_completo'),
      ])

      const loadedVacantes = vacData || []
      setVacantes(loadedVacantes)
      if (!selectedVacanteId && loadedVacantes.length > 0) {
        setSelectedVacanteId(loadedVacantes[0].id_vacante)
      }
      setPostulantes(postRes.data || [])
      setHistorial(histRes.data || [])
      if (encRes.data && encRes.data.length > 0) {
        setEncargados(encRes.data)
      }
      setNotificaciones(notRes.data || [])
      if (ruleRes?.data) {
        setReglas({ ...DEFAULT_RULES, ...ruleRes.data })
      }
      setBandejaAlertas(bandejaRes?.data || [])
      setPerfilesCatalog(perfilesRes?.data || [])
    } catch (e) {
      console.error('Error cargando movimientos sindicales:', e)
    } finally {
      setLoading(false)
    }
  }

  const currentVacante = useMemo(
    () => vacantes.find((v) => v.id_vacante === selectedVacanteId) || vacantes[0] || null,
    [vacantes, selectedVacanteId]
  )

  const currentPostulantes = useMemo(() => {
    if (!currentVacante) return postulantes
    return postulantes.filter((p) => p.id_vacante === currentVacante.id_vacante)
  }, [postulantes, currentVacante])

  // Identidad activa del usuario para candados por usuario y bandeja personal
  const actorId = user?.id || profile?.id || null
  const actorEmail = (user?.email || (profile as any)?.email || '').toLowerCase().trim()
  const actorRolLower = (profile?.rol || '').toLowerCase()
  const actorName = profile?.nombre_completo || user?.email || 'Usuario'

  const canActAsRhUnidad = useMemo(() => {
    if (!reglas.regla_bloqueo_por_usuario) return true
    const isId = Boolean(reglas.jefe_rh_unidad_id && actorId && reglas.jefe_rh_unidad_id === actorId)
    const isEmail = Boolean(reglas.jefe_rh_unidad_correo && actorEmail && reglas.jefe_rh_unidad_correo.toLowerCase().trim() === actorEmail)
    const isRole = actorRolLower.includes('rh unidad') || actorRolLower === 'jefe de rh unidad'
    return isId || isEmail || isRole
  }, [reglas, actorId, actorEmail, actorRolLower])

  const canActAsRhCorporativo = useMemo(() => {
    if (!reglas.regla_bloqueo_por_usuario) return true
    const isId = Boolean(reglas.supt_rh_corporativo_id && actorId && reglas.supt_rh_corporativo_id === actorId)
    const isEmail = Boolean(reglas.supt_rh_corporativo_correo && actorEmail && reglas.supt_rh_corporativo_correo.toLowerCase().trim() === actorEmail)
    const isRole = actorRolLower.includes('corporativo')
    return isId || isEmail || isRole
  }, [reglas, actorId, actorEmail, actorRolLower])

  const canActForDept = (deptoName: string, subDeptoName?: string, fallbackEmail?: string) => {
    const enc = resolveEncargadoForDept(deptoName, subDeptoName)
    if (!reglas.regla_bloqueo_por_usuario) return { allowed: true, enc }
    const expectedEmail = (fallbackEmail || enc?.correo_encargado || '').toLowerCase().trim()
    const isAssignedId = Boolean(enc?.id_usuario_encargado && actorId && enc.id_usuario_encargado === actorId)
    const isAssignedEmail = Boolean(expectedEmail && actorEmail && expectedEmail === actorEmail)
    const isNotRHOrUnion = !actorRolLower.includes('rh unidad') && !actorRolLower.includes('corporativo') && !actorRolLower.includes('sindicato')
    const isDeptRole = (actorRolLower.includes('jefe de departamento') || actorRolLower === 'jefe' || actorRolLower === 'supervisor') && isNotRHOrUnion
    const hasSpecificTitular = Boolean(enc?.id_usuario_encargado || expectedEmail)
    return {
      allowed: isAssignedId || isAssignedEmail || (!hasSpecificTitular && isDeptRole),
      enc,
    }
  }

  const myPendingAlerts = useMemo(() => {
    return bandejaAlertas.filter((a) => {
      if (a.atendida) return false
      const matchesUserId = Boolean(a.id_usuario_destino && actorId && a.id_usuario_destino === actorId)
      const matchesEmail = Boolean(a.correo_destino && actorEmail && a.correo_destino.toLowerCase().trim() === actorEmail)
      if (matchesUserId || matchesEmail) return true
      if (a.etapa === 'PASO_1_RH_UNIDAD' && canActAsRhUnidad) return true
      if (a.etapa === 'PASO_2_RH_CORPORATIVO' && canActAsRhCorporativo) return true
      if (a.etapa === 'PASO_3_PLAN_DESTINO' && canActForDept(a.departamento_destino || 'Mina').allowed) return true
      if (a.etapa === 'PASO_4_LIBERACION_ORIGEN' && canActForDept(a.departamento_destino || '', undefined, a.correo_destino).allowed) return true
      return false
    })
  }, [bandejaAlertas, actorId, actorEmail, canActAsRhUnidad, canActAsRhCorporativo, encargados, reglas, actorRolLower])

  // Calcula cuántos días quedan de los 10 días de convocatoria
  const getConvocatoriaCountdown = (fechaCierre?: string) => {
    if (!fechaCierre) return { daysLeft: 10, isOpen: true }
    const today = new Date().toISOString().split('T')[0]
    const diff = Math.ceil((new Date(fechaCierre).getTime() - new Date(today).getTime()) / 86400000)
    return {
      daysLeft: diff,
      isOpen: diff >= 0,
    }
  }

  // 1. CREAR NUEVA VACANTE + CONVOCATORIA DE 10 DÍAS
  const handleCreateVacante = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingVacante(true)
    try {
      const aperturaDate = new Date(vacanteForm.fecha_apertura)
      const cierreDate = new Date(aperturaDate.getTime() + Number(vacanteForm.dias_convocatoria || 10) * 86400000)
      const fechaCierreStr = cierreDate.toISOString().split('T')[0]
      const folio = `CONV-BACIS-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`

      const payload = {
        folio_convocatoria: folio,
        puesto_vacante: vacanteForm.puesto_vacante.trim(),
        departamento_destino: vacanteForm.departamento_destino.trim(),
        sub_departamento_destino: vacanteForm.sub_departamento_destino.trim(),
        plazas_totales: Number(vacanteForm.plazas_totales || 1),
        plazas_ocupadas: 0,
        origen_vacante: 'Vacante Libre Autorizada',
        categoria_tabulador: vacanteForm.categoria_tabulador,
        requisitos: vacanteForm.requisitos,
        fecha_apertura: vacanteForm.fecha_apertura,
        fecha_cierre_inscripcion: fechaCierreStr,
        dias_convocatoria: Number(vacanteForm.dias_convocatoria || 10),
        plan_avance_departamento: vacanteForm.plan_avance_departamento,
        estatus_vacante: 'Convocatoria Abierta (10 Días)',
      }

      const { data: created, error } = await supabase.from('movimientos_vacantes').insert([payload]).select().single()
      if (error) throw error

      await supabase.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: created.id_vacante,
          tipo_aviso: 'CONVOCATORIA_10_DIAS',
          remitente: `${profile?.nombre_completo || 'RH / Sindicato'}`,
          destinatarios: 'Sindicato, RH Corporativo y Todos los Departamentos',
          asunto: `Apertura de Convocatoria (${folio}): ${payload.puesto_vacante} en ${payload.departamento_destino}`,
          mensaje: `Se abrió convocatoria oficial por ${payload.dias_convocatoria} días (cierra el ${formatShortDate(
            fechaCierreStr
          )}) para ${payload.plazas_totales} plaza(s) de ${payload.puesto_vacante} en ${payload.departamento_destino} (${
            payload.sub_departamento_destino
          }).`,
          correo_enviado: false,
        },
      ])

      setShowVacanteModal(false)
      setSelectedVacanteId(created.id_vacante)
      await fetchAllData()
    } catch (err: any) {
      alert('Error abriendo convocatoria: ' + err.message)
    } finally {
      setSavingVacante(false)
    }
  }

  // Autocompletar datos del trabajador al seleccionarlo del catálogo de empleados
  const handleSelectEmpleadoForInscripcion = (empId: string) => {
    const emp = empleadosCatalog.find((e) => e.id_empleado === empId)
    if (!emp) {
      setInscribirForm({ ...inscribirForm, id_empleado: '' })
      return
    }
    const fullName = `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    const depto = emp.empleado_adscripciones?.[0]?.cat_departamentos?.departamento || emp.departamento || 'Planta de Beneficio'
    const puesto = emp.empleado_adscripciones?.[0]?.cat_puestos?.puesto || emp.puesto || 'Ayudante General'
    let antiguedad = 2.0
    if (emp.fecha_ingreso) {
      const diffYears = (Date.now() - new Date(emp.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      if (!isNaN(diffYears) && diffYears >= 0) {
        antiguedad = Number(diffYears.toFixed(1))
      }
    }

    setInscribirForm({
      ...inscribirForm,
      id_empleado: emp.id_empleado,
      nombre_completo: fullName,
      numero_empleado: String(emp.numero_empleado || ''),
      departamento_actual: depto,
      sub_departamento_actual: depto,
      puesto_actual: puesto,
      celular: emp.telefono || '',
      anos_antiguedad: antiguedad,
    })
  }

  // 2. INSCRIBIR POSTULANTE EN LA CONVOCATORIA
  const handleInscribirPostulante = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetVacId = inscribirForm.id_vacante || currentVacante?.id_vacante
    if (!targetVacId) {
      alert('Primero selecciona o abre una vacante.')
      return
    }
    setSavingInscripcion(true)
    try {
      const vacObj = vacantes.find((v) => v.id_vacante === targetVacId) || currentVacante
      const encargadoOrigen = resolveEncargadoForDept(
        inscribirForm.departamento_actual,
        inscribirForm.sub_departamento_actual
      )

      const payload = {
        id_vacante: targetVacId,
        id_empleado: inscribirForm.id_empleado || null,
        nombre_completo: inscribirForm.nombre_completo.trim(),
        numero_empleado: inscribirForm.numero_empleado.trim(),
        fecha_inscripcion: inscribirForm.fecha_inscripcion,
        departamento_actual: inscribirForm.departamento_actual.trim(),
        sub_departamento_actual: inscribirForm.sub_departamento_actual.trim(),
        puesto_actual: inscribirForm.puesto_actual.trim(),
        puesto_postulado: vacObj?.puesto_vacante || inscribirForm.puesto_postulado.trim(),
        celular: inscribirForm.celular.trim(),
        anos_antiguedad: Number(inscribirForm.anos_antiguedad || 0),
        tiene_anos_experiencia: Boolean(inscribirForm.tiene_anos_experiencia),
        anos_experiencia_detalle: inscribirForm.anos_experiencia_detalle.trim(),
        tiene_experiencia_puesto: Boolean(inscribirForm.tiene_experiencia_puesto),
        requiere_capacitacion_previa: Boolean(inscribirForm.requiere_capacitacion_previa),
        encargado_origen_nombre: encargadoOrigen.nombre_encargado,
        encargado_origen_correo: encargadoOrigen.correo_encargado,
        estatus_movimiento: 'Inscrito en Convocatoria',
      }

      const { data: insertedPost, error } = await supabase.from('movimientos_postulantes').insert([payload]).select().single()
      if (error) throw error

      // Disparar notificación automática Paso 1 hacia el Jefe de RH Unidad titular
      try {
        await fetch('/api/movimientos/autorizar-etapa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_postulacion: insertedPost.id_postulacion,
            etapa: 'NOTIFICAR_INSCRIPCION',
            user_id: actorId,
            user_email: actorEmail,
            user_name: actorName,
            user_rol: profile?.rol || '',
            baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
          }),
        })
      } catch (notifyErr) {
        console.warn('No se pudo enviar alerta inicial al Jefe de RH Unidad:', notifyErr)
      }

      setShowInscribirModal(false)
      setSelectedVacanteId(targetVacId)
      await fetchAllData()
      setActiveTab('inscripciones')
    } catch (err: any) {
      alert('Error inscribiendo trabajador: ' + err.message)
    } finally {
      setSavingInscripcion(false)
    }
  }

  // 3. MOTOR DE AUTORIZACIÓN POR USUARIO Y CASCADA DE NOTIFICACIONES
  const handleAutorizarEtapa = async (
    post: any,
    etapa: 'RH_UNIDAD' | 'RH_CORPORATIVO' | 'PLAN_DESTINO' | 'LIBERACION_ORIGEN',
    extras?: {
      decision?: 'APROBAR' | 'RECHAZAR' | 'SI' | 'NO'
      fecha_presentacion?: string
      plan_avance?: string
      comentario?: string
      nueva_fecha?: string
    }
  ) => {
    setActorSubmittingId(post.id_postulacion)
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await fetch('/api/movimientos/autorizar-etapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_postulacion: post.id_postulacion,
          etapa,
          user_id: actorId,
          user_email: actorEmail,
          user_name: actorName,
          user_rol: profile?.rol || '',
          baseUrl,
          ...(extras || {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'No se pudo autorizar esta etapa.')
        return false
      }

      if (etapa === 'LIBERACION_ORIGEN') {
        setReprogramTarget(null)
      }
      await fetchAllData()
      if (json.message) {
        alert(json.message)
      }
      return true
    } catch (err: any) {
      alert('Error procesando autorización: ' + err.message)
      return false
    } finally {
      setActorSubmittingId(null)
    }
  }

  // Autorizar en bloque para el rol actual (RH Unidad o RH Corporativo)
  const handleAuthorizeAllRHStage = async (stage: 'RH_UNIDAD' | 'RH_CORPORATIVO') => {
    if (!currentVacante) return
    const list =
      stage === 'RH_UNIDAD'
        ? currentPostulantes.filter((p) => !p.autorizado_rh_local)
        : currentPostulantes.filter((p) => !p.autorizado_rh_corporativo)

    if (list.length === 0) {
      alert('No hay postulantes pendientes para esta firma en la convocatoria seleccionada.')
      return
    }

    let okCount = 0
    for (const p of list) {
      const ok = await handleAutorizarEtapa(p, stage, { decision: 'APROBAR' })
      if (!ok) break
      okCount++
    }
    if (okCount > 0) {
      await fetchAllData()
    }
  }

  // 4. SELECCIÓN POR EL DEPARTAMENTO DE LA VACANTE (MINA) + PLAN DE AVANCE + FECHA Y ENVÍO AUTOMÁTICO DE CORREOS A DEPTOS DE ORIGEN
  const handleSelectCandidateByDestination = async (post: any, selected: boolean, fecha?: string, plan?: string) => {
    const defaultDate =
      fecha ||
      post.fecha_presentacion ||
      currentVacante?.fecha_cita_propuesta ||
      new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
    const defaultPlan =
      plan ||
      post.plan_avance_asignado ||
      currentVacante?.plan_avance_departamento ||
      'Presentación en área, evaluación técnica y plan de capacitación.'

    if (selected) {
      await handleAutorizarEtapa(post, 'PLAN_DESTINO', {
        fecha_presentacion: defaultDate,
        plan_avance: defaultPlan,
      })
      return
    }

    const checkDest = canActForDept(currentVacante?.departamento_destino || 'Mina', currentVacante?.sub_departamento_destino)
    if (!checkDest.allowed) {
      alert(
        `🔒 Bloqueado por Matriz de Reglas: Solo el encargado de ${currentVacante?.departamento_destino || 'Mina'} (${
          checkDest.enc?.correo_encargado
        }) puede modificar esta selección.`
      )
      return
    }

    const { error } = await supabase
      .from('movimientos_postulantes')
      .update({
        seleccionado_por_destino: false,
        estatus_movimiento: 'Autorizado por RH y Corporativo',
      })
      .eq('id_postulacion', post.id_postulacion)

    if (error) {
      alert('Error quitando selección: ' + error.message)
      return
    }
    await fetchAllData()
  }

  const handleDispatchEmailsToOriginDepartments = async () => {
    if (!currentVacante) return
    const selectedCandidates = currentPostulantes.filter((p) => p.seleccionado_por_destino)
    if (selectedCandidates.length === 0) {
      alert('Selecciona primero al menos a un candidato aceptado por el departamento de la vacante.')
      return
    }

    setSendingEmails(true)
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await fetch('/api/movimientos/notificar-departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacante: currentVacante,
          candidatos: selectedCandidates,
          baseUrl,
        }),
      })
      const json = await res.json()

      for (const c of selectedCandidates) {
        await supabase
          .from('movimientos_postulantes')
          .update({
            correo_enviado_origen: true,
            fecha_correo_origen: new Date().toISOString(),
            estatus_movimiento:
              c.respuesta_depto_origen === 'Autorizado (Sí)'
                ? 'Confirmado para Mover (SÍ)'
                : 'Esperando Respuesta Depto Origen',
          })
          .eq('id_postulacion', c.id_postulacion)
      }

      await supabase
        .from('movimientos_vacantes')
        .update({ estatus_vacante: 'Esperando Liberación de Departamentos' })
        .eq('id_vacante', currentVacante.id_vacante)

      await fetchAllData()

      const sentSummary = (json.results || [])
        .map((r: any) => `• ${r.encargado} (${r.departamentos}): ${r.trabajadores} trabajador(es)`)
        .join('\n')

      alert(
        `📧 ¡Notificaciones enviadas a los Encargados de los Departamentos / Sub-departamentos de Origen!\n\n${sentSummary}\n\nCada encargado puede responder "✅ SÍ AUTORIZO" o "⏳ NO / REPROGRAMAR" desde su correo o en su portal.`
      )
    } catch (err: any) {
      alert('Error enviando avisos a departamentos: ' + err.message)
    } finally {
      setSendingEmails(false)
    }
  }

  // 5. RESPUESTA DEL DEPARTAMENTO DE ORIGEN (SÍ AUTORIZO / NO - REPROGRAMAR FECHA)
  const handleOriginDepartmentResponse = async (post: any, decision: 'SI' | 'NO', comentario?: string, nuevaFecha?: string) => {
    await handleAutorizarEtapa(post, 'LIBERACION_ORIGEN', {
      decision,
      comentario:
        comentario ||
        (decision === 'SI'
          ? `Liberación autorizada por ${actorName}`
          : `No se puede liberar en esa fecha por operación en ${post.departamento_actual}`),
      nueva_fecha: nuevaFecha,
    })
  }

  // 5B. GUARDAR MATRIZ DE REGLAS Y TITULARES + SEEDER OFICIAL DE AUTORIZADORES
  const handleSaveReglas = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSavingReglas(true)
    try {
      const payload = {
        nombre_regla: reglas.nombre_regla || DEFAULT_RULES.nombre_regla,
        regla_vacante_libre_obligatoria: Boolean(reglas.regla_vacante_libre_obligatoria),
        regla_orden_secuencial: Boolean(reglas.regla_orden_secuencial),
        regla_bloqueo_por_usuario: Boolean(reglas.regla_bloqueo_por_usuario),
        regla_requiere_jefe_rh_unidad: Boolean(reglas.regla_requiere_jefe_rh_unidad),
        regla_requiere_supt_rh_corporativo: Boolean(reglas.regla_requiere_supt_rh_corporativo),
        regla_requiere_liberacion_origen: Boolean(reglas.regla_requiere_liberacion_origen),
        regla_permitir_efecto_domino: Boolean(reglas.regla_permitir_efecto_domino),
        regla_notificar_correo_automatico: Boolean(reglas.regla_notificar_correo_automatico),
        regla_dias_convocatoria: Number(reglas.regla_dias_convocatoria || 10),
        jefe_rh_unidad_id: reglas.jefe_rh_unidad_id || null,
        jefe_rh_unidad_nombre: reglas.jefe_rh_unidad_nombre || '',
        jefe_rh_unidad_correo: (reglas.jefe_rh_unidad_correo || '').trim().toLowerCase(),
        supt_rh_corporativo_id: reglas.supt_rh_corporativo_id || null,
        supt_rh_corporativo_nombre: reglas.supt_rh_corporativo_nombre || '',
        supt_rh_corporativo_correo: (reglas.supt_rh_corporativo_correo || '').trim().toLowerCase(),
        sindicato_id: reglas.sindicato_id || null,
        sindicato_nombre: reglas.sindicato_nombre || '',
        sindicato_correo: (reglas.sindicato_correo || '').trim().toLowerCase(),
        actualizado_el: new Date().toISOString(),
      }

      if (reglas.id_regla) {
        const { error } = await supabase
          .from('movimientos_reglas_autorizacion')
          .update(payload)
          .eq('id_regla', reglas.id_regla)
        if (error) throw error
      } else {
        const { data: existing } = await supabase.from('movimientos_reglas_autorizacion').select('id_regla').limit(1).maybeSingle()
        if (existing?.id_regla) {
          const { error } = await supabase
            .from('movimientos_reglas_autorizacion')
            .update(payload)
            .eq('id_regla', existing.id_regla)
          if (error) throw error
        } else {
          const { error } = await supabase.from('movimientos_reglas_autorizacion').insert([payload])
          if (error) throw error
        }
      }

      await fetchAllData()
      alert('✅ Matriz de Reglas y Titulares Oficiales guardada correctamente.')
    } catch (err: any) {
      alert('Error guardando reglas (asegúrate de haber ejecutado la actualización del script SQL): ' + err.message)
    } finally {
      setSavingReglas(false)
    }
  }

  const handleSeedAutorizadores = async () => {
    setSeedingAuth(true)
    try {
      const res = await fetch('/api/seed-autorizadores-rh', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error sincronizando autorizadores')
      setSeededAuthModal(json.accounts || [])
      await fetchAllData()
    } catch (err: any) {
      alert('Error creando/sincronizando autorizadores: ' + err.message)
    } finally {
      setSeedingAuth(false)
    }
  }

  const handleUpdateEncargadoUser = async (enc: any, userIdSelected: string) => {
    const matched = perfilesCatalog.find((u) => u.id === userIdSelected)
    if (!matched) return
    const { error } = await supabase
      .from('movimientos_encargados_subdeptos')
      .update({
        id_usuario_encargado: matched.id,
        nombre_encargado: matched.nombre_completo || enc.nombre_encargado,
        correo_encargado: (matched.email || enc.correo_encargado || '').trim().toLowerCase(),
      })
      .eq('id_encargado', enc.id_encargado)

    if (error) {
      alert('Error vinculando usuario encargado: ' + error.message)
      return
    }
    await fetchAllData()
  }

  // 6. VALIDACIÓN DINÁMICA CONECTADA A LA MATRIZ DE REGLAS
  const evaluateChessRules = (post: any, vac: any) => {
    const plazasLibres = Math.max(0, (vac?.plazas_totales || 1) - (vac?.plazas_ocupadas || 0))
    const rule1VacanteLibre = !reglas.regla_vacante_libre_obligatoria || plazasLibres > 0
    const rule2LocalOk = !reglas.regla_requiere_jefe_rh_unidad || Boolean(post.autorizado_rh_local)
    const rule2CorpOk = !reglas.regla_requiere_supt_rh_corporativo || Boolean(post.autorizado_rh_corporativo)
    const rule2RHApproved = rule2LocalOk && rule2CorpOk
    const rule3DestinoPlan = Boolean(post.seleccionado_por_destino && post.fecha_presentacion)
    const rule4OrigenLiberado = !reglas.regla_requiere_liberacion_origen || post.respuesta_depto_origen === 'Autorizado (Sí)'

    const blockers: string[] = []
    if (!rule1VacanteLibre) blockers.push('No hay vacante libre (Plazas llenas — libera primero una plaza)')
    if (!rule2LocalOk) blockers.push(`Falta autorización del Jefe de RH Unidad (${reglas.jefe_rh_unidad_nombre})`)
    if (!rule2CorpOk) blockers.push(`Falta autorización del Supt. de RH Corporativo (${reglas.supt_rh_corporativo_nombre})`)
    if (!rule3DestinoPlan) blockers.push(`El departamento ${vac?.departamento_destino || 'destino'} no ha asignado fecha y plan de avance`)
    if (!rule4OrigenLiberado) {
      if (post.respuesta_depto_origen === 'No / Reprogramar Fecha') {
        blockers.push('El departamento de origen contestó que NO puede en esa fecha (Reprogramar fecha)')
      } else {
        blockers.push(`Falta que el Encargado de ${post.departamento_actual} autorice su salida (SÍ)`)
      }
    }

    return {
      rule1VacanteLibre,
      rule2RHApproved,
      rule3DestinoPlan,
      rule4OrigenLiberado,
      canMove: rule1VacanteLibre && rule2RHApproved && rule3DestinoPlan && rule4OrigenLiberado,
      blockers,
      plazasLibres,
    }
  }

  // MOTOR DEL SIMULADOR DE REGLAS EN VIVO (DRY-RUN SIN AFECTAR BD)
  const simEvaluation = useMemo(() => {
    const encDestinoSim = resolveEncargadoForDept(simState.departamentoDestino, simState.subDepartamentoDestino)
    const encOrigenSim = resolveEncargadoForDept(simState.departamentoOrigen, simState.subDepartamentoOrigen)
    const testMailLower = simState.usuarioPrueba.toLowerCase().trim()

    const r1Ok = !reglas.regla_vacante_libre_obligatoria || simState.plazasLibres > 0
    const r2Ok = !reglas.regla_requiere_jefe_rh_unidad || simState.rhUnidadAprobo
    const r3Ok = !reglas.regla_requiere_supt_rh_corporativo || simState.rhCorpAprobo
    const r4Ok = simState.destinoPlanYFecha
    const r5Ok = !reglas.regla_requiere_liberacion_origen || simState.origenRespuesta === 'Autorizado (Sí)'

    // Identidad esperada según etapa seleccionada en simulador
    let expectedOwnerLabel = ''
    let expectedOwnerEmail = ''
    if (simState.etapaAProbar === 'RH_UNIDAD') {
      expectedOwnerLabel = reglas.jefe_rh_unidad_nombre
      expectedOwnerEmail = reglas.jefe_rh_unidad_correo
    } else if (simState.etapaAProbar === 'RH_CORPORATIVO') {
      expectedOwnerLabel = reglas.supt_rh_corporativo_nombre
      expectedOwnerEmail = reglas.supt_rh_corporativo_correo
    } else if (simState.etapaAProbar === 'PLAN_DESTINO') {
      expectedOwnerLabel = encDestinoSim?.nombre_encargado || `Jefe de ${simState.departamentoDestino}`
      expectedOwnerEmail = encDestinoSim?.correo_encargado || ''
    } else if (simState.etapaAProbar === 'LIBERACION_ORIGEN') {
      expectedOwnerLabel = encOrigenSim?.nombre_encargado || `Jefe de ${simState.departamentoOrigen}`
      expectedOwnerEmail = encOrigenSim?.correo_encargado || ''
    } else {
      expectedOwnerLabel = `${reglas.jefe_rh_unidad_nombre} / ${reglas.sindicato_nombre}`
      expectedOwnerEmail = reglas.jefe_rh_unidad_correo
    }

    const identityPasses =
      !reglas.regla_bloqueo_por_usuario ||
      !expectedOwnerEmail ||
      testMailLower === expectedOwnerEmail.toLowerCase().trim() ||
      (simState.etapaAProbar === 'MOVER_AJEDREZ' &&
        [reglas.jefe_rh_unidad_correo, reglas.supt_rh_corporativo_correo, reglas.sindicato_correo]
          .filter(Boolean)
          .some((m) => m.toLowerCase().trim() === testMailLower))

    // Validación secuencial en la etapa probada
    let sequentialBlocker = ''
    if (reglas.regla_orden_secuencial) {
      if (simState.etapaAProbar === 'RH_CORPORATIVO' && !r2Ok) {
        sequentialBlocker = 'Falta firma previa del Jefe de RH Unidad'
      } else if (simState.etapaAProbar === 'PLAN_DESTINO' && (!r2Ok || !r3Ok)) {
        sequentialBlocker = 'Faltan autorizaciones previas de RH Unidad y/o RH Corporativo'
      } else if (simState.etapaAProbar === 'LIBERACION_ORIGEN' && (!r2Ok || !r3Ok || !r4Ok)) {
        sequentialBlocker = 'Aún no concluyen RH o la definición de Plan/Fecha en Destino'
      }
    }

    const items: SimulacionRuleItem[] = [
      {
        regla: '1. Candado de Vacante / Plaza Libre',
        responsable: `Vacante ${simState.puestoVacante} (${simState.departamentoDestino})`,
        estado: !reglas.regla_vacante_libre_obligatoria ? 'NO_APLICA' : r1Ok ? 'CUMPLE' : 'BLOQUEA',
        detalle: r1Ok
          ? `Hay ${simState.plazasLibres} plaza(s) disponible(s). Pieza desbloqueada para competir.`
          : 'Sin plazas libres (0). Movimiento rechazado hasta liberar plaza.',
      },
      {
        regla: '2. Identidad por Usuario Titular (Candado)',
        responsable: `${expectedOwnerLabel} (${expectedOwnerEmail || 'sin correo'})`,
        estado: !reglas.regla_bloqueo_por_usuario ? 'NO_APLICA' : identityPasses ? 'CUMPLE' : 'BLOQUEA',
        detalle: !reglas.regla_bloqueo_por_usuario
          ? 'Candado estricto desactivado (permite operar desde usuario actual).'
          : identityPasses
          ? `El usuario simulado (${simState.usuarioPrueba}) SÍ coincide con el titular autorizado para ${simState.etapaAProbar}.`
          : `ACCESO BLOQUEADO: El usuario "${simState.usuarioPrueba}" NO es el titular (${expectedOwnerEmail}).`,
      },
      {
        regla: '3. Orden Secuencial Estricto',
        responsable: 'RH Unidad -> RH Corp -> Depto Destino -> Depto Origen',
        estado: !reglas.regla_orden_secuencial ? 'NO_APLICA' : sequentialBlocker ? 'BLOQUEA' : 'CUMPLE',
        detalle: !reglas.regla_orden_secuencial
          ? 'Orden secuencial relajado; etapas pueden firmarse en paralelo.'
          : sequentialBlocker || 'Secuencia respetada correctamente hasta la etapa evaluada.',
      },
      {
        regla: '4. Autorización Jefe de RH Unidad',
        responsable: `${reglas.jefe_rh_unidad_nombre} (${reglas.jefe_rh_unidad_correo})`,
        estado: !reglas.regla_requiere_jefe_rh_unidad ? 'NO_APLICA' : r2Ok ? 'CUMPLE' : 'BLOQUEA',
        detalle: r2Ok ? 'Firma local de RH Unidad aprobada.' : 'Bloqueado: requiere Vo.Bo. del Jefe de RH Unidad.',
      },
      {
        regla: '5. Autorización Supt. RH Corporativo',
        responsable: `${reglas.supt_rh_corporativo_nombre} (${reglas.supt_rh_corporativo_correo})`,
        estado: !reglas.regla_requiere_supt_rh_corporativo ? 'NO_APLICA' : r3Ok ? 'CUMPLE' : 'BLOQUEA',
        detalle: r3Ok ? 'Firma de RH Corporativo aprobada.' : 'Bloqueado: requiere Vo.Bo. del Supt. de RH Corporativo.',
      },
      {
        regla: '6. Plan de Avance y Cita en Destino',
        responsable: `${encDestinoSim?.nombre_encargado} (${encDestinoSim?.correo_encargado})`,
        estado: r4Ok ? 'CUMPLE' : 'BLOQUEA',
        detalle: r4Ok
          ? `Área ${simState.departamentoDestino} definió plan de avance y fecha.`
          : `Falta selección, plan de capacitación y fecha por ${simState.departamentoDestino}.`,
      },
      {
        regla: '7. Liberación Depto/Sub-depto Origen (SÍ/NO)',
        responsable: `${encOrigenSim?.nombre_encargado} (${encOrigenSim?.correo_encargado})`,
        estado: !reglas.regla_requiere_liberacion_origen ? 'NO_APLICA' : r5Ok ? 'CUMPLE' : 'BLOQUEA',
        detalle: r5Ok
          ? `Encargado de ${simState.departamentoOrigen} respondió SÍ autorizo salida.`
          : `Estado "${simState.origenRespuesta}": ${simState.departamentoOrigen} detiene o reprograma la salida.`,
      },
    ]

    const allOk = items.every((i) => i.estado !== 'BLOQUEA')
    const cadenaNotificaciones = [
      `Inscripción Sindicato/Trabajador -> Alerta inmediata a Jefe RH Unidad (${reglas.jefe_rh_unidad_correo})`,
      `Firma RH Unidad -> Dispara alerta + correo a Supt. RH Corporativo (${reglas.supt_rh_corporativo_correo})`,
      `Firma RH Corporativo -> Dispara alerta + correo a ${encDestinoSim?.nombre_encargado} (${encDestinoSim?.correo_encargado})`,
      `Selección/Plan ${simState.departamentoDestino} -> Envía correo SÍ/NO a Encargado Origen (${encOrigenSim?.nombre_encargado} — ${encOrigenSim?.correo_encargado})`,
      simState.origenRespuesta === 'Autorizado (Sí)'
        ? `Respuesta Origen SÍ -> Confirma a ${simState.departamentoDestino}, RH Unidad, RH Corporativo y Sindicato (${reglas.sindicato_correo})`
        : `Respuesta Origen NO/Pendiente -> Avisa de regreso a ${simState.departamentoDestino} y RH para reprogramar fecha`,
    ]

    const efectoDominoMensaje = reglas.regla_permitir_efecto_domino
      ? `EFECTO DOMINÓ ACTIVO: Al mover a ${simState.candidatoNombre} hacia ${simState.puestoVacante} (${simState.departamentoDestino}), se liberará automáticamente su plaza anterior de "${simState.puestoActual}" en "${simState.departamentoOrigen}" abriendo convocatoria de ${reglas.regla_dias_convocatoria} días.`
      : 'Efecto Dominó DESACTIVADO en reglas: al ejecutarse el movimiento no se abrirá vacante automática en origen.'

    return {
      veredicto: (allOk ? 'PROCEDE' : 'BLOQUEADO') as 'PROCEDE' | 'BLOQUEADO',
      items,
      cadenaNotificaciones,
      efectoDominoMensaje,
      encDestinoSim,
      encOrigenSim,
    }
  }, [simState, reglas, encargados])

  // 7. EJECUTAR MOVIMIENTO EN EL TABLERO DE AJEDREZ (Y LIBERAR AUTOMÁTICAMENTE LA PLAZA ANTERIOR — EFECTO DOMINÓ)
  const handleExecuteChessMove = async (post: any) => {
    const vac = vacantes.find((v) => v.id_vacante === post.id_vacante) || currentVacante
    if (!vac) return

    const rules = evaluateChessRules(post, vac)
    if (!rules.canMove) {
      alert(`🛑 MOVIMIENTO BLOQUEADO POR REGLAS DE AJEDREZ:\n\n• ${rules.blockers.join('\n• ')}`)
      return
    }

    const openDominoVacancy = confirm(
      `♟️ ¿Ejecutar movimiento oficial de "${post.nombre_completo}" de [${post.puesto_actual} en ${post.departamento_actual}] hacia [${vac.puesto_vacante} en ${vac.departamento_destino}]?\n\n${
        reglas.regla_permitir_efecto_domino
          ? `Al mover esta pieza, su puesto anterior (${post.puesto_actual} en ${post.departamento_actual}) quedará libre y se abrirá automáticamente su vacante en el tablero.`
          : 'Se registrará el traslado y su estancia histórica sin apertura automática de plaza dominó.'
      }`
    )
    if (!openDominoVacancy) return

    try {
      // 1. Actualizar estatus de la postulación
      await supabase
        .from('movimientos_postulantes')
        .update({
          estatus_movimiento: 'Movimiento Ejecutado (En Puesto)',
          fecha_ejecucion_movimiento: new Date().toISOString(),
        })
        .eq('id_postulacion', post.id_postulacion)

      await supabase
        .from('movimientos_bandeja_notificaciones')
        .update({ atendida: true, leida: true })
        .eq('id_postulacion', post.id_postulacion)

      // 2. Ocupar la plaza en la vacante destino
      const nextOcupadas = (vac.plazas_ocupadas || 0) + 1
      const isFull = nextOcupadas >= (vac.plazas_totales || 1)
      await supabase
        .from('movimientos_vacantes')
        .update({
          plazas_ocupadas: nextOcupadas,
          estatus_vacante: isFull ? 'Cubierta / Cerrada' : vac.estatus_vacante,
        })
        .eq('id_vacante', vac.id_vacante)

      // 3. Crear registro en el Historial de Estancia (donde se cuentan los días y se califica)
      await supabase.from('movimientos_historial_estancia').insert([
        {
          id_postulacion: post.id_postulacion,
          id_vacante: vac.id_vacante,
          id_empleado: post.id_empleado || null,
          nombre_completo: post.nombre_completo,
          numero_empleado: post.numero_empleado,
          departamento_origen: post.departamento_actual,
          sub_departamento_origen: post.sub_departamento_actual,
          puesto_origen: post.puesto_actual,
          departamento_asignado: vac.departamento_destino,
          sub_departamento_asignado: vac.sub_departamento_destino,
          puesto_asignado: vac.puesto_vacante,
          fecha_inicio: post.fecha_presentacion || new Date().toISOString().split('T')[0],
          dias_acumulados: 1,
          dictamen: 'En Periodo de Prueba / Capacitación',
          activo_en_puesto: true,
        },
      ])

      // 4. EFECTO DOMINÓ DE AJEDREZ (según regla configurada)
      let dominoFolio = ''
      if (reglas.regla_permitir_efecto_domino) {
        dominoFolio = `CONV-DOM-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`
        const todayStr = new Date().toISOString().split('T')[0]
        const diasConv = Number(reglas.regla_dias_convocatoria || 10)
        const closeDays = new Date(Date.now() + diasConv * 86400000).toISOString().split('T')[0]

        await supabase.from('movimientos_vacantes').insert([
          {
            folio_convocatoria: dominoFolio,
            puesto_vacante: post.puesto_actual,
            departamento_destino: post.departamento_actual,
            sub_departamento_destino: post.sub_departamento_actual || post.departamento_actual,
            plazas_totales: 1,
            plazas_ocupadas: 0,
            origen_vacante: 'Liberada por Movimiento (Efecto Dominó)',
            liberada_por_nombre: post.nombre_completo,
            categoria_tabulador: 'Sindicalizado / Escalafón',
            requisitos: `Vacante liberada por ascenso de ${post.nombre_completo} a ${vac.puesto_vacante}. Periodo de ${diasConv} días abierto para postulaciones.`,
            fecha_apertura: todayStr,
            fecha_cierre_inscripcion: closeDays,
            dias_convocatoria: diasConv,
            estatus_vacante: `Convocatoria Abierta (${diasConv} Días)`,
          },
        ])
      }

      // 5. Bitácora de avisos
      await supabase.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: vac.id_vacante,
          id_postulacion: post.id_postulacion,
          tipo_aviso: 'MOVIMIENTO_AJEDREZ',
          remitente: `Tablero de Ajedrez (${actorName})`,
          destinatarios: `${vac.departamento_destino}, ${post.departamento_actual}, RH Corporativo y Sindicato`,
          asunto: `♟️ Movimiento Ejecutado: ${post.nombre_completo} -> ${vac.puesto_vacante} (${vac.departamento_destino})`,
          mensaje: `${post.nombre_completo} ocupó la plaza de ${vac.puesto_vacante} en ${vac.departamento_destino}.${
            dominoFolio
              ? ` En automático se liberó su plaza anterior de ${post.puesto_actual} en ${post.departamento_actual} (Nueva convocatoria ${dominoFolio}).`
              : ''
          }`,
          correo_enviado: false,
        },
      ])

      await fetchAllData()
      alert(
        `♟️ ¡Movimiento ejecutado con éxito!\n\n1) ${post.nombre_completo} ya está activo en ${vac.puesto_vacante} (${vac.departamento_destino}) y comenzó su conteo de días en el Historial.${
          dominoFolio ? `\n2) Su puesto anterior (${post.puesto_actual} en ${post.departamento_actual}) quedó liberado automáticamente con la nueva convocatoria ${dominoFolio}.` : ''
        }`
      )
    } catch (err: any) {
      alert('Error ejecutando movimiento: ' + err.message)
    }
  }

  // Liberar una plaza manualmente en una vacante si alguien se regresó
  const handleLiberarPlazaVacante = async (vac: any) => {
    const nextOcupadas = Math.max(0, (vac.plazas_ocupadas || 0) - 1)
    await supabase
      .from('movimientos_vacantes')
      .update({
        plazas_ocupadas: nextOcupadas,
        estatus_vacante: 'En Selección y Plan de Avance',
      })
      .eq('id_vacante', vac.id_vacante)
    await fetchAllData()
  }

  // 8. GUARDAR CALIFICACIÓN Y DÍAS DE ESTANCIA DEL DEPARTAMENTO ASIGNADO
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evaluatingItem) return
    try {
      const endDate = evalForm.fecha_fin || new Date().toISOString().split('T')[0]
      const dias = diffDaysInclusive(evaluatingItem.fecha_inicio, endDate)

      const { error } = await supabase
        .from('movimientos_historial_estancia')
        .update({
          calificacion: Number(evalForm.calificacion),
          dictamen: evalForm.dictamen,
          comentarios_desempeno: evalForm.comentarios_desempeno,
          fecha_fin: evalForm.fecha_fin || null,
          dias_acumulados: dias,
          evaluado_por: profile?.nombre_completo || `Jefatura ${evaluatingItem.departamento_asignado}`,
          fecha_evaluacion: new Date().toISOString(),
          activo_en_puesto: evalForm.dictamen !== 'Regresado a Puesto Anterior',
        })
        .eq('id_historial', evaluatingItem.id_historial)

      if (error) throw error

      // Si el departamento dictaminó regresarlo a su puesto anterior, liberar la plaza automáticamente
      if (evalForm.dictamen === 'Regresado a Puesto Anterior' && evaluatingItem.id_vacante) {
        const vac = vacantes.find((v) => v.id_vacante === evaluatingItem.id_vacante)
        if (vac) {
          await handleLiberarPlazaVacante(vac)
        }
      }

      await supabase.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: evaluatingItem.id_vacante || null,
          id_postulacion: evaluatingItem.id_postulacion || null,
          tipo_aviso: 'CALIFICACION_DEPTO',
          remitente: `Departamento ${evaluatingItem.departamento_asignado}`,
          destinatarios: 'RH Unidad, RH Corporativo, Sindicato y Expediente',
          asunto: `⭐ Evaluación de Estancia: ${evaluatingItem.nombre_completo} (${evalForm.calificacion}/10)`,
          mensaje: `El departamento ${evaluatingItem.departamento_asignado} calificó a ${evaluatingItem.nombre_completo} en el puesto de ${evaluatingItem.puesto_asignado} (${dias} días de estancia) con ${evalForm.calificacion}/10 — Dictamen: ${evalForm.dictamen}.`,
          correo_enviado: false,
        },
      ])

      setEvaluatingItem(null)
      await fetchAllData()
    } catch (err: any) {
      alert('Error guardando calificación: ' + err.message)
    }
  }

  // Guardar nuevo Encargado Multi-Subdepartamento
  const handleSaveEncargado = async (e: React.FormEvent) => {
    e.preventDefault()
    const subs = encargadoForm.sub_departamentos_csv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const { error } = await supabase.from('movimientos_encargados_subdeptos').insert([
      {
        nombre_encargado: encargadoForm.nombre_encargado.trim(),
        correo_encargado: encargadoForm.correo_encargado.trim(),
        cargo: encargadoForm.cargo.trim(),
        departamento_principal: encargadoForm.departamento_principal.trim(),
        sub_departamentos: subs.length > 0 ? subs : [encargadoForm.departamento_principal.trim()],
      },
    ])
    if (error) {
      alert('Error guardando encargado: ' + error.message)
      return
    }
    setShowEncargadoModal(false)
    setEncargadoForm({
      nombre_encargado: '',
      correo_encargado: '',
      cargo: 'Jefe / Encargado de Áreas',
      departamento_principal: '',
      sub_departamentos_csv: '',
    })
    await fetchAllData()
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    )
  }

  if (schemaMissing) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-amber-50 border-2 border-amber-300 rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-black text-zinc-900 uppercase">
          Activar Base de Datos de Movimientos, Escalafón Sindical y Ajedrez
        </h2>
        <p className="text-sm text-zinc-700">
          Ejecuta el script <code className="bg-amber-100 px-2 py-0.5 rounded font-mono font-bold">SQL_MOVIMIENTOS_SINDICATO_VACANTES.sql</code> en el{' '}
          <strong>SQL Editor de Supabase</strong> para habilitar las tablas de convocatorias de 10 días, postulantes, encargados multi-subdepartamento, correos interactivos e historial con calificaciones.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* HEADER PRINCIPAL */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Layers className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-400">
              Sindicato • RH Unidad • RH Corporativo • Departamentos y Sub-departamentos
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Centro Maestro de Vacantes, Escalafón y Ajedrez de Movimientos
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Convocatorias de 10 días, inscripción de postulantes, plan de avance, correos automáticos a encargados multi-subdepartamento, tablero de ajedrez con reglas e historial con calificación.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchAllData}
            className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setInscribirForm({
                ...inscribirForm,
                id_vacante: currentVacante?.id_vacante || '',
                puesto_postulado: currentVacante?.puesto_vacante || 'Ayudante de Perforista',
              })
              setShowInscribirModal(true)
            }}
            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 font-black text-xs px-4 py-3 rounded-xl"
          >
            <Users className="w-4 h-4" />
            <span>+ Inscribir Postulante</span>
          </button>
          <button
            onClick={() => setShowVacanteModal(true)}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-5 py-3 rounded-xl shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Abrir Vacante &amp; Convocatoria (10 Días)</span>
          </button>
        </div>
      </div>

      {/* BANDEJA PERSONAL DE SESIÓN Y AUTORIZACIONES PENDIENTES */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase text-zinc-900">{actorName}</span>
                <span className="text-[11px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-lg">
                  {actorEmail || 'Sin correo en sesión'}
                </span>
                <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                  Rol: {profile?.rol || 'Administrador'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                    reglas.regla_bloqueo_por_usuario
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                  }`}
                >
                  {reglas.regla_bloqueo_por_usuario ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {reglas.regla_bloqueo_por_usuario ? 'Candado Estricto por Titular ACTIVO' : 'Modo Libre (Sin bloqueo por usuario)'}
                </span>
                {canActAsRhUnidad && (
                  <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-black">
                    ✓ Firma RH Unidad habilitada
                  </span>
                )}
                {canActAsRhCorporativo && (
                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-black">
                    ✓ Firma RH Corporativo habilitada
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reglas')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-black text-amber-400 text-xs font-black"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurar Reglas y Autorizadores</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('simulador')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-black"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Simular Reglas y Reporte PDF</span>
            </button>
          </div>
        </div>

        {/* Alertas de Bandeja Personal */}
        {myPendingAlerts.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-950 font-black text-xs uppercase">
                <Inbox className="w-4 h-4 text-amber-600" />
                <span>Tienes {myPendingAlerts.length} Autorización(es) / Notificación(es) Pendiente(s) para Tu Usuario</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {myPendingAlerts.map((alerta) => {
                const postMatch = postulantes.find((p) => p.id_postulacion === alerta.id_postulacion)
                return (
                  <div
                    key={alerta.id_alerta}
                    className="bg-white border border-amber-200 rounded-xl p-3 flex flex-col justify-between gap-2 text-xs shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-amber-400 px-2 py-0.5 rounded">
                          {alerta.etapa}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(alerta.creado_el).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                      <p className="font-black text-zinc-900 mt-1.5">{alerta.titulo}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">{alerta.mensaje}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100">
                      {postMatch && alerta.etapa === 'PASO_1_RH_UNIDAD' && (
                        <button
                          type="button"
                          disabled={actorSubmittingId === postMatch.id_postulacion}
                          onClick={() => handleAutorizarEtapa(postMatch, 'RH_UNIDAD', { decision: 'APROBAR' })}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-lg"
                        >
                          ✓ Autorizar RH Unidad y Notificar RH Corp.
                        </button>
                      )}
                      {postMatch && alerta.etapa === 'PASO_2_RH_CORPORATIVO' && (
                        <button
                          type="button"
                          disabled={actorSubmittingId === postMatch.id_postulacion}
                          onClick={() => handleAutorizarEtapa(postMatch, 'RH_CORPORATIVO', { decision: 'APROBAR' })}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] rounded-lg"
                        >
                          ✓ Firmar RH Corporativo y Notificar Destino
                        </button>
                      )}
                      {postMatch && alerta.etapa === 'PASO_3_PLAN_DESTINO' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (alerta.id_vacante) setSelectedVacanteId(alerta.id_vacante)
                            setActiveTab('autorizaciones')
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] rounded-lg"
                        >
                          📅 Ir a Seleccionar Fecha y Plan
                        </button>
                      )}
                      {postMatch && alerta.etapa === 'PASO_4_LIBERACION_ORIGEN' && (
                        <>
                          <button
                            type="button"
                            disabled={actorSubmittingId === postMatch.id_postulacion}
                            onClick={() => handleOriginDepartmentResponse(postMatch, 'SI')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-lg"
                          >
                            ✅ Sí Autorizo Salida
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReprogramTarget(postMatch)
                              setReprogramDate(
                                postMatch.fecha_presentacion || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
                              )
                              setReprogramNote('')
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] rounded-lg"
                          >
                            ⏳ No / Reprogramar Fecha
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (alerta.id_vacante) setSelectedVacanteId(alerta.id_vacante)
                          setActiveTab('autorizaciones')
                        }}
                        className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[11px] rounded-lg ml-auto"
                      >
                        Ver en Tablero
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2 bg-zinc-50 rounded-xl px-4 py-2.5 border border-zinc-200">
            <span>
              <Bell className="w-3.5 h-3.5 inline mr-1.5 text-zinc-400" />
              Sin notificaciones urgentes bloqueadas para <strong>{actorEmail || actorName}</strong>.
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              Titulares: RH Unidad ({reglas.jefe_rh_unidad_correo}) • RH Corp. ({reglas.supt_rh_corporativo_correo})
            </span>
          </div>
        )}
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Convocatorias / Vacantes</span>
          <p className="text-2xl font-black text-zinc-900">
            {vacantes.filter((v) => v.estatus_vacante !== 'Cubierta / Cerrada').length}{' '}
            <span className="text-xs font-normal text-zinc-400">/ {vacantes.length}</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Postulantes Inscritos</span>
          <p className="text-2xl font-black text-amber-600">{postulantes.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Confirmados por Depto (SÍ)</span>
          <p className="text-2xl font-black text-emerald-600">
            {postulantes.filter((p) => p.respuesta_depto_origen === 'Autorizado (Sí)').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Por Reprogramar (NO)</span>
          <p className="text-2xl font-black text-rose-600">
            {postulantes.filter((p) => p.respuesta_depto_origen === 'No / Reprogramar Fecha').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">En Estancia / Evaluados</span>
          <p className="text-2xl font-black text-blue-600">{historial.length}</p>
        </div>
      </div>

      {/* BARRA DE 7 PESTAÑAS */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        {[
          { id: 'convocatorias', label: `1. Convocatorias (${vacantes.length})`, icon: FileText },
          { id: 'inscripciones', label: `2. Inscripción (${postulantes.length})`, icon: Users },
          { id: 'autorizaciones', label: '3. Autorizaciones por Usuario', icon: Mail },
          { id: 'ajedrez', label: '4. ♟️ Tablero Ajedrez', icon: Layers },
          { id: 'reglas', label: '5. ⚙️ Reglas y Autorizadores', icon: Settings },
          { id: 'simulador', label: '6. 🧪 Simulador y Reporte', icon: Sliders },
          { id: 'historial', label: `7. Historial y Encargados (${historial.length})`, icon: Award },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                active ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* SELECTOR DE VACANTE ACTIVA (Para Pestañas 2, 3 y 4) */}
      {vacantes.length > 0 && (activeTab === 'inscripciones' || activeTab === 'autorizaciones' || activeTab === 'ajedrez') && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase text-amber-900">Vacante / Convocatoria Activa:</span>
            <select
              value={selectedVacanteId}
              onChange={(e) => setSelectedVacanteId(e.target.value)}
              className="bg-white border border-amber-300 text-zinc-900 text-xs font-black px-3.5 py-2 rounded-xl"
            >
              {vacantes.map((v) => (
                <option key={v.id_vacante} value={v.id_vacante}>
                  {v.folio_convocatoria} — {v.puesto_vacante} ({v.departamento_destino}) • Plazas libres:{' '}
                  {Math.max(0, (v.plazas_totales || 1) - (v.plazas_ocupadas || 0))}
                </option>
              ))}
            </select>
          </div>

          {currentVacante && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => generateConvocatoriaSindicatoPDF(currentVacante)}
                className="px-3 py-1.5 bg-zinc-900 text-amber-400 text-xs font-black rounded-xl inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Aviso de Vacante (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInscribirForm({
                    ...inscribirForm,
                    id_vacante: currentVacante.id_vacante,
                    puesto_postulado: currentVacante.puesto_vacante,
                  })
                  setShowInscribirModal(true)
                }}
                className="px-3 py-1.5 bg-amber-500 text-black text-xs font-black rounded-xl inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Inscribir Trabajador</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 1: CONVOCATORIAS (10 DÍAS) & VACANTES LIBRES
         ===================================================================== */}
      {activeTab === 'convocatorias' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vacantes.map((vac) => {
              const countdown = getConvocatoriaCountdown(vac.fecha_cierre_inscripcion)
              const inscritosCount = postulantes.filter((p) => p.id_vacante === vac.id_vacante).length
              const plazasLibres = Math.max(0, (vac.plazas_totales || 1) - (vac.plazas_ocupadas || 0))

              return (
                <div
                  key={vac.id_vacante}
                  className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black bg-zinc-900 text-amber-400 px-2.5 py-1 rounded-lg">
                          {vac.folio_convocatoria}
                        </span>
                        {vac.origen_vacante?.includes('Dominó') && (
                          <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg">
                            ♟️ Liberada por Movimiento de Ajedrez
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                          plazasLibres === 0
                            ? 'bg-zinc-100 text-zinc-600 border-zinc-300'
                            : countdown.isOpen
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {plazasLibres === 0
                          ? 'Vacante Cubierta'
                          : countdown.isOpen
                          ? `Convocatoria Abierta (${countdown.daysLeft} días rest.)`
                          : 'Periodo 10 Días Cerrado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-zinc-400 block">
                        Vacante en {vac.departamento_destino}{' '}
                        {vac.sub_departamento_destino ? `• ${vac.sub_departamento_destino}` : ''}
                      </span>
                      <h3 className="text-xl font-black text-zinc-900 uppercase">{vac.puesto_vacante}</h3>
                      {vac.liberada_por_nombre && (
                        <p className="text-xs text-amber-700 font-bold mt-0.5">
                          Dejada libre por ascenso de: {vac.liberada_por_nombre}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold block">PLAZAS LIBRES</span>
                        <strong className="text-base font-black text-emerald-600">
                          {plazasLibres} <span className="text-xs text-zinc-400">/ {vac.plazas_totales}</span>
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold block">INSCRITOS</span>
                        <strong className="text-base font-black text-zinc-900">{inscritosCount} trab.</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold block">CIERRE (10 DÍAS)</span>
                        <strong className="font-mono text-zinc-800">{formatShortDate(vac.fecha_cierre_inscripcion)}</strong>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 line-clamp-2">{vac.requisitos}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => generateConvocatoriaSindicatoPDF(vac)}
                      className="px-3 py-2 bg-zinc-900 hover:bg-black text-amber-400 text-xs font-black rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Aviso de Vacante (PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVacanteId(vac.id_vacante)
                        setInscribirForm({
                          ...inscribirForm,
                          id_vacante: vac.id_vacante,
                          puesto_postulado: vac.puesto_vacante,
                        })
                        setShowInscribirModal(true)
                      }}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black rounded-xl inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Inscribir Postulante</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVacanteId(vac.id_vacante)
                        setActiveTab('autorizaciones')
                      }}
                      className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-black rounded-xl inline-flex items-center gap-1 ml-auto"
                    >
                      <span>Gestionar Selección</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {vacantes.length === 0 && (
            <div className="bg-white rounded-3xl border-2 border-dashed border-zinc-300 p-12 text-center space-y-4">
              <HardHat className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-zinc-900 uppercase">
                  No hay Convocatorias de Vacantes abiertas aún
                </h3>
                <p className="text-xs text-zinc-500">
                  Abre tu primera convocatoria (por ejemplo: <strong>Ayudante de Perforista</strong> para el departamento de <strong>Mina</strong>) para publicar el boletín de 10 días e inscribir a los trabajadores postulados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVacanteModal(true)}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs rounded-xl shadow"
              >
                + Abrir Primera Vacante (Ej. Ayudante de Perforista - Mina)
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: INSCRIPCIÓN DE POSTULANTES (ESCALAFÓN SINDICAL)
         ===================================================================== */}
      {activeTab === 'inscripciones' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase text-amber-400">
                  Padrón de Trabajadores Inscritos a la Convocatoria (Ordenados por Antigüedad / Escalafón)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Incluye puesto actual, sub-departamento, encargado responsable, celular, años de antigüedad, experiencia y si requiere capacitación previa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInscribirModal(true)}
                className="px-4 py-2 bg-amber-500 text-black font-black text-xs rounded-xl shrink-0"
              >
                + Inscribir Trabajador
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-xs">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Escalafón / Trabajador</th>
                    <th className="px-4 py-3 text-left">Depto / Sub-depto y Puesto Actual</th>
                    <th className="px-4 py-3 text-left">Puesto Postulado</th>
                    <th className="px-4 py-3 text-left">Antigüedad</th>
                    <th className="px-4 py-3 text-left">Experiencia &amp; Capacitación</th>
                    <th className="px-4 py-3 text-left">Encargado Único Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {currentPostulantes.map((p, idx) => (
                    <tr key={p.id_postulacion} className="hover:bg-zinc-50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-zinc-900 text-amber-400 font-mono font-black text-[11px] flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-black text-zinc-900">{p.nombre_completo}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              Inscrito: {formatShortDate(p.fecha_inscripcion)} • Cel: {p.celular || 'S/N'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-zinc-900">{p.puesto_actual}</div>
                        <div className="text-[11px] text-zinc-500">
                          {p.departamento_actual}
                          {p.sub_departamento_actual ? ` • ${p.sub_departamento_actual}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-black text-amber-700">{p.puesto_postulado}</td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-black text-sm text-zinc-900">{p.anos_antiguedad} años</span>
                      </td>
                      <td className="px-4 py-3.5 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              p.tiene_anos_experiencia ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {p.tiene_anos_experiencia ? '✓ Con Años Exp.' : 'Sin Exp. Previa'}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              p.tiene_experiencia_puesto ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {p.tiene_experiencia_puesto ? '✓ Exp. en el Puesto' : 'Nuevo en el Puesto'}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              p.requiere_capacitacion_previa ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {p.requiere_capacitacion_previa ? '⚠️ Requiere Capacitación Previa' : 'Listo Directo'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-zinc-800">{p.encargado_origen_nombre}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{p.encargado_origen_correo}</div>
                      </td>
                    </tr>
                  ))}
                  {currentPostulantes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-400">
                        Aún no hay trabajadores inscritos en esta convocatoria. Haz clic en &quot;+ Inscribir Trabajador&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: AUTORIZACIONES POR USUARIO TITULAR, PLAN DESTINO Y ENCARGADOS
         ===================================================================== */}
      {activeTab === 'autorizaciones' && currentVacante && (
        <div className="space-y-6">
          {/* Cinta de Cadena de Responsables Titulares según Matriz */}
          <div className="bg-zinc-900 text-white rounded-2xl p-4 border border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] font-mono text-amber-400 block uppercase">1. Jefe de RH Unidad</span>
              <strong className="block truncate">{reglas.jefe_rh_unidad_nombre}</strong>
              <span className="text-[10px] font-mono text-zinc-400">{reglas.jefe_rh_unidad_correo}</span>
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] font-mono text-indigo-400 block uppercase">2. Supt. RH Corporativo</span>
              <strong className="block truncate">{reglas.supt_rh_corporativo_nombre}</strong>
              <span className="text-[10px] font-mono text-zinc-400">{reglas.supt_rh_corporativo_correo}</span>
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] font-mono text-blue-400 block uppercase">
                3. Destino ({currentVacante.departamento_destino})
              </span>
              <strong className="block truncate">
                {resolveEncargadoForDept(currentVacante.departamento_destino, currentVacante.sub_departamento_destino)?.nombre_encargado}
              </strong>
              <span className="text-[10px] font-mono text-zinc-400">
                {resolveEncargadoForDept(currentVacante.departamento_destino, currentVacante.sub_departamento_destino)?.correo_encargado}
              </span>
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] font-mono text-emerald-400 block uppercase">4. Sindicato (Convocatoria)</span>
              <strong className="block truncate">{reglas.sindicato_nombre}</strong>
              <span className="text-[10px] font-mono text-zinc-400">{reglas.sindicato_correo}</span>
            </div>
          </div>

          {/* Barra de Flujo en 3 Pasos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* PASO A: Autorización Previa RH Unidad -> RH Corporativo */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-amber-600">
                  PASO 1 Y 2 • FIRMAS RH UNIDAD &amp; CORPORATIVO
                </span>
                <ShieldCheck className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-sm font-black uppercase text-zinc-900">
                Autorización por Usuario Titular
              </h3>
              <p className="text-xs text-zinc-500">
                Cada firma se registra con el usuario autenticado y dispara alerta + correo al siguiente autorizador de la cadena.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={!canActAsRhUnidad}
                  onClick={() => handleAuthorizeAllRHStage('RH_UNIDAD')}
                  className="w-full py-2 px-3 bg-zinc-900 hover:bg-black disabled:opacity-40 text-amber-400 font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
                >
                  {canActAsRhUnidad ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>1A. Firmar Pendientes (Jefe RH Unidad)</span>
                </button>
                <button
                  type="button"
                  disabled={!canActAsRhCorporativo}
                  onClick={() => handleAuthorizeAllRHStage('RH_CORPORATIVO')}
                  className="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
                >
                  {canActAsRhCorporativo ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>1B. Firmar Pendientes (Supt. RH Corporativo)</span>
                </button>
              </div>
            </div>

            {/* PASO B: Plan de Avance y Fecha del Departamento de la Vacante (Mina) */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-blue-600">
                  PASO 3 • DEPTO VACANTE ({currentVacante.departamento_destino})
                </span>
                <HardHat className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-black uppercase text-zinc-900">
                Plan de Avance y Fechas de Presentación
              </h3>
              <div className="space-y-2 text-xs">
                <input
                  value={currentVacante.plan_avance_departamento || ''}
                  onChange={async (e) => {
                    const val = e.target.value
                    setVacantes(vacantes.map((v) => (v.id_vacante === currentVacante.id_vacante ? { ...v, plan_avance_departamento: val } : v)))
                    await supabase.from('movimientos_vacantes').update({ plan_avance_departamento: val }).eq('id_vacante', currentVacante.id_vacante)
                  }}
                  placeholder="Plan de capacitación y avance de Mina..."
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Marca en la tabla inferior a los candidatos elegidos por <strong>{currentVacante.departamento_destino}</strong>. Al confirmar se notificará en automático a su departamento de origen.
              </p>
            </div>

            {/* PASO C: Disparo Masivo / Reenvío de Correos a Encargados de Origen */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-emerald-600">
                  PASO 4 • AVISO SÍ / NO A DEPTOS ORIGEN
                </span>
                <Mail className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-black uppercase text-zinc-900">
                Notificar a Encargados Multi-Subdepartamento
              </h3>
              <p className="text-xs text-zinc-500">
                Envía o reenvía un correo consolidado a los encargados de los departamentos de origen con botones <strong>SÍ</strong> o <strong>NO / Reprogramar</strong>.
              </p>
              <button
                type="button"
                disabled={sendingEmails}
                onClick={handleDispatchEmailsToOriginDepartments}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {sendingEmails
                    ? 'Enviando Correos...'
                    : `Enviar/Reenviar Correos a Deptos Origen (${currentPostulantes.filter((p) => p.seleccionado_por_destino).length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Tabla Interactiva de Candidatos, Candados de Usuario, Fechas y Respuestas */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-900 text-white font-black text-xs uppercase flex items-center justify-between">
              <span>
                Control de Firmas por Usuario, Fechas y Respuestas — {currentVacante.puesto_vacante} ({currentVacante.departamento_destino})
              </span>
              <span className="text-[11px] text-amber-400 font-mono">
                Plazas disponibles: {Math.max(0, (currentVacante.plazas_totales || 1) - (currentVacante.plazas_ocupadas || 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-xs">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Postulante / Origen</th>
                    <th className="px-4 py-3 text-left">1. Firmas RH Unidad &amp; Corp.</th>
                    <th className="px-4 py-3 text-left">2. Selección {currentVacante.departamento_destino} &amp; Fecha</th>
                    <th className="px-4 py-3 text-left">3. Respuesta Encargado Origen</th>
                    <th className="px-4 py-3 text-right">4. Responder (Titular Origen)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {currentPostulantes.map((p) => {
                    const destCheck = canActForDept(currentVacante.departamento_destino, currentVacante.sub_departamento_destino)
                    const origCheck = canActForDept(p.departamento_actual, p.sub_departamento_actual, p.encargado_origen_correo)
                    const isBusy = actorSubmittingId === p.id_postulacion

                    return (
                      <tr key={p.id_postulacion} className="hover:bg-zinc-50">
                        <td className="px-4 py-3.5">
                          <div className="font-black text-zinc-900">{p.nombre_completo}</div>
                          <div className="text-[11px] text-zinc-500">
                            {p.puesto_actual} • <strong>{p.departamento_actual}</strong>
                            {p.sub_departamento_actual ? ` (${p.sub_departamento_actual})` : ''}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400">
                            Antigüedad: {p.anos_antiguedad} años • Titular Origen: {origCheck.enc?.nombre_encargado || p.encargado_origen_nombre} (
                            {p.encargado_origen_correo || origCheck.enc?.correo_encargado})
                          </div>
                        </td>

                        {/* 1. RH Local y Corporativo con Candado y Auditoría */}
                        <td className="px-4 py-3.5 space-y-2">
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAutorizarEtapa(p, 'RH_UNIDAD', { decision: p.autorizado_rh_local ? 'RECHAZAR' : 'APROBAR' })}
                              title={
                                canActAsRhUnidad
                                  ? `Firmar como Jefe RH Unidad (${reglas.jefe_rh_unidad_correo})`
                                  : `🔒 Bloqueado: solo ${reglas.jefe_rh_unidad_correo} puede firmar`
                              }
                              className={`inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-black border ${
                                p.autorizado_rh_local
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : canActAsRhUnidad
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                  : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                              }`}
                            >
                              <span>{p.autorizado_rh_local ? '✓ 1. RH Unidad OK' : '1. Firmar RH Unidad'}</span>
                              {canActAsRhUnidad ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            </button>
                            {p.autorizado_rh_local_por && (
                              <span className="text-[9px] text-emerald-700 font-mono">
                                Firmó: {p.autorizado_rh_local_por}
                              </span>
                            )}

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleAutorizarEtapa(p, 'RH_CORPORATIVO', { decision: p.autorizado_rh_corporativo ? 'RECHAZAR' : 'APROBAR' })
                              }
                              title={
                                canActAsRhCorporativo
                                  ? `Firmar como Supt. RH Corporativo (${reglas.supt_rh_corporativo_correo})`
                                  : `🔒 Bloqueado: solo ${reglas.supt_rh_corporativo_correo} puede firmar`
                              }
                              className={`inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-black border ${
                                p.autorizado_rh_corporativo
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : canActAsRhCorporativo
                                  ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                                  : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                              }`}
                            >
                              <span>{p.autorizado_rh_corporativo ? '✓ 2. RH Corp. OK' : '2. Firmar RH Corp.'}</span>
                              {canActAsRhCorporativo ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            </button>
                            {p.autorizado_rh_corporativo_por && (
                              <span className="text-[9px] text-indigo-700 font-mono">
                                Firmó: {p.autorizado_rh_corporativo_por}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Selección por Depto Destino + Fecha */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={isBusy}
                              checked={Boolean(p.seleccionado_por_destino)}
                              onChange={(e) => handleSelectCandidateByDestination(p, e.target.checked)}
                              className="w-4 h-4 rounded border-zinc-300 text-amber-500"
                            />
                            <input
                              type="date"
                              value={p.fecha_presentacion || ''}
                              onChange={(e) => handleSelectCandidateByDestination(p, true, e.target.value)}
                              className="border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
                            />
                            {!destCheck.allowed && (
                              <span title={`🔒 Solo titular destino (${destCheck.enc?.correo_encargado})`}>
                                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                              </span>
                            )}
                          </div>
                          {p.seleccionado_por_usuario && (
                            <span className="block mt-1 text-[10px] text-blue-700 font-mono">
                              Plan fijado por: {p.seleccionado_por_usuario}
                            </span>
                          )}
                          {p.correo_enviado_origen && (
                            <span className="inline-block mt-0.5 text-[10px] text-emerald-700 font-bold">
                              📧 Notificado a {p.encargado_origen_nombre}
                            </span>
                          )}
                        </td>

                        {/* 3. Respuesta del Departamento de Origen */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                              p.respuesta_depto_origen === 'Autorizado (Sí)'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : p.respuesta_depto_origen === 'No / Reprogramar Fecha'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {p.respuesta_depto_origen}
                          </span>
                          {p.aviso_retorno_destino && (
                            <span className="block text-[10px] text-blue-700 font-bold mt-1">
                              🔔 Aviso enviado de vuelta a {currentVacante.departamento_destino}
                            </span>
                          )}
                        </td>

                        {/* 4. Botones de Respuesta del Jefe de Origen */}
                        <td className="px-4 py-3.5 text-right space-x-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleOriginDepartmentResponse(p, 'SI')}
                            title={
                              origCheck.allowed
                                ? 'Confirmar que SÍ autoriza salida'
                                : `🔒 Solo ${origCheck.enc?.correo_encargado} puede liberar`
                            }
                            className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg inline-flex items-center gap-1 ${
                              origCheck.allowed
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {!origCheck.allowed && <Lock className="w-3 h-3" />}
                            <span>✅ Depto Dice SÍ</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              if (!origCheck.allowed) {
                                alert(
                                  `🔒 Bloqueado por Matriz de Reglas: Solo el encargado de ${p.departamento_actual} (${
                                    origCheck.enc?.correo_encargado || p.encargado_origen_correo
                                  }) puede responder o reprogramar.`
                                )
                                return
                              }
                              setReprogramTarget(p)
                              setReprogramDate(
                                p.fecha_presentacion || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
                              )
                              setReprogramNote('')
                            }}
                            className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg inline-flex items-center gap-1 ${
                              origCheck.allowed
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {!origCheck.allowed && <Lock className="w-3 h-3" />}
                            <span>⏳ NO / Nueva Fecha</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: TABLERO DE AJEDREZ DE MOVIMIENTOS (CON REGLAS ESTRICTAS)
         ===================================================================== */}
      {activeTab === 'ajedrez' && (
        <div className="space-y-6">
          {/* Banner de Reglas del Tablero de Ajedrez */}
          <div className="bg-zinc-900 text-white rounded-2xl p-5 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Motor de Reglas del Tablero de Ajedrez Minero</span>
              </div>
              <p className="text-xs text-zinc-300">
                Ninguna pieza (trabajador) puede moverse si: <strong>1) No hay vacante libre</strong>,{' '}
                <strong>2) Falta autorización de RH/Corporativo</strong>, <strong>3) Falta plan y fecha del área destino</strong>, o{' '}
                <strong>4) El Encargado de su departamento de origen no ha autorizado su salida (SÍ)</strong>. Al mover una pieza, su puesto anterior se libera automáticamente (Efecto Dominó).
              </p>
            </div>
          </div>

          {/* Casillas de Vacantes del Tablero */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {vacantes.map((v) => {
              const libres = Math.max(0, (v.plazas_totales || 1) - (v.plazas_ocupadas || 0))
              return (
                <div
                  key={v.id_vacante}
                  onClick={() => setSelectedVacanteId(v.id_vacante)}
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                    selectedVacanteId === v.id_vacante
                      ? 'border-amber-500 bg-amber-50/40'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black bg-zinc-900 text-amber-400 px-2 py-0.5 rounded">
                      {v.folio_convocatoria}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        libres > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {libres > 0 ? `🟢 ${libres} Plaza(s) Libre(s)` : '🛑 Sin Vacante Libre (0)'}
                    </span>
                  </div>
                  <p className="font-black text-sm text-zinc-900 mt-2 uppercase">{v.puesto_vacante}</p>
                  <p className="text-xs text-zinc-500">
                    {v.departamento_destino} {v.sub_departamento_destino ? `• ${v.sub_departamento_destino}` : ''}
                  </p>
                  {libres === 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLiberarPlazaVacante(v)
                      }}
                      className="mt-2 w-full py-1.5 bg-zinc-900 text-amber-400 text-[10px] font-black rounded-lg"
                    >
                      🔓 Liberar 1 Plaza en esta Casilla
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Piezas (Trabajadores) y Validador de las 4 Reglas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentPostulantes.map((post) => {
              const rules = evaluateChessRules(post, currentVacante)
              const alreadyMoved = post.estatus_movimiento === 'Movimiento Ejecutado (En Puesto)'

              return (
                <div
                  key={post.id_postulacion}
                  className={`bg-white rounded-2xl border-2 p-5 shadow-sm space-y-4 ${
                    alreadyMoved
                      ? 'border-blue-300 bg-blue-50/20'
                      : rules.canMove
                      ? 'border-emerald-400'
                      : 'border-zinc-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono font-black uppercase text-zinc-400">
                        PIEZA EN TABLERO • ANTIGÜEDAD: {post.anos_antiguedad} AÑOS
                      </span>
                      <h3 className="text-base font-black text-zinc-900">{post.nombre_completo}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                        alreadyMoved
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : rules.canMove
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {alreadyMoved ? '♟️ YA EN NUEVO PUESTO' : rules.canMove ? '🟢 JUGADA VÁLIDA (4/4)' : '🛑 MOVIMIENTO BLOQUEADO'}
                    </span>
                  </div>

                  {/* Trayectoria Origen -> Destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 block">CASILLA ACTUAL (ORIGEN)</span>
                      <strong className="text-zinc-900 block">{post.puesto_actual}</strong>
                      <span className="text-[11px] text-zinc-500">
                        {post.departamento_actual} {post.sub_departamento_actual ? `(${post.sub_departamento_actual})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-amber-600 block">CASILLA DESTINO (VACANTE)</span>
                      <strong className="text-zinc-900 block">{currentVacante?.puesto_vacante}</strong>
                      <span className="text-[11px] text-zinc-500">
                        {currentVacante?.departamento_destino} • Cita: {formatShortDate(post.fecha_presentacion)}
                      </span>
                    </div>
                  </div>

                  {/* Checklist de las 4 Reglas del Ajedrez */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div
                      className={`p-2 rounded-lg border font-bold flex items-center gap-1.5 ${
                        rules.rule1VacanteLibre
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {rules.rule1VacanteLibre ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>1. Vacante Libre ({rules.plazasLibres})</span>
                    </div>

                    <div
                      className={`p-2 rounded-lg border font-bold flex items-center gap-1.5 ${
                        rules.rule2RHApproved
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {rules.rule2RHApproved ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>2. Vo.Bo. RH &amp; Corp.</span>
                    </div>

                    <div
                      className={`p-2 rounded-lg border font-bold flex items-center gap-1.5 ${
                        rules.rule3DestinoPlan
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {rules.rule3DestinoPlan ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>3. Plan y Fecha {currentVacante?.departamento_destino}</span>
                    </div>

                    <div
                      className={`p-2 rounded-lg border font-bold flex items-center gap-1.5 ${
                        rules.rule4OrigenLiberado
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {rules.rule4OrigenLiberado ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>4. Liberación {post.departamento_actual}</span>
                    </div>
                  </div>

                  {!alreadyMoved && !rules.canMove && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                      <strong className="block uppercase text-[10px]">Motivo de bloqueo:</strong>
                      {rules.blockers.map((b, i) => (
                        <div key={i}>• {b}</div>
                      ))}
                    </div>
                  )}

                  {!alreadyMoved && (
                    <button
                      type="button"
                      onClick={() => handleExecuteChessMove(post)}
                      className={`w-full py-3 rounded-xl font-black text-xs shadow transition-all ${
                        rules.canMove
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'
                      }`}
                    >
                      {rules.canMove
                        ? `♟️ Ejecutar Movimiento a ${currentVacante?.puesto_vacante} y Liberar ${post.puesto_actual}`
                        : '🛑 Movimiento Bloqueado (Ver Reglas Faltantes)'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 5: CONFIGURACIÓN DE REGLAS Y AUTORIZADORES TITULARES
         ===================================================================== */}
      {activeTab === 'reglas' && (
        <div className="space-y-6">
          {/* Creador Rápido de Cuentas Oficiales */}
          <div className="bg-zinc-950 text-white rounded-3xl p-6 border border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase">
                <KeyRound className="w-4 h-4" />
                <span>Paso Previsto: Crear y Vincular Usuarios Autorizadores Titulares</span>
              </div>
              <p className="text-xs text-zinc-300 max-w-3xl">
                Crea o sincroniza en un clic los usuarios reales de <strong>Jefe de RH Unidad</strong>,{' '}
                <strong>Superintendente de RH Corporativo</strong> y <strong>Sindicato</strong>, además de vincular automáticamente a los encargados multi-subdepartamento en la matriz.
              </p>
            </div>
            <button
              type="button"
              disabled={seedingAuth}
              onClick={handleSeedAutorizadores}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs rounded-2xl shadow-lg shrink-0 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seedingAuth ? 'Sincronizando...' : 'Crear / Sincronizar Cuentas Oficiales'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveReglas} className="space-y-6">
            {/* Asignación de 3 Titulares Oficiales */}
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-900">
                    1. Matriz de Autorizadores Oficiales (¿Quién Firma Cada Paso?)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Selecciona a un usuario registrado del sistema o captura su correo oficial para recibir notificaciones y desbloquear su firma.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={savingReglas}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-amber-400 font-black text-xs rounded-xl shadow shrink-0"
                >
                  {savingReglas ? 'Guardando...' : '💾 Guardar Matriz de Reglas'}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                {/* JEFE DE RH UNIDAD */}
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-amber-900">Paso 1 • Jefe de RH Unidad</span>
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Vincular Usuario Existente</label>
                    <select
                      value={reglas.jefe_rh_unidad_id || ''}
                      onChange={(e) => {
                        const u = perfilesCatalog.find((p) => p.id === e.target.value)
                        if (u) {
                          setReglas({
                            ...reglas,
                            jefe_rh_unidad_id: u.id,
                            jefe_rh_unidad_nombre: u.nombre_completo || reglas.jefe_rh_unidad_nombre,
                            jefe_rh_unidad_correo: u.email || reglas.jefe_rh_unidad_correo,
                          })
                        } else {
                          setReglas({ ...reglas, jefe_rh_unidad_id: null })
                        }
                      }}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="">-- Seleccionar usuario del catálogo --</option>
                      {perfilesCatalog.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre_completo} ({u.rol}){u.email ? ` — ${u.email}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Nombre Titular</label>
                    <input
                      value={reglas.jefe_rh_unidad_nombre || ''}
                      onChange={(e) => setReglas({ ...reglas, jefe_rh_unidad_nombre: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Correo Titular (Login &amp; Alertas)</label>
                    <input
                      type="email"
                      value={reglas.jefe_rh_unidad_correo || ''}
                      onChange={(e) => setReglas({ ...reglas, jefe_rh_unidad_correo: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                </div>

                {/* SUPERINTENDENTE DE RH CORPORATIVO */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-indigo-900">Paso 2 • Supt. RH Corporativo</span>
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Vincular Usuario Existente</label>
                    <select
                      value={reglas.supt_rh_corporativo_id || ''}
                      onChange={(e) => {
                        const u = perfilesCatalog.find((p) => p.id === e.target.value)
                        if (u) {
                          setReglas({
                            ...reglas,
                            supt_rh_corporativo_id: u.id,
                            supt_rh_corporativo_nombre: u.nombre_completo || reglas.supt_rh_corporativo_nombre,
                            supt_rh_corporativo_correo: u.email || reglas.supt_rh_corporativo_correo,
                          })
                        } else {
                          setReglas({ ...reglas, supt_rh_corporativo_id: null })
                        }
                      }}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="">-- Seleccionar usuario del catálogo --</option>
                      {perfilesCatalog.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre_completo} ({u.rol}){u.email ? ` — ${u.email}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Nombre Titular</label>
                    <input
                      value={reglas.supt_rh_corporativo_nombre || ''}
                      onChange={(e) => setReglas({ ...reglas, supt_rh_corporativo_nombre: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Correo Titular (Login &amp; Alertas)</label>
                    <input
                      type="email"
                      value={reglas.supt_rh_corporativo_correo || ''}
                      onChange={(e) => setReglas({ ...reglas, supt_rh_corporativo_correo: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                </div>

                {/* SINDICATO */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-emerald-900">Escalafón • Representante Sindicato</span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Vincular Usuario Existente</label>
                    <select
                      value={reglas.sindicato_id || ''}
                      onChange={(e) => {
                        const u = perfilesCatalog.find((p) => p.id === e.target.value)
                        if (u) {
                          setReglas({
                            ...reglas,
                            sindicato_id: u.id,
                            sindicato_nombre: u.nombre_completo || reglas.sindicato_nombre,
                            sindicato_correo: u.email || reglas.sindicato_correo,
                          })
                        } else {
                          setReglas({ ...reglas, sindicato_id: null })
                        }
                      }}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="">-- Seleccionar usuario del catálogo --</option>
                      {perfilesCatalog.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre_completo} ({u.rol}){u.email ? ` — ${u.email}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Nombre Titular Sindicato</label>
                    <input
                      value={reglas.sindicato_nombre || ''}
                      onChange={(e) => setReglas({ ...reglas, sindicato_nombre: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 mb-1">Correo Titular (Copia / Alertas)</label>
                    <input
                      type="email"
                      value={reglas.sindicato_correo || ''}
                      onChange={(e) => setReglas({ ...reglas, sindicato_correo: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Reglas de Candado, Secuencia y Notificaciones */}
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-zinc-900">
                2. Candados del Flujo, Reglas del Tablero de Ajedrez y Automatización
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {[
                  {
                    key: 'regla_bloqueo_por_usuario',
                    title: '🔒 Candado Estricto por Usuario',
                    desc: 'Cada etapa solo puede firmarse iniciando sesión con el usuario/correo titular asignado.',
                  },
                  {
                    key: 'regla_orden_secuencial',
                    title: '⛓️ Orden Secuencial Obligatorio',
                    desc: 'RH Corporativo no firma sin RH Unidad; Destino no planea sin RH Corp.; Origen no libera sin Destino.',
                  },
                  {
                    key: 'regla_vacante_libre_obligatoria',
                    title: '♟️ Exigir Vacante / Plaza Libre',
                    desc: 'Bloquea movimientos si no hay plazas disponibles (> 0) en la casilla destino.',
                  },
                  {
                    key: 'regla_requiere_jefe_rh_unidad',
                    title: '1️⃣ Requerir Vo.Bo. Jefe RH Unidad',
                    desc: 'Exige la firma del Jefe de RH Unidad antes de habilitar al área destino.',
                  },
                  {
                    key: 'regla_requiere_supt_rh_corporativo',
                    title: '2️⃣ Requerir Supt. RH Corporativo',
                    desc: 'Exige Vo.Bo. del Superintendente de RH Corporativo antes de la selección.',
                  },
                  {
                    key: 'regla_requiere_liberacion_origen',
                    title: '4️⃣ Requerir SÍ del Depto Origen',
                    desc: 'Impide ejecutar el movimiento si el área de origen no ha respondido SÍ.',
                  },
                  {
                    key: 'regla_permitir_efecto_domino',
                    title: '🔁 Efecto Dominó Automático',
                    desc: 'Al mover una pieza, abre automáticamente una nueva vacante por su puesto anterior.',
                  },
                  {
                    key: 'regla_notificar_correo_automatico',
                    title: '📧 Notificar Correo en Cada Paso',
                    desc: 'Dispara aviso en bandeja interna y correo SMTP al siguiente responsable en cuanto alguien firma.',
                  },
                ].map((r) => (
                  <label
                    key={r.key}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2 ${
                      reglas[r.key] ? 'border-amber-400 bg-amber-50/40' : 'border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-black text-zinc-900">{r.title}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(reglas[r.key])}
                        onChange={(e) => setReglas({ ...reglas, [r.key]: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-500 mt-0.5 shrink-0"
                      />
                    </div>
                    <span className="text-[11px] text-zinc-600 leading-snug">{r.desc}</span>
                  </label>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-black text-zinc-700">Días de Convocatoria por Default (Efecto Dominó / Nuevas):</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={reglas.regla_dias_convocatoria || 10}
                    onChange={(e) => setReglas({ ...reglas, regla_dias_convocatoria: Number(e.target.value) })}
                    className="w-20 border border-zinc-300 rounded-xl px-3 py-1.5 font-mono font-black text-center"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingReglas}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl shadow"
                >
                  {savingReglas ? 'Guardando...' : '✓ Aplicar y Guardar Reglas'}
                </button>
              </div>
            </div>
          </form>

          {/* Encargados Multi-Subdepartamento vinculados a Usuarios */}
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase text-zinc-900">
                  3. Encargados por Departamento y Multi-Subdepartamento (Titular por Usuario)
                </h3>
                <p className="text-xs text-zinc-500">
                  Vincula directamente el usuario real responsable para cada bloque de departamentos cuando el candado por usuario esté activo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEncargadoModal(true)}
                className="px-4 py-2 bg-zinc-900 text-amber-400 font-black text-xs rounded-xl shrink-0"
              >
                + Agregar Encargado Multi-Área
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {encargados.map((enc, idx) => (
                <div key={enc.id_encargado || idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-sm text-zinc-900">{enc.nombre_encargado}</p>
                      <p className="font-mono text-blue-700 font-bold">{enc.correo_encargado}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-zinc-900 text-amber-400 px-2.5 py-0.5 rounded">
                      {enc.departamento_principal}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(enc.sub_departamentos || []).map((sub: string, i: number) => (
                      <span key={i} className="text-[10px] font-bold bg-white border border-zinc-300 text-zinc-700 px-2 py-0.5 rounded-md">
                        • {sub}
                      </span>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-zinc-200 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-500 shrink-0">Titular Login:</span>
                    <select
                      value={enc.id_usuario_encargado || ''}
                      onChange={(e) => handleUpdateEncargadoUser(enc, e.target.value)}
                      className="flex-1 bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[11px] font-bold"
                    >
                      <option value="">-- Vincular cuenta de Jefe / Encargado --</option>
                      {perfilesCatalog.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre_completo} ({u.rol}){u.email ? ` — ${u.email}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 6: SIMULADOR DE REGLAS Y REPORTE DE AUDITORÍA PDF (DRY-RUN)
         ===================================================================== */}
      {activeTab === 'simulador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo: Controles del Escenario */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4 text-xs">
            <div className="border-b border-zinc-100 pb-3">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600">
                BANCO DE PRUEBAS SIN AFECTAR BASE DE DATOS
              </span>
              <h3 className="text-base font-black uppercase text-zinc-900">Simulador de Reglas y Permisos</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Prueba cómo reaccionan tus reglas configuradas ante diferentes usuarios, bloqueos, faltas de firma o vacantes llenas.
              </p>
            </div>

            {/* Botones Preset Rápidos */}
            <div className="space-y-1.5">
              <span className="block font-black uppercase text-[10px] text-zinc-500">Escenarios Preconfigurados:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSimState({
                      ...simState,
                      escenarioNombre: 'Flujo Válido Completo (Todas las Reglas OK)',
                      plazasLibres: 1,
                      rhUnidadAprobo: true,
                      rhCorpAprobo: true,
                      destinoPlanYFecha: true,
                      origenRespuesta: 'Autorizado (Sí)',
                      etapaAProbar: 'MOVER_AJEDREZ',
                      usuarioPrueba: reglas.jefe_rh_unidad_correo || 'jefe.rh.unidad@bacis.com',
                    })
                  }
                  className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-black text-left"
                >
                  ✓ 1. Todo Aprobado (Válido)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSimState({
                      ...simState,
                      escenarioNombre: 'Bloqueo por Usuario No Titular intentando firmar RH Corp.',
                      plazasLibres: 1,
                      rhUnidadAprobo: true,
                      rhCorpAprobo: true,
                      destinoPlanYFecha: true,
                      origenRespuesta: 'Autorizado (Sí)',
                      etapaAProbar: 'RH_CORPORATIVO',
                      usuarioPrueba: 'supervisor.ajeno@bacis.com',
                    })
                  }
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 font-black text-left"
                >
                  🔒 2. Usuario No Titular
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSimState({
                      ...simState,
                      escenarioNombre: 'Bloqueo Secuencial: Destino intenta planear sin RH Corporativo',
                      plazasLibres: 1,
                      rhUnidadAprobo: true,
                      rhCorpAprobo: false,
                      destinoPlanYFecha: false,
                      origenRespuesta: 'Pendiente de Respuesta',
                      etapaAProbar: 'PLAN_DESTINO',
                      usuarioPrueba: resolveEncargadoForDept(simState.departamentoDestino)?.correo_encargado || 'jefe.mina@bacis.com',
                    })
                  }
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-black text-left"
                >
                  ⛓️ 3. Salto Secuencial
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSimState({
                      ...simState,
                      escenarioNombre: 'Sin Plaza Libre y Departamento Origen dice NO',
                      plazasLibres: 0,
                      rhUnidadAprobo: true,
                      rhCorpAprobo: true,
                      destinoPlanYFecha: true,
                      origenRespuesta: 'No / Reprogramar Fecha',
                      etapaAProbar: 'MOVER_AJEDREZ',
                      usuarioPrueba: reglas.jefe_rh_unidad_correo || 'jefe.rh.unidad@bacis.com',
                    })
                  }
                  className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-900 font-black text-left"
                >
                  🛑 4. Sin Vacante + Origen NO
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className="block font-black uppercase text-zinc-600 mb-1">Nombre del Escenario de Prueba</label>
                <input
                  value={simState.escenarioNombre}
                  onChange={(e) => setSimState({ ...simState, escenarioNombre: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Trabajador / Postulante</label>
                <input
                  value={simState.candidatoNombre}
                  onChange={(e) => setSimState({ ...simState, candidatoNombre: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Plazas Libres en Vacante</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={simState.plazasLibres}
                  onChange={(e) => setSimState({ ...simState, plazasLibres: Number(e.target.value) })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono font-black"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Depto Origen</label>
                <input
                  value={simState.departamentoOrigen}
                  onChange={(e) => setSimState({ ...simState, departamentoOrigen: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Depto Destino</label>
                <input
                  value={simState.departamentoDestino}
                  onChange={(e) => setSimState({ ...simState, departamentoDestino: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Etapa a Simular</label>
                <select
                  value={simState.etapaAProbar}
                  onChange={(e) => setSimState({ ...simState, etapaAProbar: e.target.value as any })}
                  className="w-full border border-zinc-300 rounded-xl px-2.5 py-2 font-bold bg-white"
                >
                  <option value="RH_UNIDAD">Etapa 1: Firma Jefe RH Unidad</option>
                  <option value="RH_CORPORATIVO">Etapa 2: Firma Supt. RH Corp.</option>
                  <option value="PLAN_DESTINO">Etapa 3: Plan/Fecha Destino</option>
                  <option value="LIBERACION_ORIGEN">Etapa 4: Liberación Origen</option>
                  <option value="MOVER_AJEDREZ">Etapa Final: Mover en Ajedrez</option>
                </select>
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Usuario Simulado (Correo)</label>
                <input
                  value={simState.usuarioPrueba}
                  onChange={(e) => setSimState({ ...simState, usuarioPrueba: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-2.5 py-2 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {[
                { label: 'RH Unidad', mail: reglas.jefe_rh_unidad_correo },
                { label: 'RH Corp.', mail: reglas.supt_rh_corporativo_correo },
                { label: 'Mina', mail: 'jefe.mina@bacis.com' },
                { label: 'Planta', mail: 'jefe.planta.de@bacis.com' },
                { label: 'Usuario Ajeno', mail: 'usuario.ajeno@bacis.com' },
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setSimState({ ...simState, usuarioPrueba: pill.mail || '' })}
                  className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-700"
                >
                  Probar como {pill.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="flex items-center justify-between font-bold text-zinc-800">
                <span>1. ¿Jefe de RH Unidad ya firmó?</span>
                <input
                  type="checkbox"
                  checked={simState.rhUnidadAprobo}
                  onChange={(e) => setSimState({ ...simState, rhUnidadAprobo: e.target.checked })}
                  className="w-4 h-4 text-amber-500"
                />
              </label>
              <label className="flex items-center justify-between font-bold text-zinc-800">
                <span>2. ¿Supt. RH Corporativo ya firmó?</span>
                <input
                  type="checkbox"
                  checked={simState.rhCorpAprobo}
                  onChange={(e) => setSimState({ ...simState, rhCorpAprobo: e.target.checked })}
                  className="w-4 h-4 text-amber-500"
                />
              </label>
              <label className="flex items-center justify-between font-bold text-zinc-800">
                <span>3. ¿Destino definió Plan y Fecha?</span>
                <input
                  type="checkbox"
                  checked={simState.destinoPlanYFecha}
                  onChange={(e) => setSimState({ ...simState, destinoPlanYFecha: e.target.checked })}
                  className="w-4 h-4 text-amber-500"
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-zinc-800">4. Respuesta Área Origen:</span>
                <select
                  value={simState.origenRespuesta}
                  onChange={(e) => setSimState({ ...simState, origenRespuesta: e.target.value as any })}
                  className="border border-zinc-300 rounded-lg px-2 py-1 font-bold bg-white"
                >
                  <option value="Autorizado (Sí)">Autorizado (Sí)</option>
                  <option value="Pendiente de Respuesta">Pendiente de Respuesta</option>
                  <option value="No / Reprogramar Fecha">No / Reprogramar Fecha</option>
                </select>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Veredicto en Vivo + Matriz + Descarga PDF */}
          <div className="lg:col-span-7 space-y-4">
            <div
              className={`rounded-3xl p-5 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                simEvaluation.veredicto === 'PROCEDE'
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-rose-50 border-rose-300'
              }`}
            >
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-zinc-600">
                  RESULTADO DE LA SIMULACIÓN EN VIVO
                </span>
                <h3
                  className={`text-xl font-black uppercase ${
                    simEvaluation.veredicto === 'PROCEDE' ? 'text-emerald-900' : 'text-rose-900'
                  }`}
                >
                  {simEvaluation.veredicto === 'PROCEDE'
                    ? '🟢 PROCEDE EL MOVIMIENTO (REGLAS CUMPLIDAS)'
                    : '🛑 MOVIMIENTO BLOQUEADO POR REGLAS'}
                </h3>
                <p className="text-xs text-zinc-700 mt-1">{simEvaluation.efectoDominoMensaje}</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  generateSimulacionReglasPDF({
                    escenarioNombre: simState.escenarioNombre,
                    candidatoNombre: simState.candidatoNombre,
                    puestoActual: simState.puestoActual,
                    departamentoOrigen: simState.departamentoOrigen,
                    puestoVacante: simState.puestoVacante,
                    departamentoDestino: simState.departamentoDestino,
                    plazasLibres: simState.plazasLibres,
                    veredicto: simEvaluation.veredicto,
                    reglasMatriz: reglas,
                    evaluacionReglas: simEvaluation.items,
                    cadenaNotificaciones: simEvaluation.cadenaNotificaciones,
                    efectoDominoMensaje: simEvaluation.efectoDominoMensaje,
                  })
                }
                className="px-4 py-3 bg-zinc-900 hover:bg-black text-amber-400 font-black text-xs rounded-2xl shadow-lg shrink-0 inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Reporte de Reglas (PDF)</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-zinc-900 text-white text-xs font-black uppercase">
                Evaluación Regla por Regla y Titulares Asignados
              </div>
              <div className="divide-y divide-zinc-100 text-xs">
                {simEvaluation.items.map((item, i) => (
                  <div key={i} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-zinc-900">{item.regla}</p>
                      <p className="text-[11px] text-zinc-500">Titular: {item.responsable}</p>
                      <p className="text-[11px] text-zinc-700 mt-0.5">{item.detalle}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase shrink-0 border ${
                        item.estado === 'CUMPLE'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : item.estado === 'BLOQUEA'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {item.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 space-y-2 text-xs">
              <h4 className="font-black uppercase text-zinc-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Cascada Real de Notificaciones Automáticas en este Escenario</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-700">
                {simEvaluation.cadenaNotificaciones.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 7: HISTORIAL DE ESTANCIA (DÍAS), CALIFICACIÓN Y ENCARGADOS MULTI-SUBDEPTO
         ===================================================================== */}
      {activeTab === 'historial' && (
        <div className="space-y-8">
          {/* Tabla de Historial de Dónde Estuvo, Cuántos Días Estuvo y Calificación del Departamento */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase text-amber-400">
                  Historial de Estancia por Departamento, Conteo de Días y Calificación de Desempeño
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Registro histórico de cada movimiento, cuántos días permaneció en el puesto y la calificación otorgada por el departamento asignado.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-xs">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Trabajador</th>
                    <th className="px-4 py-3 text-left">Puesto / Área Anterior</th>
                    <th className="px-4 py-3 text-left">Departamento y Puesto Asignado</th>
                    <th className="px-4 py-3 text-left">Fechas y Días en el Puesto</th>
                    <th className="px-4 py-3 text-left">Calificación Depto (1-10)</th>
                    <th className="px-4 py-3 text-right">Evaluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {historial.map((h) => {
                    const diasCalculados = diffDaysInclusive(
                      h.fecha_inicio,
                      h.fecha_fin || new Date().toISOString().split('T')[0]
                    )
                    return (
                      <tr key={h.id_historial} className="hover:bg-zinc-50">
                        <td className="px-4 py-3.5">
                          <div className="font-black text-zinc-900">{h.nombre_completo}</div>
                          <div className="text-[10px] font-mono text-zinc-400">#{h.numero_empleado || 'S/N'}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-zinc-700">{h.puesto_origen || 'N/A'}</div>
                          <div className="text-[11px] text-zinc-500">
                            {h.departamento_origen} {h.sub_departamento_origen ? `(${h.sub_departamento_origen})` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-black text-zinc-900">{h.puesto_asignado}</div>
                          <div className="text-[11px] text-amber-700 font-bold">
                            {h.departamento_asignado} {h.sub_departamento_asignado ? `• ${h.sub_departamento_asignado}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono font-black text-sm text-zinc-900">{diasCalculados} días</span>
                          <div className="text-[10px] text-zinc-500">
                            Desde {formatShortDate(h.fecha_inicio)} {h.fecha_fin ? `al ${formatShortDate(h.fecha_fin)}` : '(Activo)'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {h.calificacion ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-black text-xs border border-amber-300">
                                ⭐ {h.calificacion} / 10
                              </span>
                              <div className="text-[10px] font-bold text-zinc-700 mt-1">{h.dictamen}</div>
                              {h.comentarios_desempeno && (
                                <div className="text-[10px] text-zinc-500 italic">{h.comentarios_desempeno}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">Pendiente de calificar por el área</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEvaluatingItem(h)
                              setEvalForm({
                                calificacion: h.calificacion || 9.0,
                                dictamen: h.dictamen || 'Aprobado Definitivo en el Puesto',
                                comentarios_desempeno: h.comentarios_desempeno || '',
                                fecha_fin: h.fecha_fin || '',
                              })
                            }}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-amber-400 font-black text-xs rounded-xl inline-flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>Calificar</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-400">
                        Aún no hay movimientos ejecutados en el historial de estancia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Directorio de Encargados Únicos que Agrupan Varios Sub-departamentos */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase text-zinc-900">
                  Encargados Únicos Multi-Subdepartamento (Enrutamiento de Correos y Autorizaciones)
                </h3>
                <p className="text-xs text-zinc-500">
                  Cuando una sola persona es encargada de varios departamentos y sub-departamentos juntos, el sistema concentra y envía los correos a su cuenta única.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEncargadoModal(true)}
                className="px-4 py-2 bg-zinc-900 text-amber-400 font-black text-xs rounded-xl shrink-0"
              >
                + Agregar Encargado Multi-Área
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {encargados.map((enc, idx) => (
                <div key={enc.id_encargado || idx} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-sm text-zinc-900">{enc.nombre_encargado}</p>
                      <p className="text-xs font-mono text-blue-700 font-bold">{enc.correo_encargado}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-zinc-900 text-amber-400 px-2.5 py-0.5 rounded">
                      {enc.departamento_principal}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(enc.sub_departamentos || []).map((sub: string, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] font-bold bg-white border border-zinc-300 text-zinc-700 px-2 py-0.5 rounded-md"
                      >
                        • {sub}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bitácora en Vivo de Avisos y Notificaciones Enviadas */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 font-black text-xs uppercase text-zinc-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>Bitácora de Avisos y Correos entre Sindicato, RH, Mina y Departamentos ({notificaciones.length})</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
              {notificaciones.map((n) => (
                <div key={n.id_notificacion} className="p-4 text-xs space-y-1 hover:bg-zinc-50">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-zinc-900">{n.asunto}</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(n.creado_el).toLocaleString('es-MX')}
                    </span>
                  </div>
                  <p className="text-zinc-600">{n.mensaje}</p>
                  <p className="text-[10px] text-zinc-400">
                    De: <strong>{n.remitente}</strong> → Para: <strong>{n.destinatarios}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ABRIR NUEVA VACANTE + CONVOCATORIA DE 10 DÍAS
         ===================================================================== */}
      {showVacanteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase text-amber-400">
                Abrir Vacante y Publicar Convocatoria (10 Días)
              </h3>
              <button onClick={() => setShowVacanteModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateVacante} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Puesto Vacante</label>
                <input
                  required
                  value={vacanteForm.puesto_vacante}
                  onChange={(e) => setVacanteForm({ ...vacanteForm, puesto_vacante: e.target.value })}
                  placeholder="Ej. Ayudante de Perforista"
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Departamento Destino</label>
                  <input
                    required
                    value={vacanteForm.departamento_destino}
                    onChange={(e) => setVacanteForm({ ...vacanteForm, departamento_destino: e.target.value })}
                    placeholder="Ej. Mina"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Sub-departamento / Área</label>
                  <input
                    value={vacanteForm.sub_departamento_destino}
                    onChange={(e) => setVacanteForm({ ...vacanteForm, sub_departamento_destino: e.target.value })}
                    placeholder="Ej. Perforación y Voladura"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Plazas Libres</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={vacanteForm.plazas_totales}
                    onChange={(e) => setVacanteForm({ ...vacanteForm, plazas_totales: Number(e.target.value) })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Fecha Apertura</label>
                  <input
                    type="date"
                    required
                    value={vacanteForm.fecha_apertura}
                    onChange={(e) => setVacanteForm({ ...vacanteForm, fecha_apertura: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Días Inscripción</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={vacanteForm.dias_convocatoria}
                    onChange={(e) => setVacanteForm({ ...vacanteForm, dias_convocatoria: Number(e.target.value) })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Requisitos para el Boletín</label>
                <textarea
                  rows={2}
                  value={vacanteForm.requisitos}
                  onChange={(e) => setVacanteForm({ ...vacanteForm, requisitos: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">
                  Plan de Avance / Capacitación del Departamento
                </label>
                <input
                  value={vacanteForm.plan_avance_departamento}
                  onChange={(e) => setVacanteForm({ ...vacanteForm, plan_avance_departamento: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowVacanteModal(false)} className="px-4 py-2 font-bold text-zinc-500">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingVacante}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl shadow"
                >
                  {savingVacante ? 'Publicando...' : 'Publicar Convocatoria (10 Días)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: INSCRIBIR TRABAJADOR A LA CONVOCATORIA
         ===================================================================== */}
      {showInscribirModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-zinc-200 max-h-[92vh] flex flex-col">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-black text-sm uppercase text-amber-400">
                Inscribir Postulante a Convocatoria Sindical
              </h3>
              <button onClick={() => setShowInscribirModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInscribirPostulante} className="p-6 space-y-3.5 overflow-y-auto text-xs">
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">
                  Seleccionar de la Base de Datos de Empleados (Opcional — Auto-llena datos)
                </label>
                <select
                  value={inscribirForm.id_empleado}
                  onChange={(e) => handleSelectEmpleadoForInscripcion(e.target.value)}
                  className="w-full border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="">-- Captura manual o elige un empleado del catálogo --</option>
                  {empleadosCatalog.map((emp) => (
                    <option key={emp.id_empleado} value={emp.id_empleado}>
                      {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''} (#{emp.numero_empleado || 'S/N'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Nombre Completo del Trabajador</label>
                  <input
                    required
                    value={inscribirForm.nombre_completo}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, nombre_completo: e.target.value })}
                    placeholder="Nombre y Apellidos"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Fecha de Inscripción</label>
                  <input
                    type="date"
                    required
                    value={inscribirForm.fecha_inscripcion}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, fecha_inscripcion: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Departamento Actual</label>
                  <input
                    required
                    value={inscribirForm.departamento_actual}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, departamento_actual: e.target.value })}
                    placeholder="Ej. Planta de Beneficio"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Sub-departamento Actual</label>
                  <input
                    value={inscribirForm.sub_departamento_actual}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, sub_departamento_actual: e.target.value })}
                    placeholder="Ej. Trituración / Molienda"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Puesto Actual</label>
                  <input
                    required
                    value={inscribirForm.puesto_actual}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, puesto_actual: e.target.value })}
                    placeholder="Ej. Peón General / Ayudante"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Puesto al que se Postula</label>
                  <input
                    required
                    value={inscribirForm.puesto_postulado}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, puesto_postulado: e.target.value })}
                    placeholder="Ej. Ayudante de Perforista"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold text-amber-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Teléfono Celular</label>
                  <input
                    value={inscribirForm.celular}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, celular: e.target.value })}
                    placeholder="Ej. 618 123 4567"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Años de Antigüedad (Escalafón)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    required
                    value={inscribirForm.anos_antiguedad}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, anos_antiguedad: Number(e.target.value) })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>

              {/* 3 Checkboxes solicitados */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-zinc-500 block">
                  Factores de Experiencia y Capacitación (Tildar opciones):
                </span>

                <label className="flex items-center gap-2.5 font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inscribirForm.tiene_anos_experiencia}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, tiene_anos_experiencia: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-500"
                  />
                  <span>1. ¿Tiene años de experiencia general en mina?</span>
                </label>

                <label className="flex items-center gap-2.5 font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inscribirForm.tiene_experiencia_puesto}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, tiene_experiencia_puesto: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-500"
                  />
                  <span>2. ¿Tiene experiencia directa en el puesto al que se postula?</span>
                </label>

                <label className="flex items-center gap-2.5 font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inscribirForm.requiere_capacitacion_previa}
                    onChange={(e) => setInscribirForm({ ...inscribirForm, requiere_capacitacion_previa: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-500"
                  />
                  <span>3. ¿Requiere capacitación previa / adiestramiento antes de titularidad?</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowInscribirModal(false)} className="px-4 py-2 font-bold text-zinc-500">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInscripcion}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl shadow"
                >
                  {savingInscripcion ? 'Inscribiendo...' : 'Registrar Inscripción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: REPROGRAMAR FECHA CUANDO DEPTO ORIGEN CONTESTA QUE NO
         ===================================================================== */}
      {reprogramTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-rose-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">
                No Disponible en Fecha • Planear Nueva Fecha
              </h3>
              <button onClick={() => setReprogramTarget(null)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-zinc-700">
                El departamento <strong>{reprogramTarget.departamento_actual}</strong> indica que no puede liberar a{' '}
                <strong>{reprogramTarget.nombre_completo}</strong> en la fecha inicial. Define el motivo y la nueva fecha tentativa para avisar de vuelta a{' '}
                <strong>{currentVacante?.departamento_destino || 'Mina'}</strong>:
              </p>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Nueva Fecha Propuesta</label>
                <input
                  type="date"
                  value={reprogramDate}
                  onChange={(e) => setReprogramDate(e.target.value)}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Motivo / Observación del Departamento</label>
                <input
                  value={reprogramNote}
                  onChange={(e) => setReprogramNote(e.target.value)}
                  placeholder="Ej. Cierre de mantenimiento en trituración, se libera el lunes..."
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReprogramTarget(null)} className="px-4 py-2 font-bold text-zinc-500">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleOriginDepartmentResponse(reprogramTarget, 'NO', reprogramNote, reprogramDate)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl"
                >
                  Confirmar NO y Enviar Nueva Fecha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CALIFICAR DESEMPEÑO Y ESTANCIA POR EL DEPARTAMENTO ASIGNADO
         ===================================================================== */}
      {evaluatingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase text-amber-400">
                Calificar Desempeño en Departamento Asignado
              </h3>
              <button onClick={() => setEvaluatingItem(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEvaluation} className="p-6 space-y-4 text-xs">
              <div>
                <p className="font-black text-sm text-zinc-900">{evaluatingItem.nombre_completo}</p>
                <p className="text-zinc-500">
                  Puesto asignado: <strong>{evaluatingItem.puesto_asignado}</strong> en{' '}
                  <strong>{evaluatingItem.departamento_asignado}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Calificación (1 a 10)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={1}
                    max={10}
                    required
                    value={evalForm.calificacion}
                    onChange={(e) => setEvalForm({ ...evalForm, calificacion: Number(e.target.value) })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono font-black text-base"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Fecha Corte / Término</label>
                  <input
                    type="date"
                    value={evalForm.fecha_fin}
                    onChange={(e) => setEvalForm({ ...evalForm, fecha_fin: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Dictamen del Departamento</label>
                <select
                  value={evalForm.dictamen}
                  onChange={(e) => setEvalForm({ ...evalForm, dictamen: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="En Periodo de Prueba / Capacitación">En Periodo de Prueba / Capacitación</option>
                  <option value="Aprobado Definitivo en el Puesto">✓ Aprobado Definitivo en el Puesto (Titularidad)</option>
                  <option value="Regresado a Puesto Anterior">↩ Regresado a Puesto Anterior (No acreditó / Libera vacante)</option>
                  <option value="Promovido a Siguiente Categoría">⬆ Promovido a Siguiente Categoría</option>
                </select>
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Comentarios de Desempeño</label>
                <textarea
                  rows={2}
                  value={evalForm.comentarios_desempeno}
                  onChange={(e) => setEvalForm({ ...evalForm, comentarios_desempeno: e.target.value })}
                  placeholder="Observaciones del jefe de área sobre seguridad, operación y aprendizaje..."
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setEvaluatingItem(null)} className="px-4 py-2 font-bold text-zinc-500">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl shadow">
                  Guardar Calificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: AGREGAR ENCARGADO ÚNICO MULTI-SUBDEPARTAMENTO
         ===================================================================== */}
      {showEncargadoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase text-amber-400">
                Vincular Encargado a Varios Sub-departamentos
              </h3>
              <button onClick={() => setShowEncargadoModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEncargado} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Nombre del Encargado / Jefe</label>
                <input
                  required
                  value={encargadoForm.nombre_encargado}
                  onChange={(e) => setEncargadoForm({ ...encargadoForm, nombre_encargado: e.target.value })}
                  placeholder="Ej. Ing. Roberto Salazar"
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Correo Electrónico (Recibirá los avisos)</label>
                <input
                  type="email"
                  required
                  value={encargadoForm.correo_encargado}
                  onChange={(e) => setEncargadoForm({ ...encargadoForm, correo_encargado: e.target.value })}
                  placeholder="ejemplo@bacis.com"
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Departamento Principal</label>
                <input
                  required
                  value={encargadoForm.departamento_principal}
                  onChange={(e) => setEncargadoForm({ ...encargadoForm, departamento_principal: e.target.value })}
                  placeholder="Ej. Planta de Beneficio"
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">
                  Sub-departamentos bajo su cargo (Separados por coma)
                </label>
                <textarea
                  rows={2}
                  required
                  value={encargadoForm.sub_departamentos_csv}
                  onChange={(e) => setEncargadoForm({ ...encargadoForm, sub_departamentos_csv: e.target.value })}
                  placeholder="Ej. Trituración, Molienda, Flotación, Espesadores, Jales"
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowEncargadoModal(false)} className="px-4 py-2 font-bold text-zinc-500">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl">
                  Guardar Encargado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: CREDENCIALES SINCRONIZADAS DE AUTORIZADORES OFICIALES
         ===================================================================== */}
      {seededAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-950 text-white p-5 flex justify-between items-center border-b-4 border-amber-500">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 block">GRUPO MINERO BACÍS • ESCALAFÓN</span>
                <h3 className="font-black text-sm uppercase">
                  Cuentas de Autorizadores Oficiales Sincronizadas
                </h3>
              </div>
              <button onClick={() => setSeededAuthModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-zinc-600">
                Cada titular puede iniciar sesión con su propio usuario para recibir alertas, aprobar su etapa con candado activo y consultar el simulador:
              </p>
              <div className="space-y-2.5">
                {seededAuthModal.map((acc: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase bg-zinc-900 text-amber-400 px-2 py-0.5 rounded">
                        {acc.rol}
                      </span>
                      <p className="font-black text-zinc-900 mt-1">{acc.nombre}</p>
                      <p className="font-mono text-zinc-700">
                        Correo: <strong>{acc.email}</strong> • Clave: <strong>{acc.password}</strong>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                      {acc.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    const text = seededAuthModal
                      .map((a: any) => `${a.rol} (${a.nombre}): ${a.email} / ${a.password}`)
                      .join('\n')
                    navigator.clipboard?.writeText(text)
                    alert('📋 Credenciales copiadas al portapapeles.')
                  }}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black rounded-xl inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Todas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSeededAuthModal(null)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
