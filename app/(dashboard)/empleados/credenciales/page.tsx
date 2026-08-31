'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Printer, Search, Filter, CheckSquare, Square, RefreshCw, 
  QrCode, User, ShieldCheck, Sparkles, Copy, Layers, Eye, FileText, 
  CheckCircle2, ArrowLeft, Scissors, Sliders, Palette, Heart, Phone, Award, Building2
} from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'

interface Empleado {
  id_empleado: string
  numero_empleado?: string | number
  nombre: string
  apellido_paterno?: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  nss?: string
  curp?: string
  telefono?: string
  foto_url?: string
  qr_token?: string
  estado_empleado?: string
  es_contratista?: boolean
}

export default function CredencialesMasivasPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('TODOS')
  const [puestoFilter, setPuestoFilter] = useState('TODOS')
  const [soloActivos, setSoloActivos] = useState(true)
  
  // Opciones de Impresión y Cuadrícula
  const [copiasPorEmpleado, setCopiasPorEmpleado] = useState<number>(1)
  const [orientacion, setOrientacion] = useState<'vertical' | 'horizontal'>('vertical')
  const [temaColor, setTemaColor] = useState<'dorado' | 'azul' | 'verde' | 'rojo'>('dorado')
  const [mostrarReverso, setMostrarReverso] = useState(false)
  const [mostrarGuiasCorte, setMostrarGuiasCorte] = useState(true)

  // Cache de códigos QR generados (id -> dataUrl)
  const [qrCache, setQrCache] = useState<Record<string, string>>({})
  const printContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEmpleados()
  }, [])

  const fetchEmpleados = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre', { ascending: true })

      if (!error && data) {
        setEmpleados(data)
        // Por defecto seleccionar los primeros 12 para llenar 1 hoja completa
        const initialSelected = new Set<string>()
        data.slice(0, 12).forEach(e => initialSelected.add(e.id_empleado))
        setSelectedIds(initialSelected)

        // Generar QRs para todos
        generarCodigosQR(data)
      }
    } catch (err) {
      console.error('Error al cargar empleados:', err)
    } finally {
      setLoading(false)
    }
  }

  // Generación automática de Códigos QR
  const generarCodigosQR = async (lista: Empleado[]) => {
    const cache: Record<string, string> = {}
    for (const emp of lista) {
      const contenidoQR = emp.numero_empleado 
        ? String(emp.numero_empleado) 
        : (emp.qr_token || emp.id_empleado)

      try {
        const dataUrl = await QRCode.toDataURL(contenidoQR, {
          width: 400,
          margin: 0,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        cache[emp.id_empleado] = dataUrl
      } catch (e) {
        console.error('Error generando QR para', emp.nombre, e)
      }
    }
    setQrCache(cache)
  }

  // Filtros
  const departamentosList = Array.from(new Set(empleados.map(e => e.departamento || 'Sin Depto').filter(Boolean)))
  const puestosList = Array.from(new Set(empleados.map(e => e.puesto || 'General').filter(Boolean)))

  const filteredEmpleados = empleados.filter(e => {
    if (soloActivos && e.estado_empleado && e.estado_empleado.toLowerCase() === 'baja') return false
    if (deptFilter !== 'TODOS' && (e.departamento || 'Sin Depto') !== deptFilter) return false
    if (puestoFilter !== 'TODOS' && (e.puesto || 'General') !== puestoFilter) return false

    if (searchTerm) {
      const full = `${e.nombre} ${e.apellido_paterno || ''} ${e.apellido_materno || ''} ${e.numero_empleado || ''} ${e.puesto || ''} ${e.departamento || ''}`.toLowerCase()
      if (!full.includes(searchTerm.toLowerCase())) return false
    }

    return true
  })

  // Manejo de Selección
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectAllFiltered = () => {
    const next = new Set(selectedIds)
    filteredEmpleados.forEach(e => next.add(e.id_empleado))
    setSelectedIds(next)
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  // Lista expandida según la cantidad de copias deseadas
  const empleadosSeleccionados = empleados.filter(e => selectedIds.has(e.id_empleado))
  const credencialesAImprimir: Empleado[] = []
  empleadosSeleccionados.forEach(emp => {
    for (let i = 0; i < copiasPorEmpleado; i++) {
      credencialesAImprimir.push(emp)
    }
  })

  // Agrupación en páginas exactas (12 por hoja en vertical 4x3, 8 por hoja en horizontal 2x4)
  const itemsPorHoja = orientacion === 'vertical' ? 12 : 8
  const paginasCredenciales: Empleado[][] = []
  for (let i = 0; i < credencialesAImprimir.length; i += itemsPorHoja) {
    paginasCredenciales.push(credencialesAImprimir.slice(i, i + itemsPorHoja))
  }

  // Manejo de Impresión
  const handleImprimir = () => {
    window.print()
  }

  // Temas de Color
  const themeStyles = {
    dorado: {
      headerBg: 'bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600',
      badgeBg: 'bg-amber-100 text-amber-950 border-amber-300',
      accentText: 'text-amber-800',
      borderAccent: 'border-amber-500',
      tagBg: 'bg-amber-600 text-white',
      shadowColor: 'shadow-amber-500/10'
    },
    azul: {
      headerBg: 'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900',
      badgeBg: 'bg-blue-100 text-blue-950 border-blue-300',
      accentText: 'text-blue-800',
      borderAccent: 'border-blue-500',
      tagBg: 'bg-blue-700 text-white',
      shadowColor: 'shadow-blue-500/10'
    },
    verde: {
      headerBg: 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800',
      badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300',
      accentText: 'text-emerald-800',
      borderAccent: 'border-emerald-500',
      tagBg: 'bg-emerald-700 text-white',
      shadowColor: 'shadow-emerald-500/10'
    },
    rojo: {
      headerBg: 'bg-gradient-to-r from-rose-950 via-rose-900 to-red-800',
      badgeBg: 'bg-rose-100 text-rose-950 border-rose-300',
      accentText: 'text-rose-800',
      borderAccent: 'border-rose-500',
      tagBg: 'bg-rose-700 text-white',
      shadowColor: 'shadow-rose-500/10'
    }
  }[temaColor]

  return (
    <div className="space-y-6 pb-24 font-sans max-w-7xl mx-auto">
      
      {/* Estilos de Impresión CSS con separación perfecta y saltos de página */}
      <style jsx global>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          #seccion-impresion-credenciales, #seccion-impresion-credenciales * {
            visibility: visible;
          }
          #seccion-impresion-credenciales {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .hoja-impresion {
            width: 100% !important;
            max-width: 215.9mm !important;
            min-height: 279.4mm !important;
            max-height: 279.4mm !important;
            margin: 0 auto !important;
            padding: 3mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            display: block !important;
          }
          .guia-corte {
            border: 1px dashed #9ca3af !important;
            padding: 1mm !important;
            box-sizing: border-box !important;
          }
          @page {
            size: letter portrait;
            margin: 3mm;
          }
        }
      `}</style>

      {/* HEADER NO IMPRIMIBLE */}
      <div className="no-print bg-zinc-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <Link 
            href="/empleados"
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-300 hover:text-white transition-all"
            title="Volver a Empleados"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-12 h-12 bg-amber-500 text-black rounded-2xl flex items-center justify-center font-black shadow-md">
            <QrCode className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Generador de Credenciales con QR</h1>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                Minas de Bacis
              </span>
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">
              QR Ampliado y diseño corporativo de alta visibilidad para escaneo rápido en ruta.
            </p>
          </div>
        </div>

        {/* Botones Principales de Impresión */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchEmpleados}
            className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recargar</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            disabled={credencialesAImprimir.length === 0}
            className="flex-1 md:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Imprimir ({credencialesAImprimir.length} Credenciales • {paginasCredenciales.length} {paginasCredenciales.length === 1 ? 'Hoja' : 'Hojas'})</span>
          </button>
        </div>
      </div>

      {/* PANEL DE CONFIGURACIÓN Y FILTROS */}
      <div className="no-print bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Buscador */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">Buscar Trabajador</label>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Nombre, Nómina #, Puesto..."
                className="w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-amber-500"
              />
            </div>
          </div>

          {/* Filtro Departamento */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">Departamento</label>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full py-2.5 px-3 text-xs font-bold bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white"
            >
              <option value="TODOS">Todos los Departamentos ({departamentosList.length})</option>
              {departamentosList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Filtro Puesto */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">Puesto / Categoría</label>
            <select
              value={puestoFilter}
              onChange={e => setPuestoFilter(e.target.value)}
              className="w-full py-2.5 px-3 text-xs font-bold bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white"
            >
              <option value="TODOS">Todos los Puestos ({puestosList.length})</option>
              {puestosList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Copias por Empleado (Para Duplicados / Repuestos) */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">
              Copias / Repuestos por Persona
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCopiasPorEmpleado(num)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    copiasPorEmpleado === num 
                      ? 'bg-zinc-900 text-white shadow-sm' 
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Opciones de Diseño y Cuadrícula */}
        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Formato y Cuadrícula */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setOrientacion('vertical')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1.5 ${orientacion === 'vertical' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}
              >
                <span>🪪 Vertical: 12 por Hoja (4 x 3)</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientacion('horizontal')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1.5 ${orientacion === 'horizontal' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}
              >
                <span>💳 Horizontal: 8 por Hoja (2 x 4)</span>
              </button>
            </div>

            {/* Selector de Color */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
              <span className="text-[10px] font-bold text-zinc-400 px-1">Tema:</span>
              <button
                type="button"
                onClick={() => setTemaColor('dorado')}
                className={`w-6 h-6 rounded-lg bg-amber-600 border-2 transition-all ${temaColor === 'dorado' ? 'border-zinc-900 scale-110' : 'border-transparent opacity-60'}`}
                title="Dorado Minero (Oficial Bacis)"
              />
              <button
                type="button"
                onClick={() => setTemaColor('azul')}
                className={`w-6 h-6 rounded-lg bg-blue-800 border-2 transition-all ${temaColor === 'azul' ? 'border-zinc-900 scale-110' : 'border-transparent opacity-60'}`}
                title="Azul Operaciones"
              />
              <button
                type="button"
                onClick={() => setTemaColor('verde')}
                className={`w-6 h-6 rounded-lg bg-emerald-700 border-2 transition-all ${temaColor === 'verde' ? 'border-zinc-900 scale-110' : 'border-transparent opacity-60'}`}
                title="Verde Seguridad"
              />
              <button
                type="button"
                onClick={() => setTemaColor('rojo')}
                className={`w-6 h-6 rounded-lg bg-rose-800 border-2 transition-all ${temaColor === 'rojo' ? 'border-zinc-900 scale-110' : 'border-transparent opacity-60'}`}
                title="Rojo Rescate / Brigada"
              />
            </div>

            {/* Toggle Guías de Corte */}
            <button
              type="button"
              onClick={() => setMostrarGuiasCorte(!mostrarGuiasCorte)}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 ${mostrarGuiasCorte ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{mostrarGuiasCorte ? '✓ Líneas de Corte Activas' : 'Sin Líneas de Corte'}</span>
            </button>

            {/* Toggle Reverso */}
            <button
              type="button"
              onClick={() => setMostrarReverso(!mostrarReverso)}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${mostrarReverso ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}
            >
              {mostrarReverso ? '✓ Incluir Reverso de Emergencia' : '+ Agregar Reverso'}
            </button>
          </div>

          {/* Selector Masivo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl text-xs flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Seleccionar Todo ({filteredEmpleados.length})
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 font-bold rounded-xl text-xs flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* SELECCIÓN INDIVIDUAL DE EMPLEADOS (CHIPS) */}
      <div className="no-print bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-black text-zinc-700 uppercase tracking-wider">
            Personal Seleccionado: <strong className="text-emerald-700">{empleadosSeleccionados.length}</strong> de {filteredEmpleados.length}
          </span>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
            📄 Se generarán {paginasCredenciales.length} {paginasCredenciales.length === 1 ? 'hoja carta' : 'hojas carta'} ({credencialesAImprimir.length} credenciales totales)
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
          {filteredEmpleados.map(emp => {
            const isSelected = selectedIds.has(emp.id_empleado)
            return (
              <button
                key={emp.id_empleado}
                type="button"
                onClick={() => toggleSelect(emp.id_empleado)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  isSelected 
                    ? 'bg-zinc-900 text-white shadow-xs' 
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                <span>{emp.nombre} {emp.apellido_paterno || ''}</span>
                {emp.numero_empleado && <span className="text-[9px] opacity-70 font-mono">#{emp.numero_empleado}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN DE VISTA PREVIA Y ÁREA IMPRIMIBLE                    */}
      {/* ============================================================ */}
      <div id="seccion-impresion-credenciales" ref={printContainerRef} className="space-y-8">
        
        <div className="no-print flex justify-between items-center px-1">
          <h2 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-600" />
            Vista Previa de Impresión ({credencialesAImprimir.length} Credenciales • {paginasCredenciales.length} {paginasCredenciales.length === 1 ? 'Página' : 'Páginas'})
          </h2>
          <span className="text-xs text-zinc-500 font-bold">
            Distribución: {orientacion === 'vertical' ? '4 columnas × 3 filas (12 por hoja)' : '2 columnas × 4 filas (8 por hoja)'}
          </span>
        </div>

        {credencialesAImprimir.length === 0 ? (
          <div className="no-print text-center py-16 bg-white rounded-3xl border-2 border-dashed border-zinc-200 p-8 space-y-3">
            <QrCode className="w-12 h-12 text-zinc-300 mx-auto" />
            <h3 className="text-sm font-black text-zinc-700">No hay empleados seleccionados para credencializar</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Haz clic en <strong>"Seleccionar Todo"</strong> o selecciona individualmente a los trabajadores en la lista de arriba.
            </p>
          </div>
        ) : (
          /* RENDERIZADO POR HOJAS FÍSICAS */
          paginasCredenciales.map((grupoPagina, numPagina) => (
            <div 
              key={`pagina-${numPagina}`}
              className="hoja-impresion bg-white p-4 rounded-3xl border border-zinc-300 shadow-sm print:shadow-none print:border-none print:p-0 space-y-2"
            >
              {/* Encabezado de página en vista previa de pantalla */}
              <div className="no-print flex justify-between items-center pb-2 border-b border-zinc-200 text-xs text-zinc-500 font-bold">
                <span className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-600" />
                  <span>Hoja de Impresión #{numPagina + 1} ({grupoPagina.length} credenciales)</span>
                </span>
                <span>Tamaño: Carta (8.5&quot; × 11&quot;)</span>
              </div>

              {/* CUADRÍCULA SEGÚN ORIENTACIÓN */}
              {orientacion === 'vertical' ? (
                /* CUADRÍCULA 4 COLUMNAS X 3 FILAS = 12 CREDENCIALES VERTICALES */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-1.5">
                  {grupoPagina.map((emp, idx) => {
                    const qrUrl = qrCache[emp.id_empleado]
                    const numeroNomina = emp.numero_empleado ? `#${emp.numero_empleado}` : 'N/A'
                    const nombreCompleto = `${emp.nombre} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
                    const puesto = emp.puesto || 'Personal'
                    const departamento = emp.departamento || 'Mina Bacis'

                    return (
                      <div 
                        key={`${emp.id_empleado}-${idx}`} 
                        className={`${mostrarGuiasCorte ? 'guia-corte rounded-xl p-1 border border-dashed border-zinc-400 bg-zinc-50/40' : 'p-0.5'} flex items-center justify-center`}
                      >
                        {/* CREDENCIAL VERTICAL CON QR MAXIMIZADO */}
                        <div className={`w-[185px] h-[275px] print:w-[48mm] print:h-[84mm] bg-white rounded-xl overflow-hidden border-2 border-zinc-400 shadow-xs flex flex-col justify-between relative print:shadow-none print:border-zinc-600`}>
                          
                          {/* Cabecera Corporativa Bacis */}
                          <div className={`${themeStyles.headerBg} p-1 text-white text-center shrink-0`}>
                            <div className="flex items-center justify-center gap-1">
                              <img src="/logo-bacis.png" alt="Bacis" className="h-4 object-contain filter brightness-0 invert" onError={(e)=>{ (e.target as any).style.display='none' }} />
                              <span className="text-[9.5px] font-black uppercase tracking-wider">MINAS DE BACIS</span>
                            </div>
                            <span className="text-[6.5px] font-black uppercase bg-black/40 px-1.5 py-0.2 rounded-full inline-block mt-0.5 tracking-widest text-amber-200">
                              CREDENCIAL OFICIAL
                            </span>
                          </div>

                          {/* Sección Superior: Foto, Nombre y Puesto */}
                          <div className="p-1 flex flex-col items-center text-center space-y-1 grow justify-between">
                            
                            {/* Fila Foto + Datos */}
                            <div className="w-full flex items-center gap-1.5 px-0.5 pt-0.5">
                              {/* Foto */}
                              <div className="shrink-0">
                                <div className={`w-11 h-11 rounded-xl overflow-hidden border-2 ${themeStyles.borderAccent} bg-zinc-100 flex items-center justify-center shadow-xs`}>
                                  {emp.foto_url ? (
                                    <img src={emp.foto_url} alt={nombreCompleto} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-zinc-900 text-amber-400 flex items-center justify-center font-black text-xs">
                                      {emp.nombre.charAt(0)}{emp.apellido_paterno ? emp.apellido_paterno.charAt(0) : ''}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Nombre, Puesto y Nómina */}
                              <div className="grow text-left overflow-hidden">
                                <h3 className="text-[10px] font-black text-zinc-950 uppercase leading-tight line-clamp-2">
                                  {nombreCompleto}
                                </h3>
                                <div className={`text-[7px] font-black uppercase px-1 py-0.2 rounded inline-block truncate max-w-full border mt-0.5 ${themeStyles.badgeBg}`}>
                                  {puesto}
                                </div>
                                <div className="text-[7px] text-zinc-600 font-mono font-bold leading-none mt-0.5">
                                  Nómina: <strong className={themeStyles.accentText}>{numeroNomina}</strong>
                                </div>
                              </div>
                            </div>

                            {/* SECCIÓN DEL CÓDIGO QR AMPLIO */}
                            <div className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-1 flex flex-col items-center justify-center">
                              {qrUrl ? (
                                <img src={qrUrl} alt="QR" className="w-[84px] h-[84px] print:w-[24mm] print:h-[24mm] object-contain" />
                              ) : (
                                <div className="w-[84px] h-[84px] bg-zinc-100 flex items-center justify-center text-[8px] text-zinc-400 font-mono">
                                  Generando QR...
                                </div>
                              )}
                              
                              {/* Texto bajo el QR */}
                              <div className="text-center mt-0.5 leading-none">
                                <span className="text-[7px] font-mono font-black text-zinc-900 block">
                                  ID: {emp.numero_empleado || emp.id_empleado.slice(0, 6)}
                                </span>
                                <span className="text-[6px] font-bold text-zinc-500 uppercase block truncate max-w-[150px]">
                                  {emp.nombre} {emp.apellido_paterno || ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Franja Inferior de Seguridad */}
                          <div className="bg-zinc-950 text-zinc-300 py-0.5 px-1.5 text-center text-[6px] font-mono uppercase flex justify-between items-center shrink-0 border-t border-zinc-800">
                            <span className="text-zinc-400">MINA BACIS</span>
                            <span className="text-amber-400 font-bold">SEGURIDAD INDUSTRIAL</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* CUADRÍCULA 2 COLUMNAS X 4 FILAS = 8 CREDENCIALES HORIZONTALES */
                <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 print:gap-2">
                  {grupoPagina.map((emp, idx) => {
                    const qrUrl = qrCache[emp.id_empleado]
                    const numeroNomina = emp.numero_empleado ? `#${emp.numero_empleado}` : 'N/A'
                    const nombreCompleto = `${emp.nombre} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
                    const puesto = emp.puesto || 'Personal'
                    const departamento = emp.departamento || 'Mina Bacis'

                    return (
                      <div 
                        key={`${emp.id_empleado}-${idx}`} 
                        className={`${mostrarGuiasCorte ? 'guia-corte rounded-xl p-1 border border-dashed border-zinc-400 bg-zinc-50/40' : 'p-0.5'} flex items-center justify-center`}
                      >
                        {/* CREDENCIAL HORIZONTAL CON QR GRANDE */}
                        <div className={`w-[350px] h-[195px] print:w-[95mm] print:h-[60mm] bg-white rounded-xl overflow-hidden border-2 border-zinc-400 shadow-xs flex flex-col justify-between relative print:shadow-none print:border-zinc-600`}>
                          
                          {/* Cabecera */}
                          <div className={`${themeStyles.headerBg} p-1.5 text-white flex justify-between items-center shrink-0`}>
                            <div className="flex items-center gap-1.5">
                              <img src="/logo-bacis.png" alt="Bacis" className="h-4 object-contain filter brightness-0 invert" onError={(e)=>{ (e.target as any).style.display='none' }} />
                              <span className="text-[10.5px] font-black uppercase tracking-wider">MINAS DE BACIS</span>
                            </div>
                            <span className="text-[7.5px] font-black uppercase bg-black/40 px-2 py-0.5 rounded-full text-amber-200">
                              CREDENCIAL OFICIAL
                            </span>
                          </div>

                          {/* Cuerpo */}
                          <div className="p-2 flex items-center justify-between gap-3 grow">
                            {/* Lado Izquierdo: Foto + Datos */}
                            <div className="flex items-center gap-2.5 grow overflow-hidden">
                              {/* Foto */}
                              <div className="shrink-0 flex flex-col items-center">
                                <div className={`w-14 h-14 rounded-xl overflow-hidden border-2 ${themeStyles.borderAccent} bg-zinc-100 flex items-center justify-center shadow-xs`}>
                                  {emp.foto_url ? (
                                    <img src={emp.foto_url} alt={nombreCompleto} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-zinc-900 text-amber-400 flex items-center justify-center font-black text-sm">
                                      {emp.nombre.charAt(0)}{emp.apellido_paterno ? emp.apellido_paterno.charAt(0) : ''}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[8px] font-mono font-black text-zinc-900 mt-0.5">
                                  {numeroNomina}
                                </span>
                              </div>

                              {/* Datos */}
                              <div className="grow text-left space-y-0.5 overflow-hidden">
                                <h3 className="text-[11px] font-black text-zinc-950 uppercase leading-tight line-clamp-2">
                                  {nombreCompleto}
                                </h3>
                                <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded inline-block border ${themeStyles.badgeBg}`}>
                                  {puesto}
                                </div>
                                <div className="text-[8px] text-zinc-500 font-bold truncate">
                                  {departamento}
                                </div>
                                {emp.nss && (
                                  <div className="text-[7.5px] text-zinc-400 font-mono">
                                    NSS: {emp.nss}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Lado Derecho: Código QR Maximizado */}
                            <div className="shrink-0 flex flex-col items-center pl-2 border-l border-zinc-200 bg-zinc-50 p-1 rounded-lg">
                              {qrUrl ? (
                                <img src={qrUrl} alt="QR" className="w-[78px] h-[78px] print:w-[26mm] print:h-[26mm] object-contain" />
                              ) : (
                                <div className="w-[78px] h-[78px] bg-zinc-100 flex items-center justify-center text-[7px]">QR</div>
                              )}
                              <span className="text-[7px] font-mono font-black text-zinc-900 uppercase mt-0.5 leading-none">
                                {numeroNomina}
                              </span>
                              <span className="text-[6px] font-bold text-zinc-500 uppercase leading-none mt-0.5">
                                {emp.nombre}
                              </span>
                            </div>
                          </div>

                          {/* Franja Inferior */}
                          <div className="bg-zinc-950 text-zinc-300 py-0.5 px-2.5 text-[6.5px] font-mono uppercase flex justify-between items-center shrink-0 border-t border-zinc-800">
                            <span>MINA BACIS DGO</span>
                            <span className="text-amber-400 font-bold">CONTROL DE ACCESO</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* REVERSO OPCIONAL */}
              {mostrarReverso && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-zinc-300">
                  <span className="no-print text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Reverso de Seguridad</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 gap-2">
                    {grupoPagina.map((emp, idx) => (
                      <div key={`rev-${emp.id_empleado}-${idx}`} className="guia-corte p-1 rounded-xl bg-zinc-900 text-white text-[7px] font-mono flex flex-col justify-between h-[275px] print:h-[84mm] p-2">
                        <div className="text-center border-b border-zinc-800 pb-1">
                          <strong className="text-amber-400 block text-[8px]">MINAS DE BACIS</strong>
                          <span>FICHA DE EMERGENCIA</span>
                        </div>
                        <div className="space-y-1 text-left bg-zinc-950 p-1.5 rounded">
                          <div><span className="text-zinc-500">TITULAR:</span> <strong className="text-white block truncate">{emp.nombre} {emp.apellido_paterno}</strong></div>
                          <div><span className="text-zinc-500">CURP/NSS:</span> <span className="text-amber-300 block truncate">{emp.curp || emp.nss || 'REGISTRADO RH'}</span></div>
                          <div><span className="text-zinc-500">EMERGENCIA:</span> <span className="text-emerald-400 block">{emp.telefono || '(674) 861 0000'}</span></div>
                        </div>
                        <div className="text-[6.5px] text-zinc-400 text-center leading-tight">
                          Porte obligatorio en interior mina. Intransferible.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
