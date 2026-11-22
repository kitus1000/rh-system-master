'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { AuthProvider } from '@/components/AuthProvider'
import {
  Menu,
  LayoutDashboard,
  Sparkles,
  Building,
  Sun,
  Moon,
  Users,
  Layers,
  Home,
  FolderLock,
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<'bacis' | 'dark'>('bacis')
  const pathname = usePathname()

  useEffect(() => {
    const savedTheme = localStorage.getItem('bacis_ui_theme') as 'bacis' | 'dark' | null
    const initial = savedTheme === 'dark' ? 'dark' : 'bacis'
    setThemeMode(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  const handleSetTheme = (nextTheme: 'bacis' | 'dark') => {
    setThemeMode(nextTheme)
    localStorage.setItem('bacis_ui_theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    window.dispatchEvent(new CustomEvent('bacis-theme-change', { detail: nextTheme }))
  }

  return (
    <AuthProvider>
      <div
        data-theme={themeMode}
        className="app-shell-bg flex h-screen w-full max-w-[100vw] overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white transition-colors duration-300"
      >
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="print:!hidden print:hidden fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
          {/* BARRA SUPERIOR GLOBAL: CONEXIONES RÁPIDAS + SELECTOR DE 2 VISTAS (BACÍS INSTITUCIONAL vs MODO OSCURO) */}
          <header
            className={`print:!hidden print:hidden flex items-center justify-between px-3.5 sm:px-6 py-2.5 border-b shrink-0 z-30 shadow-xs transition-colors duration-300 ${
              themeMode === 'dark'
                ? 'bg-zinc-950/95 text-white border-zinc-800'
                : 'bg-zinc-950 text-white border-amber-500/30'
            }`}
          >
            {/* Izquierda: Menú Móvil + Accesos Rápidos de Ecosistema Conectado */}
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-1 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors shrink-0"
                aria-label="Abrir menú de navegación"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link href="/dashboard" className="md:hidden flex flex-col shrink-0 mr-1">
                <span className="text-[9px] font-black tracking-tighter text-zinc-400 uppercase italic leading-none">
                  GRUPO MINERO
                </span>
                <span className="text-xs font-black tracking-widest text-amber-400 uppercase leading-none">
                  BACÍS
                </span>
              </Link>

              {/* Píldoras de Navegación Fluida */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-black">
                <Link
                  href="/dashboard"
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    pathname === '/dashboard'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Mapa General</span>
                </Link>
                <Link
                  href="/empleados"
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    pathname === '/empleados'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Personal (Semanal/Quincenal)</span>
                </Link>
                <Link
                  href="/movimientos-sindicato"
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    pathname === '/movimientos-sindicato'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Escalafón y Vacantes</span>
                </Link>
                <Link
                  href="/campamentos"
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    pathname === '/campamentos'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Campamentos 3D</span>
                </Link>
                <Link
                  href="/mi-departamento"
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    pathname === '/mi-departamento'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Mi Área</span>
                </Link>
                <Link
                  href="/empleados/duplicados"
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    pathname === '/empleados/duplicados'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Depurar Duplicados</span>
                </Link>
              </div>
            </div>

            {/* Derecha: CONMUTADOR DE LAS 2 VISTAS (MODO BACÍS vs MODO OSCURO) */}
            <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => handleSetTheme('bacis')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === 'bacis'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Vista Institucional con los Colores de Grupo Minero Bacís (Oro, Cobre y Marfil)"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Vista Bacís</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-gradient-to-r from-indigo-600 to-zinc-800 text-amber-300 border border-amber-500/40 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Modo Oscuro Minero Subterráneo (Alta legibilidad nocturna)"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Modo Oscuro</span>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 transition-all duration-300 print:overflow-visible print:p-0 print:m-0">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  )
}
