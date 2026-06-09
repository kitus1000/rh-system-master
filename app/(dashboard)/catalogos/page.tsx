'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Trash2, Tag, FileType } from 'lucide-react'

export default function CatalogosPage() {
    const [activeTab, setActiveTab] = useState('incidencias')

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">Administración de Catálogos</h1>
            <p className="text-zinc-500 mb-8">Gestione las opciones disponibles para incidencias y solicitudes.</p>

            <div className="flex space-x-4 mb-6 border-b border-zinc-200 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('incidencias')}
                    className={`pb-2 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'incidencias' ? 'border-b-2 border-black text-black' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Tipos de Incidencia
                </button>
                <button
                    onClick={() => setActiveTab('solicitudes')}
                    className={`pb-2 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'solicitudes' ? 'border-b-2 border-black text-black' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Tipos de Solicitud
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`pb-2 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'roles' ? 'border-b-2 border-black text-black' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Roles de Trabajo
                </button>
                <button
                    onClick={() => setActiveTab('departamentos')}
                    className={`pb-2 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'departamentos' ? 'border-b-2 border-black text-black' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Departamentos
                </button>
                <button
                    onClick={() => setActiveTab('unidades')}
                    className={`pb-2 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'unidades' ? 'border-b-2 border-black text-black' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Unidades
                </button>
                <button
                    onClick={() => setActiveTab('bajas')}
                    className={`pb-2 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'bajas' ? 'border-b-2 border-black text-black' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Causas de Baja
                </button>
            </div>

            {activeTab === 'incidencias' && <CatalogManager table="cat_tipos_incidencia" idField="id_tipo_incidencia" nameField="tipo_incidencia" title="Tipos de Incidencia" icon={<Tag className="w-5 h-5 mb-2 text-amber-500" />} />}
            {activeTab === 'solicitudes' && <CatalogManager table="cat_tipos_solicitud" idField="id_tipo_solicitud" nameField="tipo_solicitud" title="Tipos de Solicitud" icon={<FileType className="w-5 h-5 mb-2 text-blue-500" />} />}
            {activeTab === 'roles' && <RolesManager />}
            {activeTab === 'departamentos' && <CatalogManager table="cat_departamentos" idField="id_departamento" nameField="departamento" title="Departamentos" icon={<Tag className="w-5 h-5 mb-2 text-purple-500" />} />}
            {activeTab === 'unidades' && <CatalogManager table="cat_unidades_trabajo" idField="id_unidad" nameField="unidad_trabajo" title="Unidades de Trabajo" icon={<Tag className="w-5 h-5 mb-2 text-green-500" />} />}
            {activeTab === 'bajas' && <CatalogManager table="cat_causas_baja" idField="id_causa_baja" nameField="causa" title="Causas de Baja" icon={<Tag className="w-5 h-5 mb-2 text-red-500" />} />}
        </div>
    )
}

function RolesManager() {
    const [roles, setRoles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [formData, setFormData] = useState({
        tipo_rol: '',
        dias_trabajo: 20,
        dias_descanso: 10,
        descripcion: ''
    })

    useEffect(() => {
        fetchRoles()
    }, [])

    async function fetchRoles() {
        const { data } = await supabase.from('cat_tipos_rol').select('*').eq('activo', true).order('tipo_rol')
        setRoles(data || [])
        setLoading(false)
    }

    async function handleAdd() {
        if (!formData.tipo_rol.trim()) return alert('El nombre es requerido')

        try {
            const { error } = await supabase.from('cat_tipos_rol').insert([formData])
            if (error) throw error
            setFormData({ tipo_rol: '', dias_trabajo: 20, dias_descanso: 10, descripcion: '' })
            fetchRoles()
        } catch (e: any) {
            alert('Error: ' + e.message)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este rol?')) return
        const { error } = await supabase.from('cat_tipos_rol').update({ activo: false }).eq('id_tipo_rol', id)
        if (!error) fetchRoles()
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <div className="p-2 bg-zinc-50 rounded-lg mr-4 border border-zinc-100">
                        <Tag className="w-5 h-5 mb-2 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900">Roles de Trabajo</h2>
                        <p className="text-xs text-zinc-500">Configuración de turnos y descansos</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-zinc-50 rounded-lg">
                <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Nombre (ej. 20x10)</label>
                    <input
                        className="w-full rounded-md border-zinc-300 text-sm text-black"
                        value={formData.tipo_rol}
                        onChange={e => setFormData({ ...formData, tipo_rol: e.target.value })}
                        placeholder="20x10"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Días Trabajo</label>
                    <input
                        type="number"
                        className="w-full rounded-md border-zinc-300 text-sm text-black"
                        value={formData.dias_trabajo}
                        onChange={e => setFormData({ ...formData, dias_trabajo: parseInt(e.target.value) })}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Días Descanso</label>
                    <input
                        type="number"
                        className="w-full rounded-md border-zinc-300 text-sm text-black"
                        value={formData.dias_descanso}
                        onChange={e => setFormData({ ...formData, dias_descanso: parseInt(e.target.value) })}
                    />
                </div>
                <div className="flex items-end">
                    <button onClick={handleAdd} className="w-full bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800">
                        Agregar
                    </button>
                </div>
            </div>

            {loading ? <div className="text-center text-sm text-zinc-400">Cargando...</div> : (
                <div className="overflow-hidden rounded-md border border-zinc-200">
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Rol</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Esquema</th>
                                <th className="px-4 py-2 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 bg-white">
                            {roles.map(r => (
                                <tr key={r.id_tipo_rol}>
                                    <td className="px-4 py-2 text-sm font-medium text-zinc-900">{r.tipo_rol}</td>
                                    <td className="px-4 py-2 text-sm text-zinc-600">{r.dias_trabajo} Trabajo / {r.dias_descanso} Descanso</td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => handleDelete(r.id_tipo_rol)} className="text-zinc-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function CatalogManager({ table, idField, nameField, title, icon }: any) {
    const [items, setItems] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchItems()
    }, [table])

    async function fetchItems() {
        const { data } = await (supabase as any).from(table).select('*').filter('activo', 'eq', true).order(nameField, { ascending: true })
        setItems(data || [])
        setLoading(false)
    }

    async function handleAdd() {
        if (!newItem.trim()) return
        const { error } = await (supabase as any).from(table).insert([{ [nameField]: newItem }])
        if (error) {
            alert('Error: ' + error.message)
        } else {
            setNewItem('')
            fetchItems()
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Desea eliminar este elemento?')) return
        // Soft delete usually better, but for now hard delete or set active=false
        const { error } = await (supabase as any).from(table).update({ activo: false }).eq(idField, id)
        if (error) {
            alert('Error: ' + error.message)
        } else {
            fetchItems()
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <div className="p-2 bg-zinc-50 rounded-lg mr-4 border border-zinc-100">
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
                        <p className="text-xs text-zinc-500">Listado activo del sistema</p>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-50 p-4 rounded-md border border-zinc-100 mb-6">
                <label className="block text-xs font-medium text-zinc-500 mb-2">Agregar Nuevo {title}</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder={`Escribe el nombre del nuevo ${title.toLowerCase()}...`}
                        className="flex-1 rounded-md border-zinc-300 text-sm focus:ring-black focus:border-black text-black"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button
                        onClick={handleAdd}
                        className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 flex items-center shrink-0"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Cargando...</div>
            ) : (
                <ul className="divide-y divide-zinc-100">
                    {items.length === 0 && <li className="py-8 text-center text-zinc-400 italic text-sm">No hay elementos registrados.</li>}
                    {items.map((item) => (
                        <li key={item[idField]} className="py-3 flex justify-between items-center group">
                            <span className="text-sm text-zinc-700 font-medium pl-2 border-l-2 border-transparent group-hover:border-amber-500 transition-all">
                                {item[nameField]}
                            </span>
                            <button
                                onClick={() => handleDelete(item[idField])}
                                className="text-zinc-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                title="Eliminar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

