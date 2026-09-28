'use client'

import { useState, useMemo } from 'react'
import { 
    Hospital, Search, Filter, Copy, Check, Download, Calendar, 
    User, Users, Plane, Bus, Car, Clock, FileSpreadsheet, RefreshCw,
    AlertCircle, CheckCircle2, Send
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface PaseMedico {
    id_pase: string
    folio?: string
    fecha_salida?: string
    fecha_retorno?: string
    medio_transporte?: string
    nombre_trabajador?: string
    parentesco?: string
    acompanante?: string
    motivo?: string
    servicio_se_envia?: string
    unidad_refiere?: string
    unidad_se_refiere?: string
    estatus?: string
    pacientes?: {
        nombre_completo?: string
        parentesco?: string
        id_empleado?: string
        es_poblacion_general?: boolean
    } | null
    clinica_destino?: {
        nombre?: string
        ubicacion?: string
    } | null
}

interface Props {
    pases: PaseMedico[]
    empleados: any[]
    loading: boolean
    onRefresh: () => void
}

// Helper para normalizar parentesco y extraer nombre del trabajador si viene como "HIJO DE: ..."
const parseRelationAndWorker = (parentescoStr?: string, defaultWorkerName?: string) => {
    let cleanParentesco = 'TITULAR';
    let cleanWorker = defaultWorkerName || '';

    if (parentescoStr) {
        const raw = parentescoStr.toUpperCase().trim();
        
        if (raw.includes('TITULAR') || raw.includes('ELLA MISMA') || raw.includes('ELLO MISMO') || raw === 'TRABAJADOR') {
            cleanParentesco = 'TITULAR';
            return { parentesco: cleanParentesco, nombre_trabajador: cleanWorker };
        }
        
        if (raw.includes('HIJA')) cleanParentesco = 'HIJA';
        else if (raw.includes('HIJO')) cleanParentesco = 'HIJO';
        else if (raw.includes('ESPOSA') || raw.includes('CONCUBINA')) cleanParentesco = 'ESPOSA';
        else if (raw.includes('ESPOSO')) cleanParentesco = 'ESPOSO';
        else if (raw.includes('MADRE') || raw.includes('MAMA')) cleanParentesco = 'MADRE';
        else if (raw.includes('PADRE') || raw.includes('PAPA')) cleanParentesco = 'PADRE';
        else if (raw.includes('ACOMPAÑANTE') || raw.includes('ACOMPANANTE')) cleanParentesco = 'ACOMPAÑANTE';
        else cleanParentesco = raw;

        const match = raw.match(/(?:HIJO|HIJA|ESPOSA|ESPOSO|CONCUBINA|MADRE|PADRE|MAMA|PAPA|ACOMPAÑANTE|ACOMPANANTE)\s*(?:\/|\s+CONCUBINA)?\s*DE\s*:\s*(.+)$/) ||
                      raw.match(/(?:HIJO|HIJA|ESPOSA|ESPOSO|CONCUBINA|MADRE|PADRE|MAMA|PAPA|ACOMPAÑANTE|ACOMPANANTE)\s*(?:\/|\s+CONCUBINA)?\s*DE\s+(.+)$/) ||
                      raw.match(/(?:HIJO|HIJA|ESPOSA|ESPOSO|CONCUBINA|MADRE|PADRE|MAMA|PAPA|ACOMPAÑANTE|ACOMPANANTE)\s*:\s*(.+)$/);
                      
        if (match && match[1]) {
            cleanWorker = match[1].trim();
        }
    }
    
    cleanWorker = cleanWorker.replace(/^[:\-\s]+/, '').trim();
    return { parentesco: cleanParentesco, nombre_trabajador: cleanWorker };
}

export default function PasesMedicosTab({ pases, empleados, loading, onRefresh }: Props) {
    const [search, setSearch] = useState('')
    const [dateStart, setDateStart] = useState('')
    const [dateEnd, setDateEnd] = useState('')
    const [filterMedio, setFilterMedio] = useState('TODOS')
    const [copiedAll, setCopiedAll] = useState(false)
    const [copiedRowId, setCopiedRowId] = useState<string | null>(null)

    // Mapa de departamentos por nombre de empleado o ID
    const empMap = useMemo(() => {
        const map = new Map<string, string>()
        empleados.forEach(e => {
            const fullName = `${e.nombre || ''} ${e.apellido_paterno || ''}`.trim().toLowerCase()
            const dept = e.departamento_id?.departamento || e.puesto || 'General'
            if (fullName) map.set(fullName, dept)
            if (e.id_empleado) map.set(e.id_empleado, dept)
        })
        return map
    }, [empleados])

    // Normalizar registros para visualización y exportación
    const rows = useMemo(() => {
        return pases.map(p => {
            const pacienteNombre = p.pacientes?.nombre_completo || p.nombre_trabajador || 'Paciente no registrado'
            const parsed = parseRelationAndWorker(p.parentesco || p.pacientes?.parentesco, p.nombre_trabajador)
            const titular = parsed.nombre_trabajador || (parsed.parentesco === 'TITULAR' ? pacienteNombre : '')
            
            // Buscar departamento del titular
            let departamento = 'Médico / Clínica'
            if (titular) {
                const foundDept = empMap.get(titular.toLowerCase())
                if (foundDept) departamento = foundDept
            } else if (p.pacientes?.id_empleado) {
                const foundDept = empMap.get(p.pacientes.id_empleado)
                if (foundDept) departamento = foundDept
            }

            const destino = p.clinica_destino?.nombre || p.unidad_se_refiere || 'Consulta Durango'
            const acompananteStr = (!p.acompanante || p.acompanante.toUpperCase().includes('NO REQUIERE')) 
                ? 'Sin acompañante' 
                : p.acompanante

            return {
                id_pase: p.id_pase,
                folio: p.folio || 'S/F',
                fecha_salida: p.fecha_salida || '',
                fecha_retorno: p.fecha_retorno || '',
                paciente: pacienteNombre,
                parentesco: parsed.parentesco,
                trabajador_titular: titular || pacienteNombre,
                departamento: departamento,
                acompanante: acompananteStr,
                destino: destino,
                servicio_motivo: p.servicio_se_envia || p.motivo || 'Revisión Médica',
                medio_transporte: p.medio_transporte || 'VIA TERRESTRE',
                estatus: p.estatus || 'Generado'
            }
        })
    }, [pases, empMap])

    // Filtrar filas
    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const term = search.toLowerCase()
            const matchesSearch = !search || 
                r.folio.toLowerCase().includes(term) ||
                r.paciente.toLowerCase().includes(term) ||
                r.trabajador_titular.toLowerCase().includes(term) ||
                r.departamento.toLowerCase().includes(term) ||
                r.destino.toLowerCase().includes(term)

            const matchesMedio = filterMedio === 'TODOS' || r.medio_transporte.toUpperCase().includes(filterMedio.toUpperCase())
            const matchesStart = !dateStart || (r.fecha_salida && r.fecha_salida >= dateStart)
            const matchesEnd = !dateEnd || (r.fecha_salida && r.fecha_salida <= dateEnd)

            return matchesSearch && matchesMedio && matchesStart && matchesEnd
        })
    }, [rows, search, filterMedio, dateStart, dateEnd])

    // Copiar tabla completa al portapapeles formateada para Excel (TSV)
    const handleCopyTableForExcel = async () => {
        if (filteredRows.length === 0) {
            alert('No hay registros de pases médicos para copiar.')
            return
        }

        const headers = [
            'Folio',
            'Fecha Salida',
            'Fecha Retorno',
            'Paciente',
            'Parentesco',
            'Trabajador Titular',
            'Departamento',
            'Acompañante',
            'Destino / Clínica',
            'Servicio / Motivo',
            'Medio Transporte',
            'Estatus'
        ]

        const tsvRows = filteredRows.map(r => [
            r.folio,
            r.fecha_salida,
            r.fecha_retorno,
            r.paciente,
            r.parentesco,
            r.trabajador_titular,
            r.departamento,
            r.acompanante,
            r.destino,
            r.servicio_motivo,
            r.medio_transporte,
            r.estatus
        ].map(val => String(val || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'))

        const fullTSV = [headers.join('\t'), ...tsvRows].join('\n')

        try {
            await navigator.clipboard.writeText(fullTSV)
            setCopiedAll(true)
            setTimeout(() => setCopiedAll(false), 3000)
        } catch (err) {
            console.error('Error al copiar al portapapeles:', err)
            // Fallback manual
            const textarea = document.createElement('textarea')
            textarea.value = fullTSV
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopiedAll(true)
            setTimeout(() => setCopiedAll(false), 3000)
        }
    }

    // Copiar una sola fila para Excel
    const handleCopySingleRow = async (row: typeof rows[0]) => {
        const line = [
            row.folio,
            row.fecha_salida,
            row.fecha_retorno,
            row.paciente,
            row.parentesco,
            row.trabajador_titular,
            row.departamento,
            row.acompanante,
            row.destino,
            row.servicio_motivo,
            row.medio_transporte,
            row.estatus
        ].join('\t')

        try {
            await navigator.clipboard.writeText(line)
            setCopiedRowId(row.id_pase)
            setTimeout(() => setCopiedRowId(null), 2000)
        } catch (err) {
            console.error(err)
        }
    }

    // Descargar en archivo Excel .xlsx
    const handleDownloadExcel = () => {
        if (filteredRows.length === 0) {
            alert('No hay registros para exportar.')
            return
        }

        const dataToExport = filteredRows.map(r => ({
            'Folio': r.folio,
            'Fecha Salida': r.fecha_salida,
            'Fecha Retorno': r.fecha_retorno,
            'Nombre del Paciente': r.paciente,
            'Parentesco': r.parentesco,
            'Trabajador Titular': r.trabajador_titular,
            'Departamento': r.departamento,
            'Acompañante': r.acompanante,
            'Clínica / Destino': r.destino,
            'Servicio / Motivo': r.servicio_motivo,
            'Medio de Transporte': r.medio_transporte,
            'Estatus Pase': r.estatus
        }))

        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        // Ajustar ancho automático de columnas
        const colWidths = [
            { wch: 15 }, // Folio
            { wch: 14 }, // Fecha Salida
            { wch: 14 }, // Fecha Retorno
            { wch: 30 }, // Paciente
            { wch: 14 }, // Parentesco
            { wch: 30 }, // Trabajador
            { wch: 22 }, // Departamento
            { wch: 25 }, // Acompañante
            { wch: 25 }, // Destino
            { wch: 25 }, // Motivo
            { wch: 18 }, // Medio
            { wch: 14 }, // Estatus
        ]
        worksheet['!cols'] = colWidths

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pases Medicos Transporte')

        const today = new Date().toISOString().split('T')[0]
        XLSX.writeFile(workbook, `Pases_Medicos_Transporte_BACIS_${today}.xlsx`)
    }

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Banner de Presentación y Acciones Principales */}
            <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-zinc-900 border border-emerald-800/40 text-emerald-100 p-5 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <Hospital className="w-5 h-5" />
                        </span>
                        <div>
                            <h3 className="font-black text-white text-base tracking-wide flex items-center gap-2">
                                Relación de Viajes por Pases Médicos
                                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border border-emerald-500/30">
                                    {filteredRows.length} Pases
                                </span>
                            </h3>
                            <p className="text-xs text-emerald-300/80">
                                Pases médicos y acompañantes emitidos por la clínica para traslado Durango ⇄ Bacis.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {/* Botón Copiar Tabla para Excel */}
                    <button
                        onClick={handleCopyTableForExcel}
                        className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
                            copiedAll 
                                ? 'bg-green-500 text-white shadow-green-500/30 ring-2 ring-white' 
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 hover:scale-[1.02]'
                        }`}
                        title="Copia la tabla en formato compatible con Excel (Ctrl + V directo en tus celdas)"
                    >
                        {copiedAll ? (
                            <>
                                <Check className="w-4 h-4" />
                                <span>¡TABLA COPIADA PARA EXCEL!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                <span>Copiar Tabla para Excel</span>
                            </>
                        )}
                    </button>

                    {/* Botón Descargar Excel */}
                    <button
                        onClick={handleDownloadExcel}
                        className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02]"
                        title="Descargar archivo .xlsx nativo listo para abrir"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Descargar Excel (.xlsx)</span>
                    </button>

                    {/* Botón Refrescar */}
                    <button
                        onClick={onRefresh}
                        className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 rounded-xl text-xs transition-all"
                        title="Actualizar datos desde clínica"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-black text-zinc-800 uppercase tracking-wide">
                        <Filter className="w-4 h-4 text-emerald-600" />
                        <span>Filtros de Pases Médicos</span>
                    </div>

                    {(search || filterMedio !== 'TODOS' || dateStart || dateEnd) && (
                        <button
                            onClick={() => {
                                setSearch('')
                                setFilterMedio('TODOS')
                                setDateStart('')
                                setDateEnd('')
                            }}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                        >
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Buscar por paciente, titular, folio o clínica..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>

                    <div>
                        <select
                            value={filterMedio}
                            onChange={e => setFilterMedio(e.target.value)}
                            className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50 focus:bg-white"
                        >
                            <option value="TODOS">🛣️ Todos los Medios</option>
                            <option value="VIA TERRESTRE">🚌 Vía Terrestre (Camión / Camioneta)</option>
                            <option value="VIA AEREA">✈️ Vía Aérea (Avioneta)</option>
                        </select>
                    </div>

                    <div>
                        <input
                            type="date"
                            value={dateStart}
                            onChange={e => setDateStart(e.target.value)}
                            className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                            title="Salida Desde"
                        />
                    </div>

                    <div>
                        <input
                            type="date"
                            value={dateEnd}
                            onChange={e => setDateEnd(e.target.value)}
                            className="w-full py-2 px-3 border border-zinc-200 rounded-xl text-xs font-bold bg-zinc-50"
                            title="Salida Hasta"
                        />
                    </div>
                </div>
            </div>

            {/* TABLA DE PASES MÉDICOS */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-zinc-900 text-zinc-300 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                <th className="p-3.5 pl-4">Folio / Fecha</th>
                                <th className="p-3.5">Paciente & Parentesco</th>
                                <th className="p-3.5">Trabajador Titular</th>
                                <th className="p-3.5">Departamento</th>
                                <th className="p-3.5">Acompañante</th>
                                <th className="p-3.5">Destino / Servicio</th>
                                <th className="p-3.5">Medio</th>
                                <th className="p-3.5 text-right pr-4">Copiar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {filteredRows.map(row => {
                                const isCopied = copiedRowId === row.id_pase
                                return (
                                    <tr key={row.id_pase} className="hover:bg-emerald-50/40 transition-colors">
                                        <td className="p-3.5 pl-4 whitespace-nowrap">
                                            <div className="font-mono font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md inline-block text-[11px]">
                                                {row.folio}
                                            </div>
                                            <div className="text-[11px] text-zinc-600 mt-1 flex items-center gap-1 font-bold">
                                                <Calendar className="w-3 h-3 text-zinc-400" />
                                                <span>Salida: {row.fecha_salida || 'Sin fecha'}</span>
                                            </div>
                                            {row.fecha_retorno && (
                                                <div className="text-[10px] text-zinc-400">
                                                    Retorno: {row.fecha_retorno}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3.5">
                                            <div className="font-bold text-zinc-900 text-[13px]">
                                                {row.paciente}
                                            </div>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                                row.parentesco === 'TITULAR' 
                                                    ? 'bg-zinc-100 text-zinc-700' 
                                                    : 'bg-purple-100 text-purple-700'
                                            }`}>
                                                {row.parentesco}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="font-semibold text-zinc-800">
                                                {row.trabajador_titular}
                                            </div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="bg-zinc-100 font-bold text-zinc-700 px-2 py-0.5 rounded-md text-[11px]">
                                                {row.departamento}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`text-[11px] font-medium ${
                                                row.acompanante !== 'Sin acompañante' 
                                                    ? 'text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200' 
                                                    : 'text-zinc-400'
                                            }`}>
                                                {row.acompanante}
                                            </span>
                                        </td>
                                        <td className="p-3.5 max-w-[200px]">
                                            <div className="font-bold text-zinc-900 truncate" title={row.destino}>
                                                {row.destino}
                                            </div>
                                            <div className="text-[11px] text-zinc-500 truncate" title={row.servicio_motivo}>
                                                {row.servicio_motivo}
                                            </div>
                                        </td>
                                        <td className="p-3.5 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                row.medio_transporte.toUpperCase().includes('AEREA') 
                                                    ? 'bg-sky-100 text-sky-800' 
                                                    : 'bg-indigo-100 text-indigo-800'
                                            }`}>
                                                {row.medio_transporte.toUpperCase().includes('AEREA') ? (
                                                    <Plane className="w-3 h-3" />
                                                ) : (
                                                    <Bus className="w-3 h-3" />
                                                )}
                                                {row.medio_transporte}
                                            </span>
                                        </td>
                                        <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleCopySingleRow(row)}
                                                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                                                    isCopied 
                                                        ? 'bg-green-500 text-white shadow-sm' 
                                                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                                }`}
                                                title="Copiar fila para pegar en Excel"
                                            >
                                                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}

                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-zinc-400 font-bold border-2 border-dashed border-zinc-100 rounded-xl my-4">
                                        No se encontraron pases médicos que coincidan con la búsqueda o filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Informativo */}
                <div className="p-3.5 bg-zinc-50 border-t border-zinc-200 text-[11px] text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <span className="font-mono">
                        Mostrando <b>{filteredRows.length}</b> de <b>{rows.length}</b> registros de pases médicos.
                    </span>
                    <span className="text-zinc-400">
                        Tip: Da clic en <b>Copiar Tabla para Excel</b> y presiona <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-xs text-zinc-700">Ctrl + V</kbd> directamente en tu hoja de Excel.
                    </span>
                </div>
            </div>
        </div>
    )
}
