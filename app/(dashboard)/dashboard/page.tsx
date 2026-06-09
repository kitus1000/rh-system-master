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
