'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import {
  Briefcase,
  Award,
  Calendar,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  Printer,
  ChevronRight,
  UserCheck,
  RefreshCw,
  FileText,
  Sparkles,
  ArrowRight,
  ThumbsUp,
  Edit3,
  X,
  Building2,
  HardHat,
  BadgeAlert,
  Plus,
  Layers,
} from 'lucide-react'

export interface TrayectoriaItem {
  id_historial?: string
  id_postulacion?: string | null
  id_vacante?: string | null
  id_empleado?: string | null
  nombre_completo: string
  numero_empleado?: string | null
  departamento_origen?: string | null
  sub_departamento_origen?: string | null
  puesto_origen?: string | null
  departamento_asignado: string
  sub_departamento_asignado?: string | null
  puesto_asignado: string
  fecha_inicio: string
  fecha_fin?: string | null
  dias_acumulados?: number | null
  calificacion?: number | null
  dictamen?: string | null
  comentarios_desempeno?: string | null
  evaluado_por?: string | null
  fecha_evaluacion?: string | null
  activo_en_puesto?: boolean
  source?: 'escalafon' | 'adscripcion' | 'base'
}

export interface MovimientoAutorizadoPendiente {
  id_postulacion: string
  id_vacante: string
  puesto_postulado: string
  departamento_destino: string
  sub_departamento_destino?: string
  fecha_presentacion?: string
  estatus_movimiento: string
  folio_convocatoria?: string
  autorizado_rh_local: boolean
  autorizado_rh_corporativo: boolean
  seleccionado_por_destino: boolean
  respuesta_depto_origen: string
}

interface TrayectoriaMinaHistorialProps {
  idEmpleado?: string | null
  numeroEmpleado?: string | number | null
  nombreEmpleado?: string | null
  puestoActual?: string | null
  departamentoActual?: string | null
  fechaIngreso?: string | null
  canManage?: boolean // Si es RH, Jefe o Administrador para evaluar y calificar
  currentUserRole?: string
  currentUserName?: string
  viewerMode?: 'self' | 'admin'
  compact?: boolean
  onOpenFullView?: () => void
  onPuestoActualizado?: (nuevoPuesto: string, nuevoDepto: string) => void
}

function escapeHtml(text?: string | number | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeCmp(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function TrayectoriaMinaHistorial({
  idEmpleado,
  numeroEmpleado,
  nombreEmpleado,
  puestoActual,
  departamentoActual,
  fechaIngreso,
  canManage = false,
  currentUserRole = '',
  currentUserName = '',
  viewerMode = 'self',
  compact = false,
  onOpenFullView,
  onPuestoActualizado,
}: TrayectoriaMinaHistorialProps) {
  const [loading, setLoading] = useState(true)
  const [historial, setHistorial] = useState<TrayectoriaItem[]>([])
  const [postulacionesActivas, setPostulacionesActivas] = useState<any[]>([])
  const [movimientoPendiente, setMovimientoPendiente] = useState<MovimientoAutorizadoPendiente | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')

  // Modal para Calificar / Evaluar Estancia (RH o Jefes)
  const [evaluatingItem, setEvaluatingItem] = useState<TrayectoriaItem | null>(null)
  const [evalCalificacion, setEvalCalificacion] = useState<number>(9.5)
  const [evalDictamen, setEvalDictamen] = useState<string>('Aprobado Definitivo en el Puesto')
  const [evalComentarios, setEvalComentarios] = useState<string>('')
  const [savingEval, setSavingEval] = useState(false)

  // Modal para Registro Manual de Etapa / Cambio de Puesto (RH / Jefaturas)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [manualForm, setManualForm] = useState({
    puesto_asignado: '',
    departamento_asignado: '',
    sub_departamento_asignado: '',
    puesto_origen: '',
    departamento_origen: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    calificacion: '',
    dictamen: 'Aprobado Definitivo en el Puesto',
    comentarios_desempeno: '',
    aplicarComoVigente: true,
  })

  const validNumEmpleado = useMemo(() => {
    const raw = numeroEmpleado !== null && numeroEmpleado !== undefined ? String(numeroEmpleado).trim() : ''
    if (!raw || raw.toUpperCase() === 'S/N' || raw.toUpperCase() === 'N/D') return ''
    return raw
  }, [numeroEmpleado])

  // Cargar Historial, Adscripciones y Movimientos Autorizados
  const fetchTrayectoriaData = async () => {
    if (!idEmpleado && !validNumEmpleado && !nombreEmpleado) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const orParts: string[] = []
      if (idEmpleado) orParts.push(`id_empleado.eq.${idEmpleado}`)
      if (validNumEmpleado) orParts.push(`numero_empleado.eq.${validNumEmpleado}`)

      // 1. Consultar movimientos_historial_estancia
      let histData: any[] = []
      if (orParts.length > 0) {
        const resById = await supabase
          .from('movimientos_historial_estancia')
          .select('*')
          .or(orParts.join(','))
          .order('fecha_inicio', { ascending: false })
        if (resById.error) {
          console.warn('Error fetching historial por ID:', resById.error.message)
        } else {
          histData = resById.data || []
        }
      }

      // Fallback por nombre si la consulta por IDs no devolvió filas
      if (histData.length === 0 && nombreEmpleado && nombreEmpleado.trim()) {
        const resByName = await supabase
          .from('movimientos_historial_estancia')
          .select('*')
          .ilike('nombre_completo', `%${nombreEmpleado.trim()}%`)
          .order('fecha_inicio', { ascending: false })
        if (!resByName.error && resByName.data) {
          histData = resByName.data
        }
      }

      // 2. Consultar postulaciones en movimientos_postulantes
      const postSelect = `
        id_postulacion, id_vacante, puesto_postulado, departamento_actual, puesto_actual,
        fecha_presentacion, estatus_movimiento, autorizado_rh_local, autorizado_rh_corporativo,
        seleccionado_por_destino, respuesta_depto_origen,
        movimientos_vacantes:id_vacante (
          folio_convocatoria, puesto_vacante, departamento_destino, sub_departamento_destino
        )
      `
      let postData: any[] = []
      if (orParts.length > 0) {
        const pRes = await supabase
          .from('movimientos_postulantes')
          .select(postSelect)
          .or(orParts.join(','))
        if (!pRes.error && pRes.data) {
          postData = pRes.data
        }
      }
      if (postData.length === 0 && nombreEmpleado && nombreEmpleado.trim()) {
        const pNameRes = await supabase
          .from('movimientos_postulantes')
          .select(postSelect)
          .ilike('nombre_completo', `%${nombreEmpleado.trim()}%`)
        if (!pNameRes.error && pNameRes.data) {
          postData = pNameRes.data
        }
      }

      // Guardar postulaciones activas en curso para mostrarlas en la ficha
      const activas = (postData || []).filter(
        (p: any) =>
          p.estatus_movimiento !== 'Movimiento Ejecutado (En Puesto)' &&
          p.estatus_movimiento !== 'No Seleccionado'
      )
      setPostulacionesActivas(activas)

      if (postData && postData.length > 0) {
        const autorizado = postData.find((p: any) => {
          const isAuth =
            p.estatus_movimiento === 'Confirmado para Mover (SÍ)' ||
            p.estatus_movimiento === 'Autorizado para Movimiento' ||
            (p.autorizado_rh_local && p.autorizado_rh_corporativo && p.respuesta_depto_origen === 'Autorizado (Sí)')

          const vacRaw: any = p.movimientos_vacantes
          const vacInfo: any = Array.isArray(vacRaw) ? vacRaw[0] || {} : vacRaw || {}
          const vacPuesto = vacInfo.puesto_vacante || p.puesto_postulado
          const yaEnPuesto =
            (puestoActual || '').trim().toLowerCase() === (vacPuesto || '').trim().toLowerCase()

          return isAuth && !yaEnPuesto
        })

        if (autorizado) {
          const vacRaw: any = autorizado.movimientos_vacantes
          const vac: any = Array.isArray(vacRaw) ? vacRaw[0] || {} : vacRaw || {}
          setMovimientoPendiente({
            id_postulacion: autorizado.id_postulacion,
            id_vacante: autorizado.id_vacante,
            puesto_postulado: vac.puesto_vacante || autorizado.puesto_postulado,
            departamento_destino: vac.departamento_destino || 'Mina',
            sub_departamento_destino: vac.sub_departamento_destino || '',
            fecha_presentacion: autorizado.fecha_presentacion,
            estatus_movimiento: autorizado.estatus_movimiento,
            folio_convocatoria: vac.folio_convocatoria,
            autorizado_rh_local: autorizado.autorizado_rh_local,
            autorizado_rh_corporativo: autorizado.autorizado_rh_corporativo,
            seleccionado_por_destino: autorizado.seleccionado_por_destino,
            respuesta_depto_origen: autorizado.respuesta_depto_origen,
          })
        } else {
          setMovimientoPendiente(null)
        }
      } else {
        setMovimientoPendiente(null)
      }

      // 3. Consultar también adscripciones históricas del expediente (empleado_adscripciones)
      let adscripcionItems: TrayectoriaItem[] = []
      if (idEmpleado) {
        const adsRes = await supabase
          .from('empleado_adscripciones')
          .select(
            'fecha_inicio, fecha_fin, es_jefe, cat_departamentos(departamento), cat_puestos(puesto), cat_unidades_trabajo(unidad_trabajo)'
          )
          .eq('id_empleado', idEmpleado)
          .order('fecha_inicio', { ascending: false })

        if (!adsRes.error && adsRes.data && adsRes.data.length > 0) {
          adscripcionItems = adsRes.data.map((ad: any, idx: number): TrayectoriaItem => {
            const deptRaw: any = Array.isArray(ad.cat_departamentos) ? ad.cat_departamentos[0] : ad.cat_departamentos
            const puestoRaw: any = Array.isArray(ad.cat_puestos) ? ad.cat_puestos[0] : ad.cat_puestos
            const unidadRaw: any = Array.isArray(ad.cat_unidades_trabajo)
              ? ad.cat_unidades_trabajo[0]
              : ad.cat_unidades_trabajo
            const start = ad.fecha_inicio || new Date().toISOString().split('T')[0]
            const end = ad.fecha_fin || null
            const isActive = !end
            return {
              id_historial: `adscripcion-${start}-${idx}`,
              id_empleado: idEmpleado,
              nombre_completo: nombreEmpleado || 'Trabajador',
              numero_empleado: validNumEmpleado || null,
              departamento_asignado: deptRaw?.departamento || departamentoActual || 'Operaciones',
              sub_departamento_asignado: unidadRaw?.unidad_trabajo || undefined,
              puesto_asignado: puestoRaw?.puesto || puestoActual || 'Operativo General',
              fecha_inicio: start,
              fecha_fin: end,
              dias_acumulados: calculateDays(start, end),
              dictamen: isActive ? 'Adscripción Oficial Vigente en Expediente' : 'Adscripción Oficial en Expediente',
              comentarios_desempeno: ad.es_jefe
                ? 'Adscripción registrada en expediente con nombramiento de Jefatura.'
                : 'Adscripción registrada formalmente en el expediente del trabajador.',
              activo_en_puesto: isActive,
              source: 'adscripcion',
            }
          })
        }
      }

      // 4. Unificar historial de escalafón + adscripciones evitando duplicados
      const estanciaItems: TrayectoriaItem[] = (histData || []).map((item: TrayectoriaItem) => ({
        ...item,
        dias_acumulados: item.activo_en_puesto
          ? calculateDays(item.fecha_inicio)
          : item.dias_acumulados || calculateDays(item.fecha_inicio, item.fecha_fin),
        source: 'escalafon',
      }))

      const merged: TrayectoriaItem[] = [...estanciaItems]
      for (const adItem of adscripcionItems) {
        const isDuplicate = estanciaItems.some(
          (e) =>
            normalizeCmp(e.puesto_asignado) === normalizeCmp(adItem.puesto_asignado) &&
            normalizeCmp(e.departamento_asignado) === normalizeCmp(adItem.departamento_asignado) &&
            (e.fecha_inicio || '').slice(0, 10) === (adItem.fecha_inicio || '').slice(0, 10)
        )
        if (!isDuplicate) {
          merged.push(adItem)
        }
      }

      if (merged.length === 0) {
        if (puestoActual || departamentoActual) {
          const baseStart = fechaIngreso || new Date().toISOString().split('T')[0]
          const baseItem: TrayectoriaItem = {
            id_historial: 'current-base',
            nombre_completo: nombreEmpleado || 'Trabajador',
            numero_empleado: validNumEmpleado || null,
            departamento_asignado: departamentoActual || 'Operaciones',
            sub_departamento_asignado: departamentoActual || 'General',
            puesto_asignado: puestoActual || 'Operativo General',
            fecha_inicio: baseStart,
            dias_acumulados: calculateDays(baseStart),
            dictamen: 'Puesto Oficial en Operaciones (C.C.T. Art. 116)',
            calificacion: 10.0,
            evaluado_por: 'Superintendencia de Recursos Humanos',
            comentarios_desempeno: 'Categoría oficial vigente asignada de acuerdo a plantilla y escalafón.',
            activo_en_puesto: true,
            source: 'base',
          }
          setHistorial([baseItem])
        } else {
          setHistorial([])
        }
      } else {
        // Ordenar: primero activo_en_puesto, luego fecha_inicio descendente
        merged.sort((a, b) => {
          const aAct = a.activo_en_puesto ? 1 : 0
          const bAct = b.activo_en_puesto ? 1 : 0
          if (aAct !== bAct) return bAct - aAct
          return new Date(b.fecha_inicio || 0).getTime() - new Date(a.fecha_inicio || 0).getTime()
        })
        setHistorial(merged)
      }
    } catch (e: any) {
      console.error('Error cargando trayectoria:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrayectoriaData()
  }, [idEmpleado, validNumEmpleado, nombreEmpleado, puestoActual, departamentoActual])

  // Calcular días transcurridos
  function calculateDays(startDateStr: string, endDateStr?: string | null): number {
    try {
      const start = new Date(startDateStr).getTime()
      const end = endDateStr ? new Date(endDateStr).getTime() : new Date().getTime()
      const diff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
      return diff
    } catch {
      return 1
    }
  }

  // Sincronizar y actualizar puesto y departamento del trabajador
  const handleSincronizarPuestoOficial = async () => {
    if (!movimientoPendiente) return
    setSyncing(true)
    setSyncSuccessMsg('')

    try {
      const nuevoPuesto = movimientoPendiente.puesto_postulado
      const nuevoDepto = movimientoPendiente.departamento_destino
      const nuevoSubDepto = movimientoPendiente.sub_departamento_destino || nuevoDepto
      const todayStr = new Date().toISOString().split('T')[0]

      // 1. Cerrar etapas activas previas en movimientos_historial_estancia ANTES de insertar la nueva
      if (idEmpleado) {
        await supabase
          .from('movimientos_historial_estancia')
          .update({
            activo_en_puesto: false,
            fecha_fin: todayStr,
          })
          .eq('id_empleado', idEmpleado)
          .eq('activo_en_puesto', true)
      } else if (validNumEmpleado) {
        await supabase
          .from('movimientos_historial_estancia')
          .update({
            activo_en_puesto: false,
            fecha_fin: todayStr,
          })
          .eq('numero_empleado', validNumEmpleado)
          .eq('activo_en_puesto', true)
      }

      // 2. Actualizar tabla empleados
      if (idEmpleado) {
        await supabase
          .from('empleados')
          .update({
            puesto: nuevoPuesto,
            departamento: nuevoDepto,
          })
          .eq('id_empleado', idEmpleado)
      } else if (validNumEmpleado) {
        await supabase
          .from('empleados')
          .update({
            puesto: nuevoPuesto,
            departamento: nuevoDepto,
          })
          .eq('numero_empleado', validNumEmpleado)
      }

      // 3. Marcar postulación como ejecutada en puesto
      await supabase
        .from('movimientos_postulantes')
        .update({
          estatus_movimiento: 'Movimiento Ejecutado (En Puesto)',
          fecha_ejecucion_movimiento: new Date().toISOString(),
        })
        .eq('id_postulacion', movimientoPendiente.id_postulacion)

      // 4. Insertar nuevo puesto activo en movimientos_historial_estancia
      await supabase.from('movimientos_historial_estancia').insert([
        {
          id_postulacion: movimientoPendiente.id_postulacion,
          id_vacante: movimientoPendiente.id_vacante,
          id_empleado: idEmpleado || null,
          nombre_completo: nombreEmpleado || 'Trabajador',
          numero_empleado: validNumEmpleado || null,
          departamento_origen: departamentoActual || 'General',
          puesto_origen: puestoActual || 'Operativo',
          departamento_asignado: nuevoDepto,
          sub_departamento_asignado: nuevoSubDepto,
          puesto_asignado: nuevoPuesto,
          fecha_inicio: movimientoPendiente.fecha_presentacion || todayStr,
          dias_acumulados: 1,
          dictamen: 'En Periodo de Prueba / Capacitación',
          activo_en_puesto: true,
          evaluado_por: currentUserName || 'Jefatura de Operaciones',
          comentarios_desempeno: `Movimiento y ascenso oficial autorizado por escalafón sindical (Convocatoria: ${movimientoPendiente.folio_convocatoria || 'S/F'}).`,
        },
      ])

      // 5. Notificar éxito
      setSyncSuccessMsg(
        viewerMode === 'admin'
          ? `🎉 ¡Expediente actualizado con éxito! ${nombreEmpleado || 'El trabajador'} quedó registrado oficialmente como "${nuevoPuesto}" en "${nuevoDepto}".`
          : `🎉 ¡Puesto y Departamento oficial actualizados con éxito! Ahora estás registrado formalmente como "${nuevoPuesto}" en el departamento de "${nuevoDepto}".`
      )
      setMovimientoPendiente(null)

      if (onPuestoActualizado) {
        onPuestoActualizado(nuevoPuesto, nuevoDepto)
      }

      await fetchTrayectoriaData()
    } catch (err: any) {
      alert('Error sincronizando puesto: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  // Guardar Evaluación / Calificación de Estancia (Jefaturas / RH)
  const handleGuardarEvaluacion = async () => {
    if (!evaluatingItem || !evaluatingItem.id_historial) return
    setSavingEval(true)

    try {
      const todayStr = new Date().toISOString()
      const endDay = evaluatingItem.fecha_fin || new Date().toISOString().split('T')[0]
      const dias = calculateDays(evaluatingItem.fecha_inicio, endDay)

      const isVirtualRecord =
        evaluatingItem.id_historial === 'current-base' ||
        evaluatingItem.id_historial.startsWith('adscripcion-')

      if (isVirtualRecord) {
        // Insertar por primera vez en movimientos_historial_estancia
        await supabase.from('movimientos_historial_estancia').insert([
          {
            id_empleado: idEmpleado || null,
            nombre_completo: nombreEmpleado || 'Trabajador',
            numero_empleado: validNumEmpleado || null,
            departamento_asignado: evaluatingItem.departamento_asignado,
            sub_departamento_asignado: evaluatingItem.sub_departamento_asignado,
            puesto_asignado: evaluatingItem.puesto_asignado,
            fecha_inicio: evaluatingItem.fecha_inicio,
            fecha_fin: evaluatingItem.fecha_fin || null,
            dias_acumulados: dias,
            calificacion: evalCalificacion,
            dictamen: evalDictamen,
            comentarios_desempeno: evalComentarios,
            evaluado_por: currentUserName || 'Jefe de Departamento / RH',
            fecha_evaluacion: todayStr,
            activo_en_puesto:
              evaluatingItem.activo_en_puesto !== false && evalDictamen !== 'Regresado a Puesto Anterior',
          },
        ])
      } else {
        await supabase
          .from('movimientos_historial_estancia')
          .update({
            calificacion: evalCalificacion,
            dictamen: evalDictamen,
            comentarios_desempeno: evalComentarios,
            evaluado_por: currentUserName || 'Jefe de Departamento / RH',
            fecha_evaluacion: todayStr,
            activo_en_puesto: evalDictamen !== 'Regresado a Puesto Anterior',
          })
          .eq('id_historial', evaluatingItem.id_historial)
      }

      setEvaluatingItem(null)
      await fetchTrayectoriaData()
      alert('✅ Calificación y dictamen de desempeño guardados exitosamente.')
    } catch (e: any) {
      alert('Error guardando calificación: ' + e.message)
    } finally {
      setSavingEval(false)
    }
  }

  // Abrir modal de registro manual de etapa
  const handleOpenManualModal = () => {
    setManualForm({
      puesto_asignado: '',
      departamento_asignado: departamentoActual || '',
      sub_departamento_asignado: '',
      puesto_origen: puestoActual || '',
      departamento_origen: departamentoActual || '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      calificacion: '',
      dictamen: 'Aprobado Definitivo en el Puesto',
      comentarios_desempeno: '',
      aplicarComoVigente: true,
    })
    setIsManualModalOpen(true)
  }

  // Guardar registro manual de etapa / cambio de puesto
  const handleSaveManualStage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualForm.puesto_asignado.trim() || !manualForm.departamento_asignado.trim()) {
      alert('Favor de capturar el Puesto Asignado y el Departamento Asignado.')
      return
    }
    setSavingManual(true)

    try {
      const nuevoPuesto = manualForm.puesto_asignado.trim().toUpperCase()
      const nuevoDepto = manualForm.departamento_asignado.trim().toUpperCase()
      const subDepto = manualForm.sub_departamento_asignado.trim() || nuevoDepto
      const fechaInicio = manualForm.fecha_inicio || new Date().toISOString().split('T')[0]
      const fechaFin = manualForm.fecha_fin || null
      const isVigente = manualForm.aplicarComoVigente && !fechaFin

      // Si aplica como vigente, cerrar etapas activas previas ANTES de insertar
      if (isVigente) {
        if (idEmpleado) {
          await supabase
            .from('movimientos_historial_estancia')
            .update({
              activo_en_puesto: false,
              fecha_fin: fechaInicio,
            })
            .eq('id_empleado', idEmpleado)
            .eq('activo_en_puesto', true)
        } else if (validNumEmpleado) {
          await supabase
            .from('movimientos_historial_estancia')
            .update({
              activo_en_puesto: false,
              fecha_fin: fechaInicio,
            })
            .eq('numero_empleado', validNumEmpleado)
            .eq('activo_en_puesto', true)
        }
      }

      const calNum = manualForm.calificacion !== '' ? Number(manualForm.calificacion) : null
      const dias = calculateDays(fechaInicio, fechaFin)

      const { error: insErr } = await supabase.from('movimientos_historial_estancia').insert([
        {
          id_empleado: idEmpleado || null,
          nombre_completo: nombreEmpleado || 'Trabajador',
          numero_empleado: validNumEmpleado || null,
          departamento_origen: manualForm.departamento_origen || departamentoActual || null,
          puesto_origen: manualForm.puesto_origen || puestoActual || null,
          departamento_asignado: nuevoDepto,
          sub_departamento_asignado: subDepto,
          puesto_asignado: nuevoPuesto,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          dias_acumulados: dias,
          calificacion: calNum !== null && !isNaN(calNum) ? calNum : null,
          dictamen: manualForm.dictamen || 'Aprobado Definitivo en el Puesto',
          comentarios_desempeno:
            manualForm.comentarios_desempeno ||
            `Etapa registrada directamente por ${currentUserName || 'Recursos Humanos'}.`,
          evaluado_por: currentUserName || 'Recursos Humanos / Jefatura',
          fecha_evaluacion: calNum !== null && !isNaN(calNum) ? new Date().toISOString() : null,
          activo_en_puesto: isVigente,
        },
      ])
      if (insErr) throw insErr

      if (isVigente) {
        if (idEmpleado) {
          await supabase
            .from('empleados')
            .update({ puesto: nuevoPuesto, departamento: nuevoDepto })
            .eq('id_empleado', idEmpleado)
        } else if (validNumEmpleado) {
          await supabase
            .from('empleados')
            .update({ puesto: nuevoPuesto, departamento: nuevoDepto })
            .eq('numero_empleado', validNumEmpleado)
        }
        onPuestoActualizado?.(nuevoPuesto, nuevoDepto)
      }

      setIsManualModalOpen(false)
      await fetchTrayectoriaData()
      setSyncSuccessMsg(
        `✅ Etapa "${nuevoPuesto}" (${nuevoDepto}) registrada correctamente en la trayectoria de ${nombreEmpleado || 'este trabajador'}.`
      )
    } catch (err: any) {
      alert('Error registrando etapa en trayectoria: ' + err.message)
    } finally {
      setSavingManual(false)
    }
  }

  // Abrir modal de evaluación
  const handleOpenEvalModal = (item: TrayectoriaItem) => {
    setEvaluatingItem(item)
    setEvalCalificacion(Number(item.calificacion || 9.5))
    setEvalDictamen(item.dictamen || 'Aprobado Definitivo en el Puesto')
    setEvalComentarios(item.comentarios_desempeno || '')
  }

  // Formato de estrellas de calificación
  const renderStars = (score?: number | null) => {
    if (!score && score !== 0) return <span className="text-zinc-400 text-xs italic">Pendiente de evaluar</span>
    const filled = Math.min(5, Math.max(1, Math.round(score / 2)))
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${
              s <= filled ? 'text-amber-500 fill-amber-500' : 'text-zinc-300 dark:text-zinc-600'
            }`}
          />
        ))}
        <span className="text-xs font-black text-amber-600 dark:text-amber-400 ml-1">
          {Number(score).toFixed(1)} / 10
        </span>
      </div>
    )
  }

  // Badge del Dictamen
  const getDictamenBadge = (dictamen?: string | null) => {
    const d = (dictamen || '').toLowerCase()
    if (d.includes('aprobado') || d.includes('oficial') || d.includes('definitivo') || d.includes('adscripci')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5" />
          {dictamen || 'Aprobado Definitivo'}
        </span>
      )
    }
    if (d.includes('prueba') || d.includes('capacitaci')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5" />
          {dictamen || 'En Periodo de Prueba'}
        </span>
      )
    }
    if (d.includes('promovido') || d.includes('ascenso')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          <TrendingUp className="w-3.5 h-3.5" />
          {dictamen || 'Promovido a Siguiente Categoría'}
        </span>
      )
    }
    if (d.includes('regresado') || d.includes('no aprobo')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <BadgeAlert className="w-3.5 h-3.5" />
          {dictamen || 'Regresado a Puesto Anterior'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
        {dictamen || 'Registrado'}
      </span>
    )
  }

  // Imprimir Constancia Oficial de Trayectoria en ventana limpia membretada
  const handlePrintConstancia = () => {
    const win = window.open('', '_blank', 'width=940,height=780')
    if (!win) {
      window.print()
      return
    }

    const totalDays = calculateDays(
      fechaIngreso || (historial[historial.length - 1]?.fecha_inicio ?? new Date().toISOString().split('T')[0])
    )
    const fechaEmision = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const rowsHtml =
      historial.length > 0
        ? historial
            .map(
              (h, idx) => `
          <tr>
            <td style="text-align:center;font-weight:bold;">${historial.length - idx}</td>
            <td>
              <strong>${escapeHtml(h.puesto_asignado)}</strong>
              ${h.activo_en_puesto ? '<br/><span style="color:#047857;font-size:10px;font-weight:bold;">● VIGENTE</span>' : ''}
              ${h.puesto_origen ? `<br/><span style="color:#52525b;font-size:10px;">Anterior: ${escapeHtml(h.puesto_origen)}</span>` : ''}
            </td>
            <td>
              <strong>${escapeHtml(h.departamento_asignado)}</strong>
              ${
                h.sub_departamento_asignado && h.sub_departamento_asignado !== h.departamento_asignado
                  ? `<br/><span style="color:#52525b;font-size:10px;">${escapeHtml(h.sub_departamento_asignado)}</span>`
                  : ''
              }
            </td>
            <td>
              Inicio: ${escapeHtml(h.fecha_inicio)}<br/>
              Fin: ${h.fecha_fin ? escapeHtml(h.fecha_fin) : '<em>A la fecha</em>'}
            </td>
            <td style="text-align:center;font-weight:bold;">${escapeHtml(h.dias_acumulados || 1)} d</td>
            <td style="text-align:center;font-weight:bold;">${
              h.calificacion !== null && h.calificacion !== undefined
                ? `${Number(h.calificacion).toFixed(1)} / 10`
                : 'Pendiente'
            }</td>
            <td>
              <strong>${escapeHtml(h.dictamen || 'Registrado')}</strong>
              ${h.comentarios_desempeno ? `<br/><span style="color:#3f3f46;font-size:10px;">"${escapeHtml(h.comentarios_desempeno)}"</span>` : ''}
              ${h.evaluado_por ? `<br/><span style="color:#71717a;font-size:9px;">Evaluó: ${escapeHtml(h.evaluado_por)}</span>` : ''}
            </td>
          </tr>
        `
            )
            .join('')
        : `<tr><td colspan="7" style="text-align:center;padding:18px;color:#71717a;">Sin movimientos registrados en historial.</td></tr>`

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Constancia de Trayectoria Laboral — ${escapeHtml(nombreEmpleado || 'Trabajador')}</title>
  <style>
    @page { size: letter portrait; margin: 14mm; }
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; padding: 20px; color: #18181b; background: #fff; font-size: 12px; }
    .header { border-bottom: 3px solid #18181b; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand-title { font-size: 17px; font-weight: 900; letter-spacing: 0.4px; margin: 0; }
    .brand-sub { font-size: 11px; font-weight: 700; color: #b45309; margin: 3px 0 0; }
    .doc-badge { background: #18181b; color: #fbbf24; padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f4f4f5; border: 1px solid #d4d4d8; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
    .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #71717a; display: block; margin-bottom: 2px; }
    .info-val { font-size: 12px; font-weight: 800; color: #09090b; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #18181b; color: #fff; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; }
    td { border: 1px solid #d4d4d8; padding: 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .signatures { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sig-box { border-top: 1px solid #18181b; padding-top: 6px; text-align: center; font-size: 11px; font-weight: 700; }
    .footer-note { margin-top: 24px; font-size: 10px; color: #71717a; text-align: center; border-top: 1px dashed #d4d4d8; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">GRUPO MINERO BACÍS S.A. DE C.V.</h1>
      <p class="brand-sub">UNIDAD MINERA EL HERRERO · CONSTANCIA DE TRAYECTORIA LABORAL (C.C.T. ART. 116)</p>
    </div>
    <div class="doc-badge">Registro Oficial RH</div>
  </div>

  <div class="info-grid">
    <div>
      <span class="info-label">Trabajador</span>
      <span class="info-val">${escapeHtml(nombreEmpleado || 'Trabajador')}</span>
    </div>
    <div>
      <span class="info-label">Ficha / No. Empleado</span>
      <span class="info-val">#${escapeHtml(validNumEmpleado || 'S/N')}</span>
    </div>
    <div>
      <span class="info-label">Fecha de Emisión</span>
      <span class="info-val">${escapeHtml(fechaEmision)}</span>
    </div>
    <div>
      <span class="info-label">Puesto Oficial Vigente</span>
      <span class="info-val">${escapeHtml(puestoActual || 'Sin categoría asignada')}</span>
    </div>
    <div>
      <span class="info-label">Departamento Actual</span>
      <span class="info-val">${escapeHtml(departamentoActual || 'Sin departamento')}</span>
    </div>
    <div>
      <span class="info-label">Antigüedad / Días Totales</span>
      <span class="info-val">${escapeHtml(totalDays)} días acumulados</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:32px;text-align:center;">#</th>
        <th>Puesto / Categoría</th>
        <th>Departamento</th>
        <th>Periodo</th>
        <th style="width:52px;text-align:center;">Días</th>
        <th style="width:74px;text-align:center;">Calif.</th>
        <th>Dictamen y Observaciones</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      Recursos Humanos — Unidad El Herrero<br/>
      <span style="font-weight:normal;font-size:10px;color:#52525b;">Vo.Bo. Expediente y Escalafón</span>
    </div>
    <div class="sig-box">
      Jefatura de Departamento / Superintendencia<br/>
      <span style="font-weight:normal;font-size:10px;color:#52525b;">Validación Operativa en Mina</span>
    </div>
  </div>

  <div class="footer-note">
    Documento generado automáticamente desde el Centro Integrado RH · Grupo Minero Bacís S.A. de C.V.
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
  </script>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const latestScore = useMemo(() => {
    const scored = historial.find((h) => h.calificacion !== null && h.calificacion !== undefined)
    return scored ? scored.calificacion : null
  }, [historial])

  const displayedHistorial = compact ? historial.slice(0, 3) : historial

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. TARJETA DE NOTIFICACIÓN DE ASCENSO / MOVIMIENTO PENDIENTE          */}
      {/* ===================================================================== */}
      {movimientoPendiente && (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 border-2 border-amber-500/40 dark:border-amber-400/40 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-zinc-950 shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  🎉 Ascenso / Movimiento Sindical Autorizado
                </span>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  {viewerMode === 'admin' ? (
                    <>
                      Movimiento autorizado listo para aplicar a{' '}
                      <span className="text-amber-600 dark:text-amber-400 underline decoration-amber-500">
                        {nombreEmpleado || 'este trabajador'}
                      </span>{' '}
                      ({movimientoPendiente.puesto_postulado})
                    </>
                  ) : (
                    <>
                      ¡Tienes la categoría de{' '}
                      <span className="text-amber-600 dark:text-amber-400 underline decoration-amber-500">
                        {movimientoPendiente.puesto_postulado}
                      </span>{' '}
                      autorizada por RH y Jefaturas!
                    </>
                  )}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                  Departamento Asignado:{' '}
                  <strong>{movimientoPendiente.departamento_destino}</strong>{' '}
                  {movimientoPendiente.sub_departamento_destino &&
                    `· Sub-área: ${movimientoPendiente.sub_departamento_destino}`}
                  . Convocatoria: <strong>{movimientoPendiente.folio_convocatoria || 'Oficial'}</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSincronizarPuestoOficial}
              disabled={syncing}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer shrink-0"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {viewerMode === 'admin'
                      ? '🔄 Aplicar Cambio de Puesto y Depto al Expediente'
                      : '🔄 Actualizar mi Puesto y Depto en Mi Perfil'}
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-500/20 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                RH Unidad: <strong>Autorizado</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                RH Corporativo: <strong>Autorizado</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Depto Vacante: <strong>Aceptado</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Depto Origen: <strong>Liberado (SÍ)</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {syncSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. ENCABEZADO DE TRAYECTORIA EN MINA & RESUMEN DE PUESTO VIGENTE      */}
      {/* ===================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white uppercase tracking-tight">
                  Trayectoria en Mina · Historial de Categorías y Escalafón
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase tracking-widest border border-zinc-200 dark:border-zinc-700">
                  C.C.T. Art. 116
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Registro histórico de puestos, adscripciones, días de estancia acumulados, departamentos y calificaciones otorgadas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canManage && !compact && (
              <button
                type="button"
                onClick={handleOpenManualModal}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Etapa / Cambio</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchTrayectoriaData}
              disabled={loading}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Recargar trayectoria"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {!compact && (
              <button
                type="button"
                onClick={handlePrintConstancia}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Constancia Laboral</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumen Puesto Vigente / Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Puesto Oficial Actual
            </span>
            <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 mt-0.5">
              <Briefcase className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{puestoActual || 'Sin categoría asignada'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Departamento Asignado
            </span>
            <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{departamentoActual || 'Sin departamento'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Antigüedad / Días en Operación
            </span>
            <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                {calculateDays(
                  fechaIngreso || (historial[historial.length - 1]?.fecha_inicio ?? new Date().toISOString().split('T')[0])
                )}{' '}
                días acumulados
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Etapas &amp; Última Calificación
            </span>
            <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 mt-0.5">
              <Award className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {historial.length} {historial.length === 1 ? 'etapa' : 'etapas'}
                {latestScore !== null ? ` · ⭐ ${Number(latestScore).toFixed(1)}/10` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Trámites de Escalafón en Curso (Postulaciones activas) */}
        {postulacionesActivas.length > 0 && (
          <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-blue-900 dark:text-blue-200 uppercase">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Movimientos / Postulaciones de Escalafón en Trámite ({postulacionesActivas.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {postulacionesActivas.map((p: any) => {
                const vacRaw: any = p.movimientos_vacantes
                const vac: any = Array.isArray(vacRaw) ? vacRaw[0] || {} : vacRaw || {}
                return (
                  <div
                    key={p.id_postulacion}
                    className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-blue-200/80 dark:border-blue-800 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-black text-zinc-900 dark:text-white">
                        {vac.puesto_vacante || p.puesto_postulado}
                        {vac.departamento_destino ? ` (${vac.departamento_destino})` : ''}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Convocatoria {vac.folio_convocatoria || 'S/F'} · Origen: {p.departamento_actual}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                      {p.estatus_movimiento}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 3. LÍNEA DE TIEMPO INTERACTIVA (HISTORIAL DE ESTANCIA)                */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Cargando trayectoria laboral...</span>
          </div>
        ) : displayedHistorial.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
            <Briefcase className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              No hay movimientos históricos registrados aún
            </p>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Cuando el trabajador participe en una convocatoria de escalafón sindical, se ejecute un movimiento en el tablero de ajedrez o RH registre una etapa, su historial y calificaciones aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-amber-500 before:via-zinc-300 dark:before:via-zinc-700 before:to-zinc-200">
            {displayedHistorial.map((item, idx) => {
              const isCurrent = Boolean(item.activo_en_puesto)
              return (
                <div
                  key={item.id_historial || idx}
                  className={`relative p-5 sm:p-6 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-br from-amber-500/5 via-white dark:via-zinc-900 to-emerald-500/5 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-300'
                  }`}
                >
                  {/* Nodo con icono en la línea de tiempo */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-6 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${
                      isCurrent
                        ? 'bg-amber-500 border-zinc-900 text-zinc-950 shadow-sm'
                        : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {isCurrent ? '★' : historial.length - idx}
                  </div>

                  <div className="space-y-4">
                    {/* Fila 1: Puesto, Dictamen y Badge Activo */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                          {item.puesto_asignado}
                        </span>
                        {isCurrent && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-zinc-950 shadow-xs">
                            ● Puesto Oficial Vigente
                          </span>
                        )}
                        {getDictamenBadge(item.dictamen)}
                      </div>

                      {/* Calificación en Estrellas */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {renderStars(item.calificacion)}
                      </div>
                    </div>

                    {/* Fila 2: Departamentos y Trayecto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/60 dark:border-zinc-800/60 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Departamento Asignado
                        </span>
                        <div className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>{item.departamento_asignado}</span>
                          {item.sub_departamento_asignado && item.sub_departamento_asignado !== item.departamento_asignado && (
                            <span className="text-zinc-400 font-normal">
                              ({item.sub_departamento_asignado})
                            </span>
                          )}
                        </div>
                      </div>

                      {item.puesto_origen && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            Puesto y Departamento Anterior
                          </span>
                          <div className="font-medium text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                            <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                            <span>
                              {item.puesto_origen} ({item.departamento_origen || 'Área previa'})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fila 3: Fechas, Días de Estancia y Evaluador */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>
                            Desde:{' '}
                            <strong className="text-zinc-800 dark:text-zinc-200">
                              {item.fecha_inicio}
                            </strong>
                          </span>
                          {item.fecha_fin ? (
                            <span>
                              · Hasta:{' '}
                              <strong className="text-zinc-800 dark:text-zinc-200">
                                {item.fecha_fin}
                              </strong>
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              · A la fecha
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            Estancia:{' '}
                            <strong className="text-zinc-900 dark:text-white">
                              {item.dias_acumulados || 1} días acumulados
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Botón para Calificar si es Jefe o RH */}
                      {canManage && !compact && (
                        <button
                          type="button"
                          onClick={() => handleOpenEvalModal(item)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>
                            {item.calificacion !== null && item.calificacion !== undefined
                              ? 'Modificar Calificación / Dictamen'
                              : '⭐ Calificar Desempeño'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Fila 4: Observaciones Técnicas y Comentarios del Evaluador */}
                    {item.comentarios_desempeno && (
                      <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-500" />
                            Dictamen y Observaciones de Jefatura:
                          </span>
                          {item.evaluado_por && (
                            <span className="font-normal text-zinc-500">
                              Evaluado por: <strong>{item.evaluado_por}</strong>
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300 italic">
                          "{item.comentarios_desempeno}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Botón para abrir la vista completa en modo compacto */}
        {compact && onOpenFullView && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onOpenFullView}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-colors cursor-pointer"
            >
              <span>Ver Trayectoria Completa, Calificar o Registrar Movimiento</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 4. MODAL PARA CALIFICAR Y ASIGNAR DICTAMEN (RH / JEFATURA)            */}
      {/* ===================================================================== */}
      {evaluatingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-black text-base uppercase">
                  Evaluar Desempeño en {evaluatingItem.puesto_asignado}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Departamento: {evaluatingItem.departamento_asignado} · Trabajador: {nombreEmpleado}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingItem(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 block mb-1">
                  Calificación de Desempeño (1.0 a 10.0)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={evalCalificacion}
                    onChange={(e) => setEvalCalificacion(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-mono font-black text-base px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {evalCalificacion.toFixed(1)} / 10
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 block mb-1">
                  Dictamen Oficial del Departamento
                </label>
                <select
                  value={evalDictamen}
                  onChange={(e) => setEvalDictamen(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                >
                  <option value="Aprobado Definitivo en el Puesto">
                    ✅ Aprobado Definitivo en el Puesto (Pasa a Escalafón Oficial)
                  </option>
                  <option value="En Periodo de Prueba / Capacitación">
                    ⏳ En Periodo de Prueba / Capacitación (Continúa Evaluación)
                  </option>
                  <option value="Promovido a Siguiente Categoría">
                    🚀 Promovido a Siguiente Categoría (Ascenso Inmediato)
                  </option>
                  <option value="Regresado a Puesto Anterior">
                    🛑 Regresado a Puesto Anterior (No Aprobó Periodo de Prueba)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 block mb-1">
                  Observaciones Técnicas / Comentarios de Desempeño
                </label>
                <textarea
                  rows={3}
                  value={evalComentarios}
                  onChange={(e) => setEvalComentarios(e.target.value)}
                  placeholder="Ej: Destreza destacada en equipo de barrenación, apego a normas de seguridad en interior mina y cumplimiento puntual de turnos..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEvaluatingItem(null)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarEvaluacion}
                disabled={savingEval}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                {savingEval ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Guardar Calificación y Dictamen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MODAL PARA REGISTRAR ETAPA MANUAL / CAMBIO DE PUESTO (RH / JEFES)  */}
      {/* ===================================================================== */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveManualStage}
            className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-black text-base uppercase">
                  Registrar Etapa / Cambio de Puesto en Mina
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Trabajador: {nombreEmpleado || 'Trabajador'} {validNumEmpleado ? `(Ficha #${validNumEmpleado})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Nuevo Puesto / Categoría *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: PERFORISTA 1RA"
                  value={manualForm.puesto_asignado}
                  onChange={(e) => setManualForm({ ...manualForm, puesto_asignado: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Departamento Asignado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: MINA / PLANTA DE BENEFICIO"
                  value={manualForm.departamento_asignado}
                  onChange={(e) => setManualForm({ ...manualForm, departamento_asignado: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Sub-departamento / Área (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Perforación y Voladura"
                  value={manualForm.sub_departamento_asignado}
                  onChange={(e) => setManualForm({ ...manualForm, sub_departamento_asignado: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Puesto Anterior / Origen
                </label>
                <input
                  type="text"
                  placeholder="Ej: Ayudante de Perforista"
                  value={manualForm.puesto_origen}
                  onChange={(e) => setManualForm({ ...manualForm, puesto_origen: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Departamento Anterior / Origen
                </label>
                <input
                  type="text"
                  placeholder="Ej: Planta de Beneficio"
                  value={manualForm.departamento_origen}
                  onChange={(e) => setManualForm({ ...manualForm, departamento_origen: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  required
                  value={manualForm.fecha_inicio}
                  onChange={(e) => setManualForm({ ...manualForm, fecha_inicio: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Fecha Fin (Dejar vacío si es vigente)
                </label>
                <input
                  type="date"
                  value={manualForm.fecha_fin}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      fecha_fin: e.target.value,
                      aplicarComoVigente: e.target.value ? false : manualForm.aplicarComoVigente,
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Calificación (Opcional, 1.0 a 10.0)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  placeholder="Ej: 9.5"
                  value={manualForm.calificacion}
                  onChange={(e) => setManualForm({ ...manualForm, calificacion: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Dictamen Oficial
                </label>
                <select
                  value={manualForm.dictamen}
                  onChange={(e) => setManualForm({ ...manualForm, dictamen: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                >
                  <option value="Aprobado Definitivo en el Puesto">
                    ✅ Aprobado Definitivo en el Puesto
                  </option>
                  <option value="En Periodo de Prueba / Capacitación">
                    ⏳ En Periodo de Prueba / Capacitación
                  </option>
                  <option value="Promovido a Siguiente Categoría">
                    🚀 Promovido a Siguiente Categoría
                  </option>
                  <option value="Regresado a Puesto Anterior">
                    🛑 Regresado a Puesto Anterior
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold uppercase text-zinc-500 block mb-1">
                  Comentarios de Desempeño / Motivo del Movimiento
                </label>
                <textarea
                  rows={2}
                  value={manualForm.comentarios_desempeno}
                  onChange={(e) => setManualForm({ ...manualForm, comentarios_desempeno: e.target.value })}
                  placeholder="Observaciones operativas, número de oficio o capacitación acreditada..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>

              {!manualForm.fecha_fin && (
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <input
                      type="checkbox"
                      checked={manualForm.aplicarComoVigente}
                      onChange={(e) => setManualForm({ ...manualForm, aplicarComoVigente: e.target.checked })}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>Aplicar como puesto y departamento vigente actual del trabajador (actualiza su expediente)</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                {savingManual ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Guardar Etapa en Trayectoria</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
