'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase/client'
import { 
  FolderLock, Smartphone, Printer, Search, Filter, RefreshCw, 
  CheckCircle2, AlertTriangle, XCircle, Key, Lock, Wrench, 
  UserPlus, UserCheck, AlertCircle, Sparkles, Building2, ChevronRight,
  Layers, Info, ShieldAlert, ArrowUpDown, X, Save, Trash2, Edit3
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
  condicion_llave: 'Tiene Llave' | 'Candado Personal' | 'Sin Llave' | 'Copia en RH' | 'Sin Asignar'
  numero_llave: string | null
  descripcion_dano: string | null
  observaciones: string | null
  fecha_asignacion: string | null
  fecha_reporte_dano: string | null
  empleados?: Empleado | null
}

interface LockerModulo {
  id_modulo: string
  codigo_modulo: string
  area: string
  bateria: string
  tipo_modulo: '3_niveles' | '2_niveles'
  ubicacion_detalle: string
  orden: number
  lockers_casilleros?: LockerCasillero[]
}

export default function LockersPage() {
  const [modulos, setModulos] = useState<LockerModulo[]>([])
  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBateria, setSelectedBateria] = useState('TODAS')
  const [selectedEstatus, setSelectedEstatus] = useState('TODOS')
  const [selectedTipo, setSelectedTipo] = useState('TODOS')

  // Modal de edición de casillero
  const [selectedCasillero, setSelectedCasillero] = useState<LockerCasillero | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Formulario en modal
  const [editEstatus, setEditEstatus] = useState<'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible'>('Disponible')
  const [editIdEmpleado, setEditIdEmpleado] = useState<string>('')
  const [editNombreProvisional, setEditNombreProvisional] = useState('')
  const [editNumEmpleadoProvisional, setEditNumEmpleadoProvisional] = useState('')
  const [editEsNuevoTrabajador, setEditEsNuevoTrabajador] = useState(false)
  const [editCondicionLlave, setEditCondicionLlave] = useState<string>('Sin Asignar')
  const [editNumeroLlave, setEditNumeroLlave] = useState('')
  const [editDescripcionDano, setEditDescripcionDano] = useState('')
  const [editObservaciones, setEditObservaciones] = useState('')
  const [filtroEmpleadoModal, setFiltroEmpleadoModal] = useState('')
  const [soloBeneficio, setSoloBeneficio] = useState(true)

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true)
    try {
      // 1. Obtener empleados para el buscador
      const { data: empData, error: empErr } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto')
        .order('apellido_paterno', { ascending: true })

      if (!empErr && empData) {
        setEmpleados(empData)
      }

      // 2. Obtener módulos y casilleros
      const { data: modData, error: modErr } = await supabase
        .from('lockers_modulos')
        .select(`
          *,
          lockers_casilleros (
            *,
            empleados:id_empleado (
              id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto
            )
          )
        `)
        .eq('area', 'Planta de Beneficio')
        .order('orden', { ascending: true })

      if (modErr) {
        if (modErr.code === 'PGRST205' || modErr.message?.includes('does not exist') || modErr.message?.includes('schema cache')) {
          setTableMissing(true)
        } else {
          console.error('Error al consultar lockers:', modErr)
        }
        setLoading(false)
        return
      }

      if (modData) {
        setTableMissing(false)
        setModulos(modData)
        // Aplanar casilleros
        const allCasilleros: LockerCasillero[] = []
        modData.forEach(m => {
          if (m.lockers_casilleros) {
            // ordenar por numero_en_modulo ascendente (1: Superior, 2: Medio, 3: Inferior)
            const ordenados = [...m.lockers_casilleros].sort((a, b) => a.numero_en_modulo - b.numero_en_modulo)
            allCasilleros.push(...ordenados)
          }
        })
        setCasilleros(allCasilleros)
      }
    } catch (err) {
      console.error('Error general cargando lockers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Abrir modal de edición
  const handleOpenEdit = (casillero: LockerCasillero) => {
    setSelectedCasillero(casillero)
    setEditEstatus(casillero.estatus)
    setEditIdEmpleado(casillero.id_empleado || '')
    setEditNombreProvisional(casillero.nombre_provisional || '')
    setEditNumEmpleadoProvisional(casillero.numero_empleado_provisional || '')
    setEditEsNuevoTrabajador(!!casillero.nombre_provisional && !casillero.id_empleado)
    setEditCondicionLlave(casillero.condicion_llave || 'Sin Asignar')
    setEditNumeroLlave(casillero.numero_llave || '')
    setEditDescripcionDano(casillero.descripcion_dano || '')
    setEditObservaciones(casillero.observaciones || '')
    setFiltroEmpleadoModal('')
    setIsEditModalOpen(true)
  }

  // Guardar cambios del casillero
  const handleGuardarCasillero = async () => {
    if (!selectedCasillero) return
    setSaving(true)

    try {
      let finalEstatus = editEstatus
      let finalIdEmpleado: string | null = editIdEmpleado || null
      let finalNombreProv: string | null = editNombreProvisional.trim() || null
      let finalNumProv: string | null = editNumEmpleadoProvisional.trim() || null

      if (editEsNuevoTrabajador) {
        finalIdEmpleado = null
        if (finalNombreProv && finalEstatus === 'Disponible') {
          finalEstatus = 'Asignado'
        }
      } else {
        finalNombreProv = null
        finalNumProv = null
        if (finalIdEmpleado && finalEstatus === 'Disponible') {
          finalEstatus = 'Asignado'
        }
      }

      if (finalEstatus === 'Disponible') {
        finalIdEmpleado = null
        finalNombreProv = null
        finalNumProv = null
      }

      const payload = {
        estatus: finalEstatus,
        id_empleado: finalIdEmpleado,
        nombre_provisional: finalNombreProv,
        numero_empleado_provisional: finalNumProv,
        condicion_llave: editCondicionLlave,
        numero_llave: editNumeroLlave.trim() || null,
        descripcion_dano: finalEstatus === 'En Reparacion' || finalEstatus === 'Inservible' ? editDescripcionDano : null,
        observaciones: editObservaciones.trim() || null,
        fecha_asignacion: (finalIdEmpleado || finalNombreProv) ? (selectedCasillero.fecha_asignacion || new Date().toISOString()) : null,
        fecha_reporte_dano: (finalEstatus === 'En Reparacion' || finalEstatus === 'Inservible') ? (selectedCasillero.fecha_reporte_dano || new Date().toISOString()) : null,
        actualizado_el: new Date().toISOString()
      }

      const { error } = await supabase
        .from('lockers_casilleros')
        .update(payload)
        .eq('id_casillero', selectedCasillero.id_casillero)

      if (error) throw error

      setIsEditModalOpen(false)
      await cargarDatos()
    } catch (err: any) {
      alert('Error al guardar cambios: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  // Desasignar casillero rápido
  const handleLiberarCasillero = async () => {
    if (!selectedCasillero) return
    if (!confirm(`¿Estás seguro de liberar el casillero ${selectedCasillero.codigo_casillero}?`)) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('lockers_casilleros')
        .update({
          estatus: 'Disponible',
          id_empleado: null,
          nombre_provisional: null,
          numero_empleado_provisional: null,
          fecha_asignacion: null,
          actualizado_el: new Date().toISOString()
        })
        .eq('id_casillero', selectedCasillero.id_casillero)

      if (error) throw error
      setIsEditModalOpen(false)
      await cargarDatos()
    } catch (err: any) {
      alert('Error al liberar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  // Filtrado de empleados en modal
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(e => {
      const matchDep = soloBeneficio ? (e.departamento?.toLowerCase().includes('beneficio')) : true
      if (!matchDep) return false

      if (!filtroEmpleadoModal) return true
      const q = filtroEmpleadoModal.toLowerCase()
      const fullName = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
      const numStr = String(e.numero_empleado || '')
      return fullName.includes(q) || numStr.includes(q)
    })
  }, [empleados, filtroEmpleadoModal, soloBeneficio])

  // Estadísticas KPI
  const stats = useMemo(() => {
    const total = casilleros.length
    const asignados = casilleros.filter(c => c.estatus === 'Asignado').length
    const disponibles = casilleros.filter(c => c.estatus === 'Disponible').length
    const reparacion = casilleros.filter(c => c.estatus === 'En Reparacion').length
    const inservibles = casilleros.filter(c => c.estatus === 'Inservible').length
    const sinLlave = casilleros.filter(c => c.condicion_llave === 'Sin Llave').length

    return { total, asignados, disponibles, reparacion, inservibles, sinLlave }
  }, [casilleros])

  // Filtrado de módulos en el planograma
  const modulosFiltrados = useMemo(() => {
    return modulos.filter(mod => {
      // Filtro de batería
      if (selectedBateria !== 'TODAS' && mod.bateria !== selectedBateria) return false

      // Filtro de tipo
      if (selectedTipo === '3_NIVELES' && mod.tipo_modulo !== '3_niveles') return false
      if (selectedTipo === '2_NIVELES' && mod.tipo_modulo !== '2_niveles') return false

      // Filtro de casilleros internos
      if (selectedEstatus !== 'TODOS' || searchTerm.trim() !== '') {
        const matchingCasilleros = mod.lockers_casilleros?.some(c => {
          const matchEstatus = selectedEstatus === 'TODOS' || c.estatus === selectedEstatus
          if (!matchEstatus) return false

          if (!searchTerm.trim()) return true
          const q = searchTerm.toLowerCase()
          const cod = c.codigo_casillero.toLowerCase()
          const prov = (c.nombre_provisional || '').toLowerCase()
          const empName = c.empleados ? `${c.empleados.nombre} ${c.empleados.apellido_paterno} ${c.empleados.apellido_materno || ''}`.toLowerCase() : ''
          const empNum = c.empleados ? String(c.empleados.numero_empleado) : ''

          return cod.includes(q) || prov.includes(q) || empName.includes(q) || empNum.includes(q)
        })
        return matchingCasilleros
      }

      return true
    })
  }, [modulos, selectedBateria, selectedTipo, selectedEstatus, searchTerm])

  // Baterías únicas para tabs
  const bateriasDisponibles = useMemo(() => {
    const set = new Set(modulos.map(m => m.bateria))
    return Array.from(set)
  }, [modulos])

  // Ayudante de color de estatus
  const getBadgeColor = (estatus: string) => {
    switch (estatus) {
      case 'Disponible':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
      case 'Asignado':
        return 'bg-sky-500/10 text-sky-600 border-sky-500/30 dark:text-sky-400'
      case 'En Reparacion':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
      case 'Inservible':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400'
      default:
        return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/30'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header con Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FolderLock className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Control de Lockers y Casilleros
              </h1>
              <p className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Área: <span className="text-amber-300 font-bold">Planta de Beneficio</span> (120 Casilleros / 60 Trabajadores)
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/lockers/censo"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Smartphone className="w-4 h-4" />
            <span>📱 Censo Móvil (Celular)</span>
          </Link>

          <Link
            href="/lockers/fichas"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Fichas Media Carta</span>
          </Link>

          <button
            onClick={cargarDatos}
            disabled={loading}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerta de Tabla no creada en Supabase */}
      {tableMissing && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6 text-amber-900 dark:text-amber-200 space-y-3 shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-black text-lg text-amber-800 dark:text-amber-300">
                Tablas de Lockers pendientes de creación en Supabase
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-1 leading-relaxed">
                Hemos preparado el script con las 2 tablas y la creación automática de los <strong>42 módulos (36 de 3 casilleros y 6 de 2 casilleros = 120 casilleros)</strong>.
              </p>
              <div className="mt-3 bg-zinc-950 text-zinc-200 p-4 rounded-xl border border-zinc-800 font-mono text-xs overflow-x-auto">
                <p className="text-zinc-400 mb-2 font-sans font-bold">Pasos para activar en 1 minuto:</p>
                <ol className="list-decimal list-inside space-y-1 font-sans text-xs text-zinc-300">
                  <li>Abre tu consola de <strong>Supabase</strong> {'->'} <strong>SQL Editor</strong>.</li>
                  <li>Abre o copia el archivo del proyecto: <span className="text-amber-400 font-mono font-bold">SQL_LOCKERS_PLANTA_BENEFICIO.sql</span>.</li>
                  <li>Pégalo y dale clic en <strong>RUN</strong>. Luego pulsa el botón de abajo.</li>
                </ol>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={cargarDatos}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-all shadow"
                >
                  🔄 Ya ejecuté el script, reintentar conexión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas KPI de Estado */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            {stats.total || 120}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">42 módulos físicos</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Asignados</span>
            <UserCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-2">
            {stats.asignados}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Con trabajador</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Disponibles</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.disponibles}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Libres para uso</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Reparación</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {stats.reparacion}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Requieren servicio</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Inservibles</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {stats.inservibles}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Fuera de servicio</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Sin Llave</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-2">
            {stats.sinLlave}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Falta cerradura</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Buscador */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por código (PB-M01-A), trabajador o ficha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Filtro por Estatus */}
          <div>
            <select
              value={selectedEstatus}
              onChange={(e) => setSelectedEstatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="Disponible">🟢 Disponible</option>
              <option value="Asignado">🔵 Asignado</option>
              <option value="En Reparacion">🟠 En Reparación</option>
              <option value="Inservible">🔴 Inservible / Baja</option>
            </select>
          </div>

          {/* Filtro por Tipo de Módulo */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
            >
              <option value="TODOS">Todos los Tipos (120 Cas.)</option>
              <option value="3_NIVELES">📦 3 Niveles (90% - 108 Cas.)</option>
              <option value="2_NIVELES">🚪 2 Niveles Grandes (10% - 12 Cas.)</option>
            </select>
          </div>
        </div>

        {/* Pestañas de Batería */}
        {bateriasDisponibles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-semibold text-zinc-500">Filtrar Batería:</span>
            <button
              onClick={() => setSelectedBateria('TODAS')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedBateria === 'TODAS'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-slate-200'
              }`}
            >
              Todas ({modulos.length} Módulos)
            </button>
            {bateriasDisponibles.map(bat => (
              <button
                key={bat}
                onClick={() => setSelectedBateria(bat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedBateria === bat
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                {bat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Planograma Visual de Módulos */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-500">Cargando planograma de lockers...</p>
        </div>
      ) : modulosFiltrados.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <Info className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-500">No se encontraron lockers con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Agrupar visualmente por batería */}
          {Array.from(new Set(modulosFiltrados.map(m => m.bateria))).map(batName => {
            const modsDeBateria = modulosFiltrados.filter(m => m.bateria === batName)

            return (
              <div key={batName} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h3 className="font-black text-lg text-zinc-800 dark:text-zinc-200">
                      {batName}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold">
                      {modsDeBateria.length} Módulos
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {modsDeBateria.reduce((acc, m) => acc + (m.lockers_casilleros?.length || 0), 0)} Casilleros
                  </span>
                </div>

                {/* Grid de Módulos (Cuerpos Físicos) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                  {modsDeBateria.map(modulo => {
                    const esDoble = modulo.tipo_modulo === '2_niveles'
                    const items = modulo.lockers_casilleros || []

                    return (
                      <div
                        key={modulo.id_modulo}
                        className={`bg-white dark:bg-zinc-900 rounded-xl border-2 transition-all shadow-sm flex flex-col ${
                          esDoble
                            ? 'border-indigo-400/50 bg-indigo-500/5 dark:bg-indigo-950/20'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-amber-500/50'
                        }`}
                      >
                        {/* Cabecera del Módulo */}
                        <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800/80 rounded-t-lg flex items-center justify-between border-b border-slate-200 dark:border-zinc-700/60">
                          <span className="font-mono font-black text-xs text-zinc-800 dark:text-zinc-200">
                            {modulo.codigo_modulo}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            esDoble
                              ? 'bg-indigo-500 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                          }`}>
                            {esDoble ? '2 Niveles' : '3 Niveles'}
                          </span>
                        </div>

                        {/* Casilleros apilados verticalmente dentro del módulo */}
                        <div className="p-1.5 flex-1 flex flex-col gap-1.5">
                          {items.map(cas => {
                            const emp = cas.empleados
                            const esAsignado = cas.estatus === 'Asignado'
                            const esReparacion = cas.estatus === 'En Reparacion'
                            const esInservible = cas.estatus === 'Inservible'

                            return (
                              <div
                                key={cas.id_casillero}
                                onClick={() => handleOpenEdit(cas)}
                                className={`group relative p-2 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                                  esDoble ? 'min-h-[110px]' : 'min-h-[78px]'
                                } ${
                                  esInservible
                                    ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20 text-rose-900 dark:text-rose-300'
                                    : esReparacion
                                    ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300'
                                    : esAsignado
                                    ? 'bg-sky-500/10 border-sky-500/40 hover:bg-sky-500/20 text-sky-900 dark:text-sky-300'
                                    : 'bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300'
                                }`}
                              >
                                {/* Código y Nivel */}
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono font-bold text-xs">
                                    {cas.codigo_casillero}
                                  </span>
                                  <span className="text-[9px] font-semibold opacity-75">
                                    {cas.posicion_nivel.includes('Grande') ? 'GRANDE' : cas.posicion_nivel}
                                  </span>
                                </div>

                                {/* Ocupante / Estado */}
                                <div className="my-1">
                                  {emp ? (
                                    <div className="truncate">
                                      <p className="font-black text-xs truncate leading-tight text-zinc-900 dark:text-white">
                                        {emp.apellido_paterno} {emp.nombre?.split(' ')[0]}
                                      </p>
                                      <p className="text-[10px] text-zinc-500 font-medium truncate">
                                        Ficha #{emp.numero_empleado}
                                      </p>
                                    </div>
                                  ) : cas.nombre_provisional ? (
                                    <div className="truncate">
                                      <p className="font-black text-xs truncate leading-tight text-amber-600 dark:text-amber-400">
                                        {cas.nombre_provisional}
                                      </p>
                                      <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 rounded font-bold">
                                        Provisional
                                      </span>
                                    </div>
                                  ) : esReparacion ? (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <Wrench className="w-3 h-3" /> Reparación
                                    </span>
                                  ) : esInservible ? (
                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> Inservible
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      Disponible
                                    </span>
                                  )}
                                </div>

                                {/* Footer del casillero: Llave / Candado */}
                                <div className="flex items-center justify-between text-[9px] pt-1 border-t border-black/5 dark:border-white/5">
                                  <div className="flex items-center gap-1">
                                    {cas.condicion_llave === 'Tiene Llave' ? (
                                      <span title="Tiene Llave"><Key className="w-2.5 h-2.5 text-emerald-500" /></span>
                                    ) : cas.condicion_llave === 'Candado Personal' ? (
                                      <span title="Candado Propio"><Lock className="w-2.5 h-2.5 text-sky-500" /></span>
                                    ) : cas.condicion_llave === 'Sin Llave' ? (
                                      <span title="Sin Llave"><AlertTriangle className="w-2.5 h-2.5 text-orange-500" /></span>
                                    ) : (
                                      <span className="text-zinc-400">-</span>
                                    )}
                                    <span className="truncate opacity-75">{cas.condicion_llave || 'N/A'}</span>
                                  </div>
                                  <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Asignación / Edición */}
      {isEditModalOpen && selectedCasillero && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <FolderLock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black tracking-tight">
                    Casillero {selectedCasillero.codigo_casillero}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Posición: <span className="text-amber-300 font-bold">{selectedCasillero.posicion_nivel}</span> | {selectedCasillero.posicion_nivel.includes('Grande') ? 'Módulo 2 Niveles (Grande)' : 'Módulo 3 Niveles'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal Scrollable */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-zinc-900 dark:text-zinc-100">
              {/* Selector de Estado Operativo */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Estado del Casillero
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditEstatus('Disponible')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'Disponible'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🟢 Libre
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEstatus('Asignado')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'Asignado'
                        ? 'bg-sky-500 text-white border-sky-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🔵 Asignado
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEstatus('En Reparacion')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'En Reparacion'
                        ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🟠 Reparación
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEstatus('Inservible')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'Inservible'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🔴 Inservible
                  </button>
                </div>
              </div>

              {/* Si está en reparación o inservible: Descripción de Daño */}
              {(editEstatus === 'En Reparacion' || editEstatus === 'Inservible') && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Wrench className="w-4 h-4" />
                    <span>Reporte de Mantenimiento / Daño Físico</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Describe el fallo (ej. cerradura rota, bisagra desprendida, sin puerta...)"
                    value={editDescripcionDano}
                    onChange={(e) => setEditDescripcionDano(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-500/30 text-xs focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
                  />
                </div>
              )}

              {/* Asignación de Trabajador (si es Asignado o Disponible) */}
              {(editEstatus === 'Asignado' || editEstatus === 'Disponible') && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Trabajador Titular
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditEsNuevoTrabajador(!editEsNuevoTrabajador)}
                      className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {editEsNuevoTrabajador ? 'Seleccionar del Catálogo RH' : '+ Alta Rápida de Nuevo'}
                    </button>
                  </div>

                  {!editEsNuevoTrabajador ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Buscar sindicalizado o ficha..."
                            value={filtroEmpleadoModal}
                            onChange={(e) => setFiltroEmpleadoModal(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={soloBeneficio}
                            onChange={(e) => setSoloBeneficio(e.target.checked)}
                            className="rounded text-amber-500 focus:ring-amber-400"
                          />
                          <span>Solo Planta Beneficio</span>
                        </label>
                      </div>

                      <select
                        value={editIdEmpleado}
                        onChange={(e) => {
                          setEditIdEmpleado(e.target.value)
                          if (e.target.value) setEditEstatus('Asignado')
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white"
                      >
                        <option value="">-- Sin Trabajador Asignado --</option>
                        {empleadosFiltrados.map(emp => (
                          <option key={emp.id_empleado} value={emp.id_empleado}>
                            #{emp.numero_empleado} - {emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombre} ({emp.puesto || emp.departamento})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                        Captura rápida para trabajadores de nuevo ingreso que aún no se han subido a la plataforma:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Nombre Completo del Trabajador"
                            value={editNombreProvisional}
                            onChange={(e) => setEditNombreProvisional(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white font-bold"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Ficha / Temporal"
                            value={editNumEmpleadoProvisional}
                            onChange={(e) => setEditNumEmpleadoProvisional(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Control de Llave / Cerradura */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Condición de Llave / Candado
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Tiene Llave', 'Candado Personal', 'Sin Llave', 'Copia en RH'].map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setEditCondicionLlave(tipo)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                        editCondicionLlave === tipo
                          ? 'bg-zinc-900 text-amber-400 border-amber-500 dark:bg-zinc-800'
                          : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="Número o código grabado en la llave / candado (opcional)"
                    value={editNumeroLlave}
                    onChange={(e) => setEditNumeroLlave(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Observaciones generales */}
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Observaciones / Notas
                </label>
                <input
                  type="text"
                  placeholder="Ej. Comparte casillero con turno nocturno, llave entregada el 06/Sep..."
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Footer Modal Acciones */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              {(selectedCasillero.id_empleado || selectedCasillero.nombre_provisional) ? (
                <button
                  type="button"
                  onClick={handleLiberarCasillero}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Liberar Casillero
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold text-xs hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarCasillero}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
