'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import { Plus, FileText, Trash2, Edit } from 'lucide-react'

export default function PlantillasPage() {
    const [plantillas, setPlantillas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    useEffect(() => {
        fetchPlantillas()
    }, [])

    async function fetchPlantillas() {
        try {
            const { data, error } = await supabase
                .from('document_templates')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Supabase Error:', error)
                setErrorMsg(`Error: ${error.message}. (Código: ${error.code})`)
            } else {
                setPlantillas(data || [])
            }
        } catch (error: any) {
            console.error('Catch Error:', error)
            setErrorMsg(error.message || 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }

    async function deleteTemplate(id: string) {
        if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return
        try {
            const { error } = await supabase.from('document_templates').delete().eq('id', id)
            if (error) throw error
            setPlantillas(plantillas.filter(p => p.id !== id))
        } catch (e: any) {
            alert('Error al eliminar: ' + e.message)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/documentos" className="text-zinc-400 hover:text-zinc-600">
                        ← Volver
                    </Link>
                    <h2 className="text-2xl font-bold text-slate-800">Plantillas</h2>
                </div>
                <Link href="/documentos/plantillas/nueva" className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 transition-colors">
                    <Plus className="-ml-1 mr-2 h-5 w-5 text-amber-500" />
                    Nueva Plantilla
                </Link>
            </div>

            <div className="bg-white shadow rounded-lg border border-zinc-200 overflow-hidden">
                {errorMsg && (
                    <div className="bg-red-50 p-4 border-b border-red-200 text-red-700 text-sm">
                        No se pudieron cargar las plantillas. Detalles: <strong>{errorMsg}</strong>
                        <br />
                        <span className="text-xs">Verifica que hayas ejecutado el script SQL en Supabase para crear la tabla 'document_templates'.</span>
                    </div>
                )}
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fecha Creación</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-zinc-500">Cargando...</td>
                            </tr>
                        ) : plantillas.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-zinc-500">No hay plantillas creadas.</td>
                            </tr>
                        ) : (
                            plantillas.map((plantilla) => (
                                <tr key={plantilla.id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-zinc-400" />
                                        {plantilla.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 capitalize">{plantilla.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">{new Date(plantilla.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => deleteTemplate(plantilla.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
