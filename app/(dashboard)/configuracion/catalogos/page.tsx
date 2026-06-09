'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Trash2, Database, Building2, Briefcase, MapPin, FileQuestion, CheckSquare, Square } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function CatalogosPage() {
    const [activeTab, setActiveTab] = useState('departamentos')

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Catálogos del Sistema</h2>
                    <p className="text-sm text-zinc-500">Gestione las unidades, departamentos, puestos y tipos de trámites.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-zinc-200">
                <nav className="-mb-px flex space-x-8">
                    <TabButton id="departamentos" label="Departamentos" icon={Building2} active={activeTab} set={setActiveTab} />
                    <TabButton id="puestos" label="Puestos" icon={Briefcase} active={activeTab} set={setActiveTab} />
                    <TabButton id="unidades" label="Unidades de Trabajo" icon={MapPin} active={activeTab} set={setActiveTab} />
                    <TabButton id="tipos" label="Tipos de Solicitud" icon={FileQuestion} active={activeTab} set={setActiveTab} />
                </nav>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6 min-h-[500px]">
                {activeTab === 'departamentos' && <CatalogTable tableName="cat_departamentos" idField="id_departamento" textField="departamento" placeholder="Ej. Mina, Mantenimiento..." />}

                {activeTab === 'puestos' && (
                    <CatalogTable
                        tableName="cat_puestos"
                        idField="id_puesto"
                        textField="puesto"
                        placeholder="Ej. Supervisor, Perforista..."
                        hasBossCheck={true}
                    />
                )}

                {activeTab === 'unidades' && <CatalogTable tableName="cat_unidades_trabajo" idField="id_unidad" textField="unidad_trabajo" placeholder="Ej. Unidad Topia..." />}
                {activeTab === 'tipos' && <CatalogTable tableName="cat_tipos_solicitud" idField="id_tipo_solicitud" textField="tipo_solicitud" placeholder="Ej. Vacaciones, Baja por Renuncia..." />}
            </div>
        </div>
    )
}

function TabButton({ id, label, icon: Icon, active, set }: any) {
    return (
        <button
            onClick={() => set(id)}
            className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${active === id
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
        >
            <Icon className="mr-2 h-4 w-4" />
            {label}
        </button>
    )
}

function CatalogTable({ tableName, idField, textField, placeholder, hasBossCheck }: any) {
    const [items, setItems] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')
    const [newIsBoss, setNewIsBoss] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchItems()
    }, [tableName])

    async function fetchItems() {
        setLoading(true)
        const { data, error } = await (supabase as any).from(tableName).select('*').order(textField, { ascending: true })
        if (error) console.error(error)
        setItems(data || [])
        setLoading(false)
    }

    async function handleAdd() {
        if (!newItem.trim()) return

        const payload: any = { [textField]: newItem, activo: true }
        if (hasBossCheck) payload.es_jefe = newIsBoss

        const { error } = await (supabase as any).from(tableName).insert([payload])
        if (error) {
            alert('Error al agregar: ' + error.message)
        } else {
            setNewItem('')
            setNewIsBoss(false)
            fetchItems()
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que desea desactivar/borrar este elemento?')) return

        const { error } = await (supabase as any).from(tableName).update({ activo: false }).eq(idField, id)
        if (error) {
            const { error: delError } = await (supabase as any).from(tableName).delete().eq(idField, id)
            if (delError) alert('Error al eliminar: ' + delError.message)
        }
        fetchItems()
    }

    // Toggle boss status for existing item
    async function toggleBoss(id: string, currentVal: boolean) {
        const { error } = await (supabase as any).from(tableName).update({ es_jefe: !currentVal }).eq(idField, id)
        if (error) alert("Error: " + error.message)
        else fetchItems()
    }

    // Seed function
    async function handleSeed() {
        if (!confirm("Esto agregará varios registros de ejemplo. ¿Continuar?")) return

        let seeds: any[] = []
        if (tableName === 'cat_departamentos') seeds = [{ val: 'Mina' }, { val: 'Planta' }, { val: 'Mantenimiento' }, { val: 'Seguridad' }, { val: 'Recursos Humanos' }]
        if (tableName === 'cat_puestos') seeds = [{ val: 'Superintendente', boss: true }, { val: 'Jefe de Mina', boss: true }, { val: 'Supervisor', boss: true }, { val: 'Perforista' }, { val: 'Ayudante General' }]
        if (tableName === 'cat_unidades_trabajo') seeds = [{ val: 'Unidad Topia' }, { val: 'Oficina Central' }]
        if (tableName === 'cat_tipos_solicitud') seeds = [{ val: 'Vacaciones' }, { val: 'Baja' }, { val: 'Permiso' }]

        for (const item of seeds) {
            const payload: any = { [textField]: item.val, activo: true }
            if (tableName === 'cat_puestos') payload.es_jefe = !!item.boss
            await (supabase as any).from(tableName).insert([payload])
        }
        fetchItems()
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-4 items-end">
                <div className="flex-1">
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder={placeholder}
                        className="block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border text-zinc-900"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                </div>

                {hasBossCheck && (
                    <div className="flex items-center pb-2 px-2 border rounded bg-zinc-50 border-zinc-200 h-[38px]">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={newIsBoss}
                                onChange={(e) => setNewIsBoss(e.target.checked)}
                                className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                            />
                            <span className="text-sm text-zinc-700 font-medium">Es Jefe/Mando</span>
                        </label>
                    </div>
                )}

                <button
                    onClick={handleAdd}
                    disabled={!newItem.trim()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-zinc-800 disabled:opacity-50 h-[38px]"
                >
                    <Plus className="mr-2 h-4 w-4 text-amber-500" /> Agregar
                </button>
                <button
                    onClick={handleSeed}
                    className="inline-flex items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 h-[38px]"
                    title="Cargar defaults"
                >
                    <Database className="mr-2 h-4 w-4 text-zinc-400" /> Defaults
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-zinc-400">Cargando...</div>
            ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-zinc-300">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-900 sm:pl-6">Nombre</th>
                                {hasBossCheck && <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-zinc-900">¿Es Jefe?</th>}
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900">Estado</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 bg-white">
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={hasBossCheck ? 4 : 3} className="py-4 text-center text-sm text-zinc-500">No hay registros.</td>
                                </tr>
                            )}
                            {items.map((item) => (
                                <tr key={item[idField]}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 sm:pl-6">
                                        {item[textField]}
                                    </td>
                                    {hasBossCheck && (
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                            <button onClick={() => toggleBoss(item[idField], item.es_jefe)} className="text-zinc-500 hover:text-amber-600">
                                                {item.es_jefe ?
                                                    <CheckSquare className="h-5 w-5 text-amber-600 mx-auto" /> :
                                                    <Square className="h-5 w-5 text-zinc-300 mx-auto" />
                                                }
                                            </button>
                                        </td>
                                    )}
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                                        {item.activo ?
                                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Activo</span> :
                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Inactivo</span>
                                        }
                                    </td>
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                        <button
                                            onClick={() => handleDelete(item[idField])}
                                            className="text-red-600 hover:text-red-900 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
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
