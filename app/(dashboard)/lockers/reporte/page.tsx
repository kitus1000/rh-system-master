'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/utils/supabase/client'
import { 
  Printer, ArrowLeft, RefreshCw, Download, Search, Filter, 
  FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, 
  XCircle, Building2, User, Key, Lock, Wrench, Layers, Tag
} from 'lucide-react'

interface Empleado {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  numero_empleado: number | string
  departamento?: string
  puesto?: string
}

interface LockerCasillero {
  id_casillero: string
  id_modulo: string
  codigo_casillero: string
  posicion_nivel: string
  numero_en_modulo: number
  id_empleado: string | null
  nombre_provisional: string | null
  numero_empleado_provisional: string | null
  estatus: 'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible'
  condicion_llave: string
  numero_llave: string | null
  descripcion_dano: string | null
  observaciones: string | null
  fecha_asignacion: string | null
  empleados?: Empleado | null
  modulo_codigo?: string
  modulo_bateria?: string
  modulo_tipo?: string
  modulo_ubicacion?: string
}

export default function ReporteLockersPage() {
  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroBateria, setFiltroBateria] = useState('TODAS')
  const [filtroEstatus, setFiltroEstatus] = useState('TODOS')

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: modData } = await supabase
        .from('lockers_modulos')
        .select(`
          id_modulo, codigo_modulo, bateria, tipo_modulo, ubicacion_detalle, orden,
          lockers_casilleros (
            *,
            empleados:id_empleado (
              id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto
            )
          )
        `)
        .eq('area', 'Planta de Beneficio')
        .order('orden', { ascending: true })

      if (modData) {
        const flat: LockerCasillero[] = []
        modData.forEach(mod => {
          if (mod.lockers_casilleros) {
            const sorted = [...mod.lockers_casilleros].sort((a, b) => a.numero_en_modulo - b.numero_en_modulo)
            sorted.forEach(c => {
              flat.push({
                ...c,
                modulo_codigo: mod.codigo_modulo,
                modulo_bateria: mod.bateria,
                modulo_tipo: mod.tipo_modulo === '2_niveles' ? '2 Niveles (Grande)' : '3 Niveles',
                modulo_ubicacion: mod.ubicacion_detalle || 'Planta de Beneficio'
              })
            })
          }
        })
        setCasilleros(flat)
      }
    } catch (err) {
      console.error('Error cargando reporte:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Filtrado
  const itemsFiltrados = useMemo(() => {
    return casilleros.filter(item => {
      if (filtroBateria !== 'TODAS' && item.modulo_bateria !== filtroBateria) return false
      if (filtroEstatus !== 'TODOS' && item.estatus !== filtroEstatus) return false

      if (!search.trim()) return true
      const q = search.toLowerCase()
      const cod = (item.codigo_casillero || '').toLowerCase()
      const mod = (item.modulo_codigo || '').toLowerCase()
      const prov = (item.nombre_provisional || '').toLowerCase()
      const emp = item.empleados
        ? `${item.empleados.nombre} ${item.empleados.apellido_paterno} ${item.empleados.apellido_materno || ''} ${item.empleados.numero_empleado} ${item.empleados.puesto} ${item.empleados.departamento}`.toLowerCase()
        : ''

      return cod.includes(q) || mod.includes(q) || prov.includes(q) || emp.includes(q)
    })
  }, [casilleros, filtroBateria, filtroEstatus, search])

  // Estadísticas del reporte
  const stats = useMemo(() => {
    const total = casilleros.length
    const asignados = casilleros.filter(c => c.estatus === 'Asignado').length
    const disponibles = casilleros.filter(c => c.estatus === 'Disponible').length
    const reparacion = casilleros.filter(c => c.estatus === 'En Reparacion').length
    const inservibles = casilleros.filter(c => c.estatus === 'Inservible').length
    return { total, asignados, disponibles, reparacion, inservibles }
  }, [casilleros])

  // Exportar a Excel (.xlsx)
  const handleExportarExcel = () => {
    const filasExcel = itemsFiltrados.map((item, index) => {
      const emp = item.empleados
      const nombreTrabajador = emp 
        ? `${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.nombre}`.trim()
        : item.nombre_provisional ? `${item.nombre_provisional} (Provisional)` : 'DISPONIBLE / LIBRE'

      const ficha = emp 
        ? emp.numero_empleado 
        : item.numero_empleado_provisional || ''

      return {
        '#': index + 1,
        'Locker (Módulo)': item.modulo_codigo,
        'Batería / Ubicación': item.modulo_bateria,
        'Código Casillero': item.codigo_casillero,
        'Nivel / Posición': item.posicion_nivel,
        'Tipo Módulo': item.modulo_tipo,
        'Estado': item.estatus,
        'Ficha #': ficha,
        'Nombre del Trabajador': nombreTrabajador,
        'Puesto': emp?.puesto || (item.nombre_provisional ? 'Por Asignar' : ''),
        'Departamento': emp?.departamento || (item.nombre_provisional ? 'Planta de Beneficio' : ''),
        'Condición de Llave': item.condicion_llave || 'N/A',
        'Número de Llave': item.numero_llave || '',
        'Falla / Daño Reportado': item.descripcion_dano || '',
        'Observaciones': item.observaciones || '',
        'Fecha de Asignación': item.fecha_asignacion ? new Date(item.fecha_asignacion).toLocaleDateString() : ''
      }
    })

    const ws = XLSX.utils.json_to_sheet(filasExcel)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Censo Lockers')

    // Ajustar anchos de columnas
    ws['!cols'] = [
      { wch: 4 },  // #
      { wch: 16 }, // Locker
      { wch: 22 }, // Bateria
      { wch: 18 }, // Codigo
      { wch: 16 }, // Nivel
      { wch: 18 }, // Tipo
      { wch: 14 }, // Estado
      { wch: 10 }, // Ficha
      { wch: 32 }, // Nombre
      { wch: 24 }, // Puesto
      { wch: 24 }, // Depto
      { wch: 18 }, // Llave
      { wch: 14 }, // Num Llave
      { wch: 25 }, // Daño
      { wch: 25 }, // Obs
      { wch: 16 }  // Fecha
    ]

    const hoy = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Censo_Lockers_Planta_Beneficio_${hoy}.xlsx`)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* Barra de Control y Filtros (Oculta en Impresión) */}
      <div className="print:hidden space-y-4 mb-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/lockers"
              className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Padrón y Lista Oficial de Asignación de Lockers
              </h1>
              <p className="text-xs text-zinc-500">
                Planta de Beneficio · Reporte general con trabajador, puesto, departamento, llave y ubicación física.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportarExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Lista (PDF)</span>
            </button>
          </div>
        </div>

        {/* KPIs Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-200 dark:border-zinc-700">
            <span className="text-[10px] uppercase font-bold text-zinc-500">Total Casilleros</span>
            <p className="text-xl font-black text-zinc-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-sky-500/10 p-3 rounded-xl border border-sky-500/30">
            <span className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-300">Asignados</span>
            <p className="text-xl font-black text-sky-700 dark:text-sky-300">{stats.asignados}</p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Disponibles (Libres)</span>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{stats.disponibles}</p>
          </div>
          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">En Reparación</span>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300">{stats.reparacion}</p>
          </div>
          <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/30">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Inservibles / Baja</span>
            <p className="text-xl font-black text-rose-700 dark:text-rose-300">{stats.inservibles}</p>
          </div>
        </div>

        {/* Filtros y Buscador */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filtrar por nombre, ficha, puesto o locker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs"
            />
          </div>

          <div>
            <select
              value={filtroBateria}
              onChange={(e) => setFiltroBateria(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
            >
              <option value="TODAS">Todas las Baterías</option>
              <option value="Batería 1">Batería 1 (M01 a M12)</option>
              <option value="Batería 2">Batería 2 (M13 a M24)</option>
              <option value="Batería 3">Batería 3 (M25 a M36)</option>
              <option value="Batería 4 (Módulos Dobles Grandes)">Batería 4 - Dobles Grandes (M37 a M42)</option>
            </select>
          </div>

          <div>
            <select
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="Asignado">Solo Asignados (Con Titular)</option>
              <option value="Disponible">Solo Libres / Disponibles</option>
              <option value="En Reparacion">En Reparación</option>
              <option value="Inservible">Inservibles / Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* REPORTE TABULAR IMPRIMIBLE */}
      <div className="bg-white text-zinc-900 rounded-2xl border border-slate-300 dark:border-zinc-800 shadow-xl overflow-hidden print:border-none print:shadow-none p-6 print:p-0">
        {/* Encabezado Oficial en Impresión */}
        <div className="border-b-2 border-zinc-900 pb-4 mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-widest text-zinc-900 uppercase">
                MINAS DE BACIS · DEPARTAMENTO DE RECURSOS HUMANOS
              </span>
            </div>
            <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight mt-0.5">
              Censo y Asignación de Lockers - Planta de Beneficio
            </h2>
            <p className="text-xs text-zinc-600 font-medium">
              Total de casilleros inventariados: <strong>{itemsFiltrados.length}</strong> | Asignados: <strong>{stats.asignados}</strong> | Libres: <strong>{stats.disponibles}</strong>
            </p>
          </div>

          <div className="text-right text-xs">
            <p className="font-bold text-zinc-600">Fecha de Impresión:</p>
            <p className="font-mono font-black text-zinc-900">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        {/* Tabla Oficial */}
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-500">Cargando reporte de inventario...</p>
          </div>
        ) : itemsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">
            No se encontraron casilleros con los filtros especificados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900 text-white font-black text-[10px] uppercase tracking-wider print:bg-zinc-200 print:text-zinc-900">
                  <th className="p-2 border border-zinc-800 print:border-zinc-400 text-center w-8">#</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Locker / Módulo</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Casillero</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Nivel</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Estado</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400 text-center">Ficha</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Trabajador Titular</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Puesto</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Departamento</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Condición Llave</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Daño / Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[11px]">
                {itemsFiltrados.map((item, index) => {
                  const emp = item.empleados
                  const esAsignado = item.estatus === 'Asignado'
                  const esLibre = item.estatus === 'Disponible'
                  const esReparacion = item.estatus === 'En Reparacion'
                  const esInservible = item.estatus === 'Inservible'

                  return (
                    <tr
                      key={item.id_casillero}
                      className={`hover:bg-slate-50 print:hover:bg-transparent ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60 print:bg-zinc-100/60'
                      }`}
                    >
                      <td className="p-2 border border-zinc-200 text-center font-mono font-bold text-zinc-500">
                        {index + 1}
                      </td>

                      <td className="p-2 border border-zinc-200">
                        <span className="font-mono font-black text-zinc-900">{item.modulo_codigo}</span>
                        <span className="block text-[9px] text-zinc-500">{item.modulo_bateria?.split(' ')[0]} {item.modulo_bateria?.split(' ')[1]}</span>
                      </td>

                      <td className="p-2 border border-zinc-200 font-mono font-black text-zinc-950">
                        {item.codigo_casillero}
                      </td>

                      <td className="p-2 border border-zinc-200">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.posicion_nivel.includes('Grande')
                            ? 'bg-indigo-100 text-indigo-900 font-black'
                            : 'text-zinc-600'
                        }`}>
                          {item.posicion_nivel}
                        </span>
                      </td>

                      <td className="p-2 border border-zinc-200">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          esAsignado
                            ? 'bg-sky-100 text-sky-800'
                            : esLibre
                            ? 'bg-emerald-100 text-emerald-800'
                            : esReparacion
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.estatus}
                        </span>
                      </td>

                      <td className="p-2 border border-zinc-200 text-center font-mono font-bold text-zinc-800">
                        {emp ? `#${emp.numero_empleado}` : item.numero_empleado_provisional || '-'}
                      </td>

                      <td className="p-2 border border-zinc-200 font-bold text-zinc-900">
                        {emp ? (
                          <span>{emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombre}</span>
                        ) : item.nombre_provisional ? (
                          <span className="text-amber-800">{item.nombre_provisional} (Provisional)</span>
                        ) : (
                          <span className="text-emerald-700 italic font-normal">-- Libre / Sin Asignar --</span>
                        )}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-700">
                        {emp?.puesto || '-'}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-600 text-[10px]">
                        {emp?.departamento || (item.nombre_provisional ? 'Planta de Beneficio' : '-')}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-700">
                        <span className="font-semibold">{item.condicion_llave || 'N/A'}</span>
                        {item.numero_llave && (
                          <span className="block font-mono text-[9px] text-zinc-500">Llave #{item.numero_llave}</span>
                        )}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-600">
                        {item.descripcion_dano ? (
                          <span className="text-amber-800 font-bold">⚠️ {item.descripcion_dano}</span>
                        ) : item.observaciones ? (
                          <span>{item.observaciones}</span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Firmas de Autorización al pie en Impresión */}
        <div className="hidden print:grid grid-cols-3 gap-8 pt-12 text-center text-xs mt-6 border-t-2 border-zinc-400">
          <div>
            <div className="border-t border-zinc-800 pt-1 font-black uppercase">
              Superintendente Planta de Beneficio
            </div>
            <span className="text-[10px] text-zinc-500">Revisión y Aprobación</span>
          </div>

          <div>
            <div className="border-t border-zinc-800 pt-1 font-black uppercase">
              Delegado / Representante Sindical
            </div>
            <span className="text-[10px] text-zinc-500">Conformidad y Censo Sindical</span>
          </div>

          <div>
            <div className="border-t border-zinc-800 pt-1 font-black uppercase">
              Recursos Humanos / Control de Bienes
            </div>
            <span className="text-[10px] text-zinc-500">Registro y Resguardo</span>
          </div>
        </div>
      </div>

      {/* Estilos de Impresión */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 6mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}
