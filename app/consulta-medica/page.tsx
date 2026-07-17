'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Hospital, Building2, Search, Calendar, Heart, ShieldAlert } from 'lucide-react'

export default function ConsultaMedicaPublica() {
    const [departamentos, setDepartamentos] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState('')
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    useEffect(() => {
        fetchDepartamentos()
    }, [])

    const fetchDepartamentos = async () => {
        const { data } = await supabase
            .from('cat_departamentos')
            .select('*')
            .order('departamento')
        if (data) setDepartamentos(data)
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedDept) return alert('Por favor, selecciona tu departamento')

        setLoading(true)
        setSearched(true)

        try {
            // Find department name
            const deptObj = departamentos.find(d => d.id_departamento === selectedDept)
            const deptName = deptObj?.departamento || ''
            
            // Check if user is Recursos Humanos or Contabilidad
            const isFullAccess = deptName.toUpperCase().includes('RECURSOS HUMANOS') || 
                                 deptName.toUpperCase().includes('CONTABILIDAD') || 
                                 deptName.toUpperCase().includes('RH') || 
                                 deptName.toUpperCase().includes('ADMIN')

            // Fetch all shared pases medicos
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

            // If not full access, filter by selected department
            if (!isFullAccess) {
                query = query.eq('empleados.id_departamento', selectedDept)
            }

            const { data, error } = await query
            if (error) throw error
            setPases(data || [])
        } catch (error) {
            console.error('Error al buscar pases:', error)
            alert('Ocurrió un error al obtener la información médica.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#07080a] text-zinc-300 font-sans relative overflow-hidden">
            {/* Background design grids */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="mx-auto w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-lg">
                        <Hospital className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xs font-black text-amber-500 tracking-[0.4em] uppercase">Módulo Clínico Público</h1>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Consulta de Pases Médicos</h2>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">Consulte las incidencias médicas de pases autorizados y acompañantes correspondientes a su departamento.</p>
                    </div>
                </div>

                {/* Form selector */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 md:p-8 max-w-xl mx-auto shadow-xl">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Selecciona tu Departamento</label>
                            <select
                                required
                                value={selectedDept}
                                onChange={e => { setSelectedDept(e.target.value); setSearched(false); }}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                            >
                                <option value="">Selecciona...</option>
                                {departamentos.map(d => (
                                    <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg"
                        >
                            {loading ? 'BUSCANDO INCIDENCIAS...' : 'CONSULTAR INCIDENCIAS'}
                            <Search className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                {/* Results block */}
                {searched && (
                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <div className="p-5 border-b border-zinc-800/80 bg-zinc-950/40 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
                                Incidentes Médicos Activos / Compartidos
                            </h3>
                            <span className="text-[10px] text-zinc-500 font-mono">Total: {pases.length}</span>
                        </div>

                        {pases.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500 space-y-2">
                                <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto" />
                                <div className="text-sm font-bold uppercase">Sin incidencias compartidas</div>
                                <div className="text-xs text-zinc-650">No hay pases médicos vigentes o compartidos para este departamento en esta fecha.</div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs font-mono">
                                    <thead className="bg-zinc-950/60 text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                                        <tr>
                                            <th className="p-4">Trabajador</th>
                                            <th className="p-4">Paciente</th>
                                            <th className="p-4">Tipo</th>
                                            <th className="p-4">Origen / Destino</th>
                                            <th className="p-4">Fecha Salida</th>
                                            <th className="p-4">Fecha Retorno</th>
                                            <th className="p-4">Estatus</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/10">
                                        {pases.map(p => {
                                            const isTrabajador = !p.pacientes?.parentesco || 
                                                                 p.pacientes?.parentesco.toUpperCase().includes('ELLA MISMA') || 
                                                                 p.pacientes?.parentesco.toUpperCase().includes('EL MISMO') || 
                                                                 p.pacientes?.parentesco.toUpperCase().includes('TRABAJADOR')
                                            return (
                                                <tr key={p.id_pase} className="hover:bg-zinc-800/20 transition-colors">
                                                    <td className="p-4 text-white font-bold">
                                                        {p.empleados?.nombre} {p.empleados?.apellido_paterno}
                                                    </td>
                                                    <td className="p-4 text-zinc-300">
                                                        {p.pacientes?.nombre_completo}
                                                    </td>
                                                    <td className="p-4">
                                                        {isTrabajador ? (
                                                            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold uppercase text-[9px]">Pase Médico</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase text-[9px]">Acompañante Médico</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-zinc-400">
                                                        {p.clinica_origen?.nombre} &rarr; {p.clinica_destino?.nombre}
                                                    </td>
                                                    <td className="p-4 text-zinc-300">
                                                        {p.fecha_salida}
                                                    </td>
                                                    <td className="p-4 text-zinc-300">
                                                        {p.fecha_retorno || 'Abierto'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase
                                                            ${p.estatus.toUpperCase().includes('GEN') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                                            {p.estatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
