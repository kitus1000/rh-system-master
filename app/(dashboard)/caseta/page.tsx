'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import jsQR from 'jsqr'
import {
  QrCode,
  LogIn,
  LogOut,
  Camera,
  StopCircle,
  Search,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { formatShortDate, isSchemaMissingError } from '@/utils/contratistasConfig'

export default function CasetaCredencialesPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)

  const [credenciales, setCredenciales] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<'Activas' | 'En Mina' | 'Devueltas' | 'Todas'>('Activas')
  const [qrSearch, setQrSearch] = useState('')
  const [casetaLugar, setCasetaLugar] = useState('Caseta Principal Mina')

  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    fetchCasetaData()
    return () => stopCamera()
  }, [])

  const fetchCasetaData = async () => {
    setLoading(true)
    try {
      const { data: credData, error: credErr } = await supabase
        .from('contratistas_credenciales')
        .select('*, contratistas_empresas(razon_social), contratistas_personal(id_personal, nombre, apellido_paterno, apellido_materno, puesto_servicio, foto_url, nss, tipo_sangre), contratistas_solicitudes(folio, departamento_nombre, area_trabajo)')
        .order('creado_el', { ascending: false })

      if (credErr) {
        if (isSchemaMissingError(credErr)) setSchemaMissing(true)
        setLoading(false)
        return
      }

      const { data: movData } = await supabase
        .from('contratistas_movimientos_bitacora')
        .select('*, contratistas_empresas(razon_social), contratistas_personal(nombre, apellido_paterno), contratistas_credenciales(codigo_qr)')
        .order('fecha_hora', { ascending: false })
        .limit(40)

      setCredenciales(credData || [])
      setMovimientos(movData || [])
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
      if (!confirm(`⚠️ La credencial ${cred.codigo_qr} venció el ${formatShortDate(cred.vigencia_hasta)}. ¿Confirmar entrada?`)) return
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
        registrado_por: profile?.nombre_completo || 'Caseta',
      },
    ])
    setQrSearch('')
    await fetchCasetaData()
  }

  const handleCheckOutReturnBadge = async (cred: any) => {
    const nowIso = new Date().toISOString()
    await supabase
      .from('contratistas_credenciales')
      .update({
        estatus: 'Devuelta',
        fecha_salida_mina: nowIso,
        credencial_entregada: true,
        recibido_por: profile?.nombre_completo || 'Caseta',
      })
      .eq('id_credencial', cred.id_credencial)
    await supabase
      .from('contratistas_personal')
      .update({ estatus: 'Activo' })
      .eq('id_personal', cred.id_personal)

    // Auto-release any assigned camp bed when the contractor leaves and returns badge
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
        registrado_por: profile?.nombre_completo || 'Caseta',
        observaciones: 'Salida de mina y devolución física de credencial',
      },
    ])
    setQrSearch('')
    await fetchCasetaData()
  }

  const filteredCredenciales = credenciales.filter((c) => {
    if (statusFilter === 'Activas' && c.estatus !== 'Emitida' && c.estatus !== 'En Mina') return false
    if (statusFilter === 'En Mina' && c.estatus !== 'En Mina') return false
    if (statusFilter === 'Devueltas' && c.estatus !== 'Devuelta') return false

    const q = qrSearch.trim().toLowerCase()
    if (!q) return true
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
            <KeyRound className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
              Caseta de Acceso • Solo Credenciales Autorizadas
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Control de Credenciales QR (Entradas y Salidas)
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Escanea la credencial autorizada al ingresar a mina y recíbela al retirarse para registrar entrada, salida y liberación de estancia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-xs">
            <span className="text-zinc-400 block text-[10px] uppercase">Por Ingresar</span>
            <strong className="text-amber-400 text-lg font-black">{credenciales.filter((c) => c.estatus === 'Emitida').length}</strong>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-xs">
            <span className="text-zinc-400 block text-[10px] uppercase">En Mina Ahora</span>
            <strong className="text-emerald-400 text-lg font-black">{credenciales.filter((c) => c.estatus === 'En Mina').length}</strong>
          </div>
          <button onClick={fetchCasetaData} className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: QR Scanner + Bitácora */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
            <h2 className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-cyan-600" />
              <span>Escáner / Búsqueda de Credencial</span>
            </h2>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Caseta / Punto de Control</label>
              <input value={casetaLugar} onChange={(e) => setCasetaLugar(e.target.value)} className="w-full text-xs border border-zinc-300 rounded-xl p-2.5" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <input
                value={qrSearch}
                onChange={(e) => setQrSearch(e.target.value)}
                placeholder="Escanear CONT-26-XXXX o buscar nombre..."
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
            <h3 className="font-black text-xs uppercase text-zinc-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-600" /> Bitácora Reciente de Caseta
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {movimientos.map((m) => (
                <div key={m.id_movimiento} className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-100 text-xs flex justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-black text-zinc-800">{m.tipo_movimiento}</span> • {m.contratistas_personal?.nombre} {m.contratistas_personal?.apellido_paterno}
                    <div className="text-[10px] text-zinc-400 font-mono truncate">
                      {m.contratistas_credenciales?.codigo_qr} • {m.contratistas_empresas?.razon_social}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 shrink-0">{new Date(m.fecha_hora).toLocaleTimeString('es-MX')}</span>
                </div>
              ))}
              {movimientos.length === 0 && <p className="text-xs text-zinc-400 text-center py-4">Sin movimientos hoy.</p>}
            </div>
          </div>
        </div>

        {/* Right: Credenciales List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
            {(['Activas', 'En Mina', 'Devueltas', 'Todas'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  statusFilter === tab ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredCredenciales.map((cred) => {
              const p = cred.contratistas_personal
              return (
                <div key={cred.id_credencial} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {p?.foto_url ? (
                      <img src={p.foto_url} alt={p.nombre} className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-600 font-black flex items-center justify-center shrink-0">
                        {(p?.nombre?.[0] || '') + (p?.apellido_paterno?.[0] || '')}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs bg-zinc-900 text-cyan-400 px-2.5 py-1 rounded-lg">{cred.codigo_qr}</span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                            cred.estatus === 'En Mina'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : cred.estatus === 'Devuelta'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
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
                        Vigencia: {formatShortDate(cred.vigencia_desde)} → {formatShortDate(cred.vigencia_hasta)}
                        {p?.tipo_sangre ? ` • Sangre: ${p.tipo_sangre}` : ''}
                      </p>
                    </div>
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
                        <span>Registrar Salida y Recibir Credencial</span>
                      </button>
                    )}
                    {cred.estatus === 'Devuelta' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200">
                        <CheckCircle2 className="w-4 h-4" /> Entregada
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredCredenciales.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 text-sm">
                No hay credenciales en esta categoría.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
