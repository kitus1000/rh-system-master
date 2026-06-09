'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'

export default function DiagnosticoPage() {
    const [loading, setLoading] = useState(true)
    const [audit, setAudit] = useState<any>({
        empleadosCount: 0,
        activeEmpleados: [],
        requestTypes: [],
        incidentTypes: [],
        recentRequests: [],
        matchTest: []
    })

    useEffect(() => {
        runDiagnostics()
    }, [])

    async function runDiagnostics() {
        setLoading(true)
        const results: any = {}

        // 1. Check Employees
        const { data: emps, error: errEmp } = await supabase
            .from('empleados')
            .select('id_empleado, nombre, apellido_paterno, estado_empleado')

        results.empleadosCount = emps?.length || 0
        results.activeEmpleados = emps?.filter(e => e.estado_empleado === 'Activo').slice(0, 5) || []
        results.empleadoError = errEmp?.message

        // 2. Catalogs
        const { data: rt } = await supabase.from('cat_tipos_solicitud').select('*')
        results.requestTypes = rt || []

        const { data: it } = await supabase.from('cat_tipos_incidencia').select('*')
        results.incidentTypes = it || []

        // 3. Logic Test: Matching
        const matches = []
        if (rt && it) {
            for (const r of rt) {
                const exact = it.find(i => i.tipo_incidencia.toLowerCase() === r.tipo_solicitud.toLowerCase())
                const fuzzy = it.find(i => i.tipo_incidencia.toLowerCase().includes('vacaciones') && r.tipo_solicitud.toLowerCase().includes('vacaciones'))
                matches.push({
                    request: r.tipo_solicitud,
                    matchFound: exact ? 'Exact' : (fuzzy ? 'Fuzzy (Vacation)' : 'NONE'),
                    matchedWith: exact?.tipo_incidencia || fuzzy?.tipo_incidencia || '-'
                })
            }
        }
        results.matchTest = matches

        // 4. Recent Requests
        const { data: reqs } = await supabase
            .from('solicitudes')
            .select('folio, estatus, creado_en, cat_tipos_solicitud(tipo_solicitud)')
            .order('creado_en', { ascending: false })
            .limit(5)
        results.recentRequests = reqs || []

        setAudit(results)
        setLoading(false)
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold mb-4">Diagnóstico del Sistema</h1>

            <button onClick={runDiagnostics} className="bg-black text-white px-4 py-2 rounded">Re-run</button>

            {loading ? <div>Cargando...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* EMPLOYEES */}
                    <div className="bg-white p-4 rounded shadow border border-zinc-200">
                        <h2 className="font-bold text-lg mb-2 text-blue-700">1. Empleados</h2>
                        <div className="text-sm">
                            <p>Total en DB: <strong>{audit.empleadosCount}</strong></p>
                            <p>Error fetch: <span className="text-red-600">{audit.empleadoError || 'Ninguno'}</span></p>
                            <p className="mt-2 font-semibold">Muestra Activos (Top 5):</p>
                            <ul className="list-disc pl-5">
                                {audit.activeEmpleados.length === 0 ? <li className="text-red-500">No hay activos (Revisar 'estado_empleado')</li> :
                                    audit.activeEmpleados.map((e: any) => (
                                        <li key={e.id_empleado}>{e.nombre} {e.apellido_paterno} ({e.estado_empleado})</li>
                                    ))
                                }
                            </ul>
                        </div>
                    </div>

                    {/* MATCHING LOGIC */}
                    <div className="bg-white p-4 rounded shadow border border-zinc-200">
                        <h2 className="font-bold text-lg mb-2 text-green-700">2. Lógica de Auto-Incidencias</h2>
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="border-b">
                                    <th>Solicitud</th>
                                    <th>Match Status</th>
                                    <th>Incidencia Destino</th>
                                </tr>
                            </thead>
                            <tbody>
                                {audit.matchTest.map((m: any, idx: number) => (
                                    <tr key={idx} className="border-b">
                                        <td className="py-1">{m.request}</td>
                                        <td className={m.matchFound === 'NONE' ? 'text-red-500 font-bold' : 'text-green-600'}>{m.matchFound}</td>
                                        <td>{m.matchedWith}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* CATALOGS */}
                    <div className="bg-white p-4 rounded shadow border border-zinc-200">
                        <h2 className="font-bold text-lg mb-2 text-amber-700">3. Catálogos Raw</h2>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <h3 className="font-bold">Tipos Solicitud DB</h3>
                                <ul className="list-disc pl-4">
                                    {audit.requestTypes.map((t: any) => <li key={t.id_tipo_solicitud}>{t.tipo_solicitud}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold">Tipos Incidencia DB</h3>
                                <ul className="list-disc pl-4">
                                    {audit.incidentTypes.map((t: any) => <li key={t.id_tipo_incidencia}>{t.tipo_incidencia}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* RECENT ACTIVITY */}
                    <div className="bg-white p-4 rounded shadow border border-zinc-200">
                        <h2 className="font-bold text-lg mb-2 text-purple-700">4. Últimas Solicitudes</h2>
                        <ul className="text-xs space-y-1">
                            {audit.recentRequests.map((r: any) => (
                                <li key={r.folio} className="border-b pb-1">
                                    <strong>{r.folio}</strong> - {r.cat_tipos_solicitud?.tipo_solicitud} <br />
                                    Estatus: <span className="px-1 bg-gray-100 rounded">{r.estatus}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>
            )}
        </div>
    )
}
