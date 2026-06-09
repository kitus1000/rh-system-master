'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { ArrowLeft, CheckCircle, XCircle, Printer, AlertTriangle, Undo2 } from 'lucide-react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function SolicitudDetallePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const [solicitud, setSolicitud] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState<any>({})
    const [catalogs, setCatalogs] = useState<{ caasalBaja: any[], causalImss: any[] }>({ caasalBaja: [], causalImss: [] })

    useEffect(() => {
        if (id) {
            fetchSolicitud()
            fetchCatalogs()
            fetchCompanyConfig()
        }
    }, [id])

    async function fetchCompanyConfig() {
        const { data } = await supabase
            .from('configuracion_empresa')
            .select('*')
            .limit(1)
            .single()

        if (data) {
            setConfig(data)
        } else {
            const savedConfig = localStorage.getItem('rh_config_empresa')
            if (savedConfig) setConfig(JSON.parse(savedConfig))
        }
    }

    async function fetchCatalogs() {
        const { data: b } = await supabase.from('cat_causas_baja').select('*')
        const { data: i } = await supabase.from('cat_causas_baja_imss').select('*')
        setCatalogs({ caasalBaja: b || [], causalImss: i || [] })
    }

    async function fetchSolicitud() {
        const { data, error } = await supabase
            .from('solicitudes')
            .select(`
                *,
                cat_tipos_solicitud(tipo_solicitud),
                empleados!solicitudes_id_empleado_objetivo_fkey(
                    nombre, apellido_paterno,
                    empleado_adscripciones(
                        cat_departamentos(departamento),
                        cat_puestos(puesto)
                    )
                )
            `)
            .eq('id_solicitud', id)
            .single()

        if (!error) setSolicitud(data)
        setLoading(false)
    }

    async function createAutoIncident(solicitudData: any) {
        // No try-catch here, let parent handle it
        const tipoSolicitudName = solicitudData.cat_tipos_solicitud?.tipo_solicitud
        if (!tipoSolicitudName) throw new Error('Tipo de solicitud no definido')

        // 1. Find matching incident type
        let matchQuery = supabase
            .from('cat_tipos_incidencia')
            .select('*')

        // Try explicit match first
        const { data: exactMatches } = await matchQuery.ilike('tipo_incidencia', tipoSolicitudName)

        let idTipoIncidencia = ''

        if (exactMatches && exactMatches.length > 0) {
            idTipoIncidencia = exactMatches[0].id_tipo_incidencia
        } else {
            // Fallback: If it's vacations, look for "Vacaciones"
            if (tipoSolicitudName.toLowerCase().includes('vacaciones')) {
                const { data: vacMatch } = await supabase.from('cat_tipos_incidencia').select('*').ilike('tipo_incidencia', '%vacaciones%').limit(1)
                if (vacMatch && vacMatch.length > 0) idTipoIncidencia = vacMatch[0].id_tipo_incidencia
            }
        }

        if (!idTipoIncidencia) {
            throw new Error(`No se encontró un Tipo de Incidencia que coincida con "${tipoSolicitudName}". Por favor verifique el catálogo de incidencias.`)
        }

        const payload = solicitudData.payload || {}

        // 2. Calculate days
        let dias = 1
        if (payload.fecha_inicio && payload.fecha_fin) {
            const d1 = new Date(payload.fecha_inicio)
            const d2 = new Date(payload.fecha_fin)
            const diffTime = Math.abs(d2.getTime() - d1.getTime())
            dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        }

        // 3. Create Incident
        const { error } = await supabase.from('empleado_incidencias').insert([{
            id_empleado: solicitudData.id_empleado_objetivo,
            id_tipo_incidencia: idTipoIncidencia,
            fecha_inicio: payload.fecha_inicio || new Date().toISOString().split('T')[0],
            fecha_fin: payload.fecha_fin || new Date().toISOString().split('T')[0],
            comentarios: `Generada automáticamente desde Solicitud #${solicitudData.folio}`,
            estado: 'Aprobada'
        }])

        if (error) throw error
    }
    async function updateVacationBalance(idEmpleado: string, payload: any, operation: 'deduct' | 'refund' | 'correction') {
        try {
            // Special Case: Correction
            if (operation === 'correction') {
                const { id_periodo, dias, accion } = payload
                if (!id_periodo || !dias) return

                const { data: currentBalance } = await supabase
                    .from('vacaciones_saldos')
                    .select('dias_tomados')
                    .eq('id_empleado', idEmpleado)
                    .eq('id_periodo', id_periodo)
                    .single()

                if (currentBalance) {
                    let newTaken = currentBalance.dias_tomados
                    if (accion === 'Devolver') {
                        newTaken = Math.max(0, currentBalance.dias_tomados - dias)
                    } else { // Descontar
                        newTaken = currentBalance.dias_tomados + dias
                    }

                    await supabase
                        .from('vacaciones_saldos')
                        .update({ dias_tomados: newTaken })
                        .eq('id_empleado', idEmpleado)
                        .eq('id_periodo', id_periodo)
                }
                return
            }

            // Calculate days
            let dias = 0
            if (payload.fecha_inicio && payload.fecha_fin) {
                const d1 = new Date(payload.fecha_inicio)
                const d2 = new Date(payload.fecha_fin)
                const diffTime = Math.abs(d2.getTime() - d1.getTime())
                dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            }
            if (dias <= 0) return

            // Fetch balances
            // Fetch balances AND employee info for expiration calc
            const { data: balancesRaw } = await supabase
                .from('vacaciones_saldos')
                .select(`
                    *,
                    cat_periodos_vacacionales(periodo),
                    empleados!inner(
                        empleado_ingreso(fecha_ingreso)
                    )
                `)
                .eq('id_empleado', idEmpleado)
                .order('id_periodo', { ascending: true })

            // Note: sort logic might need to rely on period string year if id_periodo isn't chronological
            // But usually older periods are inserted first. Let's assume ID sort is roughly OK, 
            // OR sort manually by parsed year to be safe.

            if (!balancesRaw) return

            // Sort by Year extracted from Period Label (Ascending = Oldest first)
            const balances = balancesRaw.sort((a: any, b: any) => {
                const yA = parseInt(a.cat_periodos_vacacionales?.periodo?.split(' - ')[0] || '0')
                const yB = parseInt(b.cat_periodos_vacacionales?.periodo?.split(' - ')[0] || '0')
                return yA - yB
            })

            // Get admission date
            const empIngreso = balances[0]?.empleados?.empleado_ingreso
            const fechaIngresoStr = Array.isArray(empIngreso) ? empIngreso[0]?.fecha_ingreso : empIngreso?.fecha_ingreso
            const now = new Date()

            let daysToProcess = dias
            const updates = []

            if (operation === 'deduct') {
                // FIFO: Consume from oldest available BUT valid
                for (const balance of balances) {
                    if (daysToProcess <= 0) break

                    // VALIDITY CHECK
                    let isExpired = false
                    if (fechaIngresoStr) {
                        // Strict Date Parsing
                        let ingresoDate: Date
                        if (fechaIngresoStr.includes('T')) {
                            ingresoDate = new Date(fechaIngresoStr)
                        } else {
                            const [y, m, d] = fechaIngresoStr.split('-').map(Number)
                            ingresoDate = new Date(y, m - 1, d)
                        }

                        const periodLabel = balance.cat_periodos_vacacionales?.periodo || ''
                        // Flexible parse
                        const normalized = periodLabel.replace(/\s/g, '')
                        const startYearStr = normalized.split('-')[0] // "2024"
                        const earnedYear = parseInt(startYearStr) + 1 // Earned AFTER service year

                        if (!isNaN(earnedYear)) {
                            const earnedDate = new Date(ingresoDate)
                            earnedDate.setFullYear(earnedYear)

                            const expirationDate = new Date(earnedDate)
                            expirationDate.setMonth(expirationDate.getMonth() + 12) // Strict 12m validity

                            if (now > expirationDate) {
                                isExpired = true
                                console.log(`Skipping expired balance for deduction: ${periodLabel}`)
                            }
                        }
                    }

                    if (isExpired) continue // Skip this bucket

                    const available = balance.dias_asignados - balance.dias_tomados
                    if (available > 0) {
                        const take = Math.min(available, daysToProcess)
                        updates.push({
                            id_empleado: balance.id_empleado,
                            id_periodo: balance.id_periodo,
                            dias_tomados: balance.dias_tomados + take
                        })
                        daysToProcess -= take
                    }
                }
                if (daysToProcess > 0) {
                    alert(`Advertencia: El empleado no tiene suficiente saldo VIGENTE. Quedarán ${daysToProcess} días sin cubrir.`)
                }
            } else {
                // Refund: Put back to newest (or simply reverse FIFO? usually LIFO to save expiration)
                // Let's reverse balances to fill newest first
                const reversedBalances = [...balances].reverse()

                for (const balance of reversedBalances) {
                    if (daysToProcess <= 0) break

                    // We can only refund what was taken. Ideally we track exact consumption.
                    // Simplification: Refund to any bucket that has dias_tomados > 0
                    if (balance.dias_tomados > 0) {
                        const giveBack = Math.min(balance.dias_tomados, daysToProcess)
                        updates.push({
                            id_empleado: balance.id_empleado,
                            id_periodo: balance.id_periodo,
                            dias_tomados: balance.dias_tomados - giveBack
                        })
                        daysToProcess -= giveBack
                    }
                }
            }

            // Perform updates
            for (const update of updates) {
                await supabase
                    .from('vacaciones_saldos')
                    .update({ dias_tomados: update.dias_tomados })
                    .eq('id_empleado', update.id_empleado)
                    .eq('id_periodo', update.id_periodo)
            }

        } catch (error) {
            console.error("Error updating balances:", error)
        }
    }

    async function handleDecision(decision: 'Aprobada' | 'Rechazada' | 'Cancelada') {
        let nuevoEstatus: string = decision
        let updateData: any = { estatus: nuevoEstatus }

        // Logic for Approval:
        const currentStatus = solicitud.estatus
        const tipoSolicitud = solicitud.cat_tipos_solicitud?.tipo_solicitud?.toLowerCase() || ''
        const isBaja = tipoSolicitud.includes('baja')
        const isReingreso = tipoSolicitud.includes('reingreso')

        if (decision === 'Aprobada') {
            if (isBaja) {
                // 2-Step Approval for Baja
                if (currentStatus === 'Pendiente' || currentStatus === 'En revisión') {
                    nuevoEstatus = 'Aprobada por Jefe'
                } else if (currentStatus === 'Aprobada por Jefe') {
                    // Boss already approved, now RH.
                    const pin = prompt("AUTORIZACIÓN RH:\nIngrese clave para finalizar la baja:")
                    if (pin !== 'RH2026') return
                    nuevoEstatus = 'Autorizada RH'
                }
            } else if (isReingreso) {
                // Direct Approval for Reingreso (RH Only) - Authorization Check
                const pin = prompt("AUTORIZACIÓN REQUERIDA:\nIngrese la clave de JEFE DE RH para autorizar el reingreso:")
                if (pin !== 'RH2026') {
                    alert('Clave incorrecta. Autorización denegada.')
                    return
                }
                nuevoEstatus = 'Autorizada RH'
            } else {
                // Standard 2-Step for others (Vacations, etc.)
                if (currentStatus === 'Pendiente' || currentStatus === 'En revisión') {
                    // Step 1: Boss Approval (No PIN)
                    nuevoEstatus = 'Aprobada por Jefe'
                } else if (currentStatus === 'Aprobada por Jefe') {
                    // Step 2: RH Authorization (PIN Required)
                    const pin = prompt("AUTORIZACIÓN RH:\nConfirmar autorización final:")
                    if (pin !== 'RH2026') return
                    nuevoEstatus = 'Autorizada RH'
                } else {
                    // Fallback or if already authorized
                    nuevoEstatus = 'Autorizada RH'
                }
            }
        }

        if (decision === 'Cancelada' && confirm("¿Desea cancelar y retornar los días al saldo?")) {
            updateData.estatus = 'Cancelada'
        }

        updateData.estatus = nuevoEstatus

        const { error } = await supabase
            .from('solicitudes')
            .update(updateData)
            .eq('id_solicitud', id)

        if (!error) {
            // Trigger Execution if fully authorized
            if (nuevoEstatus === 'Autorizada RH' || nuevoEstatus === 'Ejecutada') {

                // 2. Execute Baja if applicable
                if (isBaja) {
                    try {
                        const { error: bajaError } = await supabase.from('empleados')
                            .update({ estado_empleado: 'Baja' })
                            .eq('id_empleado', solicitud.id_empleado_objetivo)

                        if (bajaError) throw bajaError

                        // Insert into historical records
                        await supabase.from('bajas').insert({
                            id_empleado: solicitud.id_empleado_objetivo,
                            fecha_baja: solicitud.payload.fecha_baja,
                            id_causa_baja: solicitud.payload.id_causa_baja,
                            motivo_baja: solicitud.payload.comentarios,
                            id_solicitud: id
                        })

                        alert('BAJA EJECUTADA: El empleado ha pasado a estado inactivo.')
                    } catch (e: any) {
                        alert('Error ejecutando la baja: ' + e.message)
                    }
                }

                // 3. Execute Reingreso
                if (isReingreso) {
                    try {
                        // A. Set Active
                        const { error: activeError } = await supabase.from('empleados')
                            .update({ estado_empleado: 'Activo' })
                            .eq('id_empleado', solicitud.id_empleado_objetivo)

                        if (activeError) throw activeError

                        // B. Update Admission Date (Reset Seniority)
                        if (solicitud.payload.fecha_reingreso) {
                            await supabase.from('empleado_ingreso')
                                .upsert({
                                    id_empleado: solicitud.id_empleado_objetivo,
                                    fecha_ingreso: solicitud.payload.fecha_reingreso
                                })
                        }

                        // C. Reset Vacation Balances (Clear all old records)
                        await supabase.from('vacaciones_saldos')
                            .delete()
                            .eq('id_empleado', solicitud.id_empleado_objetivo)

                        alert('REINGRESO EJECUTADO: El empleado está activo nuevamente con antigüedad reiniciada.')
                    } catch (e: any) {
                        alert('Error ejecutando reingreso: ' + e.message)
                    }
                }

                // 1. Create Incident (Only for Vacations/Permissions, irrelevant for Baja/Reingreso but harmless)
                if (!isBaja && !isReingreso) {
                    try {
                        await createAutoIncident(solicitud)
                        alert('Incidencia generada en el historial del empleado.')
                    } catch (incError: any) {
                        console.warn('No se generó incidencia automática (posiblemente no requerida): ' + incError.message)
                    }
                }

                // 2. Deduct from balance
                if (tipoSolicitud.includes('vacaciones')) {
                    if (tipoSolicitud.includes('corrección')) {
                        await updateVacationBalance(solicitud.id_empleado_objetivo, solicitud.payload, 'correction')
                        alert('Corrección de saldo aplicada exitosamente.')
                    } else {
                        await updateVacationBalance(solicitud.id_empleado_objetivo, solicitud.payload, 'deduct')

                        // AUTO-GENERATE PDF FOR VACATIONS
                        // Small delay to allow state/alert to settle
                        setTimeout(() => {
                            if (confirm("¿Desea descargar el formato de vacaciones ahora?")) {
                                generatePDF()
                            }
                        }, 500)
                    }
                }
            }
            if (nuevoEstatus === 'Cancelada' && (currentStatus === 'Autorizada RH' || currentStatus === 'Ejecutada')) {
                // Refund balance
                if (tipoSolicitud.includes('vacaciones')) {
                    if (tipoSolicitud.includes('corrección')) {
                        await updateVacationBalance(solicitud.id_empleado_objetivo, solicitud.payload, 'correction')
                        alert('Corrección de saldo aplicada exitosamente.')
                    } else {
                        await updateVacationBalance(solicitud.id_empleado_objetivo, solicitud.payload, 'refund')
                        alert('Solicitud cancelada. Saldo de vacaciones reembolsado.')
                    }
                }
            }
            fetchSolicitud()
        } else {
            alert('Error: ' + error.message)
        }
    }

    async function generatePDF() {
        try {
            if (!solicitud || !config.nombre_empresa) {
                alert('Falta configuración de empresa o datos de solicitud')
                return
            }

            // Fetch balances for PDF
            let saldoTotal = 0
            let diasTomadosTotal = 0
            let detalleSaldos: any[] = []

            const { data: balances } = await supabase
                .from('vacaciones_saldos')
                .select(`*, cat_periodos_vacacionales(periodo)`)
                .eq('id_empleado', solicitud.id_empleado_objetivo)
                .order('cat_periodos_vacacionales(periodo)', { ascending: true })

            if (balances) {
                balances.forEach((b: any) => {
                    const asignados = b.dias_asignados || 0
                    const tomados = b.dias_tomados || 0
                    saldoTotal += asignados
                    diasTomadosTotal += tomados

                    if ((asignados - tomados) > 0) {
                        detalleSaldos.push([
                            b.cat_periodos_vacacionales?.periodo || 'N/D',
                            asignados,
                            tomados,
                            asignados - tomados
                        ])
                    }
                })
            }
            const saldoDisponible = saldoTotal - diasTomadosTotal

            const doc: any = new jsPDF()
            const azulCorporativo: [number, number, number] = [26, 35, 126] // #1a237e
            const grisTexto: [number, number, number] = [60, 60, 60]

            // --- HEADER ---
            // Logo
            if (config.logo_base64) {
                try {
                    doc.addImage(config.logo_base64, 'PNG', 14, 10, 30, 15)
                } catch (e) {
                    console.warn("Error adding logo", e)
                }
            }

            doc.setTextColor(...azulCorporativo)
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.text(config.nombre_empresa.toUpperCase(), 195, 15, { align: 'right' })

            doc.setFontSize(8)
            doc.setTextColor(...grisTexto)
            doc.setFont('helvetica', 'normal')
            doc.text(config.direccion || '', 195, 20, { align: 'right' })
            doc.text(`RFC: ${config.rfc || ''} | RP: ${config.registro_patronal || ''}`, 195, 24, { align: 'right' })

            // Title Bar
            doc.setFillColor(...azulCorporativo)
            doc.rect(14, 30, 182, 8, 'F')
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text("SOLICITUD Y CONTROL DE VACACIONES", 105, 35.5, { align: 'center' })

            // --- EMPLOYEE INFO ---
            const empleado = solicitud.empleados
            const adscripcion = empleado?.empleado_adscripciones?.[0]

            autoTable(doc, {
                startY: 42,
                head: [['DATOS DEL COLABORADOR', '']],
                body: [
                    ['Nombre:', `${empleado?.nombre} ${empleado?.apellido_paterno} ${empleado?.apellido_materno || ''}`],
                    ['Departamento:', adscripcion?.cat_departamentos?.departamento || 'N/A'],
                    ['Puesto:', adscripcion?.cat_puestos?.puesto || 'N/A'],
                    ['Fecha Solicitud:', new Date(solicitud.creado_el).toLocaleDateString()],
                    ['Folio:', solicitud.folio]
                ],
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: azulCorporativo } },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
            })

            // --- REQUEST DETAILS ---
            const payload = solicitud.payload || {}
            let diasSolicitados = 0
            let fechaPresentacion = ''

            if (payload.fecha_inicio && payload.fecha_fin) {
                // Parse manually to avoid timezone issues
                const [y1, m1, d1] = payload.fecha_inicio.split('-').map(Number)
                const [y2, m2, d2] = payload.fecha_fin.split('-').map(Number)

                // Create dates in local time 12:00 PM to resemble "noon" and avoid midnight shifts
                // Month is 0-indexed in JS Date
                const date1 = new Date(y1, m1 - 1, d1, 12, 0, 0)
                const date2 = new Date(y2, m2 - 1, d2, 12, 0, 0)

                diasSolicitados = Math.ceil(Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)) + 1

                // Calculate return date (next day)
                const returnDate = new Date(date2)
                returnDate.setDate(returnDate.getDate() + 1)
                fechaPresentacion = returnDate.toLocaleDateString()
            }

            const startYDetails = (doc.lastAutoTable?.finalY || 42) + 5

            autoTable(doc, {
                startY: startYDetails,
                head: [['DETALLES DEL PERIODO SOLICITADO']],
                body: [
                    [`Del ${payload.fecha_inicio || '-'} al ${payload.fecha_fin || '-'} (${diasSolicitados} días)`],
                    [`FECHA DE PRESENTACIÓN: ${fechaPresentacion}`], // Highlighted
                    [`Comentarios: ${payload.comentarios || 'Ninguno'}`]
                ],
                headStyles: { fillColor: azulCorporativo, textColor: 255, fontStyle: 'bold', halign: 'center' },
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 3 },
                // Highlight presentation date row (index 1) if possible, or just bold text
                didParseCell: function (data: any) {
                    if (data.row.index === 1 && data.section === 'body') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [0, 0, 0];
                    }
                }
            })

            // --- BALANCE SUMMARY ---
            const startYBalance = (doc.lastAutoTable?.finalY || startYDetails) + 10
            doc.setTextColor(0, 0, 0) // Reset text color
            doc.text("ESTADO DE CUENTA DE VACACIONES", 14, startYBalance)

            const balanceBody = detalleSaldos.length > 0 ? detalleSaldos : [['-', '-', '-', '-']]
            balanceBody.push(['TOTALES', saldoTotal, diasTomadosTotal, saldoDisponible])

            autoTable(doc, {
                startY: startYBalance + 2,
                head: [['PERIODO', 'ASIGNADOS', 'USADOS', 'DISPONIBLE']],
                body: balanceBody,
                headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
                theme: 'striped',
                styles: { fontSize: 9, halign: 'center' },
                columnStyles: { 0: { halign: 'left' } },
                foot: [['', '', 'Saldo Final:', `${saldoDisponible} días`]],
                footStyles: { fillColor: [240, 240, 240], textColor: azulCorporativo, fontStyle: 'bold', halign: 'right' }
            })

            // --- SIGNATURES ---
            const firmaY = (doc.lastAutoTable?.finalY || startYBalance) + 40

            doc.setDrawColor(150, 150, 150)
            doc.line(30, firmaY, 80, firmaY)
            doc.line(130, firmaY, 180, firmaY)

            doc.setFontSize(8)
            doc.setTextColor(0, 0, 0)

            doc.text("NOMBRE Y FIRMA DEL TRABAJADOR", 55, firmaY + 5, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(`${empleado?.nombre} ${empleado?.apellido_paterno} ${empleado?.apellido_materno || ''}`, 55, firmaY + 10, { align: 'center' })

            doc.setFont('helvetica', 'bold')
            doc.text("AUTORIZACIÓN (RH / JEFE)", 155, firmaY + 5, { align: 'center' })

            // Footer disclaimer
            doc.setFontSize(7)
            doc.setTextColor(150, 150, 150)
            doc.text("Este documento sirve como constancia de la solicitud y autorización de vacaciones conforme a la LFT.", 105, 280, { align: 'center' })

            doc.save(`Vacaciones_${solicitud.folio}.pdf`)

        } catch (e: any) {
            console.error(e)
            alert('Error generando PDF: ' + e.message)
        }
    }

    if (loading) return <div>Cargando...</div>
    if (!solicitud) return <div>No encontrada</div>

    const payload = solicitud.payload || {}
    const isBaja = solicitud.cat_tipos_solicitud?.tipo_solicitud?.toLowerCase().includes('baja')
    const isReingreso = solicitud.cat_tipos_solicitud?.tipo_solicitud?.toLowerCase().includes('reingreso')
    const checklist = payload.checklist || {}
    const status = solicitud.estatus

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-6">
                <Link href="/solicitudes" className="p-2 rounded-full hover:bg-zinc-200 transition-colors">
                    <ArrowLeft className="h-6 w-6 text-zinc-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Solicitud {solicitud.folio}</h1>
                    <p className="text-sm text-zinc-500">{solicitud.cat_tipos_solicitud?.tipo_solicitud} • <span className="font-bold bg-amber-100 px-2 py-0.5 rounded text-amber-900">{status}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                        <h3 className="font-bold text-zinc-900 mb-4 border-b pb-2">Datos de la Solicitud</h3>
                        <dl className="grid grid-cols-2 gap-4">
                            <div>
                                <dt className="text-xs font-medium text-zinc-500">Empleado</dt>
                                <dd className="text-sm font-medium text-zinc-900">{solicitud.empleados?.nombre} {solicitud.empleados?.apellido_paterno}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-zinc-500">Departamento</dt>
                                <dd className="text-sm font-medium text-zinc-900">
                                    {solicitud.empleados?.empleado_adscripciones?.[0]?.cat_departamentos?.departamento || 'N/A'}
                                </dd>
                            </div>

                            {payload.fecha_inicio && (
                                <>
                                    <div className="bg-blue-50 p-2 rounded">
                                        <dt className="text-xs font-medium text-blue-500">Fecha Inicio</dt>
                                        <dd className="text-sm font-bold text-blue-900">{payload.fecha_inicio}</dd>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded">
                                        <dt className="text-xs font-medium text-blue-500">Fecha Fin</dt>
                                        <dd className="text-sm font-bold text-blue-900">{payload.fecha_fin}</dd>
                                    </div>
                                </>
                            )}

                            <div className="col-span-2">
                                <dt className="text-xs font-medium text-zinc-500">Comentarios</dt>
                                <dd className="text-sm text-zinc-700 bg-zinc-50 p-2 rounded mt-1">{solicitud.payload?.comentarios || 'Sin comentarios'}</dd>
                            </div>
                        </dl>
                    </div>

                    {isBaja ? (
                        <div className="bg-red-50 p-6 rounded-lg border border-red-100 space-y-4">
                            <h3 className="font-bold text-red-900 border-b border-red-200 pb-2">Detalle de Baja</h3>

                            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded border border-red-100">
                                    <dt className="text-xs font-bold text-red-500 uppercase">Motivo Interno</dt>
                                    <dd className="text-sm font-medium text-zinc-900">
                                        {catalogs.caasalBaja.find(c => c.id_causa_baja === payload.id_causa_baja)?.causa || 'No especificado'}
                                    </dd>
                                </div>

                                <div className="bg-white p-3 rounded border border-red-100">
                                    <dt className="text-xs font-bold text-red-500 uppercase">Fecha Efectiva</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{payload.fecha_baja}</dd>
                                </div>
                                <div className="bg-white p-3 rounded border border-red-100">
                                    <dt className="text-xs font-bold text-red-500 uppercase">Comentarios</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{payload.comentarios}</dd>
                                </div>
                            </dl>

                            <div className="pt-2">
                                <h4 className="text-xs font-bold text-red-900 mb-2">Checklist de Baja</h4>
                                <ul className="space-y-2">
                                    <CheckItem label="Reporte de Faltas (Jefe)" checked={status !== 'Pendiente'} />
                                    <CheckItem label="Autorización RH" checked={status === 'Autorizada RH' || status === 'Ejecutada'} />
                                </ul>
                            </div>
                        </div>
                    ) : (
                        null
                    )}
                </div>

                {/* Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                        <h3 className="font-bold text-zinc-900 mb-4">Flujo de Aprobación</h3>

                        {/* Status Timeline Visualization */}
                        <div className="space-y-4 mb-6 relative">
                            <TimelineItem
                                title="Solicitud Enviada"
                                active={true}
                                done={status !== 'Borrador'}
                            />
                            {!isReingreso && (
                                <TimelineItem
                                    title="Autorización Jefe Depto"
                                    active={status === 'En revisión'}
                                    done={['Aprobada por Jefe', 'Autorizada RH', 'Ejecutada'].includes(status)}
                                />
                            )}
                            <TimelineItem
                                title="Autorización RH"
                                active={status === 'Aprobada por Jefe'}
                                done={['Autorizada RH', 'Ejecutada'].includes(status)}
                            />
                        </div>

                        {status !== 'Autorizada RH' && status !== 'Ejecutada' && status !== 'Cancelada' && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => handleDecision('Aprobada')}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-zinc-800 transition-colors"
                                >
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                    Autorizar Solicitud
                                </button>
                                <button
                                    onClick={() => handleDecision('Rechazada')}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-zinc-300 rounded-md shadow-sm text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50"
                                >
                                    <XCircle className="mr-2 h-4 w-4 text-red-500" /> Rechazar
                                </button>
                            </div>
                        )}

                        {/* PDF Generation - Only if Authorized by RH AND is Vacation */}
                        {['Autorizada RH', 'Ejecutada'].includes(status) &&
                            solicitud.cat_tipos_solicitud?.tipo_solicitud?.toLowerCase().includes('vacaciones') && (
                                <div className="mt-4 pt-4 border-t border-zinc-100">
                                    <button
                                        onClick={generatePDF}
                                        className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors animate-pulse"
                                    >
                                        <Printer className="mr-2 h-5 w-5" />
                                        DESCARGAR FORMATO PDF
                                    </button>
                                </div>
                            )}

                        {/* Cancellation / Return */}
                        {['Autorizada RH', 'Ejecutada'].includes(status) && (
                            <div className="mt-4 pt-4 border-t border-zinc-100">
                                <button
                                    onClick={() => handleDecision('Cancelada')}
                                    className="w-full flex items-center justify-center px-4 py-2 bg-zinc-100 text-zinc-600 text-xs rounded hover:bg-zinc-200"
                                >
                                    <Undo2 className="mr-2 h-3 w-3" />
                                    Cancelar / Retornar Vacaciones
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

function CheckItem({ label, checked }: any) {
    return (
        <li className="flex items-center justify-between">
            <span className="text-sm text-red-900">{label}</span>
            {checked ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" /> OK
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    <XCircle className="w-3 h-3 mr-1" /> Pendiente
                </span>
            )}
        </li>
    )
}

function TimelineItem({ title, active, done }: any) {
    return (
        <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-3 ${done ? 'bg-green-500' : active ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-zinc-200'}`}></div>
            <span className={`text-sm ${done ? 'text-zinc-400' : active ? 'font-bold text-zinc-900' : 'text-zinc-300'}`}>{title}</span>
        </div>
    )
}
