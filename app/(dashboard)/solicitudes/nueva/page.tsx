'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, AlertTriangle, Search, XCircle } from 'lucide-react'
import { calculateEntitlement } from '@/utils/vacationLogic'

export default function NuevaSolicitudPage() {
    const router = useRouter()
    const [tipos, setTipos] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showEmployeeList, setShowEmployeeList] = useState(false)

    const [formData, setFormData] = useState({
        id_tipo_solicitud: '',
        id_empleado_objetivo: '',
        comentarios: '',
        // Specialized fields
        fecha_inicio: '',
        fecha_fin: '',
        // Baja Checklist
        baja_motivo: '',
        baja_aviso_jefes: false,
        baja_entrega_materiales: false,
        baja_entrevista_salida: false,
        baja_firma_ratifico: false
    })

    const [correctionPeriods, setCorrectionPeriods] = useState<any[]>([])
    const [correctionData, setCorrectionData] = useState({
        id_periodo: '',
        dias: 1,
        accion: 'Devolver' // 'Devolver' (Refund) or 'Descontar' (Deduct)
    })

    // Adscription Change State
    const [adscriptionData, setAdscriptionData] = useState({
        id_unidad: '',
        id_departamento: '',
        id_puesto: '',
        salario_diario: '',
        es_jefe: false
    })
    const [deptos, setDeptos] = useState<any[]>([])
    const [puestos, setPuestos] = useState<any[]>([])
    const [unidades, setUnidades] = useState<any[]>([])

    // Derived state to know which type is selected
    // Derived state/Search logic
    const filteredEmpleados = empleados.filter(e => {
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase().trim()
        // If numeric, search ID only
        if (!isNaN(Number(term)) && term !== '') {
            return e.numero_empleado?.toString().includes(term)
        }
        // Name search (Nombre + Apellidos)
        const fullName = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
        return fullName.includes(term)
    }).slice(0, 10)

    const selectedEmployeeObj = empleados.find(e => e.id_empleado === formData.id_empleado_objetivo)
    const selectedTypeObj = tipos.find(t => t.id_tipo_solicitud === formData.id_tipo_solicitud)
    const isBaja = selectedTypeObj?.tipo_solicitud?.toLowerCase().includes('baja')
    const isCorreccion = selectedTypeObj?.tipo_solicitud?.toLowerCase().includes('corrección')

    const isAdscripcion = selectedTypeObj?.tipo_solicitud?.toLowerCase().includes('adscripción') || selectedTypeObj?.tipo_solicitud?.toLowerCase().includes('asignación')
    const isVacaciones = selectedTypeObj?.tipo_solicitud?.toLowerCase().includes('vacaciones') && !isCorreccion

    // Vacation Balance Logic
    const [balanceDisponible, setBalanceDisponible] = useState<number | null>(null)
    const [checkingBalance, setCheckingBalance] = useState(false)

    // Helper to calc requested days
    const getRequestedDays = () => {
        if (!formData.fecha_inicio || !formData.fecha_fin) return 0
        const d1 = new Date(formData.fecha_inicio)
        const d2 = new Date(formData.fecha_fin)
        return Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }
    const diasSolicitados = getRequestedDays()

    useEffect(() => {
        if ((isVacaciones || isCorreccion) && formData.id_empleado_objetivo) {
            fetchBalance(formData.id_empleado_objetivo)
        } else {
            setBalanceDisponible(null)
            setCorrectionPeriods([])
        }
    }, [isVacaciones, isCorreccion, formData.id_empleado_objetivo])

    const [balanceExpirado, setBalanceExpirado] = useState<number>(0)

    async function fetchBalance(idEmpleado: string) {
        setCheckingBalance(true)
        setBalanceExpirado(0)

        // 1. Fetch DB Balances (Period Info only)
        const { data: balances } = await supabase
            .from('vacaciones_saldos')
            .select(`
                *,
                cat_periodos_vacacionales(periodo)
            `)
            .eq('id_empleado', idEmpleado)

        if (balances && balances.length > 0) {
            setCorrectionPeriods(balances)
            let totalValid = 0
            let totalExpired = 0
            const now = new Date()

            // Reuse local state for admission date (more reliable)
            const emp = empleados.find(e => e.id_empleado === idEmpleado)
            const empIngreso = emp?.empleado_ingreso
            const fechaIngresoStr = Array.isArray(empIngreso) ? empIngreso[0]?.fecha_ingreso : empIngreso?.fecha_ingreso

            if (fechaIngresoStr) {
                // Strict Date Parsing (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) to avoid timezone shifts
                let ingresoDate: Date
                if (fechaIngresoStr.includes('T')) {
                    ingresoDate = new Date(fechaIngresoStr)
                } else {
                    const [y, m, d] = fechaIngresoStr.split('-').map(Number)
                    ingresoDate = new Date(y, m - 1, d) // Local time, 00:00:00
                }

                balances.forEach((b: any) => {
                    const periodLabel = b.cat_periodos_vacacionales?.periodo || ''
                    // Flexible parse: remove spaces, split by hyphen
                    const normalized = periodLabel.replace(/\s/g, '')
                    const startYearStr = normalized.split('-')[0] // "2024"
                    const earnedYear = parseInt(startYearStr) + 1 // Earned AFTER service year

                    if (!isNaN(earnedYear)) {
                        const earnedDate = new Date(ingresoDate)
                        earnedDate.setFullYear(earnedYear)

                        // Expiration: Earned + 12 months (Strict 1 year validity)
                        const expirationDate = new Date(earnedDate)
                        expirationDate.setMonth(expirationDate.getMonth() + 12)

                        // If NOT expired (Now < Expiration), include it
                        // Optional: Add 1 day buffer if needed, but user asked for strict.
                        if (now < expirationDate) {
                            totalValid += (b.dias_asignados - b.dias_tomados)
                        } else {
                            totalExpired += (b.dias_asignados - b.dias_tomados)
                        }
                    } else {
                        // Fallback if period format unknown
                        totalValid += (b.dias_asignados - b.dias_tomados)
                    }
                })
            } else {
                // Fallback if no admission date
                totalValid = balances.reduce((acc: number, curr: any) => acc + (curr.dias_asignados - curr.dias_tomados), 0)
            }

            setBalanceDisponible(Math.max(0, totalValid))
            setBalanceExpirado(Math.max(0, totalExpired))
        } else {
            // 2. If no DB balances, calculate theoretical
            let debugInfo = ''
            const emp = empleados.find(e => e.id_empleado === idEmpleado)

            // Handle nested relationship safe access
            const fechaIngresoRaw = emp?.empleado_ingreso
            const fechaIngresoStr = Array.isArray(fechaIngresoRaw) ? fechaIngresoRaw[0]?.fecha_ingreso : fechaIngresoRaw?.fecha_ingreso

            if (emp && fechaIngresoStr) {
                // Ensure correct timezone handling by appending T00:00:00 if just YYYY-MM-DD
                const safeDateStr = fechaIngresoStr.includes('T') ? fechaIngresoStr : `${fechaIngresoStr}T00:00:00`
                const ingresoDate = new Date(safeDateStr)

                const currentYear = new Date().getFullYear()
                const startYear = ingresoDate.getFullYear()

                let theoreticalTotal = 0
                let yearsOfService = 0

                // Calculate only VALID entitlements (not expired)
                // In Mexico, vacations are claimable for 18 months after they are generated.
                for (let year = startYear; year <= currentYear; year++) {
                    const anniversary = new Date(ingresoDate)
                    anniversary.setFullYear(year + 1)

                    // If anniversary has passed, the right was generated
                    if (anniversary <= new Date()) {
                        // Expiration date: Anniversary + 12 months (1 year validity)
                        const expirationDate = new Date(anniversary)
                        expirationDate.setMonth(expirationDate.getMonth() + 12)

                        // Only add if NOT expired (the right is still valid)
                        if (new Date() < expirationDate) {
                            const serviceYear = year - startYear + 1
                            theoreticalTotal += calculateEntitlement(serviceYear)
                            yearsOfService = serviceYear
                            // debugInfo += `Year ${serviceYear}: Active\n`
                        } else {
                            // debugInfo += `Year ${year - startYear + 1}: Expired\n`
                        }
                    }
                }

                setBalanceDisponible(theoreticalTotal)
                console.log(`Calculated for ${emp.nombre}: Start=${startYear}, ServiceYears=${yearsOfService}, Total=${theoreticalTotal}`)
            } else {
                setBalanceDisponible(0)
            }
        }
        setCheckingBalance(false)
    }

    async function loadData() {
        // Fetch types
        const { data: t } = await supabase.from('cat_tipos_solicitud').select('*').eq('activo', true)
        setTipos(t || [])

        // Fetch Catalogs for Adscription
        const { data: d } = await supabase.from('cat_departamentos').select('*').order('departamento')
        setDeptos(d || [])
        const { data: p } = await supabase.from('cat_puestos').select('*').order('puesto')
        setPuestos(p || [])
        const { data: u } = await supabase.from('cat_unidades_trabajo').select('*').order('unidad_trabajo')
        setUnidades(u || [])

        // Fetch ALL employees (debug: removed status filter)
        const { data: e, error } = await supabase.from('empleados')
            .select('id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, empleado_ingreso(fecha_ingreso)')
            .order('nombre', { ascending: true })

        if (error) {
            alert('Error cargando empleados: ' + error.message)
        }
        setEmpleados(e || [])
    }

    useEffect(() => {
        loadData()
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!formData.id_empleado_objetivo) {
            alert('Por favor seleccione un empleado')
            return
        }

        const payload: any = { comentarios: formData.comentarios }

        if (isVacaciones) {
            payload.fecha_inicio = formData.fecha_inicio
            payload.fecha_fin = formData.fecha_fin
        }

        if (isCorreccion) {
            if (!correctionData.id_periodo) {
                alert('Seleccione el periodo a corregir')
                return
            }
            payload.id_periodo = correctionData.id_periodo
            payload.dias = correctionData.dias
            payload.accion = correctionData.accion
            payload.es_correccion = true
        }

        if (isBaja) {
            payload.motivo_baja = formData.baja_motivo
            payload.checklist = {
                aviso_jefes: formData.baja_aviso_jefes,
                entrega_materiales: formData.baja_entrega_materiales,
                entrevista_salida: formData.baja_entrevista_salida,
                firma_ratifico: formData.baja_firma_ratifico
            }
        }


        if (isAdscripcion) {
            if (!adscriptionData.id_departamento || !adscriptionData.id_puesto || !adscriptionData.id_unidad) {
                alert('Complete todos los campos de la nueva asignación')
                return
            }
            payload.id_nuevo_departamento = adscriptionData.id_departamento
            payload.id_nuevo_puesto = adscriptionData.id_puesto
            payload.id_nueva_unidad = adscriptionData.id_unidad
            payload.nuevo_salario = adscriptionData.salario_diario
            payload.es_jefe = adscriptionData.es_jefe
        }

        const { error } = await supabase.from('solicitudes').insert([{
            id_tipo_solicitud: formData.id_tipo_solicitud,
            id_empleado_objetivo: formData.id_empleado_objetivo,
            estatus: 'En revisión',
            payload: payload,
            folio: `SOL-${Date.now().toString().slice(-6)}`
        }])

        if (error) {
            alert('Error: ' + error.message)
        } else {
            router.push('/solicitudes')
        }
    }

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-zinc-900 mb-6 uppercase tracking-wide">Nueva Solicitud</h2>

            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. Tipo de Solicitud */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Tipo de Solicitud</label>
                        <select
                            className="block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900 bg-white"
                            value={formData.id_tipo_solicitud}
                            onChange={(e) => setFormData({ ...formData, id_tipo_solicitud: e.target.value })}
                            required
                        >
                            <option value="">-- Seleccione el trámite --</option>
                            {tipos.map(t => (
                                <option key={t.id_tipo_solicitud} value={t.id_tipo_solicitud}>{t.tipo_solicitud}</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Empleado (Searchable) */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Empleado</label>

                        {selectedEmployeeObj ? (
                            <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                                <div>
                                    <div className="font-bold text-zinc-900">
                                        {selectedEmployeeObj.nombre} {selectedEmployeeObj.apellido_paterno} {selectedEmployeeObj.apellido_materno || ''}
                                    </div>
                                    <div className="text-xs text-zinc-500">ID: {selectedEmployeeObj.numero_empleado}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData({ ...formData, id_empleado_objetivo: '' })
                                        setSearchTerm('')
                                    }}
                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-zinc-400" />
                                </div>
                                <input
                                    type="text"
                                    autoComplete="off"
                                    className="block w-full pl-10 rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900 bg-white"
                                    placeholder="Buscar por ID o Apellido..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value)
                                        setShowEmployeeList(true)
                                    }}
                                    onFocus={() => setShowEmployeeList(true)}
                                />
                                {showEmployeeList && (
                                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-zinc-200">
                                        {filteredEmpleados.length === 0 ? (
                                            <div className="cursor-default select-none relative py-2 px-4 text-zinc-500">
                                                No se encontraron resultados.
                                            </div>
                                        ) : (
                                            filteredEmpleados.map((emp: any) => (
                                                <div
                                                    key={emp.id_empleado}
                                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-amber-50"
                                                    onClick={() => {
                                                        setFormData({ ...formData, id_empleado_objetivo: emp.id_empleado })
                                                        setSearchTerm(`${emp.nombre} ${emp.apellido_paterno}`)
                                                        setShowEmployeeList(false)
                                                    }}
                                                >
                                                    <div className="flex items-center">
                                                        <span className="font-medium block truncate text-zinc-900">
                                                            {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''}
                                                        </span>
                                                        <span className="ml-2 text-zinc-400 text-xs">#{emp.numero_empleado}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="text-xs text-zinc-400 mt-1">
                            Total cargados: {empleados.length}
                        </div>
                    </div>

                    {/* CONDITIONAL: VACACIONES */}
                    {isVacaciones && (
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-100 grid grid-cols-2 gap-4 animate-in fade-in">
                            <div className="col-span-2 flex justify-between items-center">
                                <h4 className="text-sm font-bold text-blue-800 mb-2">Detalles de Vacaciones</h4>
                                {checkingBalance ? (
                                    <span className="text-xs text-blue-500">Verificando saldo...</span>
                                ) : (
                                    balanceDisponible !== null && (
                                        <div className={`text-sm font-bold px-3 py-1 rounded-full ${diasSolicitados > balanceDisponible ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            Saldo Vigente: {balanceDisponible} días
                                            {balanceExpirado > 0 && (
                                                <span className="ml-2 text-xs font-normal text-zinc-500">
                                                    (Expirados: {balanceExpirado})
                                                </span>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-700 mb-1">Fecha Inicio</label>
                                <input type="date" required className="w-full text-sm border-blue-200 rounded-md text-blue-900 bg-white"
                                    value={formData.fecha_inicio} onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-700 mb-1">Fecha Fin</label>
                                <input type="date" required className="w-full text-sm border-blue-200 rounded-md text-blue-900 bg-white"
                                    value={formData.fecha_fin} onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })} />
                            </div>

                            <div className="col-span-2">
                                <div className="flex justify-between text-xs text-blue-600 border-t border-blue-200 pt-2 mt-2">
                                    <span>* Requiere autorización del Jefe de Departamento.</span>
                                    <span>Días solicitados: <strong>{diasSolicitados}</strong></span>
                                </div>
                                {balanceDisponible !== null && diasSolicitados > balanceDisponible && (
                                    <div className="mt-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded">
                                        Advertencia: Estás solicitando más días de los disponibles ({balanceDisponible}).
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONDITIONAL: CORRECCIÓN */}
                    {isCorreccion && (
                        <div className="bg-amber-50 p-4 rounded-md border border-amber-200 space-y-4 animate-in fade-in">
                            <h4 className="text-sm font-bold text-amber-800 flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Ajuste Manual de Saldo
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-amber-900 mb-1">Periodo Afectado</label>
                                    <select
                                        className="w-full text-sm border-amber-200 rounded-md text-zinc-900 bg-white"
                                        value={correctionData.id_periodo}
                                        onChange={(e) => setCorrectionData({ ...correctionData, id_periodo: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Seleccionar Periodo --</option>
                                        {correctionPeriods.map(p => (
                                            <option key={p.id_periodo} value={p.id_periodo}>
                                                {p.cat_periodos_vacacionales?.periodo} ({p.dias_asignados - p.dias_tomados} disp)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-amber-900 mb-1">Acción</label>
                                    <select
                                        className="w-full text-sm border-amber-200 rounded-md text-zinc-900 bg-white"
                                        value={correctionData.accion}
                                        onChange={(e) => setCorrectionData({ ...correctionData, accion: e.target.value })}
                                    >
                                        <option value="Devolver">Devolver (Sumar a Disponibles)</option>
                                        <option value="Descontar">Descontar (Restar a Disponibles)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-amber-900 mb-1">Días</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="w-full text-sm border-amber-200 rounded-md text-zinc-900 bg-white"
                                        value={correctionData.dias}
                                        onChange={(e) => setCorrectionData({ ...correctionData, dias: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-amber-700 italic border-t border-amber-200 pt-2">
                                * Esta corrección requiere aprobación de RH antes de aplicarse.
                            </p>
                        </div>
                    )}

                    {/* CONDITIONAL: ADSCRIPCIÓN */}
                    {isAdscripcion && (
                        <div className="bg-zinc-50 p-6 rounded-md border border-zinc-200 space-y-4 animate-in fade-in">
                            <h4 className="text-sm font-bold text-zinc-800 border-b pb-2 mb-4">Nueva Asignación / Cambio</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">Nueva Unidad de Trabajo</label>
                                    <select
                                        className="w-full text-sm border-zinc-300 rounded-md text-zinc-900"
                                        value={adscriptionData.id_unidad}
                                        onChange={e => setAdscriptionData({ ...adscriptionData, id_unidad: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {unidades.map(u => <option key={u.id_unidad} value={u.id_unidad}>{u.unidad_trabajo}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">Nuevo Departamento</label>
                                    <select
                                        className="w-full text-sm border-zinc-300 rounded-md text-zinc-900"
                                        value={adscriptionData.id_departamento}
                                        onChange={e => setAdscriptionData({ ...adscriptionData, id_departamento: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {deptos.map(d => <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">Nuevo Puesto</label>
                                    <select
                                        className="w-full text-sm border-zinc-300 rounded-md text-zinc-900"
                                        value={adscriptionData.id_puesto}
                                        onChange={e => setAdscriptionData({ ...adscriptionData, id_puesto: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {puestos.map(p => <option key={p.id_puesto} value={p.id_puesto}>{p.puesto}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">Nuevo Salario Diario (Opcional)</label>
                                    <input
                                        type="number"
                                        className="w-full text-sm border-zinc-300 rounded-md text-zinc-900"
                                        placeholder="0.00"
                                        value={adscriptionData.salario_diario}
                                        onChange={e => setAdscriptionData({ ...adscriptionData, salario_diario: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                            checked={adscriptionData.es_jefe}
                                            onChange={e => setAdscriptionData({ ...adscriptionData, es_jefe: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium text-zinc-700">¿Será Jefe de Área?</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {isBaja && (
                        <div className="bg-red-50 p-6 rounded-md border border-red-100 space-y-4 animate-in fade-in">
                            <div className="flex items-center gap-2 mb-2 border-b border-red-200 pb-2">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                <h4 className="text-md font-bold text-red-800">Proceso de Baja / Terminación</h4>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-red-900 mb-1">Motivo de Baja</label>
                                <textarea className="w-full text-sm border-red-200 rounded-md text-red-900 bg-white" rows={2} required
                                    value={formData.baja_motivo} onChange={e => setFormData({ ...formData, baja_motivo: e.target.value })} placeholder="Describa el motivo..." />
                            </div>

                            <div className="space-y-3 pt-2">
                                <label className="flex items-center space-x-3">
                                    <input type="checkbox" className="h-5 w-5 text-red-600 border-red-300 rounded focus:ring-red-500"
                                        checked={formData.baja_aviso_jefes} onChange={e => setFormData({ ...formData, baja_aviso_jefes: e.target.checked })} />
                                    <span className="text-sm text-red-900">Se realizó aviso a los Jefes de Departamento correspondientes.</span>
                                </label>
                                <label className="flex items-center space-x-3">
                                    <input type="checkbox" className="h-5 w-5 text-red-600 border-red-300 rounded focus:ring-red-500"
                                        checked={formData.baja_entrega_materiales} onChange={e => setFormData({ ...formData, baja_entrega_materiales: e.target.checked })} />
                                    <span className="text-sm text-red-900">Entrega de materiales y herramientas completa.</span>
                                </label>
                                <label className="flex items-center space-x-3">
                                    <input type="checkbox" className="h-5 w-5 text-red-600 border-red-300 rounded focus:ring-red-500"
                                        checked={formData.baja_entrevista_salida} onChange={e => setFormData({ ...formData, baja_entrevista_salida: e.target.checked })} />
                                    <span className="text-sm text-red-900">Entrevista de salida realizada.</span>
                                </label>
                                <label className="flex items-center space-x-3">
                                    <input type="checkbox" className="h-5 w-5 text-red-600 border-red-300 rounded focus:ring-red-500"
                                        checked={formData.baja_firma_ratifico} onChange={e => setFormData({ ...formData, baja_firma_ratifico: e.target.checked })} />
                                    <span className="text-sm font-bold text-red-900">Firma de renuncia con leyenda "RATIFICO".</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Comentarios Generales</label>
                        <textarea
                            className="block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900 bg-white"
                            rows={3}
                            value={formData.comentarios}
                            onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            className="flex items-center justify-center rounded-md bg-black px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-zinc-800 transition-all"
                        >
                            <Save className="mr-2 h-4 w-4 text-amber-500" />
                            Enviar Solicitud
                        </button>
                    </div>

                </form>
            </div>
        </div>
    )
}
