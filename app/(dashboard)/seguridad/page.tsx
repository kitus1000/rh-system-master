'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import jsQR from 'jsqr'
import {
  ShieldCheck,
  QrCode,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  Camera,
  StopCircle,
  Search,
  RefreshCw,
  AlertTriangle,
  Eye,
  X,
  HardHat,
} from 'lucide-react'
import { formatShortDate, getDocLabel, isSchemaMissingError } from '@/utils/contratistasConfig'

export default function SeguridadCasetaPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [activeTab, setActiveTab] = useState<'caseta' | 'inducciones'>('caseta')

  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [credenciales, setCredenciales] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])

  const [qrSearch, setQrSearch] = useState('')
  const [casetaLugar, setCasetaLugar] = useState('Caseta Principal Mina')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [chatSolicitud, setChatSolicitud] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [previewDoc, setPreviewDoc] = useState<any>(null)

  useEffect(() => {
    fetchAll()
    return () => stopCamera()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { data: solData, error: solErr } = await supabase
        .from('contratistas_solicitudes')
        .select('*, contratistas_empresas(*), contratistas_solicitud_personal(*, contratistas_personal(*))')
        .order('creado_el', { ascending: false })

      if (solErr) {
        if (isSchemaMissingError(solErr)) setSchemaMissing(true)
        setLoading(false)
        return
      }

      const [credRes, docRes, movRes] = await Promise.all([
        supabase
          .from('contratistas_credenciales')
          .select('*, contratistas_empresas(razon_social), contratistas_personal(*), contratistas_solicitudes(folio, departamento_nombre, area_trabajo)')
          .order('creado_el', { ascending: false }),
        supabase.from('contratistas_documentos').select('*').order('creado_el', { ascending: false }),
        supabase
          .from('contratistas_movimientos_bitacora')
          .select('*, contratistas_empresas(razon_social), contratistas_personal(nombre, apellido_paterno), contratistas_credenciales(codigo_qr)')
          .order('fecha_hora', { ascending: false })
          .limit(30),
      ])

      setSolicitudes(solData || [])
      setCredenciales(credRes.data || [])
      setDocumentos(docRes.data || [])
      setMovimientos(movRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setCameraActive(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          requestAnimationFrame(scanFrame)
        }
      }, 150)
    } catch (err: any) {
      alert('No se pudo abrir la cámara: ' + err.message)
    }
  }

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code && code.data) {
          setQrSearch(code.data)
          stopCamera()
          return
        }
      }
    }
    requestAnimationFrame(scanFrame)
  }

  const handleCheckIn = async (cred: any) => {
    const today = new Date().toISOString().split('T')[0]
    if (cred.vigencia_hasta < today) {
      if (!confirm(`⚠️ La credencial ${cred.codigo_qr} venció el ${formatShortDate(cred.vigencia_hasta)}. ¿Deseas continuar?`)) return
    }
    const nowIso = new Date().toISOString()
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
        caseta_lugar: casetaLugar,
        registrado_por: profile?.nombre_completo || 'Seguridad Caseta',
      },
    ])
    setQrSearch('')
    await fetchAll()
  }

  const handleCheckOutReturnBadge = async (cred: any) => {
    const nowIso = new Date().toISOString()
    await supabase
      .from('contratistas_credenciales')
      .update({
        estatus: 'Devuelta',
        fecha_salida_mina: nowIso,
        credencial_entregada: true,
        recibido_por: profile?.nombre_completo || 'Seguridad Caseta',
      })
      .eq('id_credencial', cred.id_credencial)
    await supabase
      .from('contratistas_personal')
      .update({ estatus: 'Activo' })
      .eq('id_personal', cred.id_personal)

    // Auto-release camp bed if assigned
    await supabase
      .from('campamento_camas')
      .update({ id_contratista_personal: null, ocupado_por_nombre: null })
      .eq('id_contratista_personal', cred.id_personal)

    await supabase.from('contratistas_movimientos_bitacora').insert([
      {
        id_credencial: cred.id_credencial,
        id_personal: cred.id_personal,
        id_empresa: cred.id_empresa,
        tipo_movimiento: 'Entrega Credencial',
        caseta_lugar: casetaLugar,
        registrado_por: profile?.nombre_completo || 'Seguridad Caseta',
        observaciones: 'Salida de mina y devolución física de credencial',
      },
    ])
    setQrSearch('')
    await fetchAll()
  }

  const handleToggleInduccionWorker = async (worker: any) => {
    const nextVal = !worker.induccion_aprobada
    const today = new Date().toISOString().split('T')[0]
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    await supabase
      .from('contratistas_personal')
      .update({
        induccion_aprobada: nextVal,
        fecha_induccion: nextVal ? today : null,
        vigencia_induccion: nextVal ? nextYear : null,
      })
      .eq('id_personal', worker.id_personal)
    await fetchAll()
  }

  const handleSeguridadDecision = async (sol: any, status: 'Aprobado' | 'Rechazado' | 'En Diálogo') => {
    const note = prompt(`Observaciones de Seguridad (${status}):`, '')
    if (note === null) return
    const actor = profile?.nombre_completo || 'Seguridad Industrial'
    await supabase
      .from('contratistas_solicitudes')
      .update({
        estatus_seguridad: status,
        aprobado_seguridad_por: actor,
        fecha_aprobacion_seguridad: new Date().toISOString(),
        notas_seguridad: note || null,
        ...(status === 'Rechazado' ? { estatus_general: 'Rechazada' } : {}),
        actualizado_el: new Date().toISOString(),
      })
      .eq('id_solicitud', sol.id_solicitud)

    await supabase.from('contratistas_mensajes').insert([
      {
        id_solicitud: sol.id_solicitud,
        id_empresa: sol.id_empresa,
        remitente_id: user?.id || null,
        remitente_nombre: actor,
        remitente_rol: 'Seguridad',
        mensaje: `Seguridad / Inducción marcada como "${status}".${note ? ` Nota: ${note}` : ''}`,
      },
    ])
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
          remitente_nombre: profile?.nombre_completo || 'Seguridad Industrial',
          remitente_rol: 'Seguridad',
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

  const filteredCredenciales = credenciales.filter((c) => {
    const q = qrSearch.trim().toLowerCase()
    if (!q) return c.estatus === 'Emitida' || c.estatus === 'En Mina'
    const full = `${c.codigo_qr} ${c.contratistas_personal?.nombre || ''} ${c.contratistas_personal?.apellido_paterno || ''} ${c.contratistas_empresas?.razon_social || ''}`.toLowerCase()
    return full.includes(q)
  })

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  if (schemaMissing) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-amber-50 border-2 border-amber-300 rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-black text-zinc-900 uppercase">Módulo Pendiente de Migración SQL</h2>
        <p className="text-sm text-zinc-700">
          Ejecuta <code className="bg-amber-100 px-2 py-0.5 rounded font-mono">SQL_INTEGRACION_Y_CONTRATISTAS.sql</code> en Supabase.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
              Seguridad Industrial & Caseta de Vigilancia
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Control de Inducciones y Credenciales QR
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Verifica inducciones de seguridad y registra entradas, salidas y entrega física de credenciales al retirarse de mina.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-xs">
            <span className="text-zinc-400 block text-[10px] uppercase">En Mina Ahora</span>
            <strong className="text-emerald-400 text-lg font-black">{credenciales.filter((c) => c.estatus === 'En Mina').length}</strong>
          </div>
          <button onClick={fetchAll} className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        <button
          onClick={() => setActiveTab('caseta')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'caseta' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>Caseta: Entradas, Salidas y Devolución QR</span>
        </button>
        <button
          onClick={() => setActiveTab('inducciones')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'inducciones' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <HardHat className="w-4 h-4 text-orange-400" />
          <span>Validación de Inducciones & Documentos ({solicitudes.filter((s) => s.estatus_seguridad === 'Pendiente').length})</span>
        </button>
      </div>

      {/* TAB 1: CASETA QR */}
      {activeTab === 'caseta' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h2 className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-600" />
                <span>Escáner / Búsqueda de Credencial</span>
              </h2>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Ubicación de Caseta</label>
                <input value={casetaLugar} onChange={(e) => setCasetaLugar(e.target.value)} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                <input
                  value={qrSearch}
                  onChange={(e) => setQrSearch(e.target.value)}
                  placeholder="Escanear CONT-26-XXXX o buscar por nombre..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-zinc-300 rounded-xl"
                />
              </div>

              {!cameraActive ? (
                <button onClick={startCamera} className="w-full py-2.5 bg-zinc-900 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span>Abrir Cámara para Escanear QR</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <video ref={videoRef} className="w-full rounded-xl border border-zinc-300 bg-black" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <button onClick={stopCamera} className="w-full py-2 bg-rose-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2">
                    <StopCircle className="w-4 h-4" /> Detener Cámara
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-3">
              <h3 className="font-black text-xs uppercase text-zinc-700">Últimos Movimientos Registrados</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {movimientos.map((m) => (
                  <div key={m.id_movimiento} className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-100 text-xs flex justify-between">
                    <div>
                      <span className="font-black text-zinc-800">{m.tipo_movimiento}</span> • {m.contratistas_personal?.nombre} {m.contratistas_personal?.apellido_paterno}
                      <div className="text-[10px] text-zinc-400 font-mono">{m.contratistas_credenciales?.codigo_qr}</div>
                    </div>
                    <span className="text-[10px] text-zinc-500">{new Date(m.fecha_hora).toLocaleTimeString('es-MX')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {filteredCredenciales.map((cred) => {
              const p = cred.contratistas_personal
              return (
                <div key={cred.id_credencial} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs bg-zinc-900 text-cyan-400 px-2.5 py-1 rounded-lg">{cred.codigo_qr}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${cred.estatus === 'En Mina' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                        {cred.estatus}
                      </span>
                    </div>
                    <h3 className="font-black text-base text-zinc-900 mt-1.5">
                      {p?.nombre} {p?.apellido_paterno} {p?.apellido_materno}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {cred.contratistas_empresas?.razon_social} • Área: <strong>{cred.contratistas_solicitudes?.departamento_nombre}</strong>
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      Vigencia: {formatShortDate(cred.vigencia_desde)} → {formatShortDate(cred.vigencia_hasta)} • NSS: {p?.nss || 'N/D'}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {cred.estatus === 'Emitida' && (
                      <button
                        onClick={() => handleCheckIn(cred)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl inline-flex items-center gap-1.5 shadow"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Registrar Entrada</span>
                      </button>
                    )}
                    {cred.estatus === 'En Mina' && (
                      <button
                        onClick={() => handleCheckOutReturnBadge(cred)}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl inline-flex items-center gap-1.5 shadow"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Registrar Salida y Entregar Credencial</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredCredenciales.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
                No hay credenciales coincidentes para entrada o salida.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INDUCCIONES DE SEGURIDAD */}
      {activeTab === 'inducciones' && (
        <div className="space-y-4">
          {solicitudes.map((sol) => (
            <div key={sol.id_solicitud} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs bg-zinc-900 text-cyan-400 px-2.5 py-1 rounded-lg">{sol.folio}</span>
                    <h3 className="font-black text-base text-zinc-900">{sol.contratistas_empresas?.razon_social}</h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                      Seguridad: {sol.estatus_seguridad}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Servicio: {sol.descripcion_servicio} • Área: <strong>{sol.departamento_nombre}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openChat(sol)} className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-black rounded-xl inline-flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                  <button onClick={() => handleSeguridadDecision(sol, 'Aprobado')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar Inducción
                  </button>
                  <button onClick={() => handleSeguridadDecision(sol, 'Rechazado')} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl inline-flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(sol.contratistas_solicitud_personal || []).map((item: any) => {
                  const w = item.contratistas_personal
                  if (!w) return null
                  const wDocs = documentos.filter((d) => d.id_personal === w.id_personal)
                  return (
                    <div key={item.id_item} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-black text-sm text-zinc-900">{w.nombre} {w.apellido_paterno}</p>
                          <p className="text-[11px] font-mono text-zinc-500">NSS: {w.nss || 'Sin NSS'} • {w.puesto_servicio}</p>
                        </div>
                        <button
                          onClick={() => handleToggleInduccionWorker(w)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black border ${
                            w.induccion_aprobada
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                          }`}
                        >
                          {w.induccion_aprobada ? '✓ Inducción Vigente' : 'Marcar Inducción OK'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {wDocs.map((d) => (
                          <button
                            key={d.id_documento}
                            onClick={() => setPreviewDoc(d)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-zinc-200 px-2 py-1 rounded-lg hover:border-cyan-400"
                          >
                            <Eye className="w-3 h-3 text-cyan-600" />
                            <span>{getDocLabel(d.tipo_documento).split('(')[0]}</span>
                          </button>
                        ))}
                        {wDocs.length === 0 && <span className="text-[10px] text-rose-500 font-bold">Sin documentos personales adjuntos</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHAT MODAL */}
      {chatSolicitud && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full h-[75vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">Seguridad ↔ Contratista ({chatSolicitud.folio})</h3>
              <button onClick={() => setChatSolicitud(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {mensajes.map((m) => (
                <div key={m.id_mensaje} className={`p-3 rounded-2xl text-xs max-w-[85%] ${m.remitente_rol !== 'Contratista' ? 'ml-auto bg-cyan-600 text-white' : 'bg-white border border-zinc-200 text-zinc-800'}`}>
                  <span className="font-black text-[10px] uppercase block mb-1 opacity-80">{m.remitente_nombre} ({m.remitente_rol})</span>
                  <p>{m.mensaje}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-200 flex gap-2">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Enviar mensaje al contratista..." className="flex-1 text-xs border border-zinc-300 rounded-xl px-3 py-2.5" />
              <button type="submit" className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black flex items-center gap-1">
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DOC PREVIEW */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
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
          </div>
        </div>
      )}
    </div>
  )
}
