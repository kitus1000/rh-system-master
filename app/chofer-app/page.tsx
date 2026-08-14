'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Bus, Truck, Car, CheckCircle2, AlertTriangle, Clock, 
  Camera, QrCode, Wifi, WifiOff, RefreshCw, ArrowRight, 
  Check, UserCheck, ShieldCheck, Play, StopCircle, 
  Users, Search, UserPlus, HardHat, FileText, ChevronRight,
  Sparkles, CheckSquare, Trash2, ArrowLeft, Volume2, VolumeX
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

// Cargar script de jsQR dinámicamente si el navegador no tiene BarcodeDetector nativo
async function loadJsQr(): Promise<any> {
  if ((window as any).jsQR) return (window as any).jsQR
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
    script.onload = () => resolve((window as any).jsQR)
    script.onerror = () => reject(new Error('No se pudo cargar jsQR'))
    document.head.appendChild(script)
  })
}

// Generador de sonido Beep con Web Audio API (Sin requerir archivos de audio)
function playBeep(success = true) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = success ? 'sine' : 'sawtooth'
    osc.frequency.setValueAtTime(success ? 880 : 300, ctx.currentTime) // A5 o tono grave
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
  } catch (e) {
    // Ignorar si el audio está bloqueado por el navegador
  }
}

export default function ChoferAppMobile() {
  // Estado general de la app
  const [view, setView] = useState<'inicio' | 'checklist' | 'en_ruta' | 'bitacora_sync'>('inicio')
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [syncLoading, setSyncLoading] = useState<boolean>(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('')

  // Catálogos locales (Offline Cache)
  const [empleadosCache, setEmpleadosCache] = useState<EmpleadoCache[]>([])
  const [choferesList, setChoferesList] = useState<EmpleadoCache[]>([])
  const [checklistsConfig, setChecklistsConfig] = useState<Array<{ id_pregunta: string, pregunta: string, activa: boolean }>>([])

  // Datos del Chofer y Viaje en Configuración
  const [choferNombre, setChoferNombre] = useState<string>('')
  const [choferId, setChoferId] = useState<string>('')
  const [tipoVehiculo, setTipoVehiculo] = useState<string>('Camioneta')
  const [numeroEconomico, setNumeroEconomico] = useState<string>('UNIDAD-01')
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

  // 1. Inicialización & Monitoreo de Red
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-sincronizar cuando regrese la red
      autoSyncData()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cargar datos locales guardados
    cargarDatosLocales()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      detenerCamara()
    }
  }, [])

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
        setEmpleadosCache(emps)
        setChoferesList(emps.filter(e => 
          (e.puesto || '').toLowerCase().includes('chofer') || 
          (e.puesto || '').toLowerCase().includes('conductor') ||
          (e.departamento || '').toLowerCase().includes('transporte') ||
          (e.departamento || '').toLowerCase().includes('logistica')
        ))
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
        .eq('estatus', 'Activo')

      if (!errEmp && emps && emps.length > 0) {
        setEmpleadosCache(emps)
        localStorage.setItem('rh_chofer_empleados_cache', JSON.stringify(emps))
        const choferes = emps.filter(e => 
          (e.puesto || '').toLowerCase().includes('chofer') || 
          (e.puesto || '').toLowerCase().includes('conductor') ||
          (e.departamento || '').toLowerCase().includes('transporte') ||
          (e.departamento || '').toLowerCase().includes('logistica')
        )
        setChoferesList(choferes.length > 0 ? choferes : emps.slice(0, 20))
      }

      // 2. Descargar configuración de checklists de la oficina
      const { data: checks } = await supabase
        .from('app_checklists_config')
        .select('*')
        .eq('activa', true)
        .order('orden', { ascending: true })

      if (checks && checks.length > 0) {
        setChecklistsConfig(checks)
        localStorage.setItem('rh_chofer_checklists_config', JSON.stringify(checks))
        const newAns: Record<string, boolean> = {}
        checks.forEach(c => { newAns[c.pregunta] = true })
        setChecklistAnswers(newAns)
      }

      // 3. Subir viajes pendientes de sincronizar
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

      setSyncStatusMsg('✅ Sincronización exitosa. Todo al día.')
      playBeep(true)
    } catch (e: any) {
      console.error(e)
      setSyncStatusMsg('⚠️ Error durante la sincronización: ' + (e.message || e))
      playBeep(false)
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

    // Guardar en local storage
    const viajesActuales = [...historialViajes, nuevoViaje]
    setHistorialViajes(viajesActuales)
    setViajeActivo(nuevoViaje)
    setPasajerosEnRuta([])
    setUltimoPasajero(null)
    localStorage.setItem('rh_chofer_viajes', JSON.stringify(viajesActuales))

    // Entrar en modo En Ruta Bloqueado
    setView('en_ruta')
    iniciarCamara()
    playBeep(true)
  }

  // 4. Cámara y Escáner QR de Alta Velocidad
  const iniciarCamara = async () => {
    setCameraError('')
    setCameraActive(true)

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Cámara trasera del celular
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
        videoRef.current.play()
      }

      // Iniciar bucle de escaneo rápido
      iniciarBucleEscaneo()
    } catch (err: any) {
      console.error('Error al abrir cámara:', err)
      setCameraError('No se pudo acceder a la cámara. Usa la opción de ID Manual abajo.')
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
    // Verificar si el navegador soporta la API nativa ultrarrápida de BarcodeDetector (Chrome Android)
    const hasNativeBarcodeDetector = 'BarcodeDetector' in window
    let nativeDetector: any = null
    let jsQrLib: any = null

    if (hasNativeBarcodeDetector) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] })
      } catch (e) {
        nativeDetector = null
      }
    }

    if (!nativeDetector) {
      try {
        jsQrLib = await loadJsQr()
      } catch (e) {
        console.warn('Fallback jsQR no disponible')
      }
    }

    const tick = async () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current

        // 1. Intento nativo rápido
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video)
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue
              if (rawValue) {
                procesarLecturaQR(rawValue)
              }
            }
          } catch (e) {
            // Ignorar errores de frame
          }
        } else if (jsQrLib && canvasRef.current) {
          // 2. Fallback con Canvas & jsQR
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQrLib(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert'
            })
            if (code && code.data) {
              procesarLecturaQR(code.data)
            }
          }
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
      e.numero_empleado === idLimpio ||
      codigo.includes(e.id_empleado)
    )

    // Si el QR tiene formato JSON (ej. {"id":"uuid", "nombre":"Juan"})
    if (!match && idLimpio.startsWith('{')) {
      try {
        const parsed = JSON.parse(idLimpio)
        if (parsed.id || parsed.id_empleado) {
          const searchId = parsed.id || parsed.id_empleado
          match = empleadosCache.find(e => e.id_empleado === searchId || e.numero_empleado === searchId)
        }
      } catch (e) {}
    }

    const yaRegistrado = pasajerosEnRuta.some(p => 
      (match && p.id_empleado === match.id_empleado) || p.id_manual === idLimpio
    )

    if (yaRegistrado) {
      // Cooldown corto para no spamear
      setCooldownScan(true)
      setTimeout(() => setCooldownScan(false), 1800)
      return
    }

    // Registrar abordaje
    const nuevoPasajero: PasajeroBordo = {
      id_registro_local: 'pas_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      id_empleado: match ? match.id_empleado : undefined,
      id_manual: match ? undefined : idLimpio,
      nombre_completo: match ? `${match.nombre} ${match.apellido_paterno} ${match.apellido_materno || ''}`.trim() : `Empleado (ID: ${idLimpio})`,
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
      (e.numero_empleado && e.numero_empleado.toLowerCase() === id.toLowerCase()) ||
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
      nombre_completo: match ? `${match.nombre} ${match.apellido_paterno} ${match.apellido_materno || ''}`.trim() : `ID Manual: ${id}`,
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

      alert(`✅ Viaje Finalizado con Éxito.\n\nSe registraron ${pasajerosEnRuta.length} pasajeros. La información quedó guardada en el dispositivo.`)
      setView('inicio')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col justify-between selection:bg-blue-600">
      
      {/* Barra de Estado Superior / Header Móvil */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">PORTAL CHOFERES</span>
            <span className="text-sm font-extrabold text-white block">RH System Móvil</span>
          </div>
        </div>

        {/* Indicador de Conexión WiFi / Offline */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>WiFi Conectado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-600/50 text-amber-400 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Modo Offline (Ruta)</span>
            </div>
          )}
        </div>
      </header>

      {/* Canvas oculto para decodificar frames de video con jsQR si no hay BarcodeDetector */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ========================================================================= */}
      {/* PANTALLA 1: MENÚ PRINCIPAL (INICIO) */}
      {/* ========================================================================= */}
      {view === 'inicio' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-5 animate-in fade-in duration-300">
          
          {/* Banner de Sincronización */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-850 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-blue-400 ${syncLoading ? 'animate-spin' : ''}`} />
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Sincronización con Oficina</h3>
              </div>
              <span className="text-[10px] text-zinc-400">
                {historialViajes.filter(v => !v.sincronizado && v.estado === 'Finalizado').length} pendientes
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
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
              {syncLoading ? 'Sincronizando...' : 'Descargar Catálogos / Subir Viajes'}
            </button>
          </div>

          {/* Formulario de Selección de Chofer y Configuración de Ruta */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <HardHat className="w-5 h-5 text-amber-400" />
              Configurar Nuevo Viaje
            </h2>

            {/* Chofer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chofer Asignado</label>
              {choferesList.length > 0 ? (
                <select
                  value={choferNombre}
                  onChange={(e) => {
                    const sel = choferesList.find(c => `${c.nombre} ${c.apellido_paterno}` === e.target.value)
                    setChoferNombre(e.target.value)
                    if (sel) setChoferId(sel.id_empleado)
                  }}
                  className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-3 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Seleccionar Chofer --</option>
                  {choferesList.map(c => (
                    <option key={c.id_empleado} value={`${c.nombre} ${c.apellido_paterno}`}>
                      {c.nombre} {c.apellido_paterno} {c.apellido_materno || ''} ({c.puesto || 'Chofer'})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Escribe tu nombre de chofer..."
                  value={choferNombre}
                  onChange={(e) => setChoferNombre(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* Unidad / Vehículo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tipo Vehículo</label>
                <select
                  value={tipoVehiculo}
                  onChange={(e) => setTipoVehiculo(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-3 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="Camioneta">Camioneta 4x4</option>
                  <option value="Camión">Camión / Autobús</option>
                  <option value="Combi">Combi</option>
                  <option value="Ambulancia">Ambulancia</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">No. Económico</label>
                <input
                  type="text"
                  placeholder="Ej. C-04"
                  value={numeroEconomico}
                  onChange={(e) => setNumeroEconomico(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-3 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Ruta Origen y Destino */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Origen de Salida</label>
                <select
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-3 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="Obscuridad">Obscuridad (Campamento)</option>
                  <option value="Parajes">Parajes</option>
                  <option value="Mina Bacis">Mina Bacis</option>
                  <option value="Durango">Durango Capital</option>
                  <option value="Otro">Otro lugar...</option>
                </select>
                {origen === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Especificar origen..."
                    value={otroOrigen}
                    onChange={(e) => setOtroOrigen(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-2 text-sm text-white mt-2"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Destino de Llegada</label>
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-3 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="Parajes">Parajes</option>
                  <option value="Obscuridad">Obscuridad (Campamento)</option>
                  <option value="Mina Bacis">Mina Bacis</option>
                  <option value="Durango">Durango Capital</option>
                  <option value="Otro">Otro lugar...</option>
                </select>
                {destino === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Especificar destino..."
                    value={otroDestino}
                    onChange={(e) => setOtroDestino(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-2 text-sm text-white mt-2"
                  />
                )}
              </div>
            </div>

            {/* Botón Ir a Checklist */}
            <button
              onClick={handleIniciarChecklist}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] text-white font-black py-4 rounded-xl text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all mt-3"
            >
              <span>Continuar a Checklist de Seguridad</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Historial Reciente Guardado en el Teléfono */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Viajes Registrados en este Teléfono</h3>
              <span className="text-[10px] text-zinc-500">{historialViajes.length} guardados</span>
            </div>

            {historialViajes.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No hay viajes anteriores registrados en este equipo.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {historialViajes.slice().reverse().map(v => (
                  <div key={v.id_viaje_local} className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{v.ruta_origen}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-500" />
                        <span>{v.ruta_destino}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {new Date(v.hora_inicio_real).toLocaleDateString()} • {v.pasajeros?.length || 0} pasajeros
                      </div>
                    </div>
                    <div>
                      {v.sincronizado ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          ✓ Sincronizado
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded-full font-bold">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 2: CHECKLIST PRE-VIAJE */}
      {/* ========================================================================= */}
      {view === 'checklist' && (
        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView('inicio')}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-bold uppercase"
            >
              <ArrowLeft className="w-4 h-4" /> Cancelar
            </button>
            <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Revisión Obligatoria</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <h2 className="text-lg font-black text-white">Checklist de la Unidad</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Confirma el estado del vehículo ({tipoVehiculo} - {numeroEconomico}) antes de arrancar la ruta hacia {destino}.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {Object.entries(checklistAnswers).map(([pregunta, val]) => (
                <label
                  key={pregunta}
                  onClick={() => setChecklistAnswers(prev => ({ ...prev, [pregunta]: !val }))}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    val 
                      ? 'bg-blue-950/30 border-blue-600/50 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="text-xs font-semibold flex-1 pr-3">{pregunta}</span>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                    val ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-900'
                  }`}>
                    {val && <Check className="w-4 h-4" />}
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleConfirmarInicioRuta}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black py-4 rounded-xl text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all mt-4"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Comenzar Viaje (Bloquear Pantalla)</span>
            </button>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 3: EN RUTA (BLOQUEADA & LECTOR QR CONTINUO) */}
      {/* ========================================================================= */}
      {view === 'en_ruta' && viajeActivo && (
        <main className="flex-1 max-w-lg w-full mx-auto flex flex-col justify-between p-3 sm:p-4 space-y-3">
          
          {/* Header de Ruta Activa con Cronómetro */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 shadow-lg flex items-center justify-between">
            <div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                {viajeActivo.ruta_origen} → <span className="text-blue-400">{viajeActivo.ruta_destino}</span>
              </div>
              <div className="text-sm font-extrabold text-white mt-0.5">
                Chofer: {viajeActivo.chofer_nombre}
              </div>
            </div>

            {/* Temporizador Digital */}
            <div className="text-right">
              <span className="text-[9px] text-zinc-400 uppercase font-mono block">TIEMPO EN RUTA</span>
              <span className="text-lg font-black text-amber-400 font-mono tracking-wider">
                {tiempoTranscurrido}
              </span>
            </div>
          </div>

          {/* Visor de Cámara para Escaneo Continuo de QR */}
          <div className="relative w-full aspect-video sm:aspect-[4/3] max-h-64 bg-black rounded-2xl overflow-hidden border-2 border-blue-500/50 shadow-2xl flex items-center justify-center">
            {cameraActive ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <div className="text-center p-4">
                <Camera className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">{cameraError || 'Cámara pausada'}</p>
                <button
                  onClick={iniciarCamara}
                  className="mt-3 bg-blue-600 text-white font-bold px-4 py-1.5 rounded-lg text-xs"
                >
                  Activar Cámara
                </button>
              </div>
            )}

            {/* Overlay de Guía de Escáner QR */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-blue-400 rounded-2xl relative animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  {/* Esquinas destacadas */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                  <div className="absolute inset-x-2 top-1/2 h-0.5 bg-cyan-400/80 shadow-[0_0_8px_#22d3ee]" />
                </div>
                <span className="absolute bottom-2 bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                  Apunta la credencial QR aquí
                </span>
              </div>
            )}

            {/* Flash visual de confirmación de abordaje */}
            {cooldownScan && (
              <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center backdrop-blur-[2px] transition-all">
                <div className="bg-emerald-600 text-white font-black px-4 py-2 rounded-xl text-sm shadow-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> ¡PASAJERO REGISTRADO!
                </div>
              </div>
            )}
          </div>

          {/* Último Pasajero Registrado (Banner Instantáneo) */}
          {ultimoPasajero && (
            <div className="bg-emerald-950/60 border border-emerald-600/60 p-2.5 rounded-xl flex items-center justify-between text-xs animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  ✓
                </div>
                <div>
                  <span className="font-bold text-white block leading-tight">{ultimoPasajero.nombre_completo}</span>
                  <span className="text-[10px] text-emerald-400 block">{ultimoPasajero.puesto_depto}</span>
                </div>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {new Date(ultimoPasajero.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* Registro Manual por ID (Por si no trae credencial QR) */}
          <form onSubmit={handleRegistroManual} className="flex gap-2">
            <input
              type="text"
              placeholder="Ingresar ID o Nombre manual..."
              value={manualIdInput}
              onChange={(e) => setManualIdInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!manualIdInput.trim()}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              <UserPlus className="w-4 h-4" /> Agregar
            </button>
          </form>

          {/* Lista de Pasajeros a Bordo (Conteo en Vivo) */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 flex flex-col justify-between overflow-hidden min-h-[160px] shadow-lg">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                Pasajeros a Bordo
              </h3>
              <span className="text-xs font-black bg-blue-600 text-white px-2.5 py-0.5 rounded-full">
                {pasajerosEnRuta.length} personas
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 max-h-40">
              {pasajerosEnRuta.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  Escanea los códigos QR de los trabajadores que van subiendo al transporte.
                </div>
              ) : (
                pasajerosEnRuta.map((p, idx) => (
                  <div key={p.id_registro_local} className="bg-zinc-950/80 p-2 rounded-xl flex items-center justify-between text-xs border border-zinc-850">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-mono text-[10px]">#{pasajerosEnRuta.length - idx}</span>
                      <div>
                        <span className="font-bold text-white block text-xs leading-tight">{p.nombre_completo}</span>
                        <span className="text-[9px] text-zinc-400 block">{p.puesto_depto}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => eliminarPasajero(p.id_registro_local)}
                        className="text-zinc-600 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Botón de Cierre de Viaje */}
          <button
            onClick={handleCerrarViaje}
            className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-black py-4 rounded-xl text-base flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 transition-all"
          >
            <StopCircle className="w-5 h-5 fill-current" />
            <span>Terminar / Cerrar Viaje</span>
          </button>
        </main>
      )}

      {/* Footer Fijo */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-2.5 px-4 text-center">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
          SISTEMA DE TRANSPORTE Y CONTROL DE CHOFERES
        </span>
      </footer>
    </div>
  )
}
