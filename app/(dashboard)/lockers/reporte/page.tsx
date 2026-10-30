'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/utils/supabase/client'
import { parseLockerObservaciones, getAreaTheme } from '@/utils/lockerMeta'
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
  telefono?: string
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
  modulo_area?: string
  modulo_bateria?: string
  modulo_tipo?: string
  modulo_ubicacion?: string
}

export default function ReporteLockersPage() {
  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroArea, setFiltroArea] = useState('TODAS')
  const [filtroBateria, setFiltroBateria] = useState('TODAS')
  const [filtroEstatus, setFiltroEstatus] = useState('TODOS')

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: modData } = await supabase
        .from('lockers_modulos')
        .select(`
          id_modulo, codigo_modulo, area, bateria, tipo_modulo, ubicacion_detalle, orden,
          lockers_casilleros (
            *,
            empleados:id_empleado (
              id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto, telefono
            )
          )
        `)
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
                modulo_area: mod.area || 'Planta de Beneficio',
                modulo_bateria: mod.bateria,
                modulo_tipo: mod.tipo_modulo === '2_niveles' ? '2 Niveles (Grande)' : '3 Niveles',
                modulo_ubicacion: mod.ubicacion_detalle || mod.area || 'Planta de Beneficio'
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

  // Áreas dinámicas
  const areasDisponibles = useMemo(() => {
    const list = Array.from(new Set(casilleros.map(c => c.modulo_area || 'Planta de Beneficio')))
    return list.sort()
  }, [casilleros])

  // Baterías disponibles según el área seleccionada
  const bateriasDisponibles = useMemo(() => {
    const filtrados = filtroArea === 'TODAS'
      ? casilleros
      : casilleros.filter(c => c.modulo_area === filtroArea)
    const list = Array.from(new Set(filtrados.map(c => c.modulo_bateria || 'General')))
    return list.sort()
  }, [casilleros, filtroArea])

  // Filtrado
  const itemsFiltrados = useMemo(() => {
    return casilleros.filter(item => {
      if (filtroArea !== 'TODAS' && item.modulo_area !== filtroArea) return false
      if (filtroBateria !== 'TODAS' && item.modulo_bateria !== filtroBateria) return false
      const { meta } = parseLockerObservaciones(item.observaciones)

      if (filtroEstatus === 'PENDIENTE_RESGUARDO') {
        if (item.estatus !== 'Asignado' || meta.estatus_resguardo === 'Firmado') return false
      } else if (filtroEstatus === 'RESGUARDO_FIRMADO') {
        if (item.estatus !== 'Asignado' || meta.estatus_resguardo !== 'Firmado') return false
      } else if (filtroEstatus !== 'TODOS' && item.estatus !== filtroEstatus) {
        return false
      }

      if (!search.trim()) return true
      const q = search.toLowerCase()
      const cod = (item.codigo_casillero || '').toLowerCase()
      const mod = (item.modulo_codigo || '').toLowerCase()
      const ar = (item.modulo_area || '').toLowerCase()
      const prov = (item.nombre_provisional || '').toLowerCase()
      const emp = item.empleados
        ? `${item.empleados.nombre} ${item.empleados.apellido_paterno} ${item.empleados.apellido_materno || ''} ${item.empleados.numero_empleado} ${item.empleados.puesto} ${item.empleados.departamento}`.toLowerCase()
        : ''

      return cod.includes(q) || mod.includes(q) || ar.includes(q) || prov.includes(q) || emp.includes(q)
    })
  }, [casilleros, filtroArea, filtroBateria, filtroEstatus, search])

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
      const { notasLimpias, meta } = parseLockerObservaciones(item.observaciones)

      const nombreTrabajador = emp 
        ? `${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.nombre}`.trim()
        : item.nombre_provisional ? `${item.nombre_provisional}` : 'DISPONIBLE / LIBRE'

      const ficha = emp 
        ? emp.numero_empleado 
        : item.numero_empleado_provisional || ''

      const dejaCopiaStr =
        item.estatus !== 'Asignado'
          ? ''
          : meta.deja_llave_rh === 'Si'
          ? 'SÍ (Dejará Copia)'
          : meta.deja_llave_rh === 'Ya Entregada' || item.condicion_llave === 'Copia en RH'
          ? 'SÍ (Copia Entregada)'
          : 'NO'

      const resguardoStr =
        item.estatus !== 'Asignado'
          ? ''
          : meta.estatus_resguardo === 'Firmado'
          ? 'FIRMADO EN RH'
          : 'PENDIENTE FIRMA EN RH'

      return {
        '#': index + 1,
        'Área / Departamento': item.modulo_area || 'Planta de Beneficio',
        'Locker (Módulo)': item.modulo_codigo,
        'Batería / Ubicación': item.modulo_bateria,
        'Código Casillero': item.codigo_casillero,
        'Nivel / Posición': item.posicion_nivel,
        'Estado': item.estatus,
        'Ficha #': ficha,
        'Nombre del Trabajador': nombreTrabajador,
        'Puesto': emp?.puesto || meta.puesto_provisional || '',
        'Departamento': emp?.departamento || meta.departamento_provisional || item.modulo_area || 'Planta de Beneficio',
        'Teléfono': meta.telefono_contacto || emp?.telefono || '',
        'Condición de Llave': item.condicion_llave || 'N/A',
        '¿Deja Copia Llave en RH?': dejaCopiaStr,
        'Número de Llave': item.numero_llave || '',
        'Estatus Resguardo RH': resguardoStr,
        'Folio Resguardo': meta.folio_resguardo || '',
        'Falla / Daño Reportado': item.descripcion_dano || '',
        'Observaciones': notasLimpias || '',
        'Fecha de Asignación': item.fecha_asignacion ? new Date(item.fecha_asignacion).toLocaleDateString() : ''
      }
    })

    const ws = XLSX.utils.json_to_sheet(filasExcel)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Censo Lockers')

    ws['!cols'] = [
      { wch: 4 },
      { wch: 14 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 13 },
      { wch: 10 },
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 12 },
      { wch: 22 },
      { wch: 20 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 }
    ]

    const hoy = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Censo_y_Resguardos_Lockers_PB_${hoy}.xlsx`)
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
                Padrón Oficial de Asignación, Llaves y Resguardos de Lockers
              </h1>
              <p className="text-xs text-zinc-500">
                Control General y por Departamento · Titulares, copia de llave en RH y estatus de resguardo.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
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
              value={filtroArea}
              onChange={(e) => {
                setFiltroArea(e.target.value)
                setFiltroBateria('TODAS')
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-amber-500/40 text-xs font-bold text-zinc-900 dark:text-amber-300"
            >
              <option value="TODAS">Todos los Departamentos ({casilleros.length})</option>
              {areasDisponibles.map(area => {
                const count = casilleros.filter(c => c.modulo_area === area).length
                const theme = getAreaTheme(area)
                return (
                  <option key={area} value={area}>
                    {theme.icon} {area} ({count})
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <select
              value={filtroBateria}
              onChange={(e) => setFiltroBateria(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
            >
              <option value="TODAS">Todas las Baterías</option>
              {bateriasDisponibles.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
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
              <option value="PENDIENTE_RESGUARDO">⏳ Pendientes de Firmar Resguardo en RH</option>
              <option value="RESGUARDO_FIRMADO">✅ Con Resguardo Firmado</option>
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
              Padrón de Asignación, Copia de Llaves y Resguardos de Lockers
            </h2>
            <p className="text-xs text-zinc-600 font-medium">
              Control General de Lockers · Total mostrados: <strong>{itemsFiltrados.length}</strong> | Asignados: <strong>{stats.asignados}</strong> | Libres: <strong>{stats.disponibles}</strong>
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
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Casillero</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Área</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Nivel</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Estado</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400 text-center">Ficha</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Trabajador Titular</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Puesto</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Cerradura</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400 text-center">¿Deja Llave RH?</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Resguardo RH</th>
                  <th className="p-2 border border-zinc-800 print:border-zinc-400">Notas / Daño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[11px]">
                {itemsFiltrados.map((item, index) => {
                  const emp = item.empleados
                  const esAsignado = item.estatus === 'Asignado'
                  const esLibre = item.estatus === 'Disponible'
                  const esReparacion = item.estatus === 'En Reparacion'
                  const { notasLimpias, meta } = parseLockerObservaciones(item.observaciones)

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
                        <span className="font-mono font-black text-zinc-950">{item.codigo_casillero}</span>
                        <span className="block text-[9px] text-zinc-500">{item.modulo_bateria?.split(' ')[0]} {item.modulo_bateria?.split(' ')[1]}</span>
                      </td>

                      <td className="p-2 border border-zinc-200">
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] text-zinc-800">
                          <span>{getAreaTheme(item.modulo_area).icon}</span>
                          <span className="truncate max-w-[110px]">{item.modulo_area || 'Planta de Beneficio'}</span>
                        </span>
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
                          <span className="text-zinc-900">{item.nombre_provisional}</span>
                        ) : (
                          <span className="text-emerald-700 italic font-normal">-- Libre / Sin Asignar --</span>
                        )}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-700">
                        {emp?.puesto || meta.puesto_provisional || '-'}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-700">
                        <span className="font-semibold">{item.condicion_llave || 'N/A'}</span>
                        {item.numero_llave && (
                          <span className="block font-mono text-[9px] text-zinc-500">Llave #{item.numero_llave}</span>
                        )}
                      </td>

                      <td className="p-2 border border-zinc-200 text-center font-bold">
                        {esAsignado ? (
                          meta.deja_llave_rh === 'Si' || meta.deja_llave_rh === 'Ya Entregada' || item.condicion_llave === 'Copia en RH' ? (
                            <span className="text-emerald-700 font-black">SÍ</span>
                          ) : (
                            <span className="text-zinc-500">NO</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="p-2 border border-zinc-200">
                        {esAsignado ? (
                          meta.estatus_resguardo === 'Firmado' ? (
                            <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                              ✅ FIRMADO
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              ⏳ FALTA FIRMA RH
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>

                      <td className="p-2 border border-zinc-200 text-zinc-600">
                        {item.descripcion_dano ? (
                          <span className="text-amber-800 font-bold">⚠️ {item.descripcion_dano}</span>
                        ) : notasLimpias ? (
                          <span>{notasLimpias}</span>
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
              Superintendente / Responsable de Área
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
