'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Bus, Truck, Car, CheckCircle2, AlertTriangle, Clock, 
  Camera, QrCode, Wifi, WifiOff, RefreshCw, ArrowRight, 
  Check, UserCheck, ShieldCheck, Play, StopCircle, 
  Users, Search, UserPlus, HardHat, FileText, ChevronRight,
  Sparkles, CheckSquare, Trash2, ArrowLeft, Volume2, VolumeX,
  Smartphone, Download, ShieldAlert
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

// 6 Choferes Oficiales Registrados (Disponibles 100% Offline desde el primer arranque)
const DEFAULT_CHOFERES: EmpleadoCache[] = [
  { id_empleado: 'CHOFER-1', nombre: 'Adalberto', apellido_paterno: 'Pinales', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '101' },
  { id_empleado: 'CHOFER-2', nombre: 'Ramon', apellido_paterno: 'Yañez', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '102' },
  { id_empleado: 'CHOFER-3', nombre: 'Oscar', apellido_paterno: 'Vazquez', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '103' },
  { id_empleado: 'CHOFER-4', nombre: 'Enrique', apellido_paterno: 'Linares', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '104' },
  { id_empleado: 'CHOFER-5', nombre: 'Samuel', apellido_paterno: 'Madriles', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '105' },
  { id_empleado: 'CHOFER-6', nombre: 'Jesus', apellido_paterno: 'Saucedo', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '106' }
]

// Generador de sonido Beep con Web Audio API (Sin requerir archivos externos de audio)
function playBeep(success = true) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = success ? 'sine' : 'sawtooth'
    osc.frequency.setValueAtTime(success ? 880 : 300, ctx.currentTime)
    if (success) {
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1)
    }

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)

    // Vibración háptica en celulares Android
    if (navigator.vibrate) {
      navigator.vibrate(success ? [80, 50, 80] : [200])
    }
  } catch (e) {}
}

export default function ChoferAppMobile() {
  // Estado general de la app
  const [view, setView] = useState<'inicio' | 'checklist' | 'en_ruta' | 'bitacora_sync'>('inicio')
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [syncLoading, setSyncLoading] = useState<boolean>(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('')

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState<boolean>(false)

  // Catálogos locales (Offline Cache)
  const [empleadosCache, setEmpleadosCache] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)
  const [choferesList, setChoferesList] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)
  const [checklistsConfig, setChecklistsConfig] = useState<Array<{ id_pregunta: string, pregunta: string, activa: boolean }>>([])

  // Datos del Chofer y Viaje en Configuración
  const [choferNombre, setChoferNombre] = useState<string>('Adalberto Pinales')
  const [choferId, setChoferId] = useState<string>('CHOFER-1')
  const [tipoVehiculo, setTipoVehiculo] = useState<string>('Camioneta')
  const [numeroEconomico, setNumeroEconomico] = useState<string>('CAM-01')
  const [origen, setOrigen] = useState<string>('Obscuridad')
  const [destino, setDestino] = useState<string>('Parajes')
  const [otroOrigen, setOtroOrigen] = useState<string>('')
  const [otroDestino, setOtroDestino] = useState<string>('')

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
  const [ultimoPasajero, setUltimoPasajero] = useState<PasajeroBordo | null>(null)

  // Escáner de Cámara
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [manualIdInput, setManualIdInput] = useState<string>('')
  const [cooldownScan, setCooldownScan] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  // Historial Local de Viajes
  const [historialViajes, setHistorialViajes] = useState<ViajeLocal[]>([])

  // 1. Inicialización & Service Worker & Monitoreo de Red
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    
    // Registrar Service Worker para PWA Offline
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Capturar evento de instalación nativa en Android / Chrome
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
      alert('📲 Para instalar la App en tu pantalla de inicio:\n\n1. Toca los tres puntos (⋮) en la esquina superior de Chrome.\n2. Selecciona "Agregar a la pantalla principal" o "Instalar aplicación".\n3. ¡Listo! Se creará el ícono en tu teléfono para abrirla sin internet.')
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
        // Revisar si había un viaje activo que no se cerró
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

      const savedChecklists = localStorage.getItem('rh_chofer_checklists_config')
      if (savedChecklists) {
        const configs = JSON.parse(savedChecklists)
        setChecklistsConfig(configs)
        const initialAnswers: Record<string, boolean> = {}
        configs.forEach((c: any) => {
          if (c.activa) initialAnswers[c.pregunta] = true
        })
        if (Object.keys(initialAnswers).length > 0) {
          setChecklistAnswers(initialAnswers)
        }
      }
    } catch (e) {
      console.error('Error cargando localStorage:', e)
    }
  }

  // Sincronización Manual o Automática con Supabase / API
  const syncConServidor = async () => {
    if (!navigator.onLine) {
      alert('⚠️ Sin conexión a internet. Conéctate al WiFi de la oficina para sincronizar.')
      return
    }

    setSyncLoading(true)
    setSyncStatusMsg('Descargando catálogos y actualizando datos...')

    try {
      // 1. Descargar catálogo de empleados para la cámara offline
      const { data: emps, error: errEmp } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado')

      if (!errEmp && emps && emps.length > 0) {
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

      // 2. Subir viajes pendientes de sincronizar
      const savedViajes: ViajeLocal[] = JSON.parse(localStorage.getItem('rh_chofer_viajes') || '[]')
      const pendientes = savedViajes.filter(v => !v.sincronizado && v.estado === 'Finalizado')

      if (pendientes.length > 0) {
        setSyncStatusMsg(`Subiendo ${pendientes.length} viaje(s) terminado(s)...`)

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

        // Enviar a la API route de Next.js
        const res = await fetch('/api/choferes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viajes: viajesPayload,
            pasajeros: pasajerosPayload,
            respuestas_checklist: checklistsPayload
          })
        })

        if (!res.ok) {
          throw new Error('Error al sincronizar con el servidor')
        }

        // Marcar como sincronizados en el LocalStorage
        const updatedViajes = savedViajes.map(v => {
          if (pendientes.some(p => p.id_viaje_local === v.id_viaje_local)) {
            return { ...v, sincronizado: true }
          }
          return v
        })
        setHistorialViajes(updatedViajes)
        localStorage.setItem('rh_chofer_viajes', JSON.stringify(updatedViajes))
      }

      setSyncStatusMsg('✅ Sincronización exitosa. Todos los viajes quedaron guardados en el sistema.')
      playBeep(true)
    } catch (e: any) {
      console.error(e)
      setSyncStatusMsg('⚠️ Nota: Los viajes siguen guardados en tu celular de forma segura.')
    } finally {
      setSyncLoading(false)
    }
  }

  const autoSyncData = () => {
    syncConServidor().catch(() => {})
  }

  // 3. Inicio de Viaje & Checklist
  const handleIniciarChecklist = () => {
    if (!choferNombre.trim()) {
      alert('Por favor selecciona o ingresa tu nombre de chofer.')
      return
    }
    localStorage.setItem('rh_chofer_nombre_guardado', choferNombre)
    setView('checklist')
  }

  const handleConfirmarInicioRuta = () => {
    const rutaOrigenFinal = origen === 'Otro' ? otroOrigen : origen
    const rutaDestinoFinal = destino === 'Otro' ? otroDestino : destino

    if (!rutaOrigenFinal.trim() || !rutaDestinoFinal.trim()) {
      alert('Por favor especifica el origen y el destino de la ruta.')
      return
    }

    const nuevoViaje: ViajeLocal = {
      id_viaje_local: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      id_chofer: choferId || undefined,
      chofer_nombre: choferNombre,
      tipo_vehiculo: tipoVehiculo,
      numero_economico: numeroEconomico,
      ruta_origen: rutaOrigenFinal,
      ruta_destino: rutaDestinoFinal,
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

    // Guardar también en el historial global de rutas
    const globalHistory = JSON.parse(localStorage.getItem('rh_rutas_qr_global_history') || '[]')
    localStorage.setItem('rh_rutas_qr_global_history', JSON.stringify([nuevoViaje, ...globalHistory]))

    playBeep(true)
    setView('en_ruta')
    // Iniciar cámara automáticamente
    setTimeout(() => {
      iniciarCamara()
    }, 400)
  }

  // 4. Manejo de Cámara y Escáner QR
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
      console.error('Error al abrir cámara:', err)
      setCameraError('Permiso de cámara requerido. Si está bloqueada, toca el candado 🔒 en tu navegador y activa "Cámara". O usa el registro manual de ID abajo.')
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

  // 5. Procesamiento de Código QR / Identificación del Pasajero
  const procesarLecturaQR = (codigo: string) => {
    if (cooldownScan) return

    const idLimpio = codigo.trim()
    if (!idLimpio) return

    // Buscar en la memoria de empleados precargados
    let match = empleadosCache.find(e => 
      e.id_empleado === idLimpio || 
      String(e.numero_empleado) === idLimpio ||
      codigo.includes(e.id_empleado)
    )

    // Si el QR tiene formato JSON (ej. {"id":"uuid", "nombre":"Juan"})
    if (!match && idLimpio.startsWith('{')) {
      try {
        const parsed = JSON.parse(idLimpio)
        if (parsed.id || parsed.id_empleado) {
          const searchId = parsed.id || parsed.id_empleado
          match = empleadosCache.find(e => e.id_empleado === searchId || String(e.numero_empleado) === searchId)
        }
      } catch (e) {}
    }

    const yaRegistrado = pasajerosEnRuta.some(p => 
      (match && p.id_empleado === match.id_empleado) || p.id_manual === idLimpio
    )

    if (yaRegistrado) {
      setCooldownScan(true)
      setTimeout(() => setCooldownScan(false), 1800)
      return
    }

    // Registrar abordaje
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

    setCooldownScan(true)
    setTimeout(() => setCooldownScan(false), 1500)
  }

  // 6. Registro Manual por ID
  const handleRegistroManual = (e: React.FormEvent) => {
    e.preventDefault()
    const id = manualIdInput.trim()
    if (!id) return

    const match = empleadosCache.find(e => 
      e.id_empleado.toLowerCase() === id.toLowerCase() || 
      (e.numero_empleado && String(e.numero_empleado).toLowerCase() === id.toLowerCase()) ||
      `${e.nombre} ${e.apellido_paterno}`.toLowerCase().includes(id.toLowerCase())
    )

    const yaRegistrado = pasajerosEnRuta.some(p => 
      (match && p.id_empleado === match.id_empleado) || p.id_manual === id
    )

    if (yaRegistrado) {
      alert('⚠️ Este pasajero ya está registrado en este viaje.')
      return
    }

    const nuevoPasajero: PasajeroBordo = {
      id_registro_local: 'pas_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      id_empleado: match ? match.id_empleado : undefined,
      id_manual: match ? undefined : id,
      nombre_completo: match ? `${match.nombre} ${match.apellido_paterno} ${match.apellido_materno || ''}`.trim() : `Nómina #${id}`,
      puesto_depto: match ? `${match.puesto || ''} • ${match.departamento || ''}` : 'Registro Manual',
      metodo_registro: 'Manual',
      hora_subida: new Date().toISOString()
    }

    agregarPasajeroAlViaje(nuevoPasajero)
    setManualIdInput('')
    playBeep(true)
  }

  const agregarPasajeroAlViaje = (pasajero: PasajeroBordo) => {
    const listaActualizada = [pasajero, ...pasajerosEnRuta]
    setPasajerosEnRuta(listaActualizada)
    setUltimoPasajero(pasajero)

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
    if (!confirm('¿Deseas remover este pasajero del viaje?')) return
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

  // 7. Finalizar Viaje (Cierre de Ruta)
  const handleCerrarViaje = () => {
    if (!confirm(`¿Llegaste a tu destino (${viajeActivo?.ruta_destino})? \n\nSe cerrará el viaje con ${pasajerosEnRuta.length} pasajeros registrados.`)) {
      return
    }

    detenerCamara()

    if (viajeActivo) {
      const viajeFinalizado: ViajeLocal = {
        ...viajeActivo,
        hora_fin_real: new Date().toISOString(),
        estado: 'Finalizado',
        pasajeros: pasajerosEnRuta
      }

      const todosLosViajes = historialViajes.map(v => 
        v.id_viaje_local === viajeActivo.id_viaje_local ? viajeFinalizado : v
      )
      setHistorialViajes(todosLosViajes)
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(todosLosViajes))
      setViajeActivo(null)

      playBeep(true)

      // Si hay internet, intentar sincronizar de inmediato
      if (navigator.onLine) {
        autoSyncData()
      }

      alert(`✅ Viaje Finalizado con Éxito.\n\nSe registraron ${pasajerosEnRuta.length} pasajeros. La información quedó guardada 100% en la memoria de este celular.`)
      setView('inicio')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col justify-between selection:bg-blue-600">
      
      {/* Barra de Estado Superior / Header Móvil */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">PORTAL CHOFERES</span>
            <span className="text-sm font-extrabold text-white block">Minas de Bacis</span>
          </div>
        </div>

        {/* Indicador de Conexión WiFi / Offline */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>Conectado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-600/50 text-amber-400 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Modo Offline (Sierra)</span>
            </div>
          )}
        </div>
      </header>

      {/* Canvas oculto para decodificar frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ========================================================================= */}
      {/* PANTALLA 1: MENÚ PRINCIPAL (INICIO) */}
      {/* ========================================================================= */}
      {view === 'inicio' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in duration-300">
          
          {/* Banner de Instalación PWA (Acceso Directo) */}
          {(!isInstalled) && (
            <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-900 border border-emerald-500/50 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-md shrink-0">
                  📱
                </div>
                <div>
                  <span className="text-xs font-black text-emerald-400 block uppercase">Guardar en tu Celular</span>
                  <span className="text-[11px] text-zinc-300 leading-tight block">Instala el icono en tu pantalla de inicio</span>
                </div>
              </div>
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl shadow-md shrink-0 active:scale-95 transition-all"
              >
                Instalar App
              </button>
            </div>
          )}

          {/* Banner de Sincronización */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-850 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-emerald-400 ${syncLoading ? 'animate-spin' : ''}`} />
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Memoria Local & Oficina</h3>
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                {historialViajes.filter(v => !v.sincronizado && v.estado === 'Finalizado').length} por subir
              </span>
            </div>

            {syncStatusMsg && (
              <p className="text-xs text-zinc-300 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
                {syncStatusMsg}
              </p>
            )}

            <button
              onClick={syncConServidor}
              disabled={syncLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
              {syncLoading ? 'Sincronizando...' : '⚡ Sincronizar Viajes con Oficina'}
            </button>
          </div>

          {/* Formulario de Selección de Chofer y Configuración de Ruta */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <HardHat className="w-5 h-5 text-amber-400" />
              Iniciar Nuevo Viaje
            </h2>

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
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                {choferesList.map(c => {
                  const nombreCompleto = `${c.nombre} ${c.apellido_paterno}`.trim()
                  return (
                    <option key={c.id_empleado} value={nombreCompleto}>
                      👔 {nombreCompleto} ({c.puesto || 'Chofer'})
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Vehículo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Vehículo</label>
                <select
                  value={tipoVehiculo}
                  onChange={e => setTipoVehiculo(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Camioneta">🛻 Camioneta</option>
                  <option value="Camión">🚌 Camión</option>
                  <option value="Urvan">🚐 Urvan</option>
                  <option value="Ambulancia">🚑 Ambulancia</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">No. Económico</label>
                <input
                  type="text"
                  value={numeroEconomico}
                  onChange={e => setNumeroEconomico(e.target.value)}
                  placeholder="CAM-01"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Ruta Origen y Destino */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Origen (Salida)</label>
                <select
                  value={origen}
                  onChange={e => setOrigen(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Obscuridad">📍 Obscuridad</option>
                  <option value="Parajes">📍 Parajes</option>
                  <option value="Mina Bacis">📍 Mina Bacis</option>
                  <option value="San Miguel">📍 San Miguel</option>
                  <option value="Planta">📍 Planta</option>
                  <option value="Zona Norte">📍 Zona Norte</option>
                  <option value="Otro">📍 Otro...</option>
                </select>
                {origen === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Escribe origen..."
                    value={otroOrigen}
                    onChange={e => setOtroOrigen(e.target.value)}
                    className="w-full mt-1.5 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Destino (Llegada)</label>
                <select
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Parajes">📍 Parajes</option>
                  <option value="Obscuridad">📍 Obscuridad</option>
                  <option value="Mina Bacis">📍 Mina Bacis</option>
                  <option value="San Miguel">📍 San Miguel</option>
                  <option value="Planta">📍 Planta</option>
                  <option value="Zona Norte">📍 Zona Norte</option>
                  <option value="Otro">📍 Otro...</option>
                </select>
                {destino === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Escribe destino..."
                    value={otroDestino}
                    onChange={e => setOtroDestino(e.target.value)}
                    className="w-full mt-1.5 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleIniciarChecklist}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wider mt-2"
            >
              <span>Continuar al Checklist</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Historial Local Reciente */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Viajes Guardados en este Celular ({historialViajes.length})
            </h3>

            {historialViajes.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No hay viajes previos guardados en este dispositivo.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historialViajes.slice(0, 6).map((v, i) => (
                  <div key={i} className="p-2.5 bg-zinc-800/80 rounded-xl border border-zinc-700/60 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{v.ruta_origen}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span>{v.ruta_destino}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        👥 {v.pasajeros?.length || 0} Pasajeros • {new Date(v.hora_inicio_real).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      v.sincronizado ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {v.sincronizado ? '✓ En Servidor' : '📱 En Celular'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 2: CHECKLIST MECÁNICO PRE-SALIDA */}
      {/* ========================================================================= */}
      {view === 'checklist' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setView('inicio')} className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-black text-white uppercase">Checklist de Salida</h2>
                  <span className="text-[10px] text-zinc-400">{origen} ➔ {destino}</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">{numeroEconomico}</span>
            </div>

            <p className="text-xs text-zinc-400">
              Verifica el estado mecánico y de seguridad del vehículo antes de iniciar la marcha.
            </p>

            {/* Lista de Puntos */}
            <div className="space-y-2">
              {Object.entries(checklistAnswers).map(([pregunta, val]) => (
                <button
                  key={pregunta}
                  type="button"
                  onClick={() => setChecklistAnswers(prev => ({ ...prev, [pregunta]: !val }))}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between font-bold text-xs transition-all ${
                    val ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200' : 'bg-rose-950/50 border-rose-700/60 text-rose-200'
                  }`}
                >
                  <span>{pregunta}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    val ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                  }`}>
                    {val ? '✓ OK' : '✗ Falla'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleConfirmarInicioRuta}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wider mt-4"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>🟢 Iniciar Viaje en Ruta</span>
            </button>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 3: EN RUTA (ESCÁNER QR Y PASAJE ACTIVO) */}
      {/* ========================================================================= */}
      {view === 'en_ruta' && viajeActivo && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 animate-in fade-in">
          
          {/* Tarjeta de Ruta en Curso */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600 text-white p-4 rounded-2xl shadow-xl space-y-2 border border-amber-400">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 px-2.5 py-0.5 rounded-full animate-pulse">
                🟡 EN RUTA • {viajeActivo.ruta_origen} ➔ {viajeActivo.ruta_destino}
              </span>
              <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded-lg">
                ⏱️ {tiempoTranscurrido}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div>
                <span className="text-[10px] uppercase text-amber-200 block font-bold">Chofer</span>
                <strong className="text-sm block truncate max-w-[180px]">{viajeActivo.chofer_nombre}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-amber-200 block font-bold">A Bordo</span>
                <strong className="text-2xl font-black">{pasajerosEnRuta.length}</strong>
              </div>
            </div>
          </div>

          {/* VISOR DE CÁMARA PARA ESCANEAR QR */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-3 shadow-xl">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400" /> Escáner de Credenciales QR
              </span>
              {!cameraActive && (
                <button
                  onClick={iniciarCamara}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
                >
                  Activar Cámara
                </button>
              )}
            </div>

            {/* Ventana de Video */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border-2 border-emerald-500/50 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              
              {/* Mira de Escaneo */}
              <div className="absolute inset-4 border-2 border-dashed border-emerald-400 rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded">
                  Coloca el QR de la credencial aquí
                </span>
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-black/90 p-3 flex flex-col items-center justify-center text-center text-xs text-rose-300 space-y-2">
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                  <p>{cameraError}</p>
                </div>
              )}
            </div>

            {/* Captura Manual de Respaldo */}
            <form onSubmit={handleRegistroManual} className="flex gap-2 pt-1">
              <input
                type="text"
                value={manualIdInput}
                onChange={e => setManualIdInput(e.target.value)}
                placeholder="O escribe # Nómina o ID..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0"
              >
                <UserPlus className="w-4 h-4" /> Agregar
              </button>
            </form>
          </div>

          {/* Lista de Pasajeros a Bordo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-zinc-400">
              <span>Trabajadores a Bordo ({pasajerosEnRuta.length})</span>
              <span className="text-emerald-400 text-[10px]">Auto-guardado en Celular</span>
            </div>

            {pasajerosEnRuta.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Aún no se han escaneado credenciales en este viaje.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {pasajerosEnRuta.map((p, idx) => (
                  <div key={p.id_registro_local || idx} className="p-2.5 bg-zinc-800 rounded-xl border border-zinc-700 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white">{p.nombre_completo}</div>
                        <div className="text-[10px] text-zinc-400">{p.puesto_depto} • {new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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

          {/* Botón Finalizar Viaje */}
          <button
            onClick={handleCerrarViaje}
            className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wider"
          >
            <StopCircle className="w-5 h-5" />
            <span>🏁 Finalizar Viaje en {viajeActivo.ruta_destino}</span>
          </button>
        </main>
      )}

      {/* Footer de Estado y Respaldo */}
      <footer className="bg-zinc-900 border-t border-zinc-800 p-2.5 text-center text-[10px] text-zinc-500">
        <span>Minas de Bacis • Almacenamiento Local Offline Activo</span>
      </footer>

    </div>
  )
}
