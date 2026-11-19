'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import * as XLSX from 'xlsx'
import {
  Coffee,
  CheckCircle,
  UserCheck,
  Search,
  ArrowRight,
  Sparkles,
  Utensils,
  DollarSign,
  ChefHat,
  Filter,
  FileSpreadsheet,
  HardHat,
  QrCode,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { isSchemaMissingError } from '@/utils/contratistasConfig'

interface ComensalOption {
  id: string
  tipo: 'Empleado' | 'Contratista'
  ficha: string
  nombre: string
  puesto: string
  departamento: string
  codigo_qr?: string
}

interface RegistroComida {
  id_registro: string
  id_empleado?: string | null
  id_contratista_personal?: string | null
  numero_ficha?: string | null
  nombre_comensal: string
  tipo_comensal: 'Empleado' | 'Contratista' | 'Visita'
  puesto: string
  departamento: string
  servicio: 'Desayuno' | 'Comida' | 'Cena' | 'Colación'
  costo: number
  fecha: string
  hora: string
}

export default function ComedorPage() {
  const { profile } = useAuth()
  const [registros, setRegistros] = useState<RegistroComida[]>([])
  const [comensales, setComensales] = useState<ComensalOption[]>([])
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [workerSearch, setWorkerSearch] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [selectedService, setSelectedService] = useState<'Desayuno' | 'Comida' | 'Cena' | 'Colación'>('Comida')
  const [fechaFiltro, setFechaFiltro] = useState<'hoy' | 'semana' | 'todos'>('hoy')
  const [deptFilter, setDeptFilter] = useState('Todos')
  const [tipoFilter, setTipoFilter] = useState<'Todos' | 'Empleado' | 'Contratista'>('Todos')

  // Price & Chef Configuration persisted in Supabase comedor_config
  const [configId, setConfigId] = useState<string | null>(null)
  const [priceDesayuno, setPriceDesayuno] = useState(45)
  const [priceComida, setPriceComida] = useState(65)
  const [priceCena, setPriceCena] = useState(55)
  const [priceColacion, setPriceColacion] = useState(30)
  const [isEditingPrices, setIsEditingPrices] = useState(false)

  const [jefeCocinero, setJefeCocinero] = useState('Chef Don Carlos Méndez')
  const [isEditingChef, setIsEditingChef] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const todayISO = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadAllData()
  }, [])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3200)
  }

  const loadAllData = async () => {
    setLoading(true)
    try {
      // 1. Load Config
      const { data: cfgData, error: cfgErr } = await supabase
        .from('comedor_config')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (cfgErr && isSchemaMissingError(cfgErr)) {
        setSchemaMissing(true)
      } else if (cfgData) {
        setConfigId(cfgData.id)
        setPriceDesayuno(Number(cfgData.precio_desayuno ?? 45))
        setPriceComida(Number(cfgData.precio_comida ?? 65))
        setPriceCena(Number(cfgData.precio_cena ?? 55))
        setPriceColacion(Number(cfgData.precio_colacion ?? 30))
        setJefeCocinero(cfgData.jefe_cocinero || 'Chef Don Carlos Méndez')
      }

      // 2. Load Registros (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      const { data: regData, error: regErr } = await supabase
        .from('comedor_registros')
        .select('*')
        .gte('fecha', thirtyDaysAgo)
        .order('creado_el', { ascending: false })

      if (regErr) {
        if (isSchemaMissingError(regErr)) setSchemaMissing(true)
      } else if (regData) {
        setRegistros(regData as RegistroComida[])
      }

      // 3. Load Real Active Employees
      const { data: empData } = await supabase
        .from('empleados')
        .select('id_empleado, numero_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, es_contratista')
        .eq('estado_empleado', 'Activo')
        .order('nombre')

      const empOptions: ComensalOption[] = (empData || []).map((e: any) => ({
        id: e.id_empleado,
        tipo: e.es_contratista ? 'Contratista' : 'Empleado',
        ficha: String(e.numero_empleado || e.id_empleado.slice(0, 6)),
        nombre: `${e.nombre} ${e.apellido_paterno || ''} ${e.apellido_materno || ''}`.trim(),
        puesto: e.puesto || 'Personal General',
        departamento: e.departamento || 'Sin Asignar',
      }))

      // 4. Load Active Contractor Credentials (In Mine / Emitted)
      const { data: contData } = await supabase
        .from('contratistas_credenciales')
        .select(`
          codigo_qr,
          estatus,
          contratistas_personal (id_personal, nombre, apellido_paterno, apellido_materno, puesto_servicio, nss),
          contratistas_empresas (razon_social)
        `)
        .in('estatus', ['Emitida', 'En Mina'])

      const contOptions: ComensalOption[] = (contData || [])
        .filter((c: any) => c.contratistas_personal)
        .map((c: any) => {
          const p = c.contratistas_personal
          return {
            id: p.id_personal,
            tipo: 'Contratista' as const,
            ficha: c.codigo_qr,
            codigo_qr: c.codigo_qr,
            nombre: `${p.nombre} ${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim(),
            puesto: p.puesto_servicio || 'Contratista',
            departamento: `Contratista: ${c.contratistas_empresas?.razon_social || 'Externa'}`,
          }
        })

      setComensales([...empOptions, ...contOptions])
    } catch (err) {
      console.error('Error loading comedor:', err)
    } finally {
      setLoading(false)
    }
  }

  const getActivePrice = (serv: 'Desayuno' | 'Comida' | 'Cena' | 'Colación') => {
    if (serv === 'Desayuno') return priceDesayuno
    if (serv === 'Comida') return priceComida
    if (serv === 'Cena') return priceCena
    return priceColacion
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    try {
      const payload = {
        precio_desayuno: priceDesayuno,
        precio_comida: priceComida,
        precio_cena: priceCena,
        precio_colacion: priceColacion,
        jefe_cocinero: jefeCocinero,
        actualizado_el: new Date().toISOString(),
      }
      if (configId) {
        await supabase.from('comedor_config').update(payload).eq('id', configId)
      } else {
        const { data } = await supabase.from('comedor_config').insert([payload]).select().maybeSingle()
        if (data) setConfigId(data.id)
      }
      setIsEditingPrices(false)
      setIsEditingChef(false)
      showToast('Configuración de tarifas guardada en Supabase')
    } catch (e: any) {
      alert('Error guardando configuración: ' + e.message)
    } finally {
      setSavingConfig(false)
    }
  }

  const handleRegisterMeal = async (comensal: ComensalOption) => {
    if (schemaMissing) {
      alert('Ejecuta primero el script SQL_INTEGRACION_Y_CONTRATISTAS.sql en Supabase para habilitar el guardado en la nube.')
      return
    }
    const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    const costoActual = getActivePrice(selectedService)

    const payload = {
      id_empleado: comensal.tipo === 'Empleado' ? comensal.id : null,
      id_contratista_personal: comensal.tipo === 'Contratista' ? comensal.id : null,
      numero_ficha: comensal.ficha,
      nombre_comensal: comensal.nombre,
      tipo_comensal: comensal.tipo,
      puesto: comensal.puesto,
      departamento: comensal.departamento,
      servicio: selectedService,
      costo: costoActual,
      fecha: todayISO,
      hora: horaActual,
      registrado_por: profile?.id || null,
    }

    const { data, error } = await supabase.from('comedor_registros').insert([payload]).select().single()
    if (error) {
      alert('Error registrando consumo: ' + error.message)
      return
    }

    if (data) {
      setRegistros((prev) => [data as RegistroComida, ...prev])
      setWorkerSearch('')
      setQrInput('')
      showToast(`${selectedService} registrado para ${comensal.nombre} ($${costoActual})`)
    }
  }

  const handleQrScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = qrInput.trim().toLowerCase()
    if (!code) return
    const match = comensales.find(
      (c) =>
        c.ficha.toLowerCase() === code ||
        (c.codigo_qr && c.codigo_qr.toLowerCase() === code) ||
        c.nombre.toLowerCase() === code
    )
    if (!match) {
      alert(`No se encontró trabajador o credencial QR con código "${qrInput}"`)
      return
    }
    await handleRegisterMeal(match)
  }

  const handleDeleteRegistro = async (id: string) => {
    if (!confirm('¿Eliminar este registro de consumo?')) return
    const { error } = await supabase.from('comedor_registros').delete().eq('id_registro', id)
    if (!error) {
      setRegistros((prev) => prev.filter((r) => r.id_registro !== id))
    }
  }

  const handleExportExcel = () => {
    const rows = filteredRegistros.map((r) => ({
      Fecha: r.fecha,
      Hora: r.hora,
      Ficha_QR: r.numero_ficha || '',
      Nombre: r.nombre_comensal,
      Tipo: r.tipo_comensal,
      Puesto: r.puesto,
      Departamento: r.departamento,
      Servicio: r.servicio,
      Costo_MXN: r.costo,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Consumos Comedor')
    XLSX.writeFile(wb, `Reporte_Comedor_${todayISO}.xlsx`)
  }

  // Stats Calculations
  const weekCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const registrosHoy = registros.filter((r) => r.fecha === todayISO)
  const registrosSemana = registros.filter((r) => r.fecha >= weekCutoff)

  const costToday = registrosHoy.reduce((acc, curr) => acc + Number(curr.costo || 0), 0)
  const costWeek = registrosSemana.reduce((acc, curr) => acc + Number(curr.costo || 0), 0)
  const countToday = registrosHoy.length
  const countWeek = registrosSemana.length

  const departamentosList = useMemo(() => {
    const set = new Set<string>(['Todos'])
    registros.forEach((r) => {
      if (r.departamento) set.add(r.departamento)
    })
    return Array.from(set)
  }, [registros])

  const filteredRegistros = registros.filter((r) => {
    if (fechaFiltro === 'hoy' && r.fecha !== todayISO) return false
    if (fechaFiltro === 'semana' && r.fecha < weekCutoff) return false
    if (deptFilter !== 'Todos' && r.departamento !== deptFilter) return false
    if (tipoFilter !== 'Todos' && r.tipo_comensal !== tipoFilter) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match =
        (r.nombre_comensal || '').toLowerCase().includes(q) ||
        (r.numero_ficha || '').toLowerCase().includes(q) ||
        (r.servicio || '').toLowerCase().includes(q) ||
        (r.departamento || '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const filteredWorkers = comensales.filter((emp) => {
    const q = workerSearch.toLowerCase().trim()
    if (!q) return false
    return (
      emp.nombre.toLowerCase().includes(q) ||
      emp.ficha.toLowerCase().includes(q) ||
      emp.departamento.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-8 pb-16 font-mono text-zinc-850">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-sans font-bold text-xs flex items-center gap-2 animate-in slide-in-from-bottom-4">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {schemaMissing && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-900 font-sans">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black uppercase">Tablas de Comedor pendientes en Supabase</p>
            <p className="mt-0.5">
              Ejecuta el archivo <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">SQL_INTEGRACION_Y_CONTRATISTAS.sql</code> en el SQL Editor de Supabase para guardar consumos reales y sincronizarlos con Pre-Nómina y RH.
            </p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 p-6 md:p-8 text-white border border-zinc-900 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-950 to-zinc-950 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-1">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <span>Consola de Servicios Alimenticios Sincronizada con RH</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
              COMEDOR INDUSTRIAL MINA
            </h1>
            <p className="text-zinc-400 mt-1 max-w-xl font-sans text-xs">
              Registra consumos de empleados y contratistas autorizados en tiempo real. Toda la información alimenta automáticamente los reportes internos de RH y Pre-Nómina.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500 border border-amber-500/20">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 uppercase block tracking-widest font-black">Jefe Cocinero de Turno</span>
                {isEditingChef ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={jefeCocinero}
                      onChange={(e) => setJefeCocinero(e.target.value)}
                      className="bg-zinc-950 text-white text-xs px-2 py-0.5 rounded border border-zinc-700 outline-none"
                      autoFocus
                    />
                    <button onClick={saveConfig} disabled={savingConfig} className="text-[10px] text-emerald-400 font-bold hover:underline">
                      Guardar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <strong className="text-xs text-white">{jefeCocinero}</strong>
                    <button onClick={() => setIsEditingChef(true)} className="text-[9px] text-amber-500 hover:underline">
                      Editar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-8 border-t border-zinc-900">
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Raciones Servidas Hoy</span>
            <h3 className="text-2xl font-black text-white mt-1">{countToday}</h3>
          </div>
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Costo Consumo Hoy</span>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">
              ${costToday.toLocaleString('es-MX')} <span className="text-[10px] text-zinc-500">MXN</span>
            </h3>
          </div>
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Raciones (Últ. 7 días)</span>
            <h3 className="text-2xl font-black text-white mt-1">{countWeek}</h3>
          </div>
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Costo Total Semanal</span>
            <h3 className="text-2xl font-black text-amber-500 mt-1">
              ${costWeek.toLocaleString('es-MX')} <span className="text-[10px] text-zinc-500">MXN</span>
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Scanner & Pricing */}
        <div className="lg:col-span-5 space-y-6">
          {/* Meal Pricing */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
              <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                <span>Precios de Comidas (MXN)</span>
              </h2>
              {isEditingPrices ? (
                <button
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"
                >
                  {savingConfig ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              ) : (
                <button
                  onClick={() => setIsEditingPrices(true)}
                  className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Configurar Tarifas
                </button>
              )}
            </div>

            {isEditingPrices ? (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Desayuno</label>
                  <input type="number" value={priceDesayuno} onChange={(e) => setPriceDesayuno(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Comida</label>
                  <input type="number" value={priceComida} onChange={(e) => setPriceComida(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Cena</label>
                  <input type="number" value={priceCena} onChange={(e) => setPriceCena(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Colación</label>
                  <input type="number" value={priceColacion} onChange={(e) => setPriceColacion(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs font-mono">
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Desayuno</span>
                  <strong className="text-zinc-800 text-sm mt-0.5 block">${priceDesayuno}</strong>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Comida</span>
                  <strong className="text-emerald-600 text-sm mt-0.5 block">${priceComida}</strong>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Cena</span>
                  <strong className="text-zinc-800 text-sm mt-0.5 block">${priceCena}</strong>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Colación</span>
                  <strong className="text-zinc-800 text-sm mt-0.5 block">${priceColacion}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Scanner & Search */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-extrabold text-zinc-900 flex items-center gap-2 font-sans">
              <UserCheck className="w-5 h-5 text-amber-500" />
              <span>Escanear / Registrar Comensal</span>
            </h2>

            <div className="grid grid-cols-4 gap-2">
              {(['Desayuno', 'Comida', 'Cena', 'Colación'] as const).map((serv) => {
                const isActive = selectedService === serv
                return (
                  <button
                    key={serv}
                    onClick={() => setSelectedService(serv)}
                    className={`py-2.5 text-center text-[10px] font-black uppercase rounded-lg border transition-all ${
                      isActive
                        ? 'bg-amber-500 border-amber-500 text-black shadow-md shadow-amber-500/10'
                        : 'border-zinc-200 text-zinc-650 hover:bg-zinc-50'
                    }`}
                  >
                    {serv}
                  </button>
                )
              })}
            </div>

            {/* Quick QR / Ficha input */}
            <form onSubmit={handleQrScanSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <QrCode className="absolute left-3 top-3 h-4 w-4 text-amber-500" />
                <input
                  type="text"
                  placeholder="Escanear QR / # Ficha + Enter..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-amber-50/40 border border-amber-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-black rounded-xl transition-colors"
              >
                Registrar
              </button>
            </form>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                Buscar Empleado o Contratista ({comensales.length} activos)
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Nombre, # Ficha, CONT-..., o Empresa..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {workerSearch.length > 0 ? (
                filteredWorkers.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-4">No se encontraron comensales activos.</p>
                ) : (
                  filteredWorkers.slice(0, 25).map((emp) => (
                    <div
                      key={`${emp.tipo}-${emp.id}-${emp.ficha}`}
                      onClick={() => handleRegisterMeal(emp)}
                      className="flex justify-between items-center p-3 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-amber-50/40 hover:border-amber-400 cursor-pointer transition-all duration-200"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          {emp.tipo === 'Contratista' && <HardHat className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                          <h5 className="font-extrabold text-zinc-900 text-xs font-sans truncate">{emp.nombre}</h5>
                        </div>
                        <p className="text-[9px] text-zinc-500 truncate">
                          {emp.puesto} | <span className="font-bold">{emp.departamento}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-zinc-500 font-mono bg-white px-2 py-0.5 rounded border border-zinc-200">
                          {emp.ficha}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className="text-center py-8 text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-xl">
                  <Coffee className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  Escribe nombre, número de ficha o escanea el QR del trabajador o contratista.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Live Logs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="bg-zinc-50 border-b border-zinc-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900 flex items-center gap-2 font-sans">
                    <Utensils className="w-5 h-5 text-amber-500" />
                    <span>Bitácora de Consumos en Tiempo Real</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-sans">
                    Sincronizado automáticamente con Expedientes RH y Pre-Nómina.
                  </p>
                </div>

                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-md transition-all self-stretch sm:self-auto justify-center font-sans"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Excel</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div className="sm:col-span-2">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 mb-1">Buscar Persona / Ficha</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Nombre, ficha, servicio..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 mb-1">Periodo</label>
                  <select
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                  >
                    <option value="hoy">Hoy</option>
                    <option value="semana">Últimos 7 días</option>
                    <option value="todos">Últimos 30 días</option>
                  </select>
                </div>

                <div>
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 mb-1">Tipo</label>
                  <select
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Empleado">Empleados</option>
                    <option value="Contratista">Contratistas</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs"
                >
                  {departamentosList.map((dept, idx) => (
                    <option key={idx} value={dept}>
                      Depto: {dept}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-zinc-500 ml-auto">
                  Mostrando <strong>{filteredRegistros.length}</strong> registros
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[450px]">
              <table className="min-w-full divide-y divide-zinc-150 text-left text-xs font-mono">
                <thead className="bg-zinc-50 text-[9px] text-zinc-500 uppercase tracking-widest font-black sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Fecha / Hora</th>
                    <th className="px-4 py-3">Comensal</th>
                    <th className="px-4 py-3">Área / Empresa</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3 text-right">Costo</th>
                    <th className="px-3 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-100 text-zinc-700">
                  {filteredRegistros.map((reg) => (
                    <tr key={reg.id_registro} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-zinc-900 block">{reg.hora}</span>
                        <span className="text-[9px] text-zinc-400 block">{reg.fecha}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-zinc-900 font-sans">{reg.nombre_comensal}</span>
                          {reg.tipo_comensal === 'Contratista' && (
                            <span className="text-[8px] font-black bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                              CONTRATISTA
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-zinc-400">Ficha/QR: {reg.numero_ficha || 'S/N'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-zinc-600 text-[11px] font-sans">{reg.departamento}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            reg.servicio === 'Desayuno'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : reg.servicio === 'Comida'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : reg.servicio === 'Cena'
                              ? 'bg-blue-50 border-blue-200 text-blue-800'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                          }`}
                        >
                          {reg.servicio}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-zinc-900">
                        ${Number(reg.costo).toFixed(0)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRegistro(reg.id_registro)}
                          className="text-zinc-300 hover:text-rose-500 transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRegistros.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-sans">
                        No hay registros de consumo para los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-zinc-50 border-t border-zinc-200 p-4 px-6 flex justify-between items-center text-[10px] text-zinc-500 font-sans">
              <span>* Cada consumo queda guardado en Supabase para conciliación con RH y Contratistas.</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Conectado a RH</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
