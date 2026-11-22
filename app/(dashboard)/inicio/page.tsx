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
  LayoutGrid,
  HardHat,
  Layers,
  QrCode
} from 'lucide-react'
import { BacisLogoEmblem } from '@/components/BacisLogoEmblem'
import { PortalAppIcon, type PortalIconId } from '@/components/PortalAppIcons'

const APP_ICON_MAP: Record<string, PortalIconId> = {
  'med-consultas': 'medico',
  'med-pacientes': 'medico',
  'med-pases': 'pases',
  'med-hotel': 'hotel',
  'med-farmacia': 'farmacia',
  'med-clinicas': 'clinicas',
  'log-choferes': 'chofer',
  'log-flota': 'flota',
  'log-accesos': 'accesos',
  'log-reservas': 'viajes',
  'rh-integracion': 'integracion',
  'rh-contratistas': 'contratista',
  'contratista-portal': 'contratista',
  'seg-caseta': 'seguridad',
  'caseta-qr': 'caseta-qr',
  'rh-empleados': 'rh',
  'rh-prenomina': 'prenomina',
  'rh-solicitudes': 'solicitudes',
  'rh-autorizaciones': 'autorizaciones',
  'rh-campamentos': 'campamento',
  'rh-evaluaciones': 'evaluaciones',
  'rh-comedor': 'comedor',
  'rh-calendario': 'calendario',
  'doc-repositorio': 'documentos',
  'doc-generar': 'documentos',
  'sys-usuarios': 'usuarios',
  'sys-catalogos': 'catalogos',
  'sys-config': 'catalogos',
  'sys-perfil': 'perfil',
}

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
  const [animCycle, setAnimCycle] = useState(1)

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
      id: 'rh-integracion',
      name: 'Centro Integrado RH',
      subtitle: 'Alimentación interna desde Médicos, Choferes, Campamentos, Comedor y Contratistas',
      href: '/integracion-rh',
      icon: Layers,
      category: 'rh',
      badge: 'SINCRONIZACIÓN',
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20',
      roles: ['Administrativo', 'Recursos Humanos', 'Sistemas']
    },
    {
      id: 'rh-contratistas',
      name: 'Contratistas & Accesos Mina',
      subtitle: 'Empresas, documentos SAT/IMSS/NSS, aprobación multi-factor y credenciales QR',
      href: '/contratistas',
      icon: HardHat,
      category: 'rh',
      badge: 'CONTRATISTAS',
      color: 'text-orange-400',
      bgGradient: 'from-orange-500/20 via-orange-500/5 to-transparent',
      glowColor: 'hover:border-orange-500/50 hover:shadow-orange-500/20',
      roles: ['Administrativo', 'Recursos Humanos', 'Superintendente', 'Jefe de Departamento', 'Sistemas']
    },
    {
      id: 'contratista-portal',
      name: 'Portal Individual Contratista',
      subtitle: 'Vista del contratista: alta/baja de personal, carga de PDFs y solicitud de ingreso',
      href: '/contratistas-portal',
      icon: HardHat,
      category: 'rh',
      badge: 'PORTAL EXTERNO',
      color: 'text-amber-400',
      bgGradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
      glowColor: 'hover:border-amber-500/50 hover:shadow-amber-500/20',
      roles: ['Administrativo', 'Recursos Humanos', 'Sistemas', 'Contratista']
    },
    {
      id: 'seg-caseta',
      name: 'Seguridad Industrial (Inducciones)',
      subtitle: 'Validación de inducciones de seguridad, requisitos y programación de fechas',
      href: '/seguridad',
      icon: ShieldCheck,
      category: 'rh',
      badge: 'SEG. INDUSTRIAL',
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20',
      roles: ['Administrativo', 'Recursos Humanos', 'Seguridad Industrial', 'Seguridad', 'Sistemas']
    },
    {
      id: 'caseta-qr',
      name: 'Caseta (Solo Credenciales QR)',
      subtitle: 'Control de entradas, salidas a mina y devolución física de credenciales',
      href: '/caseta',
      icon: QrCode,
      category: 'rh',
      badge: 'CASETA QR',
      color: 'text-cyan-400',
      bgGradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
      glowColor: 'hover:border-cyan-500/50 hover:shadow-cyan-500/20',
      roles: ['Administrativo', 'Recursos Humanos', 'Caseta', 'Seguridad Patrimonial', 'Sistemas']
    },
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
      roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Encargado de Campamento y Comedor']
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
      roles: ['Administrativo', 'Superintendente', 'Encargado de Campamento y Comedor']
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
      <div className="flex h-screen items-center justify-center bg-[#02050b] text-white font-mono -m-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-16 rounded-2xl bg-gradient-to-b from-blue-950 to-black border border-blue-400/50 shadow-[0_0_45px_rgba(37,99,235,0.55)] flex items-center justify-center p-2 bacis-logo-boot">
            <BacisLogoEmblem className="w-16 h-14" showGlow={false} />
          </div>
          <div className="text-lg font-black tracking-[0.18em] uppercase">
            PORTAL <span className="text-blue-400">BACIS</span>
          </div>
          <div className="relative w-10 h-10">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="absolute inset-0 bacis-win-dot"
                style={{ animationDelay: `${idx * 135}ms` }}
              >
                <span
                  className="block w-1.5 h-1.5 rounded-full mx-auto"
                  style={{
                    background: idx % 2 === 0 ? '#ffffff' : '#38bdf8',
                    boxShadow: '0 0 10px rgba(56,189,248,0.95)',
                  }}
                />
              </div>
            ))}
          </div>
          <span className="text-[11px] tracking-[0.22em] uppercase text-blue-300 animate-pulse">
            CARGANDO ESCRITORIO OPERATIVO...
          </span>
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
    <div className="min-h-screen bg-[#02050b] text-white font-sans selection:bg-blue-600 selection:text-white pb-24 -m-6 p-6 sm:p-8 relative overflow-hidden">
      
      {/* Fondo Corporativo Bacís: Azul Rey, Blanco y Negro Obsidiana */}
      <div
        className="absolute inset-0 opacity-[0.2] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(37,99,235,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.22) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div
        className="absolute top-0 right-1/4 w-[560px] h-[420px] rounded-full blur-[140px] pointer-events-none bacis-halo-pulse"
        style={{ background: 'rgba(37,99,235,0.26)' }}
      />
      <div
        className="absolute bottom-10 left-10 w-[400px] h-[400px] rounded-full blur-[130px] pointer-events-none"
        style={{ background: 'rgba(29,78,216,0.18)' }}
      />
      <div
        className="absolute left-0 right-0 h-[2px] bacis-scanline pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.45) 35%, rgba(255,255,255,0.8) 50%, rgba(37,99,235,0.45) 65%, transparent 100%)',
        }}
      />

      {/* 1. PORTAL BACIS OS Top Command Bar */}
      <div className="relative z-10 bg-gradient-to-r from-[#071127]/95 via-[#050b18]/95 to-black/95 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-4 sm:p-6 shadow-[0_18px_50px_-14px_rgba(37,99,235,0.45)] mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bacis-header-drop">
        
        {/* Left: Emblema GB + PORTAL BACIS + Saludo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-14 rounded-2xl bg-gradient-to-b from-blue-950 to-black p-1.5 border border-blue-400/50 shadow-[0_0_24px_rgba(37,99,235,0.45)] flex items-center justify-center">
              <BacisLogoEmblem className="w-14 h-12" showGlow={false} />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-[#02050b] shadow-[0_0_10px_#3b82f6] animate-pulse" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-blue-600/20 text-blue-200 text-[10px] font-black tracking-[0.2em] px-2.5 py-0.5 rounded-full border border-blue-400/40 uppercase font-mono">
                PORTAL BACIS OS
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-slate-300">
                <Wifi className="w-3.5 h-3.5 text-blue-400" /> EN LÍNEA
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-slate-300">
                <BatteryCharging className="w-3.5 h-3.5 text-white" /> 100%
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 flex items-center gap-2">
              <span>Bienvenido, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-200 to-white">{userName}</span></span>
            </h1>

            <p className="text-xs text-slate-400 capitalize mt-0.5">
              {dateStr} · Grupo Minero Bacís S.A. de C.V.
            </p>
          </div>
        </div>

        {/* Right: Reloj + Perfil */}
        <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto justify-between lg:justify-end">
          <div className="text-left lg:text-right font-mono">
            <div className="text-2xl sm:text-3xl font-black tracking-wider text-white drop-shadow-[0_0_14px_rgba(37,99,235,0.65)]">
              {time || '00:00:00 AM'}
            </div>
            <div className="text-[10px] text-blue-300 uppercase tracking-widest mt-0.5 flex items-center lg:justify-end gap-1">
              <Radio className="w-3 h-3 text-blue-400 animate-pulse" /> Sincronización Minera Activa
            </div>
          </div>

          <div className="bg-black/80 px-4 py-2 rounded-2xl border border-blue-500/30 text-left">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Perfil Asignado</span>
            <span className="text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-1 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-white fill-blue-400" /> {userRole}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Buscador & Dock de Categorías en Azul / Blanco / Negro */}
      <div className="relative z-10 space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar portal o módulo operativo..."
              className="bacis-portal-input w-full bg-black/85 border border-blue-500/30 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 shadow-xl transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-300 hover:text-white bg-blue-950 px-2 py-0.5 rounded-lg border border-blue-500/30">
                Limpiar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-black/70 px-4 py-2.5 rounded-2xl border border-white/10">
            <LayoutGrid className="w-4 h-4 text-blue-400" />
            <span>Portales Disponibles: <strong className="text-white font-black">{finalFilteredApps.length}</strong></span>
          </div>
        </div>

        {/* Category Tabs Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
          {[
            { id: 'all', label: 'Todos los Portales', icon: LayoutGrid },
            { id: 'rh', label: 'Capital Humano & RH', icon: Users },
            { id: 'medico', label: 'Clínica Médica', icon: Stethoscope },
            { id: 'logistica', label: 'Logística & Choferes', icon: Truck },
            { id: 'documentos', label: 'Documentos', icon: Files },
            { id: 'sistema', label: 'Sistema', icon: Settings },
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any)
                  setAnimCycle((c) => c + 1)
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shrink-0 border cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_22px_rgba(37,99,235,0.55)]' 
                    : 'bg-black/75 text-slate-400 border-white/10 hover:bg-blue-950/60 hover:text-white hover:border-blue-500/40'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Grid Cinético Rápido de Portales Internos (Azul · Blanco · Negro) */}
      <div className="relative z-10">
        {finalFilteredApps.length === 0 ? (
          <div className="bg-black/60 border-2 border-dashed border-blue-500/30 rounded-3xl p-12 text-center max-w-md mx-auto my-8">
            <SlidersHorizontal className="w-12 h-12 text-blue-400 mx-auto mb-3 animate-bounce" />
            <h3 className="text-base font-black text-white">No se encontraron portales</h3>
            <p className="text-xs text-slate-400 mt-1">No hay herramientas coincidentes con tu búsqueda o tu rol actual ({userRole}).</p>
            <button 
              onClick={() => { setSearchTerm(''); setActiveTab('all'); setAnimCycle((c) => c + 1) }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-500 transition-all cursor-pointer"
            >
              Mostrar todos mis portales
            </button>
          </div>
        ) : (
          <div key={animCycle} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {finalFilteredApps.map((app, idx) => {
              const flyClass = `bacis-tile-in-${idx % 9}`
              const staggerMs = Math.min(idx * 38, 420)
              const iconId: PortalIconId = APP_ICON_MAP[app.id] || 'catalogos'

              return (
                <Link
                  key={app.id}
                  href={app.href}
                  style={{ animationDelay: `${staggerMs}ms` }}
                  className={`group relative bg-gradient-to-b from-[#081229]/95 via-[#050a16]/95 to-black/95 backdrop-blur-xl border border-white/15 hover:border-blue-400 rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_40px_-10px_rgba(37,99,235,0.5)] flex flex-col items-center text-center justify-between overflow-hidden ${flyClass}`}
                >
                  {/* Barrido metálico azul-blanco al aterrizar */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                    <div
                      className="w-1/2 h-full bacis-tile-sheen"
                      style={{
                        animationDelay: `${staggerMs + 340}ms`,
                        background:
                          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 50%, rgba(56,189,248,0.22) 70%, transparent 100%)',
                      }}
                    />
                  </div>

                  {/* Línea superior azul Bacís */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-white opacity-40 group-hover:opacity-100 transition-opacity" />

                  {app.badge && (
                    <span className="relative z-10 text-[9px] font-mono font-black tracking-widest bg-black/80 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-500/30 uppercase group-hover:bg-white group-hover:text-black group-hover:border-white transition-colors self-end">
                      {app.badge}
                    </span>
                  )}

                  <div className="relative z-10 flex flex-col items-center space-y-3 my-2">
                    <div className="transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                      <PortalAppIcon id={iconId} className="w-16 h-16 sm:w-20 sm:h-20" />
                    </div>

                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-blue-200 transition-colors tracking-tight">
                        {app.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 group-hover:text-slate-300 mt-1 leading-snug line-clamp-2">
                        {app.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="relative z-10 w-full mt-3 pt-2.5 border-t border-white/10 flex items-center justify-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-wider text-blue-400 group-hover:text-white transition-colors">
                    <span>Abrir</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Dock Flotante Inferior PORTAL BACIS */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-2xl border border-blue-500/35 rounded-full px-6 py-3 shadow-[0_12px_40px_rgba(37,99,235,0.45)] flex items-center gap-6 text-xs text-slate-300">
        <Link href="/inicio" className="flex items-center gap-1.5 text-white font-black hover:text-blue-300 transition-colors">
          <Sparkles className="w-4 h-4 text-blue-400" /> <span>Portal Bacís</span>
        </Link>
        <div className="w-px h-4 bg-white/15" />
        <Link href="/mi-perfil" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <User className="w-4 h-4 text-blue-400" /> <span>Mi Perfil</span>
        </Link>
        <div className="w-px h-4 bg-white/15" />
        <a href="/" onClick={() => localStorage.clear()} className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
          <LogOut className="w-4 h-4 text-blue-400" /> <span>Salir</span>
        </a>
      </div>

    </div>
  )
}
