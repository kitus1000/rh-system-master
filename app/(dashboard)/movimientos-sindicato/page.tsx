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
} from 'lucide-react'
import { formatShortDate, diffDaysInclusive, isSchemaMissingError } from '@/utils/contratistasConfig'
import { generateConvocatoriaSindicatoPDF } from '@/utils/convocatoriaSindicatoPdf'

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
  const [activeTab, setActiveTab] = useState<'convocatorias' | 'inscripciones' | 'autorizaciones' | 'ajedrez' | 'historial'>('convocatorias')

  const [vacantes, setVacantes] = useState<any[]>([])
  const [postulantes, setPostulantes] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [encargados, setEncargados] = useState<any[]>(DEFAULT_ENCARGADOS)
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [empleadosCatalog, setEmpleadosCatalog] = useState<any[]>([])

  const [selectedVacanteId, setSelectedVacanteId] = useState<string>('')

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

      const [postRes, histRes, encRes, notRes] = await Promise.all([
        supabase.from('movimientos_postulantes').select('*').order('anos_antiguedad', { ascending: false }),
        supabase.from('movimientos_historial_estancia').select('*').order('creado_el', { ascending: false }),
        supabase.from('movimientos_encargados_subdeptos').select('*').order('departamento_principal'),
        supabase.from('movimientos_notificaciones_log').select('*').order('creado_el', { ascending: false }).limit(60),
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

      const { error } = await supabase.from('movimientos_postulantes').insert([payload])
      if (error) throw error

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

  // 3. AUTORIZACIÓN PREVIA RH LOCAL Y RH CORPORATIVO
  const handleToggleRHApproval = async (post: any, field: 'autorizado_rh_local' | 'autorizado_rh_corporativo') => {
    const nextVal = !post[field]
    const bothApproved =
      (field === 'autorizado_rh_local' ? nextVal : post.autorizado_rh_local) &&
      (field === 'autorizado_rh_corporativo' ? nextVal : post.autorizado_rh_corporativo)

    const { error } = await supabase
      .from('movimientos_postulantes')
      .update({
        [field]: nextVal,
        estatus_movimiento: bothApproved ? 'Autorizado por RH y Corporativo' : 'Inscrito en Convocatoria',
      })
      .eq('id_postulacion', post.id_postulacion)

    if (error) {
      alert('Error actualizando autorización RH: ' + error.message)
      return
    }
    await fetchAllData()
  }

  // Autorizar en bloque a todos los postulantes de la vacante actual por RH Local y RH Corporativo
  const handleAuthorizeAllRH = async () => {
    if (!currentVacante) return
    await supabase
      .from('movimientos_vacantes')
      .update({
        estatus_rh_local: 'Autorizado',
        autorizado_rh_local_por: profile?.nombre_completo || 'RH Unidad',
        estatus_rh_corporativo: 'Autorizado',
        autorizado_rh_corporativo_por: 'RH Corporativo',
        estatus_vacante: 'En Selección y Plan de Avance',
      })
      .eq('id_vacante', currentVacante.id_vacante)

    for (const p of currentPostulantes) {
      await supabase
        .from('movimientos_postulantes')
        .update({
          autorizado_rh_local: true,
          autorizado_rh_corporativo: true,
          estatus_movimiento: p.seleccionado_por_destino ? p.estatus_movimiento : 'Autorizado por RH y Corporativo',
        })
        .eq('id_postulacion', p.id_postulacion)
    }

    await supabase.from('movimientos_notificaciones_log').insert([
      {
        id_vacante: currentVacante.id_vacante,
        tipo_aviso: 'AUTORIZACION_RH',
        remitente: 'RH Unidad & RH Corporativo',
        destinatarios: `Departamento ${currentVacante.departamento_destino} y Sindicato`,
        asunto: `Autorización Previa RH y Corporativo aprobada — ${currentVacante.folio_convocatoria}`,
        mensaje: `RH Local y RH Corporativo autorizaron la lista de ${currentPostulantes.length} postulante(s) para ${currentVacante.puesto_vacante}. El departamento de ${currentVacante.departamento_destino} ya puede seleccionar candidatos y asignar plan y fechas.`,
        correo_enviado: false,
      },
    ])

    await fetchAllData()
  }

  // 4. SELECCIÓN POR EL DEPARTAMENTO DE LA VACANTE (MINA) + PLAN DE AVANCE + FECHA Y ENVÍO AUTOMÁTICO DE CORREOS A DEPTOS DE ORIGEN
  const handleSelectCandidateByDestination = async (post: any, selected: boolean, fecha?: string, plan?: string) => {
    if (!post.autorizado_rh_local || !post.autorizado_rh_corporativo) {
      alert('🛑 Regla de Control: Primero debe contar con la autorización previa de RH Unidad y RH Corporativo.')
      return
    }
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

    const { error } = await supabase
      .from('movimientos_postulantes')
      .update({
        seleccionado_por_destino: selected,
        fecha_presentacion: defaultDate,
        plan_avance_asignado: defaultPlan,
        estatus_movimiento: selected ? 'Seleccionado con Plan y Fecha' : 'Autorizado por RH y Corporativo',
      })
      .eq('id_postulacion', post.id_postulacion)

    if (error) {
      alert('Error seleccionando candidato: ' + error.message)
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
    try {
      const res = await fetch('/api/movimientos/responder-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_postulacion: post.id_postulacion,
          decision,
          comentario:
            comentario ||
            (decision === 'SI'
              ? `Liberación autorizada por ${post.encargado_origen_nombre || post.departamento_actual}`
              : `No se puede liberar en esa fecha por operación en ${post.departamento_actual}`),
          nueva_fecha: nuevaFecha,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error procesando respuesta')

      setReprogramTarget(null)
      await fetchAllData()

      if (decision === 'SI') {
        alert(
          `✅ ¡Confirmado (SÍ)! Se avisó automáticamente a ${currentVacante?.departamento_destino || 'Mina'} y a RH que ${
            post.nombre_completo
          } está autorizado para presentarse. Su pieza ya está desbloqueada en el Tablero de Ajedrez.`
        )
      } else {
        alert(
          `⏳ Se registró que NO se puede en esa fecha y se notificó de vuelta a ${
            currentVacante?.departamento_destino || 'Mina'
          } y RH para reprogramar una nueva fecha.`
        )
      }
    } catch (err: any) {
      alert('Error registrando respuesta: ' + err.message)
    }
  }

  // 6. VALIDACIÓN ESTRICTA DE LAS 4 REGLAS DEL TABLERO DE AJEDREZ
  const evaluateChessRules = (post: any, vac: any) => {
    const plazasLibres = Math.max(0, (vac?.plazas_totales || 1) - (vac?.plazas_ocupadas || 0))
    const rule1VacanteLibre = plazasLibres > 0
    const rule2RHApproved = Boolean(post.autorizado_rh_local && post.autorizado_rh_corporativo)
    const rule3DestinoPlan = Boolean(post.seleccionado_por_destino && post.fecha_presentacion)
    const rule4OrigenLiberado = post.respuesta_depto_origen === 'Autorizado (Sí)'

    const blockers: string[] = []
    if (!rule1VacanteLibre) blockers.push('No hay vacante libre (Plazas llenas — libera primero una plaza)')
    if (!rule2RHApproved) blockers.push('Falta autorización previa de RH Unidad y/o RH Corporativo')
    if (!rule3DestinoPlan) blockers.push('El departamento de la vacante no ha asignado fecha y plan de avance')
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
      `♟️ ¿Ejecutar movimiento oficial de "${post.nombre_completo}" de [${post.puesto_actual} en ${post.departamento_actual}] hacia [${vac.puesto_vacante} en ${vac.departamento_destino}]?\n\nAl mover esta pieza, su puesto anterior (${post.puesto_actual} en ${post.departamento_actual}) quedará libre y se abrirá automáticamente su vacante en el tablero.`
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

      // 4. EFECTO DOMINÓ DE AJEDREZ: Liberar automáticamente la plaza que dejó en su departamento de origen
      const dominoFolio = `CONV-DOM-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`
      const todayStr = new Date().toISOString().split('T')[0]
      const close10Days = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]

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
          requisitos: `Vacante liberada por ascenso de ${post.nombre_completo} a ${vac.puesto_vacante}. Periodo de 10 días abierto para postulaciones.`,
          fecha_apertura: todayStr,
          fecha_cierre_inscripcion: close10Days,
          dias_convocatoria: 10,
          estatus_vacante: 'Convocatoria Abierta (10 Días)',
        },
      ])

      // 5. Bitácora de avisos
      await supabase.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: vac.id_vacante,
          id_postulacion: post.id_postulacion,
          tipo_aviso: 'MOVIMIENTO_AJEDREZ',
          remitente: 'Tablero de Ajedrez RH & Sindicato',
          destinatarios: `${vac.departamento_destino}, ${post.departamento_actual}, RH Corporativo y Sindicato`,
          asunto: `♟️ Movimiento Ejecutado: ${post.nombre_completo} → ${vac.puesto_vacante} (${vac.departamento_destino})`,
          mensaje: `${post.nombre_completo} ocupó la plaza de ${vac.puesto_vacante} en ${vac.departamento_destino}. En automático se liberó su plaza anterior de ${post.puesto_actual} en ${post.departamento_actual} (Nueva convocatoria ${dominoFolio} por 10 días).`,
          correo_enviado: false,
        },
      ])

      await fetchAllData()
      alert(
        `♟️ ¡Movimiento ejecutado con éxito!\n\n1) ${post.nombre_completo} ya está activo en ${vac.puesto_vacante} (${vac.departamento_destino}) y comenzó su conteo de días en el Historial.\n2) Su puesto anterior (${post.puesto_actual} en ${post.departamento_actual}) quedó liberado automáticamente con la nueva convocatoria ${dominoFolio}.`
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

      {/* BARRA DE 5 PESTAÑAS */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        {[
          { id: 'convocatorias', label: `1. Convocatorias (10 Días) & Vacantes (${vacantes.length})`, icon: FileText },
          { id: 'inscripciones', label: `2. Inscripción de Postulantes (${postulantes.length})`, icon: Users },
          { id: 'autorizaciones', label: '3. RH, Plan Mina y Correos a Departamentos', icon: Mail },
          { id: 'ajedrez', label: '4. ♟️ Tablero de Ajedrez (Mover con Reglas)', icon: Layers },
          { id: 'historial', label: `5. Historial (Días), Calificación y Encargados (${historial.length})`, icon: Award },
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
                <span>Boletín Convocatoria 10 Días (PDF)</span>
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
                      <span>Anuncio PDF (10 Días)</span>
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
          PESTAÑA 3: AUTORIZACIONES RH/CORPORATIVO, PLAN DE MINA Y CORREOS A DEPTOS
         ===================================================================== */}
      {activeTab === 'autorizaciones' && currentVacante && (
        <div className="space-y-6">
          {/* Barra de Flujo en 3 Pasos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* PASO A: Autorización Previa RH Unidad + RH Corporativo */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-amber-600">PASO 1 • FILTRO PREVIO</span>
                <ShieldCheck className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-sm font-black uppercase text-zinc-900">
                Autorización Previa RH Unidad y RH Corporativo
              </h3>
              <p className="text-xs text-zinc-500">
                Antes de que {currentVacante.departamento_destino} cite a los candidatos, RH Local y RH Corporativo validan el escalafón y la plaza.
              </p>
              <button
                type="button"
                onClick={handleAuthorizeAllRH}
                className="w-full py-2.5 bg-zinc-900 hover:bg-black text-amber-400 font-black text-xs rounded-xl shadow"
              >
                ✓ Autorizar Todos por RH Unidad y RH Corporativo
              </button>
            </div>

            {/* PASO B: Plan de Avance y Fecha del Departamento de la Vacante (Mina) */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-blue-600">
                  PASO 2 • DEPTO VACANTE ({currentVacante.departamento_destino})
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
                Marca abajo en la tabla a los postulantes elegidos por {currentVacante.departamento_destino} y su fecha para presentarse.
              </p>
            </div>

            {/* PASO C: Disparo Automático de Correos a Encargados de Origen */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-emerald-600">
                  PASO 3 • AVISO AUTOMÁTICO A DEPTOS ORIGEN
                </span>
                <Mail className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-black uppercase text-zinc-900">
                Notificar a Encargados Multi-Subdepartamento
              </h3>
              <p className="text-xs text-zinc-500">
                Envía un correo automático a los encargados de los departamentos de origen con botones interactivos <strong>SÍ</strong> o <strong>NO / Reprogramar</strong>.
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
                    : `Enviar Correos a Deptos Origen (${currentPostulantes.filter((p) => p.seleccionado_por_destino).length} elegidos)`}
                </span>
              </button>
            </div>
          </div>

          {/* Tabla Interactiva de Candidatos, Fechas y Respuestas de los Departamentos */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-900 text-white font-black text-xs uppercase flex items-center justify-between">
              <span>
                Control de Selección, Fechas y Respuesta de Departamentos — {currentVacante.puesto_vacante} ({currentVacante.departamento_destino})
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
                    <th className="px-4 py-3 text-center">1. Vo.Bo. RH &amp; Corp.</th>
                    <th className="px-4 py-3 text-left">2. Selección {currentVacante.departamento_destino} &amp; Fecha Cita</th>
                    <th className="px-4 py-3 text-left">3. Respuesta Encargado Depto Origen</th>
                    <th className="px-4 py-3 text-right">Acciones / Reprogramar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {currentPostulantes.map((p) => (
                    <tr key={p.id_postulacion} className="hover:bg-zinc-50">
                      <td className="px-4 py-3.5">
                        <div className="font-black text-zinc-900">{p.nombre_completo}</div>
                        <div className="text-[11px] text-zinc-500">
                          {p.puesto_actual} • <strong>{p.departamento_actual}</strong>
                          {p.sub_departamento_actual ? ` (${p.sub_departamento_actual})` : ''}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          Antigüedad: {p.anos_antiguedad} años • Encargado: {p.encargado_origen_correo}
                        </div>
                      </td>

                      {/* 1. RH Local y Corporativo */}
                      <td className="px-4 py-3.5 text-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleRHApproval(p, 'autorizado_rh_local')}
                          className={`px-2 py-1 rounded text-[10px] font-black border ${
                            p.autorizado_rh_local
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                          }`}
                        >
                          {p.autorizado_rh_local ? '✓ RH Local' : 'RH Local'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleRHApproval(p, 'autorizado_rh_corporativo')}
                          className={`px-2 py-1 rounded text-[10px] font-black border ${
                            p.autorizado_rh_corporativo
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                          }`}
                        >
                          {p.autorizado_rh_corporativo ? '✓ RH Corp.' : 'RH Corp.'}
                        </button>
                      </td>

                      {/* 2. Selección por Mina + Fecha */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
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
                        </div>
                        {p.correo_enviado_origen && (
                          <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold">
                            📧 Correo enviado a {p.encargado_origen_nombre}
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
                            🔔 Aviso de vuelta enviado a {currentVacante.departamento_destino}
                          </span>
                        )}
                      </td>

                      {/* 4. Botones de Respuesta del Jefe de Origen o Reprogramación */}
                      <td className="px-4 py-3.5 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOriginDepartmentResponse(p, 'SI')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg"
                          title="Confirmar que SÍ autoriza la salida del trabajador en esa fecha"
                        >
                          ✅ Depto Dice SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReprogramTarget(p)
                            setReprogramDate(p.fecha_presentacion || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
                            setReprogramNote('')
                          }}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-lg"
                          title="Indicar que NO puede en esa fecha y planear una nueva fecha"
                        >
                          ⏳ Depto Dice NO / Nueva Fecha
                        </button>
                      </td>
                    </tr>
                  ))}
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
          PESTAÑA 5: HISTORIAL DE ESTANCIA (DÍAS), CALIFICACIÓN Y ENCARGADOS MULTI-SUBDEPTO
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
    </div>
  )
}
