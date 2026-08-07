'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Camera, X, CheckCircle, UserX, Loader } from 'lucide-react'

interface EmpleadoReconocido {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  foto_url?: string
  confianza: number
}

interface Props {
  onPasajeroIdentificado: (emp: EmpleadoReconocido) => void
  onCerrar: () => void
}

// Cargar face-api.js dinámicamente desde CDN
async function loadFaceApi() {
  if ((window as any).faceapi) return (window as any).faceapi
  return new Promise<any>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
    script.onload = () => resolve((window as any).faceapi)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function FaceRecognitionScanner({ onPasajeroIdentificado, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const labeledDescriptorsRef = useRef<any[]>([])

  const [estado, setEstado] = useState<'cargando_modelos' | 'cargando_empleados' | 'listo' | 'reconociendo' | 'encontrado' | 'error'>('cargando_modelos')
  const [mensaje, setMensaje] = useState('Cargando modelos de reconocimiento facial...')
  const [empleadoDetectado, setEmpleadoDetectado] = useState<EmpleadoReconocido | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [totalEmpleados, setTotalEmpleados] = useState(0)

  const detenerCamara = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const iniciarCamara = useCallback(async () => {
    detenerCamara()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) {
      setEstado('error')
      setMensaje('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }, [facingMode, detenerCamara])

  // Cargar modelos y empleados
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // 1. Cargar face-api.js desde CDN
        setMensaje('Cargando motor de reconocimiento facial...')
        const faceapi = await loadFaceApi()

        // 2. Cargar modelos desde CDN de jsdelivr
        // 2. Cargar modelos — pesos disponibles en GitHub raw
        const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
        setMensaje('Cargando modelos de IA facial (primera vez puede tardar ~30 seg)...')
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])

        if (!mounted) return

        // 3. Cargar fotos de empleados activos con foto_url
        setEstado('cargando_empleados')
        setMensaje('Cargando rostros de empleados registrados...')

        const { data: empleados } = await supabase
          .from('empleados')
          .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, foto_url')
          .eq('estado_empleado', 'Activo')
          .not('foto_url', 'is', null)

        if (!mounted) return

        const empleadosConFoto = (empleados || []).filter(e => e.foto_url)
        setTotalEmpleados(empleadosConFoto.length)

        if (empleadosConFoto.length === 0) {
          setEstado('error')
          setMensaje('No hay empleados con foto registrada. Ve a la ficha de cada empleado y captura su foto primero.')
          return
        }

        // 4. Generar descriptores faciales para cada empleado
        setMensaje(`Procesando ${empleadosConFoto.length} rostros de empleados...`)
        const labeledDescriptors: any[] = []

        for (const emp of empleadosConFoto) {
          try {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            await new Promise<void>((res, rej) => {
              img.onload = () => res()
              img.onerror = () => rej(new Error('img load error'))
              img.src = emp.foto_url!
            })

            const detection = await faceapi
              .detectSingleFace(img)
              .withFaceLandmarks()
              .withFaceDescriptor()

            if (detection) {
              const label = emp.id_empleado
              const descriptor = new faceapi.LabeledFaceDescriptors(label, [detection.descriptor])
              labeledDescriptors.push({
                descriptor,
                empleado: emp
              })
            }
          } catch {
            // Skip employee if photo can't be processed
          }
        }

        if (!mounted) return

        if (labeledDescriptors.length === 0) {
          setEstado('error')
          setMensaje('No se pudieron procesar los rostros. Las fotos deben mostrar claramente la cara del empleado.')
          return
        }

        labeledDescriptorsRef.current = labeledDescriptors
        setEstado('listo')
        setMensaje(`✅ ${labeledDescriptors.length} rostros cargados. Apunta la cámara al trabajador.`)

        await iniciarCamara()

        // 5. Iniciar reconocimiento en tiempo real cada 1.5 segundos
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return
          
          const faceapiLocal = (window as any).faceapi
          const detection = await faceapiLocal
            .detectSingleFace(videoRef.current)
            .withFaceLandmarks()
            .withFaceDescriptor()

          if (!detection) return

          // Buscar coincidencia
          let mejorCoincidencia: any = null
          let menorDistancia = Infinity

          for (const ld of labeledDescriptorsRef.current) {
            const matcher = new faceapiLocal.FaceMatcher([ld.descriptor], 0.55)
            const result = matcher.findBestMatch(detection.descriptor)
            if (result.distance < menorDistancia && result.distance < 0.55) {
              menorDistancia = result.distance
              mejorCoincidencia = ld
            }
          }

          if (mejorCoincidencia) {
            setEmpleadoDetectado({
              ...mejorCoincidencia.empleado,
              confianza: Math.round((1 - menorDistancia) * 100)
            })
            setEstado('encontrado')
            if (intervalRef.current) clearInterval(intervalRef.current)
          }
        }, 1500)

      } catch (err: any) {
        if (mounted) {
          setEstado('error')
          setMensaje('Error al inicializar reconocimiento facial: ' + (err.message || 'Error desconocido'))
        }
      }
    }

    init()
    return () => {
      mounted = false
      detenerCamara()
    }
  }, [iniciarCamara, detenerCamara])

  const handleConfirmar = () => {
    if (empleadoDetectado) {
      onPasajeroIdentificado(empleadoDetectado)
      onCerrar()
    }
  }

  const handleReintentar = async () => {
    setEstado('listo')
    setEmpleadoDetectado(null)
    setMensaje(`✅ ${labeledDescriptorsRef.current.length} rostros cargados. Apunta la cámara al trabajador.`)
    await iniciarCamara()

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return
      const faceapiLocal = (window as any).faceapi
      const detection = await faceapiLocal.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()
      if (!detection) return

      let mejorCoincidencia: any = null
      let menorDistancia = Infinity

      for (const ld of labeledDescriptorsRef.current) {
        const matcher = new faceapiLocal.FaceMatcher([ld.descriptor], 0.55)
        const result = matcher.findBestMatch(detection.descriptor)
        if (result.distance < menorDistancia && result.distance < 0.55) {
          menorDistancia = result.distance
          mejorCoincidencia = ld
        }
      }

      if (mejorCoincidencia) {
        setEmpleadoDetectado({ ...mejorCoincidencia.empleado, confianza: Math.round((1 - menorDistancia) * 100) })
        setEstado('encontrado')
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
      <div className="bg-zinc-900 text-white rounded-3xl p-5 max-w-sm w-full space-y-4 border border-zinc-800 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-black uppercase tracking-wider text-amber-400">
              Reconocimiento Facial
            </span>
          </div>
          <button onClick={() => { detenerCamara(); onCerrar() }} className="text-zinc-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado / Mensaje */}
        <div className={`p-3 rounded-xl text-xs font-bold text-center ${
          estado === 'error' ? 'bg-rose-900/50 text-rose-300 border border-rose-700' :
          estado === 'encontrado' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' :
          'bg-zinc-800 text-zinc-300'
        }`}>
          {(estado === 'cargando_modelos' || estado === 'cargando_empleados') && (
            <Loader className="w-4 h-4 animate-spin inline mr-2" />
          )}
          {mensaje}
        </div>

        {/* Cámara */}
        {estado !== 'error' && estado !== 'encontrado' && (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-indigo-500">
            <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-dashed border-emerald-400/70 rounded-full w-36 h-44 flex items-center justify-center">
                <span className="text-[9px] font-black text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Encuadra el rostro
                </span>
              </div>
            </div>
            {estado === 'listo' && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                <span className="text-[9px] font-bold text-white bg-black/70 px-3 py-1 rounded-full animate-pulse">
                  🔍 Buscando rostro...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Resultado encontrado */}
        {estado === 'encontrado' && empleadoDetectado && (
          <div className="bg-emerald-950 border border-emerald-600 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              {empleadoDetectado.foto_url ? (
                <img src={empleadoDetectado.foto_url} alt="Foto" className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-zinc-500" />
                </div>
              )}
              <div>
                <div className="font-black text-white text-base">
                  {empleadoDetectado.nombre} {empleadoDetectado.apellido_paterno} {empleadoDetectado.apellido_materno || ''}
                </div>
                <div className="text-xs text-emerald-300 font-bold">{empleadoDetectado.puesto || 'Sin puesto'}</div>
                <div className="text-[10px] text-zinc-400">{empleadoDetectado.departamento || 'Sin departamento'}</div>
                <div className="mt-1 inline-flex items-center gap-1 bg-emerald-900 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-300">
                    Coincidencia: {empleadoDetectado.confianza}%
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReintentar}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-xl flex items-center justify-center gap-1"
              >
                <UserX className="w-4 h-4" /> No es él
              </button>
              <button
                onClick={handleConfirmar}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1"
              >
                <CheckCircle className="w-4 h-4" /> ✅ Confirmar Pasajero
              </button>
            </div>
          </div>
        )}

        {/* Botón cambiar cámara */}
        {(estado === 'listo' || estado === 'reconociendo') && (
          <button
            onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl"
          >
            🔄 Cambiar Cámara (Frontal / Trasera)
          </button>
        )}

        <p className="text-[10px] text-zinc-500 text-center">
          {totalEmpleados > 0 ? `${totalEmpleados} empleados con foto registrada` : 'Cargando base de datos...'}
        </p>
      </div>
    </div>
  )
}
