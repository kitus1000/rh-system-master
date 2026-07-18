'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Building2, Plus, MapPin, Edit2, Trash2, CheckCircle2, X } from 'lucide-react'

export default function ClinicasPage() {
    const [clinicas, setClinicas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingClinica, setEditingClinica] = useState<any | null>(null)
    const [formData, setFormData] = useState({ nombre: '', tipo: 'Interna', ubicacion: '' })
    const [filterTipo, setFilterTipo] = useState<'todos' | 'Interna' | 'Externa' | 'Inactivas'>('todos')

    useEffect(() => {
        fetchClinicas()
    }, [])

    const fetchClinicas = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('cat_clinicas').select('*').order('nombre')
        if (data) setClinicas(data)
        setLoading(false)
    }

    const handleEdit = (clinica: any) => {
        setEditingClinica(clinica)
        setFormData({
            nombre: clinica.nombre || '',
            tipo: clinica.tipo || 'Interna',
            ubicacion: clinica.ubicacion || ''
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string, nombre: string, activo: boolean) => {
        if (!activo) {
            if (!confirm(`¿Está seguro de eliminar definitivamente la clínica "${nombre}"?`)) return
            const { error } = await supabase.from('cat_clinicas').delete().eq('id_clinica', id)
            if (!error) {
                fetchClinicas()
            } else {
                alert('No se pudo eliminar definitivamente. Sigue vinculada a registros históricos en la base de datos.')
            }
            return
        }

        if (!confirm(`¿Está seguro de desactivar la clínica "${nombre}"? No aparecerá en los menús de selección de nuevos pases.`)) return
        
        // Intentar primero eliminación física
        const { error: deleteError } = await supabase.from('cat_clinicas').delete().eq('id_clinica', id)
        if (!deleteError) {
            fetchClinicas()
            return
        }

        // Si falla por constraints, desactivamos lógicamente
        const { error: updateError } = await supabase.from('cat_clinicas').update({ activo: false }).eq('id_clinica', id)
        if (!updateError) {
            alert(`La clínica "${nombre}" tiene historial clínico registrado. Se ha desactivado (ocultado de nuevos registros) para proteger la integridad de los datos históricos.`)
            fetchClinicas()
        } else {
            alert('Error al desactivar la clínica.')
        }
    }

    const handleReactivar = async (id: string) => {
        const { error } = await supabase.from('cat_clinicas').update({ activo: true }).eq('id_clinica', id)
        if (!error) {
            fetchClinicas()
        } else {
            alert('Error al reactivar la clínica')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingClinica) {
            const { error } = await supabase.from('cat_clinicas').update({
                nombre: formData.nombre.toUpperCase(),
                tipo: formData.tipo,
                ubicacion: formData.ubicacion.toUpperCase()
            }).eq('id_clinica', editingClinica.id_clinica)

            if (!error) {
                setShowForm(false)
                setEditingClinica(null)
                setFormData({ nombre: '', tipo: 'Interna', ubicacion: '' })
                fetchClinicas()
            } else {
                console.error(error)
                alert('Error al actualizar la clínica: ' + error.message)
            }
        } else {
            const { error } = await supabase.from('cat_clinicas').insert([{
                nombre: formData.nombre.toUpperCase(),
                tipo: formData.tipo,
                ubicacion: formData.ubicacion.toUpperCase(),
                activo: true
            }])

            if (!error) {
                setShowForm(false)
                setFormData({ nombre: '', tipo: 'Interna', ubicacion: '' })
                fetchClinicas()
            } else {
                console.error(error)
                alert('Error al guardar la clínica: ' + error.message)
            }
        }
    }

    const filteredClinicas = clinicas.filter(c => {
        if (filterTipo === 'todos') return true
        if (filterTipo === 'Inactivas') return c.activo === false
        return c.tipo === filterTipo && c.activo !== false
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-amber-500" />
                        Clínicas y Consultorios (Origen y Destino)
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Gestión de clínicas de <strong>Origen (Mina Bacis / Internas)</strong> y clínicas de <strong>Destino (Externas / Ciudades)</strong>
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingClinica(null)
                        setFormData({ nombre: '', tipo: 'Interna', ubicacion: '' })
                        setShowForm(!showForm)
                    }}
                    className="bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
                >
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? 'Cerrar Formulario' : 'Nueva Clínica'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                        <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                            {editingClinica ? <Edit2 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-emerald-500" />}
                            {editingClinica ? `Editar Clínica: ${editingClinica.nombre}` : 'Registrar Nueva Clínica'}
                        </h2>
                        {editingClinica && (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md">
                                Modo Edición
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre de la Clínica / Hospital</label>
                            <input 
                                required
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-500/20"
                                value={formData.nombre}
                                onChange={e => setFormData({...formData, nombre: e.target.value})}
                                placeholder="Ej. SAPIURIS / CLINICA CARDOS / HOSPITAL GENERAL"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Rol / Tipo de Clínica</label>
                            <select 
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-500/20"
                                value={formData.tipo}
                                onChange={e => setFormData({...formData, tipo: e.target.value})}
                            >
                                <option value="Interna">Interna (Clínica de Origen / Mina Bacis / El Herrero)</option>
                                <option value="Externa">Externa (Clínica de Destino / Ciudades / Durango / Especialidad)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Ubicación / Ciudad</label>
                            <input 
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-500/20"
                                value={formData.ubicacion}
                                onChange={e => setFormData({...formData, ubicacion: e.target.value})}
                                placeholder="Ej. BACIS / DURANGO / MAZATLÁN / TORREÓN"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                        {editingClinica && (
                            <button 
                                type="button" 
                                onClick={() => {
                                    setShowForm(false)
                                    setEditingClinica(null)
                                }}
                                className="bg-zinc-100 text-zinc-700 px-5 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200"
                            >
                                Cancelar
                            </button>
                        )}
                        <button type="submit" className="bg-amber-500 text-black px-6 py-2 rounded-xl text-xs font-black hover:bg-amber-400 flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                            {editingClinica ? 'Guardar Cambios' : 'Registrar Clínica'}
                        </button>
                    </div>
                </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-100 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => setFilterTipo('todos')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterTipo === 'todos' ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-600 hover:text-black hover:bg-zinc-100'}`}
                    >
                        <span>🏢 Todas</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">{clinicas.length}</span>
                    </button>
                    <button 
                        onClick={() => setFilterTipo('Interna')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterTipo === 'Interna' ? 'bg-amber-500 text-black shadow-xs' : 'text-zinc-600 hover:text-black hover:bg-zinc-100'}`}
                    >
                        <span>⛏️ Origen (Bacis / Internas)</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{clinicas.filter(c => c.tipo === 'Interna' && c.activo !== false).length}</span>
                    </button>
                    <button 
                        onClick={() => setFilterTipo('Externa')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterTipo === 'Externa' ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-600 hover:text-black hover:bg-zinc-100'}`}
                    >
                        <span>🏥 Destino (Ciudades / Externas)</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">{clinicas.filter(c => c.tipo === 'Externa' && c.activo !== false).length}</span>
                    </button>
                    <button 
                        onClick={() => setFilterTipo('Inactivas')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterTipo === 'Inactivas' ? 'bg-rose-100 text-rose-700 shadow-xs border border-rose-200' : 'text-zinc-650 hover:text-black hover:bg-zinc-100'}`}
                    >
                        <span>❌ Inactivas (Ocultas)</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-200/50">{clinicas.filter(c => c.activo === false).length}</span>
                    </button>
                </div>
                <div className="text-xs text-zinc-400 font-medium">
                    Mostrando {filteredClinicas.length} de {clinicas.length} clínicas
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-10 text-zinc-500">Cargando clínicas...</div>
                ) : filteredClinicas.length === 0 ? (
                    <div className="col-span-full text-center py-10 bg-white rounded-2xl border border-zinc-100 text-zinc-500">
                        No hay clínicas en esta categoría
                    </div>
                ) : (
                    filteredClinicas.map(clinica => (
                        <div key={clinica.id_clinica} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between gap-4 relative overflow-hidden group hover:border-zinc-300 transition-all">
                            <div className={`absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-10 transition-transform group-hover:scale-150 ${clinica.activo === false ? 'bg-zinc-400' : clinica.tipo === 'Interna' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                            
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-3 bg-zinc-50 rounded-xl">
                                        <Building2 className={`w-6 h-6 ${clinica.activo === false ? 'text-zinc-400' : clinica.tipo === 'Interna' ? 'text-amber-500' : 'text-blue-500'}`} />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${clinica.activo === false ? 'bg-zinc-100 text-zinc-500 border border-zinc-200' : clinica.tipo === 'Interna' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-blue-100 text-blue-900 border border-blue-200'}`}>
                                        {clinica.activo === false ? '❌ Inactiva' : clinica.tipo === 'Interna' ? '⛏️ Origen (Bacis)' : '🏥 Destino (Ciudad)'}
                                    </span>
                                </div>
                                
                                <h3 className="text-base font-black text-zinc-800 uppercase tracking-tight">{clinica.nombre}</h3>
                                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mt-2">
                                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>{clinica.ubicacion || 'Sin ubicación especificada'}</span>
                                </div>
                            </div>

                            <div className="flex justify-end items-center gap-2 pt-4 border-t border-zinc-100 mt-2">
                                <button 
                                    onClick={() => handleEdit(clinica)}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-amber-100 hover:text-amber-900 text-zinc-700 text-xs font-bold transition-colors flex items-center gap-1"
                                    title="Editar Clínica"
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> Editar
                                </button>
                                {clinica.activo === false ? (
                                    <button 
                                        onClick={() => handleReactivar(clinica.id_clinica)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors flex items-center gap-1"
                                        title="Reactivar Clínica"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Reactivar
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleDelete(clinica.id_clinica, clinica.nombre, clinica.activo !== false)}
                                        className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-rose-100 hover:text-rose-700 text-zinc-700 text-xs font-bold transition-colors flex items-center gap-1"
                                        title="Desactivar Clínica"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Desactivar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
