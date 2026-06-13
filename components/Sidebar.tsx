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
    Activity,
    ClipboardList,
    FolderLock,
    Info,
    Library,
    Home,
    Award,
    ChevronLeft,
    ChevronRight,
    Layers,
    Coffee,
    Shield,
    UserCircle,
    MessageCircle,
    Truck,
    Heart,
    Stethoscope,
    Pill,
    Hospital,
    ShieldCheck
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/components/AuthProvider'

const navigationGroups = [
    {
        title: "Principal",
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Chat y Muro', href: '/chat', icon: MessageCircle, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Mi Perfil', href: '/mi-perfil', icon: UserCircle, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    },
    {
        title: "Capital Humano",
        items: [
            { name: 'Empleados', href: '/empleados', icon: Users, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Solicitudes', href: '/solicitudes', icon: FileText, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Autorizaciones', href: '/autorizaciones', icon: CheckSquare, roles: ['Administrativo', 'Superintendente'] },
            { name: 'Calendario', href: '/calendario', icon: Calendar, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Pre-Nómina', href: '/reportes/prenomina', icon: ClipboardList, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    },
    {
        title: "Operaciones",
        items: [
            { name: 'Campamentos', href: '/campamentos', icon: Home, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Control Accesos', href: '/logistica/accesos', icon: ShieldCheck, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Logística', href: '/logistica', icon: Truck, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Transporte', href: '/transporte', icon: Truck },
            { name: 'Portal Choferes', href: '/logistica/choferes', icon: Truck, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Evaluaciones', href: '/evaluaciones', icon: Award, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
            { name: 'Comedor', href: '/comedor', icon: Coffee, roles: ['Administrativo', 'Superintendente'] },
            { name: 'Documentos', href: '/documentos', icon: Files, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    },
    {
        title: "Logística Nube",
        items: [
            { name: 'Supervisión', href: '/logistica/reportes', icon: ClipboardList, roles: ['Recursos Humanos', 'Administrativo', 'Superintendente', 'Jefe de Departamento', 'Sistemas'] }
        ]
    },
    {
        title: "Administración",
        items: [
            { name: 'Catálogos', href: '/catalogos', icon: Library, roles: ['Administrativo'] },
            { name: 'Usuarios', href: '/usuarios', icon: Shield, roles: ['Administrativo'] },
            { name: 'Configuración', href: '/configuracion', icon: Settings, roles: ['Administrativo'] },
            { name: 'Acerca de', href: '/acerca-de', icon: Info, roles: ['Administrativo', 'Superintendente', 'Jefe de Departamento'] },
        ]
    },
    {
        title: "Módulo Médico",
        items: [
            { name: 'Consultas Médicas', href: '/medico/consultas', icon: Stethoscope, roles: ['Administrativo', 'Médico'] },
            { name: 'Pacientes', href: '/medico/pacientes', icon: Heart, roles: ['Administrativo', 'Médico'] },
            { name: 'Inventario', href: '/medico/inventario', icon: Pill, roles: ['Administrativo', 'Médico'] },
            { name: 'Clínicas y Pases', href: '/medico/clinicas', icon: Hospital, roles: ['Administrativo', 'Médico'] },
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

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    return (
        <div className={cn(
            "flex h-screen flex-col bg-zinc-950 text-zinc-300 border-r border-zinc-900 transition-all duration-300 relative z-50",
            // Mobile positioning: fixed and transforms
            "fixed inset-y-0 left-0 md:relative",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            // Desktop width
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
                    <div className="h-9 w-9 rounded-lg bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 shrink-0">
                        <FolderLock className="w-5 h-5 animate-pulse" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col animate-in fade-in duration-300">
                            <h1 className="text-[10px] font-black tracking-tighter text-zinc-500 uppercase italic leading-tight">El</h1>
                            <h1 className="text-base font-black tracking-widest text-amber-500 uppercase leading-none -mt-1">Expediente</h1>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-6 px-3">
                    {navigationGroups.map((group, idx) => {
                        // Filter items the user has access to
                        const availableItems = group.items.filter(item => !item.roles || hasAccess(item.roles))
                        
                        if (availableItems.length === 0) return null

                        return (
                            <div key={idx} className="space-y-1.5">
                                {!collapsed && (
                                    <p className="px-3 text-[10px] font-black text-zinc-500/70 uppercase tracking-widest mb-2 border-b border-zinc-900/50 pb-1 inline-block">
                                        {group.title}
                                    </p>
                                )}
                                {collapsed && (
                                    <div className="w-full flex justify-center mb-2">
                                        <div className="w-6 h-px bg-zinc-800/50"></div>
                                    </div>
                                )}
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
                                                "animate-in fade-in duration-200 text-sm font-semibold",
                                                collapsed ? "md:hidden block" : "block"
                                            )}>
                                                {item.name}
                                            </span>
                                        </Link>
                                    )
                                })}
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
