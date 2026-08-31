'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import jsQR from 'jsqr'
import {
  Truck, Clock, Camera, Wifi, WifiOff,
  Play, StopCircle, HardHat, ChevronRight,
  Trash2, ArrowLeft, ShieldAlert, X, Sparkles, Check,
  UserCheck, User, Users, Search, CloudUpload, RefreshCw
} from 'lucide-react'

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface EmpleadoCache {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  numero_empleado?: string
  qr_token?: string
}

interface PasajeroBordo {
  id_registro_local: string
  id_empleado?: string
  id_manual?: string
  nombre_completo: string
  puesto_depto?: string
  numero_nomina?: string
  metodo_registro: 'QR' | 'Manual'
  hora_subida: string
}

interface ViajeLocal {
  id_viaje_local: string
  id_chofer?: string
  chofer_nombre: string
  tipo_vehiculo: string
  numero_economico: string
  ruta_origen: string
  ruta_destino: string
  hora_inicio_real: string
  hora_fin_real?: string
  estado: 'En Progreso' | 'Finalizado'
  checklist_respuestas: Record<string, boolean>
  pasajeros: PasajeroBordo[]
  sincronizado: boolean
  creado_el: string
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Choferes Oficiales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const DEFAULT_CHOFERES: EmpleadoCache[] = [
  { id_empleado: 'CHOFER-1', nombre: 'Adalberto', apellido_paterno: 'Pinales', puesto: 'Chofer', departamento: 'LogÃ­stica', numero_empleado: '101' },
  { id_empleado: 'CHOFER-2', nombre: 'Ramon',     apellido_paterno: 'YaÃ±ez',   puesto: 'Chofer', departamento: 'LogÃ­stica', numero_empleado: '102' },
  { id_empleado: 'CHOFER-3', nombre: 'Oscar',     apellido_paterno: 'Vazquez', puesto: 'Chofer', departamento: 'LogÃ­stica', numero_empleado: '103' },
  { id_empleado: 'CHOFER-4', nombre: 'Enrique',   apellido_paterno: 'Linares', puesto: 'Chofer', departamento: 'LogÃ­stica', numero_empleado: '104' },
  { id_empleado: 'CHOFER-5', nombre: 'Samuel',    apellido_paterno: 'Madriles',puesto: 'Chofer', departamento: 'LogÃ­stica', numero_empleado: '105' },
  { id_empleado: 'CHOFER-6', nombre: 'Jesus',     apellido_paterno: 'Saucedo', puesto: 'Chofer', departamento: 'LogÃ­stica', numero_empleado: '106' },
]

const CHECKLIST_DEFAULT: Record<string, boolean> = {
  'Llantas y presiÃ³n OK': true,
  'Nivel de aceite y agua OK': true,
  'Frenos y luces funcionando': true,
  'Radio de mina encendido': true,
  'Extintor y botiquÃ­n a bordo': true,
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Sonido/VibraciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
let sharedAudioCtx: any = null
function playBeep(success = true) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AC()
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {})
    }
    const ctx = sharedAudioCtx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = success ? 'sine' : 'sawtooth'
    osc.frequency.setValueAtTime(success ? 880 : 320, ctx.currentTime)
    if (success) osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(success ? [70, 40, 70] : [180])
    }
  } catch (_) {}
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• COMPONENTE PRINCIPAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function ChoferApp() {
  /* â”€â”€ NavegaciÃ³n â”€â”€ */
  const [view, setView] = useState<'inicio' | 'checklist' | 'en_ruta'>('inicio')

  /* â”€â”€ Red â”€â”€ */
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState('')

  /* â”€â”€ PWA install â”€â”€ */
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  /* â”€â”€ CatÃ¡logos offline â”€â”€ */
  const [empleadosCache, setEmpleadosCache] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)
  const [choferesList, setChoferesList] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)

  /* â”€â”€ Formulario inicio â”€â”€ */
  const [choferNombre, setChoferNombre] = useState('Adalberto Pinales')
  const [choferId, setChoferId] = useState('CHOFER-1')
  const [tipoVehiculo, setTipoVehiculo] = useState('Camioneta')
  const [numeroEconomico, setNumeroEconomico] = useState('CAM-01')
  const [origen, setOrigen] = useState('Obscuridad')
  const [destino, setDestino] = useState('Parajes')
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, boolean>>(CHECKLIST_DEFAULT)

  /* â”€â”€ Viaje activo â”€â”€ */
  const [viajeActivo, setViajeActivo] = useState<ViajeLocal | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00')
  const [historialViajes, setHistorialViajes] = useState<ViajeLocal[]>([])

  /* â”€â”€ PASAJEROS (State + Refs sincronizados en tiempo real) â”€â”€ */
  const [pasajerosEnRuta, setPasajerosEnRuta] = useState<PasajeroBordo[]>([])
  const pasajerosRef = useRef<PasajeroBordo[]>([])
  const viajeActivoRef = useRef<ViajeLocal | null>(null)
  const historialRef = useRef<ViajeLocal[]>([])
  const empleadosCacheRef = useRef<EmpleadoCache[]>(DEFAULT_CHOFERES)

  /* â”€â”€ Control de Escaneo Continuo en MÃ³viles â”€â”€ */
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  // Control de intervalos de escaneo por Timestamp (No se atora jamÃ¡s)
  const lastScanTimestampRef = useRef<number>(0)
  const lastScannedCodeRef = useRef<string>('')

  /* â”€â”€ NotificaciÃ³n de scan â”€â”€ */
  const [scanNotice, setScanNotice] = useState<{ tipo: 'exito' | 'duplicado'; nombre: string; depto?: string; hora?: string } | null>(null)
  const noticeTimerRef = useRef<any>(null)

  /* â”€â”€ Manual ID / NÃ³mina â”€â”€ */
  const [manualIdInput, setManualIdInput] = useState('')

  /* Sincronizar refs */
  useEffect(() => { pasajerosRef.current = pasajerosEnRuta }, [pasajerosEnRuta])
  useEffect(() => { viajeActivoRef.current = viajeActivo }, [viajeActivo])
  useEffect(() => { historialRef.current = historialViajes }, [historialViajes])
  useEffect(() => { empleadosCacheRef.current = empleadosCache }, [empleadosCache])

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Init â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

    // Registrar y actualizar Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update().catch(() => {})
      }).catch(() => {})
    }

    const onBeforeInstall = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const onOnline  = () => { setIsOnline(true); autoSyncData(); descargarCatalogoFondo() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    cargarDatosLocales()
    descargarCatalogoFondo()

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      detenerCamara()
    }
  }, [])

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Reloj de viaje â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  useEffect(() => {
    if (view !== 'en_ruta' || !viajeActivo) return
    const t = setInterval(() => {
      const ms = Math.max(0, Date.now() - new Date(viajeActivo.hora_inicio_real).getTime())
      const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
      const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
      const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
      setTiempoTranscurrido(`${h}:${m}:${s}`)
    }, 1000)
    return () => clearInterval(t)
  }, [view, viajeActivo])

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• LocalStorage â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const cargarDatosLocales = () => {
    try {
      const raw = localStorage.getItem('rh_chofer_viajes')
      if (raw) {
        const viajes: ViajeLocal[] = JSON.parse(raw)
        setHistorialViajes(viajes)
        historialRef.current = viajes
        const activo = viajes.find(v => v.estado === 'En Progreso')
        if (activo) {
          setViajeActivo(activo)
          viajeActivoRef.current = activo
          setPasajerosEnRuta(activo.pasajeros || [])
          pasajerosRef.current = activo.pasajeros || []
          setView('en_ruta')
        }
      }
      const rawEmps = localStorage.getItem('rh_chofer_empleados_cache')
      if (rawEmps) {
        const emps: EmpleadoCache[] = JSON.parse(rawEmps)
        if (emps?.length) {
          setEmpleadosCache(emps)
          empleadosCacheRef.current = emps
          const ch = emps.filter(e =>
            (e.puesto || '').toLowerCase().includes('chofer') || 
            (e.puesto || '').toLowerCase().includes('conductor') ||
            (e.departamento || '').toLowerCase().includes('transporte') ||
            (e.departamento || '').toLowerCase().includes('logistica')
          )
          setChoferesList(ch.length ? ch : DEFAULT_CHOFERES)
        }
      }
      const savedNombre = localStorage.getItem('rh_chofer_nombre_guardado')
      if (savedNombre) setChoferNombre(savedNombre)
    } catch (_) {}
  }

  // Descarga y cachea TODOS los empleados de la base de datos de Minas de Bacis
  const descargarCatalogoFondo = async () => {
    try {
      const { data } = await supabase.from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado, qr_token')
      
      if (data?.length) {
        setEmpleadosCache(data)
        empleadosCacheRef.current = data
        try {
          localStorage.setItem('rh_chofer_empleados_cache', JSON.stringify(data))
        } catch (_) {}
        
        const ch = data.filter(e =>
          (e.puesto || '').toLowerCase().includes('chofer') || 
          (e.puesto || '').toLowerCase().includes('conductor') ||
          (e.departamento || '').toLowerCase().includes('transporte') ||
          (e.departamento || '').toLowerCase().includes('logistica')
        )
        setChoferesList(ch.length ? ch : DEFAULT_CHOFERES)
      }
    } catch (_) {}
  }

  // Sincronización Manual y Automática con la Oficina
  const autoSyncData = async () => {
    if (!navigator.onLine) return
    try {
      const saved: ViajeLocal[] = JSON.parse(localStorage.getItem('rh_chofer_viajes') || '[]')
      const finalizados = saved.filter(v => v.estado === 'Finalizado')
      if (!finalizados.length) return

      await fetch('/api/choferes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajes: finalizados.map(v => ({
            id_viaje_local: v.id_viaje_local,
            id_chofer: v.id_chofer ?? null,
            chofer_nombre: v.chofer_nombre,
            tipo_vehiculo: v.tipo_vehiculo || 'Camioneta',
            numero_economico: v.numero_economico || 'CAM-01',
            ruta_origen: v.ruta_origen, 
            ruta_destino: v.ruta_destino,
            hora_inicio_real: v.hora_inicio_real, 
            hora_fin_real: v.hora_fin_real,
            estado: v.estado
          })),
          pasajeros: finalizados.flatMap(v => v.pasajeros.map(p => ({
            id_registro_local: p.id_registro_local,
            id_viaje_local: v.id_viaje_local,
            id_empleado: p.id_empleado ?? null,
            id_manual: p.id_manual ?? null,
            nombre_completo: p.nombre_completo,
            puesto_depto: p.puesto_depto,
            metodo_registro: p.metodo_registro,
            hora_subida: p.hora_subida
          }))),
          respuestas_checklist: finalizados.map(v => ({
            id_viaje_local: v.id_viaje_local,
            respuestas_json: v.checklist_respuestas
          }))
        })
      })
    } catch (_) {}
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    setSyncStatusMsg('Sincronizando viajes con la oficina...')
    try {
      const saved: ViajeLocal[] = JSON.parse(localStorage.getItem('rh_chofer_viajes') || '[]')
      const viajesASubir = saved.filter(v => v.estado === 'Finalizado' || (v.pasajeros && v.pasajeros.length > 0))

      if (!viajesASubir.length) {
        setSyncStatusMsg('No hay viajes concluidos con pasajeros para subir.')
        setTimeout(() => setSyncStatusMsg(''), 3500)
        setIsSyncing(false)
        return
      }

      const res = await fetch('/api/choferes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajes: viajesASubir.map(v => ({
            id_viaje_local: v.id_viaje_local,
            id_chofer: v.id_chofer ?? null,
            chofer_nombre: v.chofer_nombre || choferNombre || 'Chofer Operador',
            tipo_vehiculo: v.tipo_vehiculo || tipoVehiculo || 'Camioneta',
            numero_economico: v.numero_economico || numeroEconomico || 'CAM-01',
            ruta_origen: v.ruta_origen || origen || 'Mina Bacis', 
            ruta_destino: v.ruta_destino || destino || 'Parajes',
            hora_inicio_real: v.hora_inicio_real || v.creado_el || new Date().toISOString(), 
            hora_fin_real: v.hora_fin_real || new Date().toISOString(),
            estado: 'Finalizado',
            pasajeros: (v.pasajeros || []).map((p: any) => ({
              id: p.id_empleado || p.id_manual || p.id_registro_local,
              id_registro_local: p.id_registro_local || `pas_${Date.now()}`,
              id_empleado: p.id_empleado ?? null,
              id_manual: p.id_manual ?? null,
              nombre: p.nombre_completo || p.nombre || 'Trabajador',
              nombre_completo: p.nombre_completo || p.nombre || 'Trabajador',
              puesto: p.puesto_depto || p.puesto || 'Personal Mina Bacis',
              puesto_depto: p.puesto_depto || p.puesto || 'Personal Mina Bacis',
              metodo: p.metodo_registro || 'QR',
              metodo_registro: p.metodo_registro || 'QR',
              hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
              hora_subida: p.hora_subida || new Date().toISOString()
            }))
          }))
        })
      })

      if (res.ok) {
        // Marcar todos como sincronizados
        const actualizados = saved.map(v => ({ ...v, sincronizado: true }))
        setHistorialViajes(actualizados)
        historialRef.current = actualizados
        try { localStorage.setItem('rh_chofer_viajes', JSON.stringify(actualizados)) } catch (_) {}

        const totalPasajeros = viajesASubir.reduce((acc, v) => acc + (v.pasajeros?.length || 0), 0)
        setSyncStatusMsg(`✅ ¡${viajesASubir.length} viajes (${totalPasajeros} pasajeros) enviados a la oficina!`)
        setTimeout(() => setSyncStatusMsg(''), 5000)
      } else {
        setSyncStatusMsg('Error al conectar con la base de datos central.')
      }
    } catch (e: any) {
      setSyncStatusMsg('Sin señal de internet en este momento.')
    } finally {
      setIsSyncing(false)
    }
  }

  /* ─────────────────────────── Flujo de viaje ─────────────────────────── */
  const handleIniciarChecklist = () => {
    try {
      localStorage.setItem('rh_chofer_nombre_guardado', choferNombre)
    } catch (_) {}
    setView('checklist')
  }

  const handleConfirmarInicioRuta = () => {
    const nuevoViaje: ViajeLocal = {
      id_viaje_local: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      id_chofer: choferId || undefined,
      chofer_nombre: choferNombre,
      tipo_vehiculo: tipoVehiculo,
      numero_economico: numeroEconomico,
      ruta_origen: origen,
      ruta_destino: destino,
      hora_inicio_real: new Date().toISOString(),
      estado: 'En Progreso',
      checklist_respuestas: checklistAnswers,
      pasajeros: [],
      sincronizado: false,
      creado_el: new Date().toISOString()
    }

    const lista = [nuevoViaje, ...historialRef.current]
    setHistorialViajes(lista)
    historialRef.current = lista
    setViajeActivo(nuevoViaje)
    viajeActivoRef.current = nuevoViaje
    setPasajerosEnRuta([])
    pasajerosRef.current = []

    try {
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(lista))
    } catch (_) {}

    playBeep(true)
    setView('en_ruta')
    setTimeout(iniciarCamara, 350)
  }

  /* ─────────────────────────── Cámara & Escaneo Rápido a 60 FPS ─────────────────────────── */
  const iniciarCamara = async () => {
    setCameraActive(true)
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }
      iniciarBucleEscaneo()
    } catch (_) {
      setCameraError('Cámara no disponible o bloqueada. Puedes escribir el número de nómina abajo.')
    }
  }

  const detenerCamara = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  const iniciarBucleEscaneo = () => {
    let nativeDetector: any = null
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'data_matrix'] })
      } catch (_) {}
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const canvas = canvasRef.current
    const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null

    const scanWidth = 400
    const scanHeight = 400
    if (canvas) {
      canvas.width = scanWidth
      canvas.height = scanHeight
    }

    const tick = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current
        let detectedCode: string | null = null

        // 1. Intentar con BarcodeDetector nativo
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video)
            if (barcodes?.length && barcodes[0].rawValue) {
              detectedCode = barcodes[0].rawValue
            }
          } catch (_) {}
        }

        // 2. Fallback ultrarrÃ¡pido con jsQR (Universal en todos los telÃ©fonos)
        if (!detectedCode && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            ctx.drawImage(video, 0, 0, scanWidth, scanHeight)
            const imgData = ctx.getImageData(0, 0, scanWidth, scanHeight)
            const code = jsQR(imgData.data, scanWidth, scanHeight, {
              inversionAttempts: 'dontInvert'
            })
            if (code && code.data) {
              detectedCode = code.data
            }
          } catch (_) {}
        }

        if (detectedCode) {
          procesarLecturaQR(detectedCode)
        }
      }

      scanLoopRef.current = requestAnimationFrame(tick)
    }

    scanLoopRef.current = requestAnimationFrame(tick)
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   *  MOTOR DE RESOLUCIÃ“N DE NOMBRES Y ABORDAJE
   * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const encontrarEmpleado = (codigo: string): { match: EmpleadoCache | null, idLimpio: string } => {
    let clean = codigo.trim()
    if (!clean) return { match: null, idLimpio: '' }

    if (clean.startsWith('{') || clean.startsWith('[')) {
      try {
        const parsed = JSON.parse(clean)
        const possible = parsed.numero_empleado || parsed.id_empleado || parsed.id || parsed.nomina || parsed.token
        if (possible) clean = String(possible).trim()
      } catch (_) {}
    }

    const numMatch = clean.match(/\d+/)
    const soloDigitos = numMatch ? numMatch[0] : ''

    const cache = empleadosCacheRef.current

    // 1. Match por nÃºmero de nÃ³mina / empleado
    let found = cache.find(e => 
      (e.numero_empleado && String(e.numero_empleado).trim() === clean) ||
      (soloDigitos && e.numero_empleado && String(e.numero_empleado).trim() === soloDigitos)
    )

    // 2. Match por ID de empleado
    if (!found) {
      found = cache.find(e => e.id_empleado.toLowerCase() === clean.toLowerCase())
    }

    // 3. Match por qr_token
    if (!found) {
      found = cache.find(e => e.qr_token && e.qr_token === clean)
    }

    // 4. Match por nombre si el cÃ³digo contiene texto del nombre
    if (!found && clean.length >= 3) {
      found = cache.find(e => {
        const full = `${e.nombre} ${e.apellido_paterno}`.toLowerCase()
        return full.includes(clean.toLowerCase()) || clean.toLowerCase().includes(full)
      })
    }

    return { match: found || null, idLimpio: soloDigitos || clean }
  }

  const procesarLecturaQR = (codigo: string) => {
    const { match, idLimpio } = encontrarEmpleado(codigo)
    if (!idLimpio && !match) return

    const now = Date.now()
    const esMismoCodigo = idLimpio === lastScannedCodeRef.current
    const tiempoMinimo = esMismoCodigo ? 2000 : 750

    if (now - lastScanTimestampRef.current < tiempoMinimo) return

    lastScanTimestampRef.current = now
    lastScannedCodeRef.current = idLimpio

    const nombreCompleto = match
      ? `${match.nombre} ${match.apellido_paterno}${match.apellido_materno ? ' ' + match.apellido_materno : ''}`.trim()
      : `Trabajador NÃ³mina #${idLimpio}`

    const puestoDepto = match
      ? `${match.puesto || 'Operativo'} â€¢ ${match.departamento || 'Mina Bacis'}`
      : 'Credencial QR'

    const listaActual = pasajerosRef.current

    const duplicado = listaActual.find(p =>
      (match && p.id_empleado === match.id_empleado) ||
      p.id_manual === idLimpio ||
      p.nombre_completo.toLowerCase() === nombreCompleto.toLowerCase()
    )

    if (duplicado) {
      playBeep(false)
      const horaAbordaje = new Date(duplicado.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      mostrarAviso('duplicado', duplicado.nombre_completo, duplicado.puesto_depto, horaAbordaje)
      return
    }

    const nuevo: PasajeroBordo = {
      id_registro_local: `pas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id_empleado: match ? match.id_empleado : undefined,
      id_manual: match ? undefined : idLimpio,
      nombre_completo: nombreCompleto,
      puesto_depto: puestoDepto,
      numero_nomina: match?.numero_empleado || idLimpio,
      metodo_registro: 'QR',
      hora_subida: new Date().toISOString()
    }

    const listaActualizada = [nuevo, ...listaActual]
    pasajerosRef.current = listaActualizada
    setPasajerosEnRuta([...listaActualizada])

    const viaje = viajeActivoRef.current
    if (viaje) {
      const viajeAct = { ...viaje, pasajeros: listaActualizada }
      viajeActivoRef.current = viajeAct
      setViajeActivo(viajeAct)
      const todos = historialRef.current.map(v =>
        v.id_viaje_local === viaje.id_viaje_local ? viajeAct : v
      )
      historialRef.current = todos
      setHistorialViajes(todos)
      try {
        localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos))
      } catch (_) {}
    }

    playBeep(true)
    mostrarAviso('exito', nombreCompleto, puestoDepto)
  }

  const mostrarAviso = (tipo: 'exito' | 'duplicado', nombre: string, depto?: string, hora?: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setScanNotice({ tipo, nombre, depto, hora })
    noticeTimerRef.current = setTimeout(() => setScanNotice(null), 2500)
  }

  const handleRegistroManual = (e: React.FormEvent) => {
    e.preventDefault()
    const id = manualIdInput.trim()
    if (!id) return
    procesarLecturaQR(id)
    setManualIdInput('')
  }

  const eliminarPasajero = (idReg: string) => {
    const filtrados = pasajerosRef.current.filter(p => p.id_registro_local !== idReg)
    pasajerosRef.current = filtrados
    setPasajerosEnRuta([...filtrados])
    const viaje = viajeActivoRef.current
    if (viaje) {
      const viajeAct = { ...viaje, pasajeros: filtrados }
      viajeActivoRef.current = viajeAct
      setViajeActivo(viajeAct)
      const todos = historialRef.current.map(v =>
        v.id_viaje_local === viaje.id_viaje_local ? viajeAct : v
      )
      historialRef.current = todos
      setHistorialViajes(todos)
      try {
        localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos))
      } catch (_) {}
    }
  }

  const handleCerrarViaje = async () => {
    const total = pasajerosRef.current.length
    if (!confirm(`Â¿Llegaste a tu destino (${viajeActivoRef.current?.ruta_destino})?\n\nSe cerrarÃ¡ el viaje con ${total} trabajadores a bordo.`)) return

    detenerCamara()
    const viaje = viajeActivoRef.current
    if (!viaje) return

    const finalizado: ViajeLocal = {
      ...viaje,
      hora_fin_real: new Date().toISOString(),
      estado: 'Finalizado',
      pasajeros: pasajerosRef.current,
      sincronizado: false
    }

    const todos = historialRef.current.map(v =>
      v.id_viaje_local === viaje.id_viaje_local ? finalizado : v
    )
    historialRef.current = todos
    setHistorialViajes(todos)
    try { localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos)) } catch (_) {}

    viajeActivoRef.current = null
    setViajeActivo(null)
    pasajerosRef.current = []
    setPasajerosEnRuta([])
    playBeep(true)
    setView('inicio')

    const listaPasajeros = finalizado.pasajeros.map(p => ({
      id: p.id_empleado || p.id_manual || p.id_registro_local,
      nombre: p.nombre_completo,
      nombre_completo: p.nombre_completo,
      puesto: p.puesto_depto || 'Personal Mina Bacis',
      puesto_depto: p.puesto_depto || 'Personal Mina Bacis',
      hora: new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      hora_subida: p.hora_subida,
      metodo: p.metodo_registro || 'QR',
      metodo_registro: p.metodo_registro || 'QR',
      id_empleado: p.id_empleado || null,
      id_manual: p.id_manual || null,
      id_registro_local: p.id_registro_local
    }))

    if (navigator.onLine) {
      setSyncStatusMsg('Enviando viaje a la oficina...')
      setIsSyncing(true)
      try {
        const res = await fetch('/api/choferes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viajes: [{
              id_viaje_local: finalizado.id_viaje_local,
              id_chofer: finalizado.id_chofer ?? null,
              chofer_nombre: finalizado.chofer_nombre,
              tipo_vehiculo: finalizado.tipo_vehiculo,
              numero_economico: finalizado.numero_economico,
              ruta_origen: finalizado.ruta_origen,
              ruta_destino: finalizado.ruta_destino,
              hora_inicio_real: finalizado.hora_inicio_real,
              hora_fin_real: finalizado.hora_fin_real,
              estado: 'Finalizado',
              pasajeros: listaPasajeros
            }]
          })
        })
        if (res.ok) {
          const updatedTodos = historialRef.current.map(v =>
            v.id_viaje_local === finalizado.id_viaje_local ? { ...v, sincronizado: true } : v
          )
          historialRef.current = updatedTodos
          setHistorialViajes(updatedTodos)
          try { localStorage.setItem('rh_chofer_viajes', JSON.stringify(updatedTodos)) } catch (_) {}
          setSyncStatusMsg('Viaje enviado a la oficina correctamente.')
        } else {
          setSyncStatusMsg('Guardado. Pulsa Subir Viajes al tener internet.')
        }
      } catch (_) {
        setSyncStatusMsg('Sin internet. Pulsa Subir Viajes al llegar a la oficina.')
      } finally {
        setIsSyncing(false)
        setTimeout(() => setSyncStatusMsg(''), 6000)
      }
    } else {
      setSyncStatusMsg('Sin internet. Guardado. Pulsa Subir Viajes al tener senal.')
      setTimeout(() => setSyncStatusMsg(''), 8000)
    }

    alert('Viaje Finalizado. Trabajadores: ' + total + '. Guardado y enviado a la oficina si hay internet.')
  }

  const handleInstalarApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setIsInstalled(true)
      setDeferredPrompt(null)
    } else {
      alert('ðŸ“² Para instalar la App en tu pantalla de inicio:\n\n1. En Chrome, toca los 3 puntos (â‹®)\n2. Elige "Agregar a la pantalla principal" o "Instalar aplicaciÃ³n"\n3. Â¡Listo! Abre como app directa sin internet.')
    }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• RENDER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between selection:bg-emerald-600 font-sans">

      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md">
            <Truck className="w-5 h-5 text-black" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block leading-none">CHOFERES BACIS</span>
            <span className="text-sm font-black text-white block">Control de Rutas QR</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isInstalled && (
            <button onClick={handleInstalarApp} className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md active:scale-95 transition-all">
              ðŸ“² Instalar
            </button>
          )}
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isOnline ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60' : 'bg-zinc-800 text-amber-300 border-zinc-700'}`}>
            {isOnline ? <><Wifi className="w-3 h-3" /> En lÃ­nea</> : <><WifiOff className="w-3 h-3 text-amber-400" /> Modo Sierra</>}
          </span>
        </div>
      </header>

      {/* â•â•â•â•â•â•â•â•â•â• VISTA 1: INICIO (NUEVO RECORRIDO) â•â•â•â•â•â•â•â•â•â• */}
      {view === 'inicio' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in">
          
          {/* BotÃ³n de Sincronizar con la Oficina */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <CloudUpload className="w-4 h-4 text-emerald-400" />
                SincronizaciÃ³n con Oficina
              </span>
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Subiendo...' : 'â˜ï¸ Subir Viajes'}</span>
              </button>
            </div>
            {syncStatusMsg && (
              <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 p-2 rounded-xl border border-emerald-800/60 animate-in fade-in">
                {syncStatusMsg}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" /> Nuevo Recorrido
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Selecciona chofer y ruta para iniciar el abordaje</p>
            </div>

            {/* Chofer */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chofer Operador</label>
              <select value={choferNombre} onChange={e => {
                setChoferNombre(e.target.value)
                const f = choferesList.find(c => `${c.nombre} ${c.apellido_paterno}`.trim() === e.target.value)
                if (f) setChoferId(f.id_empleado)
              }} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3.5 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500">
                {choferesList.map(c => {
                  const n = `${c.nombre} ${c.apellido_paterno}`.trim()
                  return <option key={c.id_empleado} value={n}>ðŸ‘” {n}</option>
                })}
              </select>
            </div>

            {/* VehÃ­culo + No Eco */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">VehÃ­culo</label>
                <select value={tipoVehiculo} onChange={e => setTipoVehiculo(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none">
                  <option value="Camioneta">ðŸ›» Camioneta</option>
                  <option value="CamiÃ³n">ðŸšŒ CamiÃ³n</option>
                  <option value="Urvan">ðŸš Urvan</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">No. Eco</label>
                <input type="text" value={numeroEconomico} onChange={e => setNumeroEconomico(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none" />
              </div>
            </div>

            {/* Origen + Destino */}
            <div className="grid grid-cols-2 gap-3">
              {(['origen', 'destino'] as const).map(campo => (
                <div key={campo} className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{campo === 'origen' ? 'Origen' : 'Destino'}</label>
                  <select value={campo === 'origen' ? origen : destino} onChange={e => campo === 'origen' ? setOrigen(e.target.value) : setDestino(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-bold text-white">
                    {['Obscuridad', 'Parajes', 'Mina Bacis', 'San Miguel', 'Planta'].map(l => <option key={l} value={l}>ðŸ“ {l}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <button onClick={handleIniciarChecklist} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider mt-2">
              <span>Continuar al Checklist</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Historial Reciente */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-2.5">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Viajes guardados en celular ({historialViajes.length})</span>
              <span className="text-[10px] text-emerald-400">100% Offline</span>
            </h3>
            {historialViajes.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-3">Sin viajes previos.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {historialViajes.slice(0, 5).map((v, i) => (
                  <div key={i} className="p-2.5 bg-zinc-800/90 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">{v.ruta_origen} âž” {v.ruta_destino}</span>
                      <div className="text-[10px] text-zinc-400">ðŸ‘¥ {v.pasajeros?.length || 0} trabajadores â€¢ {new Date(v.hora_inicio_real).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">{v.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• VISTA 2: CHECKLIST PRE-SALIDA â•â•â•â•â•â•â•â•â•â• */}
      {view === 'checklist' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setView('inicio')} className="p-2 bg-zinc-800 rounded-xl text-zinc-400">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-black text-white uppercase">Checklist MecÃ¡nico</h2>
                  <span className="text-[10px] text-zinc-400">{origen} âž” {destino}</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">{numeroEconomico}</span>
            </div>
            <div className="space-y-2">
              {Object.entries(checklistAnswers).map(([pregunta, val]) => (
                <button key={pregunta} type="button" onClick={() => setChecklistAnswers(prev => ({ ...prev, [pregunta]: !val }))}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between font-bold text-xs transition-all ${val ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200' : 'bg-rose-950/40 border-rose-600/60 text-rose-200'}`}>
                  <span>{pregunta}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${val ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>{val ? 'âœ“ OK' : 'âœ— Falla'}</span>
                </button>
              ))}
            </div>
            <button onClick={handleConfirmarInicioRuta} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider mt-2">
              <Play className="w-5 h-5 fill-current" />
              <span>ðŸŸ¢ Iniciar Viaje y Abrir EscÃ¡ner QR</span>
            </button>
          </div>
        </main>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• VISTA 3: EN RUTA (ABORDAJE & ESCANEO LIMPIO) â•â•â•â•â•â•â•â•â•â• */}
      {view === 'en_ruta' && viajeActivo && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-3.5 animate-in fade-in">

          {/* Tarjeta de Conteo de Pasajeros */}
          <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-black p-4 rounded-3xl shadow-xl space-y-1.5 border border-amber-300">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest bg-black text-amber-300 px-2.5 py-0.5 rounded-full">
                ðŸŸ¡ EN RUTA â€¢ {viajeActivo.ruta_origen} âž” {viajeActivo.ruta_destino}
              </span>
              <span className="text-xs font-mono font-black bg-black/20 px-2 py-0.5 rounded-lg">â±ï¸ {tiempoTranscurrido}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <div>
                <span className="text-[10px] uppercase text-black/70 block font-bold">Chofer Asignado</span>
                <strong className="text-sm font-black block truncate max-w-[160px]">{viajeActivo.chofer_nombre}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-black/70 block font-bold">Pasajeros a Bordo</span>
                <strong className="text-4xl font-black leading-none">{pasajerosEnRuta.length}</strong>
              </div>
            </div>
          </div>

          {/* Banner AutomÃ¡tico de Scan con Nombre Real del Trabajador */}
          {scanNotice && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-2xl animate-in slide-in-from-top-2 duration-150 ${
              scanNotice.tipo === 'exito' 
                ? 'bg-emerald-500 text-black border-emerald-300' 
                : 'bg-amber-400 text-black border-amber-300'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{scanNotice.tipo === 'exito' ? 'âœ…' : 'âš ï¸'}</span>
                <div>
                  <strong className="text-sm font-black block leading-tight">
                    {scanNotice.tipo === 'exito' ? `Â¡Registrado a bordo! (#${pasajerosEnRuta.length})` : 'âš ï¸ YA ESTÃ EN LA LISTA'}
                  </strong>
                  <span className="text-xs font-black block">{scanNotice.nombre}</span>
                  {scanNotice.depto && <span className="text-[10px] font-bold block opacity-80">{scanNotice.depto}</span>}
                </div>
              </div>
              <button onClick={() => setScanNotice(null)} className="p-1 text-black/60 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Visor de CÃ¡mara de Escaneo Continuo */}
          {cameraActive ? (
            <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border-2 border-emerald-500 shadow-2xl">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-6 border-2 border-dashed border-emerald-400 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-black/70 px-2.5 py-1 rounded-lg">
                  Apunta a la credencial con cÃ³digo QR
                </span>
              </div>
              {cameraError && (
                <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center text-xs text-rose-300 space-y-2">
                  <ShieldAlert className="w-7 h-7 text-rose-400" />
                  <p>{cameraError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-2">
              <Camera className="w-10 h-10 text-zinc-500 mx-auto" />
              <p className="text-xs text-zinc-400 font-bold">CÃ¡mara en pausa.</p>
            </div>
          )}

          {/* Registro Manual si el trabajador olvidÃ³ su gafete */}
          <form onSubmit={handleRegistroManual} className="flex gap-2">
            <input type="text" value={manualIdInput} onChange={e => setManualIdInput(e.target.value)}
              placeholder="Escribe # de NÃ³mina si olvidÃ³ su QR..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500" />
            <button type="submit" className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-2xl border border-zinc-700 shrink-0">+ Registrar</button>
          </form>

          {/* LOS 2 BOTONES PRINCIPALES DE ACCIÃ“N */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cameraActive ? detenerCamara() : iniciarCamara()}
              className={`py-4 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95 uppercase ${cameraActive ? 'bg-zinc-800 text-amber-400 border border-zinc-700' : 'bg-emerald-600 text-white shadow-emerald-600/30'}`}>
              <Camera className="w-4 h-4" />
              {cameraActive ? 'â¸ Pausar CÃ¡mara' : 'ðŸ“· Abrir CÃ¡mara QR'}
            </button>
            <button type="button" onClick={handleCerrarViaje}
              className="py-4 px-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 uppercase">
              <StopCircle className="w-4 h-4" />
              ðŸ Finalizar Viaje ({pasajerosEnRuta.length})
            </button>
          </div>

          {/* Lista Nominal de Trabajadores a Bordo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-zinc-400">
              <span>Trabajadores a Bordo ({pasajerosEnRuta.length})</span>
              <span className="text-emerald-400 text-[10px]">Guardado AutomÃ¡tico âœ“</span>
            </div>
            {pasajerosEnRuta.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4 font-bold">Pasa los gafetes frente a la cÃ¡mara al subir.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {pasajerosEnRuta.map((p, idx) => (
                  <div key={p.id_registro_local || idx} className="p-3 bg-zinc-800/90 rounded-2xl flex justify-between items-center text-xs border border-zinc-700/50 shadow-sm">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                        {pasajerosEnRuta.length - idx}
                      </span>
                      <div className="overflow-hidden">
                        <div className="font-black text-white truncate text-xs">{p.nombre_completo}</div>
                        <div className="text-[11px] text-zinc-400">{p.puesto_depto} â€¢ {new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <button onClick={() => eliminarPasajero(p.id_registro_local)} className="text-zinc-500 hover:text-rose-400 p-1 shrink-0" title="Remover del viaje">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="bg-zinc-900 border-t border-zinc-800 p-2 text-center text-[10px] text-zinc-500">
        Minas de Bacis â€¢ 100% Offline â€¢ Almacenamiento en Memoria Local Activo
      </footer>
    </div>
  )
}
