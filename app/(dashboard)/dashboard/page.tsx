'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  Users,
  AlertCircle,
  CalendarDays,
  FileCheck,
  Building,
  Activity,
  Clock,
  ArrowUpRight
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

export default function Dashboard() {
  // --- STATE ---
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<any>({ name: 'Mi Empresa', logo: null })
  const [currentDate, setCurrentDate] = useState<string>('')

  // KPI Stats
  const [stats, setStats] = useState([
    { name: 'Empleados Activos', value: '0', icon: Users, color: 'text-amber-500', bg: 'bg-zinc-900 border-amber-500/20', href: '/empleados', trend: '+2%' },
    { name: 'Incidencias (Mes)', value: '0', icon: AlertCircle, color: 'text-red-500', bg: 'bg-zinc-900 border-zinc-800', href: '/empleados', trend: '-1' },
    { name: 'Solicitudes Pendientes', value: '0', icon: FileCheck, color: 'text-blue-500', bg: 'bg-zinc-900 border-zinc-800', href: '/solicitudes', trend: 'Actual' },
    { name: 'Departamentos', value: '0', icon: Building, color: 'text-emerald-500', bg: 'bg-zinc-900 border-zinc-800', href: '/catalogos', trend: 'Estable' },
  ])

  // Charts Data
  const [requestsData, setRequestsData] = useState<any[]>([])
  const [incidentsData, setIncidentsData] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  // --- COLORS ---
  const COLORS = ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#ec4899']

  // --- EFFECT: LOAD DATA ---
  useEffect(() => {
    checkPermissions()
    // 1. Initial Setup
    const dateStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    setCurrentDate(`${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`)

    fetchCompanyConfig()
    fetchDashboardData()
  }, [])

  async function checkPermissions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (profile && profile.rol === 'Jefe') {
        window.location.href = '/autorizaciones'
      }
    }
  }

  async function fetchCompanyConfig() {
    const { data } = await supabase
      .from('configuracion_empresa')
      .select('*')
      .limit(1)
      .single()

    if (data) {
      setCompany({ name: data.nombre_empresa || 'Mi Empresa', logo: data.logo_base64 })
    } else {
      // Fallback to localStorage if DB is empty or fails
      const storedConfig = localStorage.getItem('rh_config_empresa')
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig)
        setCompany({ name: parsed.nombre_empresa || 'Mi Empresa', logo: parsed.logo_base64 })
      }
    }
  }

  async function fetchDashboardData() {
    try {
      // A. STATS COUNTS
      const { count: empCount } = await supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('estado_empleado', 'Activo')
      const { count: incCount } = await supabase.from('empleado_incidencias').select('*', { count: 'exact', head: true }).eq('estado', 'Capturada')
      const { count: solCount } = await supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estatus', 'En revisión')
      const { count: depCount } = await supabase.from('cat_departamentos').select('*', { count: 'exact', head: true })

      setStats([
        { name: 'Empleados Activos', value: (empCount || 0).toString(), icon: Users, color: 'text-amber-500', bg: 'bg-zinc-900 border-amber-500/20', href: '/empleados', trend: 'Total' },
        { name: 'Incidencias Activas', value: (incCount || 0).toString(), icon: AlertCircle, color: 'text-red-500', bg: 'bg-zinc-900 border-zinc-800', href: '/empleados', trend: 'Requieren Atención' },
        { name: 'Solicitudes Pendientes', value: (solCount || 0).toString(), icon: FileCheck, color: 'text-blue-500', bg: 'bg-zinc-900 border-zinc-800', href: '/solicitudes', trend: 'En revisión' },
        { name: 'Departamentos', value: (depCount || 0).toString(), icon: Building, color: 'text-emerald-500', bg: 'bg-zinc-900 border-zinc-800', href: '/catalogos', trend: 'Estructura' },
      ])

      // B. CHARTS: REQUESTS BY TYPE
      const { data: solData } = await supabase
        .from('solicitudes')
        .select('id_tipo_solicitud, cat_tipos_solicitud(tipo_solicitud)')

      if (solData) {
        const group: any = {}
        solData.forEach((s: any) => {
          const type = s.cat_tipos_solicitud?.tipo_solicitud || 'Otro'
          group[type] = (group[type] || 0) + 1
        })
        const chartData = Object.keys(group).map(key => ({ name: key, value: group[key] }))
        setRequestsData(chartData)
      }

      // C. CHARTS: INCIDENTS BY TYPE
      const { data: incData } = await supabase
        .from('empleado_incidencias')
        .select('id_tipo_incidencia, cat_tipos_incidencia(tipo_incidencia)')

      if (incData) {
        const group: any = {}
        incData.forEach((i: any) => {
          const type = i.cat_tipos_incidencia?.tipo_incidencia || 'Otro'
          group[type] = (group[type] || 0) + 1
        })
        const chartData = Object.keys(group).map(key => ({ name: key, value: group[key] }))
        setIncidentsData(chartData)
      }

      // D. RECENT ACTIVITY
      const { data: recent } = await supabase
        .from('solicitudes')
        .select(`
                    id_solicitud,
                    folio,
                    estatus,
                    creado_el,
                    cat_tipos_solicitud(tipo_solicitud),
                    empleados(nombre, apellido_paterno)
                `)
        .order('creado_el', { ascending: false })
        .limit(5)

      setRecentActivity(recent || [])

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* HEADER CORPORTATIVO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
        <div className="flex items-center space-x-4">
          {company.logo ? (
            <img src={company.logo} alt="Logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-16 w-16 bg-zinc-100 rounded-lg flex items-center justify-center">
              <Building className="h-8 w-8 text-zinc-300" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">{company.name}</h1>
            <p className="text-sm text-zinc-500 font-medium tracking-widest text-amber-600 uppercase">El Expediente | Gestión Institucional</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-right">
          <p className="text-2xl font-light text-zinc-800">{currentDate}</p>
          <div className="flex items-center justify-end text-sm text-zinc-400 mt-1">
            <Clock className="w-4 h-4 mr-1" />
            <span>Panel de Control en Tiempo Real</span>
          </div>
        </div>
      </div>

      {/* BANNER CENTRO INTEGRADO RH & CONTRATISTAS */}
      <div className="bg-gradient-to-r from-emerald-900 via-zinc-900 to-zinc-950 p-5 sm:p-6 rounded-2xl text-white shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border border-emerald-500/30">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500 text-black rounded-2xl shrink-0">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs font-black uppercase text-emerald-400 tracking-wider">Centro de Comando y Sincronización</div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">Mapa Maestro: Todo el Sistema Conectado y Organizado por Flujo</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Selecciona directamente el paso o módulo al que necesitas ir sin perderte en menús.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/empleados/duplicados"
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all uppercase tracking-wider"
          >
            <span>🧹 Depurar Duplicados (RH / Nombres)</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link
            href="/mi-departamento"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all uppercase tracking-wider"
          >
            <span>🏢 Mi Departamento</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link
            href="/integracion-rh"
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all uppercase tracking-wider border border-zinc-700"
          >
            <span>Centro 360°</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* MAPA LÓGICO DE FLUJOS PASO A PASO (¿QUÉ NECESITAS HACER HOY?) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FLUJO 1: ALTA -> INDUCCIÓN -> SERVICIOS -> CREDENCIAL */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Flujo Operativo 1
              </span>
              <h3 className="text-sm font-black text-zinc-900 uppercase mt-1">
                👷 Alta de Trabajador → Inducción → Servicios → Credencial
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Link href="/empleados/nuevo" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-amber-50 border border-zinc-200 hover:border-amber-300 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-amber-600">PASO 1</span>
              <span>➕ Alta Empleado</span>
            </Link>
            <Link href="/seguridad" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-orange-50 border border-zinc-200 hover:border-orange-300 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-orange-600">PASO 2</span>
              <span>🛡️ Inducción Seg.</span>
            </Link>
            <Link href="/campamentos" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-emerald-50 border border-zinc-200 hover:border-emerald-300 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-emerald-600">PASO 3</span>
              <span>🛏️ Campamento</span>
            </Link>
            <Link href="/lockers" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-blue-50 border border-zinc-200 hover:border-blue-300 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-blue-600">PASO 4</span>
              <span>🔐 Locker y QR</span>
            </Link>
            <Link href="/empleados/credenciales" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-amber-50 border border-zinc-200 hover:border-amber-300 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-amber-600">PASO 5</span>
              <span>🪪 Credencial QR</span>
            </Link>
            <Link href="/empleados" className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 font-black flex flex-col justify-between">
              <span className="text-[10px] text-zinc-400">DIRECTORIO</span>
              <span>📋 Ver Padrón</span>
            </Link>
          </div>
        </div>

        {/* FLUJO 2: DEPURACIÓN DE DUPLICADOS Y CATÁLOGOS */}
        <div className="bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full">
                Flujo de Limpieza e Integridad
              </span>
              <h3 className="text-sm font-black text-zinc-900 uppercase mt-1">
                🧹 Conflicto de Duplicidades (RH / Recursos Humanos y Personas)
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <Link href="/empleados/duplicados" className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 font-black text-zinc-900 flex flex-col justify-between">
              <span className="text-[10px] text-amber-700">1. DEPARTAMENTOS</span>
              <span>🏢 Unificar RH / recursos humanos / RECURSOS HUMANOS</span>
            </Link>
            <Link href="/empleados/duplicados" className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 font-black text-zinc-900 flex flex-col justify-between">
              <span className="text-[10px] text-emerald-700">2. DOBLE PERSONA</span>
              <span>👥 Unir Jose Arana Chavez ↔ Arana Chavez Jose</span>
            </Link>
            <Link href="/catalogos" className="p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] text-purple-600 font-black">3. CATÁLOGOS</span>
              <span>📚 Administrar Departamentos y Roles Oficiales</span>
            </Link>
          </div>
        </div>

        {/* FLUJO 3: SINDICATO, VACANTES (DRAG & DROP), SEMANALES/QUINCENALES Y MI DEPARTAMENTO */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                Flujo Operativo 2
              </span>
              <h3 className="text-sm font-black text-zinc-900 uppercase mt-1">
                🔀 Escalafón, Vacantes (Art. 116 C.C.T.), Semanales/Quincenales y Beneficiarios
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Link href="/movimientos-sindicato" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-amber-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-amber-600">ARRASTRAR Y SOLTAR</span>
              <span>🔀 Mover a Lugar Vacío</span>
            </Link>
            <Link href="/mi-departamento" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-emerald-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-emerald-600">MI ÁREA</span>
              <span>🏢 Mi Departamento</span>
            </Link>
            <Link href="/medico/pacientes" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-rose-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-rose-600">FAMILIAS</span>
              <span>👨‍👩‍👧‍👦 Beneficiarios Sindicato</span>
            </Link>
          </div>
        </div>

        {/* FLUJO 4: CONTRATISTAS, CASETA, CLÍNICA Y TRANSPORTE */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                Flujo Operativo 3
              </span>
              <h3 className="text-sm font-black text-zinc-900 uppercase mt-1">
                🪖 Contratistas, Caseta QR, Clínica Médica y Transporte
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Link href="/contratistas" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-orange-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-orange-600">EMPRESAS</span>
              <span>🏗️ Contratistas</span>
            </Link>
            <Link href="/caseta" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-amber-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-amber-600">VIGILANCIA</span>
              <span>🚧 Caseta QR</span>
            </Link>
            <Link href="/medico/pases" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-rose-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-rose-600">CLÍNICA</span>
              <span>🚑 Pases Médicos</span>
            </Link>
            <Link href="/transporte" className="p-2.5 rounded-xl bg-zinc-50 hover:bg-cyan-50 border border-zinc-200 font-bold text-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-cyan-600">MOVILIDAD</span>
              <span>🚌 Viajes y Rutas</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Link
            href={item.href || '#'}
            key={item.name}
            className={`group relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 bg-white border-zinc-200`}
          >
            <div className="flex items-center justify-between z-10 relative">
              <div>
                <p className="truncate text-xs font-bold text-zinc-500 uppercase tracking-wider">{item.name}</p>
                <p className="text-4xl font-black text-zinc-900 mt-2 tracking-tight">{item.value}</p>
              </div>
              <div className={`p-3 rounded-full ${item.color.replace('text-', 'bg-').replace('500', '100')}`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-zinc-400">
              <span className="text-emerald-600 flex items-center bg-emerald-50 px-2 py-0.5 rounded-full mr-2">
                <Activity className="w-3 h-3 mr-1" /> {item.trend}
              </span>
              <span className="group-hover:translate-x-1 transition-transform flex items-center">
                Ver detalles <ArrowUpRight className="w-3 h-3 ml-1" />
              </span>
            </div>
            {/* Decorative Gradient glow */}
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br from-transparent to-current ${item.color} blur-xl group-hover:opacity-20 transition-opacity`} />
          </Link>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart 1: Requests */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
          <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center">
            <FileCheck className="w-5 h-5 mr-2 text-blue-500" />
            Distribución de Solicitudes
          </h3>
          <div className="h-72 w-full overflow-x-auto">
            <div className="min-w-[600px] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestsData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fill: '#71717a' }}
                  />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f4f4f5' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 2: Incidents */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
          <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-amber-500" />
            Tipos de Incidencias
          </h3>
          <div className="h-72 w-full flex items-center justify-center overflow-x-auto">
            <div className="min-w-[400px] h-full">
              {incidentsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incidentsData}
                      cx="50%"
                      cy="40%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {incidentsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={70} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-zinc-400 text-sm flex items-center justify-center h-full">
                  No hay datos de incidencias registrados.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-zinc-500" />
            Actividad Reciente
          </h3>
          <Link href="/solicitudes" className="text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline">
            Ver todo el historial
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100">
            <thead className="bg-zinc-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Folio</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Empleado</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trámite</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-100">
              {recentActivity.map((act) => (
                <tr key={act.id_solicitud} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">{act.folio}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                    {act.empleados?.nombre} {act.empleados?.apellido_paterno}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                    {act.cat_tipos_solicitud?.tipo_solicitud}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                    {new Date(act.creado_el).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${act.estatus === 'Aprobada' || act.estatus === 'Autorizada RH' || act.estatus === 'Ejecutada' ? 'bg-green-100 text-green-800' :
                        act.estatus === 'Rechazada' || act.estatus === 'Cancelada' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'}`}>
                      {act.estatus}
                    </span>
                  </td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 text-sm">
                    No hay actividad reciente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
