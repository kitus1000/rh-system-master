'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  Layers,
  Stethoscope,
  Truck,
  Home,
  Coffee,
  HardHat,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { formatShortDate } from '@/utils/contratistasConfig'

export default function CentroIntegradoRHPage() {
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const [pasesMedicos, setPasesMedicos] = useState<any[]>([])
  const [consultasHoy, setConsultasHoy] = useState<number>(0)
  const [reportesChoferes, setReportesChoferes] = useState<any[]>([])
  const [camasStats, setCamasStats] = useState({ total: 0, ocupadas: 0, empleadosAlojados: 0, contratistasAlojados: 0 })
  const [comedorHoy, setComedorHoy] = useState<{ count: number; total: number; registros: any[] }>({ count: 0, total: 0, registros: [] })
  const [contratistasEnMina, setContratistasEnMina] = useState<any[]>([])
  const [solicitudesContratistasPendientes, setSolicitudesContratistasPendientes] = useState<number>(0)

  const todayISO = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadUnifiedFeed()
  }, [])

  const loadUnifiedFeed = async () => {
    setLoading(true)
    try {
      // 1. Médico -> RH
      const { data: pasesData } = await supabase
        .from('pases_medicos')
        .select('*, empleados(id_empleado, nombre, apellido_paterno, numero_empleado)')
        .order('creado_el', { ascending: false })
        .limit(30)
      setPasesMedicos(pasesData || [])

      const { count: consCount } = await supabase
        .from('consultas_medicas')
        .select('*', { count: 'exact', head: true })
        .gte('fecha', `${todayISO}T00:00:00`)
      setConsultasHoy(consCount || 0)

      // 2. Choferes / Movilidad -> RH
      const { data: repData } = await supabase
        .from('logistica_reportes_diarios')
        .select('*, empleados(nombre, apellido_paterno)')
        .order('creado_el', { ascending: false })
        .limit(20)
      setReportesChoferes(repData || [])

      // 3. Campamentos -> RH
      const { data: camasData } = await supabase
        .from('campamento_camas')
        .select('id_cama, id_empleado, id_contratista_personal')
      if (camasData) {
        const total = camasData.length
        const empOcc = camasData.filter((c: any) => Boolean(c.id_empleado)).length
        const contOcc = camasData.filter((c: any) => Boolean(c.id_contratista_personal)).length
        setCamasStats({
          total,
          ocupadas: empOcc + contOcc,
          empleadosAlojados: empOcc,
          contratistasAlojados: contOcc,
        })
      }

      // 4. Comedor -> RH
      const { data: comData } = await supabase
        .from('comedor_registros')
        .select('*')
        .eq('fecha', todayISO)
        .order('creado_el', { ascending: false })
      if (comData) {
        const total = comData.reduce((acc: number, r: any) => acc + Number(r.costo || 0), 0)
        setComedorHoy({ count: comData.length, total, registros: comData })
      }

      // 5. Contratistas & Seguridad -> RH
      const { data: enMina } = await supabase
        .from('contratistas_credenciales')
        .select('*, contratistas_empresas(razon_social), contratistas_personal(nombre, apellido_paterno, puesto_servicio)')
        .eq('estatus', 'En Mina')
      setContratistasEnMina(enMina || [])

      const { count: solPend } = await supabase
        .from('contratistas_solicitudes')
        .select('*', { count: 'exact', head: true })
        .in('estatus_general', ['En Revisión', 'Prórroga Solicitada'])
      setSolicitudesContratistasPendientes(solPend || 0)
    } catch (err) {
      console.error('Error loading unified RH feed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncPaseToRH = async (pase: any) => {
    const idEmp = pase.id_empleado || pase.empleados?.id_empleado
    if (!idEmp) {
      alert('Este pase médico corresponde a un beneficiario sin ID de empleado titular.')
      return
    }
    setSyncingId(pase.id_pase)
    try {
      const res = await fetch('/api/integracion/sync-medico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_pase: pase.id_pase,
          id_empleado: idEmp,
          fecha_inicio: pase.fecha_salida || todayISO,
          fecha_fin: pase.fecha_retorno || pase.fecha_salida || todayISO,
          motivo: pase.motivo,
          folio: pase.folio,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al sincronizar')
      await loadUnifiedFeed()
    } catch (err: any) {
      alert('Error sincronizando: ' + err.message)
    } finally {
      setSyncingId(null)
    }
  }

  const alertasFlota = reportesChoferes.filter(
    (r) => !r.frenos_ok || !r.luces_ok || !r.llantas_ok || !r.niveles_aceite_ok || !r.extintor_ok || !r.botiquin_ok
  )

  const pasesPendientesSync = pasesMedicos.filter((p) => !p.sincronizado_rh && (p.id_empleado || p.empleados?.id_empleado))

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Banner */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Layers className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400">
              Alimentación Interna en Tiempo Real → RH
            </span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Centro Integrado de Recursos Humanos
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Consolida automáticamente la operación de Clínica Médica, Choferes, Campamentos, Comedor y Contratistas dentro de RH, manteniendo los portales externos aislados entre sí.
            </p>
          </div>
        </div>
        <button
          onClick={loadUnifiedFeed}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs px-5 py-3 rounded-xl shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Pulso</span>
        </button>
      </div>

      {/* Top 4-Pillar Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-600">Clínica Médica → RH</span>
            <Stethoscope className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-zinc-900">{pasesPendientesSync.length} <span className="text-xs font-normal text-zinc-500">pases por sincronizar</span></p>
          <p className="text-xs text-zinc-500">Consultas registradas hoy: <strong>{consultasHoy}</strong></p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-purple-600">Choferes / Flota → RH</span>
            <Truck className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-zinc-900">{reportesChoferes.length} <span className="text-xs font-normal text-zinc-500">bitácoras recientes</span></p>
          <p className="text-xs text-zinc-500">Alertas mecánicas: <strong className={alertasFlota.length > 0 ? 'text-rose-600' : 'text-emerald-600'}>{alertasFlota.length}</strong></p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-teal-600">Campamentos & Comedor</span>
            <Home className="w-5 h-5 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-zinc-900">{camasStats.ocupadas}/{camasStats.total} <span className="text-xs font-normal text-zinc-500">camas ocupadas</span></p>
          <p className="text-xs text-zinc-500">Comedor hoy: <strong>{comedorHoy.count}</strong> platillos (${comedorHoy.total.toLocaleString('es-MX')})</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-orange-600">Contratistas & Seguridad</span>
            <HardHat className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-black text-zinc-900">{contratistasEnMina.length} <span className="text-xs font-normal text-zinc-500">en mina ahora</span></p>
          <p className="text-xs text-zinc-500">Solicitudes / prórrogas pendientes: <strong>{solicitudesContratistasPendientes}</strong></p>
        </div>
      </div>

      {/* Main 2-Column Integration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pilar Médico -> RH Incidencias */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-rose-500" />
                <span>Pases Médicos → Incidencias / Pre-Nómina RH</span>
              </h2>
              <p className="text-xs text-zinc-500">Convierte pases emitidos por médicos en incidencias aprobadas para Pre-Nómina.</p>
            </div>
            <Link href="/reportes/prenomina" className="text-xs font-black text-amber-600 hover:underline flex items-center gap-1">
              Pre-Nómina <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
            {pasesMedicos.map((p) => {
              const empName = p.empleados ? `${p.empleados.nombre} ${p.empleados.apellido_paterno}` : (p.nombre_trabajador || 'Beneficiario / Externo')
              const canSync = Boolean(p.id_empleado || p.empleados?.id_empleado)
              return (
                <div key={p.id_pase} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-600">{p.folio || p.id_pase.slice(0, 8)}</span>
                      <strong className="text-zinc-900 truncate">{empName}</strong>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      Salida: {formatShortDate(p.fecha_salida)} → Retorno: {formatShortDate(p.fecha_retorno)} • {p.motivo || 'Valoración médica'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {p.sincronizado_rh ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> En Pre-Nómina
                      </span>
                    ) : canSync ? (
                      <button
                        onClick={() => handleSyncPaseToRH(p)}
                        disabled={syncingId === p.id_pase}
                        className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-black text-amber-400 text-[10px] font-black px-3 py-1.5 rounded-lg"
                      >
                        <Zap className="w-3 h-3" />
                        <span>{syncingId === p.id_pase ? 'Sincronizando...' : 'Aplicar a RH'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-zinc-400 italic">Familiar / Externo</span>
                    )}
                  </div>
                </div>
              )
            })}
            {pasesMedicos.length === 0 && <p className="p-8 text-center text-xs text-zinc-400">Sin pases médicos recientes.</p>}
          </div>
        </div>

        {/* Pilar Comedor -> RH */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-500" />
                <span>Consumos de Comedor Hoy (Empleados & Contratistas)</span>
              </h2>
              <p className="text-xs text-zinc-500">Alimentación directa desde el módulo Comedor hacia costos RH.</p>
            </div>
            <Link href="/comedor" className="text-xs font-black text-amber-600 hover:underline flex items-center gap-1">
              Ir a Comedor <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
            {comedorHoy.registros.map((r) => (
              <div key={r.id_registro} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-zinc-900">{r.nombre_comensal}</strong>{' '}
                  <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded font-bold text-zinc-600">{r.tipo_comensal}</span>
                  <div className="text-[11px] text-zinc-500">{r.departamento} • {r.hora}</div>
                </div>
                <div className="text-right">
                  <span className="font-black text-emerald-700">${Number(r.costo).toFixed(0)}</span>
                  <div className="text-[10px] font-bold text-zinc-500">{r.servicio}</div>
                </div>
              </div>
            ))}
            {comedorHoy.registros.length === 0 && <p className="p-8 text-center text-xs text-zinc-400">Sin registros de comedor hoy.</p>}
          </div>
        </div>

        {/* Pilar Choferes -> RH */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-500" />
                <span>Movilidad Choferes & Pasaje QR → RH</span>
              </h2>
              <p className="text-xs text-zinc-500">Bitácoras de traslados, pasajeros escaneados y alertas de seguridad vehicular.</p>
            </div>
            <Link href="/logistica/choferes/bitacora" className="text-xs font-black text-amber-600 hover:underline flex items-center gap-1">
              Bitácora <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
            {reportesChoferes.map((rep) => {
              const hasAlert = !rep.frenos_ok || !rep.luces_ok || !rep.llantas_ok || !rep.extintor_ok
              const paxCount = Array.isArray(rep.pasajeros_lista) ? rep.pasajeros_lista.length : (rep.pasajeros_subieron_a || 0)
              return (
                <div key={rep.id_reporte} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-zinc-900">{rep.camion_numero || 'Unidad'}</strong>
                      <span className="text-zinc-500">
                        Chofer: {rep.empleados ? `${rep.empleados.nombre} ${rep.empleados.apellido_paterno}` : 'Operador'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Fecha: {formatShortDate(rep.fecha)} • Ruta: {rep.punto_a || rep.ubicacion_caseta || 'Mina'} {rep.punto_b ? `→ ${rep.punto_b}` : ''} • Pasajeros: <strong>{paxCount}</strong>
                    </p>
                  </div>
                  {hasAlert ? (
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-lg">⚠️ Alerta Checklist</span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg">✓ OK</span>
                  )}
                </div>
              )
            })}
            {reportesChoferes.length === 0 && <p className="p-8 text-center text-xs text-zinc-400">Sin reportes diarios de choferes aún.</p>}
          </div>
        </div>

        {/* Pilar Contratistas En Mina -> RH */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <span>Personal Contratista Dentro de Mina Ahora</span>
              </h2>
              <p className="text-xs text-zinc-500">Control vivo desde Caseta de Seguridad hacia RH y Campamentos.</p>
            </div>
            <Link href="/contratistas" className="text-xs font-black text-amber-600 hover:underline flex items-center gap-1">
              Gestionar <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
            {contratistasEnMina.map((c) => (
              <div key={c.id_credencial} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black bg-zinc-900 text-amber-400 px-2 py-0.5 rounded">{c.codigo_qr}</span>
                    <strong className="text-zinc-900">{c.contratistas_personal?.nombre} {c.contratistas_personal?.apellido_paterno}</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{c.contratistas_empresas?.razon_social} • {c.contratistas_personal?.puesto_servicio}</p>
                </div>
                <div className="text-right font-mono text-[10px] text-zinc-500">
                  <div>Vence: <strong>{formatShortDate(c.vigencia_hasta)}</strong></div>
                  <div className="text-emerald-600 font-bold">En Mina</div>
                </div>
              </div>
            ))}
            {contratistasEnMina.length === 0 && <p className="p-8 text-center text-xs text-zinc-400">No hay personal contratista registrado dentro de mina actualmente.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
