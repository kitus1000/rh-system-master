'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Users, Shield, Plus, X, Building, Mail, Lock, User as UserIcon, 
  Edit2, Trash2, Bus, Truck, Stethoscope, RefreshCw, Eye, EyeOff, CheckCircle2 
} from 'lucide-react'

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<any[]>([])
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editingUserId, setEditingUserId] = useState('')
    const [showModalPassword, setShowModalPassword] = useState(false)
    const [seedingLoading, setSeedingLoading] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        nombre_completo: '',
        rol: 'Chofer', // 'Administrador', 'Recursos Humanos', 'Médico', 'Superintendente', 'Jefe de Departamento', 'Supervisor', 'Chofer'
        id_departamento: '',
        departamentos_autorizados: [] as string[]
    })
    
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            let usersData: any[] = []
            const usersRes = await supabase.from('perfiles').select('*, cat_departamentos(departamento)').order('nombre_completo')
            
            if (usersRes.error) {
                console.warn('Perfiles join error, fallback to simple select:', usersRes.error.message)
                const baseRes = await supabase.from('perfiles').select('*').order('nombre_completo')
                if (baseRes.data) usersData = baseRes.data
            } else if (usersRes.data) {
                usersData = usersRes.data
            }
            setUsuarios(usersData)

            const deptsRes = await supabase.from('cat_departamentos').select('*').eq('activo', true).order('departamento')
            if (deptsRes.data) setDepartamentos(deptsRes.data)
        } catch (err) {
            console.error('Error fetching usuarios:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSeedChoferes() {
        if (!confirm('¿Deseas sincronizar/crear las 6 cuentas oficiales de choferes con rol "Chofer" y contraseña "Bacis2026!"?')) return
        setSeedingLoading(true)
        try {
            const res = await fetch('/api/seed-choferes', { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al sincronizar choferes')
            alert('✅ ¡Cuentas de Choferes sincronizadas exitosamente con rol Chofer!')
            fetchData()
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setSeedingLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setErrorMsg('')
        setSuccessMsg('')

        if (!isEditing && formData.password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres')
            setSaving(false)
            return
        }

        try {
            if (isEditing) {
                // Edit user flow
                const res = await fetch('/api/edit-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: editingUserId,
                        email: formData.email,
                        nombre_completo: formData.nombre_completo,
                        rol: formData.rol,
                        id_departamento: formData.id_departamento,
                        departamentos_autorizados: formData.departamentos_autorizados,
                        password: formData.password
                    })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Error al editar usuario')

                setSuccessMsg('Usuario actualizado exitosamente.')
                setTimeout(() => {
                    setIsEditing(false)
                    fetchData()
                    setSuccessMsg('')
                    resetForm()
                }, 1200)
            } else {
                // Create user flow
                let loginEmail = formData.email.trim()
                if (!loginEmail.includes('@')) {
                    loginEmail = `${loginEmail}@bacis.com`
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
                if (!res.ok) throw new Error(data.error || 'Error al crear usuario')

                setSuccessMsg('Usuario creado exitosamente.')
                setTimeout(() => {
                    setIsCreating(false)
                    fetchData()
                    setSuccessMsg('')
                    resetForm()
                }, 1200)
            }
        } catch (error: any) {
            setErrorMsg(error.message)
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            nombre_completo: '',
            rol: 'Chofer',
            id_departamento: '',
            departamentos_autorizados: []
        })
        setEditingUserId('')
        setShowModalPassword(false)
    }

    const handleStartEdit = (user: any) => {
        // Extraer email inferido si no está explícito
        let inferredEmail = user.email || ''
        if (!inferredEmail && user.nombre_completo) {
            const clean = user.nombre_completo.toLowerCase().replace(/\s*\(chofer\)\s*/gi, '').trim().split(' ')
            if (clean.length >= 2) {
                inferredEmail = `${clean[0]}.${clean[1]}@bacis.com`
            }
        }

        setFormData({
            email: inferredEmail,
            password: '', // Dejar en blanco para no cambiar
            nombre_completo: user.nombre_completo || '',
            rol: user.rol || 'Chofer',
            id_departamento: user.id_departamento || '',
            departamentos_autorizados: user.departamentos_autorizados || []
        })
        setEditingUserId(user.id)
        setShowModalPassword(false)
        setIsEditing(true)
    }

    const handleDeleteUser = async (userId: string, nombre: string) => {
        if (!confirm(`¿Está seguro de que desea eliminar permanentemente al usuario "${nombre}"?\nEsta acción no se puede deshacer y borrará su cuenta y perfil.`)) return
        
        setLoading(true)
        try {
            const res = await fetch('/api/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario')
            
            alert('Usuario eliminado correctamente.')
            fetchData()
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-wide">Gestión de Usuarios y Accesos</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Control de cuentas, roles (Choferes, RH, Médicos, Administradores) y permisos del sistema.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSeedChoferes}
                        disabled={seedingLoading}
                        className="inline-flex items-center bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm gap-1.5"
                    >
                        <Bus className={`w-4 h-4 ${seedingLoading ? 'animate-spin' : ''}`} />
                        <span>{seedingLoading ? 'Sincronizando...' : '🚌 Sincronizar Cuentas Choferes'}</span>
                    </button>

                    <button
                        onClick={() => {
                            resetForm()
                            setIsCreating(true)
                        }}
                        className="inline-flex items-center bg-black hover:bg-zinc-800 text-white px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Usuario</span>
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-900 text-white">
                        <tr>
                            <th className="px-6 py-3.5 text-left text-xs font-black uppercase tracking-wider">Usuario / Nombre</th>
                            <th className="px-6 py-3.5 text-left text-xs font-black uppercase tracking-wider">Rol de Acceso</th>
                            <th className="px-6 py-3.5 text-left text-xs font-black uppercase tracking-wider">Departamento / Permisos</th>
                            <th className="px-6 py-3.5 text-right text-xs font-black uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-sm font-bold text-zinc-400">Cargando catálogo de usuarios...</td></tr>
                        ) : usuarios.map(u => {
                            const isChofer = u.rol === 'Chofer' || (u.rol && u.rol.toLowerCase().includes('chofer')) || (u.nombre_completo && u.nombre_completo.toLowerCase().includes('(chofer)'))
                            return (
                                <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center mr-3 font-black text-xs ${
                                                isChofer ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                                u.rol === 'Médico' || u.rol === 'Jefe Médico' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                                                'bg-zinc-100 text-zinc-700'
                                            }`}>
                                                {isChofer ? <Bus className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-zinc-900 leading-tight">
                                                    {u.nombre_completo || 'Sin nombre'}
                                                </div>
                                                {u.email && <div className="text-[11px] font-mono text-zinc-400">{u.email}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black ${
                                            isChofer ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs' :
                                            u.rol === 'Superintendente' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                                            u.rol === 'Administrativo' || u.rol === 'Administrador' ? 'bg-zinc-900 text-white shadow-xs' :
                                            u.rol === 'Recursos Humanos' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                                            u.rol === 'Jefe Médico' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                                            u.rol === 'Médico' ? 'bg-teal-100 text-teal-900 border border-teal-300' :
                                            'bg-zinc-100 text-zinc-800'
                                        }`}>
                                            {isChofer ? <Truck className="w-3 h-3 mr-1 text-amber-700" /> : <Shield className="w-3 h-3 mr-1" />}
                                            {isChofer ? 'Chofer' : u.rol}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        {u.cat_departamentos?.departamento ? (
                                            <span className="font-bold text-zinc-700">{u.cat_departamentos.departamento}</span>
                                        ) : isChofer ? (
                                            <span className="text-amber-800 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                Movilidad y Transporte (Acceso Chofer)
                                            </span>
                                        ) : u.departamentos_autorizados && u.departamentos_autorizados.length > 0 ? (
                                            <span className="text-emerald-700 font-bold text-xs">{u.departamentos_autorizados.length} Áreas Autorizadas</span>
                                        ) : (
                                            <span className="text-zinc-400 italic text-xs">Acceso General</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold">
                                        <div className="flex gap-2 justify-end">
                                            <button 
                                                onClick={() => handleStartEdit(u)}
                                                className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg flex items-center gap-1 transition-colors"
                                                title="Editar Usuario, Correo o Contraseña"
                                            >
                                                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Editar</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(u.id, u.nombre_completo)}
                                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg flex items-center gap-1 transition-colors"
                                                title="Eliminar Usuario"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {(isCreating || isEditing) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-200">
                        <div className="p-5 bg-zinc-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black">
                                    {isEditing ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                </div>
                                <h3 className="text-base font-black uppercase tracking-wide">
                                    {isEditing ? 'Editar Usuario y Credenciales' : 'Crear Nuevo Usuario'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsCreating(false)
                                    setIsEditing(false)
                                }} 
                                className="text-zinc-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200">
                                    {errorMsg}
                                </div>
                            )}
                            {successMsg && (
                                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{successMsg}</span>
                                </div>
                            )}

                            {/* Nombre Completo */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre Completo</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <input 
                                        required 
                                        type="text" 
                                        value={formData.nombre_completo} 
                                        onChange={e => setFormData({...formData, nombre_completo: e.target.value})} 
                                        className="pl-10 w-full text-xs font-bold bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 focus:bg-white focus:ring-amber-500 focus:border-amber-500" 
                                        placeholder="Ej. Adalberto Pinales"
                                    />
                                </div>
                            </div>

                            {/* Correo Electrónico */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Correo Electrónico (Login)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <input 
                                        required={!isEditing} 
                                        type="email" 
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        className="pl-10 w-full text-xs font-bold bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 focus:bg-white focus:ring-amber-500 focus:border-amber-500 font-mono" 
                                        placeholder="ejemplo@bacis.com" 
                                    />
                                </div>
                            </div>

                            {/* Contraseña con Toggle de Ver/Ocultar */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-zinc-700 uppercase">
                                        {isEditing ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowModalPassword(!showModalPassword)}
                                        className="text-[10px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1"
                                    >
                                        {showModalPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        <span>{showModalPassword ? 'Ocultar' : 'Ver contraseña'}</span>
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <input 
                                        required={!isEditing} 
                                        type={showModalPassword ? 'text' : 'password'} 
                                        placeholder={isEditing ? "Dejar en blanco para conservar la actual..." : "Mínimo 6 caracteres (ej. Bacis2026!)"} 
                                        value={formData.password} 
                                        onChange={e => setFormData({...formData, password: e.target.value})} 
                                        className="pl-10 pr-10 w-full text-xs font-bold bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 focus:bg-white focus:ring-amber-500 focus:border-amber-500 font-mono" 
                                    />
                                </div>
                            </div>

                            {/* Rol */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Rol y Permisos</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                    <select 
                                        required 
                                        value={formData.rol} 
                                        onChange={e => setFormData({...formData, rol: e.target.value})} 
                                        className="pl-10 w-full text-xs font-bold bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 focus:bg-white focus:ring-amber-500 focus:border-amber-500 appearance-none"
                                    >
                                        <option value="Chofer">🚌 Chofer (Acceso Exclusivo a Rutas, Checklists y QR)</option>
                                        <option value="Recursos Humanos">👥 Recursos Humanos (RH)</option>
                                        <option value="Administrador">👑 Administrador (Control Total)</option>
                                        <option value="Superintendente">Superintendente</option>
                                        <option value="Jefe de Departamento">Jefe de Departamento</option>
                                        <option value="Supervisor">Supervisor</option>
                                        <option value="Médico">🩺 Médico (Módulo Médico y Consultas)</option>
                                        <option value="Jefe Médico">🩺 Jefe Médico (Firma Autorización en Pases)</option>
                                        <option value="Encargado de Campamento y Comedor">Encargado de Campamento y Comedor</option>
                                    </select>
                                </div>
                            </div>
                            
                            {['Jefe de Departamento', 'Superintendente', 'Supervisor'].includes(formData.rol) && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-2">Departamentos Autorizados a Visualizar</label>
                                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                                        {departamentos.map(d => {
                                            const isChecked = formData.departamentos_autorizados.includes(d.id_departamento);
                                            return (
                                                <label key={d.id_departamento} className="flex items-center space-x-2 cursor-pointer hover:bg-zinc-100 p-1.5 rounded-lg transition-colors">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({...formData, departamentos_autorizados: [...formData.departamentos_autorizados, d.id_departamento]})
                                                            } else {
                                                                setFormData({...formData, departamentos_autorizados: formData.departamentos_autorizados.filter(id => id !== d.id_departamento)})
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-black border-zinc-300 rounded focus:ring-black"
                                                    />
                                                    <span className="text-xs text-zinc-700 font-bold truncate">{d.departamento}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="pt-3 flex justify-end space-x-3 border-t border-zinc-100">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsCreating(false)
                                        setIsEditing(false)
                                    }} 
                                    className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-black rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={saving} 
                                    className="px-6 py-2.5 text-xs bg-black hover:bg-zinc-800 text-white font-black rounded-xl shadow-md disabled:opacity-50 transition-all"
                                >
                                    {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Usuario')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
