'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Hospital, Building2, Search, Calendar, Heart, ShieldAlert, Users } from 'lucide-react'

export default function PasesDepartamentoPage() {
    const { profile } = useAuth()
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState('')
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Roles details
    const isDoctorOrAdmin = profile?.rol === 'Médico' || profile?.rol === 'Administrativo'

    useEffect(() => {
        if (profile) {
            fetchDepartamentos()
        }
    }, [profile])

    useEffect(() => {
        if (profile) {
            fetchPases()
        }
    }, [selectedDept, profile])

    const fetchDepartamentos = async () => {
        const { data } = await supabase
            .from('cat_departamentos')
            .select('*')
            .order('departamento')
        if (data) {
            setDepartamentos(data)
            
            // Set initial selected department based on user profile if not admin
            if (!isDoctorOrAdmin && profile?.id_departamento) {
                setSelectedDept(profile.id_departamento)
            }
        }
    }

    const fetchPases = async () => {
        setLoading(true)
        try {
            let activeDeptId = selectedDept
            
            // If they are not admin/doctor and have a department, lock to their department
            if (!isDoctorOrAdmin && profile?.id_departamento) {
                activeDeptId = profile.id_departamento
            }

            let query = supabase
                .from('pases_medicos')
                .select(`
                    *,
                    empleados!inner (id_empleado, nombre, apellido_paterno, puesto, id_departamento),
                    pacientes (nombre_completo, parentesco),
                    clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre),
                    clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre)
                `)
                .eq('compartido_departamentos', true)
                .order('creado_el', { ascending: false })

            // Filter if department is selected/locked
            if (activeDeptId) {
                query = query.eq('empleados.id_departamento', activeDeptId)
            }

            const { data, error } = await query
            if (error) throw error
            setPases(data || [])
        } catch (error) {
            console.error('Error fetching department pases:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header banner */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Hospital className="w-6 h-6 text-amber-500" />
                        Pases Médicos del Departamento
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Control de incidencias de pases médicos y acompañantes compartidos</p>
                </div>
            </div>

            {/* Filter controls */}
            {isDoctorOrAdmin && (
                <div className="bg-white border border-zinc-100 p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-sm">
                    <span className="text-xs font-bold text-zinc-700 uppercase">Filtrar por Departamento:</span>
                    <select
                        value={selectedDept}
                        onChange={e => setSelectedDept(e.target.value)}
                        className="rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold focus:ring-1 focus:ring-amber-500"
                    >
                        <option value="">Todos los departamentos</option>
                        {departamentos.map(d => (
                            <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Locked user department indicator */}
            {!isDoctorOrAdmin && profile?.id_departamento && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span>Visualizando pases del departamento: <strong>{departamentos.find(d => d.id_departamento === profile.id_departamento)?.departamento || 'Cargando...'}</strong></span>
                </div>
            )}

            {/* Table of active shared pases */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
                    <h3 className="font-semibold text-zinc-800 flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-zinc-400" />
                        Relación de Incidencias Médicas Activas
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-4">Empleado / Trabajador</th>
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Trayecto Clínico</th>
                                <th className="px-6 py-4">Fechas Incidencia</th>
                                <th className="px-6 py-4">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-700">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Cargando pases de departamento...</td></tr>
                            ) : pases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-400 font-medium">
                                        No hay incidencias médicas activas registradas para este departamento.
                                    </td>
                                </tr>
                            ) : (
                                pases.map(p => {
                                    const isTrabajador = !p.pacientes?.parentesco || 
                                                         p.pacientes?.parentesco.toUpperCase().includes('ELLA MISMA') || 
                                                         p.pacientes?.parentesco.toUpperCase().includes('EL MISMO') || 
                                                         p.pacientes?.parentesco.toUpperCase().includes('TRABAJADOR')
                                    return (
                                        <tr key={p.id_pase} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-zinc-800">
                                                {p.empleados?.nombre} {p.empleados?.apellido_paterno}
                                                <div className="text-[10px] text-zinc-400 uppercase font-mono font-normal mt-0.5">{p.empleados?.puesto}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-zinc-650">
                                                {p.pacientes?.nombre_completo}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isTrabajador ? (
                                                    <span className="px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 font-bold uppercase text-[9px]">Pase Médico</span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-bold uppercase text-[9px]">Acompañante Médico</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-zinc-500">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="bg-zinc-100 px-2 py-0.5 rounded font-bold text-zinc-700">{p.clinica_origen?.nombre}</span>
                                                    <span>&rarr;</span>
                                                    <span className="bg-zinc-100 px-2 py-0.5 rounded font-bold text-zinc-750 text-zinc-700">{p.clinica_destino?.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-zinc-600">
                                                <div>Salida: <span className="font-bold">{p.fecha_salida}</span></div>
                                                <div>Retorno: <span className="font-bold">{p.fecha_retorno || 'Abierto'}</span></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-semibold uppercase">
                                                    {p.estatus}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
