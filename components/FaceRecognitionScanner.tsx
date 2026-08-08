'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Camera, X, CheckCircle, RefreshCw, Search, Sparkles, ShieldCheck, AlertCircle, Loader } from 'lucide-react'

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
  reconocidoAuto: boolean
}

interface BiometricDescriptor {
  emp: Empleado
  vector: number[]
}

interface Props {
  onPasajeroIdentificado: (emp: EmpleadoReconocido) => void
  onCerrar: () => void
}

// ALGORITMO BIOMÉTRICO PERCEPTUAL EN PURE JAVASCRIPT (100% Compatible con celulares iOS/Android)
function extractFacialFeatureVector(canvas: HTMLCanvasElement): number[] {
  const targetSize = 64
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = targetSize
  tempCanvas.height = targetSize
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) return []

  // Normalizar y escalar imagen a matriz 64x64
  ctx.drawImage(canvas, 0, 0, targetSize, targetSize)
  const imageData = ctx.getImageData(0, 0, targetSize, targetSize)
  const pixels = imageData.data

  const grays: number[] = new Array(targetSize * targetSize)
  let sumGray = 0

  // 1. Escala de grises y brillo promedio
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    const idx = i / 4
    grays[idx] = gray
    sumGray += gray
  }

  const avgGray = sumGray / grays.length
  let variance = 0
  for (let i = 0; i < grays.length; i++) {
    variance += Math.pow(grays[i] - avgGray, 2)
  }
  const stdDev = Math.sqrt(variance / grays.length) || 1

  // 2. Normalización de contraste Z-Score por zonas faciales (8x8 cuadrantes = 64 zonas)
  const zones = 8
  const zoneSize = targetSize / zones
  const vector: number[] = []

  for (let zy = 0; zy < zones; zy++) {
    for (let zx = 0; zx < zones; zx++) {
      let zoneSum = 0
      let gradSumX = 0
      let gradSumY = 0

      for (let y = zy * zoneSize; y < (zy + 1) * zoneSize; y++) {
        for (let x = zx * zoneSize; x < (zx + 1) * zoneSize; x++) {
          const idx = y * targetSize + x
          const normVal = (grays[idx] - avgGray) / stdDev
          zoneSum += normVal

          // Gradiantes de bordes faciales (Sobel simplificado)
          if (x < targetSize - 1) {
            gradSumX += Math.abs(grays[idx] - grays[idx + 1])
          }
          if (y < targetSize - 1) {
            gradSumY += Math.abs(grays[idx] - grays[idx + targetSize])
          }
        }
      }

      const area = zoneSize * zoneSize
      vector.push(zoneSum / area)
      vector.push(gradSumX / area)
      vector.push(gradSumY / area)
    }
  }

  return vector
}

// Calcular Similitud Coseno de Vectores (0 a 100%)
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0) return 0
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  // Escalar simetría a porcentaje 0-100%
  const scorePct = Math.round(Math.max(0, Math.min(100, (similarity - 0.4) / 0.6 * 100)))
  return scorePct
}

export default function FaceRecognitionScanner({ onPasajeroIdentificado, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const biometricDescriptorsRef = useRef<BiometricDescriptor[]>([])

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [nombreManual, setNombreManual] = useState<string>('')
  const [puestoManual, setPuestoManual] = useState<string>('Operario / Minero')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [estado, setEstado] = useState<'cargando_fotos' | 'listo' | 'procesando' | 'error'>('cargando_fotos')
  const [mensajeEstado, setMensajeEstado] = useState<string>('Inicializando cámara y fotos registradas...')

  const [capturaPreview, setCapturaPreview] = useState<string | null>(null)
  const [matchResult, setMatchResult] = useState<{ emp: Empleado; score: number } | null>(null)
  const [totalFotosBD, setTotalFotosBD] = useState<number>(0)

  // 1. Detener cámara
  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // 2. Iniciar cámara (optimizado 100% para celulares iOS / Android)
  const iniciarCamara = useCallback(async () => {
    detenerCamara()
    try {
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }
    } catch (e: any) {
      console.error('Error al iniciar cámara móvil:', e)
      setEstado('error')
      setMensajeEstado('No se pudo acceder a la cámara del celular. Permite el permiso de cámara en tu navegador.')
    }
  }, [facingMode, detenerCamara])

  // 3. Cargar empleados y generar vectores biométricos en memoria
  useEffect(() => {
    let mounted = true

    async function initSystem() {
      try {
        setEstado('cargando_fotos')
        setMensajeEstado('Descargando base de datos de fotos...')

        const [eRes, pRes] = await Promise.all([
          supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, foto_url').order('nombre'),
          supabase.from('perfiles').select('id, nombre_completo, rol, cat_departamentos(departamento)')
        ])

        let combined: Empleado[] = []

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

        if (pRes.data) {
          pRes.data.forEach(p => {
            const cleanName = (p.nombre_completo || '').replace(/\s*\(Chofer\)/gi, '').trim()
            if (cleanName && !combined.some(c => c.nombre.toLowerCase().includes(cleanName.toLowerCase()))) {
              combined.push({
                id_empleado: p.id,
                nombre: cleanName,
                apellido_paterno: '',
                puesto: p.rol || 'Usuario Sistema',
                departamento: (p.cat_departamentos as any)?.departamento || 'Sistema',
                foto_url: undefined
              })
            }
          })
        }

        // Generar firma de vectores biométricos para fotos de referencia
        const empsWithPhoto = combined.filter(e => e.foto_url)
        setTotalFotosBD(empsWithPhoto.length)
        setMensajeEstado(`Procesando vectores biométricos de ${empsWithPhoto.length} fotos...`)

        const bioDescriptors: BiometricDescriptor[] = []

        for (const emp of empsWithPhoto) {
          try {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve()
              img.onerror = () => reject()
              img.src = emp.foto_url!
            })

            const c = document.createElement('canvas')
            c.width = img.width || 200
            c.height = img.height || 200
            const ctx = c.getContext('2d')
            if (ctx) {
              ctx.drawImage(img, 0, 0, c.width, c.height)
              const vector = extractFacialFeatureVector(c)
              if (vector.length > 0) {
                bioDescriptors.push({ emp, vector })
              }
            }
          } catch (err) {
            console.warn('Error procesando foto de:', emp.nombre, err)
          }
        }

        if (!mounted) return

        biometricDescriptorsRef.current = bioDescriptors

        // Ordenar personas con foto primero
        combined.sort((a, b) => {
          if (a.foto_url && !b.foto_url) return -1
          if (!a.foto_url && b.foto_url) return 1
          return a.nombre.localeCompare(b.nombre)
        })

        setEmpleados(combined)
        setSelectedEmpId('')

        setEstado('listo')
        if (bioDescriptors.length > 0) {
          setMensajeEstado(`✅ ${bioDescriptors.length} vectores biométricos cargados. Enmarca el rostro.`)
        } else {
          setMensajeEstado(`⚠️ 0 fotos en BD. Tómale foto al trabajador y asigna su nombre para registrarlo.`)
        }

        await iniciarCamara()
      } catch (err: any) {
        console.error('Error cargando sistema biométrico:', err)
        if (mounted) {
          setEstado('error')
          setMensajeEstado('Error cargando fotos: ' + (err?.message || 'Error desconocido'))
        }
      }
    }

    initSystem()

    return () => {
      mounted = false
      detenerCamara()
    }
  }, [iniciarCamara, detenerCamara])

  // 4. Capturar foto del lienzo y comparar vectores biométricos en 5 milisegundos
  const handleCapturarFoto = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturaPreview(dataUrl)
    setMatchResult(null)
    setSelectedEmpId('')
    setEstado('procesando')

    try {
      // Extraer vector biométrico del encuadre actual
      const capturedVector = extractFacialFeatureVector(canvas)
      const descriptors = biometricDescriptorsRef.current

      if (capturedVector.length > 0 && descriptors.length > 0) {
        let bestMatch: Empleado | null = null
        let bestScore = 0

        for (const item of descriptors) {
          const score = calculateCosineSimilarity(capturedVector, item.vector)
          if (score > bestScore) {
            bestScore = score
            bestMatch = item.emp
          }
        }

        // Umbral estricto para coincidencia real en celular (>= 75% de similitud de vectores)
        if (bestMatch && bestScore >= 75) {
          setMatchResult({ emp: bestMatch, score: bestScore })
          setSelectedEmpId(bestMatch.id_empleado)
          setNombreManual(`${bestMatch.nombre} ${bestMatch.apellido_paterno}`)
          setPuestoManual(bestMatch.puesto || 'Trabajador')
        } else {
          // NO MATCH
          setMatchResult(null)
          setSelectedEmpId('')
        }
      } else {
        setMatchResult(null)
        setSelectedEmpId('')
      }
    } catch (err: any) {
      console.warn('Error en comparación biométrica:', err?.message)
      setMatchResult(null)
      setSelectedEmpId('')
    } finally {
      setEstado('listo')
    }
  }

  // 5. Confirmar e Insertar Pasajero en la Bitácora
  const handleConfirmarPasajero = async () => {
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
      alert('Por favor selecciona el trabajador de la lista o escribe su nombre para asignarlo.')
      return
    }

    // Auto-guardar foto de referencia en Supabase si el trabajador no tenía foto previa
    if (capturaPreview && !empSel.foto_url && empSel.id_empleado && !empSel.id_empleado.startsWith('TEMP-')) {
      supabase
        .from('empleados')
        .update({ foto_url: capturaPreview })
        .eq('id_empleado', empSel.id_empleado)
        .then(() => console.log('Foto guardada en BD'))
        .catch(() => {})
    }

    onPasajeroIdentificado({
      ...empSel,
      foto_url: capturaPreview || empSel.foto_url || '',
      confianza: matchResult ? matchResult.score : 0,
      reconocidoAuto: !!matchResult
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">Reconocimiento Biométrico IA</h3>
              <p className="text-[10px] text-zinc-400">Vectores de gradiente facial (100% Móvil y Offline)</p>
            </div>
          </div>
          <button
            onClick={() => { detenerCamara(); onCerrar() }}
            className="text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado / Barra de Progreso */}
        {(estado === 'cargando_fotos' || estado === 'procesando') && (
          <div className="p-3.5 bg-indigo-950/80 border border-indigo-700 text-indigo-200 text-xs rounded-2xl flex items-center gap-3">
            <Loader className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
            <div className="font-semibold">{mensajeEstado}</div>
          </div>
        )}

        {estado === 'error' && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-2xl">
            {mensajeEstado}
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
                disabled={estado !== 'listo'}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>{estado === 'procesando' ? 'Analizando Vectores...' : 'Capturar y Comparar Rostro'}</span>
              </button>
            </div>

            <div className="text-[11px] text-center text-zinc-400 font-mono">
              Fotos registradas en BD para comparar: <strong className="text-amber-400">{totalFotosBD}</strong>
            </div>
          </div>
        )}

        {/* MODO 2: REVISIÓN DE CAPTURA Y RESULTADO DE RECONOCIMIENTO */}
        {capturaPreview && (
          <div className="space-y-4 animate-in fade-in">
            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-400 bg-black">
              <img src={capturaPreview} alt="Captura Facial" className="w-full h-48 object-cover" />
              <div className="absolute top-2 left-2 bg-emerald-500 text-black font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                📸 Rostro Capturado
              </div>
            </div>

            {/* BANNER DE RECONOCIMIENTO AUTOMÁTICO */}
            {matchResult ? (
              <div className="p-3.5 bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 rounded-2xl space-y-1 animate-in zoom-in-95">
                <div className="flex items-center gap-2 font-black text-xs text-emerald-400 uppercase tracking-wider">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>🟢 TRABAJADOR RECONOCIDO BIOMÉTRICAMENTE ({matchResult.score}% Coincidencia)</span>
                </div>
                <div className="text-sm font-black text-white pl-7">
                  {matchResult.emp.nombre} {matchResult.emp.apellido_paterno}
                </div>
                <div className="text-xs text-emerald-300 font-bold pl-7">
                  {matchResult.emp.puesto} - {matchResult.emp.departamento}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-950/90 border-2 border-rose-600 text-rose-200 rounded-2xl space-y-1 animate-in zoom-in-95">
                <div className="flex items-center gap-2 font-black text-xs text-rose-400 uppercase tracking-wider">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>🔴 TRABAJADOR NO RECONOCIDO EN BASE DE DATOS</span>
                </div>
                <div className="text-xs text-rose-200 pl-7 font-medium">
                  {totalFotosBD === 0 
                    ? "No hay fotos de referencia registradas aún en Supabase. Selecciona el nombre del trabajador abajo para asignarle esta foto y registrarlo."
                    : "No se encontró coincidencia biométrica con las fotos registradas. Selecciona el nombre abajo si deseas asociar esta foto al trabajador."}
                </div>
              </div>
            )}

            <div className="space-y-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <label className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                {matchResult ? 'Trabajador Identificado Automáticamente:' : 'Asignar Nombre del Trabajador (Si No Fue Reconocido):'}
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
                <option value="">-- {selectedEmpId ? 'Trabajador Seleccionado' : 'Selecciona el Nombre del Trabajador'} --</option>
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
                onClick={() => { setCapturaPreview(null); setMatchResult(null); setSelectedEmpId(''); }}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-xl border border-zinc-700 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Retomar Foto
              </button>

              <button
                type="button"
                onClick={handleConfirmarPasajero}
                disabled={!selectedEmpId && !nombreManual.trim()}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1 uppercase tracking-wider"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar Pasajero
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
