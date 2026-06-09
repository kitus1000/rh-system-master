'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { AlertTriangle, Trash2, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PeligroPage() {
    const { profile } = useAuth()
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [masterKey, setMasterKey] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })

    useEffect(() => {
        if (profile && profile.rol !== 'Administrativo') {
            router.push('/inicio')
        }
        fetchConfig()
    }, [profile, router])

    async function fetchConfig() {
        const { data } = await supabase.from('configuracion_empresa').select('clave_maestra').limit(1).single()
        if (data) setMasterKey(data.clave_maestra)
    }

    const handleDeleteAll = async () => {
        setMsg({ type: '', text: '' })
        if (password !== masterKey) {
            setMsg({ type: 'error', text: 'Clave maestra incorrecta. Operación cancelada.' })
            return
        }
        
        const confirm1 = confirm('¡ADVERTENCIA! Estás a punto de borrar TODOS los catálogos (Departamentos, Puestos) y TODOS los Empleados (historial, permisos, incidencias). ¿Estás completamente seguro?')
        if (!confirm1) return
        
        const confirm2 = confirm('Esta acción es IRREVERSIBLE. Se perderán todos los datos operativos, excepto los usuarios administradores (para no perder acceso). Escribe "ELIMINAR TODO" para confirmar.')
        
        if (!confirm2) return
        
        setLoading(true)
        setMsg({ type: 'info', text: 'Eliminando datos masivamente... Por favor no cierres la ventana.' })
        try {
            // Delete Empleados (This will cascade to roles, adscripciones, incidencias, solicitudes)
            await supabase.from('empleados').delete().neq('numero_empleado', -1)
            
            // Delete Catalogos
            await supabase.from('cat_departamentos').delete().neq('id_departamento', -1)
            await supabase.from('cat_puestos').delete().neq('id_puesto', -1)
            
            // Delete Chat/Muro
            await supabase.from('mensajes_privados').delete().not('id', 'is', null)
            await supabase.from('muro_alertas').delete().not('id', 'is', null)

            setMsg({ type: 'success', text: 'Base de datos operativa vaciada con éxito. Los usuarios y la configuración de la empresa se mantuvieron intactos.' })
            setPassword('')
        } catch (error: any) {
            setMsg({ type: 'error', text: 'Error fatal durante el borrado: ' + error.message })
        } finally {
            setLoading(false)
        }
    }

    if (!profile || profile.rol !== 'Administrativo') return null

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-black text-red-600 uppercase tracking-wide flex items-center">
                    <AlertTriangle className="w-6 h-6 mr-3" />
                    Zona de Peligro (Botón Rojo)
                </h2>
                <p className="text-sm text-zinc-500 mt-2">Esta sección está restringida únicamente a administradores técnicos. Las acciones aquí son irreversibles.</p>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <AlertTriangle className="w-48 h-48 text-red-900" />
                </div>
                
                <div className="relative z-10">
                    <h3 className="text-xl font-bold text-red-900 mb-2">Borrado Masivo de Base de Datos</h3>
                    <p className="text-red-700 text-sm mb-6 max-w-xl">
                        Al ejecutar esta acción, se eliminarán permanentemente todos los registros operativos del sistema. Esto incluye: 
                        <strong> Empleados, Vacaciones, Incidencias, Departamentos, Puestos, Chats y el Muro.</strong>
                        <br/><br/>
                        Solo se mantendrán tus usuarios (login) y la configuración maestra de la empresa.
                    </p>

                    {msg.text && (
                        <div className={`mb-6 p-4 rounded-xl text-sm font-bold border ${msg.type === 'error' ? 'bg-red-100 text-red-900 border-red-300' : msg.type === 'success' ? 'bg-green-100 text-green-900 border-green-300' : 'bg-blue-100 text-blue-900 border-blue-300'}`}>
                            {msg.text}
                        </div>
                    )}

                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-red-200 max-w-md">
                        <label className="block text-sm font-bold text-red-900 mb-2 flex items-center">
                            <KeyRound className="w-4 h-4 mr-2" />
                            Ingresa la Clave Maestra
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Clave maestra de autorización"
                            className="w-full border-red-200 rounded-lg p-3 text-sm focus:ring-red-500 focus:border-red-500 mb-4"
                        />
                        
                        <button
                            onClick={handleDeleteAll}
                            disabled={loading || !password}
                            className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-xl font-black hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>{loading ? 'EJECUTANDO BORRADO...' : 'CONFIRMAR BORRADO MASIVO'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
