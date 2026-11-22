'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import { TEST_AUTH_LEVELS } from '@/utils/testAuthLevels'
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
  CheckSquare,
  FlaskConical,
  RotateCcw,
} from 'lucide-react'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<'bacis' | 'dark'>('bacis')
  const pathname = usePathname()
  const { testLevelId, activeTestLevel, setTestLevel } = useAuth()

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

  const isTestModeActive = testLevelId !== 'REAL_SESSION'

  return (
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
        {/* BARRA SUPERIOR GLOBAL */}
        <header
          className={`print:!hidden print:hidden flex items-center justify-between gap-2 px-3.5 sm:px-5 py-2 border-b shrink-0 z-30 shadow-xs transition-colors duration-300 ${
            themeMode === 'dark'
              ? 'bg-zinc-950/95 text-white border-zinc-800'
              : 'bg-zinc-950 text-white border-amber-500/30'
          }`}
        >
          {/* Izquierda: Menú Móvil + Píldoras de Navegación Fluida */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
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

            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-black">
              <Link
                href="/dashboard"
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  pathname === '/dashboard'
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Mapa</span>
              </Link>
              <Link
                href="/autorizaciones"
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  pathname === '/autorizaciones'
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Autorizaciones Multi-Nivel</span>
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
                <span>Personal</span>
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
                <span>Escalafón</span>
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
                <span>Duplicados</span>
              </Link>
            </div>
          </div>

          {/* Derecha: CONMUTADOR MODO PRUEBA DE NIVEL + SELECTOR DE 2 VISTAS */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Selector Global de Vista por Nivel de Autorización (Modo Prueba) */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1">
              <FlaskConical
                className={`w-3.5 h-3.5 shrink-0 ${
                  isTestModeActive ? 'text-amber-400 animate-pulse' : 'text-zinc-400'
                }`}
              />
              <span className="hidden xl:inline text-[10px] font-black uppercase text-zinc-400">
                Modo Prueba Vista:
              </span>
              <select
                value={testLevelId}
                onChange={(e) => setTestLevel(e.target.value)}
                className="text-[11px] font-black rounded-lg px-2 py-1 cursor-pointer max-w-[180px] sm:max-w-[230px]"
                style={{ backgroundColor: '#18181b', color: '#fbbf24', WebkitTextFillColor: '#fbbf24' }}
                title="Cambia entre las vistas de cada Nivel de Autorización (Modo Prueba)"
              >
                {TEST_AUTH_LEVELS.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            {/* Conmutador 2 Vistas (Vista Bacís vs Modo Oscuro) */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => handleSetTheme('bacis')}
                className={`px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  themeMode === 'bacis'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Vista Institucional con Colores Bacís"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bacís</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                className={`px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-gradient-to-r from-indigo-600 to-zinc-800 text-amber-300 border border-amber-500/40 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Modo Oscuro Minero"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Oscuro</span>
              </button>
            </div>
          </div>
        </header>

        {/* CINTA DE MODO PRUEBA ACTIVO (CUANDO SE SIMULA UN NIVEL ESPECÍFICO DE AUTORIZACIÓN) */}
        {isTestModeActive && (
          <div className="print:!hidden print:hidden bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400 text-zinc-950 px-4 py-2 border-b border-amber-600 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs shadow-sm shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-zinc-950 text-amber-400 font-black text-[10px] uppercase tracking-wider">
                🧪 MODO PRUEBA ACTIVO
              </span>
              <span className="font-black uppercase">{activeTestLevel.shortLabel}</span>
              <span className="text-[11px] font-mono bg-black/10 px-2 py-0.5 rounded font-bold">
                {activeTestLevel.email} · Rol: {activeTestLevel.rol} · Área: {activeTestLevel.departamento}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href="/autorizaciones"
                className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 font-black text-[11px]"
              >
                ✅ Consola Multi-Nivel
              </Link>
              <Link
                href="/contratistas"
                className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-zinc-950 font-black text-[11px]"
              >
                🏗️ Contratistas
              </Link>
              <Link
                href="/movimientos-sindicato"
                className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-zinc-950 font-black text-[11px]"
              >
                🔀 Escalafón
              </Link>
              <Link
                href="/mi-departamento"
                className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-zinc-950 font-black text-[11px]"
              >
                🏢 Mi Área
              </Link>
              <button
                type="button"
                onClick={() => setTestLevel('REAL_SESSION')}
                className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Salir de Prueba</span>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 transition-all duration-300 print:overflow-visible print:p-0 print:m-0">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
