'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Users, Shield, Plus, X, Building, Mail, Lock, User as UserIcon } from 'lucide-react'

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<any[]>([])
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        nombre_completo: '',
        rol: 'Jefe de Departamento', // 'Administrativo', 'Superintendente', 'Jefe de Departamento'
        id_departamento: ''
    })
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const [usersRes, deptsRes] = await Promise.all([
            supabase.from('perfiles').select('*, cat_departamentos(departamento)'),
            supabase.from('cat_departamentos').select('*').eq('activo', true).order('departamento')
        ])
        if (usersRes.data) setUsuarios(usersRes.data)
        if (deptsRes.data) setDepartamentos(deptsRes.data)
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setErrorMsg('')
        setSuccessMsg('')

        if (formData.password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres')
            setSaving(false)
            return
        }

        try {
            // Auto append domain if it's just a username
            let loginEmail = formData.email.trim()
            if (!loginEmail.includes('@')) {
                loginEmail = `${loginEmail}@mina.com`
            }

            const res = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    email: loginEmail
                })
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error desconocido al crear usuario')
            }

            setSuccessMsg('Usuario creado exitosamente.')
            setFormData({
                email: '',
                password: '',
                nombre_completo: '',
                rol: 'Jefe de Departamento',
                id_departamento: ''
            })
            setTimeout(() => {
                setIsCreating(false)
                fetchData()
                setSuccessMsg('')
            }, 2000)
        } catch (error: any) {
            setErrorMsg(error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Gestión de Accesos</h2>
                    <p className="text-sm text-zinc-500">Administra los usuarios y permisos de la plataforma.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center bg-black text-white px-4 py-2 rounded-md font-bold hover:bg-zinc-800 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nuevo Usuario
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase">Nombre</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase">Rol</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase">Departamento</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                        {loading ? (
                            <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-zinc-500">Cargando...</td></tr>
                        ) : usuarios.map(u => (
                            <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center mr-3">
                                            <UserIcon className="w-4 h-4 text-zinc-500" />
                                        </div>
                                        <div className="text-sm font-bold text-zinc-900">{u.nombre_completo || 'Sin nombre'}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        u.rol === 'Superintendente' ? 'bg-purple-100 text-purple-800' :
                                        u.rol === 'Administrativo' ? 'bg-blue-100 text-blue-800' :
                                        u.rol === 'Médico' ? 'bg-emerald-100 text-emerald-800' :
                                        'bg-zinc-100 text-zinc-800'
                                    }`}>
                                        <Shield className="w-3 h-3 mr-1" />
                                        {u.rol}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                    {u.cat_departamentos?.departamento || <span className="text-zinc-400 italic">No asignado / Global</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-zinc-900">Crear Nuevo Usuario</h3>
                            <button onClick={() => setIsCreating(false)} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-md border border-red-200">
                                    {errorMsg}
                                </div>
                            )}
                            {successMsg && (
                                <div className="p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md border border-green-200">
                                    {successMsg}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre Completo</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <input required type="text" value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} className="pl-10 w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Correo o Usuario</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <input required type="text" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-10 w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black" placeholder="ejemplo@correo.com o juan.perez" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Contraseña temporal</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="pl-10 w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Rol</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <select required value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="pl-10 w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black appearance-none">
                                        <option value="Administrativo">Administrativo (Control Total)</option>
                                        <option value="Superintendente">Superintendente (Visualiza Múltiples Áreas)</option>
                                        <option value="Jefe de Departamento">Jefe de Departamento</option>
                                        <option value="Médico">Médico (Módulo Médico y Consultas)</option>
                                    </select>
                                </div>
                            </div>
                            
                            {formData.rol === 'Jefe de Departamento' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Asignar a Departamento</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                        <select required value={formData.id_departamento} onChange={e => setFormData({...formData, id_departamento: e.target.value})} className="pl-10 w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black appearance-none">
                                            <option value="">Seleccione departamento...</option>
                                            {departamentos.map(d => (
                                                <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">Este usuario solo tendrá acceso al personal de este departamento.</p>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm text-zinc-600 font-medium hover:text-black">Cancelar</button>
                                <button type="submit" disabled={saving} className="px-6 py-2 text-sm bg-black text-white font-bold rounded-md hover:bg-zinc-800 shadow-md disabled:opacity-50">
                                    {saving ? 'Creando...' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
