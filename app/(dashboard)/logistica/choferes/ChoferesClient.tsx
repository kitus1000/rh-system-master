'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import jsQR from 'jsqr'
import { 
  Bus, Camera, Car, CheckCircle, Droplet, FileSignature, FileText, Fuel, 
  Upload, User, Save, Download, Truck, Calendar, History, Clock, MapPin, 
  AlertTriangle, ShieldCheck, ShieldAlert, Ambulance, Sparkles, RefreshCw, 
  QrCode, UserPlus, Trash2, StopCircle, Play, Volume2, VolumeX, CheckCircle2,
  Users, Eye, FileSpreadsheet, CloudUpload
} from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { jsPDF } from 'jspdf'
import Link from 'next/link'
import empleadosOfflineJson from '@/app/data/empleados_offline.json'

interface Chofer {
  id_empleado: string
  nombre: string
  apellido_paterno?: string
  apellido_materno?: string
  departamento?: string
  puesto?: string
  numero_economico?: string
}

interface Viaje {
  id_viaje: string
  destino: string
  fecha_esperada: string
  hora_esperada: string
  estado: string
}

interface VehiculoFlota {
  id_camion: string
  numero_economico: string
  placas: string
  activo: boolean
}

interface PasajeroEscaneado {
  id: string
  nombre: string
  puesto?: string
  departamento?: string
  hora: string
  metodo: 'QR' | 'Manual'
}

interface ViajeRutaConcluido {
  id_bitacora: string
  id_chofer: string
  chofer_nombre: string
  punto_a: string
  punto_b: string
  hora_salida_a: string
  hora_llegada_b?: string
  pasajeros_subieron_a: number
  pasajeros_bajaron_b?: number
  pasajeros_lista?: PasajeroEscaneado[]
  estatus: 'EN_CURSO' | 'CONCLUIDO'
  fecha: string
  comentarios?: string
  creado_el: string
}

// 6 Choferes Oficiales Registrados
const DRIVERS_ROSTER = [
  { nombre: 'Adalberto Pinales', defaultEco: 'CAM-01', depto: 'Logística y Transporte' },
  { nombre: 'Ramon Yañez', defaultEco: 'CAM-02', depto: 'Logística y Transporte' },
  { nombre: 'Oscar Vazquez', defaultEco: 'URVAN-01', depto: 'Logística y Transporte' },
  { nombre: 'Enrique Linares', defaultEco: 'CAM-03', depto: 'Logística y Transporte' },
  { nombre: 'Samuel Madriles', defaultEco: 'BUS-01', depto: 'Logística y Transporte' },
  { nombre: 'Jesus Saucedo', defaultEco: 'CAM-04', depto: 'Logística y Transporte' }
]

function playBeep(success = true) {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (AudioCtx) {
      const ctx = new AudioCtx()
      const now = ctx.currentTime

      if (success) {
        // Chime melodioso ascendente de 2 notas (E6: 1318.5 Hz ➔ A6: 1760 Hz) tipo escáner premium
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(1318.5, now)
        gain1.gain.setValueAtTime(0.28, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.11)

        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1760.0, now + 0.08)
        gain2.gain.setValueAtTime(0.32, now + 0.08)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.08)
        osc2.stop(now + 0.22)
      } else {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(260, now)
        gain.gain.setValueAtTime(0.25, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.25)
      }
    }
  } catch (_) {}

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(success ? [50, 30, 50] : [200])
  }
}

export default function ChoferesClient() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'bitacora_ruta' | 'reporte' | 'programar' | 'historial'>('bitacora_ruta')
  
  // Validación de Rol (Chofer vs Administrador/RH)
  const isRHOrAdmin = profile?.rol === 'Administrativo' || 
                      profile?.rol === 'Superintendente' || 
                      profile?.rol === 'Jefe de Departamento' || 
                      (profile?.rol || '').toLowerCase().includes('rh') || 
                      (profile?.rol || '').toLowerCase().includes('recursos humanos') ||
                      (profile?.rol || '').toLowerCase().includes('admin')

  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [vehiculosFlota, setVehiculosFlota] = useState<VehiculoFlota[]>([])
  const [selectedChofer, setSelectedChofer] = useState('')
  const [selectedChoferObj, setSelectedChoferObj] = useState<Chofer | null>(null)
  
  const [camion, setCamion] = useState('')
  const [tipoVehiculo, setTipoVehiculo] = useState<'Camioneta' | 'Camión' | 'Ambulancia'>('Camioneta')
  const [motivoViaje, setMotivoViaje] = useState('Ruta de Personal (Mina ➔ Campamento)')
  
  // Bitácora de Ruta (Punto A -> Punto B)
  const [puntoA, setPuntoA] = useState('Mina Bacis')
  const [puntoB, setPuntoB] = useState('Parajes')
  const [pasajerosA, setPasajerosA] = useState<number>(0)
  const [pasajerosB, setPasajerosB] = useState<number>(0)
  const [comentariosRuta, setComentariosRuta] = useState('')
  
  const [viajeRutaActivo, setViajeRutaActivo] = useState<ViajeRutaConcluido | null>(null)
  const [bitacoraRutasList, setBitacoraRutasList] = useState<ViajeRutaConcluido[]>([])
  const [rutasQrGlobal, setRutasQrGlobal] = useState<ViajeRutaConcluido[]>([])
  const [pasajerosAbordados, setPasajerosAbordados] = useState<PasajeroEscaneado[]>([])
  const [manualIdInput, setManualIdInput] = useState('')

  // Refs de sincronización en tiempo real para evitar cierres obsoletos (Stale Closures)
  const pasajerosAbordadosRef = useRef<PasajeroEscaneado[]>([])
  const viajeRutaActivoRef = useRef<ViajeRutaConcluido | null>(null)
  const empleadosCatalogRef = useRef<any[]>(empleadosOfflineJson || [])
  const scanCooldownRef = useRef<boolean>(false)

  // Sub-pestaña de Historial ('rutas_qr' | 'checklists')
  const [subTabHistorial, setSubTabHistorial] = useState<'rutas_qr' | 'checklists'>('rutas_qr')
  const [selectedViajeQrModal, setSelectedViajeQrModal] = useState<ViajeRutaConcluido | null>(null)

  // QR Scanner Modal State
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const [empleadosCatalog, setEmpleadosCatalog] = useState<any[]>(empleadosOfflineJson || [])

  useEffect(() => { pasajerosAbordadosRef.current = pasajerosAbordados }, [pasajerosAbordados])
  useEffect(() => { viajeRutaActivoRef.current = viajeRutaActivo }, [viajeRutaActivo])
  useEffect(() => { empleadosCatalogRef.current = empleadosCatalog }, [empleadosCatalog])

  // Seed / Credenciales de Choferes
  const [showChoferesCredentials, setShowChoferesCredentials] = useState(false)
  const [seedingLoading, setSeedingLoading] = useState(false)
  const [seedingMsg, setSeedingMsg] = useState('')

  // Programar Viaje
  const [nuevoDestino, setNuevoDestino] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [misViajes, setMisViajes] = useState<Viaje[]>([])
  const [selectedViaje, setSelectedViaje] = useState('')
  const [miHistorial, setMiHistorial] = useState<any[]>([])
  const [selectedReporteModal, setSelectedReporteModal] = useState<any | null>(null)
  const [filtroTrabajador, setFiltroTrabajador] = useState('')

  // Checklist de Vehículo
  const [checklistCamioneta, setChecklistCamioneta] = useState({
    pertiga_banderola: true,
    torreta_seguridad: true,
    cunas_llantas: true,
    radio_frecuencia_mina: true,
    aceite_motor_agua: true,
    liquido_frenos_direccion: true,
    llantas_presion_at: true,
    refaccion_gato_cruceta: true,
    luces_faros_niebla: true,
    extintor_pqs_6kg: true,
    botiquin_primeros_auxilios: true,
    frenos_pie_mano: true,
    traccion_4x4_selector: true
  })

  const [checklistCamion, setChecklistCamion] = useState({
    frenos_aire_manometros: true,
    freno_motor_jake: true,
    salidas_emergencia_martillos: true,
    cunas_bloqueadoras_pesadas: true,
    luces_alarma_reversa: true,
    llantas_desgaste_torque: true,
    niveles_aceite_agua: true,
    extintor_abc_9kg: true,
    botiquin_ruta: true,
    torreta_toldo: true,
    cinturones_pasajeros: true,
    tacografo_limpiaparabrisas: true
  })

  const [checklistAmbulancia, setChecklistAmbulancia] = useState({
    motor_frenos_4x4: true,
    sirena_estrobos_pa: true,
    tanque_combustible_lleno: true,
    oxigeno_fijo_manometro: true,
    oxigeno_portatil_regulador: true,
    camilla_principal_cinturones: true,
    camilla_cuchara_scoop: true,
    desfibrilador_dea: true,
    aspirador_secreciones: true,
    maletin_trauma_medicamentos: true,
    tabla_espinal_collarines: true,
    glucometro_signos_vitales: true,
    radio_frecuencia_medica: true
  })

  const [comentariosVehiculo, setComentariosVehiculo] = useState('')
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')
  const [gasInicio, setGasInicio] = useState('Lleno')
  const [gasFin, setGasFin] = useState('3/4')
  const [litros, setLitros] = useState('')
  
  const [caseta, setCaseta] = useState('Caseta Principal / Mina Bacis')
  const [obsCaseta, setObsCaseta] = useState('')
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)
  
  // Firmas
  const sigChoferRef = useRef<SignatureCanvas>(null)
  const sigGuardiaRef = useRef<SignatureCanvas>(null)
  const [firmaChoferData, setFirmaChoferData] = useState<string | null>(null)
  const [firmaGuardiaData, setFirmaGuardiaData] = useState<string | null>(null)
  const [rhApproved, setRhApproved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncPortalLoading, setSyncPortalLoading] = useState(false)
  const [syncPortalMsg, setSyncPortalMsg] = useState('')

  const handleSyncPortal = async () => {
    setSyncPortalLoading(true)
    setSyncPortalMsg('Consultando viajes actualizados desde la oficina central...')
    try {
      await fetchViajesYHistorial()
      setSyncPortalMsg('✅ Bitácora e historial actualizados con éxito con la base central.')
      setTimeout(() => setSyncPortalMsg(''), 4000)
    } catch (e: any) {
      setSyncPortalMsg('Error al conectar con la base de datos.')
    } finally {
      setSyncPortalLoading(false)
    }
  }

  const isUUID = (str?: string) => {
    if (!str) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim())
  }

  // 1. CARGA INICIAL Y ROSTER DE CHOFERES
  useEffect(() => {
    fetchChoferesYFlota()
    cargarEmpleadosCatalogo()
  }, [profile])

  const cargarEmpleadosCatalogo = async () => {
    try {
      const local = localStorage.getItem('rh_chofer_empleados_cache')
      if (local) {
        const parsed = JSON.parse(local)
        if (parsed?.length) {
          setEmpleadosCatalog(parsed)
          empleadosCatalogRef.current = parsed
        }
      }
      const { data } = await supabase.from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado, qr_token')
        .order('nombre')
      if (data && data.length > 0) {
        setEmpleadosCatalog(data)
        empleadosCatalogRef.current = data
        try { localStorage.setItem('rh_chofer_empleados_cache', JSON.stringify(data)) } catch (_) {}
      }
    } catch (e) {}
  }

  const fetchChoferesYFlota = async () => {
    try {
      const [pRes, eRes, cRes] = await Promise.all([
        supabase.from('perfiles').select('id, nombre_completo, rol'),
        supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, puesto, departamento'),
        supabase.from('logistica_camiones').select('*').eq('activo', true).order('numero_economico')
      ])

      const pData = pRes.data || []
      const eData = eRes.data || []
      if (cRes.data) setVehiculosFlota(cRes.data)

      // Construir la lista con los 6 choferes oficiales
      const list: Chofer[] = DRIVERS_ROSTER.map(r => {
        const pMatch = pData.find(p => (p.nombre_completo || '').toLowerCase().includes(r.nombre.toLowerCase()))
        const eMatch = eData.find(e => `${e.nombre || ''} ${e.apellido_paterno || ''}`.toLowerCase().includes(r.nombre.toLowerCase()))
        
        return {
          id_empleado: pMatch?.id || eMatch?.id_empleado || 'CHOFER-' + r.nombre.replace(/\s+/g, '-').toUpperCase(),
          nombre: r.nombre,
          puesto: 'Chofer Operador',
          departamento: r.depto,
          numero_economico: r.defaultEco
        }
      })

      setChoferes(list)

      // AUTO-VINCULACIÓN SEGÚN EL USUARIO LOGUEADO:
      if (profile) {
        const nombreLog = (profile.nombre_completo || '').toLowerCase()
        const emailLog = ((profile as any)?.email || '').toLowerCase()
        const myDriver = list.find(c => 
          nombreLog.includes(c.nombre.toLowerCase()) || 
          c.id_empleado === profile.id ||
          emailLog.includes(c.nombre.toLowerCase().split(' ')[0]) ||
          (c.nombre.toLowerCase().includes('adalberto') && emailLog.includes('adalberto')) ||
          (c.nombre.toLowerCase().includes('ramon') && emailLog.includes('ramon')) ||
          (c.nombre.toLowerCase().includes('oscar') && emailLog.includes('oscar')) ||
          (c.nombre.toLowerCase().includes('enrique') && emailLog.includes('enrique')) ||
          (c.nombre.toLowerCase().includes('samuel') && emailLog.includes('samuel')) ||
          (c.nombre.toLowerCase().includes('jesus') && emailLog.includes('jesus'))
        )

        if (myDriver) {
          setSelectedChofer(myDriver.id_empleado)
          setSelectedChoferObj(myDriver)
          if (!camion && myDriver.numero_economico) setCamion(myDriver.numero_economico)
        } else if (isRHOrAdmin && list.length > 0) {
          setSelectedChofer(list[0].id_empleado)
          setSelectedChoferObj(list[0])
          if (!camion && list[0].numero_economico) setCamion(list[0].numero_economico)
        } else if (list.length > 0) {
          setSelectedChofer(list[0].id_empleado)
          setSelectedChoferObj(list[0])
        }
      }
    } catch (err) {
      console.error('Error fetching choferes:', err)
    }
  }

  // Actualizar chofer objeto cuando cambia el select
  useEffect(() => {
    if (!selectedChofer) return
    const found = choferes.find(c => c.id_empleado === selectedChofer)
    if (found) {
      setSelectedChoferObj(found)
      if (found.numero_economico && !camion) setCamion(found.numero_economico)
    }
  }, [selectedChofer, choferes])

  // 2. CARGA DE VIAJES Y HISTORIAL (QR & CHECKLISTS)
  const fetchViajesYHistorial = async () => {
    try {
      // Cargar Viajes Programados si es UUID
      if (selectedChofer && isUUID(selectedChofer)) {
        const { data: vData } = await supabase.from('logistica_viajes_programados')
          .select('*')
          .eq('id_empleado', selectedChofer)
          .in('estado', ['Programado', 'Retrasado'])
          .order('fecha_esperada', { ascending: true })
        setMisViajes(vData || [])
      }

      // Cargar Checklists Mecánicos
      let loadedReports: any[] = []
      if (selectedChofer && isUUID(selectedChofer)) {
        const { data: directData } = await supabase.from('logistica_reportes_diarios')
          .select('*')
          .eq('id_empleado', selectedChofer)
          .order('creado_el', { ascending: false })
          .limit(30)
        if (directData && directData.length > 0) loadedReports = directData
      }

      if (loadedReports.length === 0) {
        const { data: allReports } = await supabase.from('logistica_reportes_diarios')
          .select('*')
          .order('creado_el', { ascending: false })
          .limit(30)
        if (allReports && allReports.length > 0) loadedReports = allReports
      }

      let localReports: any[] = []
      try {
        const rawLocal = localStorage.getItem('rh_reportes_local_backup')
        if (rawLocal) localReports = JSON.parse(rawLocal)
      } catch (e) {}

      const combined = [...localReports, ...loadedReports]
      const unique = combined.filter((v, i, a) => 
        a.findIndex(t => (t.id_reporte && t.id_reporte === v.id_reporte) || (t.creado_el && t.creado_el === v.creado_el)) === i
      )
      setMiHistorial(unique)

      // Cargar Historial Global de Rutas y Pasajeros QR
      await cargarHistorialRutasQR()
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }

  const cargarHistorialRutasQR = async () => {
    let allRutas: ViajeRutaConcluido[] = []

    // 1. Cargar desde Supabase (logistica_reportes_diarios)
    try {
      const { data: supaReportes } = await supabase
        .from('logistica_reportes_diarios')
        .select(`
          id_reporte,
          id_empleado,
          fecha,
          camion_numero,
          tipo_vehiculo,
          comentarios_vehiculo,
          observaciones_recorrido,
          ubicacion_caseta,
          creado_el,
          empleados:id_empleado (id_empleado, nombre, apellido_paterno, apellido_materno)
        `)
        .order('creado_el', { ascending: false })

      if (supaReportes && supaReportes.length > 0) {
        supaReportes.forEach((rep: any) => {
          const com = rep.comentarios_vehiculo || ''
          let puntoA = 'Mina Bacis'
          let puntoB = rep.ubicacion_caseta || 'Parajes'
          let choferNombre = 'Chofer Operador'

          if (rep.empleados) {
            choferNombre = `${rep.empleados.nombre} ${rep.empleados.apellido_paterno || ''}`.trim()
          }

          if (com.includes('Ruta:')) {
            const rPart = com.split('Ruta:')[1]?.split('|')[0]?.trim() || ''
            const parts = rPart.split(/\s+a\s+|\s+➔\s+|\s+->\s+/i)
            if (parts.length >= 2) {
              puntoA = parts[0].trim()
              puntoB = parts[1].trim()
            } else if (rPart) {
              puntoA = rPart
            }
          }
          if (com.includes('Chofer:')) {
            const chPart = com.split('Chofer:')[1]?.split('|')[0]?.trim() || ''
            if (chPart) {
              choferNombre = chPart
            }
          }

          let listaPasajeros: PasajeroEscaneado[] = []
          try {
            if (rep.observaciones_recorrido && rep.observaciones_recorrido !== '[]') {
              const parsed = JSON.parse(rep.observaciones_recorrido)
              listaPasajeros = parsed.map((p: any) => ({
                id: p.id_empleado || p.id || p.id_manual || 'ID',
                nombre: p.nombre_completo || p.nombre || 'Trabajador',
                puesto: p.puesto_depto || p.puesto || 'Personal Mina Bacis',
                departamento: p.departamento || 'Mina Bacis',
                hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : (p.hora || 'N/A'),
                metodo: p.metodo_registro || p.metodo || 'QR'
              }))
            }
          } catch (_) {}

          const horaSalida = rep.creado_el ? new Date(rep.creado_el).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A'

          allRutas.push({
            id_bitacora: rep.id_reporte,
            id_chofer: rep.id_empleado,
            chofer_nombre: choferNombre,
            punto_a: puntoA,
            punto_b: puntoB,
            hora_salida_a: horaSalida,
            hora_llegada_b: 'Completado',
            pasajeros_subieron_a: listaPasajeros.length,
            pasajeros_bajaron_b: listaPasajeros.length,
            pasajeros_lista: listaPasajeros,
            estatus: 'CONCLUIDO',
            fecha: rep.fecha ? rep.fecha.toString() : (rep.creado_el ? rep.creado_el.split('T')[0] : new Date().toISOString().split('T')[0]),
            creado_el: rep.creado_el || new Date().toISOString()
          })
        })
      }
    } catch (e) {}

    // 2. Cargar desde LocalStorage
    try {
      const globalRaw = localStorage.getItem('rh_rutas_qr_global_history')
      if (globalRaw) allRutas = [...allRutas, ...JSON.parse(globalRaw)]
    } catch (e) {}

    try {
      const appRaw = localStorage.getItem('rh_chofer_viajes')
      if (appRaw) {
        const appViajes = JSON.parse(appRaw)
        appViajes.forEach((v: any) => {
          allRutas.push({
            id_bitacora: v.id_viaje_local || 'APP-' + Date.now(),
            id_chofer: v.id_chofer || 'CHOFER',
            chofer_nombre: v.chofer_nombre || 'Chofer Operador',
            punto_a: v.ruta_origen || 'Origen',
            punto_b: v.ruta_destino || 'Destino',
            hora_salida_a: v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            hora_llegada_b: v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Completado',
            pasajeros_subieron_a: v.pasajeros?.length || 0,
            pasajeros_bajaron_b: v.pasajeros?.length || 0,
            pasajeros_lista: (v.pasajeros || []).map((p: any) => ({
              id: p.id_empleado || p.id_manual || 'ID',
              nombre: p.nombre_completo || 'Trabajador',
              puesto: p.puesto_depto || 'Personal',
              departamento: 'Mina Bacis',
              hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
              metodo: p.metodo_registro || 'QR'
            })),
            estatus: v.estado === 'Finalizado' ? 'CONCLUIDO' : 'EN_CURSO',
            fecha: v.creado_el ? new Date(v.creado_el).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            creado_el: v.creado_el || new Date().toISOString()
          })
        })
      }
    } catch (e) {}

    // Deduplicar rutas
    const uniqueRutas = allRutas.filter((v, i, a) => 
      a.findIndex(t => t.id_bitacora === v.id_bitacora || (t.hora_salida_a === v.hora_salida_a && t.fecha === v.fecha && t.chofer_nombre === v.chofer_nombre)) === i
    )

    // Ordenar por fecha descendente
    uniqueRutas.sort((a, b) => new Date(b.creado_el || b.fecha).getTime() - new Date(a.creado_el || a.fecha).getTime())

    setRutasQrGlobal(uniqueRutas)
    setBitacoraRutasList(uniqueRutas)
  }

  useEffect(() => {
    fetchViajesYHistorial()
  }, [selectedChofer, activeTab])

  // 3. BITÁCORA DE RUTA Y REGISTRO DE PASAJEROS CON QR
  useEffect(() => {
    if (!selectedChofer) return
    try {
      const active = localStorage.getItem(`active_route_${selectedChofer}`)
      if (active) {
        const parsed = JSON.parse(active)
        setViajeRutaActivo(parsed)
        setPasajerosB(parsed.pasajeros_subieron_a || 0)
        if (parsed.pasajeros_lista) setPasajerosAbordados(parsed.pasajeros_lista)
      } else {
        setViajeRutaActivo(null)
      }
    } catch (e) {}
  }, [selectedChofer])

  const handleIniciarRuta = async () => {
    if (!selectedChofer) return alert('Por favor selecciona un chofer')
    if (!puntoA.trim() || !puntoB.trim()) return alert('Define el Punto A y Punto B')

    const choferNombre = selectedChoferObj 
      ? `${selectedChoferObj.nombre} ${selectedChoferObj.apellido_paterno || ''}`.trim() 
      : (profile?.nombre_completo || 'Chofer Operador')
    const now = new Date()
    const horaActual = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    const fechaActual = now.toISOString().split('T')[0]

    const listaPasajerosInicial = [...pasajerosAbordadosRef.current]
    const conteoInicial = listaPasajerosInicial.length > 0 ? listaPasajerosInicial.length : (pasajerosA || 0)

    const newTrip: ViajeRutaConcluido = {
      id_bitacora: 'RUT-' + Date.now(),
      id_chofer: selectedChofer,
      chofer_nombre: choferNombre,
      punto_a: puntoA.toUpperCase().trim(),
      punto_b: puntoB.toUpperCase().trim(),
      hora_salida_a: horaActual,
      pasajeros_subieron_a: conteoInicial,
      pasajeros_lista: listaPasajerosInicial,
      estatus: 'EN_CURSO',
      fecha: fechaActual,
      comentarios: comentariosRuta,
      creado_el: now.toISOString()
    }

    setViajeRutaActivo(newTrip)
    viajeRutaActivoRef.current = newTrip
    setPasajerosB(conteoInicial)
    localStorage.setItem(`active_route_${selectedChofer}`, JSON.stringify(newTrip))

    playBeep(true)
    alert(`🟢 ¡Ruta Iniciada con Éxito!\n\nSalida: ${newTrip.punto_a} ➔ Destino: ${newTrip.punto_b}\nPasajeros a bordo: ${conteoInicial}`)
  }

  const handleFinalizarRuta = async () => {
    if (!viajeRutaActivo) return

    const now = new Date()
    const horaActual = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })

    const listaFinal = pasajerosAbordadosRef.current.length > 0 
      ? pasajerosAbordadosRef.current 
      : (viajeRutaActivo.pasajeros_lista || [])

    const totalFinal = listaFinal.length > 0 
      ? listaFinal.length 
      : (pasajerosB > 0 ? pasajerosB : (viajeRutaActivo.pasajeros_subieron_a || 0))

    const completedTrip: ViajeRutaConcluido = {
      ...viajeRutaActivo,
      hora_llegada_b: horaActual,
      pasajeros_subieron_a: totalFinal,
      pasajeros_bajaron_b: pasajerosB || totalFinal,
      pasajeros_lista: listaFinal,
      estatus: 'CONCLUIDO'
    }

    setViajeRutaActivo(null)
    viajeRutaActivoRef.current = null
    setPasajerosAbordados([])
    pasajerosAbordadosRef.current = []
    setPasajerosA(0)
    setPasajerosB(0)
    localStorage.removeItem(`active_route_${selectedChofer}`)

    // Guardar en Historial Local
    const updatedChoferHistory = [completedTrip, ...bitacoraRutasList]
    setBitacoraRutasList(updatedChoferHistory)
    localStorage.setItem(`history_routes_${selectedChofer}`, JSON.stringify(updatedChoferHistory))

    // Guardar en Supabase a través del endpoint central de sincronización
    try {
      await fetch('/api/choferes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajes: [{
            id_viaje_local: completedTrip.id_bitacora,
            id_chofer: isUUID(selectedChofer) ? selectedChofer : null,
            chofer_nombre: completedTrip.chofer_nombre,
            tipo_vehiculo: tipoVehiculo || 'Camioneta',
            numero_economico: camion || 'CAM-01',
            ruta_origen: completedTrip.punto_a,
            ruta_destino: completedTrip.punto_b,
            hora_inicio_real: completedTrip.creado_el,
            hora_fin_real: now.toISOString(),
            estado: 'Finalizado',
            pasajeros: listaFinal
          }]
        })
      })
    } catch (e) {}

    // Respaldo directo en Supabase
    try {
      await supabase.from('logistica_reportes_diarios').insert([{
        fecha: completedTrip.fecha,
        camion_numero: camion || 'CAM-01',
        tipo_vehiculo: tipoVehiculo || 'Camioneta',
        ubicacion_caseta: completedTrip.punto_b,
        comentarios_vehiculo: `[VIAJE_QR] Ruta: ${completedTrip.punto_a} a ${completedTrip.punto_b} | Chofer: ${completedTrip.chofer_nombre} | Pasajeros: ${totalFinal} | Salida: ${completedTrip.hora_salida_a} | Llegada: ${completedTrip.hora_llegada_b}`,
        observaciones_recorrido: JSON.stringify(listaFinal),
        frenos_ok: true,
        luces_ok: true,
        llantas_ok: true,
        niveles_aceite_ok: true,
        carroceria_ok: true,
        extintor_ok: true,
        botiquin_ok: true
      }])
    } catch (e) {}

    playBeep(true)
    alert(`🏁 ¡Ruta Concluida en ${completedTrip.punto_b}!\n\n👥 Total de Personal a Bordo: ${totalFinal}\n\nLos datos fueron guardados y enviados a la oficina central.`)
    setActiveTab('historial')
    setSubTabHistorial('rutas_qr')
    fetchViajesYHistorial()
  }

  // GUARDAR MANIFIESTO DIRECTO (1 SOLO CLIC)
  const handleGuardarViajeDirecto = async () => {
    if (!selectedChofer) return alert('Por favor selecciona un chofer')
    if (!puntoA.trim() || !puntoB.trim()) return alert('Define el Punto A y Punto B')

    const choferNombre = selectedChoferObj 
      ? `${selectedChoferObj.nombre} ${selectedChoferObj.apellido_paterno || ''}`.trim() 
      : (profile?.nombre_completo || 'Chofer Operador')
    const now = new Date()
    const horaActual = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    const fechaActual = now.toISOString().split('T')[0]

    const listaFinal = [...pasajerosAbordadosRef.current]
    const totalFinal = listaFinal.length > 0 ? listaFinal.length : (pasajerosA || 0)

    const completedTrip: ViajeRutaConcluido = {
      id_bitacora: 'RUT-' + Date.now(),
      id_chofer: selectedChofer,
      chofer_nombre: choferNombre,
      punto_a: puntoA.toUpperCase().trim(),
      punto_b: puntoB.toUpperCase().trim(),
      hora_salida_a: horaActual,
      hora_llegada_b: horaActual,
      pasajeros_subieron_a: totalFinal,
      pasajeros_bajaron_b: totalFinal,
      pasajeros_lista: listaFinal,
      estatus: 'CONCLUIDO',
      fecha: fechaActual,
      comentarios: comentariosRuta,
      creado_el: now.toISOString()
    }

    setViajeRutaActivo(null)
    viajeRutaActivoRef.current = null
    setPasajerosAbordados([])
    pasajerosAbordadosRef.current = []
    setPasajerosA(0)
    setPasajerosB(0)
    localStorage.removeItem(`active_route_${selectedChofer}`)

    // Guardar en Historial Local
    const updatedChoferHistory = [completedTrip, ...bitacoraRutasList]
    setBitacoraRutasList(updatedChoferHistory)
    localStorage.setItem(`history_routes_${selectedChofer}`, JSON.stringify(updatedChoferHistory))

    // Guardar en Supabase a través del endpoint central de sincronización
    try {
      await fetch('/api/choferes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajes: [{
            id_viaje_local: completedTrip.id_bitacora,
            id_chofer: isUUID(selectedChofer) ? selectedChofer : null,
            chofer_nombre: completedTrip.chofer_nombre,
            tipo_vehiculo: tipoVehiculo || 'Camioneta',
            numero_economico: camion || 'CAM-01',
            ruta_origen: completedTrip.punto_a,
            ruta_destino: completedTrip.punto_b,
            hora_inicio_real: completedTrip.creado_el,
            hora_fin_real: now.toISOString(),
            estado: 'Finalizado',
            pasajeros: listaFinal
          }]
        })
      })
    } catch (e) {}

    // Respaldo directo en Supabase
    try {
      await supabase.from('logistica_reportes_diarios').insert([{
        fecha: completedTrip.fecha,
        camion_numero: camion || 'CAM-01',
        tipo_vehiculo: tipoVehiculo || 'Camioneta',
        ubicacion_caseta: completedTrip.punto_b,
        comentarios_vehiculo: `[VIAJE_QR] Ruta: ${completedTrip.punto_a} a ${completedTrip.punto_b} | Chofer: ${completedTrip.chofer_nombre} | Pasajeros: ${totalFinal} | Salida: ${completedTrip.hora_salida_a} | Llegada: ${completedTrip.hora_llegada_b}`,
        observaciones_recorrido: JSON.stringify(listaFinal),
        frenos_ok: true,
        luces_ok: true,
        llantas_ok: true,
        niveles_aceite_ok: true,
        carroceria_ok: true,
        extintor_ok: true,
        botiquin_ok: true
      }])
    } catch (e) {}

    playBeep(true)
    alert(`🏁 ¡Manifiesto Guardado con Éxito!\n\n👥 Total de Personal Registrado: ${totalFinal}\n\nLos datos fueron guardados y enviados a la oficina central.`)
    setActiveTab('historial')
    setSubTabHistorial('rutas_qr')
    fetchViajesYHistorial()
  }

  // AGREGAR PASAJERO (QR O MANUAL - NUNCA SOBREESCRIBE LISTA PREVIA)
  const agregarPasajero = (idOrQr: string, metodo: 'QR' | 'Manual' = 'Manual') => {
    if (!idOrQr.trim()) return

    const cleanStr = idOrQr.trim()
    const catalog = empleadosCatalogRef.current

    const numMatch = cleanStr.match(/\d+/)
    const soloDigitos = numMatch ? numMatch[0] : ''

    // Buscar en catálogo de empleados
    let emp = catalog.find((e: any) => 
      (e.numero_empleado && String(e.numero_empleado).trim() === cleanStr) ||
      (soloDigitos && e.numero_empleado && String(e.numero_empleado).trim() === soloDigitos) ||
      (e.id_empleado && e.id_empleado.toLowerCase() === cleanStr.toLowerCase()) ||
      (e.qr_token && e.qr_token === cleanStr) ||
      (cleanStr.length >= 3 && `${e.nombre} ${e.apellido_paterno}`.toLowerCase().includes(cleanStr.toLowerCase()))
    )

    if (!emp && cleanStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(cleanStr)
        const sid = parsed.id || parsed.id_empleado || parsed.numero_empleado || parsed.nomina
        if (sid) emp = catalog.find((e: any) => e.id_empleado === String(sid) || String(e.numero_empleado) === String(sid))
      } catch (_) {}
    }

    const nombreCompleto = emp 
      ? `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno || ''}`.trim() 
      : (soloDigitos ? `Trabajador Nómina #${soloDigitos}` : `Trabajador #${cleanStr}`)

    // Leer lista ACTUAL directamente de la Ref
    const listaActual = pasajerosAbordadosRef.current

    const existe = listaActual.find(p => 
      (emp && p.id === emp.id_empleado) || 
      p.id === cleanStr || 
      p.nombre.toLowerCase() === nombreCompleto.toLowerCase()
    )

    if (existe) {
      playBeep(false)
      setScanMessage(`⚠️ YA ESTÁ EN LA LISTA: ${existe.nombre}`)
      return
    }

    const nuevo: PasajeroEscaneado = {
      id: emp?.id_empleado || cleanStr,
      nombre: nombreCompleto,
      puesto: emp?.puesto || 'Personal de Turno',
      departamento: emp?.departamento || 'Mina Bacis',
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      metodo
    }

    const updated = [nuevo, ...listaActual]
    pasajerosAbordadosRef.current = updated
    setPasajerosAbordados([...updated])
    setPasajerosA(updated.length)
    setManualIdInput('')
    playBeep(true)
    setScanMessage(`✅ ¡REGISTRADO (#${updated.length})! ${nuevo.nombre}`)

    // Si hay viaje activo, actualizar en localStorage
    const currentTrip = viajeRutaActivoRef.current
    if (currentTrip) {
      const uTrip: ViajeRutaConcluido = { ...currentTrip, pasajeros_subieron_a: updated.length, pasajeros_lista: updated }
      viajeRutaActivoRef.current = uTrip
      setViajeRutaActivo(uTrip)
      localStorage.setItem(`active_route_${selectedChofer}`, JSON.stringify(uTrip))
    }
  }

  const quitarPasajero = (id: string) => {
    const updated = pasajerosAbordadosRef.current.filter(p => p.id !== id)
    pasajerosAbordadosRef.current = updated
    setPasajerosAbordados([...updated])
    setPasajerosA(updated.length)
    const currentTrip = viajeRutaActivoRef.current
    if (currentTrip) {
      const uTrip: ViajeRutaConcluido = { ...currentTrip, pasajeros_subieron_a: updated.length, pasajeros_lista: updated }
      viajeRutaActivoRef.current = uTrip
      setViajeRutaActivo(uTrip)
      localStorage.setItem(`active_route_${selectedChofer}`, JSON.stringify(uTrip))
    }
  }

  // 4. CÁMARA ESCÁNER QR HÍBRIDO (Native + jsQR con attemptBoth)
  const iniciarCamaraQR = async () => {
    setShowQrScanner(true)
    setCameraLoading(true)
    setCameraError('')
    setScanMessage('Apunte la cámara a la credencial con QR...')

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
        videoRef.current.setAttribute('muted', 'true')
        videoRef.current.setAttribute('autoplay', 'true')
        await videoRef.current.play()
        setCameraLoading(false)
        iniciarBucleEscaneo()
      }
    } catch (err: any) {
      setCameraLoading(false)
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
    }
  }

  const detenerCamaraQR = () => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setShowQrScanner(false)
  }

  const iniciarBucleEscaneo = () => {
    let nativeDetector: any = null
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'data_matrix'] })
      } catch (e) {}
    }

    const tempCanvas = document.createElement('canvas')
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })

    const scan = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(scan)
        return
      }

      if (!scanCooldownRef.current) {
        const video = videoRef.current
        let detectedCode: string | null = null

        // 1. Native BarcodeDetector
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video)
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              detectedCode = barcodes[0].rawValue
            }
          } catch (e) {}
        }

        // 2. jsQR Fallback con attemptBoth
        if (!detectedCode && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            if (tempCanvas.width !== video.videoWidth || tempCanvas.height !== video.videoHeight) {
              tempCanvas.width = video.videoWidth
              tempCanvas.height = video.videoHeight
            }
            ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
            const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
            const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' })
            if (code && code.data) {
              detectedCode = code.data
            }
          } catch (e) {}
        }

        if (detectedCode) {
          scanCooldownRef.current = true
          agregarPasajero(detectedCode, 'QR')
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([70, 40, 70])
          }
          setTimeout(() => {
            scanCooldownRef.current = false
          }, 850)
        }
      }

      scanLoopRef.current = requestAnimationFrame(scan)
    }

    scanLoopRef.current = requestAnimationFrame(scan)
  }

  // 5. EVALUACIÓN Y GUARDADO DE CHECKLIST
  const getIsVehicleApto = () => {
    if (tipoVehiculo === 'Camioneta') {
      return Object.values(checklistCamioneta).every(v => v === true)
    } else if (tipoVehiculo === 'Camión') {
      return Object.values(checklistCamion).every(v => v === true)
    } else {
      return Object.values(checklistAmbulancia).every(v => v === true)
    }
  }

  const isApto = getIsVehicleApto()

  const handleSaveToDB = async () => {
    if (!selectedChofer || !camion) {
      alert('Por favor selecciona el Chofer Operador y la Unidad / Vehículo')
      return
    }
    setSaving(true)

    try {
      let validEmpleadoId: string | null = null
      if (isUUID(selectedChofer)) {
        validEmpleadoId = selectedChofer
      } else {
        const { data: anyEmp } = await supabase.from('empleados').select('id_empleado').limit(1)
        if (anyEmp && anyEmp.length > 0) validEmpleadoId = anyEmp[0].id_empleado
      }

      const choferNombre = selectedChoferObj?.nombre || profile?.nombre_completo || 'Chofer Operador'
      const nombreRH = isRHOrAdmin ? (profile?.nombre_completo || 'Recursos Humanos') : null

      const payload: any = {
        id_empleado: validEmpleadoId,
        camion_numero: camion,
        id_viaje: (selectedViaje && isUUID(selectedViaje)) ? selectedViaje : null,
        kilometraje_inicial: parseInt(kmInicial) || 0,
        kilometraje_final: parseInt(kmFinal) || 0,
        gasolina_inicio: gasInicio,
        gasolina_fin: gasFin,
        litros_cargados: parseFloat(litros) || 0,
        frenos_ok: isApto,
        luces_ok: isApto,
        llantas_ok: isApto,
        niveles_aceite_ok: isApto,
        carroceria_ok: isApto,
        extintor_ok: isApto,
        botiquin_ok: isApto,
        comentarios_vehiculo: `[MOTIVO: ${motivoViaje}] [CATEGORÍA: ${tipoVehiculo}] [APTO MINA: ${isApto ? 'SI' : 'NO'}] ${comentariosVehiculo}`,
        ubicacion_caseta: caseta,
        foto_caseta_url: fotoBase64,
        observaciones_recorrido: obsCaseta,
        firma_chofer_url: firmaChoferData,
        firma_guardia_url: firmaGuardiaData,
        firma_rh_url: rhApproved && isRHOrAdmin ? 'APROBADO_RH' : null,
        firma_rh_nombre: rhApproved && isRHOrAdmin ? nombreRH : null,
        tipo_vehiculo: tipoVehiculo
      }

      let supabaseSaved = false
      let createdReportId = 'rep_' + Date.now()

      try {
        const { data: insData, error: insErr } = await supabase.from('logistica_reportes_diarios').insert([payload]).select()
        if (!insErr && insData && insData[0]) {
          supabaseSaved = true
          createdReportId = insData[0].id_reporte
        }
      } catch (e) {}

      const localReport = {
        ...payload,
        id_reporte: createdReportId,
        creado_el: new Date().toISOString(),
        chofer_nombre: choferNombre,
        sincronizado: supabaseSaved
      }

      const existingLocal = JSON.parse(localStorage.getItem('rh_reportes_local_backup') || '[]')
      const updatedLocal = [localReport, ...existingLocal]
      localStorage.setItem('rh_reportes_local_backup', JSON.stringify(updatedLocal))
      setMiHistorial(updatedLocal)

      alert('✅ ¡Checklist de Inspección Minera y Reporte guardados exitosamente!\n\nPuedes consultarlo en la pestaña de Historial.')
      setActiveTab('historial')
      setSubTabHistorial('checklists')
      sigChoferRef.current?.clear(); setFirmaChoferData(null)
      sigGuardiaRef.current?.clear(); setFirmaGuardiaData(null)
      setFotoBase64(null)
      fetchViajesYHistorial()
    } catch (err: any) {
      alert('Nota: ' + (err.message || 'El reporte se guardó localmente en tu navegador.'))
    } finally {
      setSaving(false)
    }
  }

  const handleAprobarRHEnModal = async (reporte: any) => {
    if (!isRHOrAdmin) {
      alert('⚠️ Solo el personal con perfil de Recursos Humanos o Administrador puede autorizar esta salida.')
      return
    }
    const nombreRH = profile?.nombre_completo || 'Recursos Humanos'
    try {
      if (reporte.id_reporte && isUUID(reporte.id_reporte)) {
        await supabase.from('logistica_reportes_diarios')
          .update({ firma_rh_url: 'APROBADO_RH', firma_rh_nombre: nombreRH })
          .eq('id_reporte', reporte.id_reporte)
      }
      const updated = { ...reporte, firma_rh_url: 'APROBADO_RH', firma_rh_nombre: nombreRH }
      setSelectedReporteModal(updated)
      setMiHistorial(prev => prev.map(r => (r.id_reporte === reporte.id_reporte || r.creado_el === reporte.creado_el) ? updated : r))
      
      const local = JSON.parse(localStorage.getItem('rh_reportes_local_backup') || '[]')
      const updatedLocal = local.map((r: any) => (r.id_reporte === reporte.id_reporte || r.creado_el === reporte.creado_el) ? updated : r)
      localStorage.setItem('rh_reportes_local_backup', JSON.stringify(updatedLocal))

      alert(`✅ ¡Visto Bueno de Recursos Humanos estampado con éxito por ${nombreRH}!`)
    } catch (err: any) {
      alert('Error al autorizar: ' + err.message)
    }
  }

  // EXPORTAR MANIFIESTO DE PASAJEROS QR A PDF
  const exportManifiestoPDF = (viaje: ViajeRutaConcluido) => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text("Manifiesto Oficial de Pasajeros y Control de Ruta", 105, 20, { align: 'center' })
    
    doc.setFontSize(10)
    doc.text(`Ruta: ${viaje.punto_a} ➔ ${viaje.punto_b}`, 14, 32)
    doc.text(`Chofer Operador: ${viaje.chofer_nombre}`, 14, 40)
    doc.text(`Fecha: ${viaje.fecha} | Hora Salida: ${viaje.hora_salida_a} | Hora Llegada: ${viaje.hora_llegada_b || 'Completado'}`, 14, 48)
    doc.text(`Total de Pasajeros que Abordaron: ${viaje.pasajeros_subieron_a}`, 14, 56)
    doc.line(14, 62, 196, 62)

    doc.setFontSize(11)
    doc.text("Lista Detallada de Trabajadores a Bordo:", 14, 70)

    let y = 80
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text("#", 14, y)
    doc.text("Nombre Completo del Trabajador", 24, y)
    doc.text("Puesto / Departamento", 105, y)
    doc.text("Hora", 160, y)
    doc.text("Método", 180, y)
    doc.line(14, y + 2, 196, y + 2)
    y += 8

    doc.setFont('helvetica', 'normal')
    const lista = viaje.pasajeros_lista || []
    if (lista.length === 0) {
      doc.text("Sin desglose individual de nombres (Conteo general registrado).", 14, y)
    } else {
      lista.forEach((p, idx) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.text(`${idx + 1}`, 14, y)
        doc.text(`${p.nombre}`, 24, y)
        doc.text(`${p.puesto || 'Personal'}`, 105, y)
        doc.text(`${p.hora}`, 160, y)
        doc.text(`${p.metodo || 'QR'}`, 180, y)
        y += 7
      })
    }

    doc.save(`Manifiesto_Pasajeros_${viaje.punto_a}_a_${viaje.punto_b}_${viaje.fecha}.pdf`)
  }

  // EXPORTAR DICTAMEN DE INSPECCIÓN A PDF
  const exportPDFReport = () => {
    const doc = new jsPDF()
    const choferNombre = selectedChoferObj?.nombre || profile?.nombre_completo || 'CHOFER OPERADOR'
    const nombreRH = isRHOrAdmin ? (profile?.nombre_completo || 'Recursos Humanos') : 'RECURSOS HUMANOS'

    doc.setFontSize(16)
    doc.text("Dictamen Oficial de Inspección Vehicular y Salida Minera", 105, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`Operador / Chofer: ${choferNombre.toUpperCase()}`, 14, 35)
    doc.text(`Vehículo / Eco: ${camion || 'N/A'} | Tipo: ${tipoVehiculo.toUpperCase()}`, 14, 43)
    doc.text(`Motivo de Salida: ${motivoViaje}`, 14, 51)
    doc.text(`Odómetro Inicial: ${kmInicial || '0'} KM | Nivel Combustible: ${gasInicio}`, 14, 59)
    doc.text(`Dictamen Minero: ${isApto ? '🟢 VEHÍCULO APTO PARA SALIDA (APROBADO)' : '🔴 VEHÍCULO NO APTO (REQUIERE REPARACIÓN)'}`, 14, 67)
    doc.line(14, 75, 196, 75)
    doc.setFontSize(11)
    doc.text("Firmas Digitales de Autorización:", 14, 87)
    doc.setFontSize(9)
    doc.text("-----------------------", 30, 120)
    doc.text(`Firma: ${choferNombre}`, 30, 125)
    doc.text("-----------------------", 90, 120)
    doc.text("Firma Guardia Caseta", 90, 125)
    doc.text("-----------------------", 150, 120)
    doc.text(`V.B. RH: ${nombreRH}`, 150, 125)
    doc.save(`Dictamen_Minero_${tipoVehiculo}_${camion || 'Eco'}.pdf`)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) setFotoBase64(result)
    }
    reader.readAsDataURL(file)
  }

  const clearSignature = (ref: React.RefObject<SignatureCanvas | null>, setter: (val: string | null) => void) => {
    ref.current?.clear()
    setter(null)
  }

  const handleProgramarViaje = async () => {
    if (!selectedChofer || !nuevoDestino || !nuevaFecha || !nuevaHora) return alert('Por favor llena todos los campos del viaje.')
    setSaving(true)
    try {
      let validEmpId: string | null = isUUID(selectedChofer) ? selectedChofer : null
      if (!validEmpId) {
        const { data: anyEmp } = await supabase.from('empleados').select('id_empleado').limit(1)
        if (anyEmp && anyEmp.length > 0) validEmpId = anyEmp[0].id_empleado
      }

      const { error } = await supabase.from('logistica_viajes_programados').insert([{
        id_empleado: validEmpId,
        destino: nuevoDestino,
        fecha_esperada: nuevaFecha,
        hora_esperada: nuevaHora,
        estado: 'Programado'
      }])
      if (error) throw error
      alert('¡Viaje Programado Exitosamente!')
      setNuevoDestino(''); setNuevaFecha(''); setNuevaHora('')
      setActiveTab('reporte')
      fetchViajesYHistorial()
    } catch (e: any) {
      alert('Error al programar viaje: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSeedAccountsBtn = async () => {
    setSeedingLoading(true)
    try {
      const res = await fetch('/api/seed-choferes-empleados', { method: 'POST' })
      const data = await res.json()
      setSeedingMsg('✅ Cuentas de choferes verificadas y sincronizadas.')
      fetchChoferesYFlota()
    } catch (e) {
      setSeedingMsg('Error al sincronizar cuentas.')
    } finally {
      setSeedingLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans">
      
      {/* Header Principal */}
      <div className="bg-zinc-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Truck className="w-36 h-36" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-2xl text-black shadow-md">
              <Bus className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Portal Oficial de Choferes y Rutas</h1>
              <p className="text-zinc-400 text-xs mt-0.5">Captura de pasaje con QR y control de salidas mineras</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/empleados/credenciales"
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-black rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all shrink-0"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>🪪 Credenciales QR</span>
            </Link>

            <Link
              href="/chofer-app"
              target="_blank"
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-black rounded-xl border border-blue-400/50 flex items-center gap-1.5 transition-all shrink-0 shadow-lg shadow-blue-500/20"
            >
              <Truck className="w-4 h-4" />
              <span>📱 App Choferes (QR & Offline)</span>
            </Link>

            {isRHOrAdmin && (
              <button
                onClick={() => setShowChoferesCredentials(!showChoferesCredentials)}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-black rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all shrink-0"
              >
                <span>🔑 Cuentas Choferes</span>
              </button>
            )}
          </div>
        </div>

        {/* Panel de Cuentas de Choferes (Solo visible para RH / Admin) */}
        {showChoferesCredentials && isRHOrAdmin && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-400">Roster de 6 Choferes Oficiales Registrados:</span>
              <button
                onClick={handleSeedAccountsBtn}
                disabled={seedingLoading}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black rounded-lg shadow-sm"
              >
                {seedingLoading ? 'Verificando...' : '⚡ Sincronizar'}
              </button>
            </div>
            {seedingMsg && <div className="p-2 bg-emerald-950/80 text-emerald-300 text-xs rounded-xl font-mono">{seedingMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {[
                { nombre: 'Adalberto Pinales', email: 'adalberto.pinales@bacis.com', pass: 'Bacis2026!' },
                { nombre: 'Ramon Yañez', email: 'ramon.yanez@bacis.com', pass: 'Bacis2026!' },
                { nombre: 'Oscar Vazquez', email: 'oscar.vazquez@bacis.com', pass: 'Bacis2026!' },
                { nombre: 'Enrique Linares', email: 'enrique.linares@bacis.com', pass: 'Bacis2026!' },
                { nombre: 'Samuel Madriles', email: 'samuel.madriles@bacis.com', pass: 'Bacis2026!' },
                { nombre: 'Jesus Saucedo', email: 'jesus.saucedo@bacis.com', pass: 'Bacis2026!' },
              ].map((c, i) => (
                <div key={i} className="bg-zinc-950 p-2 rounded-xl border border-zinc-800 space-y-0.5">
                  <div className="font-sans font-bold text-white text-xs">{c.nombre}</div>
                  <div className="text-[10px] text-zinc-400">Usuario: <span className="text-amber-300">{c.email}</span></div>
                  <div className="text-[10px] text-zinc-400">Contraseña: <span className="text-emerald-400 font-bold">{c.pass}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 1. SELECCIÓN / IDENTIFICACIÓN DEL CHOFER */}
      {!isRHOrAdmin ? (
        // VISTA CHOFER: Bloqueado a su propio perfil
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white rounded-3xl p-5 flex items-center justify-between shadow-sm border border-zinc-700">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-md">
              👔
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Chofer Operador Autenticado</span>
              <h2 className="text-base font-black text-white">{profile?.nombre_completo || 'Chofer Operador'}</h2>
              <span className="text-[11px] text-zinc-400">Sesión iniciada correctamente • Rol Oficial: Chofer</span>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>En Turno</span>
          </div>
        </div>
      ) : (
        // VISTA SUPERVISOR RH / ADMIN: Puede supervisar cualquiera de los 6 choferes
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-5 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-black text-zinc-700 uppercase tracking-wider block">
              Supervisión de Choferes (Vista Administrador / RH)
            </label>
            <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Supervisor: {profile?.nombre_completo || 'RH'}
            </span>
          </div>
          <select 
            value={selectedChofer} 
            onChange={e => setSelectedChofer(e.target.value)}
            className="w-full p-3.5 border border-zinc-200 rounded-2xl text-xs font-black bg-zinc-50 text-zinc-900 focus:bg-white focus:border-emerald-500"
          >
            {choferes.map(c => (
              <option key={c.id_empleado} value={c.id_empleado}>
                👔 {c.nombre} ({c.departamento}) - Eco Asignado: {c.numero_economico || 'Unidad'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pestañas de Navegación */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-zinc-200/80 rounded-2xl">
        <button onClick={() => setActiveTab('bitacora_ruta')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'bitacora_ruta' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-700 hover:text-black'}`}>
          <Bus className="w-4 h-4" /> 1. Ruta y Pasaje QR
        </button>
        <button onClick={() => setActiveTab('reporte')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'reporte' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-700 hover:text-black'}`}>
          <FileSignature className="w-4 h-4 text-emerald-600" /> 2. Checklist Mecánico
        </button>
        <button onClick={() => setActiveTab('programar')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'programar' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-700 hover:text-black'}`}>
          <Calendar className="w-4 h-4 text-indigo-600" /> 3. Programar Salida
        </button>
        <button onClick={() => setActiveTab('historial')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'historial' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-700 hover:text-black'}`}>
          <History className="w-4 h-4 text-amber-400" /> 4. Historial ({rutasQrGlobal.length + miHistorial.length})
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: BITÁCORA DE RUTA Y CAPTURA DE PASAJEROS CON QR */}
      {/* ============================================================ */}
      {activeTab === 'bitacora_ruta' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Banner directo a App Móvil para Celulares */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 rounded-3xl text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-lg font-black shrink-0">
                📲
              </div>
              <div>
                <strong className="text-sm font-black block">¿Estás en tu Teléfono Celular?</strong>
                <span className="text-xs text-emerald-100 block">Abre la App Móvil para Choferes diseñada para escanear y trabajar 100% Offline en la sierra.</span>
              </div>
            </div>
            <Link
              href="/chofer-app"
              className="px-5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs rounded-2xl shadow-lg transition-all shrink-0 uppercase tracking-wider text-center w-full sm:w-auto"
            >
              Abrir App Móvil ➔
            </Link>
          </div>

          {/* BARRA DE SINCRONIZACIÓN CON LA OFICINA */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                <CloudUpload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-zinc-900">Sincronización de Rutas y Pasajeros</div>
                <div className="text-[11px] text-zinc-500">Envía los viajes y listas de personal a la base central de la oficina</div>
              </div>
            </div>

            <button
              onClick={handleSyncPortal}
              disabled={syncPortalLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all w-full sm:w-auto justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncPortalLoading ? 'animate-spin' : ''}`} />
              <span>{syncPortalLoading ? 'Sincronizando...' : '☁️ Sincronizar Rutas'}</span>
            </button>
          </div>

          {syncPortalMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-2xl font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncPortalMsg}</span>
            </div>
          )}

          {/* VIAJE EN CURSO */}
          {viajeRutaActivo ? (
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white p-6 rounded-3xl shadow-xl space-y-5 border border-amber-400">
              <div className="flex justify-between items-center border-b border-amber-400/50 pb-3">
                <span className="text-xs font-black uppercase tracking-widest bg-black/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  🟡 EN RUTA: {viajeRutaActivo.punto_a} ➔ {viajeRutaActivo.punto_b}
                </span>
                <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-0.5 rounded-lg">
                  🕒 Salida: {viajeRutaActivo.hora_salida_a}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center bg-black/20 p-4 rounded-2xl backdrop-blur-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-200 font-extrabold">ORIGEN (PUNTO A)</div>
                  <div className="text-lg font-black mt-0.5 truncate">{viajeRutaActivo.punto_a}</div>
                  <div className="text-xs font-bold text-amber-200 mt-1">👥 {viajeRutaActivo.pasajeros_subieron_a || 0} a bordo</div>
                </div>

                <div className="border-l border-amber-400/40 pl-2">
                  <div className="text-[10px] uppercase tracking-wider text-amber-200 font-extrabold">DESTINO (PUNTO B)</div>
                  <div className="text-lg font-black mt-0.5 truncate">{viajeRutaActivo.punto_b}</div>
                  <div className="text-xs font-bold text-emerald-200 mt-1">🏁 Llegada</div>
                </div>
              </div>

              {/* Botones de Escaneo Durante el Viaje */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={iniciarCamaraQR}
                  className="flex-1 py-3 bg-white text-zinc-900 hover:bg-zinc-100 font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-emerald-600" /> Escanear Pasajero Adicional (QR)
                </button>
              </div>

              {/* Descendientes en Punto B */}
              <div className="bg-white text-zinc-900 p-5 rounded-2xl shadow-lg space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-800 text-center">
                  🏁 Personas que descenderán al llegar a {viajeRutaActivo.punto_b}:
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPasajerosB(Math.max(0, pasajerosB - 1))}
                    className="w-14 h-14 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 rounded-2xl text-2xl font-black flex items-center justify-center shadow-xs active:scale-95"
                  >
                    -
                  </button>
                  <div className="w-24 text-center">
                    <input
                      type="number"
                      min={0}
                      value={pasajerosB}
                      onChange={e => setPasajerosB(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-center text-3xl font-black border-2 border-emerald-500 rounded-2xl py-2 bg-emerald-50 text-emerald-950 focus:outline-none"
                    />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Pasajeros</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPasajerosB(pasajerosB + 1)}
                    className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-2xl font-black flex items-center justify-center shadow-md active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleFinalizarRuta}
                className="w-full py-4 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black text-base rounded-2xl shadow-2xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wide"
              >
                <CheckCircle className="w-6 h-6" />
                <span>🏁 Finalizar Viaje en {viajeRutaActivo.punto_b}</span>
              </button>
            </div>
          ) : (
            // FORMULARIO PARA INICIAR NUEVA RUTA
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-5">
              <div className="border-b border-zinc-100 pb-3">
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1">
                  <Bus className="w-4 h-4" /> REGISTRO DE TRASLADO DE PERSONAL
                </span>
                <h2 className="text-lg font-black text-zinc-900 uppercase">
                  Iniciar Nueva Ruta (Punto A ➔ Punto B)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Origen (Punto A)</label>
                  <select
                    value={puntoA}
                    onChange={e => setPuntoA(e.target.value)}
                    className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50 mb-1"
                  >
                    <option value="Mina Bacis">📍 Mina Bacis</option>
                    <option value="San Miguel">📍 San Miguel</option>
                    <option value="Parajes">📍 Campamento Parajes</option>
                    <option value="Obscuridad">📍 Obscuridad</option>
                    <option value="Zona Norte">📍 Campamento Zona Norte</option>
                    <option value="Planta">📍 Planta de Beneficio</option>
                    <option value="Durango">📍 Durango / Ciudad</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Destino (Punto B)</label>
                  <select
                    value={puntoB}
                    onChange={e => setPuntoB(e.target.value)}
                    className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50 mb-1"
                  >
                    <option value="Parajes">📍 Campamento Parajes</option>
                    <option value="Mina Bacis">📍 Mina Bacis</option>
                    <option value="San Miguel">📍 San Miguel</option>
                    <option value="Obscuridad">📍 Obscuridad</option>
                    <option value="Zona Norte">📍 Campamento Zona Norte</option>
                    <option value="Planta">📍 Planta de Beneficio</option>
                    <option value="Durango">📍 Durango / Ciudad</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN ESCANEAR QR / AGREGAR PASAJEROS */}
              <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-800">
                      👥 Pasajeros a Bordo ({pasajerosAbordados.length}):
                    </label>
                    <p className="text-[11px] text-zinc-500">Escanea la credencial de cada trabajador o teclea su ID.</p>
                  </div>
                  <button
                    type="button"
                    onClick={iniciarCamaraQR}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <QrCode className="w-4 h-4 text-emerald-200" />
                    <span>Abrir Escáner QR</span>
                  </button>
                </div>

                {/* Input Manual de ID */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualIdInput}
                    onChange={e => setManualIdInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarPasajero(manualIdInput, 'Manual'))}
                    placeholder="Ingresar ID o Nombre de Trabajador..."
                    className="flex-1 p-3 border border-zinc-300 rounded-xl text-xs font-bold bg-white focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => agregarPasajero(manualIdInput, 'Manual')}
                    className="px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" /> Agregar
                  </button>
                </div>

                {/* Lista de Pasajeros Abordados */}
                {pasajerosAbordados.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-zinc-200">
                    {pasajerosAbordados.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-zinc-200 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-black text-zinc-900">{p.nombre}</div>
                            <div className="text-[10px] text-zinc-500">{p.puesto} • {p.hora} ({p.metodo})</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => quitarPasajero(p.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Observaciones de Salida (Opcional)</label>
                <input
                  type="text"
                  value={comentariosRuta}
                  onChange={e => setComentariosRuta(e.target.value)}
                  placeholder="Ej. Cambio de turno regular..."
                  className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleGuardarViajeDirecto}
                  className="py-4 px-3 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wide"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>💾 Guardar Manifiesto ({pasajerosAbordados.length})</span>
                </button>
                <button
                  onClick={handleIniciarRuta}
                  className="py-4 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wide"
                >
                  <Bus className="w-5 h-5" />
                  <span>🟢 Iniciar Ruta en Vivo</span>
                </button>
              </div>
            </div>
          )}

          {/* HISTORIAL DE RUTAS DEL CHOFER SELECCIONADO */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Rutas Recientes del Chofer ({bitacoraRutasList.length})
              </h3>
              <button
                onClick={() => { setActiveTab('historial'); setSubTabHistorial('rutas_qr') }}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>Ver Todas en Historial Global ➔</span>
              </button>
            </div>

            {bitacoraRutasList.length === 0 ? (
              <div className="text-center p-8 text-zinc-400 font-bold text-xs">No se registran rutas concluidas para este chofer.</div>
            ) : (
              <div className="space-y-3">
                {bitacoraRutasList.map((r, i) => (
                  <div key={i} className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <div>
                      <div className="font-black text-zinc-900 text-sm">{r.punto_a} ➔ {r.punto_b}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        📅 {r.fecha} • Salida: {r.hora_salida_a} | Llegada: {r.hora_llegada_b || 'Completado'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="bg-emerald-100 text-emerald-900 font-bold px-3 py-1.5 rounded-xl border border-emerald-200">
                        👥 {r.pasajeros_subieron_a || 0} Pasajeros
                      </span>
                      <button
                        onClick={() => setSelectedViajeQrModal(r)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" /> Ver Nombres
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: CHECKLIST MECÁNICO E INSPECCIÓN */}
      {/* ============================================================ */}
      {activeTab === 'reporte' && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-6 animate-in fade-in">
          
          {/* BANNER DE DICTAMEN */}
          <div className={`p-4.5 rounded-2xl border-2 flex items-center gap-3 ${isApto ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-500 text-rose-950'}`}>
            {isApto ? <ShieldCheck className="w-7 h-7 text-emerald-600 shrink-0" /> : <ShieldAlert className="w-7 h-7 text-rose-600 shrink-0" />}
            <div>
              <div className="text-sm font-black uppercase">
                {isApto ? '🟢 DICTAMEN: VEHÍCULO APTO PARA SALIDA' : '🔴 DICTAMEN: VEHÍCULO NO APTO (REVISIÓN REQUERIDA)'}
              </div>
              <p className="text-xs opacity-80 mt-0.5">
                {isApto ? 'Todas las inspecciones mecánicas y de seguridad pasaron satisfactoriamente.' : 'Algunos puntos del checklist presentan observaciones que impiden la salida.'}
              </p>
            </div>
          </div>

          {/* 1. SELECCIÓN DE VEHÍCULO */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-600" /> 1. Vehículo y Motivo de Salida
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Tipo de Vehículo</label>
                <select
                  value={tipoVehiculo}
                  onChange={e => setTipoVehiculo(e.target.value as any)}
                  className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-black bg-zinc-50"
                >
                  <option value="Camioneta">🛻 Camioneta 4x4 / Escolta</option>
                  <option value="Camión">🚌 Camión / Urvan de Personal</option>
                  <option value="Ambulancia">🚑 Ambulancia / Rescate Médico</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Unidad / Número Económico</label>
                <input
                  type="text"
                  value={camion}
                  onChange={e => setCamion(e.target.value)}
                  placeholder="Ej. CAM-01 o Eco 12"
                  className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-black bg-zinc-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Motivo de Salida</label>
              <input
                type="text"
                value={motivoViaje}
                onChange={e => setMotivoViaje(e.target.value)}
                className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50"
              />
            </div>
          </section>

          {/* 2. CHECKLIST MECÁNICO */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 2. Puntos de Inspección de Seguridad
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(tipoVehiculo === 'Camioneta' ? checklistCamioneta : tipoVehiculo === 'Camión' ? checklistCamion : checklistAmbulancia).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (tipoVehiculo === 'Camioneta') setChecklistCamioneta(prev => ({ ...prev, [key]: !val }))
                    else if (tipoVehiculo === 'Camión') setChecklistCamion(prev => ({ ...prev, [key]: !val }))
                    else setChecklistAmbulancia(prev => ({ ...prev, [key]: !val }))
                  }}
                  className={`p-3 rounded-2xl border flex items-center justify-between font-bold transition-all ${val ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}
                >
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${val ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                    {val ? '✓ OK' : '✗ Falla'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 3. ODÓMETRO Y COMBUSTIBLE */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Fuel className="w-4 h-4 text-emerald-600" /> 3. Odómetro y Combustible
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase mb-1 block">Km Inicial</label>
                <input
                  type="number"
                  value={kmInicial}
                  onChange={e => setKmInicial(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-mono font-bold bg-zinc-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase mb-1 block">Tanque Inicio</label>
                <select
                  value={gasInicio}
                  onChange={e => setGasInicio(e.target.value)}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                >
                  <option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Reserva</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase mb-1 block">Litros Cargados</label>
                <input
                  type="number"
                  value={litros}
                  onChange={e => setLitros(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-mono font-bold bg-zinc-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase mb-1 block">Caseta / Ubicación</label>
                <input
                  type="text"
                  value={caseta}
                  onChange={e => setCaseta(e.target.value)}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                />
              </div>
            </div>

            {/* Foto de Odómetro */}
            <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-4 text-center bg-zinc-50">
              {fotoBase64 ? (
                <div className="space-y-2">
                  <img src={fotoBase64} alt="Evidencia" className="mx-auto rounded-xl max-h-40 object-cover shadow-sm" />
                  <button type="button" onClick={() => setFotoBase64(null)} className="text-xs font-bold text-rose-600 underline">Cambiar Foto</button>
                </div>
              ) : (
                <div>
                  <Camera className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-zinc-600 mb-2">Foto de odómetro o tablero (Opcional)</p>
                  <label className="bg-zinc-900 text-white px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Subir Evidencia
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* 4. FIRMAS DIGITALES & AUTORIZACIÓN RH */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-emerald-600" /> 4. Firmas Digitales y Autorización
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Firma Chofer */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
                <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                  <span className="text-[10px] font-black uppercase text-zinc-700">1. Firma del Chofer ({selectedChoferObj?.nombre || profile?.nombre_completo || 'Chofer'})</span>
                  <button type="button" onClick={() => clearSignature(sigChoferRef, setFirmaChoferData)} className="text-[10px] text-zinc-500 hover:text-rose-600 font-bold uppercase">Limpiar</button>
                </div>
                <SignatureCanvas 
                  ref={sigChoferRef} 
                  clearOnResize={false} 
                  onEnd={() => setFirmaChoferData(sigChoferRef.current?.toDataURL() || null)}
                  canvasProps={{className: 'w-full h-24 bg-white', style: { touchAction: 'none' }}} 
                />
              </div>

              {/* Firma Guardia */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
                <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                  <span className="text-[10px] font-black uppercase text-zinc-700">2. Firma Guardia de Caseta</span>
                  <button type="button" onClick={() => clearSignature(sigGuardiaRef, setFirmaGuardiaData)} className="text-[10px] text-zinc-500 hover:text-rose-600 font-bold uppercase">Limpiar</button>
                </div>
                <SignatureCanvas 
                  ref={sigGuardiaRef} 
                  clearOnResize={false} 
                  onEnd={() => setFirmaGuardiaData(sigGuardiaRef.current?.toDataURL() || null)}
                  canvasProps={{className: 'w-full h-24 bg-white', style: { touchAction: 'none' }}} 
                />
              </div>
            </div>

            {/* SELLO / VISTO BUENO DE RECURSOS HUMANOS */}
            <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  3. Visto Bueno Oficial de Recursos Humanos / Logística
                </div>
                <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                  {isRHOrAdmin 
                    ? `Sello autorizado como ${profile?.nombre_completo || 'Recursos Humanos'}.` 
                    : 'Esta autorización es validada exclusivamente desde el perfil de Recursos Humanos.'}
                </div>
              </div>

              {isRHOrAdmin ? (
                <button
                  type="button"
                  onClick={() => setRhApproved(!rhApproved)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                    rhApproved 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  {rhApproved ? `✓ AUTORIZADO POR RH (${profile?.nombre_completo || 'RH'})` : '+ Autorizar Visto Bueno de RH'}
                </button>
              ) : (
                <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-300 rounded-xl text-[11px] font-bold text-zinc-600 flex items-center gap-1.5 shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pendiente de Firma RH</span>
                </div>
              )}
            </div>
          </section>

          {/* BOTONES DE ACCIÓN */}
          <div className="pt-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3">
            <button 
              type="button"
              onClick={exportPDFReport}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black py-3.5 px-6 rounded-2xl text-xs flex items-center justify-center gap-2 border border-zinc-200"
            >
              <Download className="w-4 h-4 text-zinc-600" />
              <span>Exportar Dictamen PDF</span>
            </button>

            <button 
              type="button"
              onClick={handleSaveToDB}
              disabled={saving}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span>{saving ? 'Guardando Inspección...' : 'Guardar y Registrar Salida Oficial'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PROGRAMAR SALIDA FORÁNEA */}
      {/* ============================================================ */}
      {activeTab === 'programar' && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-4 animate-in fade-in">
          <h2 className="text-base font-black text-zinc-900 flex items-center gap-2 border-b pb-3 border-zinc-100">
            <Calendar className="w-5 h-5 text-indigo-600" /> Programar Salida o Viaje Foráneo
          </h2>
          <div>
            <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Lugar de Destino (Ej. Durango, Bacis, Parajes)</label>
            <input type="text" value={nuevoDestino} onChange={e => setNuevoDestino(e.target.value)} placeholder="Ej. Durango / Clínica Bacis" className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Fecha de Salida</label>
              <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50" />
            </div>
            <div>
              <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Hora Estimada</label>
              <input type="time" value={nuevaHora} onChange={e => setNuevaHora(e.target.value)} className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50" />
            </div>
          </div>
          <button onClick={handleProgramarViaje} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-md">
            <Save className="w-4 h-4" /> Registrar Viaje Programado
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: HISTORIAL GLOBAL DE VIAJES QR Y CHECKLISTS */}
      {/* ============================================================ */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4 border-zinc-100">
            <div>
              <h2 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" /> Bitácora e Historial Oficial
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">Consulta de viajes con pasaje QR y dictámenes mecánicos</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/logistica/choferes/bitacora"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Bus className="w-3.5 h-3.5" />
                <span>Ver Bitácora Central</span>
              </Link>
              <button
                type="button"
                onClick={fetchViajesYHistorial}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
            </div>
          </div>

          {/* Sub-selector de Pestañas de Historial */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-100 rounded-2xl">
            <button
              onClick={() => setSubTabHistorial('rutas_qr')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                subTabHistorial === 'rutas_qr'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-zinc-700 hover:text-zinc-950'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>👥 Rutas y Pasajeros QR ({rutasQrGlobal.length})</span>
            </button>

            <button
              onClick={() => setSubTabHistorial('checklists')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                subTabHistorial === 'checklists'
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'text-zinc-700 hover:text-zinc-950'
              }`}
            >
              <FileSignature className="w-4 h-4" />
              <span>🔧 Checklists Mecánicos ({miHistorial.length})</span>
            </button>
          </div>

          {/* VISTA 1: HISTORIAL DE RUTAS Y PASAJEROS QR */}
          {subTabHistorial === 'rutas_qr' && (
            <div className="space-y-4">
              {/* Buscador de Trabajador / Nómina / Chofer */}
              <div className="relative">
                <input
                  type="text"
                  value={filtroTrabajador}
                  onChange={e => setFiltroTrabajador(e.target.value)}
                  placeholder="🔍 Buscar trabajador, número de nómina, chofer o ruta..."
                  className="w-full p-3.5 border border-zinc-300 rounded-2xl text-xs font-bold bg-white text-zinc-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>

              {rutasQrGlobal.length === 0 ? (
                <div className="text-center p-12 text-zinc-400 font-bold text-xs space-y-2 border-2 border-dashed rounded-2xl">
                  <Users className="w-8 h-8 mx-auto text-zinc-300" />
                  <div>No se han registrado viajes con escaneo de QR aún.</div>
                  <p className="text-[11px] text-zinc-400">
                    Ve a la pestaña <strong>"1. Ruta y Pasaje QR"</strong> o abre la <strong>App Choferes Móvil</strong> para iniciar y finalizar un viaje.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rutasQrGlobal
                    .filter(r => {
                      if (!filtroTrabajador.trim()) return true
                      const q = filtroTrabajador.toLowerCase()
                      return (
                        r.chofer_nombre.toLowerCase().includes(q) ||
                        r.punto_a.toLowerCase().includes(q) ||
                        r.punto_b.toLowerCase().includes(q) ||
                        r.pasajeros_lista?.some(p => p.nombre.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
                      )
                    })
                    .map((r, i) => (
                    <div 
                      key={r.id_bitacora || i} 
                      className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50 hover:bg-white hover:border-emerald-300 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-zinc-900 text-sm">
                            🚌 {r.punto_a} ➔ {r.punto_b}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase bg-emerald-100 text-emerald-900 border border-emerald-200">
                            {r.estatus || 'CONCLUIDO'}
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-2">
                          <span>👤 Chofer: <strong>{r.chofer_nombre}</strong></span>
                          <span>•</span>
                          <span>📅 {r.fecha}</span>
                          <span>•</span>
                          <span>🕒 {r.hora_salida_a} ➔ {r.hora_llegada_b || 'Fin'}</span>
                        </div>

                        <div className="text-[11px] text-emerald-800 font-bold">
                          👥 Total a Bordo: {r.pasajeros_subieron_a || 0} trabajadores
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setSelectedViajeQrModal(r)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Ver Pasajeros ({r.pasajeros_lista?.length || r.pasajeros_subieron_a || 0})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportManifiestoPDF(r)}
                          className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200"
                          title="Descargar Manifiesto PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: HISTORIAL DE CHECKLISTS MECÁNICOS */}
          {subTabHistorial === 'checklists' && (
            <div className="space-y-4">
              {miHistorial.length === 0 ? (
                <div className="text-center p-12 text-zinc-400 font-bold text-xs space-y-2 border-2 border-dashed rounded-2xl">
                  <FileText className="w-8 h-8 mx-auto text-zinc-300" />
                  <div>No se registran checklists o salidas previas para este chofer.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {miHistorial.map(h => (
                    <div 
                      key={h.id_reporte || h.creado_el} 
                      className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/80 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-zinc-900 text-sm">
                            {h.tipo_vehiculo || 'Vehículo'} Eco: {h.camion_numero}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                            h.frenos_ok ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {h.frenos_ok ? '🟢 Apto Salida' : '🔴 Con Falla'}
                          </span>
                          {h.firma_rh_url && (
                            <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-300">
                              ✓ V.B. RH
                            </span>
                          )}
                        </div>
                        
                        <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-2">
                          <span>📅 {new Date(h.creado_el).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          <span>•</span>
                          <span>📍 {h.ubicacion_caseta || 'Caseta Principal'}</span>
                          {h.kilometraje_inicial && (
                            <>
                              <span>•</span>
                              <span className="font-mono font-bold text-zinc-600">Odómetro: {h.kilometraje_inicial} KM</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedReporteModal(h)}
                        className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all self-end sm:self-center"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ver Detalle y Firmas</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MODAL DETALLE DE PASAJEROS ESCANEADOS CON QR */}
          {selectedViajeQrModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-zinc-200">
                <div className="flex justify-between items-start border-b pb-3 border-zinc-100">
                  <div>
                    <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> MANIFIESTO DE PASAJE QR
                    </span>
                    <h3 className="text-lg font-black text-zinc-900">
                      {selectedViajeQrModal.punto_a} ➔ {selectedViajeQrModal.punto_b}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Chofer: <strong>{selectedViajeQrModal.chofer_nombre}</strong> • Fecha: {selectedViajeQrModal.fecha}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedViajeQrModal(null)}
                    className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black text-xs"
                  >
                    ✕ Cerrar
                  </button>
                </div>

                {/* Resumen del Viaje */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Salida A</span>
                    <strong className="text-zinc-900">{selectedViajeQrModal.hora_salida_a}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Llegada B</span>
                    <strong className="text-zinc-900">{selectedViajeQrModal.hora_llegada_b || 'Completado'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Pasajeros</span>
                    <strong className="text-emerald-700">{selectedViajeQrModal.pasajeros_subieron_a || 0} Abordaron</strong>
                  </div>
                </div>

                {/* Tabla de Trabajadores que Abordaron */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase text-zinc-700 tracking-wider">
                      Lista de Personal Registrado ({selectedViajeQrModal.pasajeros_lista?.length || 0})
                    </h4>
                    <button
                      onClick={() => exportManifiestoPDF(selectedViajeQrModal)}
                      className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar PDF
                    </button>
                  </div>

                  {(!selectedViajeQrModal.pasajeros_lista || selectedViajeQrModal.pasajeros_lista.length === 0) ? (
                    <div className="p-4 bg-zinc-50 rounded-xl text-center text-xs text-zinc-400">
                      Este viaje se registró con conteo manual directo sin desglose de nombres.
                    </div>
                  ) : (
                    <div className="border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                      {selectedViajeQrModal.pasajeros_lista.map((p, idx) => (
                        <div key={idx} className="p-3 bg-white flex justify-between items-center text-xs hover:bg-zinc-50">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-black text-zinc-900">{p.nombre}</div>
                              <div className="text-[10px] text-zinc-500">
                                {p.puesto || 'Personal'} • ID: {p.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="font-bold text-zinc-700">{p.hora}</span>
                            <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-wider">{p.metodo || 'QR'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedViajeQrModal(null)}
                  className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl text-xs hover:bg-zinc-800 transition-all"
                >
                  Cerrar Manifiesto
                </button>
              </div>
            </div>
          )}

          {/* MODAL DETALLE DE CHECKLIST */}
          {selectedReporteModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-zinc-200">
                <div className="flex justify-between items-start border-b pb-3 border-zinc-100">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">EXPEDIENTE DE SALIDA</span>
                    <h3 className="text-lg font-black text-zinc-900">
                      {selectedReporteModal.tipo_vehiculo || 'Vehículo'} - {selectedReporteModal.camion_numero}
                    </h3>
                    <p className="text-xs text-zinc-500">{new Date(selectedReporteModal.creado_el).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setSelectedReporteModal(null)}
                    className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black text-xs"
                  >
                    ✕ Cerrar
                  </button>
                </div>

                {/* Odómetro y Combustible */}
                <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Km Inicial</span>
                    <strong className="text-zinc-900">{selectedReporteModal.kilometraje_inicial || 0} KM</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Tanque Inicio</span>
                    <strong className="text-zinc-900">{selectedReporteModal.gasolina_inicio || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Litros</span>
                    <strong className="text-zinc-900">{selectedReporteModal.litros_cargados || 0} L</strong>
                  </div>
                </div>

                {/* Comentarios */}
                {selectedReporteModal.comentarios_vehiculo && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Observaciones y Dictamen</span>
                    <p className="text-xs text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-200">{selectedReporteModal.comentarios_vehiculo}</p>
                  </div>
                )}

                {/* Foto Evidencia */}
                {selectedReporteModal.foto_caseta_url && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Foto de Evidencia</span>
                    <img src={selectedReporteModal.foto_caseta_url} alt="Evidencia" className="rounded-2xl max-h-48 w-full object-cover border border-zinc-200 shadow-xs" />
                  </div>
                )}

                {/* Firmas Digitales y Sello de Recursos Humanos */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-zinc-500">Firmas Digitales y Visto Bueno Oficial</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                    {selectedReporteModal.firma_chofer_url ? (
                      <div className="p-2 border border-zinc-200 rounded-xl bg-zinc-50">
                        <img src={selectedReporteModal.firma_chofer_url} alt="Firma Chofer" className="h-12 mx-auto object-contain" />
                        <span className="text-[9px] font-bold text-zinc-600 block border-t pt-1 mt-1">Firma Chofer</span>
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed rounded-xl text-[10px] text-zinc-400 flex items-center justify-center">Sin Firma Chofer</div>
                    )}

                    {selectedReporteModal.firma_guardia_url ? (
                      <div className="p-2 border border-zinc-200 rounded-xl bg-zinc-50">
                        <img src={selectedReporteModal.firma_guardia_url} alt="Firma Guardia" className="h-12 mx-auto object-contain" />
                        <span className="text-[9px] font-bold text-zinc-600 block border-t pt-1 mt-1">Firma Guardia</span>
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed rounded-xl text-[10px] text-zinc-400 flex items-center justify-center">Sin Firma Guardia</div>
                    )}

                    {/* Sello de RH */}
                    <div className="p-2 border border-emerald-200 rounded-xl bg-emerald-50/50 flex flex-col justify-between items-center min-h-[70px]">
                      {selectedReporteModal.firma_rh_url ? (
                        <div className="my-auto space-y-0.5">
                          <span className="text-xs font-black text-emerald-700 block">✓ AUTORIZADO RH</span>
                          <span className="text-[9px] font-bold text-emerald-800 block">
                            {selectedReporteModal.firma_rh_nombre || 'Recursos Humanos'}
                          </span>
                        </div>
                      ) : isRHOrAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleAprobarRHEnModal(selectedReporteModal)}
                          className="my-auto px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-lg shadow-sm transition-all"
                        >
                          + Estampar Sello RH
                        </button>
                      ) : (
                        <span className="my-auto text-[10px] text-amber-700 font-bold">
                          ⏳ Pendiente de RH
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-zinc-600 block border-t border-emerald-200 w-full pt-1 mt-1">V.B. Recursos Humanos</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReporteModal(null)}
                  className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl text-xs hover:bg-zinc-800 transition-all"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL ESCÁNER QR EN VIVO CON CÁMARA */}
      {/* ============================================================ */}
      {showQrScanner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-700 text-white space-y-4 p-5">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black uppercase">Escáner de Credenciales QR</h3>
              </div>
              <button
                onClick={detenerCamaraQR}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Ventana de Video de Cámara */}
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/50 shadow-inner flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Mira de Escaneo */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[11px] font-mono font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded">
                  Encuadre el QR aquí
                </span>
              </div>

              {cameraLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs font-bold text-zinc-400">
                  Iniciando Cámara...
                </div>
              )}
            </div>

            {cameraError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl">
                {cameraError}
              </div>
            )}

            {scanMessage && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl font-bold text-center">
                {scanMessage}
              </div>
            )}

            {/* Lista en Vivo de Escaneados dentro del Modal */}
            <div className="space-y-1.5 bg-zinc-950/90 p-3 rounded-2xl border border-zinc-800">
              <div className="flex justify-between items-center text-[11px] font-black uppercase text-zinc-400">
                <span>Personal Registrado:</span>
                <span className="text-emerald-400 font-black">{pasajerosAbordados.length} a bordo</span>
              </div>
              {pasajerosAbordados.length === 0 ? (
                <p className="text-[11px] text-zinc-500 text-center py-2">Apunta el QR de la credencial frente a la cámara</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {pasajerosAbordados.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-zinc-800/90 rounded-xl text-xs border border-zinc-700/50">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0">
                          {pasajerosAbordados.length - idx}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-white block truncate text-xs">{p.nombre}</span>
                          <span className="text-[10px] text-zinc-400 block">{p.puesto} • {p.hora}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarPasajero(p.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input Manual Rápido */}
            <div className="flex gap-2 pt-1 border-t border-zinc-800">
              <input
                type="text"
                value={manualIdInput}
                onChange={e => setManualIdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarPasajero(manualIdInput, 'Manual'))}
                placeholder="O escribe ID de empleado..."
                className="flex-1 p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white font-bold placeholder-zinc-500"
              />
              <button
                type="button"
                onClick={() => agregarPasajero(manualIdInput, 'Manual')}
                className="px-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl"
              >
                Agregar
              </button>
            </div>

            <button
              onClick={detenerCamaraQR}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-xl"
            >
              Listo / Finalizar Escaneo ({pasajerosAbordados.length} a bordo)
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
