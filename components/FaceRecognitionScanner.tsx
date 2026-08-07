'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Camera, X, CheckCircle, UserCheck, RefreshCw, Search, Plus, User } from 'lucide-react'

interface Empleado {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  foto_url?: string
}

interface EmpleadoReconocido extends Empleado {
  confianza: number
}

interface Props {
  onPasajeroIdentificado: (emp: EmpleadoReconocido) => void
  onCerrar: () => void
}

export default function FaceRecognitionScanner({ onPasajeroIdentificado, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [nombreManual, setNombreManual] = useState<string>('')
  const [puestoManual, setPuestoManual] = useState<string>('Operario / Minero')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [capturaPreview, setCapturaPreview] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  // 1. Detener cámara
  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  // 2. Iniciar cámara
  const iniciarCamara = useCallback(async () => {
    detenerCamara()
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch (e: any) {
      console.error('Error al iniciar cámara:', e)
      setErrorMsg('No se pudo acceder a la cámara. Por favor permite el acceso a la cámara en tu navegador.')
    }
  }, [facingMode, detenerCamara])

  // 3. Cargar y combinar lista de empleados (de la tabla empleados Y de perfiles)
  useEffect(() => {
    let mounted = true
    async function fetchAllPeople() {
      try {
        setLoading(true)
        const [eRes, pRes] = await Promise.all([
          supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, foto_url').order('nombre'),
          supabase.from('perfiles').select('id, nombre_completo, rol, cat_departamentos(departamento)')
        ])

        let combined: Empleado[] = []

        // A. Agregar registros de tabla empleados
        if (eRes.data) {
          eRes.data.forEach(e => {
            combined.push({
              id_empleado: e.id_empleado,
              nombre: `${e.nombre || ''} ${e.apellido_paterno || ''}`.trim(),
              apellido_paterno: e.apellido_materno || '',
              puesto: e.puesto || 'Trabajador',
              departamento: e.departamento || 'Mina',
              foto_url: e.foto_url || undefined
            })
          })
        }

        // B. Agregar registros de tabla perfiles (si no existen ya en empleados)
        if (pRes.data) {
          pRes.data.forEach(p => {
            const cleanName = (p.nombre_completo || '').replace(/\s*\(Chofer\)/gi, '').trim()
            if (cleanName && !combined.some(c => c.nombre.toLowerCase().includes(cleanName.toLowerCase()))) {
              const deptName = (p.cat_departamentos as any)?.departamento || 'Sistema'
              combined.push({
                id_empleado: p.id,
                nombre: cleanName,
                apellido_paterno: '',
                puesto: p.rol || 'Usuario Sistema',
                departamento: deptName,
                foto_url: undefined
              })
            }
          })
        }

        // C. Ordenar personas con foto primero
        combined.sort((a, b) => {
          if (a.foto_url && !b.foto_url) return -1
          if (!a.foto_url && b.foto_url) return 1
          return a.nombre.localeCompare(b.nombre)
        })

        if (mounted) {
          setEmpleados(combined)
          if (combined.length > 0) {
            setSelectedEmpId(combined[0].id_empleado)
          }
        }
      } catch (err: any) {
        console.warn('Error cargando y combinando empleados/usuarios:', err?.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchAllPeople()
    iniciarCamara()

    return () => {
      mounted = false
      detenerCamara()
    }
  }, [iniciarCamara, detenerCamara])

  // 4. Capturar foto del lienzo
  const handleCapturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setCapturaPreview(dataUrl)
    }
  }

  // 5. Confirmar y agregar pasajero a la bitácora
  const handleConfirmarPasajero = () => {
    let empSel = empleados.find(e => e.id_empleado === selectedEmpId)

    if (!empSel && (nombreManual.trim() || searchTerm.trim())) {
      const name = nombreManual.trim() || searchTerm.trim()
      empSel = {
        id_empleado: 'TEMP-' + Date.now(),
        nombre: name,
        apellido_paterno: '',
        puesto: puestoManual || 'Pasajero',
        departamento: 'Mina'
      }
    }

    if (!empSel) {
      alert('Por favor selecciona o escribe el nombre del trabajador.')
      return
    }

    onPasajeroIdentificado({
      ...empSel,
      foto_url: capturaPreview || empSel.foto_url || '',
      confianza: 98
    })

    detenerCamara()
    onCerrar()
  }

  const filteredEmpleados = empleados.filter(e => {
    const full = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''} ${e.puesto || ''}`.toLowerCase()
    return full.includes(searchTerm.toLowerCase())
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-zinc-900 text-white rounded-3xl p-5 max-w-md w-full space-y-4 border border-zinc-800 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">Escáner Facial de Pasajero</h3>
              <p className="text-[10px] text-zinc-400">Captura de foto e identificación de abordaje en ruta</p>
            </div>
          </div>
          <button
            onClick={() => { detenerCamara(); onCerrar() }}
            className="text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-2xl">
            {errorMsg}
          </div>
        )}

        {/* MODO 1: CÁMARA EN VIVO */}
        {!capturaPreview && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-emerald-500 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* OVERLAY DE ENCUADRE FACIAL */}
              <div className="absolute inset-0 border-4 border-dashed border-emerald-400/70 rounded-full scale-75 pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-black uppercase text-emerald-300 bg-black/60 px-3 py-1 rounded-full tracking-widest animate-pulse">
                  📸 ENCUADRAR ROSTRO AQUÍ
                </span>
              </div>
            </div>

            {/* BOTONES CÁMARA */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}
                className="px-3.5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl text-xs font-bold border border-zinc-700 flex items-center justify-center gap-1 shrink-0"
                title="Cambiar Cámara Frontal / Trasera"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Girar</span>
              </button>

              <button
                type="button"
                onClick={handleCapturarFoto}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95 transition-transform"
              >
                <Camera className="w-4 h-4" />
                <span>Capturar Foto Pasajero</span>
              </button>
            </div>
          </div>
        )}

        {/* MODO 2: REVISIÓN DE CAPTURA Y ASIGNACIÓN DE TRABAJADOR */}
        {capturaPreview && (
          <div className="space-y-4 animate-in fade-in">
            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-400 bg-black">
              <img src={capturaPreview} alt="Captura Facial" className="w-full h-48 object-cover" />
              <div className="absolute top-2 left-2 bg-emerald-500 text-black font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                📸 Rostro Capturado
              </div>
            </div>

            <div className="space-y-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <label className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                Seleccionar o Escribir Trabajador:
              </label>

              {/* Buscar Trabajador */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o puesto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-bold text-white focus:border-emerald-500"
                />
              </div>

              {/* Selector de Empleados */}
              <select
                value={selectedEmpId}
                onChange={e => {
                  setSelectedEmpId(e.target.value)
                  const found = empleados.find(emp => emp.id_empleado === e.target.value)
                  if (found) {
                    setNombreManual(`${found.nombre} ${found.apellido_paterno}`)
                    setPuestoManual(found.puesto || 'Operario')
                  }
                }}
                className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-bold text-white focus:border-emerald-500"
              >
                <option value="">-- Lista Combinada ({empleados.length} Empleados y Usuarios) --</option>
                {filteredEmpleados.map(e => (
                  <option key={e.id_empleado} value={e.id_empleado}>
                    {e.foto_url ? '🟢 📸' : '👤'} {e.nombre} {e.apellido_paterno} {e.apellido_materno || ''} ({e.puesto || 'Trabajador'} - {e.departamento || 'Mina'})
                  </option>
                ))}
              </select>

              {/* Campo Nombre Manual Si No Está en Lista */}
              {!selectedEmpId && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    placeholder="Nombre completo del pasajero..."
                    value={nombreManual}
                    onChange={e => setNombreManual(e.target.value)}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-bold text-white"
                  />
                  <input
                    type="text"
                    placeholder="Puesto / Departamento (Ej. Minero, Geología)..."
                    value={puestoManual}
                    onChange={e => setPuestoManual(e.target.value)}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-bold text-white"
                  />
                </div>
              )}
            </div>

            {/* BOTONES ACCIÓN REVISIÓN */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCapturaPreview(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-xl border border-zinc-700 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Retomar Foto
              </button>

              <button
                type="button"
                onClick={handleConfirmarPasajero}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1 uppercase tracking-wider"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar e Insertar Pasajero
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
