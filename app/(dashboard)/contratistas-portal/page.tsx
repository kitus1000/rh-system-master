'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  HardHat,
  Building2,
  Users,
  FileText,
  Upload,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  QrCode,
  Download,
  CalendarPlus,
  Eye,
  ShieldCheck,
  Bed,
  X,
  RefreshCw,
  Camera,
} from 'lucide-react'
import {
  DOCS_EMPRESA_CATALOG,
  DOCS_PERSONAL_CATALOG,
  getDocLabel,
  isSchemaMissingError,
  formatShortDate,
  diffDaysInclusive,
} from '@/utils/contratistasConfig'
import { generateContractorCredentialPDF } from '@/utils/contratistaBadgePdf'

export default function ContratistasPortalPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'personal' | 'empresa' | 'credenciales'>('solicitudes')

  const [empresasList, setEmpresasList] = useState<any[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [empresa, setEmpresa] = useState<any>(null)
  const [personal, setPersonal] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [credenciales, setCredenciales] = useState<any[]>([])
  const [prorrogas, setProrrogas] = useState<any[]>([])
  const [departamentos, setDepartamentos] = useState<any[]>([])

  // Upload Document State
  const [uploadTarget, setUploadTarget] = useState<{ ambito: 'Empresa' | 'Personal'; id_personal?: string; nombre?: string } | null>(null)
  const [docForm, setDocForm] = useState({
    tipo_documento: 'OPINION_SAT',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    file: null as File | null,
  })
  const [uploadingDoc, setUploadingDoc] = useState(false)

  // Add/Edit Worker Modal
  const [showWorkerModal, setShowWorkerModal] = useState(false)
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null)
  const [workerForm, setWorkerForm] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    curp: '',
    nss: '',
    rfc: '',
    puesto_servicio: 'Técnico Especialista',
    telefono: '',
    tipo_sangre: 'O+',
    contacto_emergencia: '',
    foto_url: '',
  })
  const [workerPhotoFile, setWorkerPhotoFile] = useState<File | null>(null)
  const [savingWorker, setSavingWorker] = useState(false)

  // New Access Request Modal
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({
    id_departamento_objetivo: '',
    contacto_departamento: '',
    descripcion_servicio: '',
    area_trabajo: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    requiere_campamento: false,
    requiere_comedor: true,
    selectedPersonalIds: [] as string[],
  })
  const [savingRequest, setSavingRequest] = useState(false)

  // Chat Modal per Request
  const [chatSolicitud, setChatSolicitud] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  // Extension (Prórroga) Modal
  const [prorrogaTarget, setProrrogaTarget] = useState<any>(null)
  const [prorrogaForm, setProrrogaForm] = useState({
    nueva_fecha_fin: '',
    motivo: '',
  })
  const [savingProrroga, setSavingProrroga] = useState(false)

  // Preview Doc Modal
  const [previewDoc, setPreviewDoc] = useState<any>(null)

  // Worker Docs Drawer
  const [workerDocsModal, setWorkerDocsModal] = useState<any>(null)

  useEffect(() => {
    initPortal()
  }, [profile, user])

  const initPortal = async () => {
    if (!profile && !user) return
    setLoading(true)
    try {
      const { data: deps } = await supabase.from('cat_departamentos').select('*').eq('activo', true).order('departamento')
      if (deps) setDepartamentos(deps)

      let empId = profile?.id_empresa_contratista || user?.user_metadata?.id_empresa_contratista || ''

      const { data: allEmps, error: empErr } = await supabase
        .from('contratistas_empresas')
        .select('*')
        .order('razon_social')

      if (empErr) {
        if (isSchemaMissingError(empErr)) setSchemaMissing(true)
        setLoading(false)
        return
      }

      setEmpresasList(allEmps || [])

      if (!empId && user?.email && allEmps) {
        const byEmail = allEmps.find((e) => (e.correo || '').toLowerCase() === user.email.toLowerCase())
        if (byEmail) empId = byEmail.id_empresa
      }

      if (!empId && allEmps && allEmps.length > 0 && profile?.rol !== 'Contratista') {
        empId = allEmps[0].id_empresa
      }

      if (empId) {
        setSelectedEmpresaId(empId)
        await fetchCompanyData(empId)
      }
    } catch (e) {
      console.error('Error initializing contractor portal:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyData = async (empId: string) => {
    if (!empId) return
    const { data: empObj } = await supabase
      .from('contratistas_empresas')
      .select('*')
      .eq('id_empresa', empId)
      .maybeSingle()
    setEmpresa(empObj)

    const [persRes, docsRes, solRes, credRes, prorRes] = await Promise.all([
      supabase.from('contratistas_personal').select('*').eq('id_empresa', empId).order('creado_el', { ascending: false }),
      supabase.from('contratistas_documentos').select('*').eq('id_empresa', empId).order('creado_el', { ascending: false }),
      supabase
        .from('contratistas_solicitudes')
        .select('*, contratistas_solicitud_personal(*, contratistas_personal(*))')
        .eq('id_empresa', empId)
        .order('creado_el', { ascending: false }),
      supabase
        .from('contratistas_credenciales')
        .select('*, contratistas_personal(*), contratistas_solicitudes(folio, departamento_nombre, area_trabajo)')
        .eq('id_empresa', empId)
        .order('creado_el', { ascending: false }),
      supabase.from('contratistas_prorrogas').select('*').eq('id_empresa', empId).order('creado_el', { ascending: false }),
    ])

    setPersonal(persRes.data || [])
    setDocumentos(docsRes.data || [])
    setSolicitudes(solRes.data || [])
    setCredenciales(credRes.data || [])
    setProrrogas(prorRes.data || [])
  }

  const uploadFileToServer = async (file: File, folder: string): Promise<{ url: string; mimeType: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    const res = await fetch('/api/contratistas/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Error al subir archivo')
    return { url: json.url, mimeType: json.mimeType || file.type }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadTarget || !docForm.file || !selectedEmpresaId) return
    setUploadingDoc(true)
    try {
      const folder = `${selectedEmpresaId}/${uploadTarget.ambito.toLowerCase()}`
      const { url, mimeType } = await uploadFileToServer(docForm.file, folder)

      const { error } = await supabase.from('contratistas_documentos').insert([
        {
          id_empresa: selectedEmpresaId,
          id_personal: uploadTarget.id_personal || null,
          ambito: uploadTarget.ambito,
          tipo_documento: docForm.tipo_documento,
          nombre_archivo: docForm.file.name,
          archivo_url: url,
          mime_type: mimeType,
          fecha_emision: docForm.fecha_emision || null,
          fecha_vencimiento: docForm.fecha_vencimiento || null,
          estatus: 'Pendiente',
        },
      ])
      if (error) throw error

      setUploadTarget(null)
      setDocForm({
        tipo_documento: 'OPINION_SAT',
        fecha_emision: new Date().toISOString().split('T')[0],
        fecha_vencimiento: '',
        file: null,
      })
      await fetchCompanyData(selectedEmpresaId)
    } catch (err: any) {
      alert('Error subiendo documento: ' + err.message)
    } finally {
      setUploadingDoc(false)
    }
  }

  const handleDeleteDocumento = async (docId: string) => {
    if (!confirm('¿Eliminar este documento?')) return
    await supabase.from('contratistas_documentos').delete().eq('id_documento', docId)
    await fetchCompanyData(selectedEmpresaId)
  }

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmpresaId) return
    setSavingWorker(true)
    try {
      let fotoUrl = workerForm.foto_url
      if (workerPhotoFile) {
        const up = await uploadFileToServer(workerPhotoFile, `${selectedEmpresaId}/fotos`)
        fotoUrl = up.url
      }

      const payload = {
        id_empresa: selectedEmpresaId,
        nombre: workerForm.nombre.trim(),
        apellido_paterno: workerForm.apellido_paterno.trim(),
        apellido_materno: workerForm.apellido_materno.trim(),
        curp: workerForm.curp.trim().toUpperCase(),
        nss: workerForm.nss.trim(),
        rfc: workerForm.rfc.trim().toUpperCase(),
        puesto_servicio: workerForm.puesto_servicio.trim(),
        telefono: workerForm.telefono.trim(),
        tipo_sangre: workerForm.tipo_sangre.trim(),
        contacto_emergencia: workerForm.contacto_emergencia.trim(),
        foto_url: fotoUrl || null,
        actualizado_el: new Date().toISOString(),
      }

      if (editingWorkerId) {
        const { error } = await supabase.from('contratistas_personal').update(payload).eq('id_personal', editingWorkerId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contratistas_personal').insert([{ ...payload, estatus: 'Activo' }])
        if (error) throw error
      }

      setShowWorkerModal(false)
      setEditingWorkerId(null)
      setWorkerPhotoFile(null)
      await fetchCompanyData(selectedEmpresaId)
    } catch (err: any) {
      alert('Error guardando trabajador: ' + err.message)
    } finally {
      setSavingWorker(false)
    }
  }

  const handleDeleteWorker = async (worker: any) => {
    if (worker.estatus === 'En Mina') {
      alert('No puedes eliminar a un trabajador que actualmente se encuentra En Mina. Primero debe registrar su salida y entregar su credencial.')
      return
    }
    if (!confirm(`¿Eliminar permanentemente a "${worker.nombre} ${worker.apellido_paterno}" de tu plantilla?`)) return
    const { error } = await supabase.from('contratistas_personal').delete().eq('id_personal', worker.id_personal)
    if (error) {
      alert('Error eliminando trabajador: ' + error.message)
      return
    }
    await fetchCompanyData(selectedEmpresaId)
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmpresaId) return
    if (requestForm.selectedPersonalIds.length === 0) {
      alert('Selecciona al menos un trabajador de tu plantilla para ingresar a la mina.')
      return
    }
    setSavingRequest(true)
    try {
      const deptObj = departamentos.find((d) => d.id_departamento === requestForm.id_departamento_objetivo)
      const folio = `CONT-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`

      const { data: sol, error: solErr } = await supabase
        .from('contratistas_solicitudes')
        .insert([
          {
            folio,
            id_empresa: selectedEmpresaId,
            id_departamento_objetivo: requestForm.id_departamento_objetivo || null,
            departamento_nombre: deptObj?.departamento || 'Mantenimiento / Servicios',
            contacto_departamento: requestForm.contacto_departamento,
            descripcion_servicio: requestForm.descripcion_servicio,
            area_trabajo: requestForm.area_trabajo,
            fecha_inicio: requestForm.fecha_inicio,
            fecha_fin: requestForm.fecha_fin,
            requiere_campamento: requestForm.requiere_campamento,
            requiere_comedor: requestForm.requiere_comedor,
            estatus_general: 'En Revisión',
            estatus_documentos: empresaDocsStats.missingRequired.length === 0 ? 'Completo' : 'Pendiente',
            estatus_departamento: 'Pendiente',
            estatus_seguridad: 'Pendiente',
            estatus_campamento: requestForm.requiere_campamento ? 'Pendiente' : 'No Requiere',
            estatus_rh: 'Pendiente',
          },
        ])
        .select()
        .single()

      if (solErr) throw solErr

      const items = requestForm.selectedPersonalIds.map((pid) => ({
        id_solicitud: sol.id_solicitud,
        id_personal: pid,
        induccion_verificada: Boolean(personal.find((p) => p.id_personal === pid)?.induccion_aprobada),
      }))
      const { error: itemsErr } = await supabase.from('contratistas_solicitud_personal').insert(items)
      if (itemsErr) throw itemsErr

      await supabase.from('contratistas_mensajes').insert([
        {
          id_solicitud: sol.id_solicitud,
          id_empresa: selectedEmpresaId,
          remitente_id: user?.id || null,
          remitente_nombre: empresa?.razon_social || profile?.nombre_completo || 'Contratista',
          remitente_rol: 'Contratista',
          mensaje: `Solicitud ${folio} enviada para el área ${deptObj?.departamento || 'Servicios'}. Personal contemplado: ${requestForm.selectedPersonalIds.length} trabajador(es). Servicio: ${requestForm.descripcion_servicio}`,
        },
      ])

      setShowRequestModal(false)
      setRequestForm({
        id_departamento_objetivo: '',
        contacto_departamento: '',
        descripcion_servicio: '',
        area_trabajo: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        requiere_campamento: false,
        requiere_comedor: true,
        selectedPersonalIds: [],
      })
      await fetchCompanyData(selectedEmpresaId)
    } catch (err: any) {
      alert('Error creando solicitud: ' + err.message)
    } finally {
      setSavingRequest(false)
    }
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
    if (!chatSolicitud || !newMessage.trim() || !selectedEmpresaId) return
    setSendingMsg(true)
    try {
      const { data, error } = await supabase
        .from('contratistas_mensajes')
        .insert([
          {
            id_solicitud: chatSolicitud.id_solicitud,
            id_empresa: selectedEmpresaId,
            remitente_id: user?.id || null,
            remitente_nombre: empresa?.razon_social || profile?.nombre_completo || 'Contratista',
            remitente_rol: 'Contratista',
            mensaje: newMessage.trim(),
          },
        ])
        .select()
        .single()
      if (!error && data) {
        setMensajes((prev) => [...prev, data])
        setNewMessage('')
      }
    } finally {
      setSendingMsg(false)
    }
  }

  const handleSubmitProrroga = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prorrogaTarget || !prorrogaForm.nueva_fecha_fin || !prorrogaForm.motivo.trim()) return
    setSavingProrroga(true)
    try {
      const { error } = await supabase.from('contratistas_prorrogas').insert([
        {
          id_solicitud: prorrogaTarget.id_solicitud,
          id_credencial: prorrogaTarget.id_credencial || null,
          id_empresa: selectedEmpresaId,
          fecha_fin_anterior: prorrogaTarget.vigencia_hasta,
          fecha_fin_solicitada: prorrogaForm.nueva_fecha_fin,
          motivo: prorrogaForm.motivo.trim(),
          solicitado_por: empresa?.razon_social || profile?.nombre_completo || 'Contratista',
          estatus_general: 'Pendiente',
        },
      ])
      if (error) throw error

      await supabase
        .from('contratistas_solicitudes')
        .update({ estatus_general: 'Prórroga Solicitada', actualizado_el: new Date().toISOString() })
        .eq('id_solicitud', prorrogaTarget.id_solicitud)

      await supabase.from('contratistas_mensajes').insert([
        {
          id_solicitud: prorrogaTarget.id_solicitud,
          id_empresa: selectedEmpresaId,
          remitente_id: user?.id || null,
          remitente_nombre: empresa?.razon_social || 'Contratista',
          remitente_rol: 'Contratista',
          mensaje: `SOLICITUD DE PRÓRROGA (Más días en mina): Se solicita extender estadía hasta ${formatShortDate(prorrogaForm.nueva_fecha_fin)}. Motivo: ${prorrogaForm.motivo}`,
        },
      ])

      setProrrogaTarget(null)
      setProrrogaForm({ nueva_fecha_fin: '', motivo: '' })
      await fetchCompanyData(selectedEmpresaId)
      alert('Solicitud de extensión de días enviada para aprobación de Departamento, Seguridad, Campamentos y RH.')
    } catch (err: any) {
      alert('Error enviando prórroga: ' + err.message)
    } finally {
      setSavingProrroga(false)
    }
  }

  const handleDownloadBadge = async (cred: any) => {
    const p = cred.contratistas_personal
    if (!p || !empresa) return
    await generateContractorCredentialPDF({
      codigo_qr: cred.codigo_qr,
      nombre_completo: `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno || ''}`.trim(),
      empresa: empresa.razon_social,
      rfc_empresa: empresa.rfc,
      puesto: p.puesto_servicio || 'Contratista',
      nss: p.nss,
      curp: p.curp,
      tipo_sangre: p.tipo_sangre,
      contacto_emergencia: p.contacto_emergencia,
      departamento_autorizado: cred.contratistas_solicitudes?.departamento_nombre || 'Servicios',
      area_trabajo: cred.contratistas_solicitudes?.area_trabajo,
      vigencia_desde: cred.vigencia_desde,
      vigencia_hasta: cred.vigencia_hasta,
      folio_solicitud: cred.contratistas_solicitudes?.folio || 'N/A',
      foto_url: p.foto_url,
      estatus: cred.estatus,
    })
  }

  const empresaDocs = useMemo(() => documentos.filter((d) => d.ambito === 'Empresa'), [documentos])

  const empresaDocsStats = useMemo(() => {
    const requiredCodes = DOCS_EMPRESA_CATALOG.filter((c) => c.required).map((c) => c.code)
    const uploadedCodes = new Set(empresaDocs.map((d) => d.tipo_documento))
    const missingRequired = requiredCodes.filter((c) => !uploadedCodes.has(c))
    const approvedCount = empresaDocs.filter((d) => d.estatus === 'Aprobado').length
    return { missingRequired, approvedCount, totalUploaded: empresaDocs.length }
  }, [empresaDocs])

  const getWorkerDocs = (idPersonal: string) => documentos.filter((d) => d.id_personal === idPersonal)

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (schemaMissing) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-amber-50 border-2 border-amber-300 rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-black text-zinc-900 uppercase">Módulo de Contratistas Pendiente de Migración SQL</h2>
        <p className="text-sm text-zinc-700">
          Ejecuta <code className="bg-amber-100 px-2 py-0.5 rounded font-mono">SQL_INTEGRACION_Y_CONTRATISTAS.sql</code> en el Editor SQL de Supabase para activar el portal completo de contratistas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/15 via-transparent to-amber-500/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
              <HardHat className="w-7 h-7 text-orange-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-400">
                Portal Individual de Contratistas
              </span>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                {empresa ? empresa.razon_social : 'Sin Empresa Vinculada'}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                {empresa ? `RFC: ${empresa.rfc} • Representante: ${empresa.representante_legal || 'N/D'}` : 'Contacta a RH para vincular tu usuario a una empresa contratista.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profile?.rol !== 'Contratista' && empresasList.length > 0 && (
              <select
                value={selectedEmpresaId}
                onChange={(e) => {
                  setSelectedEmpresaId(e.target.value)
                  fetchCompanyData(e.target.value)
                }}
                className="bg-zinc-900 border border-zinc-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl"
              >
                {empresasList.map((emp) => (
                  <option key={emp.id_empresa} value={emp.id_empresa}>
                    Vista Previa: {emp.razon_social}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => selectedEmpresaId && fetchCompanyData(selectedEmpresaId)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Personal Registrado</span>
            <p className="text-2xl font-black text-white mt-1">{personal.length}</p>
          </div>
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Docs. Empresa</span>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {empresaDocsStats.totalUploaded}{' '}
              <span className="text-xs font-normal text-zinc-400">({empresaDocsStats.approvedCount} aprob.)</span>
            </p>
          </div>
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Solicitudes Activas</span>
            <p className="text-2xl font-black text-cyan-400 mt-1">{solicitudes.length}</p>
          </div>
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">En Mina / Credenciales</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {credenciales.filter((c) => c.estatus === 'En Mina').length}{' '}
              <span className="text-xs font-normal text-zinc-400">/ {credenciales.length} emitidas</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        {[
          { id: 'solicitudes', label: '1. Solicitudes de Ingreso Multi-Factor', icon: ShieldCheck },
          { id: 'personal', label: '2. Mi Personal (Altas, Bajas, NSS/IMSS)', icon: Users },
          { id: 'empresa', label: '3. Documentos Fiscales (SAT, IMSS, Permisos)', icon: Building2 },
          { id: 'credenciales', label: '4. Credenciales QR & Prórrogas en Mina', icon: QrCode },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                active ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: SOLICITUDES MULTI-FACTOR */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-zinc-900 uppercase">Solicitudes de Acceso a Mina</h2>
              <p className="text-xs text-zinc-500">
                Cada solicitud pasa por validación de Documentación, Departamento Interesado, Inducción de Seguridad, Disponibilidad de Campamentos y RH.
              </p>
            </div>
            <button
              onClick={() => setShowRequestModal(true)}
              disabled={!selectedEmpresaId || personal.length === 0}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Solicitud de Ingreso</span>
            </button>
          </div>

          {personal.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-center justify-between">
              <span>Primero registra a los trabajadores que enviarán a la mina en la pestaña <strong>"2. Mi Personal"</strong>.</span>
              <button onClick={() => setActiveTab('personal')} className="px-3 py-1.5 bg-amber-500 text-black font-black rounded-lg">
                Ir a Mi Personal
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {solicitudes.map((sol) => (
              <div key={sol.id_solicitud} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm bg-zinc-900 text-amber-400 px-3 py-1 rounded-lg">{sol.folio}</span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${badgeClass(sol.estatus_general)}`}>
                        {sol.estatus_general}
                      </span>
                      <span className="text-xs font-bold text-zinc-600">
                        Área: <strong className="text-zinc-900">{sol.departamento_nombre}</strong>
                      </span>
                    </div>
                    <p className="text-sm font-bold text-zinc-800 mt-2">{sol.descripcion_servicio}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Vigencia solicitada: <strong>{formatShortDate(sol.fecha_inicio)}</strong> al <strong>{formatShortDate(sol.fecha_fin)}</strong> ({diffDaysInclusive(sol.fecha_inicio, sol.fecha_fin)} días)
                      {sol.requiere_campamento && ' • 🏕️ Requiere Campamento'}
                      {sol.requiere_comedor && ' • 🍽️ Requiere Comedor'}
                    </p>
                  </div>

                  <button
                    onClick={() => openChat(sol)}
                    className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 text-orange-400" />
                    <span>Comunicación con Áreas</span>
                  </button>
                </div>

                {/* 5-Factor Pipeline */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">1. Documentos</span>
                    <span className={`mt-1 inline-block text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_documentos)}`}>
                      {sol.estatus_documentos}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">2. Depto. Interesado</span>
                    <span className={`mt-1 inline-block text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_departamento)}`}>
                      {sol.estatus_departamento}
                    </span>
                    {sol.notas_departamento && <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{sol.notas_departamento}</p>}
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">3. Seguridad / Inducción</span>
                    <span className={`mt-1 inline-block text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_seguridad)}`}>
                      {sol.estatus_seguridad}
                    </span>
                    {sol.fecha_induccion_programada && (
                      <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 mt-1">
                        📅 Cita Inducción: {formatShortDate(sol.fecha_induccion_programada)} {sol.hora_induccion || ''} • {sol.lugar_induccion || ''}
                      </p>
                    )}
                    {sol.notas_seguridad && !sol.fecha_induccion_programada && <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{sol.notas_seguridad}</p>}
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">4. Campamentos</span>
                    <span className={`mt-1 inline-block text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_campamento)}`}>
                      {sol.estatus_campamento}
                    </span>
                    {sol.notas_campamento && <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{sol.notas_campamento}</p>}
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">5. Autorización RH</span>
                    <span className={`mt-1 inline-block text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(sol.estatus_rh)}`}>
                      {sol.estatus_rh}
                    </span>
                  </div>
                </div>

                {/* Workers included */}
                {sol.contratistas_solicitud_personal?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sol.contratistas_solicitud_personal.map((item: any) => (
                      <div key={item.id_item} className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl text-xs">
                        <span className="font-bold text-zinc-800">
                          {item.contratistas_personal?.nombre} {item.contratistas_personal?.apellido_paterno}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">NSS: {item.contratistas_personal?.nss || 'S/N'}</span>
                        {item.cama_descripcion && (
                          <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded">
                            🛏️ {item.cama_descripcion}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {solicitudes.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
                Aún no has creado solicitudes de ingreso a mina.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PERSONAL DEL CONTRATISTA */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-zinc-900 uppercase">Plantilla de Personal Contratista</h2>
              <p className="text-xs text-zinc-500">
                Registra, edita o elimina a los trabajadores que enviarás a mina. Adjunta su Alta IMSS, NSS, INE, Certificado Médico y DC-3.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingWorkerId(null)
                setWorkerForm({
                  nombre: '',
                  apellido_paterno: '',
                  apellido_materno: '',
                  curp: '',
                  nss: '',
                  rfc: '',
                  puesto_servicio: 'Técnico Especialista',
                  telefono: '',
                  tipo_sangre: 'O+',
                  contacto_emergencia: '',
                  foto_url: '',
                })
                setShowWorkerModal(true)
              }}
              className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-black text-white font-black text-xs px-5 py-3 rounded-xl shadow-md shrink-0"
            >
              <Plus className="w-4 h-4 text-orange-400" />
              <span>Registrar Trabajador</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personal.map((w) => {
              const wDocs = getWorkerDocs(w.id_personal)
              return (
                <div key={w.id_personal} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-start gap-3">
                    {w.foto_url ? (
                      <img src={w.foto_url} alt={w.nombre} className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-700 font-black flex items-center justify-center shrink-0">
                        {(w.nombre?.[0] || '') + (w.apellido_paterno?.[0] || '')}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-black text-sm text-zinc-900 truncate">
                          {w.nombre} {w.apellido_paterno} {w.apellido_materno}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-500 font-bold">{w.puesto_servicio}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass(w.estatus)}`}>
                          {w.estatus}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${w.induccion_aprobada ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                          {w.induccion_aprobada ? '✓ Inducción OK' : 'Sin Inducción'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-3 text-[11px] font-mono space-y-1 border border-zinc-100">
                    <div><span className="text-zinc-400">NSS:</span> <strong>{w.nss || 'Sin capturar'}</strong></div>
                    <div><span className="text-zinc-400">CURP:</span> <strong>{w.curp || 'Sin capturar'}</strong></div>
                    <div><span className="text-zinc-400">Sangre:</span> <strong>{w.tipo_sangre || 'N/E'}</strong> • <span className="text-zinc-400">Docs:</span> <strong>{wDocs.length}</strong></div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => setWorkerDocsModal(w)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 font-black text-xs py-2 rounded-xl"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Documentos ({wDocs.length})</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingWorkerId(w.id_personal)
                        setWorkerForm({
                          nombre: w.nombre || '',
                          apellido_paterno: w.apellido_paterno || '',
                          apellido_materno: w.apellido_materno || '',
                          curp: w.curp || '',
                          nss: w.nss || '',
                          rfc: w.rfc || '',
                          puesto_servicio: w.puesto_servicio || '',
                          telefono: w.telefono || '',
                          tipo_sangre: w.tipo_sangre || 'O+',
                          contacto_emergencia: w.contacto_emergencia || '',
                          foto_url: w.foto_url || '',
                        })
                        setShowWorkerModal(true)
                      }}
                      className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl"
                      title="Editar trabajador"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorker(w)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl"
                      title="Eliminar trabajador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENTOS DE EMPRESA */}
      {activeTab === 'empresa' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-zinc-900 uppercase">Expediente Fiscal, Seguro y Permisos de Empresa</h2>
              <p className="text-xs text-zinc-500">
                Adjunta PDF o imágenes de Opinión Positiva SAT (32-D), Opinión IMSS, INFONAVIT, CSF, REPSE, Pólizas y Permisos de Trabajo.
              </p>
            </div>
            <button
              onClick={() => {
                setDocForm({ ...docForm, tipo_documento: 'OPINION_SAT' })
                setUploadTarget({ ambito: 'Empresa', nombre: empresa?.razon_social })
              }}
              className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-black text-white font-black text-xs px-5 py-3 rounded-xl shadow-md shrink-0"
            >
              <Upload className="w-4 h-4 text-orange-400" />
              <span>Subir Documento de Empresa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOCS_EMPRESA_CATALOG.map((cat) => {
              const matched = empresaDocs.filter((d) => d.tipo_documento === cat.code)
              return (
                <div key={cat.code} className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-zinc-900">{cat.label}</h3>
                      {cat.required && (
                        <span className="text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded shrink-0">
                          Requerido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{cat.description}</p>
                  </div>

                  <div className="space-y-2">
                    {matched.map((doc) => (
                      <div key={doc.id_documento} className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-800 truncate">{doc.nombre_archivo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badgeClass(doc.estatus)}`}>
                              {doc.estatus}
                            </span>
                            {doc.fecha_vencimiento && (
                              <span className="text-[10px] text-zinc-400">Vence: {formatShortDate(doc.fecha_vencimiento)}</span>
                            )}
                          </div>
                          {doc.comentarios_revision && (
                            <p className="text-[10px] text-rose-600 mt-1">{doc.comentarios_revision}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-700 hover:text-black"
                            title="Ver"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocumento(doc.id_documento)}
                            className="p-1.5 bg-white border border-zinc-200 rounded-lg text-rose-500 hover:bg-rose-50"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setDocForm({ ...docForm, tipo_documento: cat.code })
                      setUploadTarget({ ambito: 'Empresa', nombre: empresa?.razon_social })
                    }}
                    className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{matched.length > 0 ? 'Actualizar Archivo' : 'Adjuntar PDF / Imagen'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CREDENCIALES QR & PRORROGAS */}
      {activeTab === 'credenciales' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
            <h2 className="text-lg font-black text-zinc-900 uppercase">Credenciales QR Autorizadas & Prórrogas de Estadía</h2>
            <p className="text-xs text-zinc-500">
              Descarga las credenciales de acceso para tus trabajadores. Recuerda que deben entregarla en Caseta/Seguridad al salir de la mina. Si requieren más días estando en mina, solicita una prórroga aquí.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {credenciales.map((cred) => {
              const p = cred.contratistas_personal
              const canExtend = cred.estatus === 'En Mina' || cred.estatus === 'Emitida'
              const pendingExt = prorrogas.find((pr) => pr.id_solicitud === cred.id_solicitud && pr.estatus_general === 'Pendiente')
              return (
                <div key={cred.id_credencial} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs font-black bg-zinc-900 text-amber-400 px-2.5 py-1 rounded-lg">
                        {cred.codigo_qr}
                      </span>
                      <h3 className="font-black text-base text-zinc-900 mt-2">
                        {p?.nombre} {p?.apellido_paterno} {p?.apellido_materno}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {p?.puesto_servicio} • Área: <strong>{cred.contratistas_solicitudes?.departamento_nombre}</strong>
                      </p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${badgeClass(cred.estatus)}`}>
                      {cred.estatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl text-xs font-mono border border-zinc-100">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">VIGENCIA</span>
                      <strong>{formatShortDate(cred.vigencia_desde)} → {formatShortDate(cred.vigencia_hasta)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">CONTROL CASETA</span>
                      <strong>
                        {cred.fecha_entrada_mina ? `Entró ${formatShortDate(cred.fecha_entrada_mina)}` : 'Pendiente ingreso'}
                        {cred.credencial_entregada && ' • Devuelta ✓'}
                      </strong>
                    </div>
                  </div>

                  {pendingExt && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-2.5 rounded-xl">
                      ⏳ Prórroga en revisión hasta <strong>{formatShortDate(pendingExt.fecha_fin_solicitada)}</strong>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => handleDownloadBadge(cred)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-black text-white font-black text-xs py-2.5 px-3 rounded-xl"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Descargar Credencial PDF</span>
                    </button>
                    {canExtend && (
                      <button
                        onClick={() => {
                          setProrrogaTarget(cred)
                          setProrrogaForm({ nueva_fecha_fin: cred.vigencia_hasta, motivo: '' })
                        }}
                        className="inline-flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 font-black text-xs py-2.5 px-3 rounded-xl"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>Solicitar Más Días</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {credenciales.length === 0 && (
              <div className="col-span-2 bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
                Aún no tienes credenciales QR emitidas. Completa el proceso de aprobación multi-factor en tus solicitudes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SUBIR DOCUMENTO */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">Subir Documento ({uploadTarget.ambito})</h3>
              <button onClick={() => setUploadTarget(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUploadDocument} className="p-6 space-y-4">
              <p className="text-xs text-zinc-500 font-bold">Para: {uploadTarget.nombre}</p>
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Tipo de Documento</label>
                <select
                  value={docForm.tipo_documento}
                  onChange={(e) => setDocForm({ ...docForm, tipo_documento: e.target.value })}
                  className="w-full text-xs font-bold border border-zinc-300 rounded-xl p-2.5"
                >
                  {(uploadTarget.ambito === 'Empresa' ? DOCS_EMPRESA_CATALOG : DOCS_PERSONAL_CATALOG).map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={docForm.fecha_emision}
                    onChange={(e) => setDocForm({ ...docForm, fecha_emision: e.target.value })}
                    className="w-full text-xs border border-zinc-300 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Vencimiento</label>
                  <input
                    type="date"
                    value={docForm.fecha_vencimiento}
                    onChange={(e) => setDocForm({ ...docForm, fecha_vencimiento: e.target.value })}
                    className="w-full text-xs border border-zinc-300 rounded-xl p-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Archivo (PDF o Imagen)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,image/*"
                  onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                  className="w-full text-xs border border-zinc-300 rounded-xl p-2 bg-zinc-50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setUploadTarget(null)} className="px-4 py-2 text-xs font-bold text-zinc-600">Cancelar</button>
                <button type="submit" disabled={uploadingDoc} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs rounded-xl">
                  {uploadingDoc ? 'Subiendo...' : 'Guardar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENTOS DE UN TRABAJADOR */}
      {workerDocsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-zinc-200 flex flex-col">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase">Expediente del Trabajador</h3>
                <p className="text-xs text-zinc-400">{workerDocsModal.nombre} {workerDocsModal.apellido_paterno} • NSS: {workerDocsModal.nss || 'N/D'}</p>
              </div>
              <button onClick={() => setWorkerDocsModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <button
                onClick={() => {
                  setDocForm({ ...docForm, tipo_documento: 'ALTA_IMSS' })
                  setUploadTarget({
                    ambito: 'Personal',
                    id_personal: workerDocsModal.id_personal,
                    nombre: `${workerDocsModal.nombre} ${workerDocsModal.apellido_paterno}`,
                  })
                }}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Adjuntar Alta IMSS / NSS / INE / Certificado Médico / DC-3</span>
              </button>

              <div className="space-y-2">
                {getWorkerDocs(workerDocsModal.id_personal).map((doc) => (
                  <div key={doc.id_documento} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-orange-700 block">{getDocLabel(doc.tipo_documento)}</span>
                      <p className="text-xs font-bold text-zinc-800 truncate">{doc.nombre_archivo}</p>
                      <span className={`inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded border ${badgeClass(doc.estatus)}`}>
                        {doc.estatus}
                      </span>
                      {doc.comentarios_revision && <p className="text-[10px] text-rose-600 mt-1">{doc.comentarios_revision}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setPreviewDoc(doc)} className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-700"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteDocumento(doc.id_documento)} className="p-2 bg-white border border-zinc-200 rounded-lg text-rose-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                {getWorkerDocs(workerDocsModal.id_personal).length === 0 && (
                  <p className="text-center text-xs text-zinc-400 py-8">Sin documentos adjuntos aún.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR TRABAJADOR */}
      {showWorkerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center sticky top-0">
              <h3 className="font-black text-sm uppercase">{editingWorkerId ? 'Editar Trabajador' : 'Registrar Personal para Mina'}</h3>
              <button onClick={() => setShowWorkerModal(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveWorker} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Nombre *</label>
                  <input required value={workerForm.nombre} onChange={(e) => setWorkerForm({ ...workerForm, nombre: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Apellido Paterno *</label>
                  <input required value={workerForm.apellido_paterno} onChange={(e) => setWorkerForm({ ...workerForm, apellido_paterno: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Apellido Materno</label>
                  <input value={workerForm.apellido_materno} onChange={(e) => setWorkerForm({ ...workerForm, apellido_materno: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">NSS (Seguro Social) *</label>
                  <input required value={workerForm.nss} onChange={(e) => setWorkerForm({ ...workerForm, nss: e.target.value })} placeholder="11 dígitos" className="w-full text-xs font-mono border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">CURP *</label>
                  <input required value={workerForm.curp} onChange={(e) => setWorkerForm({ ...workerForm, curp: e.target.value })} className="w-full text-xs font-mono uppercase border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">RFC</label>
                  <input value={workerForm.rfc} onChange={(e) => setWorkerForm({ ...workerForm, rfc: e.target.value })} className="w-full text-xs font-mono uppercase border border-zinc-300 rounded-xl p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Puesto / Especialidad *</label>
                  <input required value={workerForm.puesto_servicio} onChange={(e) => setWorkerForm({ ...workerForm, puesto_servicio: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Tipo de Sangre</label>
                  <input value={workerForm.tipo_sangre} onChange={(e) => setWorkerForm({ ...workerForm, tipo_sangre: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Teléfono</label>
                  <input value={workerForm.telefono} onChange={(e) => setWorkerForm({ ...workerForm, telefono: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Contacto de Emergencia</label>
                  <input value={workerForm.contacto_emergencia} onChange={(e) => setWorkerForm({ ...workerForm, contacto_emergencia: e.target.value })} placeholder="Nombre y Teléfono" className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Fotografía para Credencial (Opcional)</label>
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-zinc-400" />
                  <input type="file" accept="image/*" onChange={(e) => setWorkerPhotoFile(e.target.files?.[0] || null)} className="text-xs w-full" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowWorkerModal(false)} className="px-4 py-2 text-xs font-bold text-zinc-600">Cancelar</button>
                <button type="submit" disabled={savingWorker} className="px-5 py-2.5 bg-zinc-900 text-white font-black text-xs rounded-xl">
                  {savingWorker ? 'Guardando...' : 'Guardar Trabajador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA SOLICITUD DE INGRESO */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center sticky top-0">
              <h3 className="font-black text-sm uppercase">Nueva Solicitud de Acceso a Mina</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Departamento Interesado *</label>
                  <select
                    required
                    value={requestForm.id_departamento_objetivo}
                    onChange={(e) => setRequestForm({ ...requestForm, id_departamento_objetivo: e.target.value })}
                    className="w-full text-xs font-bold border border-zinc-300 rounded-xl p-2.5"
                  >
                    <option value="">-- Seleccione Departamento --</option>
                    {departamentos.map((d) => (
                      <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Contacto / Supervisor en Mina</label>
                  <input
                    value={requestForm.contacto_departamento}
                    onChange={(e) => setRequestForm({ ...requestForm, contacto_departamento: e.target.value })}
                    placeholder="Nombre del Ing. o Supervisor"
                    className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Servicio / Trabajo a Realizar *</label>
                <textarea
                  required
                  rows={2}
                  value={requestForm.descripcion_servicio}
                  onChange={(e) => setRequestForm({ ...requestForm, descripcion_servicio: e.target.value })}
                  placeholder="Describe los trabajos, proyecto u orden de servicio..."
                  className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Área / Frente de Trabajo</label>
                  <input
                    value={requestForm.area_trabajo}
                    onChange={(e) => setRequestForm({ ...requestForm, area_trabajo: e.target.value })}
                    placeholder="Ej. Planta Beneficio"
                    className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Fecha Entrada *</label>
                  <input
                    type="date"
                    required
                    value={requestForm.fecha_inicio}
                    onChange={(e) => setRequestForm({ ...requestForm, fecha_inicio: e.target.value })}
                    className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Fecha Salida *</label>
                  <input
                    type="date"
                    required
                    value={requestForm.fecha_fin}
                    onChange={(e) => setRequestForm({ ...requestForm, fecha_fin: e.target.value })}
                    className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestForm.requiere_campamento}
                    onChange={(e) => setRequestForm({ ...requestForm, requiere_campamento: e.target.checked })}
                  />
                  <Bed className="w-4 h-4 text-teal-600" />
                  <span>Solicitar Disponibilidad en Campamentos</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestForm.requiere_comedor}
                    onChange={(e) => setRequestForm({ ...requestForm, requiere_comedor: e.target.checked })}
                  />
                  <span>Incluir Acceso a Comedor</span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-2">
                  Selecciona el Personal que Ingresará ({requestForm.selectedPersonalIds.length} seleccionados)
                </label>
                <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100">
                  {personal.map((w) => {
                    const checked = requestForm.selectedPersonalIds.includes(w.id_personal)
                    return (
                      <label key={w.id_personal} className="flex items-center justify-between p-2.5 hover:bg-zinc-50 cursor-pointer text-xs">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRequestForm({ ...requestForm, selectedPersonalIds: [...requestForm.selectedPersonalIds, w.id_personal] })
                              } else {
                                setRequestForm({ ...requestForm, selectedPersonalIds: requestForm.selectedPersonalIds.filter((id) => id !== w.id_personal) })
                              }
                            }}
                          />
                          <span className="font-bold text-zinc-800">{w.nombre} {w.apellido_paterno}</span>
                          <span className="text-zinc-400">({w.puesto_servicio})</span>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500">NSS: {w.nss || 'S/N'}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2 text-xs font-bold text-zinc-600">Cancelar</button>
                <button type="submit" disabled={savingRequest} className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs rounded-xl">
                  {savingRequest ? 'Enviando...' : 'Enviar Solicitud Multi-Factor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHAT CON DEPARTAMENTO / SEGURIDAD / CAMPAMENTOS / RH */}
      {chatSolicitud && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full h-[75vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase">Comunicación Directa • {chatSolicitud.folio}</h3>
                <p className="text-[11px] text-zinc-400">Depto: {chatSolicitud.departamento_nombre}</p>
              </div>
              <button onClick={() => setChatSolicitud(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {mensajes.map((m) => (
                <div key={m.id_mensaje} className={`p-3 rounded-2xl text-xs max-w-[85%] ${m.remitente_rol === 'Contratista' ? 'ml-auto bg-orange-500 text-black font-medium' : 'bg-white border border-zinc-200 text-zinc-800'}`}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="font-black text-[10px] uppercase">{m.remitente_nombre} ({m.remitente_rol})</span>
                  </div>
                  <p>{m.mensaje}</p>
                </div>
              ))}
              {mensajes.length === 0 && <p className="text-center text-xs text-zinc-400 py-8">Sin mensajes aún. Escribe para coordinar tu ingreso.</p>}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-200 flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje a Departamento, Seguridad, Campamentos o RH..."
                className="flex-1 text-xs border border-zinc-300 rounded-xl px-3 py-2.5"
              />
              <button type="submit" disabled={sendingMsg} className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black flex items-center gap-1">
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR MÁS DÍAS (PRÓRROGA) */}
      {prorrogaTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">Solicitar Más Días en Mina</h3>
              <button onClick={() => setProrrogaTarget(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitProrroga} className="p-6 space-y-4">
              <p className="text-xs text-zinc-600">
                Credencial: <strong className="font-mono">{prorrogaTarget.codigo_qr}</strong> • Vencimiento actual: <strong>{formatShortDate(prorrogaTarget.vigencia_hasta)}</strong>
              </p>
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nueva Fecha de Salida *</label>
                <input
                  type="date"
                  required
                  min={prorrogaTarget.vigencia_hasta}
                  value={prorrogaForm.nueva_fecha_fin}
                  onChange={(e) => setProrrogaForm({ ...prorrogaForm, nueva_fecha_fin: e.target.value })}
                  className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Motivo / Justificación de Extensión *</label>
                <textarea
                  required
                  rows={3}
                  value={prorrogaForm.motivo}
                  onChange={(e) => setProrrogaForm({ ...prorrogaForm, motivo: e.target.value })}
                  placeholder="Ej. Extensión de mantenimiento en molino / espera de refacciones..."
                  className="w-full text-xs border border-zinc-300 rounded-xl p-2.5"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setProrrogaTarget(null)} className="px-4 py-2 text-xs font-bold text-zinc-600">Cancelar</button>
                <button type="submit" disabled={savingProrroga} className="px-5 py-2.5 bg-orange-500 text-black font-black text-xs rounded-xl">
                  {savingProrroga ? 'Enviando...' : 'Enviar Prórroga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW DOCUMENTO */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 text-white p-4 flex justify-between items-center">
              <span className="text-xs font-black uppercase truncate">{getDocLabel(previewDoc.tipo_documento)} — {previewDoc.nombre_archivo}</span>
              <div className="flex items-center gap-3">
                <a href={previewDoc.archivo_url} target="_blank" rel="noreferrer" className="text-xs text-amber-400 font-bold hover:underline">
                  Abrir en nueva pestaña
                </a>
                <button onClick={() => setPreviewDoc(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 bg-zinc-100 flex items-center justify-center overflow-auto p-4">
              {previewDoc.mime_type?.includes('image') || /\.(png|jpg|jpeg|webp)$/i.test(previewDoc.archivo_url) ? (
                <img src={previewDoc.archivo_url} alt={previewDoc.nombre_archivo} className="max-h-full max-w-full object-contain rounded-lg shadow" />
              ) : (
                <iframe src={previewDoc.archivo_url} className="w-full h-full rounded-lg border border-zinc-300 bg-white" title={previewDoc.nombre_archivo} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
