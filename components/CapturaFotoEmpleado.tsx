'use client'

import { useRef, useState, useCallback } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Camera, Upload, CheckCircle, X, RotateCcw, Loader } from 'lucide-react'

interface Props {
  idEmpleado: string
  nombreEmpleado: string
  fotoActual?: string | null
  onFotoGuardada: (nuevaUrl: string) => void
}

export default function CapturaFotoEmpleado({ idEmpleado, nombreEmpleado, fotoActual, onFotoGuardada }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [modo, setModo] = useState<'idle' | 'camara' | 'preview' | 'guardando' | 'exito'>('idle')
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [error, setError] = useState('')

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const iniciarCamara = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setModo('camara')
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.')
    }
  }

  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setFotoCapturada(dataUrl)
    detenerCamara()
    setModo('preview')
  }

  const handleArchivoSeleccionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setFotoCapturada(ev.target?.result as string)
      setModo('preview')
    }
    reader.readAsDataURL(file)
  }

  const guardarFoto = async () => {
    if (!fotoCapturada) return
    setModo('guardando')
    setError('')

    try {
      // Convert base64 to blob
      const res = await fetch(fotoCapturada)
      const blob = await res.blob()
      const fileName = `empleado_${idEmpleado}_${Date.now()}.jpg`
      const filePath = `fotos-empleados/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('empleados-fotos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

      let fotoUrl = fotoCapturada // fallback: store base64 directly

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('empleados-fotos')
          .getPublicUrl(filePath)
        fotoUrl = urlData.publicUrl
      } else {
        // If storage fails, save base64 directly to DB (works but larger)
        console.warn('Storage upload failed, saving base64 directly:', uploadError.message)
        fotoUrl = fotoCapturada
      }

      // Update empleados table
      const { error: dbError } = await supabase
        .from('empleados')
        .update({ foto_url: fotoUrl })
        .eq('id_empleado', idEmpleado)

      if (dbError) throw dbError

      setModo('exito')
      onFotoGuardada(fotoUrl)
    } catch (err: any) {
      setError('Error al guardar la foto: ' + (err.message || 'Error desconocido'))
      setModo('preview')
    }
  }

  const reiniciar = () => {
    detenerCamara()
    setFotoCapturada(null)
    setModo('idle')
    setError('')
  }

  return (
    <div className="space-y-3">
      {/* Foto actual o placeholder */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-zinc-200 bg-zinc-100 flex items-center justify-center flex-shrink-0">
          {(fotoActual || (modo === 'exito' && fotoCapturada)) ? (
            <img
              src={modo === 'exito' ? fotoCapturada! : fotoActual!}
              alt={nombreEmpleado}
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera className="w-8 h-8 text-zinc-300" />
          )}
        </div>
        <div>
          <div className="text-sm font-black text-zinc-900">{nombreEmpleado}</div>
          {fotoActual || modo === 'exito' ? (
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-bold">Foto registrada para reconocimiento facial</span>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 mt-1">Sin foto — el sistema no podrá reconocerlo</div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* MODO IDLE: Botones de acción */}
      {modo === 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={iniciarCamara}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Camera className="w-4 h-4" />
            📸 Capturar con Cámara
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4" />
            Subir Foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleArchivoSeleccionado}
          />
        </div>
      )}

      {/* MODO CÁMARA */}
      {modo === 'camara' && (
        <div className="space-y-2">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-indigo-500">
            <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {/* Oval overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-dashed border-white/50 rounded-full w-32 h-40" />
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-[9px] text-white bg-black/60 px-3 py-1 rounded-full font-bold uppercase">
                Centra el rostro en el óvalo
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}
              className="px-3 py-2.5 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl">
              🔄 Cambiar cámara
            </button>
            <button onClick={capturarFoto}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" /> 📸 Capturar Foto
            </button>
            <button onClick={reiniciar}
              className="px-3 py-2.5 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODO PREVIEW */}
      {modo === 'preview' && fotoCapturada && (
        <div className="space-y-2">
          <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400">
            <img src={fotoCapturada} alt="Vista previa" className="w-full object-cover max-h-48" />
            <div className="absolute top-2 left-2 bg-amber-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
              Vista Previa
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={reiniciar}
              className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-black rounded-xl flex items-center justify-center gap-1">
              <RotateCcw className="w-4 h-4" /> Retomar
            </button>
            <button onClick={guardarFoto}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> ✅ Guardar Foto
            </button>
          </div>
        </div>
      )}

      {/* MODO GUARDANDO */}
      {modo === 'guardando' && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <Loader className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm text-indigo-700 font-bold">Guardando foto de referencia facial...</span>
        </div>
      )}

      {/* MODO ÉXITO */}
      {modo === 'exito' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-black text-emerald-800">¡Foto guardada correctamente!</div>
              <div className="text-xs text-emerald-600">El sistema ya puede reconocer a este empleado en el camión.</div>
            </div>
          </div>
          <button onClick={reiniciar}
            className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1">
            <Camera className="w-3.5 h-3.5" /> Actualizar foto
          </button>
        </div>
      )}
    </div>
  )
}
