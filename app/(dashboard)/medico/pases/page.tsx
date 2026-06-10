'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Hospital, Plus, Plane, Building } from 'lucide-react'

export default function PasesPage() {
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({
        id_paciente: '',
        id_clinica_origen: '',
        id_clinica_destino: '',
        motivo: '',
        requiere_hotel: false,
        hotel_nombre: '',
        fecha_salida: '',
        fecha_retorno: ''
    })

    const [pacientes, setPacientes] = useState<any[]>([])
    const [clinicas, setClinicas] = useState<any[]>([])

    useEffect(() => {
        fetchPases()
        fetchCatalogos()
    }, [])

    const fetchCatalogos = async () => {
        const { data: pData } = await supabase.from('pacientes').select('*')
        if (pData) setPacientes(pData)

        const { data: cData } = await supabase.from('cat_clinicas').select('*')
        if (cData) setClinicas(cData)
    }

    const fetchPases = async () => {
        const { data, error } = await supabase.from('pases_medicos').select(`
            *,
            pacientes (nombre_completo),
            clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre),
            clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre)
        `).order('creado_el', { ascending: false })
        
        if (data) setPases(data)
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.from('pases_medicos').insert([{
            ...formData,
            hotel_nombre: formData.requiere_hotel ? formData.hotel_nombre : null
        }])
        
        if (!error) {
            setShowForm(false)
            setFormData({
                id_paciente: '', id_clinica_origen: '', id_clinica_destino: '',
                motivo: '', requiere_hotel: false, hotel_nombre: '',
                fecha_salida: '', fecha_retorno: ''
            })
            fetchPases()
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Hospital className="w-6 h-6 text-amber-500" />
                        Pases Médicos
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Traslados de pacientes a clínicas de ciudad</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Generar Pase
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
                    <h2 className="text-lg font-bold text-zinc-800 border-b pb-2 flex items-center gap-2">
                        <Plane className="w-5 h-5 text-zinc-400" />
                        Nuevo Pase Médico
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1">Paciente</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.id_paciente}
                                onChange={e => setFormData({...formData, id_paciente: e.target.value})}
                            >
                                <option value="">Seleccione...</option>
                                {pacientes.map(p => (
                                    <option key={p.id_paciente} value={p.id_paciente}>{p.nombre_completo}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1">De: Clínica Origen (Mina)</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.id_clinica_origen}
                                onChange={e => setFormData({...formData, id_clinica_origen: e.target.value})}
                            >
                                <option value="">Seleccione...</option>
                                {clinicas.filter(c => c.tipo === 'Interna').map(c => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1">A: Clínica Destino (Ciudad)</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.id_clinica_destino}
                                onChange={e => setFormData({...formData, id_clinica_destino: e.target.value})}
                            >
                                <option value="">Seleccione...</option>
                                {clinicas.filter(c => c.tipo === 'Externa').map(c => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-semibold text-zinc-700 mb-1">Motivo del Traslado</label>
                            <textarea 
                                required rows={2}
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 resize-none"
                                value={formData.motivo}
                                onChange={e => setFormData({...formData, motivo: e.target.value})}
                                placeholder="Ej. Cirugía especializada, estudios de laboratorio..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1">Fecha de Salida</label>
                            <input 
                                required type="date"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.fecha_salida}
                                onChange={e => setFormData({...formData, fecha_salida: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1">Fecha Estimada de Retorno</label>
                            <input 
                                type="date"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.fecha_retorno}
                                onChange={e => setFormData({...formData, fecha_retorno: e.target.value})}
                            />
                        </div>

                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                    checked={formData.requiere_hotel}
                                    onChange={e => setFormData({...formData, requiere_hotel: e.target.checked})}
                                />
                                <span className="text-sm font-bold text-zinc-700 flex items-center gap-1">
                                    <Building className="w-4 h-4" /> Requiere Hotel
                                </span>
                            </label>
                            
                            {formData.requiere_hotel && (
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-500 mb-1">Nombre del Hotel (Aprobado)</label>
                                    <input 
                                        required type="text"
                                        className="w-full rounded-md border-zinc-200 bg-white px-3 py-1.5 text-sm"
                                        value={formData.hotel_nombre}
                                        onChange={e => setFormData({...formData, hotel_nombre: e.target.value})}
                                        placeholder="Ej. Hotel Plaza Real"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-zinc-100">
                        <button type="submit" className="bg-amber-500 text-black px-8 py-2.5 rounded-xl text-sm font-black hover:bg-amber-400">
                            Generar Pase Médico
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-800">Pases Activos e Historial</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Ruta</th>
                                <th className="px-6 py-4">Fechas</th>
                                <th className="px-6 py-4">Hotel</th>
                                <th className="px-6 py-4">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Cargando...</td></tr>
                            ) : pases.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No hay pases generados</td></tr>
                            ) : (
                                pases.map(pase => (
                                    <tr key={pase.id_pase} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-zinc-800">
                                            {pase.pacientes?.nombre_completo}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{pase.clinica_origen?.nombre}</span>
                                                <Plane className="w-3 h-3" />
                                                <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{pase.clinica_destino?.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 text-xs">
                                            <div>Ida: <span className="font-medium">{pase.fecha_salida}</span></div>
                                            {pase.fecha_retorno && <div>Vuelta: <span className="font-medium">{pase.fecha_retorno}</span></div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {pase.requiere_hotel ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    <Building className="w-3 h-3" />
                                                    {pase.hotel_nombre}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-400 text-xs">No requiere</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-semibold">
                                                {pase.estatus}
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
