'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/utils/supabase/client'
import { parseLockerObservaciones } from '@/utils/lockerMeta'
import { 
  Printer, ArrowLeft, RefreshCw, Filter, Scissors, QrCode, 
  Building2, Key, CheckCircle2, AlertTriangle, ShieldCheck, 
  FolderLock, UserCheck, Layers, FileText, ExternalLink, Globe
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
  modulo_bateria?: string
  tipo_modulo?: string
}

export default function FichasImprimiblesPage() {
  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [baseUrl, setBaseUrl] = useState('https://rh-system-master.vercel.app')

  // Filtros
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
    cargarCasilleros()
  }, [])

  // Cargar datos
  const cargarCasilleros = async () => {
    setLoading(true)
    try {
      const { data: modData } = await supabase
        .from('lockers_modulos')
        .select(`
          id_modulo, codigo_modulo, bateria, tipo_modulo,
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
        for (const mod of modData) {
          if (mod.lockers_casilleros) {
            const sorted = [...mod.lockers_casilleros].sort((a, b) => a.numero_en_modulo - b.numero_en_modulo)
            sorted.forEach(c => {
              flat.push({
                ...c,
                modulo_bateria: mod.bateria,
                tipo_modulo: mod.tipo_modulo
              })
            })
          }
        }
        setCasilleros(flat)
      }
    } catch (err) {
      console.error('Error cargando fichas:', err)
    } finally {
      setLoading(false)
    }
  }

  // Generar QRs con la URL directa al formulario de autorregistro y resguardo
  useEffect(() => {
    if (casilleros.length === 0) return
    const generarQRs = async () => {
      const map: Record<string, string> = {}
      const cleanBase = baseUrl.replace(/\/+$/, '')
      for (const c of casilleros) {
        try {
          const qrTargetUrl = `${cleanBase}/registro-locker?locker=${encodeURIComponent(c.codigo_casillero)}`
          const dataUrl = await QRCode.toDataURL(qrTargetUrl, {
            width: 150,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          })
          map[c.codigo_casillero] = dataUrl
        } catch (e) {
          console.error('Error QR', e)
        }
      }
      setQrCodes(map)
    }
    generarQRs()
  }, [casilleros, baseUrl])

  // Filtrado de fichas
  const casillerosFiltrados = useMemo(() => {
    return casilleros.filter(c => {
      if (filtroBateria !== 'TODAS' && c.modulo_bateria !== filtroBateria) return false
      if (filtroEstatus !== 'TODOS' && c.estatus !== filtroEstatus) return false
      return true
    })
  }, [casilleros, filtroBateria, filtroEstatus])

  // Agrupar en pares de 2 para cada hoja Carta (Media Carta cada una)
  const hojasCarta = useMemo(() => {
    const sheets: [LockerCasillero, LockerCasillero | null][] = []
    for (let i = 0; i < casillerosFiltrados.length; i += 2) {
      sheets.push([
        casillerosFiltrados[i],
        casillerosFiltrados[i + 1] || null
      ])
    }
    return sheets
  }, [casillerosFiltrados])

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Barra de Control en Pantalla (Oculta en Impresión) */}
      <div className="print:hidden space-y-4 mb-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/lockers"
              className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Volver a Lockers"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                Impresión de Fichas de Lockers (Media Carta con QR Interactivo)
              </h1>
              <p className="text-xs text-zinc-500">
                Cada código QR lleva directamente al formulario de autorregistro y resguardo de ese casillero en RH System.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleImprimir}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Fichas ({casillerosFiltrados.length})</span>
            </button>
          </div>
        </div>

        {/* Configuración del Enlace QR */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
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

        {/* Filtros de Impresión */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
          <div>
            <label className="font-bold text-zinc-500 block mb-1">Filtrar por Batería:</label>
            <select
              value={filtroBateria}
              onChange={(e) => setFiltroBateria(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-semibold"
            >
              <option value="TODAS">Todas las Baterías ({casilleros.length})</option>
              <option value="Batería 1">Batería 1 (PB-M01 a M12)</option>
              <option value="Batería 2">Batería 2 (PB-M13 a M24)</option>
              <option value="Batería 3">Batería 3 (PB-M25 a M36)</option>
              <option value="Batería 4 (Módulos Dobles Grandes)">Batería 4 - Módulos Grandes 2 Niv. (PB-M37 a M42)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-zinc-500 block mb-1">Filtrar por Estado:</label>
            <select
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-semibold"
            >
              <option value="TODOS">Todos los Casilleros</option>
              <option value="Asignado">Solo Asignados (Con Titular)</option>
              <option value="Disponible">Solo Disponibles (Libres)</option>
              <option value="En Reparacion">En Reparación</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <label className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modoPreCenso}
                onChange={(e) => setModoPreCenso(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-400"
              />
              <span>Modo Pre-Censo (Líneas en blanco para rellenar en campo)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Vista Previa de Hojas Carta */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-500">Preparando fichas imprimibles...</p>
        </div>
      ) : hojasCarta.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-500">No hay casilleros que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {hojasCarta.map((par, indexHoja) => (
            <div
              key={indexHoja}
              className="hoja-carta bg-white text-zinc-900 border border-slate-300 print:border-none shadow-xl print:shadow-none p-6 print:p-4 rounded-xl print:rounded-none max-w-[215.9mm] mx-auto min-h-[279.4mm] flex flex-col justify-between"
              style={{ pageBreakAfter: 'always' }}
            >
              {/* FICHA SUPERIOR (MEDIA CARTA 1) */}
              <div className="ficha-media-carta flex-1 flex flex-col justify-between border-2 border-zinc-900 rounded-xl p-5 bg-white mb-4">
                <TarjetaFicha
                  casillero={par[0]}
                  qrUrl={qrCodes[par[0].codigo_casillero]}
                  modoPreCenso={modoPreCenso}
                />
              </div>

              {/* LÍNEA GUÍA DE CORTE CON TIJERAS (EN MEDIO DE LA HOJA) */}
              <div className="py-2 flex items-center justify-center gap-2 text-zinc-400 font-mono text-[10px] select-none my-1">
                <span className="flex-1 border-t-2 border-dashed border-zinc-400" />
                <span className="flex items-center gap-1 font-bold text-zinc-600 bg-white px-2">
                  <Scissors className="w-3.5 h-3.5" /> CORTE AQUÍ (MEDIA HOJA CARTA)
                </span>
                <span className="flex-1 border-t-2 border-dashed border-zinc-400" />
              </div>

              {/* FICHA INFERIOR (MEDIA CARTA 2) */}
              {par[1] ? (
                <div className="ficha-media-carta flex-1 flex flex-col justify-between border-2 border-zinc-900 rounded-xl p-5 bg-white mt-4">
                  <TarjetaFicha
                    casillero={par[1]}
                    qrUrl={qrCodes[par[1].codigo_casillero]}
                    modoPreCenso={modoPreCenso}
                  />
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-zinc-200 rounded-xl p-6 flex items-center justify-center text-zinc-300 text-xs italic">
                  Espacio libre (casillero impar)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Estilos específicos de Impresión CSS */}
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
          .hoja-carta {
            page-break-after: always !important;
            break-after: page !important;
            min-height: 265mm !important;
            max-height: 265mm !important;
            padding: 0 !important;
            margin: 0 auto !important;
          }
          .ficha-media-carta {
            height: 125mm !important;
            max-height: 125mm !important;
          }
        }
      `}</style>
    </div>
  )
}

// Subcomponente individual de Ficha Media Carta
function TarjetaFicha({
  casillero,
  qrUrl,
  modoPreCenso
}: {
  casillero: LockerCasillero
  qrUrl?: string
  modoPreCenso: boolean
}) {
  const emp = casillero.empleados
  const esGrande = casillero.posicion_nivel.includes('Grande') || casillero.tipo_modulo === '2_niveles'
  const { meta } = parseLockerObservaciones(casillero.observaciones)

  return (
    <div className="h-full flex flex-col justify-between text-zinc-900">
      {/* 1. Header de Ficha */}
      <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-widest text-zinc-900 uppercase">
              RECURSOS HUMANOS · CONTROL DE BIENES
            </span>
          </div>
          <p className="text-xs font-bold text-zinc-600 mt-0.5">
            ÁREA: <span className="text-zinc-950 font-black">PLANTA DE BENEFICIO</span> · {casillero.modulo_bateria || 'BATERÍA VESTIDOR'}
          </p>
        </div>

        <div className="text-right">
          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border border-zinc-900 ${
            esGrande ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
          }`}>
            {esGrande ? 'MÓDULO 2 CASILLEROS (GRANDE)' : 'MÓDULO 3 CASILLEROS'}
          </span>
          <p className="text-[10px] font-bold text-zinc-500 mt-1">
            Nivel: {casillero.posicion_nivel}
          </p>
        </div>
      </div>

      {/* 2. Cuerpo Principal: Código Gigante + QR + Datos */}
      <div className="grid grid-cols-12 gap-4 my-auto py-2 items-center">
        {/* Código Locker Gigante */}
        <div className="col-span-8 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            CÓDIGO DE CASILLERO
          </span>
          <div className="text-4xl font-black font-mono tracking-tight text-zinc-950 border-b border-zinc-300 pb-1">
            {casillero.codigo_casillero}
          </div>

          {/* Datos del Titular Asignado */}
          <div className="pt-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              TRABAJADOR ASIGNADO / TITULAR:
            </span>

            {modoPreCenso ? (
              <div className="space-y-2 mt-1">
                <div className="border-b-2 border-dotted border-zinc-400 h-6" />
                <div className="flex gap-4 text-[10px] font-semibold text-zinc-500">
                  <span className="flex-1 border-b border-dotted border-zinc-400">Ficha:</span>
                  <span className="flex-1 border-b border-dotted border-zinc-400">Turno / Puesto:</span>
                </div>
              </div>
            ) : emp ? (
              <div className="mt-0.5">
                <p className="text-base font-black text-zinc-900 uppercase leading-tight">
                  {emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombre}
                </p>
                <p className="text-xs font-bold text-zinc-600 mt-0.5">
                  Ficha #{emp.numero_empleado} · {emp.puesto || emp.departamento}
                </p>
              </div>
            ) : casillero.nombre_provisional ? (
              <div className="mt-0.5">
                <p className="text-sm font-black text-zinc-900 uppercase leading-tight">
                  {casillero.nombre_provisional}
                </p>
                <p className="text-xs font-bold text-amber-700">
                  (Ficha: #{casillero.numero_empleado_provisional || 'N/A'} · {meta.puesto_provisional || 'Planta de Beneficio'})
                </p>
              </div>
            ) : (
              <div className="mt-1">
                <p className="text-sm font-black text-emerald-700">
                  🟢 CASILLERO DISPONIBLE · ESCANEA EL QR PARA REGISTRARTE
                </p>
                <div className="border-b border-dotted border-zinc-300 mt-1 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* QR Escaneable para Autorregistro y Resguardo */}
        <div className="col-span-4 flex flex-col items-center justify-center p-2 border-2 border-zinc-900 rounded-xl bg-zinc-50 text-center">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={casillero.codigo_casillero}
              className="w-24 h-24 object-contain"
            />
          ) : (
            <div className="w-24 h-24 flex items-center justify-center bg-zinc-200">
              <QrCode className="w-8 h-8 text-zinc-400" />
            </div>
          )}
          <span className="text-[8.5px] font-black uppercase text-zinc-900 tracking-tight mt-1 leading-tight">
            Escanea para Registro y Resguardo en RH
          </span>
        </div>
      </div>

      {/* 3. Control de Llave y Firma de Resguardo */}
      <div className="border-t-2 border-zinc-900 pt-2 grid grid-cols-12 gap-3 items-end text-xs">
        <div className="col-span-6 space-y-1">
          <span className="text-[10px] font-black uppercase text-zinc-500">
            CONTROL DE ACCESO / LLAVE:
          </span>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 border border-zinc-400 rounded">
              [{casillero.condicion_llave === 'Tiene Llave' ? 'X' : ' '}] Llave Oficial
            </span>
            <span className="px-1.5 py-0.5 border border-zinc-400 rounded">
              [{casillero.condicion_llave === 'Candado Personal' ? 'X' : ' '}] Candado Propio
            </span>
            <span className="px-1.5 py-0.5 border border-zinc-400 rounded">
              [{casillero.condicion_llave === 'Copia en RH' || meta.deja_llave_rh === 'Si' || meta.deja_llave_rh === 'Ya Entregada' ? 'X' : ' '}] Deja Copia en RH
            </span>
          </div>
          {casillero.numero_llave && (
            <p className="text-[10px] font-bold text-zinc-600">
              Núm. de Llave Grabado: <span className="font-mono text-zinc-900 font-black">{casillero.numero_llave}</span>
            </p>
          )}
        </div>

        {/* Espacio para Firma */}
        <div className="col-span-6 text-center border-t border-zinc-400 pt-1">
          <span className="text-[10px] font-black uppercase text-zinc-700">
            Firma de Resguardo / Conformidad del Titular
          </span>
          <p className="text-[8px] text-zinc-500 leading-none mt-0.5">
            El trabajador debe acudir a RH a firmar su resguardo oficial.
          </p>
        </div>
      </div>
    </div>
  )
}
