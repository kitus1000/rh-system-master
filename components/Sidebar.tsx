'use client'

import { useState, useEffect } from 'react'
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
    QrCode
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/components/AuthProvider'

const navigationGroups = [
    {
        title: "Mi Cuenta",
        colorClass: "text-zinc-400",
        bgClass: "bg-zinc-800",
        isCollapsible: false,
        items: [
            { name: 'Mi Perfil', href: '/mi-perfil', icon: UserCircle, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Médico', 'Jefe Médico', 'Recursos Humanos', 'Sistemas', 'Chofer', 'Encargado de Campamento y Comedor'] },
            { name: '🚌 Bitácora de Rutas Choferes', href: '/logistica/choferes', icon: Bus, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Recursos Humanos', 'Chofer', 'Sistemas', 'Encargado de Campamento y Comedor'] },
            { name: 'Chat y Muro', href: '/chat', icon: MessageCircle, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Recursos Humanos', 'Sistemas'] },
        ]
    },
    {
        title: "Capital Humano",
        icon: Users,
        colorClass: "text-amber-500",
        bgClass: "bg-amber-500",
        isCollapsible: true,
        defaultExpanded: true,
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Empleados', href: '/empleados', icon: Users, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Credenciales QR', href: '/empleados/credenciales', icon: QrCode, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Recursos Humanos'] },
            { name: 'Solicitudes', href: '/solicitudes', icon: FileText, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Autorizaciones', href: '/autorizaciones', icon: CheckSquare, roles: ['Administrativo', 'Superintendente'] },
            { name: 'Calendario', href: '/calendario', icon: Calendar, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Pre-Nómina', href: '/reportes/prenomina', icon: ClipboardList, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    },
    {
        title: "Clínica Médica",
        icon: Stethoscope,
        colorClass: "text-rose-500",
        bgClass: "bg-rose-500",
        isCollapsible: true,
        defaultExpanded: true,
        items: [
            { name: 'Consultas Médicas', href: '/medico/consultas', icon: Stethoscope, roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos'] },
            { name: 'Pacientes', href: '/medico/pacientes', icon: Heart, roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos'] },
            { name: 'Inventario Farmacia', href: '/medico/inventario', icon: Pill, roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos'] },
            { name: 'Clínicas Externas', href: '/medico/clinicas', icon: Hospital, roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos'] },
            { name: 'Pases Médicos', href: '/medico/pases', icon: FileText, roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos'] },
            { name: 'Pase de Hotel', href: '/medico/hotel', icon: Building, roles: ['Administrativo', 'Médico', 'Jefe Médico', 'Recursos Humanos'] },
            { name: 'Portal de Ausencias', href: '/consulta-medica', icon: ClipboardList, roles: ['Administrativo', 'Administrador', 'Médico', 'Jefe Médico', 'Jefe de Departamento', 'Superintendente', 'Supervisor', 'Recursos Humanos'] },
        ]
    },
    {
        title: "Movilidad",
        icon: Bus,
        colorClass: "text-cyan-500",
        bgClass: "bg-cyan-500",
        isCollapsible: true,
        defaultExpanded: true,
        items: [
            { name: '🚌 Portal Choferes & Pasaje QR', href: '/logistica/choferes', icon: Car, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Recursos Humanos', 'Chofer', 'Sistemas', 'Supervisor', 'Encargado de Campamento y Comedor'] },
            { name: '📑 Bitácora de Pasajeros QR', href: '/logistica/choferes/bitacora', icon: Users, roles: ['Recursos Humanos', 'Administrativo', 'Superintendente', 'Jefe de Departamento', 'Chofer', 'Sistemas', 'Supervisor'] },
            { name: '📅 Viajes Programados', href: '/transporte', icon: Bus, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Recursos Humanos', 'Chofer', 'Sistemas', 'Supervisor'] },
            { name: '🛠️ Control de Flota y Logística', href: '/logistica', icon: Truck, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Recursos Humanos', 'Sistemas', 'Chofer'] },
            { name: '📊 Supervisión y Reportes', href: '/logistica/reportes', icon: ClipboardList, roles: ['Recursos Humanos', 'Administrativo', 'Superintendente', 'Jefe de Departamento', 'Sistemas', 'Chofer'] }
        ]
    },
    {
        title: "Operaciones",
        icon: Settings,
        colorClass: "text-emerald-500",
        bgClass: "bg-emerald-500",
        isCollapsible: true,
        defaultExpanded: true,
        items: [
            { name: 'Campamentos', href: '/campamentos', icon: Home, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento', 'Encargado de Campamento y Comedor'] },
            { name: 'Comedor', href: '/comedor', icon: Coffee, roles: ['Administrativo', 'Superintendente', 'Encargado de Campamento y Comedor'] },
            { name: 'Evaluaciones', href: '/evaluaciones', icon: Award, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Documentos', href: '/documentos', icon: Files, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    },
    {
        title: "Administración",
        icon: Settings,
        colorClass: "text-purple-500",
        bgClass: "bg-purple-500",
        isCollapsible: true,
        defaultExpanded: false,
        items: [
            { name: 'Catálogos', href: '/catalogos', icon: Library, roles: ['Administrativo', 'Sistemas'] },
            { name: 'Usuarios', href: '/usuarios', icon: Shield, roles: ['Administrativo', 'Sistemas'] },
            { name: 'Configuración', href: '/configuracion', icon: Settings, roles: ['Administrativo', 'Sistemas'] },
            { name: 'Acerca de', href: '/acerca-de', icon: Info, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    }
]

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
    mobileOpen?: boolean
    onCloseMobile?: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
    const pathname = usePathname()
    const { profile, hasAccess } = useAuth()
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [mounted, setMounted] = useState(false)
    const [companyInfo, setCompanyInfo] = useState<{ nombre: string, logo: string | null }>({ nombre: 'El Expediente', logo: null })

    useEffect(() => {
        setMounted(true)
        fetchCompanyInfo()
        const saved = localStorage.getItem('sidebar_groups_state')
        if (saved) {
            try {
                setExpandedGroups(JSON.parse(saved))
            } catch (e) {
                initDefaultGroups()
            }
        } else {
            initDefaultGroups()
        }
    }, [])

    const initDefaultGroups = () => {
        const defaultState: Record<string, boolean> = {}
        navigationGroups.forEach(g => {
            if (g.isCollapsible) {
                defaultState[g.title] = Boolean(g.defaultExpanded)
            }
        })
        setExpandedGroups(defaultState)
        localStorage.setItem('sidebar_groups_state', JSON.stringify(defaultState))
    }

    const fetchCompanyInfo = async () => {
        const { data } = await supabase.from('configuracion_empresa').select('nombre_empresa, logo_base64').single()
        if (data) {
            setCompanyInfo({
                nombre: data.nombre_empresa || 'El Expediente',
                logo: data.logo_base64 || null
            })
        }
    }

    const toggleGroup = (groupTitle: string) => {
        const nextState = { ...expandedGroups, [groupTitle]: !expandedGroups[groupTitle] }
        setExpandedGroups(nextState)
        localStorage.setItem('sidebar_groups_state', JSON.stringify(nextState))
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
    }

    if (!mounted) {
        return null
    }

    return (
        <div className={cn(
            "flex h-screen flex-col bg-zinc-950 text-zinc-300 border-r border-zinc-900 transition-all duration-300 relative z-50",
            "fixed inset-y-0 left-0 md:relative",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            collapsed ? "md:w-20 w-64" : "w-64"
        )}>
            <button
                onClick={onToggle}
                className="hidden md:flex absolute -right-3 top-24 bg-zinc-900 hover:bg-amber-500 hover:text-black border border-zinc-800 text-zinc-400 p-1 rounded-full shadow-md z-45 transition-colors duration-200 items-center justify-center"
                title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            <div className={cn(
                "flex h-20 items-center border-b border-zinc-900 bg-zinc-950 overflow-hidden transition-all",
                collapsed ? "justify-center px-2" : "justify-between px-6"
            )}>
                <div className="flex items-center space-x-2.5">
                    {companyInfo.logo ? (
                        <img 
                            src={companyInfo.logo} 
                            alt="Logo" 
                            className={cn(
                                "object-contain shrink-0 transition-all duration-300",
                                collapsed ? "h-10 w-10" : "h-12 w-auto max-w-[150px]"
                            )} 
                        />
                    ) : (
                        <>
                            <div className="h-9 w-9 rounded-lg bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 shrink-0">
                                <FolderLock className="w-5 h-5 animate-pulse" />
                            </div>
                            {!collapsed && (
                                <div className="flex flex-col animate-in fade-in duration-300">
                                    <h1 className="text-[10px] font-black tracking-tighter text-zinc-500 uppercase italic leading-tight">{companyInfo.nombre.split(' ')[0] || 'El'}</h1>
                                    <h1 className="text-base font-black tracking-widest text-amber-500 uppercase leading-none -mt-1">{companyInfo.nombre.split(' ').slice(1).join(' ') || 'Expediente'}</h1>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
                <nav className="space-y-4 px-3">
                    {navigationGroups.map((group, idx) => {
                        const availableItems = group.items.filter(item => !item.roles || hasAccess(item.roles))
                        
                        if (availableItems.length === 0) return null

                        const isExpanded = group.isCollapsible ? expandedGroups[group.title] : true
                        const GroupIcon = group.icon

                        return (
                            <div key={idx} className="space-y-1">
                                {!collapsed ? (
                                    group.isCollapsible ? (
                                        <button
                                            onClick={() => toggleGroup(group.title)}
                                            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-900/50 rounded-lg transition-colors group/header"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <div className={cn("w-2 h-2 rounded-full", group.bgClass)} />
                                                {GroupIcon && <GroupIcon className={cn("w-4 h-4", group.colorClass)} />}
                                                <span className={cn("text-[10px] font-black uppercase tracking-widest", group.colorClass)}>
                                                    {group.title}
                                                </span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-3.5 h-3.5 text-zinc-500 group-hover/header:text-zinc-300 transition-transform" />
                                            ) : (
                                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover/header:text-zinc-300 transition-transform" />
                                            )}
                                        </button>
                                    ) : (
                                        <div className="px-3 py-1.5 flex items-center space-x-2">
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest", group.colorClass)}>
                                                {group.title}
                                            </span>
                                        </div>
                                    )
                                ) : (
                                    group.isCollapsible ? (
                                        <div className="w-full flex justify-center mb-1 mt-2" title={group.title}>
                                            <div className="w-6 h-px bg-zinc-800/50"></div>
                                        </div>
                                    ) : null
                                )}
                                
                                <div className={cn(
                                    "space-y-1 overflow-hidden transition-all duration-300",
                                    !collapsed && group.isCollapsible && !isExpanded ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
                                )}>
                                    {availableItems.map((item) => {
                                        const isActive = pathname === item.href
                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                onClick={() => {
                                                    if (onCloseMobile) onCloseMobile()
                                                }}
                                                title={collapsed ? item.name : undefined}
                                                className={cn(
                                                    'group flex items-center rounded-lg py-2.5 transition-all duration-200 border-l-2',
                                                    collapsed ? 'justify-center px-0' : 'px-3',
                                                    isActive
                                                        ? 'border-amber-500 bg-zinc-900/60 text-white'
                                                        : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-800'
                                                )}
                                            >
                                                <item.icon
                                                    className={cn(
                                                        'h-5 w-5 flex-shrink-0 transition-colors',
                                                        collapsed ? 'md:mr-0 mr-3' : 'mr-3',
                                                        isActive ? 'text-amber-500' : 'text-zinc-500 group-hover:text-amber-500'
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                <span className={cn(
                                                    "animate-in fade-in duration-200 text-sm font-semibold whitespace-nowrap",
                                                    collapsed ? "md:hidden block" : "block"
                                                )}>
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

            <div className="border-t border-zinc-900 p-3 bg-zinc-950">
                <button
                    onClick={handleLogout}
                    title={collapsed ? "Cerrar Sesión" : undefined}
                    className={cn(
                        "group flex items-center rounded-lg py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-colors w-full",
                        collapsed ? "justify-center px-0" : "px-3"
                    )}
                >
                    <LogOut className={cn(
                        "h-5 w-5 text-zinc-500 group-hover:text-rose-500 transition-colors",
                        collapsed ? "" : "mr-3"
                    )} />
                    {!collapsed && <span className="text-sm font-semibold">Cerrar Sesión</span>}
                </button>
            </div>
            

        </div>
    )
}
