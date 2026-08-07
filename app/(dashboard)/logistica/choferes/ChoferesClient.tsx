'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Bus, Camera, Car, CheckCircle, Droplet, FileSignature, FileText, Fuel, Upload, User, Save, Download, Truck, Calendar, History, Clock, MapPin, AlertTriangle, ShieldCheck, ShieldAlert, Ambulance, Cross, Sparkles, Wrench, Radio, Stethoscope } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { jsPDF } from 'jspdf'

interface Chofer {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  departamento?: string
  puesto?: string
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

export default function ChoferesClient() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'bitacora_ruta' | 'reporte' | 'programar' | 'historial'>('bitacora_ruta')
  
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [vehiculosFlota, setVehiculosFlota] = useState<VehiculoFlota[]>([])
  const [selectedChofer, setSelectedChofer] = useState('')
  const [selectedVehiculoId, setSelectedVehiculoId] = useState('')
  const [camion, setCamion] = useState('')
  const [tipoVehiculo, setTipoVehiculo] = useState<'Camioneta' | 'Camión' | 'Ambulancia'>('Camioneta')
  const [motivoViaje, setMotivoViaje] = useState('Viaje Foráneo (Durango / Ciudad)')
  const [tipoAmbulancia, setTipoAmbulancia] = useState<'Avanzada / Soporte Vital' | 'Básica / Traslado'>('Avanzada / Soporte Vital')

  // Bitácora de Ruta (Punto A -> Punto B) State
  const [puntoA, setPuntoA] = useState('Mina Bacis')
  const [puntoB, setPuntoB] = useState('Parajes')
  const [pasajerosA, setPasajerosA] = useState<number>(1)
  const [pasajerosB, setPasajerosB] = useState<number>(1)
  const [comentariosRuta, setComentariosRuta] = useState('')

  const [viajeRutaActivo, setViajeRutaActivo] = useState<any | null>(null)
  const [bitacoraRutasList, setBitacoraRutasList] = useState<any[]>([])

  // Camera Face Scan State
  const [showFaceCameraModal, setShowFaceCameraModal] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user')
  const [capturedPasajeros, setCapturedPasajeros] = useState<Array<{ id: string, foto: string, hora: string }>>([])
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Seed Choferes state
  const [seedingLoading, setSeedingLoading] = useState(false)
  const [seedingMsg, setSeedingMsg] = useState('')
  const [showChoferesCredentials, setShowChoferesCredentials] = useState(false)
  
  // Programar Viaje State
  const [nuevoDestino, setNuevoDestino] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [misViajes, setMisViajes] = useState<Viaje[]>([])
  const [selectedViaje, setSelectedViaje] = useState('')
  const [miHistorial, setMiHistorial] = useState<any[]>([])
  
  // Mining Dynamic Checklists Specialized by Vehicle Type
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
  
  // Gas & KMs
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')
  const [gasInicio, setGasInicio] = useState('Lleno')
  const [gasFin, setGasFin] = useState('3/4')
  const [litros, setLitros] = useState('')
  
  // Caseta / Recorrido
  const [caseta, setCaseta] = useState('Caseta Durango / Bacis')
  const [obsCaseta, setObsCaseta] = useState('')
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)
  
  // Signatures Refs & Data
  const sigChoferRef = useRef<SignatureCanvas>(null)
  const sigGuardiaRef = useRef<SignatureCanvas>(null)
  const sigRHRef = useRef<SignatureCanvas>(null)
  const [firmaChoferData, setFirmaChoferData] = useState<string | null>(null)
  const [firmaGuardiaData, setFirmaGuardiaData] = useState<string | null>(null)
  const [firmaRHData, setFirmaRHData] = useState<string | null>(null)
  const [rhApproved, setRhApproved] = useState(false)

  // Loading state
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Auto-ensure choferes exist in empleados table and have correct role
    fetch('/api/seed-choferes-empleados', { method: 'POST' }).catch(() => {})
    fetch('/api/fix-choferes-roles').catch(() => {})
    fetchChoferesYFlota()
  }, [profile])

  const fetchChoferesYFlota = async () => {
    // 1. Fetch system users registered in perfiles AND empleados tables
    const [pRes, eRes] = await Promise.all([
      supabase.from('perfiles').select('id, nombre_completo, rol').order('nombre_completo'),
      supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, puesto, departamento').order('apellido_paterno')
    ])

    const pData = pRes.data || []
    const eData = eRes.data || []

    let combinedChoferes: Chofer[] = []

    const DRIVERS_ROSTER = [
      'Adalberto Pinales',
      'Ramon Yañez',
      'Oscar Vazquez',
      'Enrique Linares',
      'Samuel Madriles',
      'Jesus Saucedo'
    ]

    // Process empleados table first
    eData.forEach(e => {
      const full = `${e.nombre || ''} ${e.apellido_paterno || ''}`.trim()
      const p = (e.puesto || '').toLowerCase()
      const d = (e.departamento || '').toLowerCase()
      const isDrv = p.includes('chofer') || d.includes('movilidad') || DRIVERS_ROSTER.some(r => full.toLowerCase().includes(r.toLowerCase()))
      if (isDrv && full) {
        if (!combinedChoferes.some(c => c.nombre.toLowerCase() === full.toLowerCase())) {
          combinedChoferes.push({
            id_empleado: e.id_empleado,
            nombre: full,
            apellido_paterno: '',
            departamento: e.departamento || 'Movilidad',
            puesto: 'Chofer'
          })
        }
      }
    })

    // Process perfiles table
    pData.forEach(p => {
      const cleanName = (p.nombre_completo || '').replace(/\s*\(Chofer\)/gi, '').trim()
      const r = (p.rol || '').toLowerCase()
      const n = cleanName.toLowerCase()
      const isDrv = r.includes('chofer') || n.includes('chofer') || DRIVERS_ROSTER.some(d => n.includes(d.toLowerCase()))
      if (isDrv && cleanName) {
        if (!combinedChoferes.some(c => c.nombre.toLowerCase() === cleanName.toLowerCase())) {
          combinedChoferes.push({
            id_empleado: p.id,
            nombre: cleanName,
            apellido_paterno: '',
            departamento: 'Chofer Registrado',
            puesto: 'Chofer'
          })
        }
      }
    })

    // Fallback: Ensure all 6 roster drivers exist in array
    DRIVERS_ROSTER.forEach(dName => {
      const exists = combinedChoferes.some(c => c.nombre.toLowerCase().includes(dName.toLowerCase()))
      if (!exists) {
        combinedChoferes.push({
          id_empleado: 'CHOFER-' + dName.replace(/\s+/g, '-').toUpperCase(),
          nombre: dName,
          apellido_paterno: '',
          departamento: 'Chofer Registrado',
          puesto: 'Chofer'
        })
      }
    })

    // Always include logged-in user if missing
    if (profile?.id && !combinedChoferes.some(c => c.id_empleado === profile.id)) {
        const cleanProfileName = (profile.nombre_completo || '').replace(/\s*\(Chofer\)/gi, '').trim()
        combinedChoferes.unshift({
            id_empleado: profile.id,
            nombre: cleanProfileName,
            apellido_paterno: '',
            departamento: 'Chofer Registrado',
            puesto: profile.rol || 'Chofer'
        })
    }

    setChoferes(combinedChoferes)

    // Auto-select Adalberto Pinales or first chofer if nothing selected
    if (!selectedChofer && combinedChoferes.length > 0) {
      const adalberto = combinedChoferes.find(c => c.nombre.toLowerCase().includes('pinales'))
      setSelectedChofer(adalberto ? adalberto.id_empleado : combinedChoferes[0].id_empleado)
    }

    setChoferes(combinedChoferes)

    // Auto-select logged-in user or Adalberto Pinales by default
    if (profile?.id) {
        const matchedById = combinedChoferes.find(e => e.id_empleado === profile.id)
        if (matchedById) {
            setSelectedChofer(matchedById.id_empleado)
        } else if (combinedChoferes.length > 0) {
            setSelectedChofer(combinedChoferes[0].id_empleado)
        }
    } else if (combinedChoferes.length > 0) {
        setSelectedChofer(combinedChoferes[0].id_empleado)
    }

    // 2. Fetch official registered fleet from logistica_camiones
    const { data: cData } = await supabase
        .from('logistica_camiones')
        .select('*')
        .eq('activo', true)
        .order('numero_economico')
    
    if (cData) {
        setVehiculosFlota(cData)
    }
  }

  // Load Bitácora de Ruta from LocalStorage & Supabase when chofer changes
  useEffect(() => {
    if (!selectedChofer) return

    try {
      const storedActive = localStorage.getItem(`active_route_${selectedChofer}`)
      if (storedActive) {
        const parsed = JSON.parse(storedActive)
        setViajeRutaActivo(parsed)
        setPasajerosB(parsed.pasajeros_subieron_a || 1)
      } else {
        setViajeRutaActivo(null)
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e)
    }

    try {
      const storedHistory = localStorage.getItem(`history_routes_${selectedChofer}`)
      if (storedHistory) {
        setBitacoraRutasList(JSON.parse(storedHistory))
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e)
    }

    fetchSupabaseBitacora()
  }, [selectedChofer])

  const fetchSupabaseBitacora = async () => {
    if (!selectedChofer) return
    try {
      const { data } = await supabase
        .from('chofer_bitacora_rutas')
        .select('*')
        .eq('id_chofer', selectedChofer)
        .order('creado_el', { ascending: false })

      if (data && data.length > 0) {
        const active = data.find(r => r.estatus === 'EN_CURSO')
        if (active) {
          setViajeRutaActivo(active)
          setPasajerosB(active.pasajeros_subieron_a || 1)
        }
        setBitacoraRutasList(data)
      }
    } catch (e) {
      console.warn('Supabase bitacora fetch note:', e)
    }
  }

  const handleSeedAccountsBtn = async () => {
    setSeedingLoading(true)
    setSeedingMsg('')
    try {
      const res = await fetch('/api/seed-choferes', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear choferes')
      setSeedingMsg('¡Las 6 cuentas de choferes han sido verificadas y activadas con éxito!')
      fetchChoferesYFlota()
    } catch (err: any) {
      setSeedingMsg('Nota: ' + (err.message || 'Error de conexión'))
    } finally {
      setSeedingLoading(false)
    }
  }

  const handleFixRolesBtn = async () => {
    setSeedingLoading(true)
    setSeedingMsg('')
    try {
      const res = await fetch('/api/fix-choferes-roles', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar roles')
      setSeedingMsg('¡Roles actualizados a "Chofer" para Adalberto Pinales y los 6 operadores en la Base de Datos!')
      fetchChoferesYFlota()
    } catch (err: any) {
      setSeedingMsg('Nota: ' + (err.message || 'Error de conexión'))
    } finally {
      setSeedingLoading(false)
    }
  }

  const handleIniciarRuta = async () => {
    if (!selectedChofer) return alert('Seleccione un chofer para iniciar')
    if (!puntoA.trim() || !puntoB.trim()) return alert('Defina el Punto A (Origen) y Punto B (Destino)')
    if (pasajerosA < 0) return alert('Ingrese la cantidad de pasajeros que abordaron en Punto A')

    const choferObj = choferes.find(c => c.id_empleado === selectedChofer)
    const choferNombre = choferObj ? `${choferObj.nombre} ${choferObj.apellido_paterno || ''}`.trim() : 'Chofer'

    const now = new Date()
    const horaActual = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    const fechaActual = now.toISOString().split('T')[0]

    const newTrip = {
      id_bitacora: 'RUT-' + Date.now(),
      id_chofer: selectedChofer,
      chofer_nombre: choferNombre,
      punto_a: puntoA.toUpperCase().trim(),
      punto_b: puntoB.toUpperCase().trim(),
      hora_salida_a: horaActual,
      pasajeros_subieron_a: pasajerosA,
      pasajeros_bajaron_b: pasajerosA,
      estatus: 'EN_CURSO',
      fecha: fechaActual,
      comentarios: comentariosRuta,
      creado_el: now.toISOString()
    }

    setViajeRutaActivo(newTrip)
    setPasajerosB(pasajerosA)

    localStorage.setItem(`active_route_${selectedChofer}`, JSON.stringify(newTrip))

    try {
      await supabase.from('chofer_bitacora_rutas').insert([{
        id_chofer: selectedChofer,
        chofer_nombre: choferNombre,
        punto_a: puntoA.toUpperCase().trim(),
        punto_b: puntoB.toUpperCase().trim(),
        hora_salida_a: horaActual,
        pasajeros_subieron_a: pasajerosA,
        estatus: 'EN_CURSO',
        fecha: fechaActual,
        comentarios: comentariosRuta
      }])
    } catch (e) {
      console.warn('Supabase active trip insert note:', e)
    }
  }

  const handleFinalizarRuta = async () => {
    if (!viajeRutaActivo) return

    const now = new Date()
    const horaActual = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })

    const completedTrip = {
      ...viajeRutaActivo,
      hora_llegada_b: horaActual,
      pasajeros_bajaron_b: pasajerosB,
      estatus: 'CONCLUIDO'
    }

    setViajeRutaActivo(null)
    localStorage.removeItem(`active_route_${selectedChofer}`)

    const updatedHistory = [completedTrip, ...bitacoraRutasList]
    setBitacoraRutasList(updatedHistory)
    localStorage.setItem(`history_routes_${selectedChofer}`, JSON.stringify(updatedHistory))

    try {
      if (viajeRutaActivo.id_bitacora && !viajeRutaActivo.id_bitacora.startsWith('RUT-')) {
        await supabase.from('chofer_bitacora_rutas').update({
          hora_llegada_b: horaActual,
          pasajeros_bajaron_b: pasajerosB,
          estatus: 'CONCLUIDO'
        }).eq('id_bitacora', viajeRutaActivo.id_bitacora)
      } else {
        await supabase.from('chofer_bitacora_rutas').insert([{
          id_chofer: selectedChofer,
          chofer_nombre: viajeRutaActivo.chofer_nombre,
          punto_a: viajeRutaActivo.punto_a,
          punto_b: viajeRutaActivo.punto_b,
          hora_salida_a: viajeRutaActivo.hora_salida_a,
          hora_llegada_b: horaActual,
          pasajeros_subieron_a: viajeRutaActivo.pasajeros_subieron_a,
          pasajeros_bajaron_b: pasajerosB,
          estatus: 'CONCLUIDO',
          fecha: viajeRutaActivo.fecha,
          comentarios: viajeRutaActivo.comentarios
        }])
      }
    } catch (e) {
      console.warn('Supabase trip completion note:', e)
    }

    alert(`🏁 ¡Ruta Concluida con Éxito en ${completedTrip.punto_b}!\n\n👥 Pasajeros que abordaron en A: ${completedTrip.pasajeros_subieron_a}\n👥 Pasajeros que descendieron en B: ${pasajerosB}`)
  }

  // Camera Facial Scanner Functions
  const startFaceCamera = async () => {
    setShowFaceCameraModal(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (e: any) {
      alert('No se pudo acceder a la cámara del dispositivo: ' + (e.message || 'Permiso denegado'))
    }
  }

  const stopFaceCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setShowFaceCameraModal(false)
  }

  const toggleFacingMode = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (e: any) {
      console.warn('Camera toggle error:', e)
    }
  }

  const captureFaceScan = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const fotoBase64 = canvas.toDataURL('image/jpeg', 0.8)

      const now = new Date()
      const horaStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      const newPassenger = {
        id: 'FAC-' + Date.now(),
        foto: fotoBase64,
        hora: horaStr
      }

      setCapturedPasajeros(prev => [...prev, newPassenger])
      setPasajerosA(prev => prev + 1)

      alert('📸 ¡Rostro de trabajador escaneado y registrado! Se sumó 1 pasajero automáticamente.')
    }
  }

  // Handle Fleet Vehicle Selection with Automatic Category Switch
  const handleVehiculoSelect = (vId: string) => {
    setSelectedVehiculoId(vId)
    const v = vehiculosFlota.find(x => x.id_camion === vId)
    if (!v) return

    const numEco = (v.numero_economico || '').toUpperCase()
    setCamion(v.numero_economico)

    // Auto-detect vehicle category and set appropriate checklist & purpose
    if (numEco.includes('AMB') || numEco.includes('AMBULANCIA') || numEco.includes('MEDICO') || numEco.includes('RESCATE')) {
        setTipoVehiculo('Ambulancia')
        setMotivoViaje('Traslado Médico de Emergencia')
    } else if (numEco.includes('BUS') || numEco.includes('CAMION') || numEco.includes('RUTA') || numEco.includes('URVAN') || numEco.includes('PASAJEROS')) {
        setTipoVehiculo('Camión')
        setMotivoViaje('Ruta de Personal de Turno')
    } else {
        setTipoVehiculo('Camioneta')
        setMotivoViaje('Viaje Foráneo (Durango / Ciudad)')
    }
  }

  useEffect(() => {
    if (!selectedChofer) return
    const fetchViajes = async () => {
      const { data } = await supabase.from('logistica_viajes_programados')
        .select('*')
        .eq('id_empleado', selectedChofer)
        .in('estado', ['Programado', 'Retrasado'])
        .order('fecha_esperada', { ascending: true })
      setMisViajes(data || [])
      
      const { data: hist } = await supabase.from('logistica_reportes_diarios')
        .select('*, logistica_viajes_programados(destino)')
        .eq('id_empleado', selectedChofer)
        .order('creado_el', { ascending: false })
        .limit(10)
      setMiHistorial(hist || [])
    }
    fetchViajes()
  }, [selectedChofer, activeTab])

  // Evaluate if vehicle passes inspection
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

  const handleProgramarViaje = async () => {
    if (!selectedChofer || !nuevoDestino || !nuevaFecha || !nuevaHora) return alert('Por favor llena todos los campos del viaje.')
    setSaving(true)
    try {
        const { error } = await supabase.from('logistica_viajes_programados').insert([{
            id_empleado: selectedChofer,
            destino: nuevoDestino,
            fecha_esperada: nuevaFecha,
            hora_esperada: nuevaHora,
            estado: 'Programado'
        }])
        if (error) throw error
        alert('¡Viaje Programado Exitosamente!')
        setNuevoDestino(''); setNuevaFecha(''); setNuevaHora('')
        setActiveTab('reporte')
    } catch (e: any) {
        console.error(e)
        alert('Error al programar viaje: ' + e.message)
    } finally {
        setSaving(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (!result) return
      
      const img = new Image()
      img.onerror = () => {
        setFotoBase64(result)
      }
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 400
          const scaleSize = Math.min(1, MAX_WIDTH / (img.width || 1))
          canvas.width = Math.round((img.width || 400) * scaleSize)
          canvas.height = Math.round((img.height || 300) * scaleSize)
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            setFotoBase64(canvas.toDataURL('image/jpeg', 0.4))
          } else {
            setFotoBase64(result)
          }
        } catch (err) {
          console.warn("Canvas compression fallback:", err)
          setFotoBase64(result)
        }
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  const handleSaveToDB = async () => {
      if(!selectedChofer || !camion) {
          alert('Por favor selecciona el Chofer Operador y la Unidad/Vehículo')
          return
      }
      setSaving(true)
      try {
          // 1. Verify if selectedChofer exists in `empleados` table to satisfy Foreign Key
          let validEmpleadoId: string | null = selectedChofer
          const { data: empCheck } = await supabase.from('empleados').select('id_empleado').eq('id_empleado', selectedChofer).maybeSingle()
          
          if (!empCheck) {
              const choferObj = choferes.find(c => c.id_empleado === selectedChofer)
              if (choferObj) {
                  const { data: empMatch } = await supabase.from('empleados').select('id_empleado').ilike('nombre', `%${choferObj.nombre.split(' ')[0]}%`).limit(1)
                  if (empMatch && empMatch.length > 0) {
                      validEmpleadoId = empMatch[0].id_empleado
                  } else {
                      const { data: anyEmp } = await supabase.from('empleados').select('id_empleado').limit(1)
                      if (anyEmp && anyEmp.length > 0) {
                          validEmpleadoId = anyEmp[0].id_empleado
                      } else {
                          validEmpleadoId = null
                      }
                  }
              }
          }

          const payload: any = {
              id_empleado: validEmpleadoId,
              camion_numero: camion,
              id_viaje: (selectedViaje && selectedViaje.trim() !== '') ? selectedViaje : null,
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
              firma_rh_url: firmaRHData || (rhApproved ? 'APROBADO_RH' : null),
              tipo_vehiculo: tipoVehiculo
          }

          const { error } = await supabase.from('logistica_reportes_diarios').insert([payload])
          if (error) {
              console.warn("Error inserting report, attempting fallback:", error)
              // Retry with null id_empleado if FK error
              if (error.message?.includes('foreign key') || error.code === '23503') {
                  const { data: fallbackEmp } = await supabase.from('empleados').select('id_empleado').limit(1)
                  payload.id_empleado = fallbackEmp && fallbackEmp.length > 0 ? fallbackEmp[0].id_empleado : null
                  const retry = await supabase.from('logistica_reportes_diarios').insert([payload])
                  if (retry.error) throw retry.error
              } else {
                  throw error
              }
          }

          if (selectedViaje) {
              const viajeAsociado = misViajes.find(v => v.id_viaje === selectedViaje)
              if (viajeAsociado) {
                  const limite = new Date(`${viajeAsociado.fecha_esperada}T${viajeAsociado.hora_esperada}`)
                  const estatusFinal = new Date() > limite ? 'Completado con Retraso' : 'Completado'
                  await supabase.from('logistica_viajes_programados').update({ estado: estatusFinal }).eq('id_viaje', selectedViaje)
              }
          }
          
          alert('¡Reporte de Inspección Minera y Foto guardados exitosamente!')
          setActiveTab('historial')
          sigChoferRef.current?.clear(); setFirmaChoferData(null)
          sigGuardiaRef.current?.clear(); setFirmaGuardiaData(null)
          sigRHRef.current?.clear(); setFirmaRHData(null)
          setFotoBase64(null)
      } catch (err: any) {
          console.error(err)
          alert('Error al guardar el reporte: ' + (err.message || 'Error de conexión.'))
      } finally {
          setSaving(false)
      }
  }

  const exportPDFReport = () => {
    const doc = new jsPDF()
    const choferObj = choferes.find(c => c.id_empleado === selectedChofer)
    const choferNombre = choferObj ? `${choferObj.nombre} ${choferObj.apellido_paterno} ${choferObj.apellido_materno || ''}` : 'NO ESPECIFICADO'

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
    doc.text("Firma Operador Chofer", 30, 125)

    doc.text("-----------------------", 90, 120)
    doc.text("Firma Guardia Caseta", 90, 125)

    doc.text("-----------------------", 150, 120)
    doc.text("Visto Bueno RH / Logística", 150, 125)

    doc.save(`Dictamen_Minero_${tipoVehiculo}_${camion || 'Eco'}.pdf`)
  }

  const clearSignature = (ref: React.RefObject<SignatureCanvas | null>, setter: (val: string | null) => void) => {
      ref.current?.clear()
      setter(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 font-sans">
        
        {/* Header Principal */}
        <div className="bg-zinc-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Truck className="w-36 h-36" />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 p-2.5 rounded-2xl text-black">
                        <Bus className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Portal Oficial de Choferes y Rutas</h1>
                        <p className="text-zinc-400 text-xs mt-0.5">Captura rápida de pasajeros y tiempo en ruta (Punto A ➔ Punto B)</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowChoferesCredentials(!showChoferesCredentials)}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-black rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all shrink-0"
                >
                    <User className="w-4 h-4 text-amber-400" />
                    <span>{showChoferesCredentials ? 'Ocultar Accesos' : '🔑 Ver Cuentas Choferes'}</span>
                </button>
            </div>

            {/* CHOFERES ACCOUNTS DRAWER */}
            {showChoferesCredentials && (
                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div className="text-xs font-black text-amber-400 uppercase tracking-wider">Cuentas y Contraseñas Registradas de Choferes</div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleFixRolesBtn}
                                disabled={seedingLoading}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-lg shadow-sm transition-all"
                                title="Establecer rol 'Chofer' en perfiles de Supabase"
                            >
                                🛠️ Asignar Rol Chofer en BD
                            </button>
                            <button
                                onClick={handleSeedAccountsBtn}
                                disabled={seedingLoading}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black rounded-lg shadow-sm transition-all"
                            >
                                {seedingLoading ? 'Verificando...' : '⚡ Sincronizar Cuentas'}
                            </button>
                        </div>
                    </div>

                    {seedingMsg && (
                        <div className="p-2.5 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl font-mono">
                            {seedingMsg}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {[
                            { nombre: 'Adalberto Pinales', email: 'adalberto.pinales@bacis.com', pass: 'Bacis2026!' },
                            { nombre: 'Ramon Yañez', email: 'ramon.yanez@bacis.com', pass: 'Bacis2026!' },
                            { nombre: 'Oscar Vazquez', email: 'oscar.vazquez@bacis.com', pass: 'Bacis2026!' },
                            { nombre: 'Enrique Linares', email: 'enrique.linares@bacis.com', pass: 'Bacis2026!' },
                            { nombre: 'Samuel Madriles', email: 'samuel.madriles@bacis.com', pass: 'Bacis2026!' },
                            { nombre: 'Jesus Saucedo', email: 'jesus.saucedo@bacis.com', pass: 'Bacis2026!' },
                        ].map((c, i) => (
                            <div key={i} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-0.5">
                                <div className="font-sans font-bold text-white text-xs">{c.nombre}</div>
                                <div className="text-[10px] text-zinc-400">Usuario: <span className="text-amber-300">{c.email}</span></div>
                                <div className="text-[10px] text-zinc-400">Contraseña: <span className="text-emerald-400 font-bold">{c.pass}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* 1. Selector de Operador / Chofer */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-5 space-y-2">
            <label className="text-xs font-black text-zinc-700 uppercase tracking-wider block">1. Seleccionar Chofer / Operador Autorizado</label>
            <select 
                value={selectedChofer} onChange={e => setSelectedChofer(e.target.value)}
                className="w-full p-3.5 border border-zinc-200 rounded-2xl text-xs font-black bg-zinc-50 text-zinc-900 focus:bg-white focus:border-emerald-500"
            >
                <option value="">Seleccionar operador con rol de Chofer...</option>
                {choferes.length === 0 ? (
                    <option value="" disabled>No se encontraron usuarios asignados con el rol de Chofer</option>
                ) : (
                    choferes.map(c => (
                        <option key={c.id_empleado} value={c.id_empleado}>
                            👔 {c.nombre} {c.apellido_paterno} {c.apellido_materno || ''} ({c.puesto || 'Chofer'})
                        </option>
                    ))
                )}
            </select>
        </div>

        {/* Pestañas de Navegación */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-zinc-200/80 rounded-2xl">
            <button onClick={() => setActiveTab('bitacora_ruta')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'bitacora_ruta' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-700 hover:text-black'}`}>
                <Bus className="w-4 h-4" /> Bitácora Ruta A➔B
            </button>
            <button onClick={() => setActiveTab('reporte')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'reporte' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-700 hover:text-black'}`}>
                <FileSignature className="w-4 h-4 text-emerald-600" /> Inspección
            </button>
            <button onClick={() => setActiveTab('programar')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'programar' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-700 hover:text-black'}`}>
                <Calendar className="w-4 h-4 text-indigo-600" /> Programar
            </button>
            <button onClick={() => setActiveTab('historial')} className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'historial' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-700 hover:text-black'}`}>
                <History className="w-4 h-4 text-amber-600" /> Historial Inspección
            </button>
        </div>

        {/* TAB 0: BITÁCORA DE RUTA EN TIEMPO REAL (PUNTO A -> PUNTO B) - MOBILE FIRST */}
        {activeTab === 'bitacora_ruta' && (
            <div className="space-y-6 animate-in fade-in">
                {/* SI HAY UN VIAJE EN CURSO */}
                {viajeRutaActivo ? (
                    <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white p-6 rounded-3xl shadow-xl space-y-5 border border-amber-400">
                        <div className="flex justify-between items-center border-b border-amber-400/50 pb-3">
                            <span className="text-xs font-black uppercase tracking-widest bg-black/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                                🟡 VIAJE EN CURSO (PUNTO A ➔ PUNTO B)
                            </span>
                            <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-0.5 rounded-lg">
                                🕒 Salida: {viajeRutaActivo.hora_salida_a}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center bg-black/20 p-4 rounded-2xl backdrop-blur-xs">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-amber-200 font-extrabold">PUNTO A (ORIGEN)</div>
                                <div className="text-lg font-black mt-0.5 truncate">{viajeRutaActivo.punto_a}</div>
                                <div className="text-xs font-bold text-amber-200 mt-1">👥 {viajeRutaActivo.pasajeros_subieron_a} Subieron en A</div>
                            </div>

                            <div className="border-l border-amber-400/40 pl-2">
                                <div className="text-[10px] uppercase tracking-wider text-amber-200 font-extrabold">PUNTO B (DESTINO)</div>
                                <div className="text-lg font-black mt-0.5 truncate">{viajeRutaActivo.punto_b}</div>
                                <div className="text-xs font-bold text-emerald-200 mt-1">🏁 Rumbo a Punto B</div>
                            </div>
                        </div>

                        {/* REGISTRO DE PASAJEROS QUE BAJAN EN PUNTO B */}
                        <div className="bg-white text-zinc-900 p-5 rounded-2xl shadow-lg space-y-3">
                            <label className="block text-xs font-black uppercase tracking-wider text-zinc-800 text-center">
                                🏁 Personas que descenderán al llegar al Punto B:
                            </label>
                            
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setPasajerosB(Math.max(0, pasajerosB - 1))}
                                    className="w-14 h-14 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 rounded-2xl text-2xl font-black flex items-center justify-center shadow-xs active:scale-95 transition-transform"
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
                                    className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-2xl font-black flex items-center justify-center shadow-md active:scale-95 transition-transform"
                                >
                                    +
                                </button>
                            </div>

                            {/* Preset Buttons for Quick Touch */}
                            <div className="flex justify-center gap-2 pt-1">
                                {[1, 5, 10, 15, 20, 25].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setPasajerosB(num)}
                                        className="px-2.5 py-1 bg-zinc-100 hover:bg-emerald-100 text-zinc-800 hover:text-emerald-900 text-xs font-bold rounded-lg border border-zinc-300"
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleFinalizarRuta}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base rounded-2xl shadow-2xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wide"
                        >
                            <CheckCircle className="w-6 h-6" />
                            <span>🏁 Finalizar Viaje en Punto B ({viajeRutaActivo.punto_b})</span>
                        </button>
                    </div>
                ) : (
                    /* FORMULARIO DE INICIO DE RUTA PUNTO A -> PUNTO B */
                    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-5">
                        <div className="border-b border-zinc-100 pb-3">
                            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1">
                                <Bus className="w-4 h-4" /> REGISTRO DE RUTA DE PERSONAL (MÓVIL)
                            </span>
                            <h2 className="text-lg font-black text-zinc-900 uppercase">
                                Iniciar Nueva Ruta (Punto A ➔ Punto B)
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Punto A (Origen de Salida)</label>
                                <select
                                    value={puntoA}
                                    onChange={e => setPuntoA(e.target.value)}
                                    className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50 mb-1"
                                >
                                    <option value="Mina Bacis">📍 Mina Bacis</option>
                                    <option value="San Miguel">📍 San Miguel</option>
                                    <option value="Parajes">📍 Campamento Parajes</option>
                                    <option value="Zona Norte">📍 Campamento Zona Norte</option>
                                    <option value="Planta">📍 Planta de Beneficio</option>
                                    <option value="Durango">📍 Durango / Ciudad</option>
                                    <option value="Otro">📍 Otro Punto (Especificar a continuación)</option>
                                </select>
                                <input
                                    type="text"
                                    value={puntoA}
                                    onChange={e => setPuntoA(e.target.value)}
                                    placeholder="Escribe Origen exacto..."
                                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Punto B (Destino de Llegada)</label>
                                <select
                                    value={puntoB}
                                    onChange={e => setPuntoB(e.target.value)}
                                    className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50 mb-1"
                                >
                                    <option value="Parajes">📍 Campamento Parajes</option>
                                    <option value="San Miguel">📍 San Miguel</option>
                                    <option value="Mina Bacis">📍 Mina Bacis</option>
                                    <option value="Zona Norte">📍 Campamento Zona Norte</option>
                                    <option value="Planta">📍 Planta de Beneficio</option>
                                    <option value="Durango">📍 Durango / Ciudad</option>
                                    <option value="Otro">📍 Otro Punto (Especificar a continuación)</option>
                                </select>
                                <input
                                    type="text"
                                    value={puntoB}
                                    onChange={e => setPuntoB(e.target.value)}
                                    placeholder="Escribe Destino exacto..."
                                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* CONTADOR DE PERSONAS QUE ABORDAN EN PUNTO A */}
                        <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-3">
                            <label className="block text-xs font-black uppercase tracking-wider text-zinc-800 text-center">
                                👥 Cantidad de Personas que abordaron en Punto A ({puntoA}):
                            </label>

                            <div className="flex items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setPasajerosA(Math.max(0, pasajerosA - 1))}
                                    className="w-14 h-14 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 rounded-2xl text-2xl font-black flex items-center justify-center shadow-xs active:scale-95 transition-transform"
                                >
                                    -
                                </button>
                                
                                <div className="w-24 text-center">
                                    <input
                                        type="number"
                                        min={0}
                                        value={pasajerosA}
                                        onChange={e => setPasajerosA(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full text-center text-3xl font-black border-2 border-indigo-500 rounded-2xl py-2 bg-white text-indigo-950 focus:outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Subieron</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setPasajerosA(pasajerosA + 1)}
                                    className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-2xl font-black flex items-center justify-center shadow-md active:scale-95 transition-transform"
                                >
                                    +
                                </button>
                            </div>

                            {/* Preset Buttons for Quick Touch */}
                            <div className="flex justify-center gap-2 pt-1">
                                {[1, 5, 10, 15, 20, 25].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setPasajerosA(num)}
                                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-zinc-800 hover:text-indigo-900 text-xs font-bold rounded-lg border border-zinc-300"
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>

                            {/* FACE SCANNER BUTTON & GALLERY */}
                            <div className="pt-3 border-t border-zinc-200 text-center space-y-3">
                                <button
                                    type="button"
                                    onClick={startFaceCamera}
                                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 mx-auto transition-transform active:scale-95"
                                >
                                    <Camera className="w-4 h-4 text-amber-300" />
                                    <span>📸 Escanear Rostro de Trabajador con Cámara</span>
                                </button>

                                {capturedPasajeros.length > 0 && (
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                                            Rostros Escaneados en esta Salida ({capturedPasajeros.length}):
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
                                            {capturedPasajeros.map((p, idx) => (
                                                <div key={idx} className="relative shrink-0 w-16 text-center bg-white p-1 rounded-xl border border-purple-200 shadow-xs">
                                                    <img src={p.foto} alt="Rostro" className="w-14 h-14 object-cover rounded-lg border border-purple-300" />
                                                    <div className="text-[9px] font-mono font-bold text-zinc-700 mt-0.5">{p.hora}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Observaciones / Comentarios Específicos (Opcional)</label>
                            <input
                                type="text"
                                value={comentariosRuta}
                                onChange={e => setComentariosRuta(e.target.value)}
                                placeholder="Ej. Ruta regular de cambio de turno..."
                                className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50"
                            />
                        </div>

                        <button
                            onClick={handleIniciarRuta}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all uppercase tracking-wide"
                        >
                            <Bus className="w-6 h-6" />
                            <span>🟢 Iniciar Ruta (Salida desde Punto A)</span>
                        </button>
                    </div>
                )}

                {/* TABLA DE HISTORIAL DE RUTAS DEL CHOFER */}
                <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-4">
                    <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2 border-b pb-3 border-zinc-100">
                        <History className="w-4 h-4 text-emerald-600" />
                        Historial de Rutas Concluidas A➔B ({bitacoraRutasList.length})
                    </h3>

                    {bitacoraRutasList.length === 0 ? (
                        <div className="text-center p-8 text-zinc-400 font-bold text-xs">
                            No hay rutas concluidas aún para este chofer.
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {bitacoraRutasList.map((r, idx) => (
                                <div key={idx} className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                                    <div className="space-y-1">
                                        <div className="font-black text-zinc-900 text-sm flex items-center gap-2">
                                            <span>📍 {r.punto_a} ➔ {r.punto_b}</span>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${r.estatus === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {r.estatus || 'CONCLUIDO'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-500 font-mono">
                                            ⏱️ Salida A: {r.hora_salida_a || '-'} | Llegada B: {r.hora_llegada_b || '-'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-zinc-200 font-mono font-bold text-xs">
                                        <div className="text-indigo-700">Subieron A: <strong>{r.pasajeros_subieron_a || 0}</strong></div>
                                        <div className="text-zinc-300">|</div>
                                        <div className="text-emerald-700">Bajaron B: <strong>{r.pasajeros_bajaron_b || 0}</strong></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* TAB: PROGRAMAR VIAJE */}
        {selectedChofer && activeTab === 'programar' && (
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-4 animate-in fade-in">
                <h2 className="text-base font-black text-zinc-900 flex items-center gap-2 border-b pb-3 border-zinc-100">
                    <MapPin className="w-5 h-5 text-indigo-600" /> Programar Salida o Viaje Foráneo
                </h2>
                <div>
                    <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Lugar de Destino (Ej. Durango, Bacis, Mina)</label>
                    <input type="text" value={nuevoDestino} onChange={e => setNuevoDestino(e.target.value)} placeholder="Ej. Durango / Clinica Bacis" className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50" />
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
                <button onClick={handleProgramarViaje} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all">
                    <Save className="w-4 h-4" /> Registrar Viaje Programado
                </button>
            </div>
        )}

        {/* TAB: HISTORIAL */}
        {selectedChofer && activeTab === 'historial' && (
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-4 animate-in fade-in">
                <h2 className="text-base font-black text-zinc-900 flex items-center gap-2 border-b pb-3 border-zinc-100">
                    <History className="w-5 h-5 text-amber-600" /> Bitácora de Inspecciones y Salidas
                </h2>
                {miHistorial.length === 0 ? (
                    <div className="text-center p-8 text-zinc-400 font-bold text-xs">No se registran salidas previas para este chofer.</div>
                ) : (
                    <div className="space-y-3">
                        {miHistorial.map(h => (
                            <div key={h.id_reporte} className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50 flex justify-between items-center text-xs">
                                <div>
                                    <div className="font-black text-zinc-900">{h.tipo_vehiculo || 'Vehículo'} Eco: {h.camion_numero}</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">{new Date(h.creado_el).toLocaleString()} | {h.ubicacion_caseta}</div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase ${h.frenos_ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {h.frenos_ok ? '🟢 Apto' : '🔴 Con Falla'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* TAB: NUEVO REPORTE */}
        {selectedChofer && activeTab === 'reporte' && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 space-y-6 animate-in fade-in">
            
            {/* FIT EVALUATION BANNER */}
            <div className={`p-4.5 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                isApto 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                    : 'bg-rose-50 border-rose-500 text-rose-950 shadow-lg animate-pulse'
            }`}>
                {isApto ? (
                    <ShieldCheck className="w-7 h-7 text-emerald-600 flex-shrink-0" />
                ) : (
                    <ShieldAlert className="w-7 h-7 text-rose-600 flex-shrink-0" />
                )}
                <div>
                    <div className="font-black text-xs uppercase tracking-wider">
                        {isApto ? '🟢 VEHÍCULO EVALUADO COMO APTO PARA SALIDA EN MINA' : '🔴 ATENCIÓN: VEHÍCULO NO APTO - REQUIERE MANTENIMIENTO'}
                    </div>
                    <div className="text-[11px] font-semibold opacity-90 mt-0.5">
                        {isApto 
                            ? 'Todos los elementos de seguridad y equipamiento minero están verificados.' 
                            : 'Existen elementos de seguridad con falla. Notifica al taller o departamento de seguridad.'
                        }
                    </div>
                </div>
            </div>

            {/* 2. Seleccionar Vehículo de la Flota Oficial y Categoría */}
            <section className="space-y-4 border-b border-zinc-100 pb-5">
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" /> 2. Seleccionar Vehículo / Unidad de la Flota Minera
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Vehículo Registrado en Inventario</label>
                        <select
                            value={selectedVehiculoId}
                            onChange={e => handleVehiculoSelect(e.target.value)}
                            className="w-full p-3.5 border border-zinc-200 rounded-2xl text-xs font-black bg-zinc-50 text-zinc-900 focus:bg-white focus:border-emerald-500"
                        >
                            <option value="">Seleccionar vehículo de la flota minera...</option>
                            {vehiculosFlota.map(v => (
                                <option key={v.id_camion} value={v.id_camion}>
                                    🚛 {v.numero_economico} (Placas: {v.placas})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Visual Vehicle Category Selector Cards */}
                    <div>
                        <label className="text-xs font-black text-zinc-700 uppercase mb-2 block">Categoría de Unidad (Determina el Checklist)</label>
                        <div className="grid grid-cols-3 gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setTipoVehiculo('Camioneta')
                                    setMotivoViaje('Viaje Foráneo (Durango / Ciudad)')
                                }}
                                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                                    tipoVehiculo === 'Camioneta' 
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm' 
                                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                                }`}
                            >
                                <Car className="w-5 h-5 text-emerald-600" />
                                <span className="text-[10px] font-black uppercase text-center">🛻 Camioneta Pickup 4x4</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setTipoVehiculo('Camión')
                                    setMotivoViaje('Ruta de Personal de Turno')
                                }}
                                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                                    tipoVehiculo === 'Camión' 
                                        ? 'bg-blue-50 border-blue-500 text-blue-950 shadow-sm' 
                                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                                }`}
                            >
                                <Truck className="w-5 h-5 text-blue-600" />
                                <span className="text-[10px] font-black uppercase text-center">🚛 Camión / Autobús</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setTipoVehiculo('Ambulancia')
                                    setMotivoViaje('Traslado Médico de Emergencia')
                                }}
                                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                                    tipoVehiculo === 'Ambulancia' 
                                        ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-sm' 
                                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                                }`}
                            >
                                <Ambulance className="w-5 h-5 text-rose-600" />
                                <span className="text-[10px] font-black uppercase text-center">🚑 Ambulancia de Emergencia</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-black text-zinc-700 uppercase mb-1 block">Propósito del Viaje</label>
                        <select 
                            value={motivoViaje} 
                            onChange={e => setMotivoViaje(e.target.value)}
                            className="w-full p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50"
                        >
                            <option value="Viaje Foráneo (Durango / Ciudad)">Viaje Foráneo (Durango / Ciudad)</option>
                            <option value="Traslado Interno (Bacis / Mina)">Traslado Interno (Bacis / Mina)</option>
                            <option value="Traslado Médico de Emergencia">Traslado Médico de Emergencia</option>
                            <option value="Ruta de Personal de Turno">Ruta de Personal de Turno</option>
                            <option value="Carga de Insumos y Almacén">Carga de Insumos y Almacén</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* 3. MINING CHECKLIST SPECIFIC BY VEHICLE */}
            <section className="space-y-4 border-b border-zinc-100 pb-5">
                <div className="flex justify-between items-center bg-zinc-100 p-3 rounded-2xl border border-zinc-200">
                    <h2 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-emerald-600" /> 
                        {tipoVehiculo === 'Ambulancia' && '🚑 CHECKLIST ESPECIALIZADO DE AMBULANCIA Y SOPORTE VITAL'}
                        {tipoVehiculo === 'Camión' && '🚛 CHECKLIST ESPECIALIZADO DE CAMIÓN Y TRANSPORTE PESADO'}
                        {tipoVehiculo === 'Camioneta' && '🛻 CHECKLIST ESPECIALIZADO DE CAMIONETA PICKUP 4X4 MINA'}
                    </h2>
                    <span className="px-3 py-1 bg-white text-zinc-900 border border-zinc-300 rounded-xl font-black text-[10px] uppercase shadow-xs">
                        {tipoVehiculo}
                    </span>
                </div>

                {/* CAMIONETA CHECKLIST */}
                {tipoVehiculo === 'Camioneta' && (
                    <div className="space-y-2">
                        {[
                            { key: 'pertiga_banderola', label: '🚩 Pértiga Flexible con Banderola Reflejante (> 3m)' },
                            { key: 'torreta_seguridad', label: '🚨 Torreta de Seguridad Estroboscópica sobre Toldo' },
                            { key: 'cunas_llantas', label: '🛑 Cuñas Mecánicas de Bloqueo de Neumáticos' },
                            { key: 'radio_frecuencia_mina', label: '📻 Radio de Comunicación VHF/UHF Frecuencia Mina' },
                            { key: 'aceite_motor_agua', label: '🛢️ Niveles de Aceite de Motor, Anticongelante y Agua' },
                            { key: 'liquido_frenos_direccion', label: '⚙️ Líquido de Frenos y Dirección Hidráulica' },
                            { key: 'llantas_presion_at', label: '🛞 Neumáticos Todo Terreno (Presión AT y Grabado)' },
                            { key: 'refaccion_gato_cruceta', label: '🛞 Llanta de Refacción, Gato Hidráulico y Cruceta' },
                            { key: 'luces_faros_niebla', label: '💡 Luces Principales, Intermitentes y Faros de Niebla' },
                            { key: 'extintor_pqs_6kg', label: '🧯 Extintor PQS de 6kg Vigente (Manómetro en Verde)' },
                            { key: 'botiquin_primeros_auxilios', label: '🩹 Botiquín de Primeros Auxilios de Operación' },
                            { key: 'frenos_pie_mano', label: '🛑 Frenos Principales y Freno de Mano / Parqueo' },
                            { key: 'traccion_4x4_selector', label: '⚙️ Sistema de Doble Tracción 4x4 (Perilla/Palanca)' },
                        ].map(item => (
                            <div key={item.key} className="flex justify-between items-center p-3 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-800">
                                <span>{item.label}</span>
                                <div className="flex gap-1.5">
                                    <button 
                                        type="button"
                                        onClick={() => setChecklistCamioneta(p => ({ ...p, [item.key]: true }))}
                                        className={`px-3 py-1 rounded-xl font-black text-[10px] ${checklistCamioneta[item.key as keyof typeof checklistCamioneta] ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                                    >OK</button>
                                    <button 
                                        type="button"
                                        onClick={() => setChecklistCamioneta(p => ({ ...p, [item.key]: false }))}
                                        className={`px-3 py-1 rounded-xl font-black text-[10px] ${!checklistCamioneta[item.key as keyof typeof checklistCamioneta] ? 'bg-rose-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                                    >FALLA</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CAMION CHECKLIST */}
                {tipoVehiculo === 'Camión' && (
                    <div className="space-y-2">
                        {[
                            { key: 'frenos_aire_manometros', label: '🛑 Frenos de Aire / Manómetros de Doble Tanque (> 90 PSI)' },
                            { key: 'freno_motor_jake', label: '⚙️ Freno de Motor / Retardador (Jake Brake) para Pendientes' },
                            { key: 'salidas_emergencia_martillos', label: '🚨 Salidas de Emergencia y Martillos Rompementanas' },
                            { key: 'cunas_bloqueadoras_pesadas', label: '🛑 Cuñas Bloqueadoras de Llantas Pesadas (Par)' },
                            { key: 'luces_alarma_reversa', label: '💡 Luces completas y Alarma Sonora de Reversa' },
                            { key: 'llantas_desgaste_torque', label: '🛞 Neumáticos de Carga y Torque de Tuercas' },
                            { key: 'niveles_aceite_agua', label: '🛢️ Niveles de Aceite de Motor, Agua y Transmisión' },
                            { key: 'extintor_abc_9kg', label: '🧯 Extintor Industrial ABC de 9kg Vigente' },
                            { key: 'botiquin_ruta', label: '🩹 Botiquín de Auxilio Médico de Ruta' },
                            { key: 'torreta_toldo', label: '🚨 Torreta Giratoria / Estroboscópica sobre Toldo' },
                            { key: 'cinturones_pasajeros', label: '🔒 Cinturón de Chofer y Asientos de Trabajadores' },
                            { key: 'tacografo_limpiaparabrisas', label: '⚙️ Limpiaparabrisas, Defroster y Tacógrafo/Velocímetro' },
                        ].map(item => (
                            <div key={item.key} className="flex justify-between items-center p-3 bg-blue-50/60 rounded-2xl border border-blue-200 text-xs font-bold text-blue-950">
                                <span>{item.label}</span>
                                <div className="flex gap-1.5">
                                    <button 
                                        type="button"
                                        onClick={() => setChecklistCamion(p => ({ ...p, [item.key]: true }))}
                                        className={`px-3 py-1 rounded-xl font-black text-[10px] ${checklistCamion[item.key as keyof typeof checklistCamion] ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                                    >OK</button>
                                    <button 
                                        type="button"
                                        onClick={() => setChecklistCamion(p => ({ ...p, [item.key]: false }))}
                                        className={`px-3 py-1 rounded-xl font-black text-[10px] ${!checklistCamion[item.key as keyof typeof checklistCamion] ? 'bg-rose-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                                    >FALLA</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* AMBULANCIA MINERA CHECKLIST */}
                {tipoVehiculo === 'Ambulancia' && (
                    <div className="space-y-3">
                        <div className="bg-rose-100/70 border border-rose-300 p-3.5 rounded-2xl flex flex-wrap justify-between items-center gap-2">
                            <span className="text-xs font-black text-rose-950 uppercase flex items-center gap-1.5">
                                <Stethoscope className="w-4.5 h-4.5 text-rose-700" /> Nivel de Equipamiento Médico de la Unidad:
                            </span>
                            <select 
                                value={tipoAmbulancia}
                                onChange={e => setTipoAmbulancia(e.target.value as any)}
                                className="p-2 rounded-xl text-xs font-black bg-white text-rose-950 border border-rose-300 shadow-xs"
                            >
                                <option value="Avanzada / Soporte Vital">Soporte Vital Completo (Avanzada)</option>
                                <option value="Básica / Traslado">Traslado Básico (Estándar)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            {[
                                { key: 'motor_frenos_4x4', label: '🚑 Motor, Transmisión 4x4 y Frenos de Respuesta Rápida' },
                                { key: 'sirena_estrobos_pa', label: '🚨 Sirena de Emergencia (Wail/Yelp), Torreta y Altavoz P.A.' },
                                { key: 'tanque_combustible_lleno', label: '⛽ Tanque de Combustible Lleno (Mínimo 3/4)' },
                                { key: 'oxigeno_fijo_manometro', label: '🏥 Oxígeno Fijo: Manómetro Principal (> 1200 PSI) y Mascarillas' },
                                { key: 'oxigeno_portatil_regulador', label: '🏥 Oxígeno Portátil: Tanque de Traslado con Regulador' },
                                { key: 'camilla_principal_cinturones', label: '🏥 Camilla Principal Retráctil con Cinturones de Retención' },
                                { key: 'camilla_cuchara_scoop', label: '🏥 Camilla Marina de Rescate y Camilla de Cuchara (Scoop)' },
                                { key: 'desfibrilador_dea', label: '🏥 Desfibrilador Externo Automático (DEA) y Aspirador' },
                                { key: 'maletin_trauma_medicamentos', label: '🏥 Mochila / Maletín de Trauma y Medicamentos de Urgencia' },
                                { key: 'tabla_espinal_collarines', label: '🏥 Tabla Espinal Larga, Collarines Cervicales y Férulas' },
                                { key: 'glucometro_signos_vitales', label: '🩺 Gluciómetro, Baumanómetro y Estetoscopio de Signos Vitales' },
                                { key: 'radio_frecuencia_medica', label: '📻 Radio VHF/UHF Frecuencia Médica y de Mina' },
                            ].map(item => (
                                <div key={item.key} className="flex justify-between items-center p-3 bg-rose-50/80 rounded-2xl border border-rose-200 text-xs font-bold text-rose-950">
                                    <span>{item.label}</span>
                                    <div className="flex gap-1.5">
                                        <button 
                                            type="button"
                                            onClick={() => setChecklistAmbulancia(p => ({ ...p, [item.key]: true }))}
                                            className={`px-3 py-1 rounded-xl font-black text-[10px] ${checklistAmbulancia[item.key as keyof typeof checklistAmbulancia] ? 'bg-rose-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                                        >DISPONIBLE</button>
                                        <button 
                                            type="button"
                                            onClick={() => setChecklistAmbulancia(p => ({ ...p, [item.key]: false }))}
                                            className={`px-3 py-1 rounded-xl font-black text-[10px] ${!checklistAmbulancia[item.key as keyof typeof checklistAmbulancia] ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                                        >FALTA / FALLA</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* 4. Odómetro y Evidencia */}
            <section className="space-y-4 border-b border-zinc-100 pb-5">
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-emerald-600" /> 4. Odómetro y Evidencia Visual
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Km Inicial</label>
                        <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)} placeholder="125400" className="w-full mt-1 p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Tanque Inicial</label>
                        <select value={gasInicio} onChange={e => setGasInicio(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-2xl text-xs font-bold bg-zinc-50">
                            <option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Reserva</option>
                        </select>
                    </div>
                </div>

                <div className="border-2 border-dashed border-zinc-300 rounded-3xl p-5 text-center bg-zinc-50 mt-3">
                    {fotoBase64 ? (
                        <div className="space-y-3">
                            <img src={fotoBase64} alt="Evidencia" className="mx-auto rounded-2xl max-h-48 object-cover shadow-sm" />
                            <button type="button" onClick={() => setFotoBase64(null)} className="text-xs font-bold text-rose-600 underline">Cambiar Foto</button>
                        </div>
                    ) : (
                        <div>
                            <Camera className="w-7 h-7 text-zinc-400 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-zinc-600 mb-2">Tomar foto de tablero u odómetro</p>
                            <label className="bg-zinc-900 text-white px-5 py-2 rounded-2xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Capturar Evidencia
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. Triple Digital Signatures & RH Approval */}
            <section className="space-y-4">
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-emerald-600" /> 5. Validaciones y Firmas Digitales
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Firma Chofer */}
                    <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
                        <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                            <span className="text-[10px] font-black uppercase text-zinc-700">1. Firma del Chofer Operador</span>
                            <button type="button" onClick={() => clearSignature(sigChoferRef, setFirmaChoferData)} className="text-[10px] text-zinc-500 hover:text-rose-600 font-bold uppercase">Limpiar</button>
                        </div>
                        <SignatureCanvas 
                            ref={sigChoferRef} 
                            clearOnResize={false} 
                            onEnd={() => setFirmaChoferData(sigChoferRef.current?.toDataURL() || null)}
                            canvasProps={{className: 'w-full h-28 bg-white', style: { touchAction: 'none' }}} 
                        />
                    </div>

                    {/* Firma Guardia Caseta */}
                    <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
                        <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                            <span className="text-[10px] font-black uppercase text-zinc-700">2. Firma Guardia de Caseta</span>
                            <button type="button" onClick={() => clearSignature(sigGuardiaRef, setFirmaGuardiaData)} className="text-[10px] text-zinc-500 hover:text-rose-600 font-bold uppercase">Limpiar</button>
                        </div>
                        <SignatureCanvas 
                            ref={sigGuardiaRef} 
                            clearOnResize={false} 
                            onEnd={() => setFirmaGuardiaData(sigGuardiaRef.current?.toDataURL() || null)}
                            canvasProps={{className: 'w-full h-28 bg-white', style: { touchAction: 'none' }}} 
                        />
                    </div>
                </div>

                {/* Confirmación RH */}
                <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <div className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            3. Visto Bueno de Recursos Humanos / Logística
                        </div>
                        <div className="text-[10px] text-emerald-800 font-semibold mt-0.5">
                            Estampar sello digital de Recursos Humanos para autorizar la salida oficial.
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setRhApproved(!rhApproved)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            rhApproved 
                                ? 'bg-emerald-600 text-white shadow-md' 
                                : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        }`}
                    >
                        {rhApproved ? '✓ AUTORIZADO POR RH' : '+ Confirmar RH'}
                    </button>
                </div>
            </section>

            {/* Actions */}
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
                    {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4 text-emerald-400" />}
                    Guardar y Registrar Salida Oficial
                </button>
            </div>
        </div>
        )}

        {/* MODAL DE ESCÁNER DE ROSTRO EN VIVO CON CÁMARA */}
        {showFaceCameraModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                <div className="bg-zinc-900 text-white rounded-3xl p-6 max-w-sm w-full space-y-4 border border-zinc-800 relative shadow-2xl">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-amber-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Escáner Facial de Pasajero</span>
                        </div>
                        <button
                            type="button"
                            onClick={stopFaceCamera}
                            className="text-zinc-400 hover:text-white text-xs font-black p-1"
                        >
                            ✕ Cerrar
                        </button>
                    </div>

                    {/* LIVE CAMERA VIEW WITH FACE TARGET OVERLAY */}
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 border-2 border-indigo-500 shadow-inner flex items-center justify-center">
                        <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* FACE OVAL ALIGNMENT OVERLAY */}
                        <div className="absolute inset-0 border-4 border-dashed border-emerald-400/60 rounded-full scale-75 pointer-events-none flex items-center justify-center">
                            <span className="text-[10px] font-black uppercase text-emerald-300 bg-black/50 px-2 py-0.5 rounded-full tracking-widest animate-pulse">
                                📸 ENCUADRE ROSTRO AQUÍ
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={toggleFacingMode}
                            className="px-3 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl text-xs font-bold border border-zinc-700 flex items-center justify-center gap-1 shrink-0"
                            title="Cambiar Cámara Frontal / Trasera"
                        >
                            🔄 Cámara
                        </button>

                        <button
                            type="button"
                            onClick={captureFaceScan}
                            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-wider transform active:scale-95"
                        >
                            <Camera className="w-4 h-4" />
                            <span>Capturar Rostro (+1 Pasajero)</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}
