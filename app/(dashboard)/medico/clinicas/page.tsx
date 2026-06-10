'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Building2, Plus, MapPin, Activity } from 'lucide-react'

export default function ClinicasPage() {
    const [clinicas, setClinicas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({ nombre: '', tipo: 'Interna', ubicacion: '' })

    useEffect(() => {
        fetchClinicas()
    }, [])

    const fetchClinicas = async () => {
        const { data, error } = await supabase.from('cat_clinicas').select('*').order('nombre')
        if (data) setClinicas(data)
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.from('cat_clinicas').insert([formData])
        if (!error) {
            setShowForm(false)
            setFormData({ nombre: '', tipo: 'Interna', ubicacion: '' })
            fetchClinicas()
        } else {
            alert('Error al guardar la clínica')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-amber-500" />
                        Clínicas y Consultorios
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Administración de centros de atención médica</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Clínica
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-800 border-b pb-2">Registrar Clínica</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre</label>
                            <input 
                                required
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.nombre}
                                onChange={e => setFormData({...formData, nombre: e.target.value})}
                                placeholder="Ej. Consultorio Principal"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo</label>
                            <select 
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.tipo}
                                onChange={e => setFormData({...formData, tipo: e.target.value})}
                            >
                                <option value="Interna">Interna (Mina)</option>
                                <option value="Externa">Externa (Ciudad)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Ubicación</label>
                            <input 
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.ubicacion}
                                onChange={e => setFormData({...formData, ubicacion: e.target.value})}
                                placeholder="Ej. Campamento A"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-amber-500 text-black px-6 py-2 rounded-xl text-sm font-bold hover:bg-amber-400">
                            Guardar Clínica
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-10 text-zinc-500">Cargando clínicas...</div>
                ) : clinicas.length === 0 ? (
                    <div className="col-span-full text-center py-10 bg-white rounded-2xl border border-zinc-100 text-zinc-500">
                        No hay clínicas registradas
                    </div>
                ) : (
                    clinicas.map(clinica => (
                        <div key={clinica.id_clinica} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col gap-4 relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-150 ${clinica.tipo === 'Interna' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                            
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-zinc-50 rounded-xl">
                                    <Building2 className={`w-6 h-6 ${clinica.tipo === 'Interna' ? 'text-amber-500' : 'text-blue-500'}`} />
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${clinica.tipo === 'Interna' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {clinica.tipo}
                                </span>
                            </div>
                            
                            <div>
                                <h3 className="text-lg font-bold text-zinc-800">{clinica.nombre}</h3>
                                <div className="flex items-center gap-2 text-sm text-zinc-500 mt-2">
                                    <MapPin className="w-4 h-4" />
                                    <span>{clinica.ubicacion || 'Sin ubicación'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
