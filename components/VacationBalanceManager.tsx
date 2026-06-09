'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { calculateEntitlement, getServiceYears, calculateExpirationDate } from '@/utils/vacationLogic'
import { AlertCircle, RefreshCw, Calendar as CalendarIcon } from 'lucide-react'

export function VacationBalanceManager({ idEmpleado, fechaIngreso, isReadOnly = false }: { idEmpleado: string, fechaIngreso: string, isReadOnly?: boolean }) {
    const [balances, setBalances] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [computedInfo, setComputedInfo] = useState<any>(null)

    useEffect(() => {
        if (fechaIngreso) {
            const info = getServiceYears(fechaIngreso)
            setComputedInfo(info)
            fetchBalances()
        }
    }, [idEmpleado, fechaIngreso])

    async function fetchBalances() {
        setLoading(true)
        // Fetch existing records from DB
        const { data: dbBalances, error } = await supabase
            .from('vacaciones_saldos')
            .select(`
                *,
                cat_periodos_vacacionales(periodo)
            `)
            .eq('id_empleado', idEmpleado)

        if (error) {
            console.error("Error fetching balances:", error)
        }

        const existingMap = new Map(dbBalances?.map((b: any) => {
            // Normalize: remove spaces to ensure "2024-2025" matches "2024 - 2025"
            const key = b.cat_periodos_vacacionales?.periodo.replace(/\s/g, '')
            return [key, b]
        }) || [])

        // Generate expected periods based on service years
        // If joined 2023:
        // Period 2023 (Year 1): 12 days
        // Period 2024 (Year 2): 14 days
        // ... up to current year

        const startYear = new Date(fechaIngreso).getFullYear()
        const currentYear = new Date().getFullYear()
        const computedBalances = []

        // Iterate from start year up to current year + 1 (future provision)
        for (let year = startYear; year <= currentYear; year++) {
            const serviceYear = year - startYear + 1
            const daysEntitled = calculateEntitlement(serviceYear)
            // Period Label: START - END (e.g. 2022 - 2023)
            const periodLabel = `${year} - ${year + 1}`

            // Lookup normalized
            const existing = existingMap.get(periodLabel.replace(/\s/g, ''))

            // Calculate Anniversary Date for this period
            const anniversaryDate = new Date(fechaIngreso)
            anniversaryDate.setFullYear(year + 1) // Entitlement generated AFTER completing the year? 
            // Usually: You work 2023-2024. In 2024 you get the days.
            // Let's assume standard: Period 2023 corresponds to the year you STARTED working.
            // You get the right on Feb 2024. Expiration Feb 2025.

            const earnedDate = new Date(fechaIngreso)
            earnedDate.setFullYear(year + 1)

            // Fix: Do not show future periods that are not yet earned
            // If the earned date (anniversary) is in the future, the employee hasn't completed the year yet.
            if (earnedDate > new Date()) continue

            // Expiration date
            const expirationDate = new Date(earnedDate)
            expirationDate.setMonth(expirationDate.getMonth() + 12) // Reverted to 12m per user strict requirement

            const isExpired = new Date() > expirationDate

            computedBalances.push({
                periodo: periodLabel,
                dias_asignados: existing ? existing.dias_asignados : daysEntitled,
                dias_tomados: existing ? existing.dias_tomados : 0,
                dias_restantes: (existing ? existing.dias_asignados : daysEntitled) - (existing ? existing.dias_tomados : 0),
                estatus: isExpired ? 'Expirado' : (new Date() < earnedDate ? 'En curso' : 'Vigente'),
                expirationDate: expirationDate.toLocaleDateString(),
                earnedDate: earnedDate.toLocaleDateString(),
                hasRecord: !!existing,
                id_periodo_db: existing?.id_periodo
            })
        }

        // Sort reverse chronological
        setBalances(computedBalances.reverse())
        setLoading(false)
    }

    async function initializePeriod(balance: any) {
        if (balance.hasRecord) return

        // Find id_periodo for the label (e.g., "2023")
        let { data: periodData } = await supabase
            .from('cat_periodos_vacacionales')
            .select('id_periodo')
            .eq('periodo', balance.periodo)
            .single()

        if (!periodData) {
            // Auto-create period if missing
            const startYear = parseInt(balance.periodo.split(' - ')[0])
            const { data: newPeriod, error: createError } = await supabase
                .from('cat_periodos_vacacionales')
                .insert([{
                    periodo: balance.periodo,
                    fecha_inicio: `${startYear}-01-01`,
                    fecha_fin: `${startYear + 1}-12-31`
                }])
                .select()
                .single()

            if (createError || !newPeriod) {
                alert('Error creando periodo vacacional: ' + (createError?.message || 'Unknown'))
                return
            }
            // Use the new period ID
            periodData = newPeriod
        }

        if (!periodData?.id_periodo) {
            alert('Error crítico: No se pudo obtener ID del periodo.')
            return
        }

        const { error } = await supabase.from('vacaciones_saldos').insert([{
            id_empleado: idEmpleado,
            id_periodo: periodData.id_periodo,
            dias_asignados: balance.dias_asignados,
            dias_tomados: 0
        }])

        if (!error) {
            alert('Sincronización exitosa. El saldo ya está activo en base de datos.')
            fetchBalances()
        }
        else alert('Error guardando saldo: ' + error.message)
    }

    if (!fechaIngreso) return <div className="p-4 text-zinc-400 italic">Fecha de ingreso no registrada.</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center space-x-3">
                    <CalendarIcon className="h-8 w-8 text-blue-600" />
                    <div>
                        <p className="text-xs text-blue-600 font-bold uppercase">Antigüedad</p>
                        <p className="text-lg font-bold text-blue-900">
                            {computedInfo?.years} Años, {computedInfo?.months} Meses
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-blue-600 font-bold uppercase">Próximo Aniversario</p>
                    <p className="text-lg font-bold text-blue-900">{computedInfo?.nextAnniversary?.toLocaleDateString()}</p>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                    <h3 className="font-bold text-zinc-700">Saldos de Vacaciones</h3>
                    <button onClick={fetchBalances} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
                <div className="overflow-auto max-h-[400px]">
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">Periodo</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">Asignados</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">Tomados</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">Restantes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">Vigencia</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-zinc-200">
                            {balances.map((b) => (
                                <tr key={b.periodo} className={b.estatus === 'Expirado' ? 'bg-zinc-50 opacity-60' : 'hover:bg-zinc-50'}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                                        {b.periodo}
                                        <div className="text-xs text-zinc-400 font-normal">Gen: {b.earnedDate}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-zinc-900">{b.dias_asignados}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-zinc-900">{b.dias_tomados}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-green-600">
                                        {Math.max(0, b.dias_restantes)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.estatus === 'Vigente' ? 'bg-green-100 text-green-800' :
                                            b.estatus === 'En curso' ? 'bg-amber-100 text-amber-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {b.estatus}
                                        </span>
                                        {b.estatus !== 'En curso' && <div className="text-xs mt-1">Exp: {b.expirationDate}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {!isReadOnly && !b.hasRecord && b.estatus !== 'En curso' && (
                                            <button
                                                onClick={() => initializePeriod(b)}
                                                className="text-white hover:bg-indigo-700 bg-indigo-600 px-3 py-1 rounded shadow-sm transition-colors text-xs uppercase font-bold"
                                            >
                                                Sincronizar
                                            </button>
                                        )}
                                        {b.hasRecord && <span className="text-zinc-300 italic text-xs">Sincronizado</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-zinc-50 text-xs text-zinc-500 border-t border-zinc-200">
                    * Los periodos "En curso" aún no generan derecho a vacaciones.
                    <br />
                    * La inicialización guarda el saldo en base de datos para permitir descuentos.
                </div>
            </div>
        </div>
    )
}
