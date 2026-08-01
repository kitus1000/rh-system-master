'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import {
  Stethoscope,
  Heart,
  FileText,
  Bed,
  Pill,
  Hospital,
  Truck,
  MapPin,
  ShieldCheck,
  Bus,
  Users,
  Clock,
  Inbox,
  CheckSquare,
  Home,
  Award,
  Coffee,
  Calendar,
  ClipboardList,
  Files,
  FileSignature,
  UserCheck,
  Library,
  Settings,
  User,
  Search,
  Zap,
  Radio,
  Wifi,
  BatteryCharging,
  Sparkles,
  ChevronRight,
  LogOut,
  SlidersHorizontal,
  LayoutGrid
} from 'lucide-react'

interface AppItem {
  id: string
  name: string
  subtitle: string
  href: string
  icon: any
  category: 'medico' | 'logistica' | 'rh' | 'documentos' | 'sistema'
  badge?: string
  color: string
  bgGradient: string
  glowColor: string
  roles: string[]
}

export default function InicioPage() {
  const { profile, loading } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'medico' | 'logistica' | 'rh' | 'documentos' | 'sistema'>('all')
  const [time, setTime] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>('')

  // Live Digital Clock & Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
      setDateStr(now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const userName = profile?.nombre_completo || 'Usuario Operativo'
  const userRole = profile?.rol || 'Jefe de Departamento'

  // Full Catalog of System Apps
  const ALL_APPS: AppItem[] = [
    // --- Módulo Médico ---
    {
      id: 'med-consultas',
      name: 'Consultas Médicas',
      subtitle: 'Atención médica y dispensación de recetas',
      href: '/medico/consultas',
      icon: Stethoscope,
      category: 'medico',
      badge: 'CLÍNICA',
      color: 'text-rose-400',
      bgGradient: 'from-rose-500/20 via-rose-500/5 to-transparent',
      glowColor: 'hover:border-rose-500/50 hover:shadow-rose-500/20',
      roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos']
    },
    {
      id: 'med-pacientes',
      name: 'Pacientes & Expedientes',
      subtitle: 'Trabajadores titulares y beneficiarios',
      href: '/medico/pacientes',
      icon: Heart,
      category: 'medico',
      badge: 'EXPEDIENTES',
      color: 'text-pink-400',
      bgGradient: 'from-pink-500/20 via-pink-500/5 to-transparent',
      glowColor: 'hover:border-pink-500/50 hover:shadow-pink-500/20',
      roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos']
    },
    {
      id: 'med-pases',
      name: 'Pases Médicos & Viáticos',
      subtitle: 'Emisión de viáticos y pases de especialista',
      href: '/medico/pases',
      icon: FileText,
      category: 'medico',
      badge: 'PASES',
      color: 'text-amber-400',
      bgGradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
      glowColor: 'hover:border-amber-500/50 hover:shadow-amber-500/20',
      roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Jefe de Departamento', 'Recursos Humanos']
    },
    {
      id: 'med-hotel',
      name: 'Pases de Hotel',
      subtitle: 'Alojamiento para consultas foráneas',
      href: '/medico/hotel',
      icon: Bed,
      category: 'medico',
      badge: 'HOSPEDAJE',
      color: 'text-cyan-400',
      bgGradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
      glowColor: 'hover:border-cyan-500/50 hover:shadow-cyan-500/20',
      roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos']
    },
    {
      id: 'med-farmacia',
      name: 'Inventario Farmacia',
      subtitle: 'Stock de medicamentos y caducidades',
      href: '/medico/inventario',
      icon: Pill,
      category: 'medico',
      badge: 'FARMACIA',
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20',
      roles: ['Administrativo', 'Médico', 'Jefe Médico']
    },
    {
      id: 'med-clinicas',
      name: 'Clínicas Externas',
      subtitle: 'Directorio de hospitales de origen/destino',
      href: '/medico/clinicas',
      icon: Hospital,
      category: 'medico',
      badge: 'RED MÉDICA',
      color: 'text-indigo-400',
      bgGradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
      glowColor: 'hover:border-indigo-500/50 hover:shadow-indigo-500/20',
      roles: ['Administrativo', 'Médico', 'Jefe Médico']
    },

    // --- Módulo Logística & Transporte ---
    {
      id: 'log-choferes',
      name: 'Portal de Choferes',
      subtitle: 'Inspección vehicular y salidas de mina',
      href: '/logistica/choferes',
      icon: Truck,
      category: 'logistica',
      badge: 'OPERATIVO',
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20',
      roles: ['Administrativo', 'Chofer', 'Superintendente', 'Logística']
    },
    {
      id: 'log-flota',
      name: 'Control de Flota',
      subtitle: 'Monitoreo de unidades y mantenimiento',
      href: '/logistica',
      icon: MapPin,
      category: 'logistica',
      badge: 'MONITOREO',
      color: 'text-sky-400',
      bgGradient: 'from-sky-500/20 via-sky-500/5 to-transparent',
      glowColor: 'hover:border-sky-500/50 hover:shadow-sky-500/20',
      roles: ['Administrativo', 'Superintendente', 'Logística']
    },
    {
      id: 'log-accesos',
      name: 'Caseta & Accesos',
      subtitle: 'Bitácora de entrada y salida en caseta',
      href: '/logistica/accesos',
      icon: ShieldCheck,
      category: 'logistica',
      badge: 'CASETA',
      color: 'text-purple-400',
      bgGradient: 'from-purple-500/20 via-purple-500/5 to-transparent',
      glowColor: 'hover:border-purple-500/50 hover:shadow-purple-500/20',
      roles: ['Administrativo', 'Logística']
    },
    {
      id: 'log-reservas',
      name: 'Reservar Viaje',
      subtitle: 'Asignación de asientos de traslado',
      href: '/transporte',
      icon: Bus,
      category: 'logistica',
      badge: 'RUTAS',
      color: 'text-yellow-400',
      bgGradient: 'from-yellow-500/20 via-yellow-500/5 to-transparent',
      glowColor: 'hover:border-yellow-500/50 hover:shadow-yellow-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Logística']
    },

    // --- Módulo Recursos Humanos & Operaciones ---
    {
      id: 'rh-empleados',
      name: 'Directorio Empleados',
      subtitle: 'Expedientes laborales y datos de personal',
      href: '/empleados',
      icon: Users,
      category: 'rh',
      badge: 'PERSONAL',
      color: 'text-blue-400',
      bgGradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
      glowColor: 'hover:border-blue-500/50 hover:shadow-blue-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      id: 'rh-prenomina',
      name: 'Asistencia & Pre-Nómina',
      subtitle: 'Incidencias, bonos y checadas',
      href: '/reportes/prenomina',
      icon: Clock,
      category: 'rh',
      badge: 'NÓMINA',
      color: 'text-teal-400',
      bgGradient: 'from-teal-500/20 via-teal-500/5 to-transparent',
      glowColor: 'hover:border-teal-500/50 hover:shadow-teal-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      id: 'rh-solicitudes',
      name: 'Buzón de Solicitudes',
      subtitle: 'Permisos, faltas y solicitudes de personal',
      href: '/solicitudes',
      icon: Inbox,
      category: 'rh',
      badge: 'SOLICITUDES',
      color: 'text-indigo-400',
      bgGradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
      glowColor: 'hover:border-indigo-500/50 hover:shadow-indigo-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      id: 'rh-autorizaciones',
      name: 'Firmas & Aprobaciones',
      subtitle: 'Aprobaciones digitales de jefes directos',
      href: '/autorizaciones',
      icon: CheckSquare,
      category: 'rh',
      badge: 'APROBAR',
      color: 'text-violet-400',
      bgGradient: 'from-violet-500/20 via-violet-500/5 to-transparent',
      glowColor: 'hover:border-violet-500/50 hover:shadow-violet-500/20',
      roles: ['Administrativo', 'Superintendente']
    },
    {
      id: 'rh-campamentos',
      name: 'Residencia & Campamentos',
      subtitle: 'Ocupación de camas y dormitorios',
      href: '/campamentos',
      icon: Home,
      category: 'rh',
      badge: 'ALOJAMIENTO',
      color: 'text-orange-400',
      bgGradient: 'from-orange-500/20 via-orange-500/5 to-transparent',
      glowColor: 'hover:border-orange-500/50 hover:shadow-orange-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      id: 'rh-evaluaciones',
      name: 'Evaluaciones Desempeño',
      subtitle: 'Métricas de radar y desempeño anual',
      href: '/evaluaciones',
      icon: Award,
      category: 'rh',
      badge: 'DESEMPEÑO',
      color: 'text-fuchsia-400',
      bgGradient: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
      glowColor: 'hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      id: 'rh-comedor',
      name: 'Comedor de Mina',
      subtitle: 'Porciones servidas y bitácora de comidas',
      href: '/comedor',
      icon: Coffee,
      category: 'rh',
      badge: 'COMEDOR',
      color: 'text-amber-400',
      bgGradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
      glowColor: 'hover:border-amber-500/50 hover:shadow-amber-500/20',
      roles: ['Administrativo', 'Superintendente']
    },
    {
      id: 'rh-calendario',
      name: 'Calendario Operativo',
      subtitle: 'Turnos, subidas, bajadas y festivos',
      href: '/calendario',
      icon: Calendar,
      category: 'rh',
      badge: 'TURNOS',
      color: 'text-rose-400',
      bgGradient: 'from-rose-500/20 via-rose-500/5 to-transparent',
      glowColor: 'hover:border-rose-500/50 hover:shadow-rose-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },

    // --- Módulo Documental & Sistema ---
    {
      id: 'doc-repositorio',
      name: 'Repositorio Documental',
      subtitle: 'Plantillas, contratos y formatos PDF',
      href: '/documentos',
      icon: Files,
      category: 'documentos',
      badge: 'ARCHIVOS',
      color: 'text-blue-400',
      bgGradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
      glowColor: 'hover:border-blue-500/50 hover:shadow-blue-500/20',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      id: 'doc-generar',
      name: 'Generador Contratos',
      subtitle: 'Constructor de contratos y actas',
      href: '/documentos/generar',
      icon: FileSignature,
      category: 'documentos',
      badge: 'CONTRATOS',
      color: 'text-cyan-400',
      bgGradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
      glowColor: 'hover:border-cyan-500/50 hover:shadow-cyan-500/20',
      roles: ['Administrativo', 'Recursos Humanos']
    },
    {
      id: 'sys-usuarios',
      name: 'Gestión de Accesos',
      subtitle: 'Administración de usuarios y roles RBAC',
      href: '/usuarios',
      icon: UserCheck,
      category: 'sistema',
      badge: 'SEGURIDAD',
      color: 'text-purple-400',
      bgGradient: 'from-purple-500/20 via-purple-500/5 to-transparent',
      glowColor: 'hover:border-purple-500/50 hover:shadow-purple-500/20',
      roles: ['Administrativo']
    },
    {
      id: 'sys-catalogos',
      name: 'Catálogos Maestros',
      subtitle: 'Departamentos, puestos y salarios',
      href: '/catalogos',
      icon: Library,
      category: 'sistema',
      badge: 'BASE DE DATOS',
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20',
      roles: ['Administrativo']
    },
    {
      id: 'sys-config',
      name: 'Configuración',
      subtitle: 'Empresa, logos, tolerancias y sistema',
      href: '/configuracion',
      icon: Settings,
      category: 'sistema',
      badge: 'SISTEMA',
      color: 'text-slate-400',
      bgGradient: 'from-slate-500/20 via-slate-500/5 to-transparent',
      glowColor: 'hover:border-slate-500/50 hover:shadow-slate-500/20',
      roles: ['Administrativo']
    },
    {
      id: 'sys-perfil',
      name: 'Mi Perfil',
      subtitle: 'Configuración de cuenta y contraseña',
      href: '/mi-perfil',
      icon: User,
      category: 'sistema',
      badge: 'CUENTA',
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20',
      roles: ['Administrativo', 'Médico', 'Chofer', 'Superintendente', 'Jefe de Departamento']
    }
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-emerald-400 font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
          <span className="text-xs tracking-widest uppercase animate-pulse">CARGANDO ANDROID HUB OS...</span>
        </div>
      </div>
    )
  }

  // Filter apps strictly by Role first
  const userApps = ALL_APPS.filter(app => {
    if (!app.roles) return false
    // Match exact role or match if user is Admin / Superintendente
    if (userRole === 'Administrativo') return true
    return app.roles.some(r => r.toLowerCase() === userRole.toLowerCase() || userRole.toLowerCase().includes(r.toLowerCase()))
  })

  // Filter apps by Category tab
  const tabFilteredApps = activeTab === 'all' 
    ? userApps 
    : userApps.filter(app => app.category === activeTab)

  // Filter apps by Search term
  const finalFilteredApps = tabFilteredApps.filter(app => {
    const q = searchTerm.toLowerCase()
    return app.name.toLowerCase().includes(q) || app.subtitle.toLowerCase().includes(q) || (app.badge && app.badge.toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500 selection:text-black pb-24 -m-6 p-6 sm:p-8 relative overflow-hidden">
      
      {/* Background Cyber Grid Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:40px_40px] opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* 📱 1. Android Futuristic OS Top Status Bar */}
      <div className="relative z-10 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        
        {/* Left: Live OS System Status & Clock */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Sparkles className="w-7 h-7 animate-pulse" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-950 shadow-sm animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase font-mono">
                ANDROID SMART HUB V4.2
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" /> 5G MINA
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" /> 100%
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 flex items-center gap-2">
              <span>Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{userName}</span></span>
            </h1>

            <p className="text-xs text-zinc-400 capitalize mt-0.5">
              📅 {dateStr}
            </p>
          </div>
        </div>

        {/* Right: Live Digital Clock & Role Badge */}
        <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto justify-between lg:justify-end">
          <div className="text-left lg:text-right font-mono">
            <div className="text-2xl sm:text-3xl font-black tracking-wider text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              {time || '00:00:00 AM'}
            </div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5 flex items-center lg:justify-end gap-1">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> Sincronización Minera Activa
            </div>
          </div>

          <div className="bg-zinc-950/80 px-4 py-2 rounded-2xl border border-zinc-800 text-left">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Perfil Asignado</span>
            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {userRole}
            </span>
          </div>
        </div>
      </div>

      {/* 🔍 2. Interactive Search & Android Dock Filter Bar */}
      <div className="relative z-10 space-y-4 mb-8">
        
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          {/* Search Input Bar */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar aplicación o herramienta de tu perfil..."
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-xl transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white bg-zinc-800 px-2 py-0.5 rounded-lg">
                Limpiar
              </button>
            )}
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900/60 px-4 py-2.5 rounded-2xl border border-zinc-800/80">
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
            <span>Herramientas Disponibles: <strong className="text-white font-bold">{finalFilteredApps.length}</strong></span>
          </div>
        </div>

        {/* Category Tabs Switcher (Android Style Pill Bar) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-2">
          {[
            { id: 'all', label: '📱 Todas las Apps', icon: LayoutGrid },
            { id: 'medico', label: '🚑 Módulo Médico', icon: Stethoscope },
            { id: 'logistica', label: '🚚 Logística & Choferes', icon: Truck },
            { id: 'rh', label: '👥 Capital Humano', icon: Users },
            { id: 'documentos', label: '📜 Documentos', icon: Files },
            { id: 'sistema', label: '⚙️ Configuración', icon: Settings },
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black border-emerald-400 shadow-lg shadow-emerald-500/20 font-black' 
                    : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 🚀 3. Android App Cards Grid */}
      <div className="relative z-10">
        {finalFilteredApps.length === 0 ? (
          <div className="bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-center max-w-md mx-auto my-8">
            <SlidersHorizontal className="w-12 h-12 text-zinc-600 mx-auto mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-white">No se encontraron aplicaciones</h3>
            <p className="text-xs text-zinc-400 mt-1">No hay herramientas coincidentes con tu búsqueda o tu rol actual ({userRole}).</p>
            <button 
              onClick={() => { setSearchTerm(''); setActiveTab('all') }}
              className="mt-4 px-4 py-2 bg-emerald-500 text-black text-xs font-bold rounded-xl hover:bg-emerald-400 transition-all"
            >
              Mostrar todas mis herramientas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {finalFilteredApps.map(app => {
              const IconComp = app.icon
              return (
                <Link
                  key={app.id}
                  href={app.href}
                  className={`group relative bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/90 rounded-3xl p-5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col justify-between overflow-hidden ${app.glowColor}`}
                >
                  {/* Neon Glow Gradient Accent */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${app.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                  {/* Corner Accent indicator */}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-3xl pointer-events-none" />

                  <div className="relative z-10 space-y-4">
                    
                    {/* Top Row: App Icon & Badge */}
                    <div className="flex justify-between items-start">
                      <div className={`w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-zinc-700 transition-all ${app.color}`}>
                        <IconComp className="w-6 h-6" />
                      </div>

                      {app.badge && (
                        <span className="text-[9px] font-mono font-black tracking-widest bg-zinc-950 text-zinc-400 px-2.5 py-1 rounded-full border border-zinc-800 uppercase group-hover:border-zinc-700 transition-colors">
                          {app.badge}
                        </span>
                      )}
                    </div>

                    {/* App Title & Subtitle */}
                    <div>
                      <h3 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors tracking-tight">
                        {app.name}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                        {app.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="relative z-10 mt-6 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 group-hover:text-white transition-colors">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400/80 group-hover:text-emerald-400">ABRIR APLICACIÓN</span>
                    <div className="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black group-hover:border-emerald-400 transition-all">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 📱 4. Android Bottom Bar Quick Nav */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 text-xs text-zinc-400">
        <Link href="/inicio" className="flex items-center gap-1.5 text-emerald-400 font-bold hover:text-emerald-300 transition-colors">
          <Sparkles className="w-4 h-4" /> <span>Inicio</span>
        </Link>
        <div className="w-px h-4 bg-zinc-800" />
        <Link href="/mi-perfil" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <User className="w-4 h-4 text-cyan-400" /> <span>Mi Perfil</span>
        </Link>
        <div className="w-px h-4 bg-zinc-800" />
        <a href="/" onClick={() => localStorage.clear()} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors">
          <LogOut className="w-4 h-4" /> <span>Salir</span>
        </a>
      </div>

    </div>
  )
}
