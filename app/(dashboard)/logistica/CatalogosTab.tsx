'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Trash2, Edit } from 'lucide-react'

export default function CatalogosTab() {
    const [camiones, setCamiones] = useState<any[]>([])
    const [puntos, setPuntos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [nuevoCamion, setNuevoCamion] = useState({ numero_economico: '', placas: '' })
    const [nuevoPunto, setNuevoPunto] = useState({ nombre_punto: '', descripcion: '' })

    useEffect(() => {
        fetchCatalogos()
    }, [])

    const fetchCatalogos = async () => {
        setLoading(true)
        try {
            const [camionesRes, puntosRes] = await Promise.all([
                supabase.from('logistica_camiones').select('*').order('numero_economico'),
                supabase.from('logistica_puntos_mina').select('*').order('nombre_punto')
            ])

            if (camionesRes.error) throw camionesRes.error
            if (puntosRes.error) throw puntosRes.error

            setCamiones(camionesRes.data || [])
            setPuntos(puntosRes.data || [])
        } catch (error) {
            console.error('Error fetching catalogos', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddCamion = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nuevoCamion.numero_economico) return

        try {
            const { error } = await supabase.from('logistica_camiones').insert([nuevoCamion])
            if (error) throw error
            setNuevoCamion({ numero_economico: '', placas: '' })
            fetchCatalogos()
        } catch (error) {
            console.error('Error', error)
            alert('Error al agregar camión')
        }
    }

    const handleAddPunto = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nuevoPunto.nombre_punto) return

        try {
            const { error } = await supabase.from('logistica_puntos_mina').insert([nuevoPunto])
            if (error) throw error
            setNuevoPunto({ nombre_punto: '', descripcion: '' })
            fetchCatalogos()
        } catch (error) {
            console.error('Error', error)
            alert('Error al agregar punto')
        }
    }

    const handleDelete = async (table: string, idColumn: string, idValue: string) => {
        if (!confirm('¿Estás seguro de eliminar este registro?')) return
        try {
            const { error } = await supabase.from(table).delete().eq(idColumn, idValue)
            if (error) throw error
            fetchCatalogos()
        } catch (error) {
            console.error('Error deleting', error)
            alert('Error al eliminar. Posiblemente esté en uso.')
        }
    }

    if (loading) return <div>Cargando catálogos...</div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Camiones */}
            <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                <h2 className="text-lg font-bold text-zinc-900 mb-4">Catálogo de Camiones</h2>
                
                <form onSubmit={handleAddCamion} className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        placeholder="Núm. Económico" 
                        className="flex-1 border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                        value={nuevoCamion.numero_economico}
                        onChange={(e) => setNuevoCamion({...nuevoCamion, numero_economico: e.target.value})}
                        required
                    />
                    <input 
                        type="text" 
                        placeholder="Placas (Opcional)" 
                        className="flex-1 border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                        value={nuevoCamion.placas}
                        onChange={(e) => setNuevoCamion({...nuevoCamion, placas: e.target.value})}
                    />
                    <button type="submit" className="bg-black text-white px-3 py-2 rounded-md hover:bg-zinc-800">
                        <Plus className="w-5 h-5" />
                    </button>
                </form>

                <ul className="divide-y divide-zinc-200">
                    {camiones.map(c => (
                        <li key={c.id_camion} className="py-3 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-zinc-900">Eco: {c.numero_economico}</p>
                                <p className="text-xs text-zinc-500">Placas: {c.placas || 'N/A'}</p>
                            </div>
                            <button 
                                onClick={() => handleDelete('logistica_camiones', 'id_camion', c.id_camion)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                    {camiones.length === 0 && <li className="py-3 text-sm text-zinc-500">No hay camiones registrados</li>}
                </ul>
            </div>

            {/* Puntos de Mina */}
            <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                <h2 className="text-lg font-bold text-zinc-900 mb-4">Puntos Estratégicos en Mina</h2>
                
                <form onSubmit={handleAddPunto} className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        placeholder="Nombre del Punto" 
                        className="flex-1 border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                        value={nuevoPunto.nombre_punto}
                        onChange={(e) => setNuevoPunto({...nuevoPunto, nombre_punto: e.target.value})}
                        required
                    />
                    <input 
                        type="text" 
                        placeholder="Descripción (Opcional)" 
                        className="flex-1 border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black sm:text-sm"
                        value={nuevoPunto.descripcion}
                        onChange={(e) => setNuevoPunto({...nuevoPunto, descripcion: e.target.value})}
                    />
                    <button type="submit" className="bg-black text-white px-3 py-2 rounded-md hover:bg-zinc-800">
                        <Plus className="w-5 h-5" />
                    </button>
                </form>

                <ul className="divide-y divide-zinc-200">
                    {puntos.map(p => (
                        <li key={p.id_punto} className="py-3 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-zinc-900">{p.nombre_punto}</p>
                                <p className="text-xs text-zinc-500">{p.descripcion || 'Sin descripción'}</p>
                            </div>
                            <button 
                                onClick={() => handleDelete('logistica_puntos_mina', 'id_punto', p.id_punto)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                    {puntos.length === 0 && <li className="py-3 text-sm text-zinc-500">No hay puntos registrados</li>}
                </ul>
            </div>
        </div>
    )
}
