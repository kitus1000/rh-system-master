'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import {
  Users,
  FileText,
  Settings,
  LayoutDashboard,
  Calendar,
  Files,
  LogOut,
  CheckSquare,
  ClipboardList,
  FolderLock,
  Info,
  Library,
  Home,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Coffee,
  Shield,
  UserCircle,
  MessageCircle,
  Truck,
  Bus,
  Car,
  Heart,
  Stethoscope,
  Pill,
  Hospital,
  Building,
  QrCode,
  HardHat,
  ShieldCheck,
  Layers,
  Sparkles,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/components/AuthProvider'

const ALL_RH_AND_ADMIN_ROLES = [
  'Administrativo',
  'Administrador',
  'Recursos Humanos',
  'Jefe de RH Unidad',
  'Superintendente de RH Corporativo',
  'Sistemas',
]

const ALL_LEADERS_AND_RH = [
  ...ALL_RH_AND_ADMIN_ROLES,
  'Superintendente',
  'Jefe de Departamento',
  'Supervisor',
]

const navigationGroups = [
  {
    title: '1. Mando y Mi Área',
    icon: LayoutDashboard,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-400',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: 'Panel General (Mapa)',
        href: '/dashboard',
        keywords: 'inicio dashboard resumen mapa flujos',
        icon: LayoutDashboard,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🏢 Mi Departamento (Área)',
        href: '/mi-departamento',
        keywords: 'area contratistas pases medicos acompañantes plantilla',
        icon: Building,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🧹 Depurar Duplicados / Deptos',
        href: '/empleados/duplicados',
        keywords: 'duplicados rh recursos humanos nombres invertidos jose arana unificar limpiar',
        icon: Sparkles,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🔗 Centro Integrado RH 360°',
        href: '/integracion-rh',
        keywords: 'integracion sincronizar medico choferes comedor',
        icon: Layers,
        roles: ALL_RH_AND_ADMIN_ROLES,
      },
      {
        name: '💬 Chat y Muro Interno',
        href: '/chat',
        keywords: 'chat mensajes avisos muro',
        icon: MessageCircle,
        roles: [...ALL_LEADERS_AND_RH, 'Sindicato'],
      },
      {
        name: '👤 Mi Perfil',
        href: '/mi-perfil',
        keywords: 'perfil cuenta contraseña usuario',
        icon: UserCircle,
        roles: [
          ...ALL_LEADERS_AND_RH,
          'Médico',
          'Jefe Médico',
          'Sindicato',
          'Chofer',
          'Encargado de Campamento y Comedor',
          'Contratista',
          'Seguridad Industrial',
          'Seguridad',
          'Caseta',
          'Seguridad Patrimonial',
        ],
      },
    ],
  },
  {
    title: '2. Personal y Sindicato',
    icon: Users,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: 'Directorio de Empleados',
        href: '/empleados',
        keywords: 'trabajadores altas bajas padron excel',
        icon: Users,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🪪 Credenciales QR Personal',
        href: '/empleados/credenciales',
        keywords: 'credenciales gafetes imprimir qr empleados',
        icon: QrCode,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🔀 Escalafón, Vacantes y Sindicato',
        href: '/movimientos-sindicato',
        keywords: 'sindicato vacantes escalafon convocatoria oficio arrastrar movimientos semanales quincenales',
        icon: Layers,
        roles: [...ALL_LEADERS_AND_RH, 'Sindicato'],
      },
      {
        name: '📝 Solicitudes y Permisos',
        href: '/solicitudes',
        keywords: 'vacaciones permisos solicitudes ausencias',
        icon: FileText,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '✅ Bandeja Autorizaciones',
        href: '/autorizaciones',
        keywords: 'aprobar autorizar firmas pendientes',
        icon: CheckSquare,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '📊 Pre-Nómina y Asistencia',
        href: '/reportes/prenomina',
        keywords: 'prenomina nomina asistencia incidencias',
        icon: ClipboardList,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '📅 Calendario Operativo',
        href: '/calendario',
        keywords: 'calendario descansos turnos',
        icon: Calendar,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '📄 Documentos y Contratos',
        href: '/documentos',
        keywords: 'contratos plantillas cartas documentos',
        icon: Files,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🏅 Evaluaciones Desempeño',
        href: '/evaluaciones',
        keywords: 'evaluaciones calificaciones desempeño',
        icon: Award,
        roles: ALL_LEADERS_AND_RH,
      },
    ],
  },
  {
    title: '3. Inducción, Contratistas y Caseta',
    icon: HardHat,
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: '🛡️ 1° Seguridad (Inducciones)',
        href: '/seguridad',
        keywords: 'induccion seguridad industrial cursos alta',
        icon: ShieldCheck,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Seguridad Industrial', 'Seguridad', 'Superintendente', 'Jefe de Departamento'],
      },
      {
        name: '🏗️ 2° Gestión Contratistas',
        href: '/contratistas',
        keywords: 'contratistas empresas imss sua sat gafetes prorrogas',
        icon: HardHat,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '👷 Portal Externo Contratista',
        href: '/contratistas-portal',
        keywords: 'portal contratista subir documentos',
        icon: Users,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Contratista'],
      },
      {
        name: '🚧 3° Caseta (Escáner QR)',
        href: '/caseta',
        keywords: 'caseta vigilancia entradas salidas qr acceso',
        icon: QrCode,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Caseta', 'Seguridad Patrimonial'],
      },
    ],
  },
  {
    title: '4. Campamento, Lockers y Comedor',
    icon: Home,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: '🛏️ Campamentos y Camas',
        href: '/campamentos',
        keywords: 'campamentos cuartos habitaciones camas hospedaje',
        icon: Home,
        roles: [...ALL_LEADERS_AND_RH, 'Encargado de Campamento y Comedor'],
      },
      {
        name: '🔐 Lockers y Fichas QR',
        href: '/lockers',
        keywords: 'lockers casilleros candados llaves fichas qr planograma',
        icon: FolderLock,
        roles: ALL_LEADERS_AND_RH,
      },
      {
        name: '🍽️ Comedor y Platillos',
        href: '/comedor',
        keywords: 'comedor comidas menu platillos',
        icon: Coffee,
        roles: [...ALL_LEADERS_AND_RH, 'Encargado de Campamento y Comedor'],
      },
    ],
  },
  {
    title: '5. Clínica Médica y Salud',
    icon: Stethoscope,
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-500',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: '🩺 Consultas Médicas',
        href: '/medico/consultas',
        keywords: 'consultas doctor recetas medico',
        icon: Stethoscope,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Médico', 'Jefe Médico'],
      },
      {
        name: '🚑 Pases Médicos',
        href: '/medico/pases',
        keywords: 'pases medicos traslados acompañantes',
        icon: FileText,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Médico', 'Jefe Médico'],
      },
      {
        name: '🏨 Pase de Hotel',
        href: '/medico/hotel',
        keywords: 'hotel hospedaje medico durango',
        icon: Building,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Médico', 'Jefe Médico'],
      },
      {
        name: '👨‍👩‍👧‍👦 Pacientes y Familias',
        href: '/medico/pacientes',
        keywords: 'pacientes beneficiarios familias hijos esposas',
        icon: Heart,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Médico', 'Jefe Médico'],
      },
      {
        name: '💊 Inventario Farmacia',
        href: '/medico/inventario',
        keywords: 'farmacia medicamentos medicinas stock',
        icon: Pill,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Médico', 'Jefe Médico'],
      },
      {
        name: '🏥 Clínicas Externas',
        href: '/medico/clinicas',
        keywords: 'clinicas hospitales imss',
        icon: Hospital,
        roles: [...ALL_RH_AND_ADMIN_ROLES, 'Médico', 'Jefe Médico'],
      },
      {
        name: '📋 Portal de Ausencias',
        href: '/consulta-medica',
        keywords: 'ausencias incapacidades',
        icon: ClipboardList,
        roles: [...ALL_LEADERS_AND_RH, 'Médico', 'Jefe Médico'],
      },
    ],
  },
  {
    title: '6. Transporte y Logística',
    icon: Bus,
    colorClass: 'text-cyan-500',
    bgClass: 'bg-cyan-500',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: '📅 Viajes Programados',
        href: '/transporte',
        keywords: 'viajes camiones rutas transporte',
        icon: Bus,
        roles: [...ALL_LEADERS_AND_RH, 'Chofer'],
      },
      {
        name: '🚌 Portal Choferes & Pasaje QR',
        href: '/logistica/choferes',
        keywords: 'choferes escaner pasajeros camion',
        icon: Car,
        roles: [...ALL_LEADERS_AND_RH, 'Chofer'],
      },
      {
        name: '📑 Bitácora de Pasajeros QR',
        href: '/logistica/choferes/bitacora',
        keywords: 'bitacora pasajeros lista',
        icon: Users,
        roles: [...ALL_LEADERS_AND_RH, 'Chofer'],
      },
      {
        name: '🛠️ Control de Flota y Logística',
        href: '/logistica',
        keywords: 'flota vehiculos mantenimiento camiones',
        icon: Truck,
        roles: [...ALL_LEADERS_AND_RH, 'Chofer'],
      },
      {
        name: '📊 Supervisión y Reportes',
        href: '/logistica/reportes',
        keywords: 'reportes logistica kilometraje',
        icon: ClipboardList,
        roles: [...ALL_LEADERS_AND_RH, 'Chofer'],
      },
    ],
  },
  {
    title: '7. Catálogos y Administración',
    icon: Settings,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-400',
    isCollapsible: true,
    defaultExpanded: true,
    items: [
      {
        name: '📚 Catálogos (Deptos y Roles)',
        href: '/catalogos',
        keywords: 'catalogos departamentos roles unidades causas baja',
        icon: Library,
        roles: ALL_RH_AND_ADMIN_ROLES,
      },
      {
        name: '🔐 Usuarios y Accesos',
        href: '/usuarios',
        keywords: 'usuarios cuentas contraseñas roles permisos',
        icon: Shield,
        roles: ALL_RH_AND_ADMIN_ROLES,
      },
      {
        name: '⚙️ Configuración Empresa',
        href: '/configuracion',
        keywords: 'configuracion logo empresa',
        icon: Settings,
        roles: ALL_RH_AND_ADMIN_ROLES,
      },
      {
        name: 'ℹ️ Acerca del Sistema',
        href: '/acerca-de',
        keywords: 'acerca version ayuda',
        icon: Info,
        roles: [...ALL_LEADERS_AND_RH, 'Sindicato'],
      },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const { hasAccess } = useAuth()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [menuSearch, setMenuSearch] = useState('')
  const [companyInfo, setCompanyInfo] = useState<{ nombre: string; logo: string | null }>({
    nombre: 'El Expediente',
    logo: null,
  })

  useEffect(() => {
    setMounted(true)
    fetchCompanyInfo()
    const saved = localStorage.getItem('sidebar_groups_state_v2')
    if (saved) {
      try {
        setExpandedGroups(JSON.parse(saved))
      } catch (_) {
        initDefaultGroups()
      }
    } else {
      initDefaultGroups()
    }
  }, [])

  const initDefaultGroups = () => {
    const defaultState: Record<string, boolean> = {}
    navigationGroups.forEach((g) => {
      if (g.isCollapsible) {
        defaultState[g.title] = Boolean(g.defaultExpanded)
      }
    })
    setExpandedGroups(defaultState)
    localStorage.setItem('sidebar_groups_state_v2', JSON.stringify(defaultState))
  }

  const fetchCompanyInfo = async () => {
    const { data } = await supabase
      .from('configuracion_empresa')
      .select('nombre_empresa, logo_base64')
      .single()
    if (data) {
      setCompanyInfo({
        nombre: data.nombre_empresa || 'El Expediente',
        logo: data.logo_base64 || null,
      })
    }
  }

  const toggleGroup = (groupTitle: string) => {
    const nextState = { ...expandedGroups, [groupTitle]: !(expandedGroups[groupTitle] ?? true) }
    setExpandedGroups(nextState)
    localStorage.setItem('sidebar_groups_state_v2', JSON.stringify(nextState))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const normalizedQuery = useMemo(() => {
    return menuSearch
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }, [menuSearch])

  if (!mounted) {
    return null
  }

  return (
    <aside
      data-sidebar="true"
      className={cn(
        'sidebar print:!hidden print:hidden flex h-screen flex-col bg-zinc-950 text-zinc-300 border-r border-zinc-900 transition-all duration-300 relative z-50 shrink-0',
        'fixed inset-y-0 left-0 md:relative',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-20 w-72' : 'w-72'
      )}
    >
      <button
        onClick={onToggle}
        className="hidden md:flex absolute -right-3 top-20 bg-zinc-900 hover:bg-amber-500 hover:text-black border border-zinc-800 text-zinc-400 p-1 rounded-full shadow-md z-45 transition-colors duration-200 items-center justify-center cursor-pointer"
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Brand Header */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-zinc-900 bg-zinc-950 overflow-hidden transition-all shrink-0',
          collapsed ? 'justify-center px-2' : 'justify-between px-5'
        )}
      >
        <Link href="/dashboard" className="flex items-center space-x-2.5">
          {companyInfo.logo ? (
            <img
              src={companyInfo.logo}
              alt="Logo"
              className={cn(
                'object-contain shrink-0 transition-all duration-300',
                collapsed ? 'h-9 w-9' : 'h-10 w-auto max-w-[140px]'
              )}
            />
          ) : (
            <>
              <div className="h-9 w-9 rounded-lg bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 shrink-0">
                <FolderLock className="w-5 h-5" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <h1 className="text-[10px] font-black tracking-tighter text-zinc-500 uppercase italic leading-tight">
                    {companyInfo.nombre.split(' ')[0] || 'El'}
                  </h1>
                  <h1 className="text-sm font-black tracking-widest text-amber-500 uppercase leading-none -mt-0.5">
                    {companyInfo.nombre.split(' ').slice(1).join(' ') || 'Expediente'}
                  </h1>
                </div>
              )}
            </>
          )}
        </Link>

        {/* Botón cerrar en móvil */}
        {mobileOpen && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Buscador Rápido de Módulos (¿A dónde ir?) */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Buscar módulo (ej. locker, rh, qr)..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white! border border-zinc-800 focus:border-amber-500 focus:outline-none"
              style={{ backgroundColor: '#18181b', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
            />
            {menuSearch && (
              <button
                onClick={() => setMenuSearch('')}
                className="absolute right-2.5 top-2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de Navegación Organizada por Flujo */}
      <div className="flex-1 overflow-y-auto py-3 custom-scrollbar">
        <nav className="space-y-3 px-2.5">
          {navigationGroups.map((group, idx) => {
            const availableItems = group.items.filter((item) => {
              const roleAllowed = !item.roles || hasAccess(item.roles)
              if (!roleAllowed) return false
              if (!normalizedQuery) return true
              const textToMatch = `${item.name} ${item.keywords || ''} ${group.title}`
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
              return normalizedQuery.split(/\s+/).every((tok) => textToMatch.includes(tok))
            })

            if (availableItems.length === 0) return null

            const isExpanded = normalizedQuery
              ? true
              : group.isCollapsible
              ? expandedGroups[group.title] ?? true
              : true
            const GroupIcon = group.icon

            return (
              <div key={idx} className="space-y-1">
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-zinc-900/60 rounded-lg transition-colors group/header cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', group.bgClass)} />
                      {GroupIcon && <GroupIcon className={cn('w-3.5 h-3.5 shrink-0', group.colorClass)} />}
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase tracking-wider truncate',
                          group.colorClass
                        )}
                      >
                        {group.title}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-zinc-500 group-hover/header:text-zinc-300 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover/header:text-zinc-300 shrink-0" />
                    )}
                  </button>
                ) : (
                  <div className="w-full flex justify-center mb-1 mt-2" title={group.title}>
                    <div className="w-6 h-px bg-zinc-800/70" />
                  </div>
                )}

                <div
                  className={cn(
                    'space-y-0.5 overflow-hidden transition-all duration-300',
                    !collapsed && group.isCollapsible && !isExpanded
                      ? 'max-h-0 opacity-0'
                      : 'max-h-[1200px] opacity-100'
                  )}
                >
                  {availableItems.map((item) => {
                    const isExact = pathname === item.href
                    const isSubRoute =
                      item.href !== '/dashboard' &&
                      item.href !== '/empleados' &&
                      pathname?.startsWith(item.href + '/')
                    const isEmpleadosRoot =
                      item.href === '/empleados' &&
                      (pathname === '/empleados' ||
                        pathname === '/empleados/nuevo' ||
                        (pathname?.startsWith('/empleados/') &&
                          !pathname.startsWith('/empleados/credenciales') &&
                          !pathname.startsWith('/empleados/duplicados')))

                    const isActive = isExact || isSubRoute || isEmpleadosRoot

                    return (
                      <Link
                        key={item.href + item.name}
                        href={item.href}
                        onClick={() => {
                          if (onCloseMobile) onCloseMobile()
                        }}
                        title={collapsed ? item.name : undefined}
                        className={cn(
                          'group flex items-center rounded-lg py-2 transition-all duration-150 border-l-2',
                          collapsed ? 'justify-center px-0' : 'px-2.5',
                          isActive
                            ? 'border-amber-500 bg-zinc-900 text-white shadow-xs'
                            : 'border-transparent text-zinc-400 hover:bg-zinc-900/70 hover:text-white hover:border-zinc-700'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            collapsed ? 'md:mr-0 mr-2.5' : 'mr-2.5',
                            isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-400'
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            'text-xs font-semibold truncate',
                            collapsed ? 'md:hidden block' : 'block'
                          )}
                        >
                          {item.name}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-900 p-2.5 bg-zinc-950 shrink-0">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Cerrar Sesión' : undefined}
          className={cn(
            'group flex items-center rounded-lg py-2 text-zinc-400 hover:text-white hover:bg-zinc-900/60 transition-colors w-full cursor-pointer',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          <LogOut
            className={cn(
              'h-4 w-4 text-zinc-500 group-hover:text-rose-500 transition-colors',
              collapsed ? '' : 'mr-2.5'
            )}
          />
          {!collapsed && <span className="text-xs font-semibold">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  )
}
