'use client'

import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  FileText,
  CheckSquare,
  Home,
  Award,
  Calendar,
  ClipboardList,
  Files,
  Library,
  Settings,
  Info,
  ChevronRight,
  Activity,
  Cpu,
  HardHat,
  Coffee,
  Stethoscope,
  Heart,
  Pill,
  Hospital
} from 'lucide-react'

interface ModuloInicio {
  name: string
  desc: string
  href: string
  icon: any
  tag: string
  sector: string
  color: string
  glow: string
  border: string
  roles?: string[]
}

export default function InicioPage() {
  const { profile, loading } = useAuth()
  
  const userName = profile?.nombre_completo || 'Operador'
  const role = profile?.rol || 'Jefe de Departamento'

  const MODULOS: ModuloInicio[] = [
    // --- Módulos Médicos ---
    {
      name: 'Consultas Médicas',
      desc: 'Registro de atención médica y dispensación de medicamentos en almacén.',
      href: '/medico/consultas',
      icon: Stethoscope,
      tag: 'CLINIC_CONSULT',
      sector: 'SECTOR_MED',
      color: 'text-rose-500 bg-rose-500/10',
      glow: 'hover:shadow-rose-500/10 hover:border-rose-500/40',
      border: 'group-hover:border-rose-500/50',
      roles: ['Administrativo', 'Médico', 'Recursos Humanos']
    },
    {
      name: 'Pacientes y Expedientes',
      desc: 'Catálogo de expedientes clínicos de trabajadores y sus acompañantes/beneficiarios.',
      href: '/medico/pacientes',
      icon: Heart,
      tag: 'CLINIC_PATIENTS',
      sector: 'SECTOR_MED',
      color: 'text-emerald-500 bg-emerald-500/10',
      glow: 'hover:shadow-emerald-500/10 hover:border-emerald-500/40',
      border: 'group-hover:border-emerald-500/50',
      roles: ['Administrativo', 'Médico', 'Recursos Humanos']
    },
    {
      name: 'Pases Médicos y Viáticos',
      desc: 'Generación de folios de pases médicos, viáticos y hojas de referencia.',
      href: '/medico/pases',
      icon: FileText,
      tag: 'CLINIC_PASSES',
      sector: 'SECTOR_MED',
      color: 'text-amber-500 bg-amber-500/10',
      glow: 'hover:shadow-amber-500/10 hover:border-amber-500/40',
      border: 'group-hover:border-amber-500/50',
      roles: ['Administrativo', 'Médico', 'Recursos Humanos']
    },
    {
      name: 'Inventario de Farmacia',
      desc: 'Control de stock y caducidad de medicamentos en consultorios.',
      href: '/medico/inventario',
      icon: Pill,
      tag: 'CLINIC_INVENTORY',
      sector: 'SECTOR_MED',
      color: 'text-blue-500 bg-blue-500/10',
      glow: 'hover:shadow-blue-500/10 hover:border-blue-500/40',
      border: 'group-hover:border-blue-500/50',
      roles: ['Administrativo', 'Médico', 'Recursos Humanos']
    },
    {
      name: 'Clínicas Externas',
      desc: 'Directorio y configuración de unidades médicas de origen y destino.',
      href: '/medico/clinicas',
      icon: Hospital,
      tag: 'CLINIC_HOSPITALS',
      sector: 'SECTOR_MED',
      color: 'text-indigo-500 bg-indigo-500/10',
      glow: 'hover:shadow-indigo-500/10 hover:border-indigo-500/40',
      border: 'group-hover:border-indigo-500/50',
      roles: ['Administrativo', 'Médico', 'Recursos Humanos']
    },

    // --- Módulos de Capital Humano & Operaciones ---
    {
      name: 'Dashboard Analítico',
      desc: 'Visualiza indicadores, gráficas de incidencias y estadísticas corporativas.',
      href: '/dashboard',
      icon: LayoutDashboard,
      tag: 'ANALYTICS_V3',
      sector: 'SECTOR_01',
      color: 'text-amber-500 bg-amber-500/10',
      glow: 'hover:shadow-amber-500/10 hover:border-amber-500/40',
      border: 'group-hover:border-amber-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Control Empleados',
      desc: 'Gestión de expedientes de personal, contratos y perfiles residenciales.',
      href: '/empleados',
      icon: Users,
      tag: 'STAFF_HR_V1',
      sector: 'SECTOR_02',
      color: 'text-blue-500 bg-blue-500/10',
      glow: 'hover:shadow-blue-500/10 hover:border-blue-500/40',
      border: 'group-hover:border-blue-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Buzón Solicitudes',
      desc: 'Historial general de incidencias, permisos, faltas y solicitudes del personal.',
      href: '/solicitudes',
      icon: FileText,
      tag: 'INBOX_REQ_L5',
      sector: 'SECTOR_03',
      color: 'text-emerald-500 bg-emerald-500/10',
      glow: 'hover:shadow-emerald-500/10 hover:border-emerald-500/40',
      border: 'group-hover:border-emerald-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Autorizaciones',
      desc: 'Consola de aprobación de permisos y firmas digitales de jefes directos.',
      href: '/autorizaciones',
      icon: CheckSquare,
      tag: 'AUTH_DECISION',
      sector: 'SECTOR_04',
      color: 'text-indigo-500 bg-indigo-500/10',
      glow: 'hover:shadow-indigo-500/10 hover:border-indigo-500/40',
      border: 'group-hover:border-indigo-500/50',
      roles: ['Administrativo', 'Superintendente']
    },
    {
      name: 'Campamentos Residencia',
      desc: 'Distribución y ocupación de camas, cabañas y habitaciones residenciales.',
      href: '/campamentos',
      icon: Home,
      tag: 'RESIDENCE_M4',
      sector: 'SECTOR_05',
      color: 'text-teal-500 bg-teal-500/10',
      glow: 'hover:shadow-teal-500/10 hover:border-teal-500/40',
      border: 'group-hover:border-teal-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Evaluaciones Desempeño',
      desc: 'Métricas duales (RH & Departamento) visualizadas en gráficas de radar.',
      href: '/evaluaciones',
      icon: Award,
      tag: 'PERFORM_RADAR',
      sector: 'SECTOR_06',
      color: 'text-purple-500 bg-purple-500/10',
      glow: 'hover:shadow-purple-500/10 hover:border-purple-500/40',
      border: 'group-hover:border-purple-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Comedor de Mina',
      desc: 'Registro de porciones de comidas servidas, asistencia y bitácora de horarios.',
      href: '/comedor',
      icon: Coffee,
      tag: 'MESS_HALL_U7',
      sector: 'SECTOR_07',
      color: 'text-orange-500 bg-orange-500/10',
      glow: 'hover:shadow-orange-500/10 hover:border-orange-500/40',
      border: 'group-hover:border-orange-500/50',
      roles: ['Administrativo', 'Superintendente']
    },
    {
      name: 'Calendario y Fechas',
      desc: 'Planeador de turnos, descansos quincenales, retornos y días festivos.',
      href: '/calendario',
      icon: Calendar,
      tag: 'SCHED_CAL_X2',
      sector: 'SECTOR_08',
      color: 'text-rose-500 bg-rose-500/10',
      glow: 'hover:shadow-rose-500/10 hover:border-rose-500/40',
      border: 'group-hover:border-rose-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Pre-Nómina Incidencias',
      desc: 'Cálculo para nómina de bonos por puesto, asistencias y descuentos.',
      href: '/reportes/prenomina',
      icon: ClipboardList,
      tag: 'SALARY_CALC_D9',
      sector: 'SECTOR_09',
      color: 'text-amber-600 bg-amber-600/10',
      glow: 'hover:shadow-amber-600/10 hover:border-amber-600/40',
      border: 'group-hover:border-amber-600/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Repositorio Documental',
      desc: 'Plantillas y contratos descargables en PDF/Excel oficiales del sistema.',
      href: '/documentos',
      icon: Files,
      tag: 'REP_DOC_FILES',
      sector: 'SECTOR_10',
      color: 'text-sky-500 bg-sky-500/10',
      glow: 'hover:shadow-sky-500/10 hover:border-sky-500/40',
      border: 'group-hover:border-sky-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento']
    },
    {
      name: 'Catálogos Maestros',
      desc: 'Estructuración de departamentos de mina, puestos operativos y salarios.',
      href: '/catalogos',
      icon: Library,
      tag: 'CAT_MASTER_DB',
      sector: 'SECTOR_11',
      color: 'text-lime-600 bg-lime-650/10',
      glow: 'hover:shadow-lime-600/10 hover:border-lime-600/40',
      border: 'group-hover:border-lime-600/50',
      roles: ['Administrativo']
    },
    {
      name: 'Configuración Sistema',
      desc: 'Configura el logo oficial, datos empresariales, límites y tolerancias.',
      href: '/configuracion',
      icon: Settings,
      tag: 'SYS_CONFIG_SET',
      sector: 'SECTOR_12',
      color: 'text-zinc-500 bg-zinc-500/10',
      glow: 'hover:shadow-zinc-500/10 hover:border-zinc-500/40',
      border: 'group-hover:border-zinc-500/50',
      roles: ['Administrativo']
    },
    {
      name: 'Acerca del Software',
      desc: 'Información del equipo de desarrollo, versión y soporte técnico.',
      href: '/acerca-de',
      icon: Info,
      tag: 'ABOUT_SYSTEM_R3',
      sector: 'SECTOR_13',
      color: 'text-fuchsia-500 bg-fuchsia-500/10',
      glow: 'hover:shadow-fuchsia-500/10 hover:border-fuchsia-500/40',
      border: 'group-hover:border-fuchsia-500/50',
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Médico']
    }
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 font-mono">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  const filteredModulos = MODULOS.filter(mod => {
    if (!mod.roles) return false
    return mod.roles.includes(role)
  })

  return (
    <div className="space-y-8 pb-16 font-mono text-zinc-800 animate-in fade-in duration-500">
      
      {/* Immersive Cyber Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 p-6 md:p-8 text-white border border-zinc-900 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.02] pointer-events-none" />
        {/* Animated HUD scanner bar */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-[scan_6s_ease-in-out_infinite]" />

        <style jsx global>{`
            @keyframes scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
            }
        `}</style>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 text-amber-500 shadow-md rotate-3 shrink-0">
              <HardHat className="h-8 w-8 animate-bounce" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase">
                  NÚCLEO CENTRAL DE CIRCUNNAVEGACIÓN
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight mt-1 uppercase leading-none italic">
                MENÚ <span className="text-amber-500">PRINCIPAL</span>
              </h1>
              <p className="text-xs text-zinc-400 mt-1 max-w-lg font-sans">
                Consola de enlaces directos para saltar a cualquier módulo del Expediente Corporativo.
              </p>
            </div>
          </div>

          <div className="text-left md:text-right text-zinc-400">
            <span className="text-xs text-zinc-500 uppercase tracking-widest block font-bold">SESIÓN ACTIVA:</span>
            <span className="text-lg font-bold text-white block mt-0.5">{userName}</span>
            <div className="flex items-center md:justify-end gap-1 text-[10px] text-zinc-500 mt-1">
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>ROL: {role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Modules Link Grid */}
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
          <h2 className="text-lg font-extrabold text-zinc-900 flex items-center gap-2 font-sans">
            <Cpu className="w-5 h-5 text-amber-500" />
            <span>Módulos del Expediente ({role === 'Médico' ? 'Área Médica' : 'Administración'})</span>
          </h2>
          <span className="bg-zinc-200 text-zinc-850 text-[10px] font-black tracking-widest px-3 py-1 rounded-full font-mono">
            MÓDULOS: {filteredModulos.length} DISPONIBLES
          </span>
        </div>

        {filteredModulos.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-zinc-200 rounded-2xl bg-white/50">
            <Activity className="w-12 h-12 text-zinc-350 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-600">No hay módulos disponibles asignados a tu rol.</p>
            <p className="text-xs text-zinc-400 mt-1">Por favor, póngase en contacto con el administrador del sistema.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredModulos.map((mod) => (
              <Link
                href={mod.href}
                key={mod.name}
                className={`group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 transition-all duration-300 shadow-xs hover:-translate-y-1.5 hover:shadow-xl flex flex-col justify-between min-h-[190px] ${mod.glow}`}
              >
                {/* Corner HUD Bracket decorations on each card */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-transparent group-hover:border-amber-500/40 rounded-tl-xs pointer-events-none transition-colors" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-transparent group-hover:border-amber-500/40 rounded-tr-xs pointer-events-none transition-colors" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-transparent group-hover:border-amber-500/40 rounded-bl-xs pointer-events-none transition-colors" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-transparent group-hover:border-amber-500/40 rounded-br-xs pointer-events-none transition-colors" />

                <div className="space-y-3">
                  {/* Header card icon / sector tags */}
                  <div className="flex justify-between items-center">
                    <div className="p-2.5 rounded-lg shrink-0 transition-colors duration-300 text-zinc-950 bg-zinc-100 group-hover:bg-zinc-950 group-hover:text-amber-500">
                      <mod.icon className="h-5 w-5" />
                    </div>
                    <div className="text-right font-mono text-[8px] text-zinc-400 group-hover:text-zinc-500 transition-colors">
                      <span className="block">{mod.tag}</span>
                      <span className="block font-bold mt-0.5">{mod.sector}</span>
                    </div>
                  </div>

                  {/* Title & desc */}
                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 uppercase italic tracking-tight font-sans transition-colors group-hover:text-amber-600">
                      {mod.name}
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed font-sans line-clamp-3">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                {/* Action bottom anchor */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400 group-hover:text-zinc-600 transition-colors">
                  <span className="font-mono text-[8px] uppercase tracking-widest font-black group-hover:text-amber-600 transition-colors">CONECTAR ENLACE</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-zinc-400 group-hover:text-amber-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Disclaimer */}
      <div className="border-t border-zinc-200 pt-4 flex justify-between items-center text-[10px] text-zinc-400 uppercase tracking-widest">
        <span>* Consola de circunnavegación del Expediente Minero</span>
        <span>J. Raul Mtz M &copy; 2026</span>
      </div>
    </div>
  )
}
