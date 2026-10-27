'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/utils/supabase/client'
import { 
  Printer, ArrowLeft, RefreshCw, Scissors, Layers, Tag, 
  Building2, CheckCircle2, AlertTriangle, QrCode, FileText, 
  FolderLock, Smartphone, ChevronRight, Globe, ExternalLink
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

export default function TirasPlanogramaPage() {
  const [modulos, setModulos] = useState<LockerModulo[]>([])
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [baseUrl, setBaseUrl] = useState('https://rh-system-master.vercel.app')

  // Tipo de Tira: 'PLANOGRAMA' (Tira de módulos continua) | 'CHICAS_CASILLERO' (Etiquetas chicas de puerta)
  const [tipoTira, setTipoTira] = useState<'PLANOGRAMA' | 'CHICAS_CASILLERO'>('PLANOGRAMA')
  const [filtroBateria, setFiltroBateria] = useState('TODAS')
  const [filtroEstatus, setFiltroEstatus] = useState('TODOS')
  const [modoPreCenso, setModoPreCenso] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        setBaseUrl(origin)
      }
    }
    cargarDatos()
  }, [])

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: modData } = await supabase
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

      if (modData) {
        setModulos(modData)
      }
    } catch (err) {
      console.error('Error cargando módulos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Generar QRs apuntando a /registro-locker?locker=...
  useEffect(() => {
    if (modulos.length === 0) return
    const allCas: LockerCasillero[] = []
    modulos.forEach(m => {
      if (m.lockers_casilleros) allCas.push(...m.lockers_casilleros)
    })

    const generarQRs = async () => {
      const map: Record<string, string> = {}
      const cleanBase = baseUrl.replace(/\/+$/, '')
      for (const c of allCas) {
        try {
          const qrTargetUrl = `${cleanBase}/registro-locker?locker=${encodeURIComponent(c.codigo_casillero)}`
          const url = await QRCode.toDataURL(qrTargetUrl, {
            width: 110,
            margin: 0,
            color: { dark: '#000000', light: '#ffffff' }
          })
          map[c.codigo_casillero] = url
        } catch (e) {
          console.error('Error QR', e)
        }
      }
      setQrCodes(map)
    }
    generarQRs()
  }, [modulos, baseUrl])

  // Modulos filtrados
  const modulosFiltrados = useMemo(() => {
    return modulos.filter(m => {
      if (filtroBateria !== 'TODAS' && m.bateria !== filtroBateria) return false
      return true
    })
  }, [modulos, filtroBateria])

  // Tiras de Planograma agrupadas (ej. 6 módulos por tira horizontal de papel)
  const tirasPlanograma = useMemo(() => {
    const tiras: LockerModulo[][] = []
    const chunkSize = 6 // 6 módulos por tira horizontal
    for (let i = 0; i < modulosFiltrados.length; i += chunkSize) {
      tiras.push(modulosFiltrados.slice(i, i + chunkSize))
    }
    return tiras
  }, [modulosFiltrados])

  // Casilleros aplanados para etiquetas chicas de puerta
  const casillerosEtiquetas = useMemo(() => {
    const list: { casillero: LockerCasillero; modulo: LockerModulo }[] = []
    modulosFiltrados.forEach(m => {
      if (m.lockers_casilleros) {
        const sorted = [...m.lockers_casilleros].sort((a, b) => a.numero_en_modulo - b.numero_en_modulo)
        sorted.forEach(c => {
          if (filtroEstatus !== 'TODOS' && c.estatus !== filtroEstatus) return
          list.push({ casillero: c, modulo: m })
        })
      }
    })
    return list
  }, [modulosFiltrados, filtroEstatus])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Barra de Control y Filtros (Oculta al Imprimir) */}
      <div className="print:hidden bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 mb-6">
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
                <Tag className="w-5 h-5 text-amber-500" />
                Impresión de Tiras de Planograma y Etiquetas con QR
              </h1>
              <p className="text-xs text-zinc-500">
                Cada etiqueta QR dirige al trabajador a la página de autorregistro y resguardo de su casillero.
              </p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Formato</span>
          </button>
        </div>

        {/* Configuración del Enlace QR */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-1">
            <Globe className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
              Dominio Web para los QRs:
            </span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-500/40 font-mono text-xs text-zinc-900 dark:text-white"
              placeholder="https://rh-system-master.vercel.app"
            />
          </div>
          <Link
            href="/registro-locker?locker=PB-M01-A"
            target="_blank"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 text-amber-400 hover:bg-zinc-800 font-bold text-xs flex items-center gap-1.5 shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Probar Formulario QR (PB-M01-A)</span>
          </Link>
        </div>

        {/* Selector de Tipo de Formato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setTipoTira('PLANOGRAMA')}
            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
              tipoTira === 'PLANOGRAMA'
                ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 shadow-sm'
                : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Layers className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-xs uppercase tracking-wider">1. Tira de Planograma Panorámica</p>
              <p className="text-[11px] opacity-80 mt-0.5">
                Tiras de módulos continuos (M01, M02, M03...) para recortar y pegar en el cabezal superior de las baterías o en la pared del vestidor.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTipoTira('CHICAS_CASILLERO')}
            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
              tipoTira === 'CHICAS_CASILLERO'
                ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 shadow-sm'
                : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Tag className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-xs uppercase tracking-wider">2. Tiras Chicas de Puerta con QR (Etiquetas)</p>
              <p className="text-[11px] opacity-80 mt-0.5">
                Etiquetas rectangulares compactas con número de casillero, nombre, puesto, ubicación y QR interactivo para pegar en la puerta.
              </p>
            </div>
          </button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div>
            <label className="font-bold text-zinc-500 block mb-1">Filtrar por Batería:</label>
            <select
              value={filtroBateria}
              onChange={(e) => setFiltroBateria(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-semibold"
            >
              <option value="TODAS">Todas las Baterías ({modulos.length} Módulos)</option>
              <option value="Batería 1">Batería 1 (M01 a M12)</option>
              <option value="Batería 2">Batería 2 (M13 a M24)</option>
              <option value="Batería 3">Batería 3 (M25 a M36)</option>
              <option value="Batería 4 (Módulos Dobles Grandes)">Batería 4 - Módulos Grandes (M37 a M42)</option>
            </select>
          </div>

          {tipoTira === 'CHICAS_CASILLERO' && (
            <div>
              <label className="font-bold text-zinc-500 block mb-1">Filtrar por Estatus:</label>
              <select
                value={filtroEstatus}
                onChange={(e) => setFiltroEstatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-semibold"
              >
                <option value="TODOS">Todos los Casilleros</option>
                <option value="Asignado">Solo Asignados</option>
                <option value="Disponible">Solo Disponibles</option>
                <option value="En Reparacion">En Reparación</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 pt-5">
            <label className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modoPreCenso}
                onChange={(e) => setModoPreCenso(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-400"
              />
              <span>Modo en blanco (Líneas para escribir a mano)</span>
            </label>
          </div>
        </div>
      </div>

      {/* ÁREA IMPRIMIBLE */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-500">Cargando tiras de planogramación...</p>
        </div>
      ) : tipoTira === 'PLANOGRAMA' ? (
        /* ========================================================================= */
        /* OPCIÓN 1: TIRAS HORIZONTALES DE PLANOGRAMACIÓN (CABEZALES / PASILLO)       */
        /* ========================================================================= */
        <div className="space-y-8 print:space-y-6">
          {tirasPlanograma.map((grupoModulos, indexTira) => (
            <div
              key={indexTira}
              className="tira-contenedor bg-white text-zinc-900 p-5 rounded-2xl border-2 border-zinc-900 shadow-xl print:shadow-none print:border-zinc-900 print:p-2"
              style={{ pageBreakInside: 'avoid' }}
            >
              {/* Encabezado de la Tira */}
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2 mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black font-mono bg-zinc-900 text-white px-2 py-0.5 rounded text-[11px]">
                    TIRA DE PLANOGRAMA #{indexTira + 1}
                  </span>
                  <span className="font-black uppercase tracking-wider text-zinc-800">
                    PLANTA DE BENEFICIO · {grupoModulos[0]?.bateria}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-zinc-600">
                  Módulos {grupoModulos[0]?.codigo_modulo} al {grupoModulos[grupoModulos.length - 1]?.codigo_modulo}
                </span>
              </div>

              {/* Fila Horizontal de Módulos continuos */}
              <div className="grid grid-cols-6 gap-2">
                {grupoModulos.map(mod => {
                  const esDoble = mod.tipo_modulo === '2_niveles'
                  const items = mod.lockers_casilleros || []
                  const sorted = [...items].sort((a, b) => a.numero_en_modulo - b.numero_en_modulo)

                  return (
                    <div
                      key={mod.id_modulo}
                      className="border-2 border-zinc-800 rounded-lg overflow-hidden flex flex-col bg-white"
                    >
                      {/* Cabecera del Módulo */}
                      <div className="bg-zinc-900 text-white px-1.5 py-1 text-center">
                        <p className="font-mono font-black text-xs leading-none">
                          {mod.codigo_modulo}
                        </p>
                        <p className="text-[8px] font-bold text-amber-400 uppercase leading-none mt-0.5">
                          {esDoble ? '2 Niveles' : '3 Niveles'}
                        </p>
                      </div>

                      {/* Casilleros apilados verticalmente dentro de la tira */}
                      <div className="p-1 flex-1 flex flex-col gap-1">
                        {sorted.map(cas => {
                          const emp = cas.empleados
                          const libre = cas.estatus === 'Disponible'
                          const reparacion = cas.estatus === 'En Reparacion'
                          const inservible = cas.estatus === 'Inservible'

                          return (
                            <div
                              key={cas.id_casillero}
                              className={`p-1 rounded border flex flex-col justify-between ${
                                esDoble ? 'min-h-[58px]' : 'min-h-[44px]'
                              } ${
                                inservible
                                  ? 'bg-rose-50 border-rose-400 text-rose-950'
                                  : reparacion
                                  ? 'bg-amber-50 border-amber-400 text-amber-950'
                                  : libre
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                                  : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[8px] leading-none">
                                <span className="font-mono font-black">{cas.codigo_casillero}</span>
                                <span className="font-bold opacity-75">{cas.posicion_nivel[0]}</span>
                              </div>

                              <div className="my-0.5 truncate text-[9px] leading-tight font-black">
                                {modoPreCenso ? (
                                  <span className="text-zinc-300">________________</span>
                                ) : emp ? (
                                  <span className="truncate block" title={`${emp.apellido_paterno} ${emp.nombre}`}>
                                    {emp.apellido_paterno} {emp.nombre?.split(' ')[0]}
                                  </span>
                                ) : cas.nombre_provisional ? (
                                  <span className="text-amber-700 truncate block">
                                    {cas.nombre_provisional.split(' ')[0]} (Prov)
                                  </span>
                                ) : reparacion ? (
                                  <span className="text-amber-700 font-bold">A REPARAR</span>
                                ) : inservible ? (
                                  <span className="text-rose-700 font-bold">INSERVIBLE</span>
                                ) : (
                                  <span className="text-emerald-700 font-bold">LIBRE</span>
                                )}
                              </div>

                              <div className="text-[7px] text-zinc-500 font-medium truncate leading-none">
                                {emp ? `#${emp.numero_empleado}` : cas.condicion_llave || 'Sin Llave'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Guía de Corte de la Tira */}
              <div className="mt-4 pt-2 border-t-2 border-dashed border-zinc-400 flex items-center justify-center gap-2 text-[9px] text-zinc-500 font-bold select-none">
                <Scissors className="w-3.5 h-3.5" />
                <span>CORTAR POR LA LÍNEA PUNTEADA PARA FORMAR TIRA CONTINUA DE CABEZAL</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ========================================================================= */
        /* OPCIÓN 2: TIRAS CHICAS DE CASILLERO (ETIQUETAS ADHESIVAS PARA PUERTAS)     */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
            {casillerosEtiquetas.map(({ casillero, modulo }) => {
              const emp = casillero.empleados
              const qr = qrCodes[casillero.codigo_casillero]

              return (
                <div
                  key={casillero.id_casillero}
                  className="etiqueta-chica bg-white text-zinc-900 border-2 border-zinc-900 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-sm print:shadow-none min-h-[96px] max-h-[115px]"
                  style={{ pageBreakInside: 'avoid' }}
                >
                  {/* Datos del Casillero y Trabajador */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                    {/* Header Mini */}
                    <div className="flex items-center justify-between text-[8px] font-black text-zinc-500 uppercase leading-none border-b border-zinc-200 pb-1">
                      <span>PLANTA DE BENEFICIO · {modulo.bateria.split(' ')[0]} {modulo.bateria.split(' ')[1]}</span>
                      <span className="font-mono text-zinc-900 font-bold">{casillero.posicion_nivel}</span>
                    </div>

                    {/* Código de Casillero en Grande */}
                    <div className="my-0.5">
                      <span className="font-mono font-black text-xl tracking-tight text-zinc-950 block leading-tight">
                        {casillero.codigo_casillero}
                      </span>
                    </div>

                    {/* Titular */}
                    <div className="truncate text-xs">
                      {modoPreCenso ? (
                        <div className="border-b border-dashed border-zinc-400 h-4 mt-0.5" />
                      ) : emp ? (
                        <div className="truncate leading-tight">
                          <p className="font-black text-zinc-900 truncate uppercase text-[11px]">
                            {emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombre}
                          </p>
                          <p className="text-[9px] text-zinc-600 font-semibold truncate">
                            Ficha #{emp.numero_empleado} · {emp.puesto || emp.departamento}
                          </p>
                        </div>
                      ) : casillero.nombre_provisional ? (
                        <div className="truncate leading-tight">
                          <p className="font-black text-amber-700 truncate uppercase text-[11px]">
                            {casillero.nombre_provisional}
                          </p>
                          <p className="text-[9px] text-amber-600 font-bold">
                            (Ficha #{casillero.numero_empleado_provisional || 'N/A'})
                          </p>
                        </div>
                      ) : (
                        <p className="font-bold text-emerald-700 text-[10px]">
                          🟢 ESCANEA EL QR PARA REGISTRAR
                        </p>
                      )}
                    </div>
                  </div>

                  {/* QR Mini a la derecha */}
                  <div className="w-[70px] shrink-0 flex flex-col items-center">
                    <div className="w-16 h-16 border border-zinc-900 rounded p-0.5 bg-white flex items-center justify-center">
                      {qr ? (
                        <img src={qr} alt="QR" className="w-full h-full object-contain" />
                      ) : (
                        <QrCode className="w-6 h-6 text-zinc-400" />
                      )}
                    </div>
                    <span className="text-[6.5px] font-black uppercase text-zinc-700 mt-0.5 leading-none text-center">
                      ESCANEA QR RH
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Estilos específicos para impresión */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .tira-contenedor {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 8mm !important;
          }
          .etiqueta-chica {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}
