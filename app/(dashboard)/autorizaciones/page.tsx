'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { TEST_AUTH_LEVELS, type TestAuthLevel } from '@/utils/testAuthLevels'
import { formatShortDate } from '@/utils/contratistasConfig'
import { areDepartmentsEquivalent } from '@/utils/dataNormalization'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  HardHat,
  Layers,
  FileText,
  Stethoscope,
  Lock,
  Unlock,
  RefreshCw,
  FlaskConical,
  ArrowRight,
  Building2,
  Sparkles,
  QrCode,
  Bed,
  Users,
  Check,
  RotateCcw,
} from 'lucide-react'

export default function AutorizacionesMultiNivelPage() {
  const { user, profile, testLevelId, activeTestLevel, setTestLevel } = useAuth()

  const [loading, setLoading] = useState(true)
  const [seedingDemo, setSeedingDemo] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activeTray, setActiveTray] = useState<'contratistas' | 'escalafon' | 'solicitudes' | 'medico'>('contratistas')
  const [showOnlyPending, setShowOnlyPending] = useState(true)
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Datos de las 4 bandejas
  const [contratistasSols, setContratistasSols] = useState<any[]>([])
  const [contratistasProrrogas, setContratistasProrrogas] = useState<any[]>([])
  const [vacantes, setVacantes] = useState<any[]>([])
  const [postulantes, setPostulantes] = useState<any[]>([])
  const [solicitudesRh, setSolicitudesRh] = useState<any[]>([])
  const [pasesMedicos, setPasesMedicos] = useState<any[]>([])
  const [reglasMov, setReglasMov] = useState<any>(null)
  const [rhCorpContratistasMap, setRhCorpContratistasMap] = useState<
    Record<string, { approved: boolean; por: string; fecha: string }>
  >({})
  const [rhCorpSolicitudesMap, setRhCorpSolicitudesMap] = useState<
    Record<string, { approved: boolean; por: string; fecha: string }>
  >({})

  useEffect(() => {
    try {
      const savedCnt = localStorage.getItem('bacis_contratistas_rh_corp_approvals')
      if (savedCnt) setRhCorpContratistasMap(JSON.parse(savedCnt))
      const savedSol = localStorage.getItem('bacis_solicitudes_rh_corp_approvals')
      if (savedSol) setRhCorpSolicitudesMap(JSON.parse(savedSol))
    } catch {}
    fetchAllApprovalTrays()
  }, [])

  const fetchAllApprovalTrays = async () => {
    setLoading(true)
    try {
      const [
        cntSolRes,
        cntProrRes,
        cntMsgsCorpRes,
        vacRes,
        postRes,
        regRes,
        solRes,
        pasesRes,
      ] = await Promise.all([
        supabase
          .from('contratistas_solicitudes')
          .select('*, contratistas_empresas(razon_social, rfc), contratistas_solicitud_personal(*, contratistas_personal(*))')
          .order('creado_el', { ascending: false })
          .limit(40),
        supabase
          .from('contratistas_prorrogas')
          .select('*, contratistas_empresas(razon_social), contratistas_solicitudes(folio, departamento_nombre)')
          .order('creado_el', { ascending: false })
          .limit(30),
        supabase
          .from('contratistas_mensajes')
          .select('id_solicitud, remitente_nombre, remitente_rol, mensaje, creado_el')
          .ilike('mensaje', '%[VOBO_RH_CORPORATIVO]%')
          .order('creado_el', { ascending: false })
          .limit(100),
        supabase
          .from('movimientos_vacantes')
          .select('*')
          .order('creado_el', { ascending: false })
          .limit(30),
        supabase
          .from('movimientos_postulantes')
          .select('*')
          .order('anos_antiguedad', { ascending: false })
          .limit(60),
        supabase.from('movimientos_reglas_autorizacion').select('*').limit(1).maybeSingle(),
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
              puesto,
              empleado_adscripciones(
                cat_departamentos(id_departamento, departamento),
                cat_puestos(puesto)
              )
            )
          `)
          .order('creado_el', { ascending: false })
          .limit(40),
        supabase
          .from('pases_medicos')
          .select(`
            *,
            empleados(id_empleado, nombre, apellido_paterno, apellido_materno, departamento, puesto),
            pacientes(nombre_completo, parentesco, id_empleado),
            clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey(nombre),
            clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey(nombre)
          `)
          .order('creado_el', { ascending: false })
          .limit(25),
      ])

      // Sincronizar firmas de RH Corporativo guardadas en BD + localStorage
      const nextCorpMap: Record<string, { approved: boolean; por: string; fecha: string }> = {
        ...JSON.parse(localStorage.getItem('bacis_contratistas_rh_corp_approvals') || '{}'),
      }
      for (const m of cntMsgsCorpRes.data || []) {
        if (m.id_solicitud && !nextCorpMap[m.id_solicitud]) {
          nextCorpMap[m.id_solicitud] = {
            approved: true,
            por: m.remitente_nombre || 'Supt. RH Corporativo',
            fecha: m.creado_el || new Date().toISOString(),
          }
        }
      }
      setRhCorpContratistasMap(nextCorpMap)
      localStorage.setItem('bacis_contratistas_rh_corp_approvals', JSON.stringify(nextCorpMap))

      setContratistasSols(cntSolRes.data || [])
      setContratistasProrrogas(cntProrRes.data || [])
      setVacantes(vacRes.data || [])
      setPostulantes(postRes.data || [])
      if (regRes.data) setReglasMov(regRes.data)
      setSolicitudesRh(solRes.data || [])
      setPasesMedicos(pasesRes.data || [])
    } catch (e) {
      console.error('Error cargando bandejas multi-nivel:', e)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // DETECTOR DE FACULTADES DEL NIVEL ACTUALMENTE SIMULADO
  // ============================================================================
  const levelCapabilities = useMemo(() => {
    const id = testLevelId
    const isGlobal = id === 'REAL_SESSION'
    return {
      isGlobal,
      canRhUnidad: isGlobal || id === 'NIVEL_1_RH_UNIDAD',
      canRhCorporativo: isGlobal || id === 'NIVEL_2_RH_CORPORATIVO',
      canSeguridad: isGlobal || id === 'NIVEL_4_SEGURIDAD',
      canCampamento: isGlobal || id === 'NIVEL_5_CAMPAMENTO',
      canMedico: isGlobal || id === 'NIVEL_6_MEDICO',
      canSindicato: isGlobal || id === 'NIVEL_7_SINDICATO',
      canAnyJefeDepto:
        isGlobal ||
        id === 'NIVEL_3A_JEFE_MINA' ||
        id === 'NIVEL_3B_JEFE_PLANTA' ||
        id === 'NIVEL_3C_JEFE_MTTO' ||
        id === 'NIVEL_5_CAMPAMENTO',
      canActForDepartamento: (deptName?: string | null) => {
        if (isGlobal) return true
        if (!deptName) return false
        if (id === 'NIVEL_5_CAMPAMENTO') return areDepartmentsEquivalent(deptName, 'CAMPAMENTO Y COMEDOR')
        if (id === 'NIVEL_4_SEGURIDAD') return areDepartmentsEquivalent(deptName, 'SEGURIDAD INDUSTRIAL')
        if (id === 'NIVEL_1_RH_UNIDAD') return areDepartmentsEquivalent(deptName, 'RECURSOS HUMANOS')
        if (id === 'NIVEL_3A_JEFE_MINA') return areDepartmentsEquivalent(deptName, 'MINA')
        if (id === 'NIVEL_3B_JEFE_PLANTA') return areDepartmentsEquivalent(deptName, 'PLANTA DE BENEFICIO')
        if (id === 'NIVEL_3C_JEFE_MTTO') {
          return (
            areDepartmentsEquivalent(deptName, 'MANTENIMIENTO') ||
            areDepartmentsEquivalent(deptName, 'MANTENIMIENTO ELÉCTRICO')
          )
        }
        return false
      },
      resolveRequiredJefeLevelId: (deptName?: string | null) => {
        if (areDepartmentsEquivalent(deptName, 'CAMPAMENTO Y COMEDOR')) return 'NIVEL_5_CAMPAMENTO'
        if (areDepartmentsEquivalent(deptName, 'SEGURIDAD INDUSTRIAL')) return 'NIVEL_4_SEGURIDAD'
        if (areDepartmentsEquivalent(deptName, 'RECURSOS HUMANOS')) return 'NIVEL_1_RH_UNIDAD'
        if (areDepartmentsEquivalent(deptName, 'PLANTA DE BENEFICIO')) return 'NIVEL_3B_JEFE_PLANTA'
        if (
          areDepartmentsEquivalent(deptName, 'MANTENIMIENTO') ||
          areDepartmentsEquivalent(deptName, 'MANTENIMIENTO ELÉCTRICO')
        ) {
          return 'NIVEL_3C_JEFE_MTTO'
        }
        return 'NIVEL_3A_JEFE_MINA'
      },
    }
  }, [testLevelId])

  // ============================================================================
  // GENERADOR DE ESCENARIO DE PRUEBA MULTI-NIVEL (PARA PROBAR CADA VISTA AL INSTANTE)
  // ============================================================================
  const handleGenerateTestScenario = async () => {
    setSeedingDemo(true)
    setFeedbackBanner(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
      const suffix = Math.floor(100 + Math.random() * 899)

      // 1. Crear Solicitud de Contratista en Revisión Multi-Factor (si no hay una pendiente)
      const [{ data: empList }, { data: deptList }, { data: workersList }] = await Promise.all([
        supabase.from('contratistas_empresas').select('*').limit(1),
        supabase.from('cat_departamentos').select('*').eq('activo', true),
        supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, departamento').eq('estado_empleado', 'Activo').limit(5),
      ])

      if (empList && empList.length > 0) {
        const minaDept = (deptList || []).find((d: any) => areDepartmentsEquivalent(d.departamento, 'MINA'))
        await supabase.from('contratistas_solicitudes').insert([
          {
            folio: `PRUEBA-CNT-${suffix}`,
            id_empresa: empList[0].id_empresa,
            id_departamento_objetivo: minaDept?.id_departamento || null,
            departamento_nombre: minaDept?.departamento || 'MINA',
            contacto_departamento: 'Ing. Superintendente de Mina',
            descripcion_servicio: '[MODO PRUEBA] Mantenimiento e Inspección Multi-Nivel',
            area_trabajo: 'Interior Mina / Parajes',
            fecha_inicio: today,
            fecha_fin: inTenDays,
            requiere_campamento: true,
            requiere_comedor: true,
            estatus_general: 'En Revisión',
            estatus_documentos: 'Completo',
            estatus_departamento: 'Pendiente',
            estatus_seguridad: 'Pendiente',
            estatus_campamento: 'Pendiente',
            estatus_rh: 'Pendiente',
          },
        ])
      }

      // 2. Crear Vacante + Postulante de Prueba para Escalafón (Planta -> Mina)
      const { data: vacCreated } = await supabase
        .from('movimientos_vacantes')
        .insert([
          {
            folio_convocatoria: `PRUEBA-ESC-${suffix}`,
            puesto_vacante: 'AYUDANTE DE PERFORISTA (PRUEBA)',
            departamento_destino: 'MINA',
            sub_departamento_destino: 'Perforación y Voladura',
            plazas_totales: 2,
            plazas_ocupadas: 0,
            origen_vacante: 'Vacante de Prueba Multi-Nivel',
            categoria_tabulador: 'Sindicalizado / Escalafón',
            requisitos: 'Escenario de prueba para probar firmas Nivel 1 -> Nivel 2 -> Nivel 3A (Mina) -> Nivel 3B (Planta).',
            fecha_apertura: today,
            fecha_cierre_inscripcion: inTenDays,
            dias_convocatoria: 10,
            plan_avance_departamento: 'Inducción en frente y evaluación práctica.',
            estatus_vacante: 'Convocatoria Abierta (10 Días)',
          },
        ])
        .select()
        .single()

      if (vacCreated) {
        const sampleEmp = workersList && workersList.length > 0 ? workersList[0] : null
        await supabase.from('movimientos_postulantes').insert([
          {
            id_vacante: vacCreated.id_vacante,
            id_empleado: sampleEmp?.id_empleado || null,
            nombre_completo: sampleEmp
              ? `${sampleEmp.nombre} ${sampleEmp.apellido_paterno}`
              : 'JOSE ARANA CHAVEZ (PRUEBA)',
            fecha_inscripcion: today,
            departamento_actual: 'PLANTA DE BENEFICIO',
            sub_departamento_actual: 'Trituración',
            puesto_actual: 'AYUDANTE GENERAL DE PLANTA',
            puesto_postulado: vacCreated.puesto_vacante,
            anos_antiguedad: 4.5,
            tiene_anos_experiencia: true,
            tiene_experiencia_puesto: true,
            requiere_capacitacion_previa: false,
            encargado_origen_nombre: 'Encargado Planta de Beneficio',
            encargado_origen_correo: 'jefe.planta.de@bacis.com',
            autorizado_rh_local: false,
            autorizado_rh_corporativo: false,
            seleccionado_por_destino: false,
            respuesta_depto_origen: 'Pendiente de Respuesta',
            estatus_movimiento: 'Inscrito en Convocatoria',
          },
        ])
      }

      await fetchAllApprovalTrays()
      setFeedbackBanner({
        type: 'ok',
        text: `🧪 ¡Escenario de prueba #${suffix} creado! Ya tienes folios pendientes listos para ir probando firma por firma desde el Nivel 1 hasta el Nivel 7.`,
      })
    } catch (e: any) {
      setFeedbackBanner({ type: 'err', text: 'Error generando escenario de prueba: ' + e.message })
    } finally {
      setSeedingDemo(false)
    }
  }

  // ============================================================================
  // ACCIONES DE AUTORIZACIÓN POR BANDEJA Y NIVEL
  // ============================================================================

  // A. Contratistas Multi-Factor (5 Niveles: RH Unidad, RH Corporativo, Seguridad, Campamento, Jefe Área)
  const handleContratistaFactorApprove = async (
    sol: any,
    factor: 'rh' | 'rh_corporativo' | 'seguridad' | 'campamento' | 'departamento',
    newStatus: string
  ) => {
    setBusyId(`${sol.id_solicitud}_${factor}`)
    setFeedbackBanner(null)
    try {
      const targetLevelMap: Record<string, string> = {
        rh: 'NIVEL_1_RH_UNIDAD',
        rh_corporativo: 'NIVEL_2_RH_CORPORATIVO',
        seguridad: 'NIVEL_4_SEGURIDAD',
        campamento: 'NIVEL_5_CAMPAMENTO',
      }
      const fallbackLevelObj =
        TEST_AUTH_LEVELS.find((l) => l.id === targetLevelMap[factor]) || activeTestLevel
      const actor =
        testLevelId !== 'REAL_SESSION'
          ? fallbackLevelObj.nombre_completo
          : profile?.nombre_completo || fallbackLevelObj.nombre_completo
      const nowIso = new Date().toISOString()

      let nextCorpApproved = Boolean(rhCorpContratistasMap[sol.id_solicitud]?.approved)

      if (factor === 'rh_corporativo') {
        const isApprove = newStatus === 'Aprobado'
        nextCorpApproved = isApprove
        const nextMap = {
          ...rhCorpContratistasMap,
          [sol.id_solicitud]: { approved: isApprove, por: actor, fecha: nowIso },
        }
        setRhCorpContratistasMap(nextMap)
        localStorage.setItem('bacis_contratistas_rh_corp_approvals', JSON.stringify(nextMap))

        await supabase
          .from('contratistas_mensajes')
          .insert([
            {
              id_solicitud: sol.id_solicitud,
              id_empresa: sol.id_empresa,
              remitente_id: user?.id || null,
              remitente_nombre: actor,
              remitente_rol: 'RH Corporativo',
              mensaje: `[VOBO_RH_CORPORATIVO] Vo.Bo. Corporativo ${isApprove ? 'AUTORIZADO' : 'RECHAZADO'} por ${actor}.`,
            },
          ])
          .then(() => {})
      }

      const payload: any = { actualizado_el: nowIso }

      if (factor === 'rh') {
        payload.estatus_rh = newStatus
        payload.estatus_documentos = newStatus === 'Aprobado' ? 'Completo' : 'Rechazado'
        payload.aprobado_rh_por = actor
        payload.fecha_aprobacion_rh = nowIso
        if (newStatus === 'Rechazado') payload.estatus_general = 'Rechazada'
      } else if (factor === 'seguridad') {
        payload.estatus_seguridad = newStatus
        payload.aprobado_seguridad_por = actor
        payload.fecha_aprobacion_seguridad = nowIso
        if (newStatus === 'Rechazado') payload.estatus_general = 'Rechazada'
      } else if (factor === 'campamento') {
        // Campamentos: valores válidos DB -> 'Disponible / Asignado' | 'Sin Cupo' | 'No Requiere' | 'Pendiente'
        const validCampStatus = newStatus === 'Aprobado' ? 'Disponible / Asignado' : newStatus
        payload.estatus_campamento = validCampStatus
        payload.aprobado_campamento_por = actor
        payload.fecha_aprobacion_campamento = nowIso
      } else if (factor === 'departamento') {
        payload.estatus_departamento = newStatus
        payload.aprobado_depto_por = actor
        payload.fecha_aprobacion_depto = nowIso
        if (newStatus === 'Rechazado') payload.estatus_general = 'Rechazada'
      } else if (factor === 'rh_corporativo' && newStatus === 'Rechazado') {
        payload.estatus_general = 'Rechazada'
      }

      // Verificar si con este cambio ya quedaron los 5 factores listos
      const nextRh = factor === 'rh' ? newStatus : sol.estatus_rh
      const nextSeg = factor === 'seguridad' ? newStatus : sol.estatus_seguridad
      const nextDept = factor === 'departamento' ? newStatus : sol.estatus_departamento
      const nextCamp = factor === 'campamento' ? payload.estatus_campamento : sol.estatus_campamento
      const campOk =
        !sol.requiere_campamento ||
        nextCamp === 'Disponible / Asignado' ||
        nextCamp === 'No Requiere' ||
        nextCamp === 'Aprobado'

      if (nextRh === 'Aprobado' && nextCorpApproved && nextSeg === 'Aprobado' && nextDept === 'Aprobado' && campOk) {
        payload.estatus_general = 'Aprobada'
      }

      const { error } = await supabase
        .from('contratistas_solicitudes')
        .update(payload)
        .eq('id_solicitud', sol.id_solicitud)

      if (error) throw error

      await fetchAllApprovalTrays()
      const labelFactor =
        factor === 'rh_corporativo'
          ? 'RH CORPORATIVO'
          : factor === 'campamento'
          ? 'CAMPAMENTOS (JEFE DE CAMPAMENTOS)'
          : factor.toUpperCase()
      setFeedbackBanner({
        type: 'ok',
        text: `✅ Factor ${labelFactor} autorizado en folio ${sol.folio} por ${actor}.`,
      })
    } catch (e: any) {
      setFeedbackBanner({ type: 'err', text: 'Error actualizando factor de contratista: ' + e.message })
    } finally {
      setBusyId(null)
    }
  }

  // Prórrogas de Contratistas
  const handleResolveProrroga = async (pror: any, decision: 'Aprobada' | 'Rechazada') => {
    setBusyId(pror.id_prorroga)
    try {
      const { error } = await supabase
        .from('contratistas_prorrogas')
        .update({
          estatus_general: decision,
          estatus_rh: decision,
          estatus_departamento: decision,
          estatus_seguridad: decision,
          estatus_campamento: decision,
          resuelto_el: new Date().toISOString(),
        })
        .eq('id_prorroga', pror.id_prorroga)
      if (error) throw error
      await fetchAllApprovalTrays()
      setFeedbackBanner({
        type: 'ok',
        text: `✅ Prórroga marcada como "${decision}" por ${activeTestLevel.shortLabel}.`,
      })
    } catch (e: any) {
      setFeedbackBanner({ type: 'err', text: 'Error resolviendo prórroga: ' + e.message })
    } finally {
      setBusyId(null)
    }
  }

  // B. Escalafón y Movimientos Sindicales (Art. 116 C.C.T.)
  const handleEscalafonStep = async (
    post: any,
    etapa: 'RH_UNIDAD' | 'RH_CORPORATIVO' | 'PLAN_DESTINO' | 'LIBERACION_ORIGEN',
    requiredLevelId: string,
    extras?: Record<string, any>
  ) => {
    // Usar siempre los datos del nivel titular correspondiente cuando estamos en Sesión Real o cambiando de nivel
    const targetLevelObj =
      testLevelId === requiredLevelId
        ? activeTestLevel
        : TEST_AUTH_LEVELS.find((l) => l.id === requiredLevelId) || activeTestLevel

    setBusyId(`${post.id_postulacion}_${etapa}`)
    setFeedbackBanner(null)
    try {
      const res = await fetch('/api/movimientos/autorizar-etapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_postulacion: post.id_postulacion,
          etapa,
          user_id: user?.id || null,
          user_email: targetLevelObj.email || user?.email || '',
          user_name: targetLevelObj.nombre_completo,
          user_rol: targetLevelObj.rol,
          bypass_lock: true,
          baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
          ...(extras || {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Respaldo directo en Supabase para no bloquear la autorización en modo prueba
        const fallbackUpdate: any = {}
        const nowIso = new Date().toISOString()
        if (etapa === 'RH_UNIDAD') {
          fallbackUpdate.autorizado_rh_local = true
          fallbackUpdate.autorizado_rh_local_por = targetLevelObj.nombre_completo
          fallbackUpdate.fecha_autorizacion_rh_local = nowIso
          fallbackUpdate.estatus_movimiento = 'Esperando Vo.Bo. RH Corporativo'
        } else if (etapa === 'RH_CORPORATIVO') {
          fallbackUpdate.autorizado_rh_corporativo = true
          fallbackUpdate.autorizado_rh_corporativo_por = targetLevelObj.nombre_completo
          fallbackUpdate.fecha_autorizacion_rh_corporativo = nowIso
          fallbackUpdate.estatus_movimiento = 'Autorizado por RH y Corporativo'
        } else if (etapa === 'PLAN_DESTINO') {
          fallbackUpdate.seleccionado_por_destino = true
          fallbackUpdate.fecha_presentacion = extras?.fecha_presentacion || new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
          fallbackUpdate.plan_avance_asignado = extras?.plan_avance || 'Plan de avance autorizado'
          fallbackUpdate.seleccionado_por_usuario = targetLevelObj.nombre_completo
          fallbackUpdate.estatus_movimiento = 'Esperando Respuesta Depto Origen'
        } else if (etapa === 'LIBERACION_ORIGEN') {
          fallbackUpdate.respuesta_depto_origen = 'Autorizado (Sí)'
          fallbackUpdate.estatus_movimiento = 'Confirmado para Mover (SÍ)'
          fallbackUpdate.fecha_respuesta_origen = nowIso
        }
        const { error: fbErr } = await supabase
          .from('movimientos_postulantes')
          .update(fallbackUpdate)
          .eq('id_postulacion', post.id_postulacion)
        if (fbErr) {
          setFeedbackBanner({ type: 'err', text: json.error || fbErr.message })
          return
        }
      }
      await fetchAllApprovalTrays()
      setFeedbackBanner({
        type: 'ok',
        text: json?.message || `✅ Etapa ${etapa} autorizada como ${targetLevelObj.shortLabel}.`,
      })
    } catch (e: any) {
      setFeedbackBanner({ type: 'err', text: 'Error en etapa de escalafón: ' + e.message })
    } finally {
      setBusyId(null)
    }
  }

  // C. Solicitudes de Personal (Vacaciones / Permisos / Bajas — 3 Firmas: Jefe -> RH Unidad -> RH Corporativo)
  const handleSolicitudStatus = async (
    sol: any,
    nextStatus: 'Aprobada por Jefe' | 'Autorizada RH' | 'Autorizada RH Corporativo' | 'Rechazada'
  ) => {
    setBusyId(`${sol.id_solicitud}_${nextStatus}`)
    setFeedbackBanner(null)
    try {
      const nowIso = new Date().toISOString()
      let dbStatus: 'Aprobada por Jefe' | 'Autorizada RH' | 'Rechazada' = 'Autorizada RH'
      if (nextStatus === 'Aprobada por Jefe' || nextStatus === 'Rechazada') {
        dbStatus = nextStatus
      }

      if (nextStatus === 'Autorizada RH Corporativo') {
        const actor =
          TEST_AUTH_LEVELS.find((l) => l.id === 'NIVEL_2_RH_CORPORATIVO')?.nombre_completo ||
          'Supt. RH Corporativo'
        const nextMap = {
          ...rhCorpSolicitudesMap,
          [sol.id_solicitud]: { approved: true, por: actor, fecha: nowIso },
        }
        setRhCorpSolicitudesMap(nextMap)
        localStorage.setItem('bacis_solicitudes_rh_corp_approvals', JSON.stringify(nextMap))
      }

      const { error } = await supabase
        .from('solicitudes')
        .update({
          estatus: dbStatus,
          id_autorizador: user?.id || null,
        })
        .eq('id_solicitud', sol.id_solicitud)
      if (error) throw error
      await fetchAllApprovalTrays()
      setFeedbackBanner({
        type: 'ok',
        text: `✅ Solicitud firmada como "${nextStatus}".`,
      })
    } catch (e: any) {
      setFeedbackBanner({ type: 'err', text: 'Error actualizando solicitud: ' + e.message })
    } finally {
      setBusyId(null)
    }
  }

  // D. Clínica Médica — Validar / Confirmar Enterado en Pase Médico
  const handlePaseMedicoStatus = async (pase: any, nextStatus: string) => {
    setBusyId(pase.id_pase)
    setFeedbackBanner(null)
    try {
      const { error } = await supabase
        .from('pases_medicos')
        .update({ estatus: nextStatus })
        .eq('id_pase', pase.id_pase)
      if (error) throw error
      await fetchAllApprovalTrays()
      setFeedbackBanner({
        type: 'ok',
        text: `✅ Pase Médico ${pase.folio || ''} marcado como "${nextStatus}" por ${activeTestLevel.shortLabel}.`,
      })
    } catch (e: any) {
      setFeedbackBanner({ type: 'err', text: 'Error actualizando pase médico: ' + e.message })
    } finally {
      setBusyId(null)
    }
  }

  // Contadores de pendientes por bandeja
  const counts = useMemo(() => {
    const cntPending = contratistasSols.filter((s) => s.estatus_general !== 'Aprobada' && s.estatus_general !== 'Rechazada').length +
      contratistasProrrogas.filter((p) => p.estatus_general === 'Pendiente' || !p.estatus_general).length
    const escPending = postulantes.filter((p) => p.estatus_movimiento !== 'Movimiento Ejecutado (En Puesto)').length
    const solPending = solicitudesRh.filter((s) => s.estatus === 'En revisión' || s.estatus === 'Pendiente' || s.estatus === 'Aprobada por Jefe' || !rhCorpSolicitudesMap[s.id_solicitud]?.approved).length
    const medPending = pasesMedicos.length
    return { cntPending, escPending, solPending, medPending }
  }, [contratistasSols, contratistasProrrogas, postulantes, solicitudesRh, pasesMedicos, rhCorpSolicitudesMap])

  const filteredContratistas = useMemo(() => {
    return contratistasSols.filter((s) => {
      if (showOnlyPending && (s.estatus_general === 'Aprobada' || s.estatus_general === 'Rechazada')) {
        return false
      }
      if (testLevelId === 'NIVEL_5_CAMPAMENTO') {
        return Boolean(s.requiere_campamento) || areDepartmentsEquivalent(s.departamento_nombre, 'CAMPAMENTO Y COMEDOR')
      }
      if (
        testLevelId === 'NIVEL_3A_JEFE_MINA' ||
        testLevelId === 'NIVEL_3B_JEFE_PLANTA' ||
        testLevelId === 'NIVEL_3C_JEFE_MTTO'
      ) {
        // Mina/Planta/Mtto NO ven solicitudes exclusivas de Campamento
        if (areDepartmentsEquivalent(s.departamento_nombre, 'CAMPAMENTO Y COMEDOR')) return false
        return levelCapabilities.canActForDepartamento(s.departamento_nombre) || !s.departamento_nombre
      }
      return true
    })
  }, [contratistasSols, showOnlyPending, testLevelId, levelCapabilities])

  const filteredPostulantes = useMemo(() => {
    return postulantes.filter((p) => {
      if (showOnlyPending && p.estatus_movimiento === 'Movimiento Ejecutado (En Puesto)') return false
      return true
    })
  }, [postulantes, showOnlyPending])

  const filteredSolicitudesRh = useMemo(() => {
    return solicitudesRh.filter((s) => {
      const corpDone = Boolean(rhCorpSolicitudesMap[s.id_solicitud]?.approved)
      if (showOnlyPending && ((s.estatus === 'Autorizada RH' && corpDone) || s.estatus === 'Ejecutada' || s.estatus === 'Rechazada')) {
        return false
      }
      if (
        testLevelId === 'NIVEL_3A_JEFE_MINA' ||
        testLevelId === 'NIVEL_3B_JEFE_PLANTA' ||
        testLevelId === 'NIVEL_3C_JEFE_MTTO'
      ) {
        const empDept =
          s.empleados?.empleado_adscripciones?.[0]?.cat_departamentos?.departamento ||
          s.empleados?.departamento
        return !empDept || levelCapabilities.canActForDepartamento(empDept)
      }
      return true
    })
  }, [solicitudesRh, showOnlyPending, testLevelId, levelCapabilities, rhCorpSolicitudesMap])

  // Renderiza botón que SIEMPRE permite autorizar (si corresponde a otro nivel, cambia al nivel y firma en 1 solo clic)
  const renderLevelButton = (
    requiredLevelId: string,
    canExecuteNow: boolean,
    labelReady: string,
    isDone: boolean,
    doneLabel: string,
    onExecute: () => Promise<void> | void,
    busyKey: string
  ) => {
    const reqObj = TEST_AUTH_LEVELS.find((l) => l.id === requiredLevelId)
    if (isDone) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-black">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{doneLabel}</span>
        </span>
      )
    }

    if (canExecuteNow) {
      return (
        <button
          type="button"
          disabled={busyId === busyKey}
          onClick={() => onExecute()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black text-xs shadow-xs cursor-pointer transition-all"
        >
          <Unlock className="w-3.5 h-3.5 shrink-0" />
          <span>{busyId === busyKey ? 'Autorizando...' : labelReady}</span>
        </button>
      )
    }

    return (
      <button
        type="button"
        disabled={busyId === busyKey}
        onClick={async () => {
          setTestLevel(requiredLevelId)
          await onExecute()
        }}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-amber-500 text-amber-400 hover:text-zinc-950 border border-zinc-700 font-black text-xs cursor-pointer transition-all shadow-xs"
        title={`Cambia automáticamente al nivel ${reqObj?.shortLabel} y autoriza este paso en 1 solo clic.`}
      >
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span>
          {busyId === busyKey ? 'Autorizando...' : `${labelReady} (${reqObj?.shortLabel || 'Nivel'})`}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-300">
      {/* HEADER PRINCIPAL */}
      <div className="bg-zinc-950 text-white rounded-3xl p-5 sm:p-7 border border-zinc-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500 text-zinc-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <FlaskConical className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
              <span>Modo Prueba y Simulación Multi-Nivel en Vivo</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              Consola de Vistas y Niveles de Autorización
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-3xl">
              Cambia con un clic entre las vistas de <strong>RH Unidad</strong>, <strong>RH Corporativo</strong>, <strong>Jefes de Área (Mina / Planta / Mtto)</strong>, <strong>Seguridad Industrial</strong>, <strong>Campamentos</strong>, <strong>Servicio Médico</strong> y <strong>Sindicato</strong> para probar todas las autorizaciones paso a paso.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleGenerateTestScenario}
            disabled={seedingDemo}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{seedingDemo ? 'Creando...' : '🧪 Generar Caso de Prueba Multi-Nivel'}</span>
          </button>
          <button
            type="button"
            onClick={fetchAllApprovalTrays}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 cursor-pointer"
            title="Refrescar bandejas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SELECTOR VISUAL DE LOS 10 NIVELES / VISTAS DE AUTORIZACIÓN */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
              PASO 1 • ELIGE QUÉ NIVEL / USUARIO QUIERES SIMULAR
            </span>
            <h2 className="text-sm sm:text-base font-black text-zinc-900 uppercase">
              Matriz de Vistas por Nivel de Autorización ({TEST_AUTH_LEVELS.length} Niveles Disponibles)
            </h2>
          </div>

          {testLevelId !== 'REAL_SESSION' && (
            <button
              type="button"
              onClick={() => setTestLevel('REAL_SESSION')}
              className="px-3.5 py-1.5 bg-zinc-900 text-amber-400 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Volver a Vista Global (Super Admin)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {TEST_AUTH_LEVELS.map((lvl) => {
            const isSelected = testLevelId === lvl.id
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setTestLevel(lvl.id)}
                className={`card-interactive p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-zinc-950 text-white border-amber-500 shadow-lg ring-2 ring-amber-400/30'
                    : 'bg-zinc-50 text-zinc-900 border-zinc-200 hover:border-amber-300 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-xs font-black leading-tight">{lvl.shortLabel}</span>
                  {isSelected && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 text-[9px] font-black uppercase shrink-0">
                      ACTIVO
                    </span>
                  )}
                </div>
                <div>
                  <div className={`text-[10px] font-mono truncate ${isSelected ? 'text-amber-300' : 'text-zinc-500'}`}>
                    {lvl.email || 'Sesión Autenticada'}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {lvl.authorizesTags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200/70 text-zinc-700'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Ficha Explicativa del Nivel Activo en Modo Prueba */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-amber-400 font-black text-[10px] uppercase">
                Vista Activa: {activeTestLevel.shortLabel}
              </span>
              <span className="font-black text-zinc-900 uppercase">{activeTestLevel.title}</span>
            </div>
            <p className="text-zinc-700 leading-snug">{activeTestLevel.scopeDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/contratistas"
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-black text-[11px] hover:bg-zinc-100"
            >
              Abrir en Contratistas &rarr;
            </Link>
            <Link
              href="/movimientos-sindicato"
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-black text-[11px] hover:bg-zinc-100"
            >
              Abrir en Escalafón &rarr;
            </Link>
            <Link
              href="/mi-departamento"
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-black text-[11px] hover:bg-zinc-100"
            >
              Abrir en Mi Área &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* MENSAJE DE RETROALIMENTACIÓN */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-2xl border-2 text-xs font-black flex items-center justify-between gap-2 ${
            feedbackBanner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
              : 'bg-rose-50 border-rose-400 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button type="button" onClick={() => setFeedbackBanner(null)} className="underline text-[11px]">
            Cerrar
          </button>
        </div>
      )}

      {/* PESTAÑAS DE LAS 4 BANDEJAS DEL SISTEMA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTray('contratistas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
              activeTray === 'contratistas'
                ? 'bg-zinc-900 text-white shadow'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <HardHat className="w-4 h-4 text-orange-400" />
            <span>1. Contratistas Multi-Factor ({counts.cntPending})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTray('escalafon')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
              activeTray === 'escalafon'
                ? 'bg-zinc-900 text-white shadow'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>2. Escalafón y Vacantes C.C.T. ({counts.escPending})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTray('solicitudes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
              activeTray === 'solicitudes'
                ? 'bg-zinc-900 text-white shadow'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>3. Vacaciones, Permisos y Bajas ({counts.solPending})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTray('medico')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
              activeTray === 'medico'
                ? 'bg-zinc-900 text-white shadow'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-rose-400" />
            <span>4. Pases Médicos y Clínica ({counts.medPending})</span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer px-2">
          <input
            type="checkbox"
            checked={showOnlyPending}
            onChange={(e) => setShowOnlyPending(e.target.checked)}
            className="rounded text-amber-500"
          />
          <span>Mostrar solo pendientes de autorizar</span>
        </label>
      </div>

      {/* =====================================================================
          BANDEJA 1: CONTRATISTAS MULTI-FACTOR (5 NIVELES: RH UNIDAD + RH CORP. + SEGURIDAD + CAMPAMENTO + JEFE ÁREA)
         ===================================================================== */}
      {activeTray === 'contratistas' && (
        <div className="space-y-4">
          {filteredContratistas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-10 text-center space-y-3">
              <HardHat className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-black text-zinc-900 uppercase">
                No hay solicitudes de contratistas pendientes para esta vista
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Puedes desmarcar &quot;Mostrar solo pendientes&quot; o hacer clic en el botón amarillo superior <strong>&quot;🧪 Generar Caso de Prueba Multi-Nivel&quot;</strong> para probar las 5 firmas de Contratistas ahora mismo.
              </p>
            </div>
          ) : (
            filteredContratistas.map((sol) => {
              const reqJefeLevel = levelCapabilities.resolveRequiredJefeLevelId(sol.departamento_nombre)
              const isAreaCampamento = areDepartmentsEquivalent(sol.departamento_nombre, 'CAMPAMENTO Y COMEDOR')
              const rhDone = sol.estatus_rh === 'Aprobado'
              const rhCorpInfo = rhCorpContratistasMap[sol.id_solicitud]
              const rhCorpDone = Boolean(rhCorpInfo?.approved)
              const segDone = sol.estatus_seguridad === 'Aprobado'
              const campDone =
                !sol.requiere_campamento ||
                sol.estatus_campamento === 'Disponible / Asignado' ||
                sol.estatus_campamento === 'No Requiere' ||
                sol.estatus_campamento === 'Aprobado'
              const deptDone = sol.estatus_departamento === 'Aprobado'
              const progressCount = [rhDone, rhCorpDone, segDone, campDone, deptDone].filter(Boolean).length

              return (
                <div
                  key={sol.id_solicitud}
                  className="bg-white rounded-3xl border-2 border-zinc-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-black bg-zinc-900 text-amber-400 px-2.5 py-0.5 rounded-md">
                          {sol.folio}
                        </span>
                        <span className="text-xs font-black uppercase text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-md">
                          🏢 Área Operativa: {sol.departamento_nombre || 'MINA'}
                        </span>
                        {sol.requiere_campamento && (
                          <span className="text-xs font-black uppercase text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-md">
                            🏕️ Campamento (Autoriza Jefe de Campamentos)
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-zinc-500">
                          Del {formatShortDate(sol.fecha_inicio)} al {formatShortDate(sol.fecha_fin)}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-zinc-900 uppercase mt-1">
                        {sol.contratistas_empresas?.razon_social || 'Empresa Contratista'} —{' '}
                        <span className="text-zinc-600 font-bold text-sm">{sol.descripcion_servicio}</span>
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-black border ${
                          progressCount === 5
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        Firmas: {progressCount} / 5 ({sol.estatus_general})
                      </span>
                    </div>
                  </div>

                  {/* Cuadrícula de los 5 Niveles de Autorización */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Factor 1: Nivel 1 RH Unidad */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-700 block">
                          1. Nivel 1 · Jefe RH Unidad
                        </span>
                        <div className="text-xs font-bold text-zinc-800 mt-0.5">
                          Docs IMSS/SUA/SAT y Vo.Bo. RH
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Estado: <strong>{sol.estatus_rh || 'Pendiente'}</strong>
                        </div>
                      </div>
                      {renderLevelButton(
                        'NIVEL_1_RH_UNIDAD',
                        levelCapabilities.canRhUnidad,
                        '✅ Aprobar RH Unidad',
                        rhDone,
                        `RH Unidad OK (${sol.aprobado_rh_por || 'OK'})`,
                        () => handleContratistaFactorApprove(sol, 'rh', 'Aprobado'),
                        `${sol.id_solicitud}_rh`
                      )}
                    </div>

                    {/* Factor 2: Nivel 2 Supt. RH Corporativo */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block">
                          2. Nivel 2 · Supt. RH Corporativo
                        </span>
                        <div className="text-xs font-bold text-zinc-800 mt-0.5">
                          Vo.Bo. Corporativo Bacís
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Estado: <strong>{rhCorpDone ? 'Autorizado' : 'Pendiente'}</strong>
                        </div>
                      </div>
                      {renderLevelButton(
                        'NIVEL_2_RH_CORPORATIVO',
                        levelCapabilities.canRhCorporativo,
                        '🏛️ Firmar RH Corporativo',
                        rhCorpDone,
                        `RH Corp. OK (${rhCorpInfo?.por || 'OK'})`,
                        () => handleContratistaFactorApprove(sol, 'rh_corporativo', 'Aprobado'),
                        `${sol.id_solicitud}_rh_corporativo`
                      )}
                    </div>

                    {/* Factor 3: Nivel 4 Seguridad Industrial */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-orange-700 block">
                          3. Nivel 4 · Seguridad Industrial
                        </span>
                        <div className="text-xs font-bold text-zinc-800 mt-0.5">
                          Inducción HSE, DC-3 y EPP
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Estado: <strong>{sol.estatus_seguridad || 'Pendiente'}</strong>
                        </div>
                      </div>
                      {renderLevelButton(
                        'NIVEL_4_SEGURIDAD',
                        levelCapabilities.canSeguridad,
                        '🛡️ Liberar Seguridad HSE',
                        segDone,
                        `Seguridad OK (${sol.aprobado_seguridad_por || 'OK'})`,
                        () => handleContratistaFactorApprove(sol, 'seguridad', 'Aprobado'),
                        `${sol.id_solicitud}_seguridad`
                      )}
                    </div>

                    {/* Factor 4: Nivel 5 Jefe de Campamentos (Independiente de Mina) */}
                    <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-teal-800 block">
                          4. Nivel 5 · Jefe de Campamentos
                        </span>
                        <div className="text-xs font-bold text-zinc-800 mt-0.5">
                          {sol.requiere_campamento ? 'Hospedaje y Cupo (NO autoriza Mina)' : 'No requiere hospedaje'}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Estado: <strong>{sol.estatus_campamento || 'Pendiente'}</strong>
                        </div>
                      </div>
                      {renderLevelButton(
                        'NIVEL_5_CAMPAMENTO',
                        levelCapabilities.canCampamento,
                        '🏕️ Autorizar Campamento',
                        campDone,
                        sol.requiere_campamento ? 'Campamento OK' : 'No Requiere',
                        () => handleContratistaFactorApprove(sol, 'campamento', 'Disponible / Asignado'),
                        `${sol.id_solicitud}_campamento`
                      )}
                    </div>

                    {/* Factor 5: Nivel 3 Jefe de Área Operativa */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-700 block">
                          5. {isAreaCampamento ? 'Nivel 5 · Jefe de Campamentos' : `Nivel 3 · Jefe de ${sol.departamento_nombre || 'MINA'}`}
                        </span>
                        <div className="text-xs font-bold text-zinc-800 mt-0.5">
                          Autorización Operativa en Sitio
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Estado: <strong>{sol.estatus_departamento || 'Pendiente'}</strong>
                        </div>
                      </div>
                      {renderLevelButton(
                        reqJefeLevel,
                        levelCapabilities.canActForDepartamento(sol.departamento_nombre),
                        isAreaCampamento ? '🏕️ Autorizar en Campamentos' : `⛏️ Autorizar en ${sol.departamento_nombre || 'Área'}`,
                        deptDone,
                        `Área Aprobada (${sol.aprobado_depto_por || 'OK'})`,
                        () => handleContratistaFactorApprove(sol, 'departamento', 'Aprobado'),
                        `${sol.id_solicitud}_departamento`
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Prórrogas de Contratistas */}
          {contratistasProrrogas.filter((p) => !showOnlyPending || p.estatus_general === 'Pendiente').length > 0 && (
            <div className="bg-white rounded-3xl border border-zinc-200 p-5 space-y-3">
              <h3 className="text-sm font-black text-zinc-900 uppercase">
                ⏱️ Solicitudes de Prórroga / Extensión de Vigencia Contratistas
              </h3>
              <div className="space-y-2.5">
                {contratistasProrrogas
                  .filter((p) => !showOnlyPending || p.estatus_general === 'Pendiente')
                  .map((pror) => (
                    <div
                      key={pror.id_prorroga}
                      className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="text-xs">
                        <div className="font-black text-zinc-900 uppercase">
                          {pror.contratistas_empresas?.razon_social} · Folio{' '}
                          {pror.contratistas_solicitudes?.folio} ({pror.contratistas_solicitudes?.departamento_nombre})
                        </div>
                        <div className="text-zinc-600 mt-0.5">
                          Extender hasta: <strong>{formatShortDate(pror.fecha_fin_solicitada)}</strong> · Motivo:{' '}
                          {pror.motivo || 'Continuidad de obra'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {renderLevelButton(
                          'NIVEL_1_RH_UNIDAD',
                          levelCapabilities.canRhUnidad || levelCapabilities.canAnyJefeDepto,
                          '✅ Aprobar Prórroga',
                          pror.estatus_general === 'Aprobada',
                          'Prórroga Aprobada',
                          () => handleResolveProrroga(pror, 'Aprobada'),
                          pror.id_prorroga
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          BANDEJA 2: ESCALAFÓN Y VACANTES SINDICALES (ART. 116 C.C.T. EN 5 NIVELES)
         ===================================================================== */}
      {activeTray === 'escalafon' && (
        <div className="space-y-4">
          {filteredPostulantes.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-10 text-center space-y-3">
              <Layers className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-black text-zinc-900 uppercase">
                No hay movimientos escalafonarios pendientes
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Usa el botón superior <strong>&quot;🧪 Generar Caso de Prueba Multi-Nivel&quot;</strong> para crear un movimiento escalafonario completo desde Planta de Beneficio hacia Mina y probar las 4 firmas secuenciales.
              </p>
            </div>
          ) : (
            filteredPostulantes.map((post) => {
              const vac = vacantes.find((v) => v.id_vacante === post.id_vacante)
              const destDept = vac?.departamento_destino || 'MINA'
              const origDept = post.departamento_actual || 'PLANTA DE BENEFICIO'
              const reqDestLevelId = levelCapabilities.resolveRequiredJefeLevelId(destDept)
              const reqOrigLevelId = levelCapabilities.resolveRequiredJefeLevelId(origDept)

              const step1Ok = Boolean(post.autorizado_rh_local)
              const step2Ok = Boolean(post.autorizado_rh_corporativo)
              const step3Ok = Boolean(post.seleccionado_por_destino && post.fecha_presentacion)
              const step4Ok = post.respuesta_depto_origen === 'Autorizado (Sí)'

              return (
                <div
                  key={post.id_postulacion}
                  className="bg-white rounded-3xl border-2 border-zinc-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-black bg-zinc-900 text-amber-400 px-2.5 py-0.5 rounded-md">
                          {vac?.folio_convocatoria || 'CONVOCATORIA'}
                        </span>
                        <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md">
                          {origDept} ({post.puesto_actual}) &rarr; {destDept} ({vac?.puesto_vacante || post.puesto_postulado})
                        </span>
                      </div>
                      <h3 className="text-base font-black text-zinc-900 uppercase mt-1">
                        👷 {post.nombre_completo} ·{' '}
                        <span className="text-xs font-bold text-zinc-500">
                          Antigüedad: {post.anos_antiguedad || 0} años
                        </span>
                      </h3>
                    </div>

                    <span className="px-3 py-1 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-black border border-zinc-200 self-start sm:self-center">
                      Estatus: {post.estatus_movimiento}
                    </span>
                  </div>

                  {/* CADENA SECUENCIAL DE 4 FIRMAS POR NIVEL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Paso 1: Nivel 1 Jefe RH Unidad */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-700 block">
                          1° Nivel 1 · Jefe RH Unidad
                        </span>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          Valida escalafón Art. 116 C.C.T. y antigüedad.
                        </p>
                      </div>
                      {renderLevelButton(
                        'NIVEL_1_RH_UNIDAD',
                        levelCapabilities.canRhUnidad,
                        '✅ Firmar Paso 1 (RH Unidad)',
                        step1Ok,
                        `Paso 1 OK (${post.autorizado_rh_local_por || 'RH'})`,
                        () => handleEscalafonStep(post, 'RH_UNIDAD', 'NIVEL_1_RH_UNIDAD', { decision: 'APROBAR' }),
                        `${post.id_postulacion}_RH_UNIDAD`
                      )}
                    </div>

                    {/* Paso 2: Nivel 2 Supt RH Corporativo */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block">
                          2° Nivel 2 · Supt. RH Corporativo
                        </span>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          Aprueba movimiento en plantilla corporativa.
                        </p>
                      </div>
                      {renderLevelButton(
                        'NIVEL_2_RH_CORPORATIVO',
                        levelCapabilities.canRhCorporativo,
                        '🏛️ Firmar Paso 2 (RH Corp.)',
                        step2Ok,
                        `Paso 2 OK (${post.autorizado_rh_corporativo_por || 'Corp'})`,
                        () =>
                          handleEscalafonStep(post, 'RH_CORPORATIVO', 'NIVEL_2_RH_CORPORATIVO', {
                            decision: 'APROBAR',
                          }),
                        `${post.id_postulacion}_RH_CORPORATIVO`
                      )}
                    </div>

                    {/* Paso 3: Nivel 3 Jefe Depto Destino (ej. Mina) */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-700 block">
                          3° Nivel 3 · Jefe {destDept} (Destino)
                        </span>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          Fija fecha de presentación y plan de avance.
                        </p>
                      </div>
                      {renderLevelButton(
                        reqDestLevelId,
                        levelCapabilities.canActForDepartamento(destDept),
                        `📅 Fijar Plan y Cita (${destDept})`,
                        step3Ok,
                        `Cita: ${formatShortDate(post.fecha_presentacion)}`,
                        () =>
                          handleEscalafonStep(post, 'PLAN_DESTINO', reqDestLevelId, {
                            fecha_presentacion: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
                            plan_avance: `Plan de avance aprobado por jefatura de ${destDept}`,
                          }),
                        `${post.id_postulacion}_PLAN_DESTINO`
                      )}
                    </div>

                    {/* Paso 4: Nivel 3 Jefe Depto Origen (ej. Planta) */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-blue-700 block">
                          4° Nivel 3 · Jefe {origDept} (Origen)
                        </span>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          Autoriza salida (SÍ) o solicita nueva fecha (NO).
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {renderLevelButton(
                          reqOrigLevelId,
                          levelCapabilities.canActForDepartamento(origDept),
                          `✅ Autorizar Salida SÍ (${origDept})`,
                          step4Ok,
                          `Salida Autorizada (${origDept})`,
                          () =>
                            handleEscalafonStep(post, 'LIBERACION_ORIGEN', reqOrigLevelId, {
                              decision: 'SI',
                              comentario: `Liberación aprobada desde vista ${origDept}`,
                            }),
                          `${post.id_postulacion}_LIBERACION_ORIGEN`
                        )}
                      </div>
                    </div>
                  </div>

                  {step1Ok && step2Ok && step3Ok && step4Ok && post.estatus_movimiento !== 'Movimiento Ejecutado (En Puesto)' && (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="font-black text-emerald-900">
                        🟢 ¡4 de 4 Niveles Firmados! Este trabajador ya tiene luz verde para ser colocado en el lugar vacío.
                      </span>
                      <Link
                        href="/movimientos-sindicato"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-center shrink-0"
                      >
                        Ir a Colocar en Lugar Vacío &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* =====================================================================
          BANDEJA 3: SOLICITUDES DE PERSONAL (VACACIONES / PERMISOS / BAJAS EN 3 NIVELES)
         ===================================================================== */}
      {activeTray === 'solicitudes' && (
        <div className="space-y-3">
          {filteredSolicitudesRh.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-10 text-center space-y-2">
              <FileText className="w-10 h-10 text-blue-500 mx-auto" />
              <h3 className="text-base font-black text-zinc-900 uppercase">
                No hay solicitudes de vacaciones, permisos o bajas pendientes
              </h3>
              <p className="text-xs text-zinc-500">
                Todas las solicitudes de este departamento están al día.
              </p>
            </div>
          ) : (
            filteredSolicitudesRh.map((sol) => {
              const empDept =
                sol.empleados?.empleado_adscripciones?.[0]?.cat_departamentos?.departamento ||
                sol.empleados?.departamento ||
                'MINA'
              const reqJefeLevel = levelCapabilities.resolveRequiredJefeLevelId(empDept)
              const jefeSigned = sol.estatus === 'Aprobada por Jefe' || sol.estatus === 'Autorizada RH' || sol.estatus === 'Ejecutada'
              const rhSigned = sol.estatus === 'Autorizada RH' || sol.estatus === 'Ejecutada'
              const corpInfo = rhCorpSolicitudesMap[sol.id_solicitud]
              const rhCorpSigned = Boolean(corpInfo?.approved)

              return (
                <div
                  key={sol.id_solicitud}
                  className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-black bg-zinc-900 text-amber-400 px-2 py-0.5 rounded">
                        {sol.folio || 'SOLICITUD'}
                      </span>
                      <span className="text-xs font-black text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        {sol.cat_tipos_solicitud?.tipo_solicitud || 'Solicitud de Personal'}
                      </span>
                      <span className="text-xs font-bold text-zinc-600">
                        🏢 {empDept} · {formatShortDate(sol.creado_el)}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-zinc-900 uppercase">
                      {sol.empleados
                        ? `${sol.empleados.nombre} ${sol.empleados.apellido_paterno} ${sol.empleados.apellido_materno || ''}`
                        : 'Colaborador'}
                    </h4>
                    <div className="text-xs text-zinc-500">
                      Estatus actual: <strong className="text-zinc-900">{sol.estatus}</strong>
                      {rhCorpSigned && (
                        <span className="ml-2 text-indigo-700 font-black">· 🏛️ Con Vo.Bo. RH Corporativo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderLevelButton(
                      reqJefeLevel,
                      levelCapabilities.canActForDepartamento(empDept),
                      `1° Firmar Jefe (${empDept})`,
                      jefeSigned,
                      '1° Vo.Bo. Jefe OK',
                      () => handleSolicitudStatus(sol, 'Aprobada por Jefe'),
                      `${sol.id_solicitud}_Aprobada por Jefe`
                    )}

                    {renderLevelButton(
                      'NIVEL_1_RH_UNIDAD',
                      levelCapabilities.canRhUnidad,
                      '2° Firmar RH Unidad',
                      rhSigned,
                      '2° Autorizada RH Unidad',
                      () => handleSolicitudStatus(sol, 'Autorizada RH'),
                      `${sol.id_solicitud}_Autorizada RH`
                    )}

                    {renderLevelButton(
                      'NIVEL_2_RH_CORPORATIVO',
                      levelCapabilities.canRhCorporativo,
                      '3° Vo.Bo. RH Corporativo',
                      rhCorpSigned,
                      '3° Vo.Bo. RH Corp. OK',
                      () => handleSolicitudStatus(sol, 'Autorizada RH Corporativo'),
                      `${sol.id_solicitud}_Autorizada RH Corporativo`
                    )}

                    <Link
                      href={`/solicitudes/${sol.id_solicitud}`}
                      className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold"
                    >
                      Ver Detalle &rarr;
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* =====================================================================
          BANDEJA 4: CLÍNICA MÉDICA Y PASES MÉDICOS (NIVEL 6 MÉDICO + ACUSE JEFE/RH)
         ===================================================================== */}
      {activeTray === 'medico' && (
        <div className="space-y-3">
          {pasesMedicos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-10 text-center space-y-2">
              <Stethoscope className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-black text-zinc-900 uppercase">
                Sin pases médicos recientes en la bandeja
              </h3>
            </div>
          ) : (
            pasesMedicos.map((pase) => {
              const deptoEmp = pase.empleados?.departamento || 'MINA'
              const isApprovedMed = (pase.estatus || '').toLowerCase().includes('autoriz') || (pase.estatus || '').toLowerCase().includes('valid')

              return (
                <div
                  key={pase.id_pase}
                  className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-black bg-rose-900 text-white px-2.5 py-0.5 rounded">
                        {pase.folio || 'PASE MÉDICO'}
                      </span>
                      <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded">
                        Parentesco: {pase.pacientes?.parentesco || 'TITULAR'}
                      </span>
                      <span className="text-xs font-bold text-zinc-600">
                        {pase.clinica_origen?.nombre || 'Unidad Bacís'} &rarr;{' '}
                        {pase.clinica_destino?.nombre || 'Clínica Externa'}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-zinc-900 uppercase">
                      Paciente: {pase.pacientes?.nombre_completo || 'Paciente'}{' '}
                      {pase.empleados && (
                        <span className="text-zinc-500 font-bold text-xs">
                          · Trabajador: {pase.empleados.nombre} {pase.empleados.apellido_paterno} ({deptoEmp})
                        </span>
                      )}
                    </h4>
                    <div className="text-xs text-zinc-500">
                      Diagnóstico / Servicio: <strong>{pase.servicio_se_envia || pase.impresion_diagnostica || 'Consulta Especialidad'}</strong> · Estatus:{' '}
                      <strong className="text-zinc-900">{pase.estatus || 'Emitido'}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderLevelButton(
                      'NIVEL_6_MEDICO',
                      levelCapabilities.canMedico,
                      '🩺 Validar Pase Médico (Jefe Médico)',
                      isApprovedMed,
                      `Pase ${pase.estatus}`,
                      () => handlePaseMedicoStatus(pase, 'Autorizado por Jefe Médico'),
                      pase.id_pase
                    )}
                    <Link
                      href="/medico/pases"
                      className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold"
                    >
                      Abrir Módulo Médico &rarr;
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
