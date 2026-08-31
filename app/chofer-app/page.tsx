'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Bus, Truck, Car, CheckCircle2, AlertTriangle, Clock, 
  Camera, QrCode, Wifi, WifiOff, RefreshCw, ArrowRight, 
  Check, UserCheck, ShieldCheck, Play, StopCircle, 
  Users, Search, UserPlus, HardHat, FileText, ChevronRight,
  Sparkles, CheckSquare, Trash2, ArrowLeft, Volume2, VolumeX,
  Smartphone, Download, ShieldAlert, X
} from 'lucide-react'

interface EmpleadoCache {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  numero_empleado?: string
}

interface PasajeroBordo {
  id_registro_local: string
  id_empleado?: string
  id_manual?: string
  nombre_completo: string
  puesto_depto?: string
  metodo_registro: 'QR' | 'Manual' | 'Huella'
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

// Choferes Oficiales Registrados (Disponibles 100% Offline)
const DEFAULT_CHOFERES: EmpleadoCache[] = [
  { id_empleado: 'CHOFER-1', nombre: 'Adalberto', apellido_paterno: 'Pinales', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '101' },
  { id_empleado: 'CHOFER-2', nombre: 'Ramon', apellido_paterno: 'Yañez', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '102' },
  { id_empleado: 'CHOFER-3', nombre: 'Oscar', apellido_paterno: 'Vazquez', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '103' },
  { id_empleado: 'CHOFER-4', nombre: 'Enrique', apellido_paterno: 'Linares', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '104' },
  { id_empleado: 'CHOFER-5', nombre: 'Samuel', apellido_paterno: 'Madriles', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '105' },
  { id_empleado: 'CHOFER-6', nombre: 'Jesus', apellido_paterno: 'Saucedo', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '106' }
]

// Generador de sonido Beep con Web Audio API (Sin requerir internet)
function playBeep(success = true) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = success ? 'sine' : 'sawtooth'
    osc.frequency.setValueAtTime(success ? 880 : 320, ctx.currentTime)
    if (success) {
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08)
    }

    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)

    // Vibración en el celular
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(success ? [70, 40, 70] : [180])
    }
  } catch (e) {}
}

export default function ChoferAppMobile() {
  // Estado general de la app
  const [view, setView] = useState<'inicio' | 'checklist' | 'en_ruta'>('inicio')
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [syncLoading, setSyncLoading] = useState<boolean>(false)

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState<boolean>(false)

  // Catálogos locales (Offline Cache)
  const [empleadosCache, setEmpleadosCache] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)
  const [choferesList, setChoferesList] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)

  // Datos del Chofer y Viaje
  const [choferNombre, setChoferNombre] = useState<string>('Adalberto Pinales')
  const [choferId, setChoferId] = useState<string>('CHOFER-1')
  const [tipoVehiculo, setTipoVehiculo] = useState<string>('Camioneta')
  const [numeroEconomico, setNumeroEconomico] = useState<string>('CAM-01')
  const [origen, setOrigen] = useState<string>('Obscuridad')
  const [destino, setDestino] = useState<string>('Parajes')

  // Checklist de salida
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, boolean>>({
    'Llantas y presión OK': true,
    'Nivel de aceite y agua OK': true,
    'Frenos y luces funcionando': true,
    'Radio de mina encendido': true,
    'Extintor y botiquín a bordo': true,
  })

  // Viaje Activo
  const [viajeActivo, setViajeActivo] = useState<ViajeLocal | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState<string>('00:00:00')
  const [pasajerosEnRuta, setPasajerosEnRuta] = useState<PasajeroBordo[]>([])
  
  // Banner de Aviso Automático de Escaneo (Nuevo vs Duplicado)
  const [scanNotice, setScanNotice] = useState<{ tipo: 'exito' | 'duplicado', mensaje: string, nombre?: string, id?: string } | null>(null)

  // Escáner de Cámara
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [manualIdInput, setManualIdInput] = useState<string>('')
  const [cooldownScan, setCooldownScan] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  // Historial Local de Viajes
  const [historialViajes, setHistorialViajes] = useState<ViajeLocal[]>([])

  // 1. Inicialización & Service Worker & Monitoreo de Red (Sin alertas de error)
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    
    // Registrar Service Worker para PWA Offline
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Capturar evento de instalación nativa en Android
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handleOnline = () => {
      setIsOnline(true)
      autoSyncData()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cargar datos locales guardados
    cargarDatosLocales()

    // Si hay conexión, refrescar catálogos de fondo
    if (navigator.onLine) {
      descargarCatalogoFondo()
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      detenerCamara()
    }
  }, [])

  // Instalar PWA
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    } else {
      alert('📲 Para instalar la App en tu pantalla de inicio:\n\n1. Toca los tres puntos (⋮) en Chrome.\n2. Elige "Agregar a la pantalla principal" o "Instalar aplicación".\n3. ¡Listo! Se abrirá como app sin internet.')
    }
  }

  // 2. Temporizador del Viaje en Ruta
  useEffect(() => {
    let interval: any = null
    if (view === 'en_ruta' && viajeActivo) {
      interval = setInterval(() => {
        const inicio = new Date(viajeActivo.hora_inicio_real).getTime()
        const ahora = new Date().getTime()
        const diffMs = Math.max(0, ahora - inicio)
        
        const hrs = Math.floor(diffMs / 3600000).toString().padStart(2, '0')
        const mins = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0')
        const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0')
        
        setTiempoTranscurrido(`${hrs}:${mins}:${secs}`)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [view, viajeActivo])

  // Cargar estado persistente de LocalStorage
  const cargarDatosLocales = () => {
    try {
      const savedViajes = localStorage.getItem('rh_chofer_viajes')
      if (savedViajes) {
        const parsed: ViajeLocal[] = JSON.parse(savedViajes)
        setHistorialViajes(parsed)
        const activo = parsed.find(v => v.estado === 'En Progreso')
        if (activo) {
          setViajeActivo(activo)
          setPasajerosEnRuta(activo.pasajeros || [])
          setView('en_ruta')
        }
      }

      const savedEmpleados = localStorage.getItem('rh_chofer_empleados_cache')
      if (savedEmpleados) {
        const emps: EmpleadoCache[] = JSON.parse(savedEmpleados)
        if (emps && emps.length > 0) {
          setEmpleadosCache(emps)
          const choferes = emps.filter(e => 
            (e.puesto || '').toLowerCase().includes('chofer') || 
            (e.puesto || '').toLowerCase().includes('conductor') ||
            (e.departamento || '').toLowerCase().includes('transporte') ||
            (e.departamento || '').toLowerCase().includes('logistica')
          )
          setChoferesList(choferes.length > 0 ? choferes : DEFAULT_CHOFERES)
        }
      }

      const savedChofer = localStorage.getItem('rh_chofer_nombre_guardado')
      if (savedChofer) setChoferNombre(savedChofer)
    } catch (e) {}
  }

  // Descarga silenciosa de catálogo cuando haya red (sin bloquear la app)
  const descargarCatalogoFondo = async () => {
    try {
      const { data: emps } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado')

      if (emps && emps.length > 0) {
        setEmpleadosCache(emps)
        localStorage.setItem('rh_chofer_empleados_cache', JSON.stringify(emps))
        const choferes = emps.filter(e => 
          (e.puesto || '').toLowerCase().includes('chofer') || 
          (e.puesto || '').toLowerCase().includes('conductor') ||
          (e.departamento || '').toLowerCase().includes('transporte') ||
          (e.departamento || '').toLowerCase().includes('logistica')
        )
        setChoferesList(choferes.length > 0 ? choferes : DEFAULT_CHOFERES)
      }
    } catch (e) {}
  }

  // Sincronización Silenciosa con el Servidor
  const autoSyncData = async () => {
    if (!navigator.onLine) return

    try {
      const savedViajes: ViajeLocal[] = JSON.parse(localStorage.getItem('rh_chofer_viajes') || '[]')
      const pendientes = savedViajes.filter(v => !v.sincronizado && v.estado === 'Finalizado')

      if (pendientes.length > 0) {
        setSyncLoading(true)

        const viajesPayload = pendientes.map(v => ({
          id_viaje_local: v.id_viaje_local,
          id_chofer: v.id_chofer || null,
          ruta_origen: v.ruta_origen,
          ruta_destino: v.ruta_destino,
          hora_inicio_real: v.hora_inicio_real,
          hora_fin_real: v.hora_fin_real,
          estado: v.estado
        }))

        const pasajerosPayload: any[] = []
        pendientes.forEach(v => {
          v.pasajeros.forEach(p => {
            pasajerosPayload.push({
              id_registro_local: p.id_registro_local,
              id_viaje_local: v.id_viaje_local,
              id_empleado: p.id_empleado || null,
              id_manual: p.id_manual || null,
              metodo_registro: p.metodo_registro,
              hora_subida: p.hora_subida
            })
          })
        })

        const checklistsPayload = pendientes.map(v => ({
          id_viaje_local: v.id_viaje_local,
          respuestas_json: v.checklist_respuestas
        }))

        const res = await fetch('/api/choferes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viajes: viajesPayload,
            pasajeros: pasajerosPayload,
            respuestas_checklist: checklistsPayload
          })
        })

        if (res.ok) {
          const updatedViajes = savedViajes.map(v => {
            if (pendientes.some(p => p.id_viaje_local === v.id_viaje_local)) {
              return { ...v, sincronizado: true }
            }
            return v
          })
          setHistorialViajes(updatedViajes)
          localStorage.setItem('rh_chofer_viajes', JSON.stringify(updatedViajes))
        }
      }
    } catch (e) {
    } finally {
      setSyncLoading(false)
    }
  }

  // 3. Inicio de Viaje & Checklist
  const handleIniciarChecklist = () => {
    localStorage.setItem('rh_chofer_nombre_guardado', choferNombre)
    setView('checklist')
  }

  const handleConfirmarInicioRuta = () => {
    const nuevoViaje: ViajeLocal = {
      id_viaje_local: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
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

    const nuevosViajes = [nuevoViaje, ...historialViajes]
    setHistorialViajes(nuevosViajes)
    setViajeActivo(nuevoViaje)
    setPasajerosEnRuta([])
    localStorage.setItem('rh_chofer_viajes', JSON.stringify(nuevosViajes))

    // Guardar en bitácora local de rutas
    const globalHistory = JSON.parse(localStorage.getItem('rh_rutas_qr_global_history') || '[]')
    localStorage.setItem('rh_rutas_qr_global_history', JSON.stringify([nuevoViaje, ...globalHistory]))

    playBeep(true)
    setView('en_ruta')
    // Abrir cámara automáticamente al entrar a ruta
    setTimeout(() => {
      iniciarCamara()
    }, 300)
  }

  // 4. Manejo de Cámara QR
  const toggleCamara = () => {
    if (cameraActive) {
      detenerCamara()
    } else {
      iniciarCamara()
    }
  }

  const iniciarCamara = async () => {
    setCameraActive(true)
    setCameraError('')

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }

      iniciarBucleEscaneo()
    } catch (err: any) {
      setCameraError('Cámara no disponible. Usa el número de nómina abajo.')
    }
  }

  const detenerCamara = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const iniciarBucleEscaneo = async () => {
    let nativeDetector: any = null
    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] })
      } catch (e) {}
    }

    const tick = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current

        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video)
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue
              if (rawValue) {
                procesarLecturaQR(rawValue)
              }
            }
          } catch (e) {}
        }
      }

      scanLoopRef.current = requestAnimationFrame(tick)
    }

    scanLoopRef.current = requestAnimationFrame(tick)
  }

  // 5. Procesamiento Ultra-Rápido y Automático del QR
  const procesarLecturaQR = (codigo: string) => {
    if (cooldownScan) return

    const idLimpio = codigo.trim()
    if (!idLimpio) return

    // Buscar en la memoria de empleados
    let match = empleadosCache.find(e => 
      e.id_empleado === idLimpio || 
      String(e.numero_empleado) === idLimpio ||
      codigo.includes(e.id_empleado)
    )

    if (!match && idLimpio.startsWith('{')) {
      try {
        const parsed = JSON.parse(idLimpio)
        const searchId = parsed.id || parsed.id_empleado || parsed.numero_empleado
        if (searchId) {
          match = empleadosCache.find(e => e.id_empleado === searchId || String(e.numero_empleado) === String(searchId))
        }
      } catch (e) {}
    }

    const nombreTrabajador = match ? `${match.nombre} ${match.apellido_paterno}`.trim() : `Trabajador #${idLimpio}`
    const idIdentificador = match ? (match.numero_empleado || match.id_empleado) : idLimpio

    // REVISAR SI YA ESTÁ REGISTRADO EN ESTE VIAJE
    const yaRegistrado = pasajerosEnRuta.find(p => 
      (match && p.id_empleado === match.id_empleado) || 
      p.id_manual === idLimpio || 
      p.nombre_completo.toLowerCase() === nombreTrabajador.toLowerCase()
    )

    if (yaRegistrado) {
      // ⚠️ AVISO AUTOMÁTICO DE DUPLICADO
      playBeep(false)
      setScanNotice({
        tipo: 'duplicado',
        mensaje: '⚠️ YA ESTÁ EN LA LISTA',
        nombre: yaRegistrado.nombre_completo,
        id: String(idIdentificador)
      })
      setCooldownScan(true)
      setTimeout(() => {
        setCooldownScan(false)
      }, 1100)
      return
    }

    // ✅ REGISTRO AUTOMÁTICO INSTANTÁNEO
    const nuevoPasajero: PasajeroBordo = {
      id_registro_local: 'pas_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      id_empleado: match ? match.id_empleado : undefined,
      id_manual: match ? undefined : idLimpio,
      nombre_completo: match ? `${match.nombre} ${match.apellido_paterno} ${match.apellido_materno || ''}`.trim() : `Empleado Nómina #${idLimpio}`,
      puesto_depto: match ? `${match.puesto || ''} • ${match.departamento || ''}` : 'Credencial QR',
      metodo_registro: 'QR',
      hora_subida: new Date().toISOString()
    }

    agregarPasajeroAlViaje(nuevoPasajero)
    playBeep(true)
    
    // Aviso de Registro Exitoso
    setScanNotice({
      tipo: 'exito',
      mensaje: `✅ REGISTRADO A BORDO (#${pasajerosEnRuta.length + 1})`,
      nombre: nuevoPasajero.nombre_completo,
      id: String(idIdentificador)
    })

    setCooldownScan(true)
    setTimeout(() => {
      setCooldownScan(false)
    }, 850)
  }

  // Registro Manual si no trae credencial
  const handleRegistroManual = (e: React.FormEvent) => {
    e.preventDefault()
    const id = manualIdInput.trim()
    if (!id) return
    procesarLecturaQR(id)
    setManualIdInput('')
  }

  const agregarPasajeroAlViaje = (pasajero: PasajeroBordo) => {
    const listaActualizada = [pasajero, ...pasajerosEnRuta]
    setPasajerosEnRuta(listaActualizada)

    if (viajeActivo) {
      const viajeActualizado: ViajeLocal = {
        ...viajeActivo,
        pasajeros: listaActualizada
      }
      setViajeActivo(viajeActualizado)

      const todosLosViajes = historialViajes.map(v => 
        v.id_viaje_local === viajeActivo.id_viaje_local ? viajeActualizado : v
      )
      setHistorialViajes(todosLosViajes)
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(todosLosViajes))
    }
  }

  const eliminarPasajero = (idRegistro: string) => {
    const filtrados = pasajerosEnRuta.filter(p => p.id_registro_local !== idRegistro)
    setPasajerosEnRuta(filtrados)
    if (viajeActivo) {
      const viajeActualizado = { ...viajeActivo, pasajeros: filtrados }
      setViajeActivo(viajeActualizado)
      const todos = historialViajes.map(v => v.id_viaje_local === viajeActivo.id_viaje_local ? viajeActualizado : v)
      setHistorialViajes(todos)
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos))
    }
  }

  // 6. Cerrar y Enviar Viaje (1 Clic)
  const handleCerrarViaje = () => {
    const totalPasajeros = pasajerosEnRuta.length
    if (!confirm(`¿Deseas cerrar el viaje de ${viajeActivo?.ruta_origen} a ${viajeActivo?.ruta_destino} con ${totalPasajeros} pasajeros a bordo?`)) {
      return
    }

    detenerCamara()

    if (viajeActivo) {
      const viajeFinalizado: ViajeLocal = {
        ...viajeActivo,
        hora_fin_real: new Date().toISOString(),
        estado: 'Finalizado',
        pasajeros: pasajerosEnRuta,
        sincronizado: false
      }

      const todosLosViajes = historialViajes.map(v => 
        v.id_viaje_local === viajeActivo.id_viaje_local ? viajeFinalizado : v
      )
      setHistorialViajes(todosLosViajes)
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(todosLosViajes))
      setViajeActivo(null)

      playBeep(true)

      // Si hay internet, sincronizar de inmediato
      if (navigator.onLine) {
        autoSyncData()
      }

      alert(`✅ ¡Viaje Finalizado!\n\nTotal de pasajeros transportados: ${totalPasajeros}.\nLa información quedó guardada con éxito.`)
      setView('inicio')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col justify-between selection:bg-emerald-600">
      
      {/* Header Móvil Ultra-Limpio */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-black shadow-md">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block leading-none">CHOFERES BACIS</span>
            <span className="text-sm font-black text-white block">Control de Rutas QR</span>
          </div>
        </div>

        {/* Indicador de Estado */}
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <span className="flex items-center gap-1 bg-emerald-950 text-emerald-400 border border-emerald-700/60 px-2.5 py-1 rounded-full text-[11px] font-bold">
              <Wifi className="w-3 h-3" /> En línea
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-zinc-800 text-amber-300 border border-zinc-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
              <WifiOff className="w-3 h-3 text-amber-400" /> Modo Sierra (Offline)
            </span>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VISTA 1: INICIO (SELECCIÓN Y NUEVO VIAJE)                                 */}
      {/* ========================================================================= */}
      {view === 'inicio' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in">
          
          {/* Banner de Instalación (si no está instalada) */}
          {!isInstalled && (
            <div className="bg-gradient-to-r from-emerald-950 to-zinc-900 border border-emerald-500/50 p-3.5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📱</span>
                <div>
                  <span className="text-xs font-black text-emerald-400 block uppercase">App en tu Pantalla</span>
                  <span className="text-[11px] text-zinc-300">Toca para poner el ícono en tu celular</span>
                </div>
              </div>
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 bg-emerald-500 text-black font-black text-xs rounded-xl shadow-md"
              >
                Instalar
              </button>
            </div>
          )}

          {/* Formulario de Inicio de Viaje */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-base font-black text-white uppercase flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                Nuevo Recorrido
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Selecciona chofer y ruta para empezar a escanear</p>
            </div>

            {/* Chofer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chofer Operador</label>
              <select
                value={choferNombre}
                onChange={e => {
                  setChoferNombre(e.target.value)
                  const found = choferesList.find(c => `${c.nombre} ${c.apellido_paterno}`.trim() === e.target.value)
                  if (found) setChoferId(found.id_empleado)
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3.5 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                {choferesList.map(c => {
                  const nombreCompleto = `${c.nombre} ${c.apellido_paterno}`.trim()
                  return (
                    <option key={c.id_empleado} value={nombreCompleto}>
                      👔 {nombreCompleto}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Unidad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Vehículo</label>
                <select
                  value={tipoVehiculo}
                  onChange={e => setTipoVehiculo(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none"
                >
                  <option value="Camioneta">🛻 Camioneta</option>
                  <option value="Camión">🚌 Camión</option>
                  <option value="Urvan">🚐 Urvan</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">No. Eco</label>
                <input
                  type="text"
                  value={numeroEconomico}
                  onChange={e => setNumeroEconomico(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Origen y Destino */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Origen</label>
                <select
                  value={origen}
                  onChange={e => setOrigen(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-bold text-white"
                >
                  <option value="Obscuridad">📍 Obscuridad</option>
                  <option value="Parajes">📍 Parajes</option>
                  <option value="Mina Bacis">📍 Mina Bacis</option>
                  <option value="San Miguel">📍 San Miguel</option>
                  <option value="Planta">📍 Planta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Destino</label>
                <select
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-bold text-white"
                >
                  <option value="Parajes">📍 Parajes</option>
                  <option value="Obscuridad">📍 Obscuridad</option>
                  <option value="Mina Bacis">📍 Mina Bacis</option>
                  <option value="San Miguel">📍 San Miguel</option>
                  <option value="Planta">📍 Planta</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleIniciarChecklist}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wider mt-2"
            >
              <span>Continuar al Checklist</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Historial Reciente Guardado en el Teléfono */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-2.5">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Viajes en este Celular ({historialViajes.length})
              </span>
              <span className="text-[10px] text-emerald-400">100% Guardado</span>
            </h3>

            {historialViajes.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-3">No hay viajes previos en este celular.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {historialViajes.slice(0, 5).map((v, i) => (
                  <div key={i} className="p-2.5 bg-zinc-800/90 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">{v.ruta_origen} ➔ {v.ruta_destino}</span>
                      <div className="text-[10px] text-zinc-400">
                        👥 {v.pasajeros?.length || 0} personas • {new Date(v.hora_inicio_real).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                      {v.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: CHECKLIST PRE-SALIDA                                             */}
      {/* ========================================================================= */}
      {view === 'checklist' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setView('inicio')} className="p-2 bg-zinc-800 rounded-xl text-zinc-400">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-black text-white uppercase">Checklist Mecánico</h2>
                  <span className="text-[10px] text-zinc-400">{origen} ➔ {destino}</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">{numeroEconomico}</span>
            </div>

            {/* Puntos de Inspección */}
            <div className="space-y-2">
              {Object.entries(checklistAnswers).map(([pregunta, val]) => (
                <button
                  key={pregunta}
                  type="button"
                  onClick={() => setChecklistAnswers(prev => ({ ...prev, [pregunta]: !val }))}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between font-bold text-xs transition-all ${
                    val ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200' : 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                  }`}
                >
                  <span>{pregunta}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                    val ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                  }`}>
                    {val ? '✓ OK' : '✗ Falla'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleConfirmarInicioRuta}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wider mt-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>🟢 Iniciar Viaje y Abrir QR</span>
            </button>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: EN RUTA (ESCÁNER AUTOMÁTICO Y 2 BOTONES PRINCIPALES)              */}
      {/* ========================================================================= */}
      {view === 'en_ruta' && viajeActivo && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-3.5 animate-in fade-in">
          
          {/* TARJETA DE CONTEO PROTAGÓNICA */}
          <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-black p-4 rounded-3xl shadow-xl space-y-1.5 border border-amber-300">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest bg-black text-amber-300 px-2.5 py-0.5 rounded-full">
                🟡 EN RUTA • {viajeActivo.ruta_origen} ➔ {viajeActivo.ruta_destino}
              </span>
              <span className="text-xs font-mono font-black bg-black/20 px-2 py-0.5 rounded-lg">
                ⏱️ {tiempoTranscurrido}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div>
                <span className="text-[10px] uppercase text-black/70 block font-bold">Chofer Asignado</span>
                <strong className="text-sm font-black block truncate max-w-[170px]">{viajeActivo.chofer_nombre}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-black/70 block font-bold">Pasajeros a Bordo</span>
                <strong className="text-3xl font-black leading-none">{pasajerosEnRuta.length}</strong>
              </div>
            </div>
          </div>

          {/* BANNER DE AVISO AUTOMÁTICO DE ESCANEO (VERDE = REGISTRADO / AMARILLO = DUPLICADO) */}
          {scanNotice && (
            <div className={`p-3 rounded-2xl border flex items-center justify-between shadow-xl animate-in slide-in-from-top-2 duration-200 ${
              scanNotice.tipo === 'exito' 
                ? 'bg-emerald-500 text-black border-emerald-300' 
                : 'bg-amber-500 text-black border-amber-300'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{scanNotice.tipo === 'exito' ? '✅' : '⚠️'}</span>
                <div>
                  <strong className="text-xs font-black block leading-tight">{scanNotice.mensaje}</strong>
                  <span className="text-[11px] font-bold block">{scanNotice.nombre}</span>
                </div>
              </div>
              <button onClick={() => setScanNotice(null)} className="p-1 text-black/60 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* VISOR DE CÁMARA */}
          {cameraActive ? (
            <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border-2 border-emerald-500 shadow-2xl flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              
              {/* Mira de Escaneo Centrada */}
              <div className="absolute inset-5 border-2 border-dashed border-emerald-400 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-black/70 px-2.5 py-1 rounded-lg">
                  Apunta a la credencial QR
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
              <h3 className="text-xs font-black text-zinc-300 uppercase">Cámara en Pausa</h3>
              <p className="text-[11px] text-zinc-500">Presiona el botón de abajo para reactivar el escáner.</p>
            </div>
          )}

          {/* Registro Manual si no traen gafete */}
          <form onSubmit={handleRegistroManual} className="flex gap-2">
            <input
              type="text"
              value={manualIdInput}
              onChange={e => setManualIdInput(e.target.value)}
              placeholder="Escribe # Nómina o ID si no traen QR..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-2xl border border-zinc-700 shrink-0"
            >
              + Agregar
            </button>
          </form>

          {/* ================================================================= */}
          {/* LOS 2 BOTONES PRINCIPALES DE RUTA                                 */}
          {/* ================================================================= */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* BOTÓN 1: ABRIR / CERRAR QR */}
            <button
              type="button"
              onClick={toggleCamara}
              className={`py-3.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95 uppercase ${
                cameraActive 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{cameraActive ? '⏸️ Pausar Cámara' : '📷 Abrir Cámara QR'}</span>
            </button>

            {/* BOTÓN 2: CERRAR Y ENVIAR VIAJE */}
            <button
              type="button"
              onClick={handleCerrarViaje}
              className="py-3.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 uppercase"
            >
              <StopCircle className="w-4 h-4" />
              <span>🏁 Cerrar Viaje ({pasajerosEnRuta.length})</span>
            </button>
          </div>

          {/* Lista de Pasajeros Registrados en este Viaje */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-zinc-400">
              <span>Lista de Pasajeros a Bordo ({pasajerosEnRuta.length})</span>
              <span className="text-emerald-400 text-[10px]">Guardado Automático</span>
            </div>

            {pasajerosEnRuta.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-3">Escanea las credenciales con la cámara.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {pasajerosEnRuta.map((p, idx) => (
                  <div key={p.id_registro_local || idx} className="p-2 bg-zinc-800/90 rounded-xl flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="overflow-hidden">
                        <div className="font-bold text-white truncate">{p.nombre_completo}</div>
                        <div className="text-[10px] text-zinc-400">{new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {p.metodo_registro}</div>
                      </div>
                    </div>
                    <button onClick={() => eliminarPasajero(p.id_registro_local)} className="text-zinc-500 hover:text-rose-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-zinc-900 border-t border-zinc-800 p-2 text-center text-[10px] text-zinc-500">
        <span>Minas de Bacis • Almacenamiento en Memoria Local Activo</span>
      </footer>

    </div>
  )
}
