'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { User, Camera, Lock, Save, Loader2, Edit3, Trash2 } from 'lucide-react'

export default function MiPerfilPage() {
    const { profile, user } = useAuth()
    const [apodo, setApodo] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [password, setPassword] = useState('')
    const [clinicas, setClinicas] = useState<any[]>([])
    const [idClinica, setIdClinica] = useState('')
    
    // Doctor profile fields
    const [cedula, setCedula] = useState('')
    const [universidad, setUniversidad] = useState('')
    const [especialidad, setEspecialidad] = useState('')
    const [domicilio, setDomicilio] = useState('')
    const [telefono, setTelefono] = useState('')
    const [firmaSaved, setFirmaSaved] = useState('')

    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Canvas drawing states
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasFirma, setHasFirma] = useState(false)

    useEffect(() => {
        if (profile) {
            setApodo((profile as any).apodo || '')
            setAvatarUrl((profile as any).avatar_url || '')
            setIdClinica((profile as any).id_clinica || '')
            
            setCedula((profile as any).cedula_profesional || '')
            setUniversidad((profile as any).universidad || '')
            setEspecialidad((profile as any).especialidad || '')
            setDomicilio((profile as any).domicilio_consultorio || '')
            setTelefono((profile as any).telefono_consultorio || '')
            setFirmaSaved((profile as any).firma || '')
        }
        fetchClinicas()
    }, [profile])

    const fetchClinicas = async () => {
        const { data } = await supabase.from('cat_clinicas').select('*').order('nombre')
        if (data) setClinicas(data)
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        const file = e.target.files[0]
        
        setSaving(true)
        setMsg({ type: '', text: '' })
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `avatars/${profile?.id}-${Math.random()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('fotos_empleados')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: publicUrlData } = supabase.storage
                .from('fotos_empleados')
                .getPublicUrl(fileName)

            const url = publicUrlData.publicUrl
            setAvatarUrl(url)

            await supabase.from('perfiles').update({ avatar_url: url }).eq('id', profile?.id)
            setMsg({ type: 'success', text: 'Foto de perfil actualizada.' })
        } catch (error: any) {
            console.error(error)
            setMsg({ type: 'error', text: 'Error al subir imagen: ' + error.message })
        } finally {
            setSaving(false)
        }
    }

    // Canvas Signature Functions
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        const pos = getPos(e)
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
        setIsDrawing(true)
    }

    const draw = (e: any) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        const pos = getPos(e)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        setHasFirma(true)
    }

    const stopDrawing = () => {
        setIsDrawing(false)
    }

    const getPos = (e: any) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        
        // Handle mobile touch events or mouse clicks
        const clientX = e.touches ? e.touches[0].clientX : e.clientX
        const clientY = e.touches ? e.touches[0].clientY : e.clientY
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        }
    }

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasFirma(false)
    }

    const handleSave = async () => {
        setSaving(true)
        setMsg({ type: '', text: '' })
        try {
            let finalFirma = firmaSaved
            if (hasFirma && canvasRef.current) {
                finalFirma = canvasRef.current.toDataURL('image/png')
            }

            const { error: profileError } = await supabase
                .from('perfiles')
                .update({ 
                    apodo,
                    id_clinica: idClinica || null,
                    cedula_profesional: cedula,
                    universidad: universidad,
                    especialidad: especialidad,
                    domicilio_consultorio: domicilio,
                    telefono_consultorio: telefono,
                    firma: finalFirma
                })
                .eq('id', profile?.id)
            
            if (profileError) throw profileError

            if (password.trim() !== '') {
                if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
                const { error: authError } = await supabase.auth.updateUser({
                    password: password
                })
                if (authError) throw authError
            }

            setFirmaSaved(finalFirma)
            setHasFirma(false)
            setMsg({ type: 'success', text: 'Perfil actualizado correctamente.' })
            setPassword('')
        } catch (error: any) {
            console.error(error)
            setMsg({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    const clearSavedFirma = async () => {
        if (!confirm('¿Desea borrar la firma digital guardada?')) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('perfiles')
                .update({ firma: null })
                .eq('id', profile?.id)
            if (error) throw error
            setFirmaSaved('')
            clearCanvas()
            setMsg({ type: 'success', text: 'Firma borrada correctamente.' })
        } catch (error: any) {
            setMsg({ type: 'error', text: 'Error al borrar firma: ' + error.message })
        } finally {
            setSaving(false)
        }
    }

    if (!profile) return null

    const isMedico = profile.rol === 'Médico'

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Mi Perfil</h2>
                <p className="text-sm text-zinc-500">Personaliza tus datos personales y profesionales para recetas y pases médicos.</p>
            </div>

            {msg.text && (
                <div className={`p-4 rounded-xl text-sm font-bold border ${msg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {msg.text}
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex flex-col md:flex-row items-start gap-8">
                    {/* Foto */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-zinc-100 flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-12 h-12 text-zinc-400" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-8 h-8 text-white" />
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept="image/*" 
                                className="hidden" 
                            />
                        </div>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Cambiar Foto</p>
                    </div>

                    {/* Formulario */}
                    <div className="flex-1 space-y-6 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Nombre Completo (Fijo)</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={profile.nombre_completo} 
                                    className="w-full border-zinc-200 bg-zinc-50 rounded-xl p-3 text-sm text-zinc-500" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-900 uppercase mb-2">Apodo / Alias (Para Chat)</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Dr. Martinez, Médica Herrero..."
                                    value={apodo}
                                    onChange={e => setApodo(e.target.value)}
                                    className="w-full border-zinc-300 rounded-xl p-3 text-sm focus:ring-black focus:border-black transition-colors" 
                                />
                            </div>
                        </div>

                        {(profile.rol === 'Médico' || profile.rol === 'Administrativo') && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-900 uppercase mb-2">Clínica Activa de Consulta</label>
                                <select 
                                    value={idClinica}
                                    onChange={e => setIdClinica(e.target.value)}
                                    className="w-full border border-zinc-300 rounded-xl p-3 text-sm focus:ring-black focus:border-black transition-colors bg-white font-semibold"
                                >
                                    <option value="">Seleccione su clínica activa...</option>
                                    {clinicas.map(c => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} ({c.tipo})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isMedico && (
                            <div className="bg-zinc-50/50 p-6 rounded-2xl border border-zinc-200 space-y-4">
                                <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                                    <Edit3 className="w-4 h-4" /> Datos de Médico Colegiado (Requisito Cofepris)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cédula Profesional</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej. CP 12204901"
                                            value={cedula}
                                            onChange={e => setCedula(e.target.value)}
                                            className="w-full border-zinc-300 rounded-xl p-2.5 text-xs font-bold" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Institución / Universidad Emisora</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej. Universidad Juárez del Estado de Durango"
                                            value={universidad}
                                            onChange={e => setUniversidad(e.target.value)}
                                            className="w-full border-zinc-300 rounded-xl p-2.5 text-xs font-semibold" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Especialidad Clínica (Opcional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej. Medicina de Trabajo, Ginecología..."
                                            value={especialidad}
                                            onChange={e => setEspecialidad(e.target.value)}
                                            className="w-full border-zinc-300 rounded-xl p-2.5 text-xs font-semibold" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Teléfono Consultorio</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej. 618-123-4567"
                                            value={telefono}
                                            onChange={e => setTelefono(e.target.value)}
                                            className="w-full border-zinc-300 rounded-xl p-2.5 text-xs font-semibold" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Domicilio Completo Consultorio</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. Av. Principal S/N, Unidad Herrero, Durango, Mex."
                                        value={domicilio}
                                        onChange={e => setDomicilio(e.target.value)}
                                        className="w-full border-zinc-300 rounded-xl p-2.5 text-xs font-semibold" 
                                    />
                                </div>

                                <div className="pt-2">
                                    <label className="block text-xs font-black text-zinc-700 uppercase mb-2">Firma Digital Autógrafa</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        <div className="space-y-2">
                                            <div className="border border-dashed border-zinc-300 bg-white rounded-xl overflow-hidden touch-none relative shadow-inner">
                                                <canvas 
                                                    ref={canvasRef}
                                                    width={320}
                                                    height={150}
                                                    onMouseDown={startDrawing}
                                                    onMouseMove={draw}
                                                    onMouseUp={stopDrawing}
                                                    onMouseLeave={stopDrawing}
                                                    onTouchStart={startDrawing}
                                                    onTouchMove={draw}
                                                    onTouchEnd={stopDrawing}
                                                    className="w-full cursor-crosshair block"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={clearCanvas}
                                                    className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-[10px] font-black uppercase transition-colors"
                                                >
                                                    Limpiar
                                                </button>
                                                <span className="text-[10px] text-zinc-400 font-bold self-center">Firma en el recuadro</span>
                                            </div>
                                        </div>

                                        <div className="border border-zinc-200 bg-zinc-50 p-4 rounded-xl flex flex-col justify-center items-center text-center h-[180px]">
                                            {firmaSaved ? (
                                                <div className="relative group w-full h-full flex flex-col justify-between items-center">
                                                    <img src={firmaSaved} alt="Firma digital" className="max-h-[100px] object-contain bg-white border rounded p-2" />
                                                    <button 
                                                        type="button" 
                                                        onClick={clearSavedFirma}
                                                        className="text-xs text-rose-600 font-bold hover:text-rose-700 flex items-center gap-1 mt-2"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar Firma Guardada
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-zinc-400 text-xs font-bold">
                                                    Sin firma registrada.<br/>
                                                    <span className="font-normal text-[11px] text-zinc-550">Usa la pantalla táctil de tu celular o el mouse para dibujar tu firma y guardar cambios.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-zinc-100">
                            <label className="block text-xs font-bold text-zinc-900 uppercase mb-2 flex items-center">
                                <Lock className="w-4 h-4 mr-2" />
                                Cambiar Contraseña
                            </label>
                            <input 
                                type="password" 
                                placeholder="Dejar en blanco para no cambiar..."
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full border-zinc-300 rounded-xl p-3 text-sm focus:ring-black focus:border-black transition-colors" 
                            />
                        </div>

                        <div className="pt-6 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center space-x-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
