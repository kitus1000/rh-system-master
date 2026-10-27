'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import jsQR from 'jsqr'
import { supabase } from '@/utils/supabase/client'
import {
  parseLockerObservaciones,
  serializeLockerObservaciones,
  generarFolioResguardo,
  type LockerExtendedMeta
} from '@/utils/lockerMeta'
import {
  FolderLock, Key, Lock, AlertTriangle, CheckCircle2, User, Search,
  Phone, Building2, ShieldAlert, FileSignature, Printer, Camera, X,
  RefreshCw, ArrowRight, Check, Wrench, Info, MessageCircle, Sparkles,
  UserPlus, Edit3, ShieldCheck, BellRing
} from 'lucide-react'

interface Empleado {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  numero_empleado: number | string
  departamento?: string
  puesto?: string
  telefono?: string
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

function RegistroLockerContent() {
  const searchParams = useSearchParams()
  const lockerParam = searchParams.get('locker') || searchParams.get('codigo') || ''

  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [selectedCasillero, setSelectedCasillero] = useState<LockerCasillero | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Vista: 'selector' | 'form' | 'already_assigned' | 'success_notice'
  const [viewMode, setViewMode] = useState<'selector' | 'form' | 'already_assigned' | 'success_notice'>('selector')
  const [searchLockerCode, setSearchLockerCode] = useState(lockerParam)

  // Modo de captura de empleado: 'catalogo' | 'manual'
  const [modoCapturaEmp, setModoCapturaEmp] = useState<'catalogo' | 'manual'>('catalogo')
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null)

  // Campos del formulario
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [numeroFicha, setNumeroFicha] = useState('')
  const [puesto, setPuesto] = useState('')
  const [departamento, setDepartamento] = useState('Planta de Beneficio')
  const [telefono, setTelefono] = useState('')

  // Llave y cerradura
  const [tipoCerradura, setTipoCerradura] = useState<'Tiene Llave' | 'Candado Personal' | 'Sin Llave'>('Tiene Llave')
  const [dejaLlaveRh, setDejaLlaveRh] = useState<'Si' | 'No' | 'Ya Entregada'>('Si')
  const [numeroLlave, setNumeroLlave] = useState('')
  const [tieneDano, setTieneDano] = useState(false)
  const [descripcionDano, setDescripcionDano] = useState('')
  const [notasTrabajador, setNotasTrabajador] = useState('')
  const [aceptaReglamento, setAceptaReglamento] = useState(true)

  // Firma digital del trabajador (Canvas)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Datos guardados para la notificación final
  const [savedNoticeData, setSavedNoticeData] = useState<{
    codigo_casillero: string
    bateria: string
    posicion_nivel: string
    titular: string
    ficha: string
    puesto: string
    departamento: string
    telefono: string
    tipo_cerradura: string
    deja_llave_rh: string
    numero_llave: string
    folio_resguardo: string
    fecha_registro: string
    firma_trabajador?: string | null
  } | null>(null)

  // Escáner QR de Cámara
  const [showScanner, setShowScanner] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  // Cargar datos iniciales
  const cargarDatos = async (initialCode?: string) => {
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. Cargar catálogo de empleados
      const { data: empData } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto, telefono')
        .order('apellido_paterno', { ascending: true })

      if (empData) setEmpleados(empData)

      // 2. Cargar todos los casilleros con su módulo
      const { data: casData, error: casErr } = await supabase
        .from('lockers_casilleros')
        .select(`
          *,
          empleados:id_empleado (
            id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto, telefono
          ),
          lockers_modulos:id_modulo (
            codigo_modulo, bateria, area, tipo_modulo, ubicacion_detalle
          )
        `)
        .order('codigo_casillero', { ascending: true })

      if (casErr) throw casErr

      if (casData) {
        setCasilleros(casData)
        const targetCode = (initialCode ?? lockerParam).trim().toUpperCase()
        if (targetCode) {
          const found = casData.find(
            c => c.codigo_casillero.toUpperCase() === targetCode
          )
          if (found) {
            seleccionarCasillero(found)
          } else {
            setViewMode('selector')
          }
        } else {
          setViewMode('selector')
        }
      }
    } catch (err: any) {
      console.error('Error cargando casilleros:', err)
      setErrorMsg('No se pudo conectar con la base de datos de casilleros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const savedTel = localStorage.getItem('rh_locker_telefono')
    if (savedTel) setTelefono(savedTel)
    cargarDatos(lockerParam)
    return () => detenerCamara()
  }, [lockerParam])

  const seleccionarCasillero = (cas: LockerCasillero, forzarEdicion = false) => {
    setSelectedCasillero(cas)
    setErrorMsg('')
    const { notasLimpias, meta } = parseLockerObservaciones(cas.observaciones)

    // Pre-cargar datos existentes si los hay
    if (cas.empleados) {
      setSelectedEmpleado(cas.empleados)
      setModoCapturaEmp('catalogo')
      setNombreCompleto(`${cas.empleados.nombre} ${cas.empleados.apellido_paterno} ${cas.empleados.apellido_materno || ''}`.trim())
      setNumeroFicha(String(cas.empleados.numero_empleado || ''))
      setPuesto(cas.empleados.puesto || meta.puesto_provisional || '')
      setDepartamento(cas.empleados.departamento || meta.departamento_provisional || 'Planta de Beneficio')
      setTelefono(meta.telefono_contacto || cas.empleados.telefono || localStorage.getItem('rh_locker_telefono') || '')
    } else if (cas.nombre_provisional) {
      setSelectedEmpleado(null)
      setModoCapturaEmp('manual')
      setNombreCompleto(cas.nombre_provisional)
      setNumeroFicha(cas.numero_empleado_provisional || '')
      setPuesto(meta.puesto_provisional || '')
      setDepartamento(meta.departamento_provisional || 'Planta de Beneficio')
      setTelefono(meta.telefono_contacto || localStorage.getItem('rh_locker_telefono') || '')
    } else {
      setSelectedEmpleado(null)
      setModoCapturaEmp('catalogo')
      setNombreCompleto('')
      setNumeroFicha('')
      setPuesto('')
      setDepartamento('Planta de Beneficio')
    }

    if (cas.condicion_llave === 'Candado Personal') {
      setTipoCerradura('Candado Personal')
    } else if (cas.condicion_llave === 'Sin Llave') {
      setTipoCerradura('Sin Llave')
    } else {
      setTipoCerradura('Tiene Llave')
    }

    if (meta.deja_llave_rh === 'Si' || cas.condicion_llave === 'Copia en RH') {
      setDejaLlaveRh('Si')
    } else if (meta.deja_llave_rh === 'Ya Entregada') {
      setDejaLlaveRh('Ya Entregada')
    } else if (meta.deja_llave_rh === 'No') {
      setDejaLlaveRh('No')
    } else {
      setDejaLlaveRh('Si')
    }

    setNumeroLlave(cas.numero_llave || '')
    setTieneDano(Boolean(cas.descripcion_dano))
    setDescripcionDano(cas.descripcion_dano || '')
    setNotasTrabajador(notasLimpias || '')

    if (cas.estatus === 'Asignado' && (cas.id_empleado || cas.nombre_provisional) && !forzarEdicion) {
      setViewMode('already_assigned')
    } else {
      setViewMode('form')
    }
  }

  // Empleados filtrados para autocompletado
  const empleadosSugeridos = useMemo(() => {
    const q = searchEmp.toLowerCase().trim()
    if (!q) return []
    return empleados
      .filter(e => {
        const full = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
        const rev = `${e.apellido_paterno} ${e.apellido_materno || ''} ${e.nombre}`.toLowerCase()
        const num = String(e.numero_empleado || '')
        return full.includes(q) || rev.includes(q) || num.includes(q)
      })
      .slice(0, 8)
  }, [empleados, searchEmp])

  // Verificar si el empleado seleccionado ya tiene otro casillero
  const otroCasilleroDelEmpleado = useMemo(() => {
    if (!selectedCasillero) return null
    if (selectedEmpleado) {
      return casilleros.find(
        c => c.id_empleado === selectedEmpleado.id_empleado && c.id_casillero !== selectedCasillero.id_casillero
      ) || null
    }
    if (modoCapturaEmp === 'manual' && numeroFicha.trim().length >= 2) {
      return casilleros.find(
        c =>
          c.id_casillero !== selectedCasillero.id_casillero &&
          (String(c.empleados?.numero_empleado || '') === numeroFicha.trim() ||
            String(c.numero_empleado_provisional || '') === numeroFicha.trim())
      ) || null
    }
    return null
  }, [casilleros, selectedEmpleado, selectedCasillero, modoCapturaEmp, numeroFicha])

  // Funciones de Firma Digital (Canvas)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.strokeStyle = '#18181b'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setIsDrawing(true)
    setHasSignature(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  // Sonido de confirmación al registrar
  const reproducirSonidoExito = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12) // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.45)
    } catch {}
  }

  // Guardar formulario de autorregistro QR
  const handleSubmitRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCasillero) return

    const finalName = selectedEmpleado
      ? `${selectedEmpleado.apellido_paterno} ${selectedEmpleado.apellido_materno || ''} ${selectedEmpleado.nombre}`.trim()
      : nombreCompleto.trim()

    if (!finalName) {
      setErrorMsg('Por favor selecciona tu nombre del catálogo o escríbelo completo.')
      return
    }

    if (!aceptaReglamento) {
      setErrorMsg('Debes aceptar el compromiso de uso y resguardo del casillero.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    try {
      const existingParsed = parseLockerObservaciones(selectedCasillero.observaciones)
      const folio = existingParsed.meta.folio_resguardo || generarFolioResguardo(selectedCasillero.codigo_casillero)

      let firmaDataUrl: string | null = existingParsed.meta.firma_trabajador || null
      if (hasSignature && canvasRef.current) {
        firmaDataUrl = canvasRef.current.toDataURL('image/png')
      }

      const cleanTel = telefono.replace(/\D/g, '')
      if (cleanTel) {
        localStorage.setItem('rh_locker_telefono', cleanTel)
      }

      // Determinar condicion_llave compatible con el sistema principal
      let condicionLlaveFinal: string = tipoCerradura
      if (dejaLlaveRh === 'Si' || dejaLlaveRh === 'Ya Entregada') {
        if (tipoCerradura === 'Tiene Llave') {
          condicionLlaveFinal = 'Copia en RH'
        }
      }

      const newMeta: LockerExtendedMeta = {
        ...existingParsed.meta,
        deja_llave_rh: dejaLlaveRh,
        estatus_resguardo: existingParsed.meta.estatus_resguardo === 'Firmado' ? 'Firmado' : 'Pendiente Firma en RH',
        folio_resguardo: folio,
        telefono_contacto: cleanTel || undefined,
        puesto_provisional: puesto.trim() || selectedEmpleado?.puesto || undefined,
        departamento_provisional: departamento.trim() || selectedEmpleado?.departamento || 'Planta de Beneficio',
        firma_trabajador: firmaDataUrl,
        fecha_registro_qr: new Date().toISOString(),
        origen_registro: 'QR Trabajador'
      }

      const observacionesSerializadas = serializeLockerObservaciones(notasTrabajador, newMeta)

      const payload = {
        estatus: 'Asignado' as const,
        id_empleado: selectedEmpleado ? selectedEmpleado.id_empleado : null,
        nombre_provisional: selectedEmpleado ? null : finalName,
        numero_empleado_provisional: selectedEmpleado ? null : (numeroFicha.trim() || null),
        condicion_llave: condicionLlaveFinal,
        numero_llave: numeroLlave.trim() || null,
        descripcion_dano: tieneDano && descripcionDano.trim() ? descripcionDano.trim() : null,
        observaciones: observacionesSerializadas,
        fecha_asignacion: selectedCasillero.fecha_asignacion || new Date().toISOString(),
        actualizado_el: new Date().toISOString()
      }

      const { error } = await supabase
        .from('lockers_casilleros')
        .update(payload)
        .eq('id_casillero', selectedCasillero.id_casillero)

      if (error) throw error

      reproducirSonidoExito()
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 80, 150])
      }

      setSavedNoticeData({
        codigo_casillero: selectedCasillero.codigo_casillero,
        bateria: selectedCasillero.lockers_modulos?.bateria || 'Vestidor Planta de Beneficio',
        posicion_nivel: selectedCasillero.posicion_nivel,
        titular: finalName,
        ficha: selectedEmpleado ? String(selectedEmpleado.numero_empleado) : (numeroFicha.trim() || 'S/N'),
        puesto: puesto.trim() || selectedEmpleado?.puesto || 'Operativo',
        departamento: departamento.trim() || selectedEmpleado?.departamento || 'Planta de Beneficio',
        telefono: cleanTel,
        tipo_cerradura: tipoCerradura,
        deja_llave_rh:
          dejaLlaveRh === 'Si'
            ? 'SÍ DEJARÁ COPIA DE LLAVE EN RH'
            : dejaLlaveRh === 'Ya Entregada'
            ? 'YA ENTREGÓ COPIA EN RH'
            : 'NO DEJA COPIA DE LLAVE',
        numero_llave: numeroLlave.trim() || 'N/A',
        folio_resguardo: folio,
        fecha_registro: new Date().toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }),
        firma_trabajador: firmaDataUrl
      })

      setViewMode('success_notice')
      await cargarDatos(selectedCasillero.codigo_casillero)
    } catch (err: any) {
      console.error('Error guardando registro de casillero:', err)
      setErrorMsg('Ocurrió un error al guardar tu registro: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  // Escáner de cámara con jsQR + BarcodeDetector (100% compatible iOS Safari y Android)
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
      setCameraError('No se pudo abrir la cámara. Verifica los permisos de tu navegador o selecciona el código manualmente.')
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

  const procesarTextoQR = (rawText: string): boolean => {
    const clean = rawText.trim()
    if (!clean) return false

    // Puede venir como URL (?locker=PB-M01-A) o como código directo (PB-M01-A)
    let codeCandidate = clean
    try {
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        const urlObj = new URL(clean)
        const param = urlObj.searchParams.get('locker') || urlObj.searchParams.get('codigo')
        if (param) codeCandidate = param
      }
    } catch {}

    const found = casilleros.find(
      c =>
        c.codigo_casillero.toLowerCase() === codeCandidate.toLowerCase() ||
        clean.toUpperCase().includes(c.codigo_casillero.toUpperCase())
    )

    if (found) {
      detenerCamara()
      seleccionarCasillero(found)
      return true
    }
    return false
  }

  const bucleEscaneo = () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = qrCanvasRef.current
      if (canvas) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          })
          if (code && code.data) {
            if (procesarTextoQR(code.data)) return
          }
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(bucleEscaneo)
  }

  const casillerosFiltradosSelector = useMemo(() => {
    const q = searchLockerCode.trim().toLowerCase()
    if (!q) return casilleros
    return casilleros.filter(c => {
      const cod = c.codigo_casillero.toLowerCase()
      const bat = (c.lockers_modulos?.bateria || '').toLowerCase()
      return cod.includes(q) || bat.includes(q)
    })
  }, [casilleros, searchLockerCode])

  const currentMeta = useMemo(() => {
    return parseLockerObservaciones(selectedCasillero?.observaciones)
  }, [selectedCasillero])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="font-black text-base tracking-wide uppercase">Cargando Portal de Casilleros RH...</p>
        <p className="text-xs text-zinc-400 mt-1">Minas de Bacis · Planta de Beneficio</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between pb-16">
      {/* Canvas oculto para decodificar QR con jsQR */}
      <canvas ref={qrCanvasRef} className="hidden" />

      {/* Header Oficial */}
      <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md py-3.5 px-4 sm:px-6 sticky top-0 z-30 print:hidden">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block leading-none">
                MINAS DE BACIS · RECURSOS HUMANOS
              </span>
              <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight mt-0.5">
                Registro y Resguardo de Casillero QR
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedCasillero(null)
              setViewMode('selector')
            }}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition-all"
          >
            Cambiar Locker
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Banner del Casillero Seleccionado */}
        {selectedCasillero && (
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl print:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  {selectedCasillero.lockers_modulos?.area || 'Planta de Beneficio'} · {selectedCasillero.lockers_modulos?.bateria || 'Vestidor'}
                </span>
                <div className="flex items-baseline gap-2.5 mt-0.5">
                  <h2 className="text-3xl font-black font-mono text-white tracking-tight">
                    {selectedCasillero.codigo_casillero}
                  </h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-amber-300 border border-zinc-700">
                    Nivel: {selectedCasillero.posicion_nivel}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                    selectedCasillero.estatus === 'Disponible'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : selectedCasillero.estatus === 'Asignado'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {selectedCasillero.estatus}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VISTA 1: SELECTOR DE CASILLERO (SI ENTRÓ SIN ?locker= EN LA URL)  */}
        {/* ================================================================= */}
        {viewMode === 'selector' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-white uppercase">
                  Selecciona o Escanea tu Casillero
                </h2>
                <p className="text-xs text-zinc-400">
                  Escanea el código QR pegado en la puerta de tu locker o búscalo por su código (ej. PB-M01-A).
                </p>
              </div>
              <button
                type="button"
                onClick={iniciarCamara}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Escanear QR</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar casillero (ej. PB-M01-A, M15, Batería 2)..."
                value={searchLockerCode}
                onChange={(e) => setSearchLockerCode(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="max-h-96 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
              {casillerosFiltradosSelector.map(c => {
                const libre = c.estatus === 'Disponible'
                const asignado = c.estatus === 'Asignado'
                const empNombre = c.empleados
                  ? `${c.empleados.apellido_paterno} ${c.empleados.nombre.split(' ')[0]}`
                  : c.nombre_provisional

                return (
                  <button
                    key={c.id_casillero}
                    type="button"
                    onClick={() => seleccionarCasillero(c)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      libre
                        ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400'
                        : asignado
                        ? 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400'
                        : 'bg-zinc-800/60 border-zinc-700 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-white">
                        {c.codigo_casillero}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {c.posicion_nivel}
                      </span>
                    </div>
                    <div className="mt-1.5 truncate">
                      {empNombre ? (
                        <span className="text-[11px] font-bold text-sky-300 truncate block">
                          👤 {empNombre}
                        </span>
                      ) : libre ? (
                        <span className="text-[11px] font-bold text-emerald-400">
                          🟢 Disponible
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-400">
                          {c.estatus}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VISTA 2: CASILLERO YA ASIGNADO (ESTATUS Y AVISO DE RESGUARDO)     */}
        {/* ================================================================= */}
        {viewMode === 'already_assigned' && selectedCasillero && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5 shadow-xl">
            {/* Banner de estado del resguardo */}
            {currentMeta.meta.estatus_resguardo === 'Firmado' ? (
              <div className="bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-sm text-emerald-300 uppercase">
                    ✅ Resguardo Oficial Firmado en Recursos Humanos
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Este casillero cuenta con su carta responsiva de resguardo validada por RH
                    {currentMeta.meta.nombre_rh_firma ? ` (${currentMeta.meta.nombre_rh_firma})` : ''}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/15 border-2 border-amber-500 rounded-2xl p-4 space-y-2 animate-pulse">
                <div className="flex items-start gap-3">
                  <BellRing className="w-7 h-7 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-amber-300 uppercase leading-snug">
                      ⚠️ AVISO IMPORTANTE: DEBES PASAR A RECURSOS HUMANOS A FIRMAR TU RESGUARDO
                    </h3>
                    <p className="text-xs text-zinc-200 mt-1 leading-relaxed">
                      Tu casillero <strong>{selectedCasillero.codigo_casillero}</strong> ya tiene tus datos registrados, pero{' '}
                      <strong className="text-amber-300 underline">
                        es obligatorio acudir a la oficina de Recursos Humanos para firmar el formato de resguardo oficial
                      </strong>{' '}
                      {currentMeta.meta.deja_llave_rh === 'Si'
                        ? 'y entregar el duplicado de tu llave.'
                        : 'para formalizar tu asignación.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen de datos del titular actual */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400 font-bold uppercase">Folio de Resguardo:</span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  {currentMeta.meta.folio_resguardo || `RES-${selectedCasillero.codigo_casillero}`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Trabajador Titular</span>
                  <span className="font-black text-white text-sm uppercase">
                    {selectedCasillero.empleados
                      ? `${selectedCasillero.empleados.apellido_paterno} ${selectedCasillero.empleados.apellido_materno || ''} ${selectedCasillero.empleados.nombre}`
                      : selectedCasillero.nombre_provisional}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Número de Ficha</span>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    #{selectedCasillero.empleados?.numero_empleado || selectedCasillero.numero_empleado_provisional || 'S/N'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Cerradura / Candado</span>
                  <span className="font-bold text-zinc-200">
                    {selectedCasillero.condicion_llave || 'No especificado'}
                    {selectedCasillero.numero_llave ? ` (Llave #${selectedCasillero.numero_llave})` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">¿Deja Copia de Llave en RH?</span>
                  <span className={`font-black ${
                    currentMeta.meta.deja_llave_rh === 'Si' || currentMeta.meta.deja_llave_rh === 'Ya Entregada' || selectedCasillero.condicion_llave === 'Copia en RH'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}>
                    {currentMeta.meta.deja_llave_rh === 'Si'
                      ? 'SÍ DEJARÁ COPIA EN RH'
                      : currentMeta.meta.deja_llave_rh === 'Ya Entregada' || selectedCasillero.condicion_llave === 'Copia en RH'
                      ? 'COPIA ENTREGADA EN RH'
                      : 'NO DEJA COPIA'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => seleccionarCasillero(selectedCasillero, true)}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Edit3 className="w-4 h-4" />
                <span>Actualizar mis Datos / Llave o Firmar</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 border border-zinc-700"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Imprimir Ficha</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VISTA 3: FORMULARIO DE REGISTRO Y CONDICIÓN DE LLAVE              */}
        {/* ================================================================= */}
        {viewMode === 'form' && selectedCasillero && (
          <form onSubmit={handleSubmitRegistro} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-6 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-amber-400" />
                Formulario de Asignación y Resguardo
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Completa tus datos para registrar tu casillero <strong>{selectedCasillero.codigo_casillero}</strong> e indica si dejarás copia de llave en Recursos Humanos.
              </p>
            </div>

            {/* SECCIÓN 1: DATOS DEL TRABAJADOR */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  1. Datos del Trabajador
                </label>

                <button
                  type="button"
                  onClick={() => {
                    if (modoCapturaEmp === 'catalogo') {
                      setModoCapturaEmp('manual')
                      setSelectedEmpleado(null)
                    } else {
                      setModoCapturaEmp('catalogo')
                    }
                  }}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {modoCapturaEmp === 'catalogo' ? '¿No apareces? Escribir manual' : 'Buscar en lista de personal'}
                </button>
              </div>

              {modoCapturaEmp === 'catalogo' ? (
                <div className="space-y-2.5">
                  {selectedEmpleado ? (
                    <div className="p-3.5 bg-sky-500/15 border border-sky-500/40 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-black text-sm text-white uppercase">
                          {selectedEmpleado.apellido_paterno} {selectedEmpleado.apellido_materno || ''} {selectedEmpleado.nombre}
                        </p>
                        <p className="text-xs text-sky-300 font-semibold">
                          Ficha #{selectedEmpleado.numero_empleado} · {selectedEmpleado.puesto || selectedEmpleado.departamento || 'Planta de Beneficio'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmpleado(null)
                          setNombreCompleto('')
                          setNumeroFicha('')
                        }}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        title="Cambiar trabajador"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          placeholder="Escribe tu apellido, nombre o número de ficha..."
                          value={searchEmp}
                          onChange={(e) => setSearchEmp(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {empleadosSugeridos.length > 0 && (
                        <div className="bg-zinc-950 border border-zinc-700 rounded-xl divide-y divide-zinc-800 max-h-48 overflow-y-auto">
                          {empleadosSugeridos.map(emp => (
                            <button
                              key={emp.id_empleado}
                              type="button"
                              onClick={() => {
                                setSelectedEmpleado(emp)
                                setNombreCompleto(`${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.nombre}`.trim())
                                setNumeroFicha(String(emp.numero_empleado || ''))
                                setPuesto(emp.puesto || '')
                                setDepartamento(emp.departamento || 'Planta de Beneficio')
                                if (emp.telefono && !telefono) setTelefono(emp.telefono)
                                setSearchEmp('')
                              }}
                              className="w-full text-left p-2.5 hover:bg-amber-500/15 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <p className="font-black text-xs text-white uppercase">
                                  {emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombre}
                                </p>
                                <p className="text-[11px] text-zinc-400">
                                  Ficha #{emp.numero_empleado} · {emp.puesto || emp.departamento}
                                </p>
                              </div>
                              <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                                Seleccionar
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <p className="text-[11px] text-zinc-400">
                        💡 Si eres de nuevo ingreso o aún no apareces en el buscador, toca{' '}
                        <button
                          type="button"
                          onClick={() => setModoCapturaEmp('manual')}
                          className="text-amber-400 underline font-bold"
                        >
                          Escribir mi nombre manualmente
                        </button>
                        .
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                      Nombre Completo (Empezando por Apellidos) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. PÉREZ LÓPEZ JUAN CARLOS"
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm font-bold text-white uppercase focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                        Núm. de Ficha / Nómina
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. 1042"
                        value={numeroFicha}
                        onChange={(e) => setNumeroFicha(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                        Puesto / Categoría
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Molinos / Flotación"
                        value={puesto}
                        onChange={(e) => setPuesto(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Alerta si ya tiene otro casillero asignado */}
              {otroCasilleroDelEmpleado && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Nota:</strong> Ya apareces registrado en el casillero{' '}
                    <strong className="font-mono text-white">{otroCasilleroDelEmpleado.codigo_casillero}</strong>. RH revisará si compartes turno o si es cambio de casillero.
                  </span>
                </div>
              )}

              {/* Teléfono / WhatsApp */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                  Teléfono Celular / WhatsApp (10 dígitos) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="Ej. 6181234567"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Se usará para enviarte avisos sobre tu resguardo de casillero en RH.
                </span>
              </div>
            </div>

            {/* SECCIÓN 2: CONTROL DE LLAVE Y COPIA EN RH */}
            <div className="space-y-4 pt-3 border-t border-zinc-800">
              <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                2. Control de Llave y Resguardo en RH
              </label>

              <div>
                <span className="text-xs font-bold text-zinc-300 block mb-2">
                  ¿Con qué cierras tu casillero?
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Tiene Llave', label: '🔑 Llave / Chapa', desc: 'Cerradura integrada' },
                    { id: 'Candado Personal', label: '🔒 Candado Propio', desc: 'Candado externo' },
                    { id: 'Sin Llave', label: '⚠️ Sin Llave', desc: 'Falta cerradura' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTipoCerradura(item.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        tipoCerradura === item.id
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <span className="text-xs font-black block">{item.label}</span>
                      <span className="text-[9px] opacity-75 block mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* PREGUNTA EXPLÍCITA: ¿VAS A DEJAR COPIA DE LLAVE EN RH? */}
              <div className="bg-zinc-950 p-4 rounded-2xl border-2 border-amber-500/30 space-y-2.5">
                <span className="text-xs font-black uppercase text-white block">
                  🏛️ ¿Vas a dejar copia de tu llave en Recursos Humanos? *
                </span>
                <p className="text-[11px] text-zinc-400">
                  Indica si entregarás un duplicado de tu llave en RH para respaldo en caso de extravío o emergencia.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDejaLlaveRh('Si')}
                    className={`p-3 rounded-xl border text-left sm:text-center transition-all ${
                      dejaLlaveRh === 'Si'
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 font-bold'
                    }`}
                  >
                    <span className="text-xs block">✅ SÍ, dejaré llave en RH</span>
                    <span className="text-[10px] opacity-80 block mt-0.5">La entregaré al firmar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDejaLlaveRh('No')}
                    className={`p-3 rounded-xl border text-left sm:text-center transition-all ${
                      dejaLlaveRh === 'No'
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 font-bold'
                    }`}
                  >
                    <span className="text-xs block">❌ NO dejaré copia</span>
                    <span className="text-[10px] opacity-80 block mt-0.5">Solo yo tengo llave</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDejaLlaveRh('Ya Entregada')}
                    className={`p-3 rounded-xl border text-left sm:text-center transition-all ${
                      dejaLlaveRh === 'Ya Entregada'
                        ? 'bg-sky-500 text-zinc-950 border-sky-400 font-black shadow-lg shadow-sky-500/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 font-bold'
                    }`}
                  >
                    <span className="text-xs block">🏛️ YA entregué copia</span>
                    <span className="text-[10px] opacity-80 block mt-0.5">Ya está en RH</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                    Número o código en la llave (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Llave #24, Master..."
                    value={numeroLlave}
                    onChange={(e) => setNumeroLlave(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                    ¿El casillero tiene algún daño físico?
                  </label>
                  <button
                    type="button"
                    onClick={() => setTieneDano(!tieneDano)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      tieneDano
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-emerald-400'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{tieneDano ? '⚠️ Sí, reportar detalle físico' : '🟢 En buen estado físico'}</span>
                  </button>
                </div>
              </div>

              {tieneDano && (
                <div>
                  <input
                    type="text"
                    placeholder="Describe el daño (ej. bisagra floja, puerta golpeada, chapa dura)..."
                    value={descripcionDano}
                    onChange={(e) => setDescripcionDano(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-white"
                  />
                </div>
              )}
            </div>

            {/* SECCIÓN 3: PRE-FIRMA EN PANTALLA Y COMPROMISO */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4" />
                  3. Pre-Firma Digital de Conformidad (Con tu dedo)
                </label>
                <button
                  type="button"
                  onClick={limpiarFirma}
                  className="text-[11px] font-bold text-zinc-400 hover:text-white underline"
                >
                  Limpiar firma
                </button>
              </div>

              <div className="bg-white rounded-xl p-1 border-2 border-zinc-700">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={110}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[110px] touch-none cursor-crosshair bg-white rounded-lg"
                />
              </div>
              <p className="text-[10px] text-zinc-400">
                ✍️ Firma dentro del recuadro blanco. <strong>Recuerda que al terminar deberás pasar a Recursos Humanos a firmar el resguardo oficial.</strong>
              </p>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aceptaReglamento}
                  onChange={(e) => setAceptaReglamento(e.target.checked)}
                  className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="text-[11px] text-zinc-300 leading-relaxed">
                  Me comprometo a mantener este casillero limpio, en buen estado, no guardar objetos prohibidos y{' '}
                  <strong className="text-amber-300">acudir a Recursos Humanos a firmar mi hoja de resguardo oficial</strong>.
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm uppercase tracking-wide shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando Registro...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Registrar Casillero y Generar Folio de Resguardo</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* VISTA 4: NOTIFICACIÓN AL TRABAJADOR ("PASAR A RH A FIRMAR")       */}
        {/* ================================================================= */}
        {viewMode === 'success_notice' && savedNoticeData && (
          <div className="space-y-5 animate-in zoom-in-95 duration-300">
            {/* Alerta Grande Obligatoria */}
            <div className="bg-gradient-to-br from-amber-500 via-amber-500 to-orange-500 text-zinc-950 p-5 sm:p-6 rounded-3xl shadow-2xl border-2 border-white/30 space-y-3 print:border-2 print:border-black">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-zinc-950 text-amber-400 shrink-0">
                  <BellRing className="w-7 h-7 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-950 text-amber-400 px-2.5 py-0.5 rounded-full">
                    AVISO OFICIAL DE RECURSOS HUMANOS
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black uppercase leading-tight mt-1">
                    ¡Debes pasar a RH a firmar tu Resguardo!
                  </h2>
                </div>
              </div>

              <div className="bg-white/90 text-zinc-950 p-4 rounded-2xl border border-zinc-900/20 space-y-2 text-xs sm:text-sm font-bold leading-relaxed">
                <p>
                  ✅ Tu casillero <strong className="font-mono text-base underline">{savedNoticeData.codigo_casillero}</strong> ha quedado pre-registrado a nombre de{' '}
                  <strong className="uppercase">{savedNoticeData.titular}</strong>.
                </p>
                <p className="text-rose-800 font-black">
                  ⚠️ PASO OBLIGATORIO: Acude a la oficina de Recursos Humanos mostrando este folio ({savedNoticeData.folio_resguardo}) para FIRMAR TU HOJA DE RESGUARDO OFICIAL
                  {savedNoticeData.deja_llave_rh.includes('SÍ') ? ' y ENTREGAR LA COPIA DE TU LLAVE.' : '.'}
                </p>
              </div>
            </div>

            {/* Comprobante Imprimible / Capturable */}
            <div className="bg-white text-zinc-900 rounded-2xl border-2 border-zinc-800 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    MINAS DE BACIS · PLANTA DE BENEFICIO
                  </p>
                  <h3 className="text-base font-black uppercase text-zinc-950">
                    Pase para Firma de Resguardo en RH
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">FOLIO</span>
                  <span className="font-mono font-black text-sm bg-zinc-900 text-amber-400 px-2.5 py-1 rounded-lg">
                    {savedNoticeData.folio_resguardo}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-zinc-100 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Casillero Asignado</span>
                  <span className="font-mono font-black text-xl text-zinc-950">{savedNoticeData.codigo_casillero}</span>
                  <span className="text-[10px] font-semibold text-zinc-600 block">
                    {savedNoticeData.bateria} · Nivel {savedNoticeData.posicion_nivel}
                  </span>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Estatus del Trámite</span>
                  <span className="font-black text-xs text-amber-950 uppercase block mt-1">
                    ⏳ PENDIENTE FIRMA EN OFICINA DE RH
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold block mt-0.5">
                    Presentarse en Recursos Humanos
                  </span>
                </div>

                <div className="col-span-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Trabajador Titular</span>
                  <span className="font-black text-sm text-zinc-950 uppercase">{savedNoticeData.titular}</span>
                  <span className="text-xs text-zinc-600 block">
                    Ficha #{savedNoticeData.ficha} · {savedNoticeData.puesto} ({savedNoticeData.departamento})
                  </span>
                </div>

                <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Cerradura</span>
                  <span className="font-bold text-zinc-900">{savedNoticeData.tipo_cerradura}</span>
                  {savedNoticeData.numero_llave !== 'N/A' && (
                    <span className="block text-[10px] font-mono text-zinc-600">Llave #{savedNoticeData.numero_llave}</span>
                  )}
                </div>

                <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">¿Deja Llave en RH?</span>
                  <span className="font-black text-zinc-950">{savedNoticeData.deja_llave_rh}</span>
                </div>
              </div>

              {savedNoticeData.firma_trabajador && (
                <div className="border-t border-zinc-200 pt-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Pre-Firma Digital Registrada:</span>
                  <img
                    src={savedNoticeData.firma_trabajador}
                    alt="Pre-firma trabajador"
                    className="h-12 object-contain border border-zinc-300 rounded bg-white px-2"
                  />
                </div>
              )}

              <div className="bg-zinc-900 text-white p-3 rounded-xl text-center text-[11px] font-bold">
                📌 Toma captura de pantalla de este comprobante y acude a Recursos Humanos para firmar tu resguardo.
              </div>
            </div>

            {/* Botones de Acción del Trabajador */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `📋 *COMPROBANTE DE REGISTRO DE CASILLERO - MINAS DE BACIS*\n\n` +
                  `• *Folio:* ${savedNoticeData.folio_resguardo}\n` +
                  `• *Casillero:* ${savedNoticeData.codigo_casillero} (${savedNoticeData.posicion_nivel})\n` +
                  `• *Trabajador:* ${savedNoticeData.titular} (Ficha #${savedNoticeData.ficha})\n` +
                  `• *Cerradura:* ${savedNoticeData.tipo_cerradura}\n` +
                  `• *¿Deja copia de llave en RH?:* ${savedNoticeData.deja_llave_rh}\n\n` +
                  `⚠️ *RECORDATORIO:* Debo pasar a la oficina de Recursos Humanos a firmar mi hoja de resguardo oficial.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Guardar / Enviar por WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2 border border-zinc-700"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Imprimir / Guardar PDF</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Escáner QR */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4">
          <div className="w-full max-w-sm flex items-center justify-between text-white pt-2">
            <span className="font-black text-sm uppercase tracking-wider text-amber-400">
              Escanea el QR de tu Casillero
            </span>
            <button
              type="button"
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
            <p className="text-xs text-rose-400 text-center max-w-xs">{cameraError}</p>
          )}

          <div className="w-full pb-6 text-center text-xs text-zinc-400">
            Apunta la cámara al código QR pegado en tu casillero
          </div>
        </div>
      )}
    </div>
  )
}

export default function RegistroLockerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
          <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-4" />
          <p className="font-bold text-sm uppercase">Cargando Casillero...</p>
        </div>
      }
    >
      <RegistroLockerContent />
    </Suspense>
  )
}
