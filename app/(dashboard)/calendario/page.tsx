'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculateDailyStatus, DailyStatus } from '@/utils/rosterLogic'
import * as XLSX from 'xlsx'
import { Download, ChevronLeft, ChevronRight, Loader2, Filter } from 'lucide-react'

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [employees, setEmployees] = useState<any[]>([])
    const [filteredEmployees, setFilteredEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [departments, setDepartments] = useState<any[]>([])
    const [selectedDept, setSelectedDept] = useState<string>('')

    useEffect(() => {
        fetchDepartments()
        fetchData()
    }, [currentDate])

    useEffect(() => {
        filterEmployees()
    }, [selectedDept, employees])

    async function fetchDepartments() {
        const { data } = await supabase.from('cat_departamentos').select('*').eq('activo', true).order('departamento')
        setDepartments(data || [])
    }

    async function fetchData() {
        setLoading(true)
        const start = startOfMonth(currentDate).toISOString()
        const end = endOfMonth(currentDate).toISOString()

        // 1. Fetch Employees with roles, incidents, and latest adscription
        const { data: emps, error: empError } = await supabase
            .from('empleados')
            .select(`
                id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado,
                empleado_roles(
                    fecha_inicio,
                    cat_tipos_rol(id_tipo_rol, tipo_rol, dias_trabajo, dias_descanso)
                ),
                empleado_turnos(
                    fecha_inicio,
                    turnos(nombre)
                ),
                empleado_incidencias(
                    id_incidencia,
                    fecha_inicio, fecha_fin,
                    cat_tipos_incidencia(tipo_incidencia)
                ),
                empleado_adscripciones(
                    id_departamento,
                    cat_departamentos(departamento),
                    fecha_inicio
                )
            `)
            .eq('estado_empleado', 'Activo')
            .order('apellido_paterno')

        if (empError) {
            console.error('Error fetching employees', empError)
            setLoading(false)
            return
        }

        // Process data to get active role and relevant incidents
        const processed = emps?.map((emp: any) => {
            // Get latest active role (start date <= current month end)
            // Simplified: just grab the latest role sorted by date
            // Get latest active role or turno
            const roles = emp.empleado_roles || []
            const activeRole = roles.sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())[0]

            const turnos = emp.empleado_turnos || []
            const activeTurno = turnos.sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())[0]

            let activeEsquema = null
            if (activeRole && activeTurno) {
                if (new Date(activeRole.fecha_inicio) > new Date(activeTurno.fecha_inicio)) {
                    activeEsquema = { tipo: 'rol', data: activeRole }
                } else {
                    activeEsquema = { tipo: 'turno', data: activeTurno }
                }
            } else if (activeRole) {
                activeEsquema = { tipo: 'rol', data: activeRole }
            } else if (activeTurno) {
                activeEsquema = { tipo: 'turno', data: activeTurno }
            }

            // Get current department (latest adscription)
            const adscripciones = emp.empleado_adscripciones || []
            // Sort by start date desc
            const currentAdscription = adscripciones.sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())[0]

            return {
                ...emp,
                activeEsquema,
                departmentId: currentAdscription?.id_departamento,
                departmentName: currentAdscription?.cat_departamentos?.departamento,
                incidents: emp.empleado_incidencias || []
            }
        })

        setEmployees(processed || [])
        setLoading(false)
    }

    function filterEmployees() {
        if (!selectedDept) {
            setFilteredEmployees(employees)
        } else {
            setFilteredEmployees(employees.filter(emp => emp.departmentId === selectedDept))
        }
    }

    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    })

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))

    const exportToExcel = () => {
        const data = filteredEmployees.map(emp => {
            const row: any = {
                'No.': emp.numero_empleado,
                'Nombre': `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno || ''}`,
                'Departamento': emp.departmentName || 'N/A',
                'Esquema': emp.activeEsquema 
                    ? (emp.activeEsquema.tipo === 'rol' ? emp.activeEsquema.data.cat_tipos_rol?.tipo_rol : emp.activeEsquema.data.turnos?.nombre)
                    : 'Sin Esquema'
            }

            daysInMonth.forEach(day => {
                const status = calculateDailyStatus(day, emp.activeEsquema, emp.incidents)
                const dateKey = format(day, 'yyyy-MM-dd')
                // For Excel, we might want just the letter or status
                row[dateKey] = status.status === 'Incidencia' ? status.label : status.label
            })
            return row
        })

        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Asistencia")
        XLSX.writeFile(wb, `Asistencia_${format(currentDate, 'MMMM_yyyy', { locale: es })}.xlsx`)
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Calendario de Asistencia</h1>
                    <p className="text-zinc-500 text-sm">Visualización de roles e incidencias</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Department Filter */}
                    <div className="relative">
                        <select
                            className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none min-w-[200px]"
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                        >
                            <option value="">Todos los departamentos</option>
                            {departments.map(d => (
                                <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                            ))}
                        </select>
                        <Filter className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-zinc-200">
                        <button onClick={handlePrevMonth} className="p-1 hover:bg-zinc-100 rounded">
                            <ChevronLeft className="w-5 h-5 text-zinc-600" />
                        </button>
                        <span className="font-semibold text-zinc-800 min-w-[150px] text-center capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </span>
                        <button onClick={handleNextMonth} className="p-1 hover:bg-zinc-100 rounded">
                            <ChevronRight className="w-5 h-5 text-zinc-600" />
                        </button>
                    </div>

                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            ) : (
                <div className="bg-white border border-zinc-200 rounded-lg shadow overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                                <th className="p-3 text-left text-xs font-bold text-zinc-500 uppercase sticky left-0 bg-zinc-50 z-10 w-[250px] border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    Empleado
                                </th>
                                {daysInMonth.map(day => (
                                    <th key={day.toString()} className="p-2 text-center min-w-[35px] border-r border-zinc-100 last:border-r-0">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-zinc-400 font-medium uppercase">{format(day, 'EEEEE', { locale: es })}</span>
                                            <span className={`text-xs font-bold ${[0, 6].includes(day.getDay()) ? 'text-amber-600' : 'text-zinc-700'}`}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={daysInMonth.length + 1} className="p-8 text-center text-zinc-400">
                                        No se encontraron empleados.
                                    </td>
                                </tr>
                            ) : filteredEmployees.map(emp => (
                                <tr key={emp.id_empleado} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="p-3 sticky left-0 bg-white z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-zinc-700">{emp.apellido_paterno} {emp.apellido_materno}</span>
                                            <span className="text-sm text-zinc-500">{emp.nombre}</span>
                                            <span className="text-[10px] text-zinc-400 mt-0.5 max-w-[200px] truncate">
                                                {emp.departmentName ? <span className="text-amber-600 font-medium mr-1">[{emp.departmentName}]</span> : ''}
                                                {emp.activeEsquema 
                                                    ? (emp.activeEsquema.tipo === 'rol' 
                                                        ? `${emp.activeEsquema.data.cat_tipos_rol.tipo_rol} (${emp.activeEsquema.data.cat_tipos_rol.dias_trabajo}x${emp.activeEsquema.data.cat_tipos_rol.dias_descanso})` 
                                                        : `Turno: ${emp.activeEsquema.data.turnos?.nombre}`) 
                                                    : 'Sin Asignar'}
                                            </span>
                                        </div>
                                    </td>
                                    {daysInMonth.map(day => {
                                        const status = calculateDailyStatus(day, emp.activeEsquema, emp.incidents)
                                        return (
                                            <td key={day.toString()} className="p-0 border-r border-zinc-100 last:border-r-0 relative group h-[60px]">
                                                <div
                                                    className={`w-full h-full flex items-center justify-center text-[10px] font-bold text-white transition-opacity ${status.color}`}
                                                >
                                                    {status.status === 'Incidencia' ? status.label.substring(0, 2).toUpperCase() : status.label}
                                                </div>

                                                {/* Tooltip */}
                                                <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-zinc-900 text-white text-xs p-2 rounded z-20 pointer-events-none shadow-xl transition-opacity">
                                                    <div className="font-bold mb-1">{format(day, 'dd MMM yyyy', { locale: es })}</div>
                                                    <div>{emp.nombre} {emp.apellido_paterno}</div>
                                                    <div>Status: {status.status}</div>
                                                    {status.details && <div className="text-zinc-400">{status.details}</div>}
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
