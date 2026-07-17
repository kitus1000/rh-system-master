'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { User, Camera, Lock, Save, Loader2 } from 'lucide-react'

export default function MiPerfilPage() {
    const { profile, user } = useAuth()
    const [apodo, setApodo] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [password, setPassword] = useState('')
    const [clinicas, setClinicas] = useState<any[]>([])
    const [idClinica, setIdClinica] = useState('')
    
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (profile) {
            setApodo((profile as any).apodo || '')
            setAvatarUrl((profile as any).avatar_url || '')
            setIdClinica((profile as any).id_clinica || '')
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

            // Subir al bucket fotos_empleados (usando subcarpeta avatars)
            const { error: uploadError } = await supabase.storage
                .from('fotos_empleados')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: publicUrlData } = supabase.storage
                .from('fotos_empleados')
                .getPublicUrl(fileName)

            const url = publicUrlData.publicUrl
            setAvatarUrl(url)

            // Actualizar BD
            await supabase.from('perfiles').update({ avatar_url: url }).eq('id', profile?.id)
            setMsg({ type: 'success', text: 'Foto de perfil actualizada.' })
        } catch (error: any) {
            console.error(error)
            setMsg({ type: 'error', text: 'Error al subir imagen: ' + error.message })
        } finally {
            setSaving(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setMsg({ type: '', text: '' })
        try {
            // Guardar Apodo y Clínica
            const { error: profileError } = await supabase
                .from('perfiles')
                .update({ 
                    apodo,
                    id_clinica: idClinica || null
                })
                .eq('id', profile?.id)
            
            if (profileError) throw profileError

            // Cambiar contraseña si se escribió algo
            if (password.trim() !== '') {
                if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
                const { error: authError } = await supabase.auth.updateUser({
                    password: password
                })
                if (authError) throw authError
            }

            setMsg({ type: 'success', text: 'Perfil actualizado correctamente.' })
            setPassword('')
        } catch (error: any) {
            console.error(error)
            setMsg({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    if (!profile) return null

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Mi Perfil</h2>
                <p className="text-sm text-zinc-500">Personaliza cómo te ven tus compañeros en el chat y el muro.</p>
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
                                placeholder="Ej: Inge Juan, El Jefe..."
                                value={apodo}
                                onChange={e => setApodo(e.target.value)}
                                className="w-full border-zinc-300 rounded-xl p-3 text-sm focus:ring-black focus:border-black transition-colors" 
                            />
                            <p className="text-xs text-zinc-500 mt-2">Así te verán los demás en el muro de actividades y mensajes directos.</p>
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
                                <p className="text-xs text-zinc-500 mt-2">Esta será tu clínica de consulta activa y origen por defecto al generar recetas y pases.</p>
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
