'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import jsQR from 'jsqr'
import { jsPDF } from 'jspdf'
import {
  Truck, Clock, Camera, Wifi, WifiOff,
  Play, StopCircle, HardHat, ChevronRight,
  Trash2, ArrowLeft, ShieldAlert, X,
  User, Users, CloudUpload, RefreshCw,
  CheckCircle2, MapPin, Download, Search,
  FileText, ClipboardCheck, Wrench, ShieldCheck,
  AlertTriangle, Eye, LogOut, CheckCircle, QrCode,
  UserPlus
} from 'lucide-react'

import empleadosOfflineJson from '@/app/data/empleados_offline.json'

/* ─────────────────────────── Tipos ─────────────────────────── */
interface EmpleadoCache {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  numero_empleado?: string | number
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
  kilometraje?: string
  combustible?: string
  observaciones?: string
}

interface ReporteFalla {
  id: string
  chofer: string
  camion: string
  falla: string
  prioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica'
  fecha: string
  sincronizado: boolean
}

/* ─────────────────────────── Choferes Oficiales ─────────────────────────── */
const DEFAULT_CHOFERES: EmpleadoCache[] = [
  { id_empleado: 'CHOFER-1', nombre: 'Adalberto', apellido_paterno: 'Pinales', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '101' },
  { id_empleado: 'CHOFER-2', nombre: 'Ramon',     apellido_paterno: 'Yañez',   puesto: 'Chofer', departamento: 'Logística', numero_empleado: '102' },
  { id_empleado: 'CHOFER-3', nombre: 'Oscar',     apellido_paterno: 'Vazquez', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '103' },
  { id_empleado: 'CHOFER-4', nombre: 'Enrique',   apellido_paterno: 'Linares', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '104' },
  { id_empleado: 'CHOFER-5', nombre: 'Samuel',    apellido_paterno: 'Madriles',puesto: 'Chofer', departamento: 'Logística', numero_empleado: '105' },
  { id_empleado: 'CHOFER-6', nombre: 'Jesus',     apellido_paterno: 'Saucedo', puesto: 'Chofer', departamento: 'Logística', numero_empleado: '106' },
]

const CHECKLIST_ITEMS = [
  { id: 'frenos', label: 'Frenos de servicio y estacionamiento' },
  { id: 'luces', label: 'Luces principales, stop y direccionales' },
  { id: 'llantas', label: 'Presión y estado físico de neumáticos' },
  { id: 'niveles', label: 'Niveles de aceite, anticongelante y líquido frenos' },
  { id: 'radio', label: 'Radio de comunicación Mina / Caseta' },
  { id: 'extintor', label: 'Extintor vigente y botiquín de primeros auxilios' },
  { id: 'suspension', label: 'Suspensión y dirección sin ruidos' },
  { id: 'cinturones', label: 'Cinturones de seguridad operativos' },
  { id: 'espejos', label: 'Espejos retrovisores y parabrisas limpio' },
  { id: 'carroceria', label: 'Carrocería sin golpes severos nuevos' }
]

const CHECKLIST_DEFAULT: Record<string, boolean> = {
  frenos: true,
  luces: true,
  llantas: true,
  niveles: true,
  radio: true,
  extintor: true,
  suspension: true,
  cinturones: true,
  espejos: true,
  carroceria: true
}

const STORAGE_KEY = 'rh_bitacora_viajes_v2'
const SESSION_KEY = 'rh_chofer_session_v2'
const FALLAS_KEY = 'rh_chofer_fallas_v2'
const INITIAL_EMPLEADOS_OFFLINE: EmpleadoCache[] = (empleadosOfflineJson as any) || DEFAULT_CHOFERES

/* ─────────────────────────── Sonido / Vibración ─────────────────────────── */
const BEEP_AUDIO_BASE64 = 'data:audio/wav;base64,UklGRmYTAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIUAAC4/vD/4v/+/97/1//j/8f/xP/S/8X/u//B/6v/pv+Z/4D/X/8w/wf/6P7D/rL+n/59/j7+G/7t/bv9lf1z/V39Lv0O/dT8wvys/J78a/wS/Ob7qvtn+yj7EPv5+vT68PoT+zL7RPt7+4f7gvuP+3X7cvuL+5D7sPu4+7r7svuk+4f7Z/tG+xD75PrU+pX6e/pA+h/6FvoG+vf55/n4+RT6NPpW+nT6m/rG+u36EPsp+0r7cvuY+8T76fsK/C38T/xv/Iv8sPzd/Pj8E/0n/Uz9eP2m/cT93f3s/ff9/P0A/gH+EP4Z/iD+Mf5F/mX+gf6X/rD+yf7c/vD+Bv8d/z3/V/90/5H/pv/G/9v/6f/3/wEABgANABgAKAA9AFEAZwB9AJYAqwC6AMsA2QDnAPIA+gD8AP8AAgEFAQ0BEwEZASMBKgEvATMBNAE1ATEBLAEkAR4BFgEOAQUB/QDxAOUA2gDOAMAAxwDIAMoAzADRAMcAuwCwAKcAmgCHAGwARwAsABYAAADy/93/z//L/7//rf+S/3v/Vv8t/wn/4f65/o/+a/41/hf+6P2p/XD9TP0f/fD8tvyd/Hn8R/wc/Pz7xfuk+4L7ZPsl+wf78/rk+tz63/rv+vr6Bfsb+zD7Rftw+5H7rPu++8377fsD/BD8IPwv/D78VPxo/I38s/zY/Or8AP0T/Sn9Rf1b/Xv9n/3L/ej9AP4Y/iv+Qv5m/ov+sf7R/uv+Bv8i/0f/af+H/6z/zf/0/wgAGwAxAEcAYQB7AJcAsADPANsA6gDzAPcA+AD2AOwA4ADRAMQAuwCqAJcAfgBVAEUAPQAvACMAEQD+APQA3ADKAMEAvACyAKAAgwBpAEwALgANAO7/zP+v/5X/ev9a/zv/FP/n/rD+lf52/k3+Kv4L/vT9xf23/ab9of2n/ar9rf27/cf92v3v/QT+GP4y/kn+Yv6C/pP+pv6z/sb+3/71/hT/L/9M/2T/ff+T/6v/wv/a/+j/8P/3//7/BQAOABoAJQAwADkAPwBCAEIAQQA6AC8AIwAVAAkA/v/q/9//w/+m/4D/Rv8b/+z+p/5v/j/+Gv74/cr9of1//VL9M/0T/fb85fzT/Mf8wPyz/Kj8nvyt/L781vzj/Pn8Ff0r/Tj9S/1T/VP9Xv16/ZP9rf24/cb9zv3e/e/9/f0N/hP+G/4i/i7+Of5A/kP+Rv5F/kD+NP4Z/v/92f25/Zj9eP05/Rf96vy5/Jb8a/wn/Pv7r/uC+1n7M/sJ+/D62PrN+sz6wfq++sn63frm+v/6Fvs2+1D7avua+7L7yPvW++f7+PsV/CX8MPxD/F78c/yO/KL8u/zG/ND84Pzx/AL9Df0d/TX9Qf1N/V79av14/Y/9pv3D/eP9Av4c/kX+Z/6H/pv+sv7P/ub+9v4B/w//Gf8x/0L/Wf9y/5j/u//U/+n/8/8EAAgACwAKAAwACQAFAAEA+v/u/+X/1//C/6D/ff9C/wv/x/6E/jX+8P2v/Wr9Pf0T/e781fzE/LD8nfx+/Fj8PPwn/BL89/vP+8D7sPuW+377avti+137W/ta+2P7c/uL+5r7rvvD+9778fsA/BD8Hvwx/EP8Tvxo/HX8jvyk/Lr8yvzZ/Of89PwE/Q/9Gf0p/TX9Qv1I/VT9Yv1v/YL9kv2a/af9u/3T/e39/f0R/hn+HP4u/jz+Tv5e/mz+f/6Q/p7+qP67/sr+2/7v/gf/D/8d/yn/NP85/0H/S/9d/2v/df9//4z/l/+t/73/0P/j/+j/9P8EAA0AEgAaACAAKwAzADoAPgBCAEcAQgBEAEgARgBTAFAAUABTAD4AOgAwACgAGQAGAOT/u/+I/17/Pv8Q/+D+o/50/kb+Hf4A/tb9sP2K/Wn9RP0j/Qr98fzG/Jn8dPw4/Aj84vum+3/7P/sI+/P63vrc+r36qPqQ+nj6afpg+mX6dvqc+rn63PoG+xz7M/tG+1n7afth+1/7ZPtu+3z7iPuY+6n7ufvD+8z72/vf+/T7BPwV/Bz8K/w+/FD8VvxY/Gf8bvyJ/KL8tvzM/NX83fzq/AD9Cv0b/SD9Jv0y/Tb9Nf1C/VL9W/1o/XT9g/2f/bL9yv3d/fP9Af4J/hT+G/4m/in+Mf5E/kz+Vf5d/m/+ef6H/pj+qv61/sP+zv7W/t/+5/7z/vv+BA8E'

function playBeep(success = true) {
  try {
    if (success) {
      const audio = new Audio(BEEP_AUDIO_BASE64)
      audio.volume = 0.9
      audio.play().catch(() => {})
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(success ? [80, 50, 80] : [200])
    }
  } catch (_) {}
}

/* ═══════════════════════ COMPONENTE PRINCIPAL ═══════════════════════ */
export default function ChoferApp() {
  /* ── Navegación por pestañas ── */
  const [activeTab, setActiveTab] = useState<'viajes' | 'checklist' | 'bitacora' | 'fallas' | 'sync'>('viajes')
  const [view, setView] = useState<'inicio' | 'en_ruta'>('inicio')

  /* ── Red ── */
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState('')

  /* ── PWA install ── */
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  /* ── Catálogos offline ── */
  const [empleadosCache, setEmpleadosCache] = useState<EmpleadoCache[]>(INITIAL_EMPLEADOS_OFFLINE)
  const [choferesList, setChoferesList] = useState<EmpleadoCache[]>(DEFAULT_CHOFERES)

  /* ── Formulario inicio / Sesión Chofer ── */
  const [choferNombre, setChoferNombre] = useState('Adalberto Pinales')
  const [choferId, setChoferId] = useState('CHOFER-1')
  const [tipoVehiculo, setTipoVehiculo] = useState('Camioneta')
  const [numeroEconomico, setNumeroEconomico] = useState('CAM-01')
  const [origen, setOrigen] = useState('Obscuridad')
  const [destino, setDestino] = useState('Parajes')
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, boolean>>(CHECKLIST_DEFAULT)
  const [kilometraje, setKilometraje] = useState('')
  const [combustible, setCombustible] = useState('3/4')
  const [observacionesRuta, setObservacionesRuta] = useState('')

  /* ── Viaje activo & Historial ── */
  const [viajeActivo, setViajeActivo] = useState<ViajeLocal | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00')
  const [historialViajes, setHistorialViajes] = useState<ViajeLocal[]>([])
  const [busquedaBitacora, setBusquedaBitacora] = useState('')

  /* ── Modal de Manifiesto en Celular ── */
  const [selectedManifestTrip, setSelectedManifestTrip] = useState<ViajeLocal | null>(null)

  /* ── Fallas Mecánicas ── */
  const [fallasList, setFallasList] = useState<ReporteFalla[]>([])
  const [descripcionFalla, setDescripcionFalla] = useState('')
  const [prioridadFalla, setPrioridadFalla] = useState<'Baja' | 'Media' | 'Alta' | 'Crítica'>('Media')

  /* ── Pasajeros en Ruta ── */
  const [pasajerosEnRuta, setPasajerosEnRuta] = useState<PasajeroBordo[]>([])
  const pasajerosRef = useRef<PasajeroBordo[]>([])
  const viajeActivoRef = useRef<ViajeLocal | null>(null)
  const historialRef = useRef<ViajeLocal[]>([])
  const empleadosCacheRef = useRef<EmpleadoCache[]>(INITIAL_EMPLEADOS_OFFLINE)

  /* ── Control de Cámara & Escáner ── */
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const scanCooldownRef = useRef<boolean>(false)

  /* ── Notificación de scan ── */
  const [scanNotice, setScanNotice] = useState<{ tipo: 'exito' | 'duplicado'; nombre: string; depto?: string; hora?: string } | null>(null)
  const noticeTimerRef = useRef<any>(null)

  /* ── Manual ID / Nómina ── */
  const [manualIdInput, setManualIdInput] = useState('')

  /* Sincronizar refs */
  useEffect(() => { pasajerosRef.current = pasajerosEnRuta }, [pasajerosEnRuta])
  useEffect(() => { viajeActivoRef.current = viajeActivo }, [viajeActivo])
  useEffect(() => { historialRef.current = historialViajes }, [historialViajes])
  useEffect(() => { empleadosCacheRef.current = empleadosCache }, [empleadosCache])

  /* ═══════════════════ Init ═══════════════════ */
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

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

  /* ═══════════════════ Reloj de viaje ═══════════════════ */
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

  /* ═══════════════════ LocalStorage ═══════════════════ */
  const cargarDatosLocales = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('rh_chofer_viajes')
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
      const rawFallas = localStorage.getItem(FALLAS_KEY)
      if (rawFallas) {
        setFallasList(JSON.parse(rawFallas))
      }
      const savedSession = localStorage.getItem(SESSION_KEY)
      if (savedSession) {
        const sess = JSON.parse(savedSession)
        if (sess.chofer_nombre) setChoferNombre(sess.chofer_nombre)
        if (sess.chofer_id) setChoferId(sess.chofer_id)
        if (sess.numero_economico) setNumeroEconomico(sess.numero_economico)
        if (sess.tipo_vehiculo) setTipoVehiculo(sess.tipo_vehiculo)
        if (sess.origen) setOrigen(sess.origen)
        if (sess.destino) setDestino(sess.destino)
        if (sess.kilometraje) setKilometraje(sess.kilometraje)
      }
    } catch (_) {}
  }

  const guardarSesionChofer = (nombre: string, id: string, eco: string, tipo: string, orig: string, dest: string, km?: string) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        chofer_nombre: nombre,
        chofer_id: id,
        numero_economico: eco,
        tipo_vehiculo: tipo,
        origen: orig,
        destino: dest,
        kilometraje: km || kilometraje,
        guardado_el: new Date().toISOString()
      }))
    } catch (_) {}
  }

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
        if (ch.length) setChoferesList(ch)
      }
    } catch (_) {}
  }

  /* ═══════════════════ Sincronización ═══════════════════ */
  const subirViajeDirecto = async (v: ViajeLocal): Promise<boolean> => {
    const listaPasajeros = (v.pasajeros || []).map(p => ({
      nombre: p.nombre_completo,
      puesto: p.puesto_depto || 'General',
      hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      metodo: p.metodo_registro,
      id_empleado: p.id_empleado || null,
      id_manual: p.id_manual || null,
      id_registro_local: p.id_registro_local
    }))

    const fechaViaje = v.hora_inicio_real ? v.hora_inicio_real.split('T')[0] : new Date().toISOString().split('T')[0]
    const horaSalida = v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
    const horaLlegada = v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Completado'
    const totalPasajeros = listaPasajeros.length

    let success = false

    // 1. Enviar al endpoint de sincronización
    try {
      const res = await fetch('/api/choferes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajes: [{
            id_viaje_local: v.id_viaje_local,
            id_chofer: v.id_chofer ?? null,
            chofer_nombre: v.chofer_nombre,
            tipo_vehiculo: v.tipo_vehiculo,
            numero_economico: v.numero_economico,
            ruta_origen: v.ruta_origen,
            ruta_destino: v.ruta_destino,
            hora_inicio_real: v.hora_inicio_real,
            hora_fin_real: v.hora_fin_real,
            estado: 'Finalizado',
            pasajeros: listaPasajeros
          }]
        })
      })
      if (res.ok) success = true
    } catch (_) {}

    // 2. Respaldo directo en Supabase si la API no respondió
    if (!success) {
      try {
        const { error } = await supabase.from('logistica_reportes_diarios').insert([{
          fecha: fechaViaje,
          camion_numero: v.numero_economico || 'CAM-01',
          tipo_vehiculo: v.tipo_vehiculo || 'Camioneta',
          ubicacion_caseta: v.ruta_destino || 'Parajes',
          comentarios_vehiculo: `[VIAJE_QR] Ruta: ${v.ruta_origen} a ${v.ruta_destino} | Chofer: ${v.chofer_nombre} | Pasajeros: ${totalPasajeros} | Salida: ${horaSalida} | Llegada: ${horaLlegada}`,
          observaciones_recorrido: JSON.stringify(listaPasajeros),
          frenos_ok: v.checklist_respuestas?.frenos ?? true,
          luces_ok: v.checklist_respuestas?.luces ?? true,
          llantas_ok: v.checklist_respuestas?.llantas ?? true,
          niveles_aceite_ok: v.checklist_respuestas?.niveles ?? true,
          carroceria_ok: v.checklist_respuestas?.carroceria ?? true,
          extintor_ok: v.checklist_respuestas?.extintor ?? true,
          botiquin_ok: v.checklist_respuestas?.extintor ?? true
        }])
        if (!error) success = true
      } catch (_) {}
    }

    if (success) {
      const actualizados = historialRef.current.map(item =>
        item.id_viaje_local === v.id_viaje_local ? { ...item, sincronizado: true } : item
      )
      historialRef.current = actualizados
      setHistorialViajes(actualizados)
      try { 
        localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizados))
        localStorage.setItem('rh_chofer_viajes', JSON.stringify(actualizados))
      } catch (_) {}
    }

    return success
  }

  const autoSyncData = async () => {
    if (!navigator.onLine || isSyncing) return
    const pendientes = historialRef.current.filter(v => v.estado === 'Finalizado' && !v.sincronizado)
    if (!pendientes.length) return

    setIsSyncing(true)
    let syncCount = 0

    for (const viaje of pendientes) {
      const ok = await subirViajeDirecto(viaje)
      if (ok) syncCount++
    }

    setIsSyncing(false)
    if (syncCount > 0) {
      setSyncStatusMsg(`✅ ¡${syncCount} viaje(s) sincronizado(s) con la oficina!`)
      setTimeout(() => setSyncStatusMsg(''), 6000)
    }
  }

  const handleForzarSincronizacion = async () => {
    if (!navigator.onLine) {
      setSyncStatusMsg('⚠️ No hay señal de internet. Los datos están seguros en este celular.')
      setTimeout(() => setSyncStatusMsg(''), 4000)
      return
    }

    setIsSyncing(true)
    setSyncStatusMsg('Conectando con la oficina central...')

    try {
      const pendientes = historialRef.current.filter(v => v.estado === 'Finalizado' && !v.sincronizado)
      if (!pendientes.length) {
        setSyncStatusMsg('✨ Todos los viajes ya están sincronizados en la nube.')
        setTimeout(() => setSyncStatusMsg(''), 4000)
        return
      }

      let count = 0
      for (const viaje of pendientes) {
        const ok = await subirViajeDirecto(viaje)
        if (ok) count++
      }

      setSyncStatusMsg(`✅ ¡Listo! ${count} viaje(s) subido(s) a Supabase.`)
      setTimeout(() => setSyncStatusMsg(''), 5000)
    } catch (e: any) {
      setSyncStatusMsg('Sin señal de internet en este momento.')
    } finally {
      setIsSyncing(false)
    }
  }

  /* ─────────────────────────── Flujo de Viajes ─────────────────────────── */
  // 1. Guardar Viaje Directo en 1 clic
  const handleGuardarViajeDirecto = async () => {
    if (pasajerosRef.current.length === 0) {
      if (!confirm('No has registrado pasajeros a bordo. ¿Deseas guardar el viaje en ceros?')) return
    }

    const now = new Date()
    const nuevoViaje: ViajeLocal = {
      id_viaje_local: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      id_chofer: choferId || undefined,
      chofer_nombre: choferNombre,
      tipo_vehiculo: tipoVehiculo,
      numero_economico: numeroEconomico,
      ruta_origen: origen,
      ruta_destino: destino,
      hora_inicio_real: now.toISOString(),
      hora_fin_real: now.toISOString(),
      estado: 'Finalizado',
      checklist_respuestas: checklistAnswers,
      pasajeros: [...pasajerosRef.current],
      sincronizado: false,
      creado_el: now.toISOString(),
      kilometraje,
      combustible,
      observaciones: observacionesRuta
    }

    const lista = [nuevoViaje, ...historialRef.current]
    setHistorialViajes(lista)
    historialRef.current = lista
    setPasajerosEnRuta([])
    pasajerosRef.current = []

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(lista))
    } catch (_) {}

    guardarSesionChofer(choferNombre, choferId, numeroEconomico, tipoVehiculo, origen, destino, kilometraje)
    playBeep(true)
    alert(`🏁 ¡Manifiesto Guardado con Éxito!\n\n👥 Total de Pasajeros: ${nuevoViaje.pasajeros.length}\n📍 ${origen} ➔ ${destino}\n\nLos datos están guardados en tu celular y listos para la oficina.`)
    
    if (navigator.onLine) {
      subirViajeDirecto(nuevoViaje)
    }
    setActiveTab('bitacora')
  }

  // 2. Iniciar Recorrido en Vivo
  const handleIniciarRecorridoEnVivo = () => {
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
      pasajeros: [...pasajerosRef.current],
      sincronizado: false,
      creado_el: new Date().toISOString(),
      kilometraje,
      combustible,
      observaciones: observacionesRuta
    }

    const lista = [nuevoViaje, ...historialRef.current]
    setHistorialViajes(lista)
    historialRef.current = lista
    setViajeActivo(nuevoViaje)
    viajeActivoRef.current = nuevoViaje

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(lista))
    } catch (_) {}

    guardarSesionChofer(choferNombre, choferId, numeroEconomico, tipoVehiculo, origen, destino, kilometraje)
    playBeep(true)
    setView('en_ruta')
  }

  // 3. Finalizar Viaje en Vivo
  const handleFinalizarViajeEnVivo = async () => {
    const total = pasajerosRef.current.length
    if (!confirm(`¿Llegaste a tu destino (${viajeActivoRef.current?.ruta_destino})?\n\nSe cerrará el viaje con ${total} trabajadores a bordo.`)) return

    detenerCamara()
    const viaje = viajeActivoRef.current
    if (!viaje) return

    const finalizado: ViajeLocal = {
      ...viaje,
      hora_fin_real: new Date().toISOString(),
      estado: 'Finalizado',
      pasajeros: [...pasajerosRef.current],
      sincronizado: false
    }

    const todos = historialRef.current.map(v =>
      v.id_viaje_local === viaje.id_viaje_local ? finalizado : v
    )
    historialRef.current = todos
    setHistorialViajes(todos)
    try { 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
      localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos))
    } catch (_) {}

    viajeActivoRef.current = null
    setViajeActivo(null)
    pasajerosRef.current = []
    setPasajerosEnRuta([])
    playBeep(true)
    setView('inicio')
    setActiveTab('bitacora')

    if (navigator.onLine) {
      subirViajeDirecto(finalizado)
    }
  }

  /* ─────────────────────────── Cámara & Escáner ─────────────────────────── */
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
        videoRef.current.muted = true
        videoRef.current.autoplay = true
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

    const tick = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current
        let detectedCode: string | null = null

        // 1. Intento nativo
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video)
            if (barcodes?.length && barcodes[0].rawValue) {
              detectedCode = barcodes[0].rawValue
            }
          } catch (_) {}
        }

        // 2. jsQR a resolución real con attemptBoth
        if (!detectedCode && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            const vWidth = video.videoWidth
            const vHeight = video.videoHeight

            if (canvas.width !== vWidth || canvas.height !== vHeight) {
              canvas.width = vWidth
              canvas.height = vHeight
            }

            ctx.drawImage(video, 0, 0, vWidth, vHeight)
            const imgData = ctx.getImageData(0, 0, vWidth, vHeight)
            const code = jsQR(imgData.data, vWidth, vHeight, {
              inversionAttempts: 'attemptBoth'
            })
            if (code && code.data) {
              detectedCode = code.data
            }
          } catch (_) {}
        }

        if (detectedCode && !scanCooldownRef.current) {
          scanCooldownRef.current = true
          procesarLecturaQR(detectedCode)
          setTimeout(() => {
            scanCooldownRef.current = false
          }, 800)
        }
      }

      scanLoopRef.current = requestAnimationFrame(tick)
    }

    scanLoopRef.current = requestAnimationFrame(tick)
  }

  /* ─────────────────────────── Resolución de Empleados ─────────────────────────── */
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
    const catalogo = empleadosCacheRef.current

    // Buscar por nómina exacta o dígitos
    let match = catalogo.find(e =>
      (e.numero_empleado && String(e.numero_empleado).trim() === clean) ||
      (soloDigitos && e.numero_empleado && String(e.numero_empleado).trim() === soloDigitos) ||
      (e.id_empleado && e.id_empleado.toLowerCase() === clean.toLowerCase()) ||
      (e.qr_token && e.qr_token === clean) ||
      (clean.length >= 3 && `${e.nombre} ${e.apellido_paterno}`.toLowerCase().includes(clean.toLowerCase()))
    ) || null

    return { match, idLimpio: clean }
  }

  const procesarLecturaQR = (codigo: string, metodo: 'QR' | 'Manual' = 'QR') => {
    const { match, idLimpio } = encontrarEmpleado(codigo)
    const nombreCompleto = match
      ? `${match.nombre} ${match.apellido_paterno} ${match.apellido_materno || ''}`.trim()
      : (idLimpio.match(/\d+/) ? `Trabajador Nómina #${idLimpio.match(/\d+/)![0]}` : `Trabajador #${idLimpio}`)
    const puestoDepto = match ? `${match.puesto || 'Turno'} • ${match.departamento || 'Bacis'}` : 'Personal Operativo'

    const listaActual = pasajerosRef.current
    const duplicado = listaActual.find(p =>
      (match && p.id_empleado && p.id_empleado === match.id_empleado) ||
      (match && p.numero_nomina && String(p.numero_nomina) === String(match.numero_empleado)) ||
      p.nombre_completo.toLowerCase() === nombreCompleto.toLowerCase() ||
      p.id_manual === idLimpio
    )

    if (duplicado) {
      playBeep(false)
      mostrarAviso('duplicado', duplicado.nombre_completo, duplicado.puesto_depto)
      return
    }

    const nuevo: PasajeroBordo = {
      id_registro_local: `pas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id_empleado: match ? match.id_empleado : undefined,
      id_manual: match ? undefined : idLimpio,
      nombre_completo: nombreCompleto,
      puesto_depto: puestoDepto,
      numero_nomina: match?.numero_empleado ? String(match.numero_empleado) : idLimpio,
      metodo_registro: metodo,
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
        localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos))
      } catch (_) {}
    }

    playBeep(true)
    mostrarAviso('exito', nombreCompleto, puestoDepto)
  }

  const mostrarAviso = (tipo: 'exito' | 'duplicado', nombre: string, depto?: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setScanNotice({ tipo, nombre, depto, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) })
    noticeTimerRef.current = setTimeout(() => setScanNotice(null), 2500)
  }

  const quitarPasajero = (idReg: string) => {
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
        localStorage.setItem('rh_chofer_viajes', JSON.stringify(todos))
      } catch (_) {}
    }
  }

  /* ─────────────────────────── Guardar Reporte de Falla ─────────────────────────── */
  const handleGuardarFalla = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descripcionFalla.trim()) return alert('Describe la falla de la unidad.')

    const nuevaFalla: ReporteFalla = {
      id: `falla_${Date.now()}`,
      chofer: choferNombre,
      camion: numeroEconomico,
      falla: descripcionFalla.trim(),
      prioridad: prioridadFalla,
      fecha: new Date().toLocaleDateString('es-MX'),
      sincronizado: false
    }

    const actualizadas = [nuevaFalla, ...fallasList]
    setFallasList(actualizadas)
    localStorage.setItem(FALLAS_KEY, JSON.stringify(actualizadas))
    setDescripcionFalla('')
    playBeep(true)
    alert('🔧 ¡Reporte de Falla Guardado!\n\nSe notificará al taller mecánico.')
  }

  /* ─────────────────────────── Exportar PDF Manifiesto ─────────────────────────── */
  const exportarManifiestoPDF = (viaje: ViajeLocal) => {
    try {
      const doc = new jsPDF()
      doc.setFont('helvetica')

      // Encabezado institucional
      doc.setFillColor(24, 24, 27)
      doc.rect(0, 0, 210, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.text('MINAS DE BACIS S.A. DE C.V.', 14, 12)
      doc.setFontSize(9)
      doc.text('MANIFIESTO OFICIAL DE TRASLADO DE PERSONAL Y BITÁCORA QR', 14, 18)
      doc.text(`FOLIO: ${viaje.id_viaje_local.toUpperCase()}`, 14, 24)

      // Datos generales
      doc.setTextColor(20, 20, 20)
      doc.setFontSize(10)
      doc.text(`Fecha: ${viaje.hora_inicio_real ? viaje.hora_inicio_real.split('T')[0] : new Date().toLocaleDateString()}`, 14, 38)
      doc.text(`Chofer Operador: ${viaje.chofer_nombre}`, 14, 44)
      doc.text(`Unidad: ${viaje.tipo_vehiculo} (${viaje.numero_economico})`, 14, 50)
      doc.text(`Ruta: ${viaje.ruta_origen} ➔ ${viaje.ruta_destino}`, 120, 38)
      doc.text(`Hora Salida: ${viaje.hora_inicio_real ? new Date(viaje.hora_inicio_real).toLocaleTimeString() : 'N/A'}`, 120, 44)
      doc.text(`Total Pasajeros: ${viaje.pasajeros.length}`, 120, 50)

      // Tabla de pasajeros
      doc.setDrawColor(200, 200, 200)
      doc.line(14, 56, 196, 56)

      let y = 64
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text('#', 14, y)
      doc.text('NÓMINA', 22, y)
      doc.text('NOMBRE COMPLETO', 50, y)
      doc.text('PUESTO / ÁREA', 120, y)
      doc.text('HORA', 175, y)
      y += 4
      doc.line(14, y, 196, y)
      y += 6

      doc.setTextColor(20, 20, 20)
      viaje.pasajeros.forEach((p, idx) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.text(String(idx + 1), 14, y)
        doc.text(p.numero_nomina || 'N/A', 22, y)
        doc.text(p.nombre_completo.slice(0, 32), 50, y)
        doc.text((p.puesto_depto || 'General').slice(0, 28), 120, y)
        doc.text(p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'OK', 175, y)
        y += 6
      })

      // Firmas
      y = Math.max(y + 15, 250)
      if (y > 270) {
        doc.addPage()
        y = 40
      }
      doc.line(30, y, 85, y)
      doc.line(125, y, 180, y)
      doc.setFontSize(8)
      doc.text('FIRMA DEL CHOFER OPERADOR', 35, y + 5)
      doc.text('V.B. RECURSOS HUMANOS / CASETA', 127, y + 5)

      doc.save(`Manifiesto_${viaje.ruta_origen}_${viaje.ruta_destino}_${viaje.id_viaje_local}.pdf`)
    } catch (_) {
      alert('Error al generar PDF. Asegúrate de tener memoria disponible.')
    }
  }

  const viajesFiltradosBitacora = historialViajes.filter(v => {
    if (!busquedaBitacora.trim()) return true
    const q = busquedaBitacora.toLowerCase()
    return (
      v.chofer_nombre.toLowerCase().includes(q) ||
      v.ruta_origen.toLowerCase().includes(q) ||
      v.ruta_destino.toLowerCase().includes(q) ||
      v.pasajeros?.some(p => p.nombre_completo.toLowerCase().includes(q) || (p.numero_nomina && String(p.numero_nomina).includes(q)))
    )
  })

  const viajesPendientesCount = historialViajes.filter(v => v.estado === 'Finalizado' && !v.sincronizado).length

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans pb-24 select-none">
      {/* ── ENCABEZADO OFICIAL ── */}
      <header className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-40 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                <span>CHOFERES BACIS</span>
                <span className="text-[9px] bg-emerald-500 text-black font-black px-1.5 py-0.2 rounded-md">V2.5</span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-bold truncate max-w-[170px]">
                👔 {choferNombre} • {numeroEconomico}
              </p>
            </div>
          </div>

          {/* Badge de Red */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${isOnline ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' : 'bg-amber-950/80 text-amber-300 border-amber-700/60'}`}>
              {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />}
              <span>{isOnline ? 'En Línea' : 'Modo Sierra'}</span>
            </div>

            {deferredPrompt && !isInstalled && (
              <button onClick={() => deferredPrompt.prompt()} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] rounded-xl shadow-xs">
                📲 Instalar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL SEGÚN PESTAÑA ACTIVA ── */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {/* Banner de Sincronización si hay mensaje */}
        {syncStatusMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-2xl text-center">
            {syncStatusMsg}
          </div>
        )}

        {/* ══════════════════ PESTAÑA 1: VIAJES & QR ══════════════════ */}
        {activeTab === 'viajes' && (
          <div className="space-y-4">
            {view === 'inicio' ? (
              <div className="space-y-4">
                {/* Selector de Ruta & Unidad */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
                  <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                    <div>
                      <h2 className="text-base font-black text-white flex items-center gap-2">
                        <HardHat className="w-5 h-5 text-amber-400" /> Registro de Viaje
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">Define origen, destino y personal a bordo</p>
                    </div>
                  </div>

                  {/* Chofer con Sesión Guardada */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chofer Operador</label>
                      <span className="text-[10px] text-emerald-400 font-bold">✓ Sesión Guardada</span>
                    </div>
                    <select 
                      value={choferNombre} 
                      onChange={e => {
                        const val = e.target.value
                        setChoferNombre(val)
                        const f = choferesList.find(c => `${c.nombre} ${c.apellido_paterno}`.trim() === val)
                        const id = f ? f.id_empleado : choferId
                        if (f) setChoferId(f.id_empleado)
                        guardarSesionChofer(val, id, numeroEconomico, tipoVehiculo, origen, destino, kilometraje)
                      }} 
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3.5 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    >
                      {choferesList.map(c => {
                        const n = `${c.nombre} ${c.apellido_paterno}`.trim()
                        return <option key={c.id_empleado} value={n}>👔 {n}</option>
                      })}
                    </select>
                  </div>

                  {/* Vehículo + No Eco */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Vehículo</label>
                      <select 
                        value={tipoVehiculo} 
                        onChange={e => {
                          setTipoVehiculo(e.target.value)
                          guardarSesionChofer(choferNombre, choferId, numeroEconomico, e.target.value, origen, destino, kilometraje)
                        }} 
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
                        onChange={e => {
                          setNumeroEconomico(e.target.value)
                          guardarSesionChofer(choferNombre, choferId, e.target.value, tipoVehiculo, origen, destino, kilometraje)
                        }} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none" 
                      />
                    </div>
                  </div>

                  {/* Origen + Destino */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Origen (A)</label>
                      <select 
                        value={origen} 
                        onChange={e => {
                          setOrigen(e.target.value)
                          guardarSesionChofer(choferNombre, choferId, numeroEconomico, tipoVehiculo, e.target.value, destino, kilometraje)
                        }} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-bold text-white"
                      >
                        {['Obscuridad', 'Parajes', 'Mina Bacis', 'San Miguel', 'Planta'].map(l => <option key={l} value={l}>📍 {l}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Destino (B)</label>
                      <select 
                        value={destino} 
                        onChange={e => {
                          setDestino(e.target.value)
                          guardarSesionChofer(choferNombre, choferId, numeroEconomico, tipoVehiculo, origen, e.target.value, kilometraje)
                        }} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-bold text-white"
                      >
                        {['Parajes', 'Obscuridad', 'Mina Bacis', 'San Miguel', 'Planta'].map(l => <option key={l} value={l}>📍 {l}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Kilometraje y Combustible */}
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-800">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Kilometraje</label>
                      <input 
                        type="text" 
                        placeholder="Ej. 145200" 
                        value={kilometraje} 
                        onChange={e => {
                          setKilometraje(e.target.value)
                          guardarSesionChofer(choferNombre, choferId, numeroEconomico, tipoVehiculo, origen, destino, e.target.value)
                        }} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Gasolina</label>
                      <select value={combustible} onChange={e => setCombustible(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-xs font-bold text-white">
                        {['Lleno', '3/4', '1/2', '1/4', 'Reserva'].map(g => <option key={g} value={g}>⛽ {g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── SECCIÓN DE ABORDAJE Y ESCÁNER QR ── */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" /> Pasaje a Bordo ({pasajerosEnRuta.length})
                      </h3>
                      <p className="text-[11px] text-zinc-400">Escanea la credencial o ingresa el número de nómina</p>
                    </div>

                    <button
                      type="button"
                      onClick={cameraActive ? detenerCamara : iniciarCamara}
                      className={`px-4 py-2.5 font-black text-xs rounded-2xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all ${
                        cameraActive 
                          ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                          : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      <span>{cameraActive ? 'Apagar Cámara' : '📷 Abrir Cámara QR'}</span>
                    </button>
                  </div>

                  {/* Visor de Cámara QR */}
                  {cameraActive && (
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-emerald-500/60 shadow-2xl">
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-6 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                          <span className="text-[10px] font-mono font-bold text-emerald-300 bg-black/70 px-2 py-0.5 rounded">
                            Enfoca el código QR aquí
                          </span>
                        </div>
                      </div>

                      {cameraError && (
                        <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl font-bold">
                          {cameraError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Alerta de Escaneo Exitoso */}
                  {scanNotice && (
                    <div className={`p-3 rounded-2xl border text-xs font-black text-center animate-bounce ${
                      scanNotice.tipo === 'exito'
                        ? 'bg-emerald-950/90 border-emerald-600 text-emerald-300'
                        : 'bg-amber-950/90 border-amber-600 text-amber-300'
                    }`}>
                      {scanNotice.tipo === 'exito' ? '✅ ¡REGISTRADO A BORDO!' : '⚠️ YA ESTABA EN LA LISTA'}
                      <div className="text-sm font-black text-white mt-0.5">{scanNotice.nombre}</div>
                      <div className="text-[10px] opacity-80 font-normal">{scanNotice.depto}</div>
                    </div>
                  )}

                  {/* Input Manual por Nómina */}
                  <form onSubmit={e => {
                    e.preventDefault()
                    if (!manualIdInput.trim()) return
                    procesarLecturaQR(manualIdInput.trim(), 'Manual')
                    setManualIdInput('')
                  }} className="flex gap-2">
                    <input
                      type="text"
                      value={manualIdInput}
                      onChange={e => setManualIdInput(e.target.value)}
                      placeholder="Escribir número de nómina o ID..."
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-xs text-white font-bold placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-black text-xs rounded-2xl flex items-center gap-1"
                    >
                      <UserPlus className="w-4 h-4 text-emerald-400" />
                      <span>Agregar</span>
                    </button>
                  </form>

                  {/* Lista de Trabajadores a Bordo */}
                  {pasajerosEnRuta.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <div className="text-[11px] font-black text-zinc-400 uppercase tracking-wider flex justify-between">
                        <span>Personal a Bordo:</span>
                        <span className="text-emerald-400">{pasajerosEnRuta.length} personas</span>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {pasajerosEnRuta.map((p, idx) => (
                          <div key={p.id_registro_local} className="flex justify-between items-center p-2.5 bg-zinc-800/90 rounded-2xl border border-zinc-700/60 text-xs">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0">
                                {pasajerosEnRuta.length - idx}
                              </span>
                              <div className="truncate">
                                <div className="font-bold text-white text-xs truncate">{p.nombre_completo}</div>
                                <div className="text-[10px] text-zinc-400 truncate">{p.puesto_depto} • {new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => quitarPasajero(p.id_registro_local)}
                              className="p-1 text-zinc-500 hover:text-rose-400 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── BOTONES DE ACCIÓN (DIRECTO O EN VIVO) ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleGuardarViajeDirecto}
                      className="py-4 px-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs rounded-2xl border border-zinc-700 shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wide"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>💾 Guardar Manifiesto ({pasajerosEnRuta.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleIniciarRecorridoEnVivo}
                      className="py-4 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wide"
                    >
                      <Play className="w-4 h-4" />
                      <span>🟢 Iniciar en Vivo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── VISTA DE VIAJE EN RUTA ACTIVA ── */
              <div className="space-y-4">
                <div className="bg-emerald-950/80 border border-emerald-800/80 rounded-3xl p-5 space-y-4 shadow-2xl animate-in fade-in">
                  <div className="flex justify-between items-center border-b border-emerald-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-black uppercase text-emerald-200">Viaje en Curso</span>
                    </div>
                    <span className="font-mono text-sm font-black bg-black/40 px-3 py-1 rounded-xl text-emerald-300">
                      🕒 {tiempoTranscurrido}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center bg-black/30 p-3.5 rounded-2xl">
                    <div>
                      <div className="text-[10px] font-extrabold text-emerald-400 uppercase">Origen (Salida)</div>
                      <div className="text-base font-black text-white">{viajeActivo?.ruta_origen}</div>
                    </div>
                    <div className="border-l border-emerald-800/60 pl-2">
                      <div className="text-[10px] font-extrabold text-emerald-400 uppercase">Destino</div>
                      <div className="text-base font-black text-white">{viajeActivo?.ruta_destino}</div>
                    </div>
                  </div>

                  {/* Escáner en ruta */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cameraActive ? detenerCamara : iniciarCamara}
                      className="flex-1 py-3 bg-white text-zinc-900 font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>{cameraActive ? 'Apagar Cámara' : '📷 Escanear Pasajero Adicional'}</span>
                    </button>
                  </div>

                  {/* Cámara en ruta */}
                  {cameraActive && (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-emerald-400 shadow-2xl">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Lista de pasajeros a bordo */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {pasajerosEnRuta.map((p, idx) => (
                      <div key={p.id_registro_local} className="flex justify-between items-center p-2.5 bg-black/40 rounded-2xl text-xs border border-emerald-800/40">
                        <div>
                          <div className="font-black text-white">{idx + 1}. {p.nombre_completo}</div>
                          <div className="text-[10px] text-emerald-300">{p.puesto_depto}</div>
                        </div>
                        <button type="button" onClick={() => quitarPasajero(p.id_registro_local)} className="p-1 text-emerald-400 hover:text-rose-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleFinalizarViajeEnVivo}
                    className="w-full py-4 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-sm rounded-2xl shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wide"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>🏁 Finalizar Viaje en {viajeActivo?.ruta_destino} ({pasajerosEnRuta.length} Pasajeros)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ PESTAÑA 2: CHECKLIST DE UNIDAD ══════════════════ */}
        {activeTab === 'checklist' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-400" /> Checklist Pre-Operativo
                </h2>
                <p className="text-xs text-zinc-400">Inspección de 10 puntos de la unidad {numeroEconomico}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {CHECKLIST_ITEMS.map(item => {
                const checked = checklistAnswers[item.id] ?? true
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChecklistAnswers(prev => ({ ...prev, [item.id]: !checked }))}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      checked 
                        ? 'bg-zinc-800/90 border-emerald-800/80 text-white' 
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                      checked ? 'bg-emerald-500 text-black' : 'bg-rose-600 text-white'
                    }`}>
                      {checked ? '✓ OK' : '✕ Falla'}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                playBeep(true)
                alert('✅ ¡Checklist Guardado con Éxito!')
                setActiveTab('viajes')
              }}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl shadow-lg uppercase tracking-wider"
            >
              Guardar y Continuar a Viajes
            </button>
          </div>
        )}

        {/* ══════════════════ PESTAÑA 3: BITÁCORA & MANIFIESTOS ══════════════════ */}
        {activeTab === 'bitacora' && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-400" /> Bitácora de Traslados
                  </h2>
                  <p className="text-xs text-zinc-400">Consulta de viajes y manifiestos nominales</p>
                </div>
                <span className="text-xs font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                  {historialViajes.length} Viajes
                </span>
              </div>

              {/* Buscador de Pasajeros / Chofer */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={busquedaBitacora}
                  onChange={e => setBusquedaBitacora(e.target.value)}
                  placeholder="Buscar trabajador, nómina o chofer..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Lista de Viajes Guardados */}
              {viajesFiltradosBitacora.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No se encontraron viajes con ese criterio.</p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {viajesFiltradosBitacora.map((v, idx) => (
                    <div key={v.id_viaje_local || idx} className="p-4 bg-zinc-800/90 rounded-2xl border border-zinc-700/70 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-black text-white text-sm">🚌 {v.ruta_origen} ➔ {v.ruta_destino}</div>
                          <div className="text-[11px] text-emerald-400 font-bold">
                            👥 {v.pasajeros?.length || 0} Trabajadores a Bordo
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            📅 {v.hora_inicio_real ? v.hora_inicio_real.split('T')[0] : 'Hoy'} • Chofer: {v.chofer_nombre}
                          </div>
                        </div>

                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          v.sincronizado ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-amber-950 text-amber-300 border-amber-700'
                        }`}>
                          {v.sincronizado ? '✓ En Oficina' : '💾 En Celular'}
                        </span>
                      </div>

                      {/* Botones de Manifiesto y PDF */}
                      <div className="flex gap-2 pt-1 border-t border-zinc-700/50">
                        <button
                          type="button"
                          onClick={() => setSelectedManifestTrip(v)}
                          className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ver Manifiesto ({v.pasajeros?.length || 0})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportarManifiestoPDF(v)}
                          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-950 text-white border border-zinc-700 font-black text-xs rounded-xl flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ PESTAÑA 4: FALLAS MECÁNICAS ══════════════════ */}
        {activeTab === 'fallas' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-400" /> Reportar Falla Mecánica
              </h2>
              <p className="text-xs text-zinc-400">Aviso directo al taller para la unidad {numeroEconomico}</p>
            </div>

            <form onSubmit={handleGuardarFalla} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 uppercase">Descripción del problema</label>
                <textarea
                  rows={3}
                  value={descripcionFalla}
                  onChange={e => setDescripcionFalla(e.target.value)}
                  placeholder="Ej. Ruido en balatas delanteras al frenar..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 uppercase">Nivel de Prioridad</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Baja', 'Media', 'Alta', 'Crítica'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrioridadFalla(p)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase border ${
                        prioridadFalla === p 
                          ? 'bg-rose-600 border-rose-500 text-white shadow-md' 
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl shadow-lg uppercase tracking-wider"
              >
                Enviar Reporte al Taller
              </button>
            </form>

            {/* Historial de Fallas */}
            {fallasList.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="text-[11px] font-black text-zinc-400 uppercase">Fallas Registradas ({fallasList.length})</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {fallasList.map((f, i) => (
                    <div key={i} className="p-2.5 bg-zinc-800/80 rounded-2xl border border-zinc-700/60 text-xs">
                      <div className="flex justify-between font-bold text-white">
                        <span>Unidad: {f.camion}</span>
                        <span className="text-[10px] text-rose-400 font-black uppercase">{f.prioridad}</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 mt-1">{f.falla}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ PESTAÑA 5: SINCRONIZACIÓN ══════════════════ */}
        {activeTab === 'sync' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CloudUpload className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-base font-black text-white">Estado de Sincronización</h2>
              <p className="text-xs text-zinc-400 mt-1">
                {isOnline ? '🟢 Conexión activa con Supabase Oficina' : '🟠 Sin conexión (Modo Sierra Seguro)'}
              </p>
            </div>

            <div className="p-4 bg-zinc-800/80 rounded-2xl border border-zinc-700/60 text-left space-y-2 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-zinc-400">Viajes en Memoria Local:</span>
                <span className="text-white font-mono">{historialViajes.length}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-zinc-400">Viajes Pendientes de Subir:</span>
                <span className="text-amber-400 font-mono">{viajesPendientesCount}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-zinc-400">Catálogo de Empleados:</span>
                <span className="text-emerald-400 font-mono">{empleadosCache.length} Trabajadores</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleForzarSincronizacion}
              disabled={isSyncing}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Subiendo datos...' : `☁️ Sincronizar Ahora (${viajesPendientesCount} Pendientes)`}</span>
            </button>
          </div>
        )}
      </main>

      {/* ── MODAL DE MANIFIESTO NOMINAL DE UN VIAJE ── */}
      {selectedManifestTrip && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 w-full max-w-md space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">Manifiesto de Pasajeros</h3>
                <p className="text-[10px] text-zinc-400">{selectedManifestTrip.ruta_origen} ➔ {selectedManifestTrip.ruta_destino}</p>
              </div>
              <button onClick={() => setSelectedManifestTrip(null)} className="p-1.5 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedManifestTrip.pasajeros.map((p, idx) => (
                <div key={idx} className="p-2.5 bg-zinc-800/90 rounded-2xl border border-zinc-700/60 text-xs flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-black text-white">{p.nombre_completo}</div>
                      <div className="text-[10px] text-zinc-400">{p.puesto_depto}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded">
                    {p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'OK'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => exportarManifiestoPDF(selectedManifestTrip)}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedManifestTrip(null)}
                className="py-3 px-4 bg-zinc-800 text-white font-bold text-xs rounded-2xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BARRA DE NAVEGACIÓN INFERIOR (BOTTOM NAV) ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-40 px-3 py-2">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('viajes'); setView('inicio') }}
            className={`py-2 px-1 rounded-2xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'viajes' ? 'bg-emerald-500/20 text-emerald-400 font-black' : 'text-zinc-400 font-bold hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span className="text-[10px]">Viajes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`py-2 px-1 rounded-2xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'checklist' ? 'bg-emerald-500/20 text-emerald-400 font-black' : 'text-zinc-400 font-bold hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span className="text-[10px]">Checklist</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bitacora')}
            className={`py-2 px-1 rounded-2xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'bitacora' ? 'bg-emerald-500/20 text-emerald-400 font-black' : 'text-zinc-400 font-bold hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="text-[10px]">Bitácora</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fallas')}
            className={`py-2 px-1 rounded-2xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'fallas' ? 'bg-emerald-500/20 text-emerald-400 font-black' : 'text-zinc-400 font-bold hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span className="text-[10px]">Fallas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`py-2 px-1 rounded-2xl flex flex-col items-center gap-1 relative transition-all ${
              activeTab === 'sync' ? 'bg-emerald-500/20 text-emerald-400 font-black' : 'text-zinc-400 font-bold hover:text-white'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            <span className="text-[10px]">Nube</span>
            {viajesPendientesCount > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
                {viajesPendientesCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  )
}
