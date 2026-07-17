'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Hospital, Building2, Search, Heart, ShieldAlert, Users, ClipboardList } from 'lucide-react'

export default function ConsultaMedicaPortal() {
    const { profile } = useAuth()
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState('')
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Doctor, HR or Admin have full access to view any department
    const isDoctorOrAdmin = profile?.rol === 'Médico' || 
                            profile?.rol === 'Administrativo' || 
                            profile?.rol === 'Recursos Humanos' ||
                            (profile?.nombre_completo || '').toUpperCase().includes('RECURSOS')

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
            
            // Lock to profile department if not doctor/admin/HR
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

            if (activeDeptId) {
                query = query.eq('empleados.id_departamento', activeDeptId)
            }

            const { data, error } = await query
            if (error) throw error
            setPases(data || [])
        } catch (error) {
            console.error('Error fetching clinic pases:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-6 bg-white border border-zinc-150 rounded-3xl p-12 shadow-sm relative overflow-hidden">
                {/* Background grid */}
                <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px]" />
                
                {/* Animated pulse rings */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-20 h-20 bg-emerald-500/10 rounded-full animate-ping" />
                    <div className="absolute w-14 h-14 bg-emerald-500/20 rounded-full animate-pulse" />
                    
                    <div className="relative w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <svg className="w-6 h-6 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                </div>

                <div className="text-center space-y-2 relative z-10">
                    <h3 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] animate-pulse">SISTEMA MÉDICO INDUSTRIAL</h3>
                    <p className="text-sm font-black text-zinc-800 uppercase tracking-wide">Obteniendo incidencias de pases autorizados...</p>
                    <p className="text-[10px] text-zinc-400 font-mono">ENLACE SEGURO CON LA CLÍNICA EL HERRERO</p>
                </div>

                {/* ECG Heartbeat SVG path */}
                <div className="w-48 h-6 relative overflow-hidden">
                    <svg className="w-full h-full stroke-emerald-500 stroke-[3] fill-none" viewBox="0 0 100 20">
                        <path d="M0,10 L30,10 L35,5 L40,15 L45,10 L50,10 L53,2 L57,18 L61,10 L65,10 L100,10" 
                              strokeDasharray="100" 
                              strokeDashoffset="100" 
                              className="animate-[ecg_1.8s_linear_infinite]" 
                        />
                    </svg>
                </div>

                <style>{`
                    @keyframes ecg {
                        0% { stroke-dashoffset: 100; }
                        50% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: -100; }
                    }
                `}</style>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative overflow-hidden">
            {/* Background ECG Heartbeat Line Watermark */}
            <div className="absolute top-0 right-0 w-80 h-32 opacity-[0.02] text-emerald-600 pointer-events-none z-0">
                <svg className="w-full h-full stroke-current stroke-1 fill-none" viewBox="0 0 100 20">
                    <path d="M0,10 L30,10 L35,5 L40,15 L45,10 L50,10 L53,2 L57,18 L61,10 L65,10 L100,10" />
                </svg>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-zinc-150 relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform duration-300">
                        <Hospital className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-zinc-800 uppercase tracking-tight flex items-center gap-2">
                            Portal Clínico
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">RH & Clínicas</span>
                        </h1>
                        <p className="text-zinc-500 text-xs mt-0.5">Consulta de incidencias médicas autorizadas y registro diario de pases</p>
                    </div>
                </div>
            </div>

            {/* Filter bar */}
            {isDoctorOrAdmin ? (
                <div className="bg-white border border-zinc-150 p-5 rounded-3xl flex flex-wrap gap-4 items-center shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">Departamento Autorizado:</span>
                    </div>
                    <select
                        value={selectedDept}
                        onChange={e => setSelectedDept(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-black focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-zinc-700 min-w-[220px]"
                    >
                        <option value="">TODOS LOS DEPARTAMENTOS</option>
                        {departamentos.map(d => (
                            <option key={d.id_departamento} value={d.id_departamento}>{(d.departamento || '').toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            ) : (
                profile?.id_departamento && (
                    <div className="bg-emerald-50/50 border border-emerald-100/80 p-4.5 rounded-3xl text-xs font-semibold text-emerald-800 flex items-center gap-3 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                        <Building2 className="w-4.5 h-4.5 text-emerald-600" />
                        <span>Incidencias vigentes de su departamento: <strong className="text-emerald-950 font-black">{departamentos.find(d => d.id_departamento === profile.id_departamento)?.departamento || 'Cargando...'}</strong></span>
                    </div>
                )
            )}

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-150 overflow-hidden relative">
                <div className="p-4 border-b border-zinc-150 bg-zinc-50/50 flex justify-between items-center">
                    <h3 className="font-black text-zinc-700 flex items-center gap-2 text-xs uppercase tracking-widest">
                        <ClipboardList className="w-4 h-4 text-emerald-600" />
                        Registro Diario de Traslados Activos
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-zinc-50/80 text-zinc-500 font-black border-b border-zinc-150 text-[10px] uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Empleado / Trabajador</th>
                                <th className="px-6 py-4">Paciente Relacionado</th>
                                <th className="px-6 py-4">Clasificación / Rol</th>
                                <th className="px-6 py-4">Trayecto Clínico</th>
                                <th className="px-6 py-4">Fechas Incidencia</th>
                                <th className="px-6 py-4">Estatus de Control</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-700">
                            {pases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-bold bg-zinc-50/10">
                                        <div className="space-y-2">
                                            <ShieldAlert className="w-8 h-8 text-zinc-300 mx-auto" />
                                            <div className="text-xs uppercase tracking-wider">Sin incidencias compartidas</div>
                                            <div className="text-[10px] text-zinc-400 font-normal">No hay reportes médicos activos en esta sección.</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pases.map(p => {
                                    const isTrabajador = !p.pacientes?.parentesco || 
                                                         p.pacientes?.parentesco.toUpperCase().includes('ELLA MISMA') || 
                                                         p.pacientes?.parentesco.toUpperCase().includes('EL MISMO') || 
                                                         p.pacientes?.parentesco.toUpperCase().includes('TRABAJADOR')
                                    return (
                                        <tr key={p.id_pase} className="hover:bg-emerald-50/20 transition-all duration-150">
                                            <td className="px-6 py-4.5 font-black text-zinc-800">
                                                {p.empleados?.nombre} {p.empleados?.apellido_paterno}
                                                <div className="text-[9px] text-zinc-400 uppercase font-mono font-bold mt-0.5">{p.empleados?.puesto}</div>
                                            </td>
                                            <td className="px-6 py-4.5 font-bold text-zinc-650">
                                                {p.pacientes?.nombre_completo}
                                            </td>
                                            <td className="px-6 py-4.5">
                                                {isTrabajador ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 font-black uppercase text-[9px] tracking-wider">Pase Médico</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-black uppercase text-[9px] tracking-wider">Acompañante Médico</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4.5 text-xs text-zinc-500 font-bold">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="bg-zinc-100 px-2 py-0.5 rounded font-black text-zinc-700">{p.clinica_origen?.nombre}</span>
                                                    <span className="text-zinc-400 font-normal">&rarr;</span>
                                                    <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-black">{p.clinica_destino?.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4.5 text-xs text-zinc-600 font-mono">
                                                <div>Salida: <span className="font-bold text-zinc-800">{p.fecha_salida}</span></div>
                                                <div>Retorno: <span className="font-bold text-zinc-800">{p.fecha_retorno || 'Abierto'}</span></div>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-black uppercase tracking-wider">
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

