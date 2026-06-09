'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Plus, Search, RefreshCw, FileDown, Upload } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { useRef } from 'react'

export default function EmpleadosPage() {
    const [empleados, setEmpleados] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('Activo') // 'Todos', 'Activo', 'Baja'
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
    const [canManage, setCanManage] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        checkPermissions()
        fetchEmpleados()
    }, [])

    async function checkPermissions() {
        try {
            // Check if user is Admin or HR Manager
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('perfiles')
                    .select('rol, cat_departamentos(departamento)')
                    .eq('id', user.id)
                    .single()

                if (profile) {
                    console.log('--- DEBUG PERMISSIONS ---')
                    console.log('Profile:', profile)
                    const role = profile.rol || ''
                    const isAdmin = role === 'Administrativo' || role === 'Administrador' || role === 'Admin'

                    const deptAny = profile.cat_departamentos as any
                    const deptName = (deptAny?.departamento || (Array.isArray(deptAny) ? deptAny[0]?.departamento : '') || '').toLowerCase()

                    // Robust check: case insensitive
                    const isHR = (role === 'Jefe' && (
                        deptName.includes('recursos') ||
                        deptName.includes('humanos') ||
                        deptName === 'rh'
                    )) || role.toLowerCase().includes('recursos humanos')

                    console.log('Result:', { isAdmin, isHR, role, deptName })
                    setCanManage(isAdmin || isHR)
                }
            }
        } catch (e) {
            console.error('Error in checkPermissions:', e)
            // Fallback: at least let them see if something is wrong
            setCanManage(false)
        }
    }

    async function fetchEmpleados() {
        try {
            const { data, error } = await supabase
                .from('empleados')
                .select(`
                    *,
                    empleado_roles (
                        fecha_inicio,
                        cat_tipos_rol (tipo_rol, dias_trabajo, dias_descanso)
                    )
                `)
                .order('apellido_paterno', { ascending: true })

            if (error) throw error
            setEmpleados(data || [])
        } catch (error) {
            console.error('Error fetching empleados:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSync(id: string) {
        // TODO: Implementar lógica real de sincronización (e.g. recalcular vacaciones)
        alert('Sincronización de vacaciones no implementada aún.')
    }

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const filteredEmpleados = empleados.filter(emp => {
        const matchesSearch =
            emp.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.apellido_paterno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.numero_empleado?.toString().includes(searchTerm)

        const matchesStatus = statusFilter === 'Todos'
            ? true
            : emp.estado_empleado === statusFilter

        return matchesSearch && matchesStatus
    }).sort((a, b) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig

        let valA = a[key]
        let valB = b[key]

        if (typeof valA === 'string') valA = valA.toLowerCase()
        if (typeof valB === 'string') valB = valB.toLowerCase()

        if (valA < valB) return direction === 'asc' ? -1 : 1
        if (valA > valB) return direction === 'asc' ? 1 : -1
        return 0
    })

    const headers = [
        'Número', 'Nombre', 'Paterno', 'Materno', 'Sexo', 'Fecha Nacimiento', 
        'CURP', 'RFC', 'NSS', 'Teléfono', 'Email', 'Estado Civil', 
        'Tipo Residencia', 'Número de Hijos', 'Estado', 'Foto URL'
    ]

    const exportToExcel = () => {
        if (filteredEmpleados.length === 0) return

        const data = filteredEmpleados.map(emp => [
            emp.numero_empleado,
            emp.nombre,
            emp.apellido_paterno,
            emp.apellido_materno || '',
            emp.sexo || '',
            emp.fecha_nacimiento || '',
            emp.curp || '',
            emp.rfc || '',
            emp.nss || '',
            emp.telefono || '',
            emp.correo_electronico || '',
            emp.estado_civil || '',
            emp.tipo_residencia || '',
            emp.hijos_numero || 0,
            emp.estado_empleado,
            emp.foto_url || ''
        ])

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados')
        XLSX.writeFile(workbook, `Directorio_Empleados.xlsx`)
    }

    const downloadTemplate = () => {
        const worksheet = XLSX.utils.aoa_to_sheet([headers])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla')
        XLSX.writeFile(workbook, `Plantilla_Empleados.xlsx`)
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImporting(true)
        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
                const jsonData = XLSX.utils.sheet_to_json(firstSheet)

                if (jsonData.length === 0) throw new Error("El archivo está vacío")

                const nuevosEmpleados = jsonData.map((row: any) => ({
                    numero_empleado: parseInt(row['Número'] || row['Numero']),
                    nombre: row['Nombre'],
                    apellido_paterno: row['Paterno'],
                    apellido_materno: row['Materno'] || null,
                    sexo: row['Sexo'] || null,
                    fecha_nacimiento: row['Fecha Nacimiento'] || row['Fecha de Nacimiento'] ? new Date(row['Fecha Nacimiento'] || row['Fecha de Nacimiento']).toISOString().split('T')[0] : null,
                    curp: row['CURP'] || null,
                    rfc: row['RFC'] || null,
                    nss: row['NSS'] || null,
                    telefono: row['Teléfono'] || row['Telefono'] || null,
                    correo_electronico: row['Email'] || row['Correo'] || null,
                    estado_civil: row['Estado Civil'] || null,
                    tipo_residencia: row['Tipo Residencia'] || null,
                    hijos_numero: parseInt(row['Número de Hijos'] || row['Hijos'] || '0'),
                    estado_empleado: row['Estado'] || 'Activo',
                    foto_url: row['Foto URL'] || null
                })).filter(emp => emp.numero_empleado && emp.nombre && emp.apellido_paterno)

                if (nuevosEmpleados.length === 0) {
                    throw new Error("No se encontraron registros válidos. Columnas obligatorias: Número, Nombre, Paterno.")
                }

                const { error } = await supabase.from('empleados').insert(nuevosEmpleados)
                if (error) throw error

                alert(`Se importaron ${nuevosEmpleados.length} empleados correctamente.`)
                fetchEmpleados()
            } catch (err: any) {
                alert("Error al importar: " + err.message)
            } finally {
                setImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        }
        reader.readAsArrayBuffer(file)
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Directorio de Empleados</h1>
                    <p className="text-sm text-zinc-500">Gestione la información de todo el personal</p>
                </div>
                <div className="flex items-center space-x-3">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleImportExcel} 
                    />
                    <button
                        onClick={downloadTemplate}
                        className="inline-flex items-center px-4 py-2 border border-zinc-300 rounded-md shadow-sm text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none"
                        title="Descargar Plantilla Vacía"
                    >
                        Plantilla
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                        <Upload className="-ml-1 mr-2 h-5 w-5" />
                        {importing ? 'Importando...' : 'Importar Excel'}
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                    >
                        <FileDown className="-ml-1 mr-2 h-5 w-5" />
                        Exportar Todo
                    </button>
                    <Link
                        href="/empleados/nuevo"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-zinc-800 focus:outline-none"
                    >
                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        Nuevo Empleado
                    </Link>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                <div className="relative flex-grow w-full md:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-zinc-400" />
                    </div>
                    <input
                        type="text"
                        className="focus:ring-black focus:border-black block w-full pl-10 sm:text-sm border-zinc-300 rounded-md"
                        placeholder="Buscar por nombre, número de empleado..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-48">
                    <select
                        className="block w-full pl-3 pr-10 py-2 text-base border-zinc-300 focus:outline-none focus:ring-black focus:border-black sm:text-sm rounded-md"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="Activo">Activos</option>
                        <option value="Baja">Bajas</option>
                        <option value="Todos">Todos</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg bg-white shadow border border-zinc-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100"
                                    onClick={() => handleSort('nombre')}
                                >
                                    Empleado {sortConfig?.key === 'nombre' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Rol Actual
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Contacto
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100"
                                    onClick={() => handleSort('estado_empleado')}
                                >
                                    Estado {sortConfig?.key === 'estado_empleado' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-48">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-zinc-500">
                                        Cargando empleados...
                                    </td>
                                </tr>
                            ) : filteredEmpleados.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-zinc-500">
                                        No se encontraron empleados registrados.
                                    </td>
                                </tr>
                            ) : (
                                filteredEmpleados.map((empleado) => {
                                    // Find active role
                                    const roles = empleado.empleado_roles || []
                                    const activeRole = roles.sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())[0]

                                    return (
                                        <tr key={empleado.id_empleado} className="hover:bg-zinc-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 font-bold border border-zinc-300">
                                                        {empleado.nombre.charAt(0)}{empleado.apellido_paterno.charAt(0)}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-zinc-900">
                                                            {empleado.nombre} {empleado.apellido_paterno} {empleado.apellido_materno}
                                                        </div>
                                                        <div className="text-xs text-zinc-500">
                                                            #{empleado.numero_empleado}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {activeRole ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {activeRole.cat_tipos_rol.tipo_rol} ({activeRole.cat_tipos_rol.dias_trabajo}x{activeRole.cat_tipos_rol.dias_descanso})
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-zinc-400 italic">Sin Asignar</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-zinc-900">{empleado.correo_electronico}</div>
                                                <div className="text-sm text-zinc-500">{empleado.telefono}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${empleado.estado_empleado === 'Activo'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {empleado.estado_empleado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-4">
                                                    <Link href={`/empleados/${empleado.id_empleado}`} className="text-amber-600 hover:text-amber-900">
                                                        Ver Perfil
                                                    </Link>
                                                    <button
                                                        onClick={() => handleSync(empleado.id_empleado)}
                                                        className="text-zinc-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                                        title="Sincronizar Vacaciones"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* BUTTON 4: Floating Action Button (Bottom Right) */}
            <Link
                href="/empleados/nuevo"
                className="fixed bottom-8 right-8 h-16 w-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-blue-700 transition-all z-50 animate-bounce"
                title="Nuevo Empleado"
            >
                <Plus className="h-8 w-8" />
            </Link>
        </div >
    )
}
