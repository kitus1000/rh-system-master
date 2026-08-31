'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Printer, Download, Search, Filter, CheckSquare, Square, RefreshCw, 
  QrCode, User, ShieldCheck, Sparkles, Copy, Layers, Eye, FileText, 
  CheckCircle2, ArrowLeft, Sliders, Palette, Heart, Phone, Award, Building2
} from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'

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

interface CredencialItem extends Empleado {
  qrDataUrl?: string
}

export default function CredencialesMasivasPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('TODOS')
  const [puestoFilter, setPuestoFilter] = useState('TODOS')
  const [soloActivos, setSoloActivos] = useState(true)
  
  // Opciones de Impresión y Diseño
  const [copiasPorEmpleado, setCopiasPorEmpleado] = useState<number>(1)
  const [orientacion, setOrientacion] = useState<'vertical' | 'horizontal'>('vertical')
  const [temaColor, setTemaColor] = useState<'dorado' | 'azul' | 'verde' | 'rojo'>('dorado')
  const [mostrarReverso, setMostrarReverso] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)

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
        // Por defecto seleccionar los primeros 8 para vista previa rápida
        const initialSelected = new Set<string>()
        data.slice(0, 8).forEach(e => initialSelected.add(e.id_empleado))
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
          width: 320,
          margin: 1,
          color: {
            dark: '#111827',
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

  // Manejo de Impresión del Navegador
  const handleImprimir = () => {
    window.print()
  }

  // Temas de Color
  const themeStyles = {
    dorado: {
      headerBg: 'bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      accentText: 'text-amber-700',
      borderAccent: 'border-amber-500',
      shadowColor: 'shadow-amber-500/10'
    },
    azul: {
      headerBg: 'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900',
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      accentText: 'text-blue-700',
      borderAccent: 'border-blue-500',
      shadowColor: 'shadow-blue-500/10'
    },
    verde: {
      headerBg: 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      accentText: 'text-emerald-700',
      borderAccent: 'border-emerald-500',
      shadowColor: 'shadow-emerald-500/10'
    },
    rojo: {
      headerBg: 'bg-gradient-to-r from-rose-950 via-rose-900 to-red-800',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
      accentText: 'text-rose-700',
      borderAccent: 'border-rose-500',
      shadowColor: 'shadow-rose-500/10'
    }
  }[temaColor]

  return (
    <div className="space-y-6 pb-24 font-sans max-w-7xl mx-auto">
      
      {/* Estilos de Impresión CSS (Oculta controles y ajusta la cuadrícula de credenciales para hoja carta) */}
      <style jsx global>{`
        @media print {
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
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: letter portrait;
            margin: 8mm;
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
              Diseño oficial tipo PVC para gafetes, abordaje de transporte y control de acceso.
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
            className="flex-1 md:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Imprimir ({credencialesAImprimir.length} Credenciales)</span>
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

        {/* Opciones de Diseño Visual */}
        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Orientación */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setOrientacion('vertical')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all ${orientacion === 'vertical' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}
              >
                🪪 Vertical (Gafete)
              </button>
              <button
                type="button"
                onClick={() => setOrientacion('horizontal')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all ${orientacion === 'horizontal' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}
              >
                💳 Horizontal (Tarjeta)
              </button>
            </div>

            {/* Selector de Color */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
              <span className="text-[10px] font-bold text-zinc-400 px-1">Tema:</span>
              <button
                type="button"
                onClick={() => setTemaColor('dorado')}
                className={`w-6 h-6 rounded-lg bg-amber-600 border-2 transition-all ${temaColor === 'dorado' ? 'border-zinc-900 scale-110' : 'border-transparent opacity-60'}`}
                title="Dorado Minero"
              />
              <button
                type="button"
                onClick={() => setTemaColor('azul')}
                className={`w-6 h-6 rounded-lg bg-blue-800 border-2 transition-all ${temaColor === 'azul' ? 'border-zinc-900 scale-110' : 'border-transparent opacity-60'}`}
                title="Azul Corporativo"
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
            Lista de Personal ({empleadosSeleccionados.length} seleccionados de {filteredEmpleados.length})
          </span>
          <span className="text-[11px] font-bold text-emerald-600">
            Total a Imprimir: {credencialesAImprimir.length} credenciales (~{Math.ceil(credencialesAImprimir.length / (orientacion === 'vertical' ? 8 : 6))} hojas carta)
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
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
      <div id="seccion-impresion-credenciales" ref={printContainerRef} className="space-y-4">
        
        <div className="no-print flex justify-between items-center px-1">
          <h2 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-600" />
            Vista Previa de Impresión ({credencialesAImprimir.length} Credenciales)
          </h2>
          <span className="text-xs text-zinc-500">
            Distribución optimizada para impresión en hojas tamaño Carta / A4 o Gafetes PVC
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
          /* CUADRÍCULA DE IMPRESIÓN */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3">
            {credencialesAImprimir.map((emp, index) => {
              const qrUrl = qrCache[emp.id_empleado]
              const numeroNomina = emp.numero_empleado ? `#${emp.numero_empleado}` : 'N/A'
              const nombreCompleto = `${emp.nombre} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
              const puesto = emp.puesto || 'Personal de Turno'
              const departamento = emp.departamento || 'Mina Bacis'

              return (
                <div key={`${emp.id_empleado}-${index}`} className="flex flex-col items-center justify-center">
                  
                  {/* CREDENCIAL VERTICAL (GAFETE CR-80) */}
                  {orientacion === 'vertical' ? (
                    <div className={`w-[250px] h-[385px] bg-white rounded-2xl overflow-hidden border-2 border-zinc-300 shadow-md flex flex-col justify-between relative print:shadow-none print:border-zinc-400 print:w-[65mm] print:h-[98mm] ${themeStyles.shadowColor}`}>
                      
                      {/* Cabecera Corporativa con Logo */}
                      <div className={`${themeStyles.headerBg} p-2.5 text-white text-center relative overflow-hidden shrink-0`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/logo-bacis.png" alt="Logo Bacis" className="h-6 object-contain filter brightness-0 invert drop-shadow-sm" onError={(e)=>{ (e.target as any).style.display='none' }} />
                          <div className="text-left leading-none">
                            <span className="text-[11px] font-black tracking-wider block uppercase">MINAS DE BACIS</span>
                            <span className="text-[7px] text-amber-200 font-bold uppercase tracking-widest block">GRUPO MINERO BACIS</span>
                          </div>
                        </div>
                        <div className="mt-1">
                          <span className="text-[7.5px] font-black tracking-widest uppercase bg-black/30 px-2 py-0.5 rounded-full inline-block border border-white/20">
                            CREDENCIAL OFICIAL DE PERSONAL
                          </span>
                        </div>
                      </div>

                      {/* Cuerpo: Foto y Datos Principales */}
                      <div className="p-2.5 flex flex-col items-center text-center space-y-1.5 grow justify-center">
                        
                        {/* Foto del Trabajador */}
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${themeStyles.borderAccent} bg-zinc-100 shadow-sm flex items-center justify-center`}>
                            {emp.foto_url ? (
                              <img src={emp.foto_url} alt={nombreCompleto} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-amber-400 flex items-center justify-center font-black text-xl">
                                {emp.nombre.charAt(0)}{emp.apellido_paterno ? emp.apellido_paterno.charAt(0) : ''}
                              </div>
                            )}
                          </div>
                          <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full border border-white" title="Activo">
                            <CheckCircle2 className="w-3 h-3" />
                          </span>
                        </div>

                        {/* Nombre del Trabajador */}
                        <div>
                          <h3 className="text-xs font-black text-zinc-900 leading-tight uppercase line-clamp-2 px-1">
                            {nombreCompleto}
                          </h3>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 border ${themeStyles.badgeBg}`}>
                            {puesto}
                          </span>
                        </div>

                        {/* Departamento y Nómina */}
                        <div className="text-[9px] text-zinc-500 font-medium leading-tight">
                          <div className="truncate font-bold text-zinc-700">{departamento}</div>
                          <div className="font-mono font-black text-zinc-900 mt-0.5">
                            Nómina: <span className={themeStyles.accentText}>{numeroNomina}</span>
                          </div>
                        </div>

                        {/* Código QR de Alta Definición */}
                        <div className="pt-1 border-t border-zinc-100 flex flex-col items-center">
                          {qrUrl ? (
                            <img src={qrUrl} alt="QR" className="w-20 h-20 object-contain" />
                          ) : (
                            <div className="w-20 h-20 bg-zinc-100 flex items-center justify-center text-[8px] text-zinc-400 font-mono">
                              Generando...
                            </div>
                          )}
                          <span className="text-[7.5px] font-mono font-bold text-zinc-700 tracking-tight leading-none mt-0.5">
                            ID: {emp.numero_empleado || emp.id_empleado.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      {/* Franja Inferior de Seguridad */}
                      <div className="bg-zinc-900 text-zinc-300 py-1 px-2 text-center text-[7px] font-mono uppercase tracking-wider shrink-0 flex justify-between items-center border-t border-zinc-800">
                        <span>MINA BACIS</span>
                        <span className="text-amber-400 font-bold">SEGURIDAD INDUSTRIAL</span>
                      </div>
                    </div>
                  ) : (
                    /* CREDENCIAL HORIZONTAL (TARJETA TIPO IDENTIFICACIÓN) */
                    <div className={`w-[360px] h-[225px] bg-white rounded-2xl overflow-hidden border-2 border-zinc-300 shadow-md flex flex-col justify-between relative print:shadow-none print:border-zinc-400 print:w-[86mm] print:h-[54mm] ${themeStyles.shadowColor}`}>
                      
                      {/* Cabecera */}
                      <div className={`${themeStyles.headerBg} p-2 text-white flex justify-between items-center shrink-0`}>
                        <div className="flex items-center gap-1.5">
                          <img src="/logo-bacis.png" alt="Logo Bacis" className="h-5 object-contain filter brightness-0 invert" onError={(e)=>{ (e.target as any).style.display='none' }} />
                          <span className="text-[10px] font-black uppercase tracking-wider">MINAS DE BACIS</span>
                        </div>
                        <span className="text-[7px] font-black uppercase bg-black/30 px-2 py-0.5 rounded-full border border-white/20">
                          CREDENCIAL OFICIAL
                        </span>
                      </div>

                      {/* Cuerpo Horizontal */}
                      <div className="p-3 flex items-center justify-between gap-2 grow">
                        
                        {/* Foto */}
                        <div className="shrink-0 flex flex-col items-center">
                          <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${themeStyles.borderAccent} bg-zinc-100 flex items-center justify-center`}>
                            {emp.foto_url ? (
                              <img src={emp.foto_url} alt={nombreCompleto} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-zinc-900 text-amber-400 flex items-center justify-center font-black text-xl">
                                {emp.nombre.charAt(0)}{emp.apellido_paterno ? emp.apellido_paterno.charAt(0) : ''}
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] font-mono font-black text-zinc-900 mt-1">
                            {numeroNomina}
                          </span>
                        </div>

                        {/* Datos Centrales */}
                        <div className="grow text-left space-y-0.5">
                          <h3 className="text-xs font-black text-zinc-900 uppercase leading-tight line-clamp-2">
                            {nombreCompleto}
                          </h3>
                          <div className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md inline-block border ${themeStyles.badgeBg}`}>
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

                        {/* Código QR */}
                        <div className="shrink-0 flex flex-col items-center pl-2 border-l border-zinc-100">
                          {qrUrl ? (
                            <img src={qrUrl} alt="QR" className="w-16 h-16 object-contain" />
                          ) : (
                            <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center text-[7px]">QR</div>
                          )}
                          <span className="text-[6.5px] font-mono text-zinc-500 uppercase mt-0.5">Escaneo Ruta</span>
                        </div>
                      </div>

                      {/* Franja Inferior */}
                      <div className="bg-zinc-900 text-zinc-300 py-1 px-3 text-[7px] font-mono uppercase flex justify-between items-center">
                        <span>MINA BACIS DGO</span>
                        <span className="text-amber-400 font-bold">CONTROL DE ACCESO</span>
                      </div>
                    </div>
                  )}

                  {/* REVERSO OPCIONAL (TARJETA DE SEGURIDAD Y CONTACTO DE EMERGENCIA) */}
                  {mostrarReverso && (
                    <div className={`mt-2 w-[250px] h-[385px] bg-zinc-950 text-white rounded-2xl overflow-hidden border-2 border-zinc-800 p-3.5 flex flex-col justify-between text-center relative print:shadow-none print:w-[65mm] print:h-[98mm]`}>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block border-b border-zinc-800 pb-1">
                          DATOS DE SEGURIDAD Y RESCATE
                        </span>
                        <div className="text-[8px] text-zinc-400 font-mono">MINAS DE BACIS S.A. DE C.V.</div>
                      </div>

                      <div className="space-y-2 text-left text-[8.5px] bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 font-mono">
                        <div>
                          <span className="text-zinc-500 uppercase block text-[7px]">Titular:</span>
                          <strong className="text-white uppercase truncate block">{nombreCompleto}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase block text-[7px]">CURP / NSS:</span>
                          <strong className="text-amber-300 truncate block">{emp.curp || emp.nss || 'Registrado en RH'}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase block text-[7px]">Teléfono de Contacto:</span>
                          <strong className="text-emerald-400 block">{emp.telefono || 'Caseta Bacis (674) 861 0000'}</strong>
                        </div>
                      </div>

                      <div className="text-[7.5px] text-zinc-400 space-y-1">
                        <p className="leading-tight">
                          ⚠️ Esta credencial es personal e intransferible. Obligatorio portarla para abordar transporte y acceder a interior mina.
                        </p>
                        <p className="text-[7px] text-zinc-500">
                          En caso de extravío favor de entregar en Depto. de Recursos Humanos.
                        </p>
                      </div>

                      <div className="border-t border-zinc-800 pt-1 text-[7px] text-zinc-500 uppercase">
                        Vigencia Oficial: 2026 - 2027
                      </div>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
