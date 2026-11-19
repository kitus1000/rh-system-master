'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import jsQR from 'jsqr'
import {
  QrCode,
  Camera,
  StopCircle,
  Search,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ShieldAlert,
  Bed,
  Building2,
  BellRing,
  User,
} from 'lucide-react'
import { formatShortDate } from '@/utils/contratistasConfig'

function playScanBeep(ok: boolean) {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(ok ? 1046 : 240, ctx.currentTime)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.16 : 0.35))
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.16 : 0.35))
  } catch {
    // Ignore audio errors
  }
}

export default function CasetaQRKioskPage() {
  const [codigoInput, setCodigoInput] = useState('')
  const [casetaLugar, setCasetaLugar] = useState('Caseta Principal Mina')
  const [guardiaNombre, setGuardiaNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [avisoEnviado, setAvisoEnviado] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<any | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const savedCaseta = localStorage.getItem('caseta_lugar')
    const savedGuardia = localStorage.getItem('caseta_guardia')
    if (savedCaseta) setCasetaLugar(savedCaseta)
    if (savedGuardia) setGuardiaNombre(savedGuardia)
    return () => stopCamera()
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const startCamera = async () => {
    setErrorMsg(null)
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
      setErrorMsg('No se pudo abrir la cámara: ' + err.message)
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
          stopCamera()
          setCodigoInput(code.data)
          verificarCodigo(code.data)
          return
        }
      }
    }
    requestAnimationFrame(scanFrame)
  }

  const verificarCodigo = async (codigoRaw?: string) => {
    const code = (codigoRaw ?? codigoInput).trim().toUpperCase()
    if (!code) return
    setLoading(true)
    setErrorMsg(null)
    setAvisoEnviado(null)
    setCredencial(null)

    try {
      const res = await fetch(`/api/caseta/verificar?codigo=${encodeURIComponent(code)}`)
      const json = await res.json()
      if (!res.ok) {
        playScanBeep(false)
        setErrorMsg(json.error || 'Credencial no válida')
        return
      }
      const c = json.credencial
      const isBlocked = c.vencida || c.estatus === 'Revocada' || c.estatus === 'Devuelta' || c.noVigenteAun
      playScanBeep(!isBlocked)
      setCredencial(c)
    } catch (err: any) {
      playScanBeep(false)
      setErrorMsg(err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (accion: 'Entrada' | 'Salida') => {
    if (!credencial) return
    setProcessing(true)
    setErrorMsg(null)
    localStorage.setItem('caseta_lugar', casetaLugar)
    localStorage.setItem('caseta_guardia', guardiaNombre)

    try {
      const res = await fetch('/api/caseta/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_qr: credencial.codigo_qr,
          accion,
          caseta_lugar: casetaLugar,
          guardia_nombre: guardiaNombre || 'Caseta en Turno',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        playScanBeep(false)
        setErrorMsg(json.error || 'No se pudo registrar movimiento')
        return
      }
      playScanBeep(true)
      setAvisoEnviado(json.aviso)
      setCredencial((prev: any) => (prev ? { ...prev, estatus: json.nuevo_estatus } : null))
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const resetScanner = () => {
    setCodigoInput('')
    setCredencial(null)
    setErrorMsg(null)
    setAvisoEnviado(null)
  }

  const p = credencial?.contratistas_personal
  const emp = credencial?.contratistas_empresas
  const sol = credencial?.contratistas_solicitudes
  const isDenied = credencial && (credencial.vencida || credencial.noVigenteAun || credencial.estatus === 'Revocada' || credencial.estatus === 'Devuelta')

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Volver al Portal Central
          </Link>
          <span className="text-[10px] font-mono font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full">
            Acceso Directo Caseta (Sin Usuario)
          </span>
        </div>

        {/* Header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-2 shadow-2xl">
          <div className="w-14 h-14 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl mx-auto flex items-center justify-center">
            <QrCode className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Checador QR de Caseta</h1>
          <p className="text-xs text-zinc-400">
            Escanea la credencial del contratista para validar su acceso a mina, registrar entrada/salida y enviar aviso automático.
          </p>

          {/* Guard & Gate quick inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-left">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Caseta</label>
              <select
                value={casetaLugar}
                onChange={(e) => {
                  setCasetaLugar(e.target.value)
                  localStorage.setItem('caseta_lugar', e.target.value)
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
              >
                <option value="Caseta Principal Mina">Caseta Principal Mina</option>
                <option value="Caseta Zona Norte">Caseta Zona Norte</option>
                <option value="Caseta Planta Beneficio">Caseta Planta Beneficio</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Guardia en Turno (Opcional)</label>
              <input
                value={guardiaNombre}
                onChange={(e) => {
                  setGuardiaNombre(e.target.value)
                  localStorage.setItem('caseta_guardia', e.target.value)
                }}
                placeholder="Nombre del guardia"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        </div>

        {/* Scanner / Input Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              verificarCodigo()
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                placeholder="Escanear o escribir código CONT-26-XXXX..."
                className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm font-mono uppercase text-white focus:outline-none focus:border-cyan-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs rounded-xl uppercase shrink-0"
            >
              {loading ? 'Buscando...' : 'Verificar'}
            </button>
          </form>

          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Escanear QR con Cámara</span>
            </button>
          ) : (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full rounded-2xl border border-zinc-700 bg-black" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={stopCamera}
                className="w-full py-2.5 bg-rose-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2"
              >
                <StopCircle className="w-4 h-4" /> Detener Cámara
              </button>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-rose-950/80 border-2 border-rose-500 rounded-3xl p-6 text-center space-y-2 animate-in fade-in">
            <XCircle className="w-12 h-12 text-rose-400 mx-auto" />
            <h2 className="text-lg font-black text-rose-300 uppercase">Acceso No Permitido</h2>
            <p className="text-sm text-rose-100">{errorMsg}</p>
            <button onClick={resetScanner} className="mt-2 px-4 py-2 bg-rose-600 text-white text-xs font-black rounded-xl">
              Escanear Otra Credencial
            </button>
          </div>
        )}

        {/* Sent Alert Confirmation */}
        {avisoEnviado && (
          <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-3xl p-5 flex items-start gap-3 animate-in fade-in">
            <BellRing className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-black text-emerald-300 uppercase">Movimiento Registrado & Aviso Enviado</p>
              <p className="text-emerald-100">{avisoEnviado}</p>
            </div>
          </div>
        )}

        {/* Single Credential Result Card */}
        {credencial && (
          <div
            className={`rounded-3xl p-6 border-2 shadow-2xl space-y-5 animate-in fade-in ${
              isDenied
                ? 'bg-rose-950/60 border-rose-500'
                : credencial.estatus === 'En Mina'
                ? 'bg-emerald-950/40 border-emerald-500'
                : 'bg-zinc-900 border-cyan-500'
            }`}
          >
            {/* Status Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono font-black text-sm bg-black text-cyan-400 px-3 py-1 rounded-xl border border-zinc-800">
                {credencial.codigo_qr}
              </span>
              {isDenied ? (
                <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white text-xs font-black uppercase px-3 py-1.5 rounded-xl">
                  <ShieldAlert className="w-4 h-4" />
                  {credencial.vencida ? 'CREDENCIAL VENCIDA' : credencial.noVigenteAun ? 'AÚN NO VIGENTE' : `ESTATUS: ${credencial.estatus}`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-black text-xs font-black uppercase px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                  {credencial.estatus === 'En Mina' ? 'ACTUALMENTE EN MINA' : 'AUTORIZADA PARA ENTRAR'}
                </span>
              )}
            </div>

            {/* Person Info */}
            <div className="flex items-center gap-4">
              {p?.foto_url ? (
                <img src={p.foto_url} alt={p.nombre} className="w-20 h-20 rounded-2xl object-cover border-2 border-cyan-400 shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                  <User className="w-9 h-9 text-zinc-500" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-white">
                  {p?.nombre} {p?.apellido_paterno} {p?.apellido_materno}
                </h2>
                <p className="text-sm font-bold text-amber-400">{p?.puesto_servicio || 'Contratista'}</p>
                <p className="text-xs text-zinc-300 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{emp?.razon_social}</span>
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block">Departamento Autorizado</span>
                <strong className="text-white">{sol?.departamento_nombre}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block">Vigencia</span>
                <strong className="text-white font-mono">
                  {formatShortDate(credencial.vigencia_desde)} → {formatShortDate(credencial.vigencia_hasta)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block">NSS / Tipo Sangre</span>
                <strong className="text-white font-mono">{p?.nss || 'N/D'} • {p?.tipo_sangre || 'N/E'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block">Inducción Seguridad</span>
                <strong className={p?.induccion_aprobada ? 'text-emerald-400' : 'text-amber-400'}>
                  {p?.induccion_aprobada ? '✓ Vigente' : 'Revisar en Folio'}
                </strong>
              </div>
              {credencial.cama_descripcion && (
                <div className="col-span-2 flex items-center gap-2 text-teal-300 font-bold pt-1 border-t border-zinc-800">
                  <Bed className="w-4 h-4" />
                  <span>Campamento: {credencial.cama_descripcion}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {credencial.estatus === 'Emitida' && !isDenied && (
                <button
                  onClick={() => handleAction('Entrada')}
                  disabled={processing}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl flex items-center justify-center gap-2 uppercase shadow-lg"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{processing ? 'Registrando...' : 'Confirmar Entrada a Mina y Avisar'}</span>
                </button>
              )}
              {credencial.estatus === 'En Mina' && (
                <button
                  onClick={() => handleAction('Salida')}
                  disabled={processing}
                  className="flex-1 py-4 bg-blue-500 hover:bg-blue-400 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 uppercase shadow-lg"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{processing ? 'Registrando...' : 'Registrar Salida, Recibir Credencial y Avisar'}</span>
                </button>
              )}
              <button
                onClick={resetScanner}
                className="px-5 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-2xl uppercase"
              >
                Limpiar / Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
