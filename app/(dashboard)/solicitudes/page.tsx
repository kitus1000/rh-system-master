'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export default function SolicitudesPage() {
    const [solicitudes, setSolicitudes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('Todos')

    useEffect(() => {
        fetchSolicitudes()
    }, [])

    async function fetchSolicitudes() {
        // Join with types and employees
        const { data, error } = await supabase
            .from('solicitudes')
            .select(`
            *,
            cat_tipos_solicitud(tipo_solicitud),
            empleados!solicitudes_id_empleado_objetivo_fkey(nombre, apellido_paterno)
        `)
            .order('creado_el', { ascending: false })

        if (!error) setSolicitudes(data || [])
        setLoading(false)
    }

    function getStatusColor(status: string) {
        if (status === 'Aprobada' || status === 'Autorizada RH') return 'bg-green-100 text-green-800 text-center'
        if (status === 'Rechazada' || status === 'Cancelada') return 'bg-red-100 text-red-800 text-center'
        if (status === 'Ejecutada') return 'bg-slate-100 text-slate-800 text-center'
        return 'bg-amber-100 text-amber-800 text-center' // En revisión/Pendiente
    }

    // Filter Logic
    const filteredSolicitudes = solicitudes.filter(sol => {
        const type = sol.cat_tipos_solicitud?.tipo_solicitud?.toLowerCase() || ''
        const folio = sol.folio?.toLowerCase() || ''
        const name = sol.empleados ? `${sol.empleados.nombre} ${sol.empleados.apellido_paterno}`.toLowerCase() : ''
        const searchLower = searchTerm.toLowerCase()

        const matchesSearch = type.includes(searchLower) || folio.includes(searchLower) || name.includes(searchLower)
        const matchesStatus = statusFilter === 'Todos' || sol.estatus === statusFilter

        return matchesSearch && matchesStatus
    })

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Centro de Solicitudes</h2>
                    <p className="text-sm text-zinc-500">Gestione vacaciones, bajas y movimientos de personal.</p>
                </div>
                <Link href="/solicitudes/nueva" className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 transition-colors">
                    <Plus className="-ml-1 mr-2 h-5 w-5 text-amber-500" />
                    Nueva Solicitud
                </Link>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Buscar (Folio, Empleado, Tipo)</label>
                    <input
                        type="text"
                        placeholder="Ej. VAC-001, Juan Perez..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black"
                    />
                </div>
                <div className="w-full sm:w-64">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Estatus</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full text-sm border-zinc-300 rounded-md focus:ring-black focus:border-black"
                    >
                        <option value="Todos">Todos</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En revisión">En revisión</option>
                        <option value="Aprobada por Jefe">Aprobada por Jefe</option>
                        <option value="Autorizada RH">Autorizada RH</option>
                        <option value="Ejecutada">Ejecutada</option>
                        <option value="Rechazada">Rechazada</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg bg-white shadow border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-500">Folio / Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-500">Empleado</th>
                            <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-500">Fecha</th>
                            <th className="px-6 py-3 text-center text-xs font-black uppercase tracking-wider text-zinc-500">Estatus</th>
                            <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-wider text-zinc-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                        {loading ? (
                            <tr><td colSpan={5} className="p-4 text-center text-sm text-zinc-500">Cargando solicitudes...</td></tr>
                        ) : filteredSolicitudes.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-sm text-zinc-500 flex flex-col items-center">
                                <FileText className="h-8 w-8 text-zinc-300 mb-2" />
                                No se encontraron solicitudes con estos filtros.
                            </td></tr>
                        ) : (
                            filteredSolicitudes.map((sol) => (
                                <tr key={sol.id_solicitud} className="hover:bg-zinc-50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`p-2 rounded-lg mr-3 ${sol.cat_tipos_solicitud?.tipo_solicitud.includes('Baja') ? 'bg-red-50' : 'bg-blue-50'}`}>
                                                <FileText className={`h-4 w-4 ${sol.cat_tipos_solicitud?.tipo_solicitud.includes('Baja') ? 'text-red-500' : 'text-blue-500'}`} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-zinc-900">{sol.cat_tipos_solicitud?.tipo_solicitud || 'Solicitud'}</div>
                                                <div className="text-xs text-zinc-500 font-mono">{sol.folio}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">
                                        {sol.empleados ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium text-zinc-900">{sol.empleados.nombre} {sol.empleados.apellido_paterno}</span>
                                            </div>
                                        ) : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        <div className="flex items-center">
                                            <Clock className="w-3 h-3 mr-1 text-zinc-400" />
                                            {new Date(sol.creado_el).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusColor(sol.estatus)}`}>
                                            {sol.estatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <Link href={`/solicitudes/${sol.id_solicitud}`} className="text-zinc-400 hover:text-black font-medium transition-colors">
                                            Ver Detalles &rarr;
                                        </Link>
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
