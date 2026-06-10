'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Pill, Plus, Search, ArrowRightLeft } from 'lucide-react'

export default function InventarioPage() {
    const [medicamentos, setMedicamentos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({ nombre: '', descripcion: '', sustancia_activa: '', presentacion: '', precio_venta: 0 })

    useEffect(() => {
        fetchMedicamentos()
    }, [])

    const fetchMedicamentos = async () => {
        const { data, error } = await supabase.from('cat_medicamentos').select('*').order('nombre')
        if (data) setMedicamentos(data)
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.from('cat_medicamentos').insert([formData])
        if (!error) {
            setShowForm(false)
            setFormData({ nombre: '', descripcion: '', sustancia_activa: '', presentacion: '', precio_venta: 0 })
            fetchMedicamentos()
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Pill className="w-6 h-6 text-amber-500" />
                        Catálogo e Inventario
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Gestión de medicamentos y existencias</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-colors">
                        <ArrowRightLeft className="w-4 h-4" />
                        Transferir
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Medicamento
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-800 border-b pb-2">Registrar Medicamento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre Comercial</label>
                            <input 
                                required type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.nombre}
                                onChange={e => setFormData({...formData, nombre: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Sustancia Activa</label>
                            <input 
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.sustancia_activa}
                                onChange={e => setFormData({...formData, sustancia_activa: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Presentación</label>
                            <input 
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                placeholder="Ej. Caja con 20 tabletas"
                                value={formData.presentacion}
                                onChange={e => setFormData({...formData, presentacion: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Precio Venta ($)</label>
                            <input 
                                type="number" step="0.01" min="0"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.precio_venta}
                                onChange={e => setFormData({...formData, precio_venta: parseFloat(e.target.value)})}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-amber-500 text-black px-6 py-2 rounded-xl text-sm font-bold hover:bg-amber-400">
                            Guardar Medicamento
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 flex items-center bg-zinc-50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text"
                            placeholder="Buscar medicamento..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border-zinc-200 bg-white"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Nombre Comercial</th>
                                <th className="px-6 py-4">Sustancia Activa</th>
                                <th className="px-6 py-4">Presentación</th>
                                <th className="px-6 py-4">Precio Público</th>
                                <th className="px-6 py-4">Stock Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Cargando...</td></tr>
                            ) : medicamentos.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No hay medicamentos registrados</td></tr>
                            ) : (
                                medicamentos.map(med => (
                                    <tr key={med.id_medicamento} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-zinc-800">{med.nombre}</td>
                                        <td className="px-6 py-4 text-zinc-600">{med.sustancia_activa}</td>
                                        <td className="px-6 py-4 text-zinc-600">{med.presentacion}</td>
                                        <td className="px-6 py-4 text-emerald-600 font-medium">${med.precio_venta}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">
                                                0
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
