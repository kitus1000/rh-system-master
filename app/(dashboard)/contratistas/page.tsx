'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  HardHat,
  Building2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Send,
  FileText,
  Eye,
  QrCode,
  Download,
  ShieldCheck,
  Bed,
  Users,
  CalendarPlus,
  UserPlus,
  LogIn,
  LogOut,
  AlertTriangle,
  RefreshCw,
  X,
  KeyRound,
} from 'lucide-react'
import {
  getDocLabel,
  isSchemaMissingError,
  formatShortDate,
  diffDaysInclusive,
} from '@/utils/contratistasConfig'
import { areDepartmentsEquivalent } from '@/utils/dataNormalization'
import {
  generateContractorCredentialPDF,
  BADGE_SIZE_OPTIONS,
  BadgeSizeFormat,
} from '@/utils/contratistaBadgePdf'

export default function ContratistasAdminPage() {
  const { user, profile, testLevelId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'empresas' | 'documentos' | 'prorrogas' | 'bitacora'>('solicitudes')
  const [badgeSizeFormat, setBadgeSizeFormat] = useState<BadgeSizeFormat>('gafete_medio')
  const [rhCorpMap, setRhCorpMap] = useState<Record<string, { approved: boolean; por: string; fecha: string }>>({})

  const [empresas, setEmpresas] = useState<any[]>([])
  const [personalAll, setPersonalAll] = useState<any[]>([])
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [credenciales, setCredenciales] = useState<any[]>([])
  const [prorrogas, setProrrogas] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])

  // Direct Pass / Request Creation Modal (RH)
  const [showDirectPassModal, setShowDirectPassModal] = useState(false)
  const [directPassForm, setDirectPassForm] = useState({
    id_empresa: '',
    id_departamento_objetivo: '',
    descripcion_servicio: 'Servicios en Mina / Mantenimiento',
    area_trabajo: 'Planta / Mina',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    requiere_campamento: false,
    requiere_comedor: true,
    emitir_inmediato: true,
    selectedPersonalIds: [] as string[],
  })
  const [savingDirectPass, setSavingDirectPass] = useState(false)

  // Create Company + User Modal
  const [showCreateEmpresa, setShowCreateEmpresa] = useState(false)
  const [empresaForm, setEmpresaForm] = useState({
    razon_social: '',
    nombre_comercial: '',
    rfc: '',
    representante_legal: '',
    telefono: '',
    correo: '',
    especialidad: '',
    crear_usuario: true,
    password_usuario: 'Contratista2026!',
  })
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  // Chat Modal
  const [chatSolicitud, setChatSolicitud] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')

  // Preview Doc Modal
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [reviewComment, setReviewComment] = useState('')

  // Issuing Credentials
  const [issuingId, setIssuingId] = useState<string | null>(null)
  const [credentialsReady, setCredentialsReady] = useState<{
    razon_social: string
    email: string
    password: string
    telefono?: string
    emailAutoSent: boolean
  } | null>(null)

  const rolLower = (profile?.rol || '').toLowerCase()
  const isTestMode = testLevelId !== 'REAL_SESSION'
  const isRHOrAdmin =
    isTestMode ||
    rolLower.includes('admin') ||
    rolLower.includes('recursos') ||
    rolLower.includes('rh unidad') ||
    rolLower.includes('corporativo') ||
    rolLower.includes('sistemas') ||
    rolLower.includes('superintendente')
  const isRHCorporativo = isTestMode || isRHOrAdmin || rolLower.includes('corporativo')
  const isSeguridad = isTestMode || isRHOrAdmin || rolLower.includes('seguridad')
  const isCampamento = isTestMode || isRHOrAdmin || rolLower.includes('campamento') || rolLower.includes('comedor')
  const isJefeDepto = isTestMode || isRHOrAdmin || rolLower.includes('jefe')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bacis_contratistas_rh_corp_approvals')
      if (saved) setRhCorpMap(JSON.parse(saved))
    } catch {}
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { data: empData, error: empErr } = await supabase
        .from('contratistas_empresas')
        .select('*')
        .order('creado_el', { ascending: false })

      if (empErr) {
        if (isSchemaMissingError(empErr)) setSchemaMissing(true)
        setLoading(false)
        return
      }

      const [solRes, docRes, credRes, prorRes, movRes, persRes, deptRes, corpMsgsRes] = await Promise.all([
        supabase
          .from('contratistas_solicitudes')
          .select('*, contratistas_empresas(*), contratistas_solicitud_personal(*, contratistas_personal(*))')
          .order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_documentos')
          .select('*, contratistas_empresas(razon_social), contratistas_personal(nombre, apellido_paterno, nss)')
          .order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_credenciales')
          .select('*, contratistas_empresas(razon_social, rfc), contratistas_personal(*), contratistas_solicitudes(folio, departamento_nombre, area_trabajo)')
          .order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_prorrogas')
          .select('*, contratistas_empresas(razon_social), contratistas_solicitudes(folio, departamento_nombre)')
          .order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_movimientos_bitacora')
          .select('*, contratistas_empresas(razon_social), contratistas_personal(nombre, apellido_paterno), contratistas_credenciales(codigo_qr)')
          .order('fecha_hora', { ascending: false })
          .limit(50),
        supabase
          .from('contratistas_personal')
          .select('*')
          .order('nombre'),
        supabase
          .from('cat_departamentos')
          .select('*')
          .eq('activo', true)
          .order('departamento'),
        supabase
          .from('contratistas_mensajes')
          .select('id_solicitud, remitente_nombre, creado_el')
          .ilike('mensaje', '%[VOBO_RH_CORPORATIVO]%')
          .order('creado_el', { ascending: false })
          .limit(100),
      ])

      const nextCorpMap: Record<string, { approved: boolean; por: string; fecha: string }> = {
        ...JSON.parse(localStorage.getItem('bacis_contratistas_rh_corp_approvals') || '{}'),
      }
      for (const m of corpMsgsRes.data || []) {
        if (m.id_solicitud && !nextCorpMap[m.id_solicitud]) {
          nextCorpMap[m.id_solicitud] = {
            approved: true,
            por: m.remitente_nombre || 'Supt. RH Corporativo',
            fecha: m.creado_el || new Date().toISOString(),
          }
        }
      }
      setRhCorpMap(nextCorpMap)
      localStorage.setItem('bacis_contratistas_rh_corp_approvals', JSON.stringify(nextCorpMap))

      setEmpresas(empData || [])
      setSolicitudes(solRes.data || [])
      setDocumentos(docRes.data || [])
      setCredenciales(credRes.data || [])
      setProrrogas(prorRes.data || [])
      setMovimientos(movRes.data || [])
      setPersonalAll(persRes.data || [])
      setDepartamentos(deptRes.data || [])
    } catch (e) {
      console.error('Error loading contratistas admin:', e)
    } finally {
      setLoading(false)
    }
  }

  const openDirectPassModal = (preEmpresaId?: string) => {
    // Escoger por defecto la empresa que ya tiene trabajadores registrados si no se pasó una
    let defaultEmpId = preEmpresaId || ''
    if (!defaultEmpId) {
      const empWithWorkers = empresas.find((e) => personalAll.some((p) => p.id_empresa === e.id_empresa))
      defaultEmpId = empWithWorkers?.id_empresa || empresas[0]?.id_empresa || ''
    }
    const empWorkers = personalAll.filter((p) => p.id_empresa === defaultEmpId).map((p) => p.id_personal)
    setDirectPassForm({
      id_empresa: defaultEmpId,
      id_departamento_objetivo: departamentos[0]?.id_departamento || '',
      descripcion_servicio: 'Servicios en Mina / Mantenimiento',
      area_trabajo: 'Planta / Mina',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      requiere_campamento: false,
      requiere_comedor: true,
      emitir_inmediato: true,
      selectedPersonalIds: empWorkers,
    })
    setShowDirectPassModal(true)
  }

  const handleCreateDirectPass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!directPassForm.id_empresa) {
      alert('Selecciona una empresa contratista.')
      return
    }
    if (directPassForm.selectedPersonalIds.length === 0) {
      alert('Selecciona al menos un trabajador para generar la solicitud y credencial.')
      return
    }
    setSavingDirectPass(true)
    try {
      const isExtraDept = (directPassForm.id_departamento_objetivo || '').startsWith('EXTRA:')
      const extraDeptName = isExtraDept ? directPassForm.id_departamento_objetivo.replace('EXTRA:', '') : ''
      const deptObj = isExtraDept
        ? null
        : departamentos.find((d) => d.id_departamento === directPassForm.id_departamento_objetivo)
      const resolvedDeptNombre =
        extraDeptName ||
        deptObj?.departamento ||
        (directPassForm.requiere_campamento ? 'CAMPAMENTO Y COMEDOR' : 'Mantenimiento / Servicios')
      const folio = `CONT-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`
      const autoApprove = directPassForm.emitir_inmediato

      const { data: sol, error: solErr } = await supabase
        .from('contratistas_solicitudes')
        .insert([
          {
            folio,
            id_empresa: directPassForm.id_empresa,
            id_departamento_objetivo: isExtraDept ? null : (directPassForm.id_departamento_objetivo || null),
            departamento_nombre: resolvedDeptNombre,
            contacto_departamento: profile?.nombre_completo || 'RH / Administración',
            descripcion_servicio: directPassForm.descripcion_servicio,
            area_trabajo: directPassForm.area_trabajo,
            fecha_inicio: directPassForm.fecha_inicio,
            fecha_fin: directPassForm.fecha_fin,
            requiere_campamento: directPassForm.requiere_campamento,
            requiere_comedor: directPassForm.requiere_comedor,
            estatus_general: autoApprove ? 'Aprobada' : 'En Revisión',
            estatus_documentos: 'Completo',
            estatus_departamento: autoApprove ? 'Aprobado' : 'Pendiente',
            estatus_seguridad: autoApprove ? 'Aprobado' : 'Pendiente',
            estatus_campamento: directPassForm.requiere_campamento
              ? (autoApprove ? 'Disponible / Asignado' : 'Pendiente')
              : 'No Requiere',
            estatus_rh: autoApprove ? 'Aprobado' : 'Pendiente',
            aprobado_rh_por: autoApprove ? (profile?.nombre_completo || 'RH') : null,
            fecha_aprobacion_rh: autoApprove ? new Date().toISOString() : null,
          },
        ])
        .select()
        .single()

      if (solErr) throw solErr

      const items = directPassForm.selectedPersonalIds.map((pid) => ({
        id_solicitud: sol.id_solicitud,
        id_personal: pid,
        induccion_verificada: autoApprove,
      }))
      const { error: itemsErr } = await supabase.from('contratistas_solicitud_personal').insert(items)
      if (itemsErr) throw itemsErr

      let credCount = 0
      if (autoApprove) {
        for (const pid of directPassForm.selectedPersonalIds) {
          const qrCode = `CONT-${new Date().getFullYear().toString().slice(-2)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
          const { error: credErr } = await supabase.from('contratistas_credenciales').insert([
            {
              codigo_qr: qrCode,
              id_solicitud: sol.id_solicitud,
              id_empresa: directPassForm.id_empresa,
              id_personal: pid,
              vigencia_desde: directPassForm.fecha_inicio,
              vigencia_hasta: directPassForm.fecha_fin,
              estatus: 'Emitida',
            },
          ])
          if (!credErr) credCount++
        }
      }

      setShowDirectPassModal(false)
      await fetchAll()
      if (autoApprove) {
        setActiveTab('bitacora')
        alert(`✅ Solicitud ${folio} creada y se emitieron ${credCount} credencial(es) QR listas para descargar en PDF.`)
      } else {
        alert(`✅ Solicitud ${folio} enviada a revisión multi-factor.`)
      }
    } catch (err: any) {
      alert('Error generando solicitud/credencial: ' + err.message)
    } finally {
      setSavingDirectPass(false)
    }
  }

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEmpresa(true)
    try {
      const { data: newEmp, error: empErr } = await supabase
        .from('contratistas_empresas')
        .insert([
          {
            razon_social: empresaForm.razon_social.trim(),
            nombre_comercial: empresaForm.nombre_comercial.trim() || empresaForm.razon_social.trim(),
            rfc: empresaForm.rfc.trim().toUpperCase(),
            representante_legal: empresaForm.representante_legal.trim(),
            telefono: empresaForm.telefono.trim(),
            correo: empresaForm.correo.trim().toLowerCase(),
            especialidad: empresaForm.especialidad.trim(),
            estatus: 'Activa',
          },
        ])
        .select()
        .single()

      if (empErr) throw empErr

      let userCreated = false
      let emailAutoSent = false
      if (empresaForm.crear_usuario && empresaForm.correo.trim()) {
        const emailLower = empresaForm.correo.trim().toLowerCase()
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailLower,
            password: empresaForm.password_usuario,
            nombre_completo: `${empresaForm.razon_social.trim()}`,
            rol: 'Contratista',
            id_empresa_contratista: newEmp.id_empresa,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          alert(`⚠️ Empresa creada, pero hubo un detalle creando usuario: ${json.error}`)
        } else {
          userCreated = true
          const mailRes = await fetch('/api/contratistas/enviar-credenciales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailLower,
              password: empresaForm.password_usuario,
              razon_social: newEmp.razon_social,
              portal_url: typeof window !== 'undefined' ? window.location.origin : '',
              modo_prueba: isTestMode,
            }),
          })
          const mailJson = await mailRes.json()
          emailAutoSent = Boolean(mailJson.sent)
        }
      }

      setShowCreateEmpresa(false)
      if (userCreated) {
        setCredentialsReady({
          razon_social: newEmp.razon_social,
          email: empresaForm.correo.trim().toLowerCase(),
          password: empresaForm.password_usuario,
          telefono: empresaForm.telefono,
          emailAutoSent,
        })
      } else {
        alert(`Empresa "${newEmp.razon_social}" registrada correctamente.`)
      }
      setEmpresaForm({
        razon_social: '',
        nombre_comercial: '',
        rfc: '',
        representante_legal: '',
        telefono: '',
        correo: '',
        especialidad: '',
        crear_usuario: true,
        password_usuario: 'Contratista2026!',
      })
      await fetchAll()
    } catch (err: any) {
      alert('Error registrando empresa contratista: ' + err.message)
    } finally {
      setSavingEmpresa(false)
    }
  }

  const handleUpdateFactor = async (
    sol: any,
    factor: 'departamento' | 'seguridad' | 'campamento' | 'rh' | 'rh_corporativo' | 'documentos',
    newStatus: string
  ) => {
    const actor = profile?.nombre_completo || 'Usuario Interno'
    const nowIso = new Date().toISOString()

    if (factor === 'rh_corporativo') {
      const isApprove = newStatus === 'Aprobado'
      const nextMap = {
        ...rhCorpMap,
        [sol.id_solicitud]: { approved: isApprove, por: actor, fecha: nowIso },
      }
      setRhCorpMap(nextMap)
      localStorage.setItem('bacis_contratistas_rh_corp_approvals', JSON.stringify(nextMap))

      await supabase.from('contratistas_mensajes').insert([
        {
          id_solicitud: sol.id_solicitud,
          id_empresa: sol.id_empresa,
          remitente_id: user?.id || null,
          remitente_nombre: actor,
          remitente_rol: 'RH Corporativo',
          mensaje: `[VOBO_RH_CORPORATIVO] Vo.Bo. Corporativo ${isApprove ? 'AUTORIZADO' : 'RECHAZADO'} por ${actor}.`,
        },
      ])

      if (!isApprove) {
        await supabase
          .from('contratistas_solicitudes')
          .update({ estatus_general: 'Rechazada', actualizado_el: nowIso })
          .eq('id_solicitud', sol.id_solicitud)
      }
      await fetchAll()
      return
    }

    const updatePayload: any = { actualizado_el: nowIso }

    if (factor === 'documentos') {
      updatePayload.estatus_documentos = newStatus
    } else if (factor === 'departamento') {
      updatePayload.estatus_departamento = newStatus
      updatePayload.aprobado_depto_por = actor
      updatePayload.fecha_aprobacion_depto = nowIso
    } else if (factor === 'seguridad') {
      updatePayload.estatus_seguridad = newStatus
      updatePayload.aprobado_seguridad_por = actor
      updatePayload.fecha_aprobacion_seguridad = nowIso
    } else if (factor === 'campamento') {
      updatePayload.estatus_campamento = newStatus
      updatePayload.aprobado_campamento_por = actor
      updatePayload.fecha_aprobacion_campamento = nowIso
    } else if (factor === 'rh') {
      updatePayload.estatus_rh = newStatus
      updatePayload.estatus_documentos = newStatus === 'Aprobado' ? 'Completo' : 'Observaciones'
      updatePayload.aprobado_rh_por = actor
      updatePayload.fecha_aprobacion_rh = nowIso
      if (newStatus === 'Aprobado') updatePayload.estatus_general = 'Aprobada'
      if (newStatus === 'Rechazado') updatePayload.estatus_general = 'Rechazada'
    }

    if (newStatus === 'Rechazado' && factor !== 'rh') {
      updatePayload.estatus_general = 'Rechazada'
    }

    const { error } = await supabase
      .from('contratistas_solicitudes')
      .update(updatePayload)
      .eq('id_solicitud', sol.id_solicitud)

    if (error) {
      alert('Error actualizando factor: ' + error.message)
      return
    }

    await supabase.from('contratistas_mensajes').insert([
      {
        id_solicitud: sol.id_solicitud,
        id_empresa: sol.id_empresa,
        remitente_id: user?.id || null,
        remitente_nombre: actor,
        remitente_rol: factor === 'departamento' ? 'Departamento' : factor === 'seguridad' ? 'Seguridad' : factor === 'campamento' ? 'Campamentos' : 'RH',
        mensaje: `Factor ${factor.toUpperCase()} actualizado a "${newStatus}" por ${actor}.`,
      },
    ])

    await fetchAll()
  }

  const handleEmitirCredenciales = async (sol: any) => {
    const items = sol.contratistas_solicitud_personal || []
    if (items.length === 0) {
      alert('La solicitud no tiene personal asignado.')
      return
    }
    setIssuingId(sol.id_solicitud)
    try {
      let createdCount = 0
      for (const item of items) {
        const existing = credenciales.find(
          (c) => c.id_solicitud === sol.id_solicitud && c.id_personal === item.id_personal && c.estatus !== 'Revocada'
        )
        if (existing) continue

        const qrCode = `CONT-${new Date().getFullYear().toString().slice(-2)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
        const { error } = await supabase.from('contratistas_credenciales').insert([
          {
            codigo_qr: qrCode,
            id_solicitud: sol.id_solicitud,
            id_empresa: sol.id_empresa,
            id_personal: item.id_personal,
            vigencia_desde: sol.fecha_inicio,
            vigencia_hasta: sol.fecha_fin,
            estatus: 'Emitida',
          },
        ])
        if (!error) createdCount++
      }

      await supabase
        .from('contratistas_solicitudes')
        .update({
          estatus_rh: 'Aprobado',
          aprobado_rh_por: profile?.nombre_completo || 'RH',
          fecha_aprobacion_rh: new Date().toISOString(),
          estatus_general: 'Aprobada',
          actualizado_el: new Date().toISOString(),
        })
        .eq('id_solicitud', sol.id_solicitud)

      if (sol.contratistas_empresas?.correo) {
        await fetch('/api/contratistas/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: sol.contratistas_empresas.correo,
            asunto: `Credenciales QR Autorizadas - Folio ${sol.folio}`,
            mensaje: `Hola ${sol.contratistas_empresas.razon_social}, tu solicitud ${sol.folio} fue autorizada y ya puedes descargar las ${createdCount} credencial(es) QR desde tu Portal de Contratistas.`,
            detalles: `Área: ${sol.departamento_nombre} | Vigencia: ${formatShortDate(sol.fecha_inicio)} al ${formatShortDate(sol.fecha_fin)}`,
            modo_prueba: isTestMode,
          }),
        }).catch(() => {})
      }

      alert(`✅ Se emitieron ${createdCount} credencial(es) QR de acceso para el folio ${sol.folio}.`)
      await fetchAll()
    } catch (err: any) {
      alert('Error emitiendo credenciales: ' + err.message)
    } finally {
      setIssuingId(null)
    }
  }

  const handleReviewDoc = async (docId: string, estatus: 'Aprobado' | 'Rechazado') => {
    const { error } = await supabase
      .from('contratistas_documentos')
      .update({
        estatus,
        comentarios_revision: reviewComment || (estatus === 'Aprobado' ? 'Validado por RH/Seguridad' : 'Documento rechazado, favor de reenviar'),
        revisado_por: user?.id || null,
      })
      .eq('id_documento', docId)

    if (error) {
      alert('Error revisando documento: ' + error.message)
      return
    }
    setReviewComment('')
    setPreviewDoc(null)
    await fetchAll()
  }

  const handleResolveProrroga = async (pror: any, decision: 'Aprobada' | 'Rechazada') => {
    if (!confirm(`¿${decision === 'Aprobada' ? 'Aprobar' : 'Rechazar'} la extensión hasta ${formatShortDate(pror.fecha_fin_solicitada)}?`)) return

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

    if (error) {
      alert('Error resolviendo prórroga: ' + error.message)
      return
    }

    if (decision === 'Aprobada') {
      await supabase
        .from('contratistas_solicitudes')
        .update({
          fecha_fin: pror.fecha_fin_solicitada,
          estatus_general: 'En Mina',
          actualizado_el: new Date().toISOString(),
        })
        .eq('id_solicitud', pror.id_solicitud)

      if (pror.id_credencial) {
        await supabase
          .from('contratistas_credenciales')
          .update({ vigencia_hasta: pror.fecha_fin_solicitada })
          .eq('id_credencial', pror.id_credencial)
      } else {
        await supabase
          .from('contratistas_credenciales')
          .update({ vigencia_hasta: pror.fecha_fin_solicitada })
          .eq('id_solicitud', pror.id_solicitud)
          .in('estatus', ['Emitida', 'En Mina'])
      }
    }

    await fetchAll()
  }

  const handleCheckInOut = async (cred: any, action: 'Entrada' | 'Salida') => {
    const nowIso = new Date().toISOString()
    if (action === 'Entrada') {
      await supabase
        .from('contratistas_credenciales')
        .update({ estatus: 'En Mina', fecha_entrada_mina: nowIso })
        .eq('id_credencial', cred.id_credencial)
      await supabase
        .from('contratistas_personal')
        .update({ estatus: 'En Mina' })
        .eq('id_personal', cred.id_personal)
      await supabase
        .from('contratistas_solicitudes')
        .update({ estatus_general: 'En Mina' })
        .eq('id_solicitud', cred.id_solicitud)
      await supabase.from('contratistas_movimientos_bitacora').insert([
        {
          id_credencial: cred.id_credencial,
          id_personal: cred.id_personal,
          id_empresa: cred.id_empresa,
          tipo_movimiento: 'Entrada',
          caseta_lugar: 'Caseta Principal / RH',
          registrado_por: profile?.nombre_completo || 'Operador',
        },
      ])
    } else {
      await supabase
        .from('contratistas_credenciales')
        .update({
          estatus: 'Devuelta',
          fecha_salida_mina: nowIso,
          credencial_entregada: true,
          recibido_por: profile?.nombre_completo || 'Caseta / RH',
        })
        .eq('id_credencial', cred.id_credencial)
      await supabase
        .from('contratistas_personal')
        .update({ estatus: 'Activo' })
        .eq('id_personal', cred.id_personal)

      // Auto-release any camp bed assigned to this contractor worker
      await supabase
        .from('campamento_camas')
        .update({
          id_contratista_personal: null,
          ocupado_por_nombre: null,
        })
        .eq('id_contratista_personal', cred.id_personal)

      await supabase.from('contratistas_movimientos_bitacora').insert([
        {
          id_credencial: cred.id_credencial,
          id_personal: cred.id_personal,
          id_empresa: cred.id_empresa,
          tipo_movimiento: 'Entrega Credencial',
          caseta_lugar: 'Caseta Principal / RH',
          registrado_por: profile?.nombre_completo || 'Operador',
          observaciones: 'Salida de mina y devolución física de credencial',
        },
      ])
    }
    await fetchAll()
  }

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
    const { data } = await supabase
      .from('contratistas_mensajes')
      .insert([
        {
          id_solicitud: chatSolicitud.id_solicitud,
          id_empresa: chatSolicitud.id_empresa,
          remitente_id: user?.id || null,
          remitente_nombre: profile?.nombre_completo || 'Departamento / RH',
          remitente_rol: isRHOrAdmin ? 'RH' : 'Departamento',
          mensaje: newMessage.trim(),
        },
      ])
      .select()
      .single()
    if (data) {
      setMensajes((prev) => [...prev, data])
      setNewMessage('')
    }
  }

  const handleActivateAndCreateUser = async (emp: any) => {
    const pass = prompt(`Generar usuario para "${emp.razon_social}" (${emp.correo}).\nIngresa la contraseña inicial (mín. 6 caracteres):`, 'Contratista2026!')
    if (!pass || pass.trim().length < 6) return

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: (emp.correo || '').trim().toLowerCase(),
        password: pass.trim(),
        nombre_completo: emp.razon_social,
        rol: 'Contratista',
        id_empresa_contratista: emp.id_empresa,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert('Error creando usuario: ' + (json.error || 'Error desconocido'))
      return
    }
    await supabase.from('contratistas_empresas').update({ estatus: 'Activa' }).eq('id_empresa', emp.id_empresa)
    const mailRes = await fetch('/api/contratistas/enviar-credenciales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: (emp.correo || '').trim().toLowerCase(),
        password: pass.trim(),
        razon_social: emp.razon_social,
        portal_url: typeof window !== 'undefined' ? window.location.origin : '',
        modo_prueba: isTestMode,
      }),
    })
    const mailJson = await mailRes.json()
    setCredentialsReady({
      razon_social: emp.razon_social,
      email: (emp.correo || '').trim().toLowerCase(),
      password: pass.trim(),
      telefono: emp.telefono,
      emailAutoSent: Boolean(mailJson.sent),
    })
    await fetchAll()
  }

  const badgeClass = (status: string) => {
    const s = (status || '').toLowerCase()
    if (s.includes('aprob') || s.includes('disponible') || s.includes('completo') || s === 'en mina' || s === 'activa') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
    if (s.includes('rechaz') || s.includes('sin cupo') || s.includes('vencid') || s.includes('revoc')) {
      return 'bg-rose-100 text-rose-800 border-rose-200'
    }
    if (s.includes('diálogo') || s.includes('prórroga') || s.includes('emitida') || s === 'devuelta') {
      return 'bg-blue-100 text-blue-800 border-blue-200'
    }
    return 'bg-amber-100 text-amber-800 border-amber-200'
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (schemaMissing) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-amber-50 border-2 border-amber-300 rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-black text-zinc-900 uppercase">Tablas de Contratistas Pendientes en Supabase</h2>
        <p className="text-sm text-zinc-700">
          Ejecuta el archivo <code className="bg-amber-100 px-2 py-0.5 rounded font-mono">SQL_INTEGRACION_Y_CONTRATISTAS.sql</code> en el Editor SQL de Supabase para activar este módulo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
            <HardHat className="w-7 h-7 text-orange-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-400">
              Control Interno RH • Departamentos • Seguridad • Campamentos
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Gestión Integral de Contratistas
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Alta de empresas/usuarios contratistas, revisión de documentos SAT/IMSS/NSS, flujo de aprobación multi-factor y credenciales QR.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={fetchAll} className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isRHOrAdmin && (
            <>
              <button
                onClick={() => openDirectPassModal()}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-3 rounded-xl shadow-lg"
              >
                <QrCode className="w-4 h-4" />
                <span>Generar Solicitud & Credencial</span>
              </button>
              <button
                onClick={() => setShowCreateEmpresa(true)}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-black font-black text-xs px-5 py-3 rounded-xl shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Subir Contratista & Crear Usuario</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Solicitudes de Nuevo Usuario Contratista */}
      {isRHOrAdmin && empresas.filter((e) => e.estatus === 'Pendiente').length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-orange-900 font-black text-xs uppercase">
            <UserPlus className="w-4 h-4 text-orange-600" />
            <span>Solicitudes de Nuevo Usuario Contratista ({empresas.filter((e) => e.estatus === 'Pendiente').length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {empresas
              .filter((e) => e.estatus === 'Pendiente')
              .map((emp) => (
                <div key={emp.id_empresa} className="bg-white rounded-xl border border-orange-200 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-sm text-zinc-900 truncate">{emp.razon_social}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{emp.correo} • RFC: {emp.rfc}</p>
                    <p className="text-[11px] text-zinc-500">Rep: {emp.representante_legal || 'N/D'} • {emp.especialidad || ''}</p>
                  </div>
                  <button
                    onClick={() => handleActivateAndCreateUser(emp)}
                    className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs rounded-xl shrink-0"
                  >
                    Aprobar y Crear Usuario
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Empresas</span>
          <p className="text-2xl font-black text-zinc-900">{empresas.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Solicitudes en Revisión</span>
          <p className="text-2xl font-black text-amber-600">{solicitudes.filter((s) => s.estatus_general === 'En Revisión').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Docs. por Validar</span>
          <p className="text-2xl font-black text-orange-600">{documentos.filter((d) => d.estatus === 'Pendiente').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">En Mina Ahora</span>
          <p className="text-2xl font-black text-emerald-600">{credenciales.filter((c) => c.estatus === 'En Mina').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <span className="text-[10px] font-black uppercase text-zinc-400">Prórrogas Pendientes</span>
          <p className="text-2xl font-black text-blue-600">{prorrogas.filter((p) => p.estatus_general === 'Pendiente').length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        {[
          { id: 'solicitudes', label: 'Solicitudes Multi-Factor', icon: ShieldCheck },
          { id: 'empresas', label: 'Empresas y Usuarios', icon: Building2 },
          { id: 'documentos', label: 'Validación PDF/SAT/IMSS/NSS', icon: FileText },
          { id: 'prorrogas', label: 'Prórrogas (Más Días)', icon: CalendarPlus },
          { id: 'bitacora', label: 'Credenciales & Entradas/Salidas', icon: QrCode },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                active ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: SOLICITUDES MULTI-FACTOR */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          {solicitudes.map((sol) => {
            const deptoOk = sol.estatus_departamento === 'Aprobado'
            const segOk = sol.estatus_seguridad === 'Aprobado'
            const campOk = !sol.requiere_campamento || sol.estatus_campamento === 'Disponible / Asignado'
            const readyForRH = deptoOk && segOk && campOk
            return (
              <div key={sol.id_solicitud} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs bg-zinc-900 text-amber-400 px-3 py-1 rounded-lg">{sol.folio}</span>
                      <span className="font-black text-base text-zinc-900">{sol.contratistas_empresas?.razon_social}</span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${badgeClass(sol.estatus_general)}`}>
                        {sol.estatus_general}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">
                      Depto Interesado: <strong>{sol.departamento_nombre}</strong> ({sol.contacto_departamento || 'Sin contacto'}) • Servicio: <strong>{sol.descripcion_servicio}</strong>
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Estadía: {formatShortDate(sol.fecha_inicio)} → {formatShortDate(sol.fecha_fin)} ({diffDaysInclusive(sol.fecha_inicio, sol.fecha_fin)} días)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openChat(sol)}
                      className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-black px-3.5 py-2 rounded-xl"
                    >
                      <MessageSquare className="w-4 h-4 text-orange-500" />
                      <span>Chat Contratista</span>
                    </button>
                    {isRHOrAdmin && (
                      <button
                        onClick={() => handleEmitirCredenciales(sol)}
                        disabled={issuingId === sol.id_solicitud}
                        className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-xl shadow ${
                          readyForRH
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-zinc-900 hover:bg-black text-amber-400'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{issuingId === sol.id_solicitud ? 'Emitiendo...' : 'Autorizar RH y Emitir Credenciales QR'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-Factor Action Grid (5 Niveles Claros) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Factor 1: RH Unidad & Docs */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-black uppercase text-amber-700">1. RH Unidad &amp; Docs</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_rh === 'Aprobado' ? 'Aprobado' : sol.estatus_documentos)}`}>{sol.estatus_rh || sol.estatus_documentos}</span>
                    </div>
                    {isRHOrAdmin && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleUpdateFactor(sol, 'rh', 'Aprobado')} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg cursor-pointer">Aprobar RH</button>
                        <button onClick={() => handleUpdateFactor(sol, 'documentos', 'Observaciones')} className="py-1.5 px-2 bg-amber-500 text-black text-[10px] font-black rounded-lg cursor-pointer">Obs.</button>
                      </div>
                    )}
                  </div>

                  {/* Factor 2: RH Corporativo */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-black uppercase text-indigo-700">2. RH Corporativo</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badgeClass(rhCorpMap[sol.id_solicitud]?.approved ? 'Aprobado' : 'Pendiente')}`}>
                        {rhCorpMap[sol.id_solicitud]?.approved ? 'Aprobado' : 'Pendiente'}
                      </span>
                    </div>
                    {isRHCorporativo && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleUpdateFactor(sol, 'rh_corporativo', 'Aprobado')} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg cursor-pointer">Vo.Bo. Corp.</button>
                        <button onClick={() => handleUpdateFactor(sol, 'rh_corporativo', 'Rechazado')} className="py-1.5 px-2 bg-rose-600 text-white text-[10px] font-black rounded-lg cursor-pointer">✕</button>
                      </div>
                    )}
                  </div>

                  {/* Factor 3: Departamento Operativo (Si es Campamento lo autoriza Campamentos, NO Mina) */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-black uppercase text-zinc-700">
                        3. {areDepartmentsEquivalent(sol.departamento_nombre, 'CAMPAMENTO Y COMEDOR') ? 'Jefe Campamentos' : `Depto (${sol.departamento_nombre})`}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_departamento)}`}>{sol.estatus_departamento}</span>
                    </div>
                    {(isJefeDepto || isCampamento || isRHOrAdmin) && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleUpdateFactor(sol, 'departamento', 'Aprobado')} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg cursor-pointer">Vo.Bo.</button>
                        <button onClick={() => handleUpdateFactor(sol, 'departamento', 'En Diálogo')} className="py-1.5 px-2 bg-blue-600 text-white text-[10px] font-black rounded-lg cursor-pointer">Diál.</button>
                        <button onClick={() => handleUpdateFactor(sol, 'departamento', 'Rechazado')} className="py-1.5 px-2 bg-rose-600 text-white text-[10px] font-black rounded-lg cursor-pointer">✕</button>
                      </div>
                    )}
                  </div>

                  {/* Factor 4: Seguridad Industrial */}
                  <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200 space-y-2">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-black uppercase text-orange-800">4. Seguridad HSE</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_seguridad)}`}>{sol.estatus_seguridad}</span>
                    </div>
                    {(isSeguridad || isRHOrAdmin) && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleUpdateFactor(sol, 'seguridad', 'Aprobado')} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg cursor-pointer">Aprobar Ind.</button>
                        <button onClick={() => handleUpdateFactor(sol, 'seguridad', 'Rechazado')} className="py-1.5 px-2 bg-rose-600 text-white text-[10px] font-black rounded-lg cursor-pointer">✕</button>
                      </div>
                    )}
                  </div>

                  {/* Factor 5: Jefe de Campamentos (Independiente de Mina) */}
                  <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-2">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-black uppercase text-teal-800">5. Jefe Campamentos</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_campamento)}`}>{sol.estatus_campamento}</span>
                    </div>
                    {(sol.requiere_campamento || isCampamento) && (isCampamento || isRHOrAdmin) && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleUpdateFactor(sol, 'campamento', 'Disponible / Asignado')} className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black rounded-lg cursor-pointer">Hay Cupo</button>
                        <button onClick={() => handleUpdateFactor(sol, 'campamento', 'Sin Cupo')} className="py-1.5 px-2 bg-rose-600 text-white text-[10px] font-black rounded-lg cursor-pointer">✕</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Workers */}
                {sol.contratistas_solicitud_personal?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sol.contratistas_solicitud_personal.map((item: any) => (
                      <div key={item.id_item} className="text-xs bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <span className="font-bold">{item.contratistas_personal?.nombre} {item.contratistas_personal?.apellido_paterno}</span>
                        <span className="text-[10px] font-mono text-zinc-400">NSS: {item.contratistas_personal?.nss || 'N/D'}</span>
                        {item.cama_descripcion && <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold">{item.cama_descripcion}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {solicitudes.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-zinc-300 p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="max-w-lg mx-auto space-y-1.5">
                <h3 className="text-base font-black text-zinc-900 uppercase">Aún no hay Solicitudes de Ingreso enviadas</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {personalAll.length > 0
                    ? `Ya hay ${personalAll.length} trabajador(es) y ${documentos.length} documento(s) cargados. Para generar la credencial QR, el contratista debe enviar una Solicitud de Ingreso desde su "Portal Individual Contratista" (Pestaña 1), o tú como RH puedes crear la solicitud y emitir el gafete directamente aquí.`
                    : 'Primero el contratista registra a su personal y papelería en "Portal Individual Contratista" y envía una solicitud de ingreso con fechas y departamento.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {personalAll.length > 0 && isRHOrAdmin && (
                  <button
                    onClick={() => openDirectPassModal()}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Crear Solicitud y Emitir Credencial QR ahora</span>
                  </button>
                )}
                <Link
                  href="/contratistas-portal"
                  className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-black text-orange-400 font-black text-xs px-5 py-3 rounded-xl shadow"
                >
                  <Users className="w-4 h-4" />
                  <span>Ir a Portal Individual Contratista</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMPRESAS Y USUARIOS */}
      {activeTab === 'empresas' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200 text-xs">
            <thead className="bg-zinc-900 text-white uppercase text-[10px] font-black">
              <tr>
                <th className="px-5 py-3.5 text-left">Empresa Contratista</th>
                <th className="px-5 py-3.5 text-left">RFC / Especialidad</th>
                <th className="px-5 py-3.5 text-left">Personal / Docs</th>
                <th className="px-5 py-3.5 text-left">Contacto / Correo Acceso</th>
                <th className="px-5 py-3.5 text-left">Estatus</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {empresas.map((emp) => {
                const empWorkers = personalAll.filter((p) => p.id_empresa === emp.id_empresa).length
                const empDocs = documentos.filter((d) => d.id_empresa === emp.id_empresa).length
                return (
                <tr key={emp.id_empresa} className="hover:bg-zinc-50">
                  <td className="px-5 py-4">
                    <div className="font-black text-zinc-900">{emp.razon_social}</div>
                    <div className="text-[11px] text-zinc-500">Rep: {emp.representante_legal || 'N/D'}</div>
                  </td>
                  <td className="px-5 py-4 font-mono">
                    <div className="font-bold">{emp.rfc}</div>
                    <div className="text-[11px] text-zinc-500 font-sans">{emp.especialidad || 'Servicios Generales'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-black text-zinc-900">{empWorkers} trab.</span>
                    <span className="text-zinc-400 mx-1">•</span>
                    <span className="font-bold text-orange-600">{empDocs} docs.</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-mono font-bold text-zinc-700">{emp.correo || 'Sin correo'}</div>
                    <div className="text-[11px] text-zinc-500">{emp.telefono || ''}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded border ${badgeClass(emp.estatus)}`}>
                      {emp.estatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    {isRHOrAdmin && empWorkers > 0 && (
                      <button
                        onClick={() => openDirectPassModal(emp.id_empresa)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg inline-flex items-center gap-1"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>Emitir Credencial</span>
                      </button>
                    )}
                    {isRHOrAdmin && emp.correo && (
                      <button
                        onClick={() => handleActivateAndCreateUser(emp)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-orange-400 text-[10px] font-black rounded-lg inline-flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>{emp.estatus === 'Pendiente' ? 'Aprobar Usuario' : 'Generar / Reenviar Acceso'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: VALIDACIÓN DE DOCUMENTOS */}
      {activeTab === 'documentos' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200 text-xs">
            <thead className="bg-zinc-900 text-white uppercase text-[10px] font-black">
              <tr>
                <th className="px-5 py-3.5 text-left">Empresa / Trabajador</th>
                <th className="px-5 py-3.5 text-left">Documento</th>
                <th className="px-5 py-3.5 text-left">Vencimiento</th>
                <th className="px-5 py-3.5 text-left">Estatus</th>
                <th className="px-5 py-3.5 text-right">Revisar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {documentos.map((doc) => (
                <tr key={doc.id_documento} className="hover:bg-zinc-50">
                  <td className="px-5 py-4">
                    <div className="font-black text-zinc-900">{doc.contratistas_empresas?.razon_social}</div>
                    {doc.contratistas_personal && (
                      <div className="text-[11px] text-zinc-500">
                        👷 {doc.contratistas_personal.nombre} {doc.contratistas_personal.apellido_paterno} (NSS: {doc.contratistas_personal.nss || 'N/D'})
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-zinc-800">{getDocLabel(doc.tipo_documento)}</div>
                    <div className="text-[11px] text-zinc-400 truncate max-w-xs">{doc.nombre_archivo}</div>
                  </td>
                  <td className="px-5 py-4 font-mono">{formatShortDate(doc.fecha_vencimiento)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass(doc.estatus)}`}>{doc.estatus}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => {
                        setPreviewDoc(doc)
                        setReviewComment(doc.comentarios_revision || '')
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ver / Validar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: PRÓRROGAS */}
      {activeTab === 'prorrogas' && (
        <div className="space-y-3">
          {prorrogas.map((pr) => (
            <div key={pr.id_prorroga} className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs bg-zinc-900 text-amber-400 px-2.5 py-1 rounded-lg">
                    {pr.contratistas_solicitudes?.folio}
                  </span>
                  <span className="font-black text-sm text-zinc-900">{pr.contratistas_empresas?.razon_social}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass(pr.estatus_general)}`}>{pr.estatus_general}</span>
                </div>
                <p className="text-xs text-zinc-600 mt-1.5">
                  Extender salida del <strong>{formatShortDate(pr.fecha_fin_anterior)}</strong> al <strong className="text-orange-600">{formatShortDate(pr.fecha_fin_solicitada)}</strong>
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Motivo: {pr.motivo}</p>
              </div>
              {pr.estatus_general === 'Pendiente' && isRHOrAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => handleResolveProrroga(pr, 'Aprobada')} className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl">Aprobar Extensión</button>
                  <button onClick={() => handleResolveProrroga(pr, 'Rechazada')} className="px-4 py-2 bg-rose-600 text-white text-xs font-black rounded-xl">Rechazar</button>
                </div>
              )}
            </div>
          ))}
          {prorrogas.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
              No hay solicitudes de prórroga registradas.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CREDENCIALES & BITÁCORA ENTRADA/SALIDA */}
      {activeTab === 'bitacora' && (
        <div className="space-y-6">
          {/* Selector de Tamaño y Formato de Impresión Bacís */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-600">
                  Diseño Oficial Grupo Minero Bacís • Unidad &quot;El Herrero&quot;
                </span>
                <h3 className="text-sm font-black uppercase text-zinc-900">
                  Elige el Tamaño de Credencial para Descargar / Imprimir
                </h3>
              </div>
              <span className="text-[11px] font-bold text-zinc-500">
                Selecciona 1 de los 4 tamaños antes de presionar &quot;Descargar PDF&quot;
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {BADGE_SIZE_OPTIONS.map((opt) => {
                const selected = badgeSizeFormat === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBadgeSizeFormat(opt.id)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-amber-500 bg-amber-50/70 shadow-sm'
                        : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-zinc-900 text-amber-400">
                        {opt.dimensions}
                      </span>
                      {selected && (
                        <span className="text-[10px] font-black text-amber-700 uppercase">✓ Seleccionado</span>
                      )}
                    </div>
                    <p className="font-black text-xs text-zinc-900 mt-2">{opt.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{opt.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 font-black text-xs uppercase text-zinc-700 flex items-center justify-between">
              <span>Credenciales Emitidas &amp; Control de Entrega/Devolución</span>
              <span className="text-[11px] font-mono text-amber-700">
                Formato activo: {BADGE_SIZE_OPTIONS.find((o) => o.id === badgeSizeFormat)?.dimensions}
              </span>
            </div>
            <table className="min-w-full divide-y divide-zinc-200 text-xs">
              <thead className="bg-zinc-900 text-white uppercase text-[10px] font-black">
                <tr>
                  <th className="px-4 py-3 text-left">Código QR</th>
                  <th className="px-4 py-3 text-left">Trabajador / Empresa</th>
                  <th className="px-4 py-3 text-left">Vigencia</th>
                  <th className="px-4 py-3 text-left">Estatus / Caseta</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {credenciales.map((cred) => {
                  const p = cred.contratistas_personal
                  return (
                    <tr key={cred.id_credencial} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono font-black">{cred.codigo_qr}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-900">{p?.nombre} {p?.apellido_paterno}</div>
                        <div className="text-[11px] text-zinc-500">{cred.contratistas_empresas?.razon_social}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {formatShortDate(cred.vigencia_desde)} → {formatShortDate(cred.vigencia_hasta)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass(cred.estatus)}`}>{cred.estatus}</span>
                        {cred.fecha_entrada_mina && <div className="text-[10px] text-zinc-500 mt-0.5">Entró: {new Date(cred.fecha_entrada_mina).toLocaleString('es-MX')}</div>}
                        {cred.fecha_salida_mina && <div className="text-[10px] text-zinc-500">Salió: {new Date(cred.fecha_salida_mina).toLocaleString('es-MX')}</div>}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
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
                              departamento_autorizado: cred.contratistas_solicitudes?.departamento_nombre || 'Servicios',
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
                          <Download className="w-3.5 h-3.5" /> Descargar PDF ({BADGE_SIZE_OPTIONS.find((o) => o.id === badgeSizeFormat)?.widthMm}×{BADGE_SIZE_OPTIONS.find((o) => o.id === badgeSizeFormat)?.heightMm}mm)
                        </button>
                        {cred.estatus === 'Emitida' && (
                          <button onClick={() => handleCheckInOut(cred, 'Entrada')} className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg font-bold inline-flex items-center gap-1">
                            <LogIn className="w-3.5 h-3.5" /> Entrada
                          </button>
                        )}
                        {cred.estatus === 'En Mina' && (
                          <button onClick={() => handleCheckInOut(cred, 'Salida')} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg font-bold inline-flex items-center gap-1">
                            <LogOut className="w-3.5 h-3.5" /> Salida & Entrega
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 font-black text-xs uppercase text-zinc-700">
              Historial de Movimientos en Caseta (Últimos 50)
            </div>
            <div className="divide-y divide-zinc-100">
              {movimientos.map((m) => (
                <div key={m.id_movimiento} className="px-5 py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-zinc-700 mr-2">{m.contratistas_credenciales?.codigo_qr}</span>
                    <strong>{m.contratistas_personal?.nombre} {m.contratistas_personal?.apellido_paterno}</strong> ({m.contratistas_empresas?.razon_social})
                  </div>
                  <div className="text-right">
                    <span className="font-black text-zinc-800">{m.tipo_movimiento}</span>
                    <span className="text-zinc-400 ml-2">{new Date(m.fecha_hora).toLocaleString('es-MX')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR EMPRESA CONTRATISTA + USUARIO */}
      {showCreateEmpresa && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center sticky top-0">
              <h3 className="font-black text-sm uppercase">Subir Empresa Contratista & Usuario</h3>
              <button onClick={() => setShowCreateEmpresa(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateEmpresa} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Razón Social *</label>
                <input required value={empresaForm.razon_social} onChange={(e) => setEmpresaForm({ ...empresaForm, razon_social: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" placeholder="Ej. Servicios Mineros del Norte S.A. de C.V." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">RFC *</label>
                  <input required value={empresaForm.rfc} onChange={(e) => setEmpresaForm({ ...empresaForm, rfc: e.target.value })} className="w-full text-xs font-mono uppercase border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Especialidad</label>
                  <input value={empresaForm.especialidad} onChange={(e) => setEmpresaForm({ ...empresaForm, especialidad: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" placeholder="Mantenimiento / Soldadura" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Representante Legal</label>
                  <input value={empresaForm.representante_legal} onChange={(e) => setEmpresaForm({ ...empresaForm, representante_legal: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Teléfono</label>
                  <input value={empresaForm.telefono} onChange={(e) => setEmpresaForm({ ...empresaForm, telefono: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
                <label className="flex items-center gap-2 text-xs font-black text-orange-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empresaForm.crear_usuario}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, crear_usuario: e.target.checked })}
                  />
                  <KeyRound className="w-4 h-4" />
                  <span>Crear usuario individual para acceso al Portal Contratista</span>
                </label>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Correo de Acceso (Login) *</label>
                  <input required={empresaForm.crear_usuario} type="email" value={empresaForm.correo} onChange={(e) => setEmpresaForm({ ...empresaForm, correo: e.target.value })} className="w-full text-xs font-mono border border-zinc-300 rounded-xl p-2.5 bg-white" placeholder="contratista@empresa.com" />
                </div>
                {empresaForm.crear_usuario && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Contraseña Inicial *</label>
                    <input required minLength={6} value={empresaForm.password_usuario} onChange={(e) => setEmpresaForm({ ...empresaForm, password_usuario: e.target.value })} className="w-full text-xs font-mono border border-zinc-300 rounded-xl p-2.5 bg-white" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateEmpresa(false)} className="px-4 py-2 text-xs font-bold text-zinc-600">Cancelar</button>
                <button type="submit" disabled={savingEmpresa} className="px-6 py-2.5 bg-orange-500 text-black font-black text-xs rounded-xl">
                  {savingEmpresa ? 'Guardando...' : 'Registrar Contratista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHAT */}
      {chatSolicitud && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full h-[75vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase">Comunicación • {chatSolicitud.folio}</h3>
                <p className="text-[11px] text-zinc-400">{chatSolicitud.contratistas_empresas?.razon_social}</p>
              </div>
              <button onClick={() => setChatSolicitud(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {mensajes.map((m) => (
                <div key={m.id_mensaje} className={`p-3 rounded-2xl text-xs max-w-[85%] ${m.remitente_rol !== 'Contratista' ? 'ml-auto bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-800'}`}>
                  <span className="font-black text-[10px] uppercase block mb-1 opacity-75">{m.remitente_nombre} ({m.remitente_rol})</span>
                  <p>{m.mensaje}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-200 flex gap-2">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Responder al contratista..." className="flex-1 text-xs border border-zinc-300 rounded-xl px-3 py-2.5" />
              <button type="submit" className="px-4 py-2.5 bg-orange-500 text-black rounded-xl text-xs font-black flex items-center gap-1">
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW Y VALIDACIÓN DE DOCUMENTO */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 text-white p-4 flex justify-between items-center">
              <span className="text-xs font-black uppercase truncate">{getDocLabel(previewDoc.tipo_documento)} — {previewDoc.nombre_archivo}</span>
              <button onClick={() => setPreviewDoc(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 bg-zinc-100 flex items-center justify-center overflow-auto p-4">
              {previewDoc.mime_type?.includes('image') || /\.(png|jpg|jpeg|webp)$/i.test(previewDoc.archivo_url) ? (
                <img src={previewDoc.archivo_url} alt={previewDoc.nombre_archivo} className="max-h-full max-w-full object-contain rounded-lg shadow" />
              ) : (
                <iframe src={previewDoc.archivo_url} className="w-full h-full rounded-lg border border-zinc-300 bg-white" title={previewDoc.nombre_archivo} />
              )}
            </div>
            <div className="p-4 bg-white border-t border-zinc-200 flex flex-col sm:flex-row items-center gap-3">
              <input
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Observaciones o motivo de rechazo (opcional)..."
                className="flex-1 w-full text-xs border border-zinc-300 rounded-xl px-3 py-2"
              />
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleReviewDoc(previewDoc.id_documento, 'Aprobado')} className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl">Aprobar Documento</button>
                <button onClick={() => handleReviewDoc(previewDoc.id_documento, 'Rechazado')} className="px-4 py-2 bg-rose-600 text-white text-xs font-black rounded-xl">Rechazar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREDENCIALES LISTAS PARA ENVIAR AL CONTRATISTA */}
      {credentialsReady && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-orange-400" />
                <h3 className="font-black text-sm uppercase">Acceso Contratista Activado</h3>
              </div>
              <button onClick={() => setCredentialsReady(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {credentialsReady.emailAutoSent ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl">
                  ✅ Correo enviado automáticamente a {credentialsReady.email}.
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl">
                  <strong>Usuario ya activo</strong> (no requiere link de confirmación). El sistema no tiene SMTP/Resend configurado para envío automático en segundo plano: envíale los datos con un clic abajo.
                </div>
              )}

              <div className="bg-zinc-100 rounded-2xl p-4 font-mono text-xs space-y-1.5 border border-zinc-200">
                <div><span className="text-zinc-500">Empresa:</span> <strong>{credentialsReady.razon_social}</strong></div>
                <div><span className="text-zinc-500">Usuario:</span> <strong>{credentialsReady.email}</strong></div>
                <div><span className="text-zinc-500">Contraseña:</span> <strong>{credentialsReady.password}</strong></div>
                <div><span className="text-zinc-500">Acceso:</span> <strong>{typeof window !== 'undefined' ? window.location.origin : ''} (Portal Contratistas)</strong></div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.origin : ''
                    const msg = `Hola ${credentialsReady.razon_social},\nTu usuario para el Portal de Contratistas ya está activo.\n\nEnlace: ${url}\nEntrar en: "Portal Contratistas"\nUsuario: ${credentialsReady.email}\nContraseña: ${credentialsReady.password}`
                    navigator.clipboard.writeText(msg)
                    alert('Datos copiados al portapapeles.')
                  }}
                  className="w-full py-2.5 bg-zinc-900 text-white text-xs font-black rounded-xl"
                >
                  Copiar Mensaje de Acceso
                </button>
                <a
                  href={`mailto:${encodeURIComponent(credentialsReady.email)}?subject=${encodeURIComponent('Acceso Portal de Contratistas')}&body=${encodeURIComponent(`Hola ${credentialsReady.razon_social},\n\nTu cuenta en el Portal de Contratistas ya está activa.\n\nEnlace: ${typeof window !== 'undefined' ? window.location.origin : ''}\nMódulo: Portal Contratistas\nUsuario: ${credentialsReady.email}\nContraseña: ${credentialsReady.password}\n\nYa puedes subir a tu personal, fotografías y documentos.`)}`}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-black text-xs font-black rounded-xl text-center block"
                >
                  Enviar por Correo (Outlook / Gmail)
                </a>
                {credentialsReady.telefono && (
                  <a
                    href={`https://wa.me/${credentialsReady.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${credentialsReady.razon_social}, tu acceso al Portal de Contratistas está activo.\nEnlace: ${typeof window !== 'undefined' ? window.location.origin : ''}\nUsuario: ${credentialsReady.email}\nContraseña: ${credentialsReady.password}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl text-center block"
                  >
                    Enviar por WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR SOLICITUD Y EMITIR CREDENCIAL DIRECTA (RH) */}
      {showDirectPassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-zinc-200 max-h-[90vh] flex flex-col">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm uppercase">Generar Solicitud &amp; Credencial QR</h3>
              </div>
              <button onClick={() => setShowDirectPassModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDirectPass} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Empresa Contratista</label>
                <select
                  required
                  value={directPassForm.id_empresa}
                  onChange={(e) => {
                    const newEmpId = e.target.value
                    const empWorkers = personalAll.filter((p) => p.id_empresa === newEmpId).map((p) => p.id_personal)
                    setDirectPassForm({
                      ...directPassForm,
                      id_empresa: newEmpId,
                      selectedPersonalIds: empWorkers,
                    })
                  }}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="">Selecciona una empresa...</option>
                  {empresas.map((emp) => {
                    const count = personalAll.filter((p) => p.id_empresa === emp.id_empresa).length
                    return (
                      <option key={emp.id_empresa} value={emp.id_empresa}>
                        {emp.razon_social} ({count} trabajadores)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Personal de la Empresa (Marca quienes ingresan)</label>
                {personalAll.filter((p) => p.id_empresa === directPassForm.id_empresa).length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                    Esta empresa aún no tiene trabajadores dados de alta en &quot;Portal Individual Contratista&quot;.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100">
                    {personalAll
                      .filter((p) => p.id_empresa === directPassForm.id_empresa)
                      .map((p) => {
                        const checked = directPassForm.selectedPersonalIds.includes(p.id_personal)
                        return (
                          <label key={p.id_personal} className="flex items-center gap-3 p-2.5 hover:bg-zinc-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? directPassForm.selectedPersonalIds.filter((id) => id !== p.id_personal)
                                  : [...directPassForm.selectedPersonalIds, p.id_personal]
                                setDirectPassForm({ ...directPassForm, selectedPersonalIds: next })
                              }}
                              className="rounded border-zinc-300 text-orange-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-zinc-900 truncate">
                                {p.nombre} {p.apellido_paterno} {p.apellido_materno || ''}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                {p.puesto_servicio || 'Contratista'} • NSS: {p.nss || 'N/D'}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Departamento Solicitante</label>
                  <select
                    value={directPassForm.id_departamento_objetivo}
                    onChange={(e) => setDirectPassForm({ ...directPassForm, id_departamento_objetivo: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="">Mantenimiento / Servicios</option>
                    {departamentos.map((d) => (
                      <option key={d.id_departamento} value={d.id_departamento}>
                        {d.departamento}
                      </option>
                    ))}
                    <option value="EXTRA:CAMPAMENTO Y COMEDOR">CAMPAMENTO Y COMEDOR (Jefe de Campamentos)</option>
                    <option value="EXTRA:SEGURIDAD INDUSTRIAL">SEGURIDAD INDUSTRIAL</option>
                    <option value="EXTRA:RECURSOS HUMANOS">RECURSOS HUMANOS</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Área / Trabajo en Mina</label>
                  <input
                    value={directPassForm.area_trabajo}
                    onChange={(e) => setDirectPassForm({ ...directPassForm, area_trabajo: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                    placeholder="Ej. Planta de Beneficio"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black uppercase text-zinc-600 mb-1">Descripción del Servicio</label>
                <input
                  required
                  value={directPassForm.descripcion_servicio}
                  onChange={(e) => setDirectPassForm({ ...directPassForm, descripcion_servicio: e.target.value })}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2"
                  placeholder="Ej. Mantenimiento eléctrico, obra civil..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Vigencia Desde</label>
                  <input
                    type="date"
                    required
                    value={directPassForm.fecha_inicio}
                    onChange={(e) => setDirectPassForm({ ...directPassForm, fecha_inicio: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-zinc-600 mb-1">Vigencia Hasta</label>
                  <input
                    type="date"
                    required
                    value={directPassForm.fecha_fin}
                    onChange={(e) => setDirectPassForm({ ...directPassForm, fecha_fin: e.target.value })}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={directPassForm.requiere_campamento}
                      onChange={(e) => setDirectPassForm({ ...directPassForm, requiere_campamento: e.target.checked })}
                    />
                    <span>Requiere Campamento</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={directPassForm.requiere_comedor}
                      onChange={(e) => setDirectPassForm({ ...directPassForm, requiere_comedor: e.target.checked })}
                    />
                    <span>Requiere Comedor</span>
                  </label>
                </div>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 font-black text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directPassForm.emitir_inmediato}
                    onChange={(e) => setDirectPassForm({ ...directPassForm, emitir_inmediato: e.target.checked })}
                  />
                  <span>Autorizar factores ahora y Emitir Credencial QR lista para imprimir (PDF)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowDirectPassModal(false)} className="px-4 py-2 font-bold text-zinc-500">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDirectPass || directPassForm.selectedPersonalIds.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl shadow"
                >
                  {savingDirectPass ? 'Generando...' : directPassForm.emitir_inmediato ? 'Crear Solicitud & Emitir QR' : 'Crear Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
