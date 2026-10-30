'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import jsQR from 'jsqr'
import { supabase } from '@/utils/supabase/client'
import {
  parseLockerObservaciones,
  serializeLockerObservaciones,
  generarFolioResguardo,
  getAreaTheme
} from '@/utils/lockerMeta'
import { 
  FolderLock, ChevronLeft, ChevronRight, Search, CheckCircle2, 
  AlertTriangle, XCircle, Key, Lock, Wrench, UserPlus, Save, 
  RefreshCw, Camera, StopCircle, ArrowLeft, Building2, User, 
  Sparkles, Check, X, ShieldAlert, Layers
} from 'lucide-react'

interface Empleado {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  numero_empleado: number | string
  departamento?: string
  puesto?: string
}

interface LockerCasillero {
  id_casillero: string
  id_modulo: string
  codigo_casillero: string
  posicion_nivel: string
  numero_en_modulo: number
  id_empleado: string | null
  nombre_provisional: string | null
  numero_empleado_provisional: string | null
  estatus: 'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible'
  condicion_llave: string
  numero_llave: string | null
  descripcion_dano: string | null
  observaciones: string | null
  fecha_asignacion: string | null
  fecha_reporte_dano: string | null
  empleados?: Empleado | null
  lockers_modulos?: {
    codigo_modulo: string
    bateria: string
    area: string
    tipo_modulo: string
    ubicacion_detalle: string
  } | null
}

const DANOS_COMUNES = [
  'Chapa / Pasador dañado',
  'Puerta descolgada o caída',
  'Bisagra rota / suelta',
  'Sin chapa ni cerradura',
  'Golpeado / Atascado',
  'Sin entrepaño interior'
]

export default function CensoMovilPage() {
  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [autoAvanzar, setAutoAvanzar] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Estado del casillero actual en edición
  const [estatus, setEstatus] = useState<'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible'>('Disponible')
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null)
  const [esNuevoTrabajador, setEsNuevoTrabajador] = useState(false)
  const [nombreProvisional, setNombreProvisional] = useState('')
  const [numEmpleadoProvisional, setNumEmpleadoProvisional] = useState('')
  const [condicionLlave, setCondicionLlave] = useState('Tiene Llave')
  const [dejaLlaveRh, setDejaLlaveRh] = useState<'Si' | 'No' | 'Ya Entregada'>('Si')
  const [numeroLlave, setNumeroLlave] = useState('')
  const [descripcionDano, setDescripcionDano] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Búsqueda de empleados
  const [searchEmp, setSearchEmp] = useState('')
  const [soloBeneficio, setSoloBeneficio] = useState(false)

  // Escáner de Cámara QR Universal (jsQR)
  const [showScanner, setShowScanner] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  // Cargar datos iniciales
  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: empData } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto')
        .order('apellido_paterno', { ascending: true })

      if (empData) setEmpleados(empData)

      const { data: casData } = await supabase
        .from('lockers_casilleros')
        .select(`
          *,
          empleados:id_empleado (
            id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto
          ),
          lockers_modulos:id_modulo (
            codigo_modulo, bateria, area, tipo_modulo, ubicacion_detalle
          )
        `)
        .order('codigo_casillero', { ascending: true })

      if (casData && casData.length > 0) {
        setCasilleros(casData)
        cargarCasilleroEnForm(casData[0])
      }
    } catch (err) {
      console.error('Error cargando datos para censo:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
    return () => detenerCamara()
  }, [])

  // Sincronizar formulario al cambiar de casillero
  const cargarCasilleroEnForm = (c: LockerCasillero) => {
    setEstatus(c.estatus || 'Disponible')
    setSelectedEmpleado(c.empleados || null)
    setEsNuevoTrabajador(!!c.nombre_provisional && !c.id_empleado)
    setNombreProvisional(c.nombre_provisional || '')
    setNumEmpleadoProvisional(c.numero_empleado_provisional || '')
    setCondicionLlave(c.condicion_llave || 'Tiene Llave')
    setNumeroLlave(c.numero_llave || '')
    setDescripcionDano(c.descripcion_dano || '')

    const { notasLimpias, meta } = parseLockerObservaciones(c.observaciones)
    setObservaciones(notasLimpias)
    if (meta.deja_llave_rh === 'No') setDejaLlaveRh('No')
    else if (meta.deja_llave_rh === 'Ya Entregada' || c.condicion_llave === 'Copia en RH') setDejaLlaveRh('Ya Entregada')
    else setDejaLlaveRh('Si')

    setSearchEmp('')
  }

  const currentCasillero = casilleros[currentIndex] || null

  const handleIrACasillero = (idx: number) => {
    if (idx >= 0 && idx < casilleros.length) {
      setCurrentIndex(idx)
      cargarCasilleroEnForm(casilleros[idx])
    }
  }

  // Guardar casillero actual
  const handleGuardar = async () => {
    if (!currentCasillero) return
    setSaving(true)

    try {
      let finalEstatus = estatus
      let finalIdEmp: string | null = selectedEmpleado?.id_empleado || null
      let finalNomProv: string | null = nombreProvisional.trim() || null
      let finalNumProv: string | null = numEmpleadoProvisional.trim() || null

      if (esNuevoTrabajador) {
        finalIdEmp = null
        if (finalNomProv && finalEstatus === 'Disponible') finalEstatus = 'Asignado'
      } else {
        finalNomProv = null
        finalNumProv = null
        if (finalIdEmp && finalEstatus === 'Disponible') finalEstatus = 'Asignado'
      }

      if (finalEstatus === 'Disponible') {
        finalIdEmp = null
        finalNomProv = null
        finalNumProv = null
      }

      const prevParsed = parseLockerObservaciones(currentCasillero.observaciones)
      const obsSerializada =
        finalEstatus === 'Disponible'
          ? observaciones.trim() || null
          : serializeLockerObservaciones(observaciones, {
              ...prevParsed.meta,
              deja_llave_rh: dejaLlaveRh,
              estatus_resguardo: prevParsed.meta.estatus_resguardo === 'Firmado' ? 'Firmado' : 'Pendiente Firma en RH',
              folio_resguardo: prevParsed.meta.folio_resguardo || generarFolioResguardo(currentCasillero.codigo_casillero),
              origen_registro: 'Censo Movil'
            })

      const payload = {
        estatus: finalEstatus,
        id_empleado: finalIdEmp,
        nombre_provisional: finalNomProv,
        numero_empleado_provisional: finalNumProv,
        condicion_llave: condicionLlave,
        numero_llave: numeroLlave.trim() || null,
        descripcion_dano: (finalEstatus === 'En Reparacion' || finalEstatus === 'Inservible') ? descripcionDano : null,
        observaciones: obsSerializada,
        fecha_asignacion: (finalIdEmp || finalNomProv) ? (currentCasillero.fecha_asignacion || new Date().toISOString()) : null,
        fecha_reporte_dano: (finalEstatus === 'En Reparacion' || finalEstatus === 'Inservible') ? (currentCasillero.fecha_reporte_dano || new Date().toISOString()) : null,
        actualizado_el: new Date().toISOString()
      }

      const { error } = await supabase
        .from('lockers_casilleros')
        .update(payload)
        .eq('id_casillero', currentCasillero.id_casillero)

      if (error) throw error

      const updatedList = [...casilleros]
      updatedList[currentIndex] = {
        ...currentCasillero,
        ...payload,
        empleados: selectedEmpleado
      }
      setCasilleros(updatedList)

      mostrarToast(`✅ ${currentCasillero.codigo_casillero} guardado`)

      if (autoAvanzar && currentIndex < casilleros.length - 1) {
        handleIrACasillero(currentIndex + 1)
      }
    } catch (err: any) {
      alert('Error al guardar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const mostrarToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  // Filtrado de empleados en vivo
  const empleadosSugeridos = useMemo(() => {
    if (!searchEmp.trim() && !soloBeneficio) return []
    const q = searchEmp.toLowerCase().trim()
    return empleados
      .filter(e => {
        if (soloBeneficio && !e.departamento?.toLowerCase().includes('beneficio')) return false
        if (!q) return true
        const full = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
        const num = String(e.numero_empleado)
        return full.includes(q) || num.includes(q)
      })
      .slice(0, 10)
  }, [empleados, searchEmp, soloBeneficio])

  // Progreso de mapeo
  const statsCenso = useMemo(() => {
    const total = casilleros.length
    const mapeados = casilleros.filter(c => c.estatus === 'Asignado' || c.estatus === 'En Reparacion' || c.estatus === 'Inservible').length
    const pct = total > 0 ? Math.round((mapeados / total) * 100) : 0
    return { total, mapeados, pct }
  }, [casilleros])

  // Escáner QR de Cámara con jsQR (Compatible 100% iOS Safari y Android)
  const iniciarCamara = async () => {
    setShowScanner(true)
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        bucleEscaneo()
      }
    } catch {
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos.')
    }
  }

  const detenerCamara = () => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setShowScanner(false)
  }

  const bucleEscaneo = () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    if (video.readyState === video.HAVE_ENOUGH_DATA && qrCanvasRef.current) {
      const canvas = qrCanvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth'
        })
        if (qr && qr.data) {
          const raw = qr.data.trim()
          const foundIdx = casilleros.findIndex(
            c =>
              c.codigo_casillero.toLowerCase() === raw.toLowerCase() ||
              raw.toUpperCase().includes(c.codigo_casillero.toUpperCase())
          )
          if (foundIdx !== -1) {
            detenerCamara()
            handleIrACasillero(foundIdx)
            mostrarToast(`🎯 Casillero ${casilleros[foundIdx].codigo_casillero} escaneado`)
            return
          }
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(bucleEscaneo)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="font-bold text-base">Cargando herramienta de censo rápido...</p>
      </div>
    )
  }

  if (casilleros.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <h2 className="text-xl font-bold">No hay casilleros registrados</h2>
        <p className="text-sm text-zinc-500">
          Asegúrate de haber ejecutado el script <code>SQL_LOCKERS_PLANTA_BENEFICIO.sql</code> en Supabase.
        </p>
        <Link
          href="/lockers"
          className="px-4 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-sm"
        >
          Volver a Lockers
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-28 pt-2 px-3 select-none text-zinc-900 dark:text-zinc-100">
      <canvas ref={qrCanvasRef} className="hidden" />

      {/* Toast Flotante */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-amber-400 border border-amber-500/50 px-4 py-2 rounded-full font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Top Bar Móvil */}
      <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
        <Link
          href="/lockers"
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Planograma</span>
        </Link>

        <button
          onClick={iniciarCamara}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-amber-400 hover:bg-zinc-700 rounded-lg text-xs font-bold border border-zinc-700 transition-all active:scale-95"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Escanear QR</span>
        </button>
      </div>

      {/* Barra de Progreso */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Progreso Censo PB:
          </span>
          <span className="font-black text-amber-500">
            {statsCenso.mapeados} / {statsCenso.total} ({statsCenso.pct}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${statsCenso.pct}%` }}
          />
        </div>
      </div>

      {/* Selector Rápido de Casillero (Paso a Paso) */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-xl text-white mb-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => handleIrACasillero(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl disabled:opacity-25 transition-all active:scale-95 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center flex-1">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold flex items-center justify-center gap-1.5">
              <span>{getAreaTheme(currentCasillero?.lockers_modulos?.area).icon}</span>
              <span>{currentCasillero?.lockers_modulos?.area || 'Planta de Beneficio'}</span>
              <span>· {currentIndex + 1} de {casilleros.length}</span>
            </span>
            <h2 className="text-3xl font-black tracking-tight font-mono text-white mt-0.5">
              {currentCasillero?.codigo_casillero}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                currentCasillero?.posicion_nivel.includes('Grande')
                  ? 'bg-indigo-500 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}>
                {currentCasillero?.posicion_nivel}
              </span>
              <span className="text-[10px] text-zinc-400">
                {currentCasillero?.posicion_nivel.includes('Grande') ? 'Módulo 2 Puertas' : 'Módulo 3 Puertas'}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleIrACasillero(currentIndex + 1)}
            disabled={currentIndex === casilleros.length - 1}
            className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl disabled:opacity-25 transition-all active:scale-95 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Dropdown de salto directo */}
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400 font-medium">Saltar a:</span>
          <select
            value={currentIndex}
            onChange={(e) => handleIrACasillero(Number(e.target.value))}
            className="bg-zinc-800 text-white text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {casilleros.map((c, i) => (
              <option key={c.id_casillero} value={i}>
                {c.codigo_casillero} - {c.estatus} {c.empleados ? `(${c.empleados.apellido_paterno})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Formulario de Captura Rápida */}
      <div className="space-y-4">
        {/* 1. Selector de Estado */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 block">
            1. Estado del Casillero
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEstatus('Asignado')}
              className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                estatus === 'Asignado'
                  ? 'bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>🔵 Asignado</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEstatus('Disponible')
                setSelectedEmpleado(null)
                setNombreProvisional('')
                setNumEmpleadoProvisional('')
              }}
              className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                estatus === 'Disponible'
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>🟢 Libre / Disponible</span>
            </button>

            <button
              type="button"
              onClick={() => setEstatus('En Reparacion')}
              className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                estatus === 'En Reparacion'
                  ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-md shadow-amber-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>🟠 A Reparar</span>
            </button>

            <button
              type="button"
              onClick={() => setEstatus('Inservible')}
              className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                estatus === 'Inservible'
                  ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <XCircle className="w-4 h-4" />
              <span>🔴 Inservible / Baja</span>
            </button>
          </div>
        </div>

        {/* 2. Si está en reparación o inservible: Tags rápidos de daño */}
        {(estatus === 'En Reparacion' || estatus === 'Inservible') && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-2.5">
            <label className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
              Tipo de Daño o Falla Física:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DANOS_COMUNES.map(dano => (
                <button
                  key={dano}
                  type="button"
                  onClick={() => setDescripcionDano(dano)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition-all ${
                    descripcionDano === dano
                      ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-zinc-800 border-amber-500/30 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {dano}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Otro detalle del daño..."
              value={descripcionDano}
              onChange={(e) => setDescripcionDano(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-amber-500/30 text-xs text-zinc-900 dark:text-white"
            />
          </div>
        )}

        {/* 3. Trabajador Asignado */}
        {(estatus === 'Asignado' || estatus === 'Disponible') && (
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
                2. Titular Sindicalizado
              </label>
              <button
                type="button"
                onClick={() => setEsNuevoTrabajador(!esNuevoTrabajador)}
                className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {esNuevoTrabajador ? 'Buscar en Catálogo' : '+ Nuevo Trabajador'}
              </button>
            </div>

            {selectedEmpleado && !esNuevoTrabajador && (
              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-black text-xs text-sky-800 dark:text-sky-300">
                    {selectedEmpleado.apellido_paterno} {selectedEmpleado.apellido_materno || ''} {selectedEmpleado.nombre}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-medium">
                    Ficha #{selectedEmpleado.numero_empleado} | {selectedEmpleado.departamento}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmpleado(null)}
                  className="p-1.5 rounded-lg hover:bg-sky-500/20 text-sky-600 dark:text-sky-400"
                  title="Quitar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {!esNuevoTrabajador && !selectedEmpleado && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Escribe apellido o ficha..."
                    value={searchEmp}
                    onChange={(e) => setSearchEmp(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soloBeneficio}
                      onChange={(e) => setSoloBeneficio(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Solo Planta de Beneficio</span>
                  </label>
                </div>

                {empleadosSugeridos.length > 0 && (
                  <div className="max-h-44 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-zinc-800 bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-1 border border-slate-200 dark:border-zinc-700">
                    {empleadosSugeridos.map(emp => (
                      <button
                        key={emp.id_empleado}
                        type="button"
                        onClick={() => {
                          setSelectedEmpleado(emp)
                          setEstatus('Asignado')
                          setSearchEmp('')
                        }}
                        className="w-full text-left p-2 hover:bg-amber-500/10 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <div className="truncate">
                          <p className="font-bold text-xs truncate text-zinc-900 dark:text-white">
                            {emp.apellido_paterno} {emp.nombre}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            #{emp.numero_empleado} · {emp.departamento}
                          </p>
                        </div>
                        <span className="text-[10px] font-black text-amber-500">Asignar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {esNuevoTrabajador && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Nuevo ingreso (aún no en plataforma):
                </p>
                <input
                  type="text"
                  placeholder="Nombre completo del nuevo trabajador"
                  value={nombreProvisional}
                  onChange={(e) => {
                    setNombreProvisional(e.target.value)
                    if (e.target.value) setEstatus('Asignado')
                  }}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-amber-500/30 text-xs font-bold text-zinc-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Ficha o Folio temporal (opcional)"
                  value={numEmpleadoProvisional}
                  onChange={(e) => setNumEmpleadoProvisional(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-800 border border-amber-500/30 text-xs font-mono text-zinc-900 dark:text-white"
                />
              </div>
            )}
          </div>
        )}

        {/* 4. Condición de Llave y Copia en RH */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2.5">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 block">
            3. Condición de Llave y Copia en RH
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'Tiene Llave', label: '🔑 Tiene Llave' },
              { id: 'Candado Personal', label: '🔒 Candado Propio' },
              { id: 'Sin Llave', label: '⚠️ Sin Llave / Falta' },
              { id: 'Copia en RH', label: '🏛️ Copia en RH' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCondicionLlave(item.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                  condicionLlave === item.id
                    ? 'bg-zinc-900 text-amber-400 border-amber-500 shadow-sm dark:bg-zinc-800'
                    : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
              ¿Deja copia de llave en Recursos Humanos?
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'Si', label: '✅ Sí deja' },
                { id: 'No', label: '❌ No deja' },
                { id: 'Ya Entregada', label: '🏛️ Entregada' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDejaLlaveRh(opt.id as any)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border ${
                    dejaLlaveRh === opt.id
                      ? 'bg-amber-500 text-zinc-950 border-amber-600 font-black'
                      : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Número de llave o código grabado (opcional)"
            value={numeroLlave}
            onChange={(e) => setNumeroLlave(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
          />
        </div>
      </div>

      {/* Barra Inferior Fija de Acción */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 shadow-2xl z-40">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={autoAvanzar}
              onChange={(e) => setAutoAvanzar(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-400"
            />
            <span>Auto ➡️</span>
          </label>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={saving}
            className="flex-1 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : autoAvanzar ? 'Guardar y Siguiente ➡️' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {/* Modal de Escáner QR con Cámara */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between p-4">
          <div className="w-full flex items-center justify-between text-white pt-2">
            <span className="font-bold text-sm">Escanea el QR del Locker</span>
            <button
              onClick={detenerCamara}
              className="p-2 rounded-full bg-zinc-800 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full max-w-xs aspect-square border-2 border-amber-500 rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <div className="absolute inset-0 border-4 border-amber-500/40 rounded-2xl pointer-events-none animate-pulse" />
          </div>

          {cameraError && (
            <p className="text-xs text-rose-400 text-center">{cameraError}</p>
          )}

          <div className="w-full pb-6 text-center text-xs text-zinc-400">
            Apunta la cámara a la ficha o etiqueta pegada en el casillero
          </div>
        </div>
      )}
    </div>
  )
}
