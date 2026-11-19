'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  RefreshCw,
  AlertTriangle,
  Eye,
  X,
  CalendarClock,
} from 'lucide-react'
import { formatShortDate, getDocLabel, isSchemaMissingError } from '@/utils/contratistasConfig'

export default function SeguridadIndustrialPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)

  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState<'Pendientes' | 'Todas'>('Pendientes')

  const [chatSolicitud, setChatSolicitud] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [scheduleSol, setScheduleSol] = useState<any>(null)
  const [scheduleForm, setScheduleForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: '09:00 AM',
    lugar: 'Aula de Seguridad Industrial',
  })

  useEffect(() => {
    fetchAll()
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

      const { data: docData } = await supabase
        .from('contratistas_documentos')
        .select('*')
        .order('creado_el', { ascending: false })

      setSolicitudes(solData || [])
      setDocumentos(docData || [])
    } finally {
      setLoading(false)
    }
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

  const handleSeguridadDecision = async (sol: any, status: 'Aprobado' | 'Rechazado') => {
    const note = prompt(`Observaciones de Seguridad Industrial (${status}):`, '')
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
        remitente_rol: 'Seguridad Industrial',
        mensaje: `Seguridad Industrial marcó inducción como "${status}".${note ? ` Nota: ${note}` : ''}`,
      },
    ])
    await fetchAll()
  }

  const handleScheduleInduccion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleSol || !scheduleForm.fecha) return
    const actor = profile?.nombre_completo || 'Seguridad Industrial'
    const notaCita = `Cita de Inducción programada: ${formatShortDate(scheduleForm.fecha)} a las ${scheduleForm.hora} en ${scheduleForm.lugar}`

    const { error } = await supabase
      .from('contratistas_solicitudes')
      .update({
        estatus_seguridad: 'En Diálogo',
        fecha_induccion_programada: scheduleForm.fecha,
        hora_induccion: scheduleForm.hora,
        lugar_induccion: scheduleForm.lugar,
        notas_seguridad: notaCita,
        actualizado_el: new Date().toISOString(),
      })
      .eq('id_solicitud', scheduleSol.id_solicitud)

    if (error && error.message?.includes('fecha_induccion_programada')) {
      await supabase
        .from('contratistas_solicitudes')
        .update({
          estatus_seguridad: 'En Diálogo',
          notas_seguridad: notaCita,
          actualizado_el: new Date().toISOString(),
        })
        .eq('id_solicitud', scheduleSol.id_solicitud)
    }

    await supabase.from('contratistas_mensajes').insert([
      {
        id_solicitud: scheduleSol.id_solicitud,
        id_empresa: scheduleSol.id_empresa,
        remitente_id: user?.id || null,
        remitente_nombre: actor,
        remitente_rol: 'Seguridad Industrial',
        mensaje: notaCita,
      },
    ])

    if (scheduleSol.contratistas_empresas?.correo) {
      await fetch('/api/contratistas/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: scheduleSol.contratistas_empresas.correo,
          asunto: `Fecha de Inducción Programada - Folio ${scheduleSol.folio}`,
          mensaje: `Hola ${scheduleSol.contratistas_empresas.razon_social}, Seguridad Industrial programó la cita de inducción para tu personal:`,
          detalles: `Fecha: ${formatShortDate(scheduleForm.fecha)} | Hora: ${scheduleForm.hora} | Lugar: ${scheduleForm.lugar}`,
        }),
      }).catch(() => {})
    }

    setScheduleSol(null)
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
          remitente_rol: 'Seguridad Industrial',
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

  const visibleSolicitudes =
    filterStatus === 'Pendientes'
      ? solicitudes.filter((s) => s.estatus_seguridad === 'Pendiente' || s.estatus_seguridad === 'En Diálogo' || s.estatus_seguridad === 'Inducción Programada')
      : solicitudes

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
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
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400">
              Seguridad Industrial • Inducciones y Requisitos
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Validación de Inducciones de Seguridad Industrial
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Verifica si el personal contratista cuenta con inducción vigente, revisa sus constancias DC-3/IMSS/médicas o asígnales fecha de inducción.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-xs">
            <span className="text-zinc-400 block text-[10px] uppercase">Por Revisar</span>
            <strong className="text-amber-400 text-lg font-black">
              {solicitudes.filter((s) => s.estatus_seguridad === 'Pendiente' || s.estatus_seguridad === 'En Diálogo').length}
            </strong>
          </div>
          <button onClick={fetchAll} className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm w-fit">
        <button
          onClick={() => setFilterStatus('Pendientes')}
          className={`px-4 py-2 rounded-xl text-xs font-black ${filterStatus === 'Pendientes' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          Pendientes / Programadas
        </button>
        <button
          onClick={() => setFilterStatus('Todas')}
          className={`px-4 py-2 rounded-xl text-xs font-black ${filterStatus === 'Todas' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          Todas las Solicitudes
        </button>
      </div>

      {/* Solicitudes List */}
      <div className="space-y-4">
        {visibleSolicitudes.map((sol) => (
          <div key={sol.id_solicitud} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-xs bg-zinc-900 text-emerald-400 px-2.5 py-1 rounded-lg">{sol.folio}</span>
                  <h3 className="font-black text-base text-zinc-900">{sol.contratistas_empresas?.razon_social}</h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                    Inducción: {sol.estatus_seguridad}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Servicio: {sol.descripcion_servicio} • Depto: <strong>{sol.departamento_nombre}</strong> • Fechas: {formatShortDate(sol.fecha_inicio)} → {formatShortDate(sol.fecha_fin)}
                </p>
                {sol.fecha_induccion_programada && (
                  <p className="text-xs font-bold text-amber-700 mt-1">
                    📅 Cita programada: {formatShortDate(sol.fecha_induccion_programada)} ({sol.hora_induccion || ''}) — {sol.lugar_induccion || ''}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => openChat(sol)} className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-black rounded-xl inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Chat
                </button>
                <button
                  onClick={() => {
                    setScheduleSol(sol)
                    setScheduleForm({
                      fecha: sol.fecha_induccion_programada || new Date().toISOString().split('T')[0],
                      hora: sol.hora_induccion || '09:00 AM',
                      lugar: sol.lugar_induccion || 'Aula de Seguridad Industrial',
                    })
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black rounded-xl inline-flex items-center gap-1.5"
                >
                  <CalendarClock className="w-3.5 h-3.5" /> Dar Fecha Inducción
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
                        <p className="font-black text-sm text-zinc-900">{w.nombre} {w.apellido_paterno} {w.apellido_materno}</p>
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
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-zinc-200 px-2 py-1 rounded-lg hover:border-emerald-400"
                        >
                          <Eye className="w-3 h-3 text-emerald-600" />
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
        {visibleSolicitudes.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
            No hay solicitudes pendientes de inducción en Seguridad Industrial.
          </div>
        )}
      </div>

      {/* MODAL: PROGRAMAR FECHA DE INDUCCIÓN */}
      {scheduleSol && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">Programar Inducción • {scheduleSol.folio}</h3>
              <button onClick={() => setScheduleSol(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleScheduleInduccion} className="p-6 space-y-4">
              <p className="text-xs text-zinc-600">
                Empresa: <strong>{scheduleSol.contratistas_empresas?.razon_social}</strong>. Esta fecha se notificará directamente en el portal del contratista.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Fecha de Inducción *</label>
                  <input type="date" required value={scheduleForm.fecha} onChange={(e) => setScheduleForm({ ...scheduleForm, fecha: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Hora *</label>
                  <input required value={scheduleForm.hora} onChange={(e) => setScheduleForm({ ...scheduleForm, hora: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" placeholder="09:00 AM" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Lugar / Sala *</label>
                <input required value={scheduleForm.lugar} onChange={(e) => setScheduleForm({ ...scheduleForm, lugar: e.target.value })} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setScheduleSol(null)} className="px-4 py-2 text-xs font-bold text-zinc-600">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-amber-500 text-black font-black text-xs rounded-xl">Guardar y Notificar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHAT MODAL */}
      {chatSolicitud && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full h-[75vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">Seguridad Industrial ↔ Contratista ({chatSolicitud.folio})</h3>
              <button onClick={() => setChatSolicitud(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {mensajes.map((m) => (
                <div key={m.id_mensaje} className={`p-3 rounded-2xl text-xs max-w-[85%] ${m.remitente_rol !== 'Contratista' ? 'ml-auto bg-emerald-600 text-white' : 'bg-white border border-zinc-200 text-zinc-800'}`}>
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
