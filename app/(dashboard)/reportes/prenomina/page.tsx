'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { FileDown, Search, Filter, Calendar, Users, Building, Sparkles, Plus, Clock, PartyPopper, X } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function PrenominaPage() {
    const [loading, setLoading] = useState(false)
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [reportData, setReportData] = useState<any[]>([])
    const [incidentTypes, setIncidentTypes] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState('all')
    const [search, setSearch] = useState('')
    
    // AI State
    const [aiLoading, setAiLoading] = useState(false)
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [modalType, setModalType] = useState<'extras' | 'festivos'>('extras')
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
    const [fechaRegistro, setFechaRegistro] = useState(new Date().toISOString().split('T')[0])
    const [cantidadHoras, setCantidadHoras] = useState(1)
    const [motivo, setMotivo] = useState('')
    const [savingExtra, setSavingExtra] = useState(false)

    useEffect(() => {
        fetchMetadata()
    }, [])

    async function fetchMetadata() {
        const { data: types } = await supabase.from('cat_tipos_incidencia').select('*').eq('activo', true).order('tipo_incidencia')
        const { data: depts } = await supabase.from('cat_departamentos').select('*').eq('activo', true).order('departamento')
        setIncidentTypes(types || [])
        setDepartments(depts || [])
    }

    async function generateReport() {
        setLoading(true)
        try {
            const { data: empleados } = await supabase
                .from('empleados')
                .select(`
                    id_empleado, numero_empleado, nombre, apellido_paterno, apellido_materno,
                    empleado_adscripciones (
                        cat_departamentos (id_departamento, departamento)
                    )
                `)
                .eq('estado_empleado', 'Activo')

            const { data: incidencias } = await supabase
                .from('empleado_incidencias')
                .select('id_empleado, id_tipo_incidencia, fecha_inicio, fecha_fin, estado')
                .gte('fecha_inicio', startDate)
                .lte('fecha_inicio', endDate)
                .eq('estado', 'Aprobada')

            const { data: horasExtras } = await supabase
                .from('empleado_horas_extras')
                .select('id_empleado, fecha, cantidad_horas')
                .gte('fecha', startDate)
                .lte('fecha', endDate)

            const { data: festivos } = await supabase
                .from('empleado_festivos')
                .select('id_empleado, fecha')
                .gte('fecha', startDate)
                .lte('fecha', endDate)

            // Fetch Salarios
            const { data: salarios } = await supabase
                .from('empleado_salarios')
                .select('id_empleado, salario_diario, fecha_inicio_vigencia')

            if (!empleados) return

            const processed = empleados.map(emp => {
                const row: any = {
                    id: emp.id_empleado,
                    numero: emp.numero_empleado,
                    nombre: `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno || ''}`,
                    depto: (emp.empleado_adscripciones?.[0]?.cat_departamentos as any)?.departamento || 'No asignado',
                    deptoId: (emp.empleado_adscripciones?.[0]?.cat_departamentos as any)?.id_departamento,
                    incidencias: {},
                    horasTotales: 0,
                    horasDobles: 0,
                    horasTriples: 0,
                    festivos: 0,
                    salarioDiario: 0
                }

                incidentTypes.forEach(t => row.incidencias[t.id_tipo_incidencia] = 0)

                // Salario Diario (último vigente)
                const empSalarios = salarios?.filter(s => s.id_empleado === emp.id_empleado) || []
                if (empSalarios.length > 0) {
                    const salarioActual = empSalarios.sort((a, b) => new Date(b.fecha_inicio_vigencia).getTime() - new Date(a.fecha_inicio_vigencia).getTime())[0]
                    row.salarioDiario = salarioActual.salario_diario || 0
                }

                // Incidencias
                incidencias?.filter(inc => inc.id_empleado === emp.id_empleado).forEach(inc => {
                    if (row.incidencias[inc.id_tipo_incidencia] !== undefined) {
                        const d1 = new Date(inc.fecha_inicio + 'T12:00:00Z')
                        const d2 = inc.fecha_fin ? new Date(inc.fecha_fin + 'T12:00:00Z') : d1
                        const diff = Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1
                        row.incidencias[inc.id_tipo_incidencia] += diff
                    }
                })

                // Festivos
                row.festivos = festivos?.filter(f => f.id_empleado === emp.id_empleado).length || 0

                // Horas Extras (Agrupación por semana)
                const empExtras = horasExtras?.filter(h => h.id_empleado === emp.id_empleado) || []
                
                // Lógica de cálculo mexicano: Primeras 9 a la SEMANA son dobles, el resto triples.
                // Para simplificar el MVP, sumaremos todas las horas del rango. Si el rango es quincenal, se debería iterar por semanas ISO.
                // Aquí haremos el agrupamiento real por semana:
                const horasPorSemana: Record<string, number> = {}
                
                empExtras.forEach(h => {
                    row.horasTotales += Number(h.cantidad_horas)
                    // Para agrupar por semana, usamos el año y el número de semana
                    const d = new Date(h.fecha + 'T12:00:00Z')
                    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7))
                    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1))
                    const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7)
                    const weekKey = `${d.getUTCFullYear()}-W${weekNo}`
                    
                    horasPorSemana[weekKey] = (horasPorSemana[weekKey] || 0) + Number(h.cantidad_horas)
                })

                let totalDobles = 0
                let totalTriples = 0
                
                Object.values(horasPorSemana).forEach(hrs => {
                    if (hrs <= 9) {
                        totalDobles += hrs
                    } else {
                        totalDobles += 9
                        totalTriples += (hrs - 9)
                    }
                })

                row.horasDobles = totalDobles
                row.horasTriples = totalTriples

                return row
            })

            setReportData(processed)
        } catch (e) {
            console.error(e)
            alert('Error al generar reporte')
        } finally {
            setLoading(false)
        }
    }

    async function handleAnalyze() {
        if (reportData.length === 0) return
        setAiLoading(true)
        setAiAnalysis(null)
        try {
            const res = await fetch('/api/analyze-prenomina', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportData: filteredData,
                    startDate,
                    endDate
                })
            })
            const data = await res.json()
            if (data.analysis) {
                setAiAnalysis(data.analysis)
            } else {
                alert(data.error || 'Error al analizar')
            }
        } catch (error) {
            console.error(error)
            alert('Error de conexión con la IA')
        } finally {
            setAiLoading(false)
        }
    }

    const exportToExcel = () => {
        if (reportData.length === 0) return

        const headers = ['Número', 'Nombre', 'Departamento', 'Salario Diario', 'Horas Dobles', 'Horas Triples', 'Festivos', ...incidentTypes.map(t => t.tipo_incidencia)]
        const data = filteredData.map(row => [
            row.numero,
            row.nombre,
            row.depto,
            row.salarioDiario,
            row.horasDobles,
            row.horasTriples,
            row.festivos,
            ...incidentTypes.map(t => row.incidencias[t.id_tipo_incidencia])
        ])

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pre-Nómina')
        XLSX.writeFile(workbook, `Prenomina_${startDate}_a_${endDate}.xlsx`)
    }

    const saveExtra = async () => {
        if (!selectedEmployee) return
        setSavingExtra(true)
        try {
            if (modalType === 'extras') {
                await supabase.from('empleado_horas_extras').insert({
                    id_empleado: selectedEmployee.id,
                    fecha: fechaRegistro,
                    cantidad_horas: cantidadHoras,
                    motivo: motivo
                })
            } else {
                await supabase.from('empleado_festivos').insert({
                    id_empleado: selectedEmployee.id,
                    fecha: fechaRegistro
                })
            }
            setShowModal(false)
            generateReport() // Refresh data
        } catch (e) {
            alert('Error al guardar registro')
        } finally {
            setSavingExtra(false)
            setMotivo('')
            setCantidadHoras(1)
        }
    }

    const openModal = (emp: any, type: 'extras' | 'festivos') => {
        setSelectedEmployee(emp)
        setModalType(type)
        setShowModal(true)
    }

    const filteredData = reportData.filter(row => {
        const matchesDept = selectedDept === 'all' || row.deptoId === selectedDept
        const matchesSearch = row.nombre.toLowerCase().includes(search.toLowerCase()) ||
            row.numero?.toString().includes(search)
        return matchesDept && matchesSearch
    })

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Reporte de Pre-Nómina</h2>
                    <p className="text-sm text-zinc-500">Gestión de incidencias, horas extras y cálculo de nómina.</p>
                </div>
                {reportData.length > 0 && (
                    <div className="flex space-x-3">
                        <button
                            onClick={handleAnalyze}
                            disabled={aiLoading}
                            className="inline-flex items-center bg-violet-600 text-white px-4 py-2 rounded-md font-bold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Sparkles className="w-5 h-5 mr-2" />
                            {aiLoading ? 'Analizando...' : 'Análisis IA'}
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="inline-flex items-center bg-emerald-600 text-white px-4 py-2 rounded-md font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            <FileDown className="w-5 h-5 mr-2" />
                            Exportar
                        </button>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Fecha Inicio</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="pl-10 w-full border-zinc-300 rounded-md focus:ring-black focus:border-black text-sm text-black"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Fecha Fin</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="pl-10 w-full border-zinc-300 rounded-md focus:ring-black focus:border-black text-sm text-black"
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={generateReport}
                            disabled={loading}
                            className="w-full bg-black text-white py-2.5 rounded-md font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            {loading ? 'Cargando...' : 'Cargar Período'}
                        </button>
                    </div>
                </div>
            </div>

            {reportData.length > 0 && (
                <div className="space-y-4">
                    {/* AI Analysis Panel */}
                    {aiAnalysis && (
                        <div className="bg-violet-50 border border-violet-200 p-6 rounded-xl shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center mb-4">
                                <Sparkles className="w-6 h-6 text-violet-600 mr-2" />
                                <h3 className="text-lg font-bold text-violet-900">Análisis y Recomendaciones de Nómina</h3>
                            </div>
                            <div className="prose prose-sm prose-violet max-w-none text-violet-900">
                                {aiAnalysis.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p> 
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Buscar empleado..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10 w-full border-zinc-200 rounded-lg text-sm text-black h-10 shadow-sm"
                            />
                        </div>
                        <div className="w-full md:w-64 relative">
                            <Building className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                            <select
                                value={selectedDept}
                                onChange={e => setSelectedDept(e.target.value)}
                                className="pl-10 w-full border-zinc-200 rounded-lg text-sm text-black h-10 shadow-sm appearance-none"
                            >
                                <option value="all">Todos los Departamentos</option>
                                {departments.map(d => (
                                    <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm bg-white">
                        <table className="min-w-full divide-y divide-zinc-200">
                            <thead className="bg-zinc-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50 z-10 border-r border-zinc-200">Empleado</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider bg-emerald-50 border-x border-emerald-100">Salario</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider bg-amber-50 border-x border-amber-100" colSpan={3}>Ingresos Extra</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider border-l border-zinc-200" colSpan={incidentTypes.length}>Incidencias (Descuentos)</th>
                                </tr>
                                <tr>
                                    <th className="px-4 py-3 sticky left-0 bg-zinc-50 z-10 border-r border-zinc-200"></th>
                                    <th className="px-4 py-2 text-center text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 border-r border-emerald-100">Diario</th>
                                    <th className="px-4 py-2 text-center text-[10px] font-bold text-amber-700 uppercase bg-amber-50">Hrs Dobles</th>
                                    <th className="px-4 py-2 text-center text-[10px] font-bold text-amber-700 uppercase bg-amber-50">Hrs Triples</th>
                                    <th className="px-4 py-2 text-center text-[10px] font-bold text-amber-700 uppercase bg-amber-50 border-r border-amber-100">Festivos</th>
                                    {incidentTypes.map(t => (
                                        <th key={t.id_tipo_incidencia} className="px-2 py-2 text-center text-[10px] font-bold text-zinc-500 uppercase">
                                            {t.tipo_incidencia.substring(0, 10)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-zinc-200">
                                {filteredData.map((row) => (
                                    <tr key={row.id} className="hover:bg-zinc-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200">
                                            <div className="flex items-center">
                                                <div className="text-xs font-bold text-zinc-900">{row.nombre}</div>
                                            </div>
                                            <div className="text-[10px] text-zinc-500">{row.depto}</div>
                                        </td>
                                        {/* Salario Column */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center bg-emerald-50/30 border-r border-emerald-100/50">
                                            <span className="text-sm font-medium text-zinc-600">${row.salarioDiario.toFixed(2)}</span>
                                        </td>
                                        {/* Horas Extras Column */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center bg-amber-50/30">
                                            <div className="flex items-center justify-center space-x-2">
                                                <span className={`text-sm font-black ${row.horasDobles > 0 ? 'text-amber-600' : 'text-zinc-300'}`}>{row.horasDobles}</span>
                                                <button onClick={() => openModal(row, 'extras')} className="p-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200" title="Agregar Horas Extras">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center bg-amber-50/30">
                                            <span className={`text-sm font-black ${row.horasTriples > 0 ? 'text-rose-600' : 'text-zinc-300'}`}>{row.horasTriples}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center bg-amber-50/30 border-r border-amber-100/50">
                                            <div className="flex items-center justify-center space-x-2">
                                                <span className={`text-sm font-black ${row.festivos > 0 ? 'text-indigo-600' : 'text-zinc-300'}`}>{row.festivos}</span>
                                                <button onClick={() => openModal(row, 'festivos')} className="p-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200" title="Marcar Festivo Trabajado">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                        
                                        {/* Incidencias Columns */}
                                        {incidentTypes.map(t => (
                                            <td key={t.id_tipo_incidencia} className="px-2 py-3 whitespace-nowrap text-center">
                                                <span className={`text-sm font-medium ${row.incidencias[t.id_tipo_incidencia] > 0 ? 'text-rose-600' : 'text-zinc-200'}`}>
                                                    {row.incidencias[t.id_tipo_incidencia]}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan={5 + incidentTypes.length} className="px-6 py-12 text-center text-zinc-500">
                                            No se encontraron empleados con los filtros actuales.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Registro Rapido */}
            {showModal && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className={`p-4 ${modalType === 'extras' ? 'bg-amber-500 text-black' : 'bg-indigo-600 text-white'} flex justify-between items-center`}>
                            <h3 className="font-bold text-lg flex items-center">
                                {modalType === 'extras' ? <Clock className="w-5 h-5 mr-2" /> : <PartyPopper className="w-5 h-5 mr-2" />}
                                Registrar {modalType === 'extras' ? 'Horas Extras' : 'Festivo Trabajado'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="opacity-70 hover:opacity-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-black">
                            <div>
                                <p className="text-sm text-zinc-500 mb-1">Empleado</p>
                                <p className="font-bold">{selectedEmployee.nombre}</p>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Fecha de la Actividad</label>
                                <input 
                                    type="date" 
                                    value={fechaRegistro}
                                    onChange={e => setFechaRegistro(e.target.value)}
                                    min={startDate}
                                    max={endDate}
                                    className="w-full border-zinc-300 rounded-md focus:ring-black focus:border-black"
                                />
                                <p className="text-[10px] text-zinc-400 mt-1">La fecha debe estar dentro del periodo actual.</p>
                            </div>

                            {modalType === 'extras' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Cantidad de Horas</label>
                                        <input 
                                            type="number" 
                                            min="0.5" step="0.5"
                                            value={cantidadHoras}
                                            onChange={e => setCantidadHoras(Number(e.target.value))}
                                            className="w-full border-zinc-300 rounded-md focus:ring-black focus:border-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Motivo / Tarea Realizada (Opcional)</label>
                                        <input 
                                            type="text" 
                                            value={motivo}
                                            onChange={e => setMotivo(e.target.value)}
                                            placeholder="Ej. Cobertura de turno..."
                                            className="w-full border-zinc-300 rounded-md focus:ring-black focus:border-black text-sm"
                                        />
                                    </div>
                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                                        <strong>Regla Automática:</strong> El sistema calculará automáticamente las primeras 9 horas semanales como dobles, y el excedente como triples.
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex justify-end space-x-3">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-zinc-600 font-bold hover:bg-zinc-100 rounded-md transition-colors">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={saveExtra}
                                    disabled={savingExtra}
                                    className={`px-4 py-2 text-white font-bold rounded-md shadow-md transition-colors disabled:opacity-50 ${modalType === 'extras' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {savingExtra ? 'Guardando...' : 'Guardar Registro'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
